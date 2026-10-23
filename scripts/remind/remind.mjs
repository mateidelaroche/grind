// Lancé par GitHub Actions : lit le planning publié par l'appli dans le Gist
// et envoie la notification push du créneau (soir 18h30 / après-midi 14h, heure de Paris).
import webpush from 'web-push'

const { GIST_ID, VAPID_PRIVATE, CRON = '', FORCE_SLOT = '', GIST_OWNER = 'mateidelaroche' } = process.env
const VAPID_PUBLIC = 'BPE_idk0pbeaic5AyJKqU7q_GCI1ivJJSyWO0Q-pBvfTvpZwftqDMI7LgUbua84sX8u02MmOF8DoMq2GQcEDGlY'
const FILE = 'grind-data.json'

if (!GIST_ID || !VAPID_PRIVATE) {
  console.log('GIST_ID ou VAPID_PRIVATE manquant : rien à faire.')
  process.exit(0)
}

// Heure de Paris actuelle et décalage UTC (+1 hiver, +2 été)
const now = new Date()
const parts = Object.fromEntries(
  new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Paris', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', hour12: false })
    .formatToParts(now).map((p) => [p.type, p.value]),
)
const parisDate = `${parts.year}-${parts.month}-${parts.day}`
const offset = ((Number(parts.hour) - now.getUTCHours()) + 24) % 24

// Chaque créneau a 2 crons (heure d'été / d'hiver) : on ne garde que celui qui correspond au décalage du jour.
const CRONS = {
  '30 16 * * *': { slot: 'soir', offset: 2 },
  '30 17 * * *': { slot: 'soir', offset: 1 },
  '0 12 * * *': { slot: 'aprem', offset: 2 },
  '0 13 * * *': { slot: 'aprem', offset: 1 },
}
let slot = FORCE_SLOT
if (!slot) {
  const c = CRONS[CRON]
  if (!c) { console.log(`Cron inconnu « ${CRON} »`); process.exit(0) }
  if (c.offset !== offset) { console.log(`Pas le bon cron pour UTC+${offset}`); process.exit(0) }
  slot = c.slot
}

// URL « raw » : lisible sans authentification pour un Gist secret dont on connaît l'ID, et sans limite d'API.
const res = await fetch(`https://gist.githubusercontent.com/${GIST_OWNER}/${GIST_ID}/raw/${FILE}?t=${Date.now()}`)
if (!res.ok) throw new Error(`Gist ${res.status}`)
const doc = await res.json()

if (!doc.settings?.reminders || !doc.push) { console.log('Rappels désactivés.'); process.exit(0) }
const entry = doc.notify?.[parisDate]
if (!entry) { console.log(`Rien de prévu le ${parisDate}.`); process.exit(0) }
if (entry.slot !== slot && !FORCE_SLOT) { console.log(`Le ${parisDate} est prévu pour le créneau ${entry.slot}.`); process.exit(0) }

webpush.setVapidDetails('https://mateidelaroche.github.io/grind/', VAPID_PUBLIC, VAPID_PRIVATE)
try {
  await webpush.sendNotification(doc.push, JSON.stringify({ title: entry.title, body: entry.body }), { TTL: 3600 })
  console.log(`Notification envoyée (${parisDate}, ${slot}).`)
} catch (e) {
  console.log(`Échec de l'envoi : ${e.statusCode ?? ''} ${e.body ?? e.message}`)
  if (e.statusCode !== 404 && e.statusCode !== 410) process.exit(1)
}

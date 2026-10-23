// Rappels : l'appli publie dans le Gist le planning des 14 prochains jours ;
// une GitHub Action lit ce planning chaque jour et envoie la notification push.
import { SESSIONS } from '../data/sessions'
import { addDays, dayPlan, today, weekday } from './program'
import { useStore } from '../store'

export const VAPID_PUBLIC = 'BPE_idk0pbeaic5AyJKqU7q_GCI1ivJJSyWO0Q-pBvfTvpZwftqDMI7LgUbua84sX8u02MmOF8DoMq2GQcEDGlY'

export interface NotifyEntry { slot: 'soir' | 'aprem'; title: string; body: string }

export function notifyPlan(s: { overrides: Record<string, string>; settings: { reminders: boolean } }): Record<string, NotifyEntry> {
  if (!s.settings.reminders) return {}
  const out: Record<string, NotifyEntry> = {}
  const d0 = today()
  for (let i = 0; i < 14; i++) {
    const date = addDays(d0, i)
    const plan = dayPlan(date, s.overrides)
    const weekend = weekday(date) >= 5
    if (plan.type === 'session') {
      const ses = SESSIONS[plan.session]
      out[date] = {
        slot: weekend ? 'aprem' : 'soir',
        title: `💪 ${ses.name} ${weekend ? 'aujourd’hui' : 'ce soir'}`,
        body: `${ses.subtitle} · ${ses.duration}. Pas le temps ? Fais l’express en 25 min.`,
      }
    } else if (plan.type === 'basket') {
      out[date] = {
        slot: 'soir',
        title: plan.match ? '🏀 Match ce soir' : '🏀 Basket ce soir',
        body: 'Fais ta routine genoux (7 min) avant de partir.',
      }
    }
  }
  return out
}

const b64ToBytes = (b64: string) => {
  const pad = '='.repeat((4 - (b64.length % 4)) % 4)
  const raw = atob((b64 + pad).replace(/-/g, '+').replace(/_/g, '/'))
  return Uint8Array.from(raw, (c) => c.charCodeAt(0))
}

export const isStandalone = () =>
  window.matchMedia('(display-mode: standalone)').matches || (navigator as Navigator & { standalone?: boolean }).standalone === true

export const pushSupported = () => 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window

export async function enableReminders(): Promise<string | undefined> {
  if (!pushSupported()) return isStandalone() ? 'Notifications non supportées sur cet appareil.' : 'Installe d’abord l’appli sur l’écran d’accueil (Partager → Sur l’écran d’accueil).'
  const perm = await Notification.requestPermission()
  if (perm !== 'granted') return 'Permission refusée. Tu peux la réactiver dans Réglages iOS → Notifications → Grind.'
  const reg = await navigator.serviceWorker.ready
  const sub = (await reg.pushManager.getSubscription()) ?? (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64ToBytes(VAPID_PUBLIC) }))
  const st = useStore.getState()
  st.setPush(sub.toJSON())
  st.setSettings({ reminders: true })
  if (!st.sync.token) return 'Rappels activés sur le téléphone. Connecte la synchro pour que le serveur puisse te les envoyer.'
}

export async function disableReminders() {
  useStore.getState().setSettings({ reminders: false })
}

export async function testNotification() {
  const reg = await navigator.serviceWorker.ready
  await reg.showNotification('Grind', { body: 'Les notifications fonctionnent 💪', icon: 'icon-192.png' })
}

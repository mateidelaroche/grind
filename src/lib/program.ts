import { EXERCISES } from '../data/exercises'
import { SESSIONS } from '../data/sessions'
import type { Band, Block, DayPlan, Equip, Item, ItemEdit, Level, Sac, SessionId, Workout } from '../types'

// ───────────── Dates (heure locale) ─────────────
export const toISO = (d: Date) => {
  const m = `${d.getMonth() + 1}`.padStart(2, '0')
  const day = `${d.getDate()}`.padStart(2, '0')
  return `${d.getFullYear()}-${m}-${day}`
}
export const fromISO = (s: string) => {
  const [y, m, d] = s.split('-').map(Number)
  return new Date(y, m - 1, d)
}
export const addDays = (s: string, n: number) => {
  const d = fromISO(s)
  d.setDate(d.getDate() + n)
  return toISO(d)
}
export const today = () => toISO(new Date())
export const diffDays = (a: string, b: string) => Math.round((fromISO(a).getTime() - fromISO(b).getTime()) / 86400000)
/** 0 = lundi … 6 = dimanche */
export const weekday = (s: string) => (fromISO(s).getDay() + 6) % 7
export const DAY_SHORT = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim']
export const DAY_LONG = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche']
export const formatDate = (s: string) =>
  fromISO(s).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })
export const mondayOf = (s: string) => addDays(s, -weekday(s))

// ───────────── Programme ─────────────
export const DEFAULT_START = '2026-10-26'
export const PROGRAM_WEEKS = 12

export function weekNumber(date: string, start: string): number {
  const d = diffDays(date, start)
  return d < 0 ? 0 : Math.floor(d / 7) + 1
}

export interface Phase { key: string; name: string; desc: string }
export function phaseOf(week: number): Phase {
  if (week <= 0) return { key: 'S0', name: 'Avant-programme', desc: 'Prends tes marques : teste les élastiques, vérifie les ancrages.' }
  if (week <= 2) return { key: 'learn', name: 'Apprentissage', desc: '1 série en moins par exercice, RIR 3. Priorité à la technique.' }
  if (week <= 8) return { key: 'build', name: 'Construction', desc: 'Toutes les séries, RIR 1-2. Double progression à fond.' }
  if (week === 9) return { key: 'deload', name: 'Semaine allégée', desc: 'Moitié des séries. Le corps encaisse les progrès.' }
  if (week <= 12) return { key: 'intens', name: 'Intensification', desc: 'Rest-pause sur la dernière série des exos principaux.' }
  return { key: 'build', name: 'Après le programme', desc: 'Fais le bilan avec ton coach. En attendant : construction.' }
}

const BASE_WEEK: DayPlan[] = [
  { type: 'basket' },
  { type: 'session', session: 'C' },
  { type: 'session', session: 'A' },
  { type: 'basket' },
  { type: 'rest' },
  { type: 'basket', match: true },
  { type: 'session', session: 'B' },
]

export const isBasketDay = (date: string) => BASE_WEEK[weekday(date)].type === 'basket'

export function dayPlan(date: string, overrides: Record<string, string>): DayPlan {
  const o = overrides[date]
  const base = BASE_WEEK[weekday(date)]
  if (o === 'rest') return base.type === 'basket' ? base : { type: 'rest' }
  if (o) return { type: 'session', session: o as SessionId, moved: true }
  return base
}

/** Séance jambes la veille d'un basket ? */
export const legWarning = (session: SessionId, date: string) => session === 'C' && isBasketDay(addDays(date, 1))

// ───────────── Niveaux / matériel ─────────────
export function effectiveLevel(exId: string, item: Item, userLevels: Record<string, number>, week: number, routine: boolean): number {
  const ex = EXERCISES[exId]
  const max = (ex.levels?.length ?? 1) - 1
  let lvl = routine ? item.level ?? 0 : userLevels[exId] ?? item.level ?? 0
  if (!routine && item.minLevelFromWeek) {
    for (const [w, l] of Object.entries(item.minLevelFromWeek)) if (week >= Number(w)) lvl = Math.max(lvl, l)
  }
  return Math.max(0, Math.min(lvl, max))
}

export const levelOf = (exId: string, lvl: number): Level | undefined => EXERCISES[exId].levels?.[lvl]
export const animOf = (exId: string, lvl: number) => levelOf(exId, lvl)?.anim ?? EXERCISES[exId].anim

export function effectiveSets(sets: number, week: number, routine: boolean) {
  if (routine) return sets
  if (week <= 2) return Math.max(1, sets - 1)
  if (week === 9) return Math.max(1, Math.ceil(sets / 2))
  return sets
}

export const ANCHOR_LABEL = { bas: 'Ancrage bas (pied du lit)', milieu: 'Ancrage milieu (porte, poitrine)', haut: 'Ancrage haut (porte)' }

export interface Gear { bands: Band[]; sac: Sac[]; equip: Equip[]; anchors: string[] }

export function gearForExercise(exId: string, lvl: number): Gear {
  const ex = EXERCISES[exId]
  const level = levelOf(exId, lvl)
  const equip = new Set(ex.equipment)
  if (level?.band) equip.add('elastique')
  if (level?.sac) equip.add('sac')
  return {
    bands: level?.band ? [level.band] : [],
    sac: level?.sac ? [level.sac] : [],
    equip: [...equip],
    anchors: ex.anchor ? [ANCHOR_LABEL[ex.anchor]] : [],
  }
}

// ───────────── Construction des étapes d'une séance ─────────────
export interface Step {
  key: string
  phase: 'warmup' | 'main' | 'cooldown'
  kind: 'work' | 'rest'
  /** Clé d'enregistrement des séries (bloc:item) — seulement pour la partie principale. */
  recKey?: string
  ex?: string
  item?: Item
  level?: number
  label?: string
  round?: number
  rounds?: number
  side?: 'gauche' | 'droite'
  duration?: number
  rest?: number
  /** Démarrage automatique du chrono (2e côté, étirements). */
  autoStart?: boolean
  restPause?: boolean
}

export interface BuildOpts {
  week: number
  express: boolean
  levels: Record<string, number>
  edits: Record<string, ItemEdit>
  timeTargets: Record<string, number>
}

export const editKey = (sid: SessionId, blockId: string, idx: number) => `${sid}:${blockId}:${idx}`

export function effectiveItem(sid: SessionId, block: Block, idx: number, edits: Record<string, ItemEdit>): Item {
  const item = block.items[idx]
  const e = edits[editKey(sid, block.id, idx)]
  return e ? { ...item, sets: e.sets ?? item.sets, reps: e.reps ?? item.reps } : item
}
export function effectiveRest(sid: SessionId, block: Block, edits: Record<string, ItemEdit>) {
  return edits[editKey(sid, block.id, 0)]?.rest ?? block.rest
}

export function sessionBlocks(sid: SessionId, express: boolean) {
  const s = SESSIONS[sid]
  return express ? s.blocks.filter((b) => b.express) : s.blocks
}

function stepsFor(sid: SessionId, phase: Step['phase'], o: BuildOpts): Step[] {
  const session = SESSIONS[sid]
  const routine = session.kind === 'routine'
  const blocks = phase === 'main' ? sessionBlocks(sid, o.express) : session.blocks
  const steps: Step[] = []
  blocks.forEach((block, bi) => {
    const items = block.items.map((_, i) => effectiveItem(sid, block, i, o.edits))
    const rounds = Math.max(...items.map((it) => effectiveSets(it.sets, o.week, routine)))
    const rest = effectiveRest(sid, block, o.edits)
    for (let r = 1; r <= rounds; r++) {
      items.forEach((item, ii) => {
        const sets = effectiveSets(item.sets, o.week, routine)
        if (r > sets) return
        const ex = EXERCISES[item.ex]
        const level = effectiveLevel(item.ex, item, o.levels, o.week, routine)
        const label = items.length > 1 ? `${block.id}${ii + 1}` : block.id
        const base: Step = {
          key: `${phase}:${sid}:${block.id}:${ii}:${r}`,
          phase, kind: 'work', ex: item.ex, item, level, label, round: r, rounds: sets,
          recKey: phase === 'main' ? `${block.id}:${ii}` : undefined,
          restPause: phase === 'main' && !!block.restPause && o.week >= 10 && o.week <= 12 && r === sets && ii < 2,
        }
        if (item.duration) {
          const duration = o.timeTargets[item.ex] ?? item.duration
          const auto = phase === 'cooldown'
          if (ex.perSide) {
            steps.push({ ...base, key: base.key + ':g', side: 'gauche', duration, autoStart: auto })
            steps.push({ ...base, key: base.key + ':d', side: 'droite', duration, autoStart: true })
          } else steps.push({ ...base, duration, autoStart: auto })
        } else steps.push(base)
      })
      const lastOfAll = bi === blocks.length - 1 && r === rounds
      if (rest > 0 && !lastOfAll) steps.push({ key: `${phase}:${sid}:${block.id}:rest:${r}`, phase, kind: 'rest', rest })
    }
  })
  return steps
}

export function buildSteps(sid: SessionId, o: BuildOpts): Step[] {
  const s = SESSIONS[sid]
  const steps: Step[] = []
  if (s.warmup === 'general') steps.push(...stepsFor('WARMUP', 'warmup', o))
  if (s.warmup === 'genoux') steps.push(...stepsFor('GENOUX', 'warmup', o))
  steps.push(...stepsFor(sid, 'main', o))
  if (s.cooldown) steps.push(...stepsFor('COOLDOWN', 'cooldown', o))
  return steps
}

/** Matériel à préparer pour toute la séance. */
export function sessionGear(sid: SessionId, o: BuildOpts) {
  const bands = new Set<Band>(), sac = new Set<Sac>(), equip = new Set<Equip>(), anchors = new Set<string>()
  for (const st of buildSteps(sid, o)) {
    if (st.kind !== 'work' || !st.ex) continue
    const g = gearForExercise(st.ex, st.level ?? 0)
    g.bands.forEach((b) => bands.add(b)); g.sac.forEach((x) => sac.add(x)); g.equip.forEach((x) => equip.add(x)); g.anchors.forEach((x) => anchors.add(x))
  }
  const order: Band[] = ['L', 'M', 'F']
  return { bands: order.filter((b) => bands.has(b)), sac: [...sac], equip: [...equip], anchors: [...anchors] }
}

// ───────────── Progression ─────────────
export interface Suggestion { ex: string; from: number; to: number; reason: string }

export function suggestions(w: Workout, history: Workout[], levels: Record<string, number>): Suggestion[] {
  const out: Suggestion[] = []
  const seen = new Set<string>()
  for (const rec of Object.values(w.sets)) {
    if (seen.has(rec.ex)) continue
    seen.add(rec.ex)
    const ex = EXERCISES[rec.ex]
    const max = (ex.levels?.length ?? 1) - 1
    const cur = levels[rec.ex] ?? rec.level
    if (cur >= max) continue
    const clean = (r: { done: number; total: number; flags: string[] }) => r.done >= r.total && !r.flags.includes('hard')
    if (rec.flags.includes('easy')) {
      out.push({ ex: rec.ex, from: cur, to: cur + 1, reason: 'Tu l’as trouvé trop facile.' })
      continue
    }
    const past = history
      .filter((h) => h.completed && h.id !== w.id)
      .map((h) => Object.values(h.sets).find((r) => r.ex === rec.ex && r.level === cur))
      .filter(Boolean)
      .slice(-2) as typeof rec[]
    if (clean(rec) && past.length === 2 && past.every(clean)) {
      out.push({ ex: rec.ex, from: cur, to: cur + 1, reason: '3 séances de suite avec toutes les séries validées.' })
    }
  }
  return out
}

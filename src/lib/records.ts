import { EXERCISES } from '../data/exercises'
import { SESSIONS } from '../data/sessions'
import { addDays, mondayOf } from './program'
import { RUN_PLAN } from '../data/running'
import { fmtDur, fmtKm, fmtPace } from './gps'
import type { LevelEvent, RunLog, TestId, TestKey, TestResult, Workout } from '../types'

export const TESTS: { key: TestKey; label: string; unit: 'reps' | 's' }[] = [
  { key: 'pompes', label: 'Pompes max (strictes)', unit: 'reps' },
  { key: 'pike', label: 'Pike push-ups max', unit: 'reps' },
  { key: 'planche', label: 'Planche (temps max)', unit: 's' },
  { key: 'chaise', label: 'Chaise contre le mur (temps max)', unit: 's' },
  { key: 'bulgareD', label: 'Fentes bulgares max · jambe droite', unit: 'reps' },
  { key: 'bulgareG', label: 'Fentes bulgares max · jambe gauche', unit: 'reps' },
  { key: 'tractions', label: 'Tractions max', unit: 'reps' },
]
export const TEST_IDS: TestId[] = ['S0', 'S6', 'S12']
export const TEST_WEEK: Record<TestId, number> = { S0: 0, S6: 6, S12: 12 }

export const MILESTONES = [10, 25, 50, 100, 150, 200]

const isMuscu = (w: Workout) => w.completed && SESSIONS[w.session].kind === 'muscu'

/** Plus longue durée tenue par exercice en temps. */
export function holdBests(workouts: Workout[]) {
  const out: Record<string, { s: number; date: string }> = {}
  for (const w of workouts) {
    for (const r of Object.values(w.sets)) {
      if (r.best && (!out[r.ex] || r.best > out[r.ex].s)) out[r.ex] = { s: r.best, date: w.date }
    }
  }
  return out
}

/** Plus longue série de semaines consécutives avec au moins 3 séances muscu. */
export function longestStreak(workouts: Workout[]) {
  const weeks = new Map<string, number>()
  for (const w of workouts.filter(isMuscu)) weeks.set(mondayOf(w.date), (weeks.get(mondayOf(w.date)) ?? 0) + 1)
  const ok = [...weeks.entries()].filter(([, n]) => n >= 3).map(([m]) => m).sort()
  let best = 0, cur = 0, prev = ''
  for (const m of ok) {
    cur = prev && addDays(prev, 7) === m ? cur + 1 : 1
    best = Math.max(best, cur)
    prev = m
  }
  return best
}

export function testBests(tests: Partial<Record<TestId, TestResult>>) {
  const out: Partial<Record<TestKey, { v: number; id: TestId }>> = {}
  for (const id of TEST_IDS) {
    const t = tests[id]
    if (!t) continue
    for (const { key } of TESTS) {
      const v = t.values[key]
      if (v !== undefined && (!out[key] || v > out[key]!.v)) out[key] = { v, id }
    }
  }
  return out
}

export interface NewRecord { icon: string; text: string }

/** Records battus par une séance (comparée à tout ce qui précède). */
export function recordsOfWorkout(w: Workout, all: Workout[]): NewRecord[] {
  const before = all.filter((x) => x.startedAt < w.startedAt)
  const prevBests = holdBests(before)
  const out: NewRecord[] = []
  for (const r of Object.values(w.sets)) {
    if (!r.best) continue
    const prev = prevBests[r.ex]?.s ?? 0
    if (prev > 0 && r.best > prev) out.push({ icon: '⏱️', text: `${EXERCISES[r.ex].name} : ${r.best} s (avant ${prev} s)` })
  }
  if (isMuscu(w)) {
    const n = before.filter(isMuscu).length + 1
    if (MILESTONES.includes(n)) out.push({ icon: '🎯', text: `${n}e séance muscu !` })
    const streakBefore = longestStreak(before)
    const streakNow = longestStreak([...before, w])
    if (streakNow > streakBefore && streakNow >= 2) out.push({ icon: '🔥', text: `Record de régularité : ${streakNow} semaines d’affilée` })
  }
  return out
}

/** Records d'un nouveau test par rapport aux précédents. */
export function recordsOfTest(id: TestId, r: TestResult, tests: Partial<Record<TestId, TestResult>>): NewRecord[] {
  const others = Object.fromEntries(Object.entries(tests).filter(([k]) => k !== id))
  const prev = testBests(others)
  const out: NewRecord[] = []
  for (const t of TESTS) {
    const v = r.values[t.key]
    const p = prev[t.key]?.v
    if (v !== undefined && p !== undefined && v > p) out.push({ icon: '🏆', text: `${t.label} : ${v} ${t.unit} (avant ${p})` })
  }
  return out
}

export const levelLabel = (e: LevelEvent) => `${EXERCISES[e.ex]?.name ?? e.ex} → niveau ${e.level + 1}`

// ───────────── Course ─────────────
export const RUN_KM_MILESTONES = [10, 25, 50, 100, 150, 200]
const outdoor = (r: RunLog) => !r.indoor && r.dist > 0

export interface RunBests {
  /** Plus longue course sans marcher (s). */
  longest?: { v: number; date: string }
  farthest?: { v: number; date: string }
  /** Meilleure allure sur une fraction de course d'au moins 3 min (s/km). */
  pace?: { v: number; date: string }
  /** Meilleur temps sur l'étape 5 km (s). */
  fiveK?: { v: number; date: string }
  totalKm: number
  count: number
}

export function runBests(runs: RunLog[]): RunBests {
  const out: RunBests = { totalKm: 0, count: 0 }
  const better = (k: 'longest' | 'farthest' | 'pace' | 'fiveK', v: number, date: string, lower = false) => {
    const cur = out[k]
    if (!cur || (lower ? v < cur.v : v > cur.v)) out[k] = { v, date }
  }
  for (const r of runs.filter(outdoor)) {
    out.count++
    out.totalKm += r.dist / 1000
    better('farthest', r.dist, r.date)
    for (const sp of r.splits) {
      if (sp.kind !== 'run') continue
      better('longest', sp.dur, r.date)
      if (sp.dur >= 180 && sp.dist >= 400) better('pace', sp.dur / (sp.dist / 1000), r.date, true)
    }
    // Étape « jusqu'à 5 km » menée au bout : c'est le chrono du 5 km.
    const goal = r.plan >= 0 && RUN_PLAN[r.plan]?.main.some((st) => st.dist)
    const sp = goal ? r.splits.find((x) => x.kind === 'run' && x.full) : undefined
    if (sp) better('fiveK', sp.dur, r.date, true)
  }
  return out
}

export function recordsOfRun(r: RunLog, all: RunLog[]): NewRecord[] {
  if (!outdoor(r)) return []
  const prev = runBests(all.filter((x) => x.startedAt < r.startedAt && x.id !== r.id))
  const now = runBests([...all.filter((x) => x.startedAt < r.startedAt && x.id !== r.id), r])
  const out: NewRecord[] = []
  const min = (s: number) => `${Math.floor(s / 60)} min${s % 60 >= 30 ? ' 30' : ''}`
  if (now.fiveK && now.fiveK.date === r.date && (!prev.fiveK || now.fiveK.v < prev.fiveK.v)) {
    out.push({ icon: '🏁', text: prev.fiveK ? `5 km en ${fmtDur(now.fiveK.v)} (avant ${fmtDur(prev.fiveK.v)})` : `Tes premiers 5 km sans t’arrêter : ${fmtDur(now.fiveK.v)} !` })
  }
  if (prev.longest && now.longest!.v > prev.longest.v + 5) out.push({ icon: '🏃', text: `Plus longue course sans t’arrêter : ${min(now.longest!.v)} (avant ${min(prev.longest.v)})` })
  if (prev.farthest && now.farthest!.v > prev.farthest.v + 50) out.push({ icon: '📏', text: `Plus longue sortie : ${fmtKm(now.farthest!.v)} km` })
  if (prev.pace && now.pace && now.pace.v < prev.pace.v - 3 && now.pace.date === r.date) out.push({ icon: '⚡', text: `Meilleure allure : ${fmtPace(now.pace.v)} /km (avant ${fmtPace(prev.pace.v)})` })
  const km = RUN_KM_MILESTONES.find((m) => prev.totalKm < m && now.totalKm >= m)
  if (km) out.push({ icon: '🎯', text: `${km} km courus au total !` })
  return out
}

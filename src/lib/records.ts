import { EXERCISES } from '../data/exercises'
import { SESSIONS } from '../data/sessions'
import { addDays, mondayOf } from './program'
import type { LevelEvent, TestId, TestKey, TestResult, Workout } from '../types'

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

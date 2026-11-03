// Tests de la logique et des données (lancés avant chaque mise en ligne : npm test).
import { describe, expect, it } from 'vitest'
import { ANIMS } from './anim/anims'
import { applyTempo, poseAt, skeleton, cycleLength } from './anim/rig'
import { EXERCISES } from './data/exercises'
import { SESSIONS } from './data/sessions'
import { VIDEOS } from './data/videos'
import { buildSteps, dayPlan, lastReps, repRange, suggestions, weightTrend } from './lib/program'
import type { SessionId, SetRecord, Workout } from './types'

const opts = (week: number) => ({ week, express: false, levels: {}, edits: {}, timeTargets: {} })
const workout = (id: string, date: string, sets: Record<string, Partial<SetRecord>>, session: SessionId = 'A'): Workout => ({
  id, date, session, express: false, startedAt: new Date(date).getTime(), endedAt: new Date(date).getTime() + 2400e3, completed: true,
  sets: Object.fromEntries(Object.entries(sets).map(([k, r]) => [k, { ex: 'pushup', total: 4, level: 0, done: 4, flags: [], ...r } as SetRecord])),
})

describe('données', () => {
  it('chaque exercice des séances existe et a une animation', () => {
    for (const ses of Object.values(SESSIONS)) for (const b of ses.blocks) for (const it of b.items) {
      expect(EXERCISES[it.ex], `${ses.id} → ${it.ex}`).toBeDefined()
      expect(ANIMS[EXERCISES[it.ex].anim], `animation de ${it.ex}`).toBeDefined()
    }
  })
  it('les animations des niveaux existent', () => {
    for (const ex of Object.values(EXERCISES)) for (const l of ex.levels ?? []) if (l.anim) expect(ANIMS[l.anim], `${ex.id} · ${l.label}`).toBeDefined()
  })
  it('chaque vidéo correspond à un exercice ou à un niveau', () => {
    const levelAnims = new Set(Object.values(EXERCISES).flatMap((e) => (e.levels ?? []).map((l) => l.anim).filter(Boolean)))
    for (const key of Object.keys(VIDEOS)) expect(!!EXERCISES[key] || levelAnims.has(key), key).toBe(true)
  })
  it('aucune animation ne produit de position invalide', () => {
    for (const [id, a] of Object.entries(ANIMS)) {
      for (let k = 0; k < 8; k++) {
        const sk = skeleton(poseAt(a, (cycleLength(a) * k) / 8), a.view)
        for (const [j, v] of Object.entries(sk)) if (Array.isArray(v)) expect(v.every(Number.isFinite), `${id} · ${j}`).toBe(true)
      }
    }
  })
})

describe('séances', () => {
  it('la séance A contient échauffement, séries, repos et retour au calme', () => {
    const steps = buildSteps('A', opts(3))
    expect(steps.some((s) => s.phase === 'warmup')).toBe(true)
    expect(steps.some((s) => s.phase === 'cooldown')).toBe(true)
    expect(steps.some((s) => s.kind === 'rest')).toBe(true)
    expect(steps.filter((s) => s.phase === 'main' && s.kind === 'work').every((s) => s.recKey)).toBe(true)
  })
  it('les étirements du matin s’allongent au fil du programme', () => {
    const first = (w: number) => buildSteps('MATIN', opts(w)).find((s) => s.kind === 'work')!.duration!
    expect(first(3)).toBe(first(1) + 5)
    expect(first(8)).toBe(first(1) + 10)
  })
  it('le programme de la semaine type est respecté', () => {
    expect(dayPlan('2026-11-03', {})).toEqual({ type: 'session', session: 'C' }) // mardi
    expect(dayPlan('2026-11-04', {})).toEqual({ type: 'session', session: 'A' }) // mercredi
    expect(dayPlan('2026-11-08', {})).toEqual({ type: 'session', session: 'B' }) // dimanche
  })
})

describe('progression', () => {
  it('lit la fourchette de reps', () => {
    expect(repRange('A', 'A:0')).toEqual([8, 12])
  })
  it('propose le niveau au-dessus après 2 séances en haut de la fourchette', () => {
    const prev = workout('p', '2026-11-04', { 'A:0': { reps: [12, 12, 12, 12] } })
    const cur = workout('c', '2026-11-11', { 'A:0': { reps: [12, 13, 12, 12] } })
    expect(suggestions(cur, [prev], {})).toEqual([expect.objectContaining({ ex: 'pushup', from: 0, to: 1 })])
  })
  it('ne propose rien si une seule séance est en haut de la fourchette', () => {
    const prev = workout('p', '2026-11-04', { 'A:0': { reps: [12, 11, 10, 9] } })
    const cur = workout('c', '2026-11-11', { 'A:0': { reps: [12, 12, 12, 12] } })
    expect(suggestions(cur, [prev], {})).toEqual([])
  })
  it('propose de redescendre après 2 séances sous la fourchette', () => {
    const prev = workout('p', '2026-11-04', { 'A:0': { level: 1, reps: [6, 5, 5, 4] } })
    const cur = workout('c', '2026-11-11', { 'A:0': { level: 1, reps: [7, 6, 5, 5] } })
    expect(suggestions(cur, [prev], { pushup: 1 })).toEqual([expect.objectContaining({ to: 0 })])
  })
  it('propose les reps de la dernière fois sur la même série', () => {
    const steps = buildSteps('A', opts(3)).filter((s) => s.recKey === 'A:0')
    const prev = workout('p', '2026-11-04', { 'A:0': { reps: [11, 10, 9, 9] } })
    expect(lastReps(steps[1], 'A', [prev])).toBe(10)
    expect(lastReps(steps[1], 'A', [])).toBe(8)
  })
})

describe('tempo et poids', () => {
  it('cale l’animation sur le tempo 3-1-1', () => {
    const t = applyTempo(ANIMS.pushup, '3-1-1')
    expect(t.dur[0]).toBe(3) // descente
    expect(t.hold?.[1]).toBe(1) // pause en bas
    expect(t.dur[1]).toBe(1) // montée
  })
  it('calcule le rythme de prise de masse', () => {
    const w = { '2026-10-12': 76, '2026-10-19': 76.3, '2026-10-26': 76.7, '2026-11-02': 77 }
    const t = weightTrend(w, '2026-11-02')!
    expect(t.perWeek).toBeCloseTo(0.34, 1)
    expect(t.verdict).toBe('ok')
    expect(weightTrend({ '2026-10-26': 77, '2026-11-02': 77 }, '2026-11-02')).toBeUndefined()
  })
})

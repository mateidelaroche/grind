// Tests de la logique et des données (lancés avant chaque mise en ligne : npm test).
import { describe, expect, it } from 'vitest'
import { ANIMS } from './anim/anims'
import { applyTempo, poseAt, skeleton, cycleLength } from './anim/rig'
import { EXERCISES } from './data/exercises'
import { SESSIONS } from './data/sessions'
import { VIDEOS } from './data/videos'
import { buildSteps, dayPlan, lastReps, repRange, suggestions, weightTrend } from './lib/program'
import { VARIANTS } from './data/variants'
import { autoSwaps, clashes, optionsFor, problemsFor, shiftReps } from './lib/variants'
import type { SessionId, SetRecord, Swap, Workout } from './types'

const opts = (week: number) => ({ week, express: false, levels: {}, edits: {}, timeTargets: {} })
const workout = (id: string, date: string, sets: Record<string, Partial<SetRecord>>, session: SessionId = 'A'): Workout => ({
  id, date, session, express: false, startedAt: new Date(date).getTime(), endedAt: new Date(date).getTime() + 2400e3, completed: true,
  sets: Object.fromEntries(Object.entries(sets).map(([k, r]) => [k, { ex: 'pushup', total: 4, level: 0, done: 4, flags: [], ...r } as SetRecord])),
})

describe('données', () => {
  it('chaque exercice des séances existe et a une animation', () => {
    for (const ses of Object.values(SESSIONS)) for (const b of ses.blocks) for (const it of b.items) {
      expect(EXERCISES[it.ex], `${ses.id} → ${it.ex}`).toBeDefined()
      expect(ANIMS[EXERCISES[it.ex].anim!], `animation de ${it.ex}`).toBeDefined()
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

describe('variantes', () => {
  const ctx = { levels: {}, unavailable: [] }
  const item = (ex: string) => Object.values(SESSIONS).flatMap((s) => s.blocks.flatMap((b) => b.items)).find((i) => i.ex === ex)!
  const base = (ex: string, level = item(ex).level ?? 0) => ({ ex, level, item: item(ex) })

  it('les variantes existent, ont une démo et un objectif', () => {
    for (const [ex, list] of Object.entries(VARIANTS)) {
      expect(EXERCISES[ex], ex).toBeDefined()
      for (const v of list) {
        const target = EXERCISES[v.ex]
        expect(target, `${ex} → ${v.ex}`).toBeDefined()
        expect(!!target.anim || !!VIDEOS[v.ex], `démo de ${v.ex}`).toBe(true)
        expect(!!v.reps || !!v.duration, `objectif de ${ex} → ${v.ex}`).toBe(true)
        if (v.level !== undefined) expect(target.levels?.[v.level], `${ex} → niveau ${v.level}`).toBeDefined()
      }
    }
  })
  it('chaque exercice des séances A, B et C a une variante', () => {
    for (const id of ['A', 'B', 'C'] as const) for (const b of SESSIONS[id].blocks) for (const it of b.items) expect(VARIANTS[it.ex], it.ex).toBeDefined()
  })
  it('une variante n’utilise jamais le matériel en cause', () => {
    for (const ex of Object.keys(VARIANTS).filter((e) => item(e))) {
      for (const p of ['porte', 'lit', 'sac', 'livres'] as const) {
        for (const o of optionsFor(base(ex), ctx, p)) expect(clashes(o.ex, o.level, new Set([p])), `${ex} / ${p} → ${o.ex}`).toBe(false)
      }
    }
  })
  it('la porte qui lâche : les 5 exercices accrochés ont une variante validée', () => {
    const first = (ex: string) => optionsFor(base(ex), ctx, 'porte')[0]?.ex
    expect(first('face-pull')).toBe('pull-apart')
    expect(first('pulldown-kneel')).toBe('row-backpack')
    expect(first('crunch-band')).toBe('leg-raise')
    expect(first('pullover')).toBe('row-seated')
    expect(first('fly-band')).toBe('pushup')
  })
  it('un élastique cassé : d’abord le même exercice avec un autre élastique, reps adaptées', () => {
    const [a] = optionsFor(base('curl', 1), ctx, 'elastique')
    expect(a).toMatchObject({ ex: 'curl', level: 2, reps: '8-13' })
    const lighter = optionsFor(base('curl', 2), { ...ctx, unavailable: ['band:M'] }, 'elastique')[0]
    expect(lighter).toMatchObject({ ex: 'curl', level: 0, reps: '13-18', tempo: '4-0-1' })
    expect(shiftReps('12-15 / bras', 3)).toBe('15-18 / bras')
  })
  it('ne propose que les problèmes qui concernent l’exercice', () => {
    expect(problemsFor(base('face-pull'), ctx)).toEqual(expect.arrayContaining(['elastique', 'porte']))
    expect(problemsFor(base('face-pull'), ctx)).not.toContain('sac')
  })
  it('remplace les séries restantes et garde celles déjà faites', () => {
    const swaps: Record<string, Swap[]> = { 'main:A:C:1': [{ ex: 'pull-apart', level: 0, reps: '15-20', fromRound: 2 }] }
    const steps = buildSteps('A', { ...opts(3), swaps }).filter((s) => s.slot === 'main:A:C:1')
    expect(steps.map((s) => s.ex)).toEqual(['face-pull', 'pull-apart', 'pull-apart'])
    expect(steps.map((s) => s.recKey)).toEqual(['C:1', 'C:1~pull-apart@0', 'C:1~pull-apart@0'])
    expect(steps.map((s) => s.recTotal)).toEqual([1, 2, 2])
    expect(steps.map((s) => s.recRound)).toEqual([1, 1, 2])
    expect(steps[1].orig?.ex).toBe('face-pull')
  })
  it('revenir à l’exercice d’origine reprend son enregistrement', () => {
    const swaps: Record<string, Swap[]> = { 'main:A:C:1': [{ ex: 'pull-apart', level: 0, fromRound: 2 }, { ex: 'face-pull', level: 0, fromRound: 3, orig: true }] }
    const steps = buildSteps('A', { ...opts(3), swaps }).filter((s) => s.slot === 'main:A:C:1')
    expect(steps.map((s) => s.ex)).toEqual(['face-pull', 'pull-apart', 'face-pull'])
    expect(steps.map((s) => s.recTotal)).toEqual([2, 1, 2])
    expect(steps[2].recRound).toBe(2)
  })
  it('une variante en temps à la place de reps donne bien un chrono', () => {
    const swaps: Record<string, Swap[]> = { 'main:C:B:0': [{ ex: 'wall-sit', level: 0, duration: 40, durationLabel: '30-60 s', fromRound: 1 }] }
    const st = buildSteps('C', { ...opts(3), swaps }).find((s) => s.slot === 'main:C:B:0')!
    expect(st.duration).toBe(40)
    expect(st.item?.reps).toBeUndefined()
  })
  it('une variante ne fausse pas la progression de l’exercice d’origine', () => {
    const prev = workout('p', '2026-11-04', { 'A:0': { reps: [12, 12, 12, 12] } })
    const cur = workout('c', '2026-11-11', { 'A:0': { total: 2, done: 2, reps: [12, 12] }, 'A:0~pushup-diamond@0': { ex: 'pushup-diamond', total: 2, done: 2, reps: [15, 15] } })
    expect(suggestions(cur, [prev], {})).toEqual([])
    const next = workout('n', '2026-11-18', { 'A:0': { reps: [12, 12, 12, 12] } })
    expect(suggestions(next, [cur], {})).toEqual([])
  })
  it('la porte cochée indisponible remplace tout au démarrage de la séance', () => {
    const { swaps } = autoSwaps('A', opts(3), { levels: {}, unavailable: ['porte'] }, {})
    const exs = buildSteps('A', { ...opts(3), swaps }).filter((s) => s.kind === 'work' && s.phase !== 'cooldown').map((s) => s.ex!)
    expect(exs).not.toContain('face-pull')
    expect(exs).not.toContain('pulldown-kneel')
    expect(exs).not.toContain('crunch-band')
    expect(exs).toContain('pull-apart')
  })
  it('une variante prévue s’applique une fois, sauf si son matériel manque', () => {
    const planned = { pushup: { ex: 'pushup-diamond', level: 1, reps: '6-10' } }
    expect(autoSwaps('A', opts(3), { levels: {}, unavailable: [] }, planned).used).toEqual(['pushup'])
    const sac = { pushup: { ex: 'row-backpack', level: 0 } }
    expect(autoSwaps('A', opts(3), { levels: {}, unavailable: ['sac'] }, sac).used).toEqual([])
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

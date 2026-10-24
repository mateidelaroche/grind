import type { RunLog, RunStep } from '../types'

// Programme course : 10 semaines, 2 sorties (mercredi + dimanche), objectif 5 km sans s'arrêter.
// La progression avance sortie par sortie (pas à la date) : une sortie ratée ne fait rien perdre.

export const RUN_WEEKS = 10
export const RUN_DAYS = [2, 6] // mercredi, dimanche
export const RUN_GOAL = 5000

const min = (m: number) => Math.round(m * 60)

/** Fractions course / marche répétées, sans la marche finale (le retour au calme la remplace). */
function intervals(run: number, walk: number, reps: number): RunStep[] {
  const out: RunStep[] = []
  for (let i = 0; i < reps; i++) {
    out.push({ kind: 'run', dur: min(run) })
    if (i < reps - 1) out.push({ kind: 'walk', dur: min(walk) })
  }
  return out
}
const blocks = (...parts: number[]): RunStep[] =>
  parts.map((p, i) => ({ kind: i % 2 ? 'walk' : 'run', dur: min(p) }) as RunStep)

export interface RunSession {
  week: number
  n: 1 | 2
  /** Résumé court, ex. « 2' course / 2' marche × 6 ». */
  title: string
  main: RunStep[]
  warm: number
  cool: number
  tip?: string
}

const W: { title: string; main: RunStep[]; cool?: number; tip?: string; n2?: { title: string; main: RunStep[]; tip?: string } }[] = [
  { title: '1′ course / 2′ marche × 8', main: intervals(1, 2, 8), tip: 'Cours tellement lentement que tu pourrais discuter. C’est normal de trouver ça trop facile.' },
  { title: '2′ course / 2′ marche × 6', main: intervals(2, 2, 6) },
  { title: '3′ course / 1′30 marche × 5', main: intervals(3, 1.5, 5) },
  { title: '4′ course / 1′30 marche × 4', main: intervals(4, 1.5, 4) },
  { title: '6′ course / 1′30 marche × 3', main: intervals(6, 1.5, 3), tip: 'Petites foulées, pied qui se pose sous toi : c’est ce qui protège tes genoux.' },
  { title: '10′ course · 1′30 marche · 10′ course', main: blocks(10, 1.5, 10) },
  { title: '15′ course · 1′ marche · 8′ course', main: blocks(15, 1, 8), cool: 2 },
  { title: '24′ de course sans t’arrêter', main: blocks(24), cool: 2, tip: 'Première course continue ! Pars encore plus lentement que d’habitude.' },
  { title: '28′ de course sans t’arrêter', main: blocks(28), cool: 2 },
  {
    title: '32′ de course sans t’arrêter', main: blocks(32), cool: 2,
    n2: { title: '🏁 Objectif : 5 km', main: [{ kind: 'run', dist: RUN_GOAL }], tip: 'Ton allure de d’habitude, pas plus vite. Besoin de marcher 1 minute ? Fais-le et repars : ça compte quand même.' },
  },
]

export const RUN_PLAN: RunSession[] = W.flatMap((w, i) => {
  const base = { week: i + 1, warm: 5, cool: w.cool ?? 3 }
  return [
    { ...base, n: 1 as const, title: w.title, main: w.main, tip: w.tip },
    { ...base, n: 2 as const, title: w.n2?.title ?? w.title, main: w.n2?.main ?? w.main, tip: w.n2?.tip ?? w.tip },
  ]
})

export const runSteps = (r: RunSession): RunStep[] => [
  { kind: 'warm', dur: min(r.warm) },
  ...r.main,
  { kind: 'cool', dur: min(r.cool) },
]

/** Durée estimée (min), à ~7 min/km pour l'étape 5 km. */
export const runMinutes = (steps: RunStep[]) =>
  Math.round(steps.reduce((a, s) => a + (s.dur ?? (s.dist ? (s.dist / 1000) * 7 * 60 : 0)), 0) / 60)

export const runTime = (r: RunSession) => r.main.filter((s) => s.kind === 'run').reduce((a, s) => a + (s.dur ?? 0), 0) / 60

// ───────────── Cardio en chambre (s'il pleut) ─────────────
const INDOOR_EX = ['march', 'shadow-box', 'step-jack', 'climber']
const ROUNDS = 5
export const INDOOR_STEPS: RunStep[] = [
  { kind: 'warm', dur: 180, ex: 'march' },
  ...Array.from({ length: ROUNDS }, (_, r) =>
    INDOOR_EX.flatMap((ex, i): RunStep[] => {
      const last = r === ROUNDS - 1 && i === INDOOR_EX.length - 1
      return last ? [{ kind: 'work', dur: 40, ex }] : [{ kind: 'work', dur: 40, ex }, { kind: 'rest', dur: 20 }]
    }),
  ).flat(),
  { kind: 'cool', dur: 120, ex: 'march' },
]

export const FREE_STEPS: RunStep[] = [{ kind: 'free' }]

// ───────────── Progression (et règle genoux) ─────────────
export const KNEE_REPEAT = 4 // ≥ 4/10 : on refait la semaine
export const KNEE_BACK = 6 // ≥ 6/10 : on recule d'une semaine

export const kneeOf = (r: RunLog) => Math.max(r.knee ?? 0, r.kneeNext ?? 0)

export interface RunProgress {
  /** Prochaine sortie à faire (RUN_PLAN.length = programme terminé). */
  index: number
  /** Dernier ajustement dû au genou. */
  adjust?: { kind: 'repeat' | 'back'; knee: number; date: string }
}

export function runProgress(runs: RunLog[]): RunProgress {
  let index = 0
  let adjust: RunProgress['adjust']
  for (const r of [...runs].sort((a, b) => a.startedAt - b.startedAt)) {
    if (r.indoor || r.plan < 0 || r.plan !== index || !r.completed) continue
    const knee = kneeOf(r)
    const weekStart = index - (index % 2)
    if (knee >= KNEE_BACK) {
      index = Math.max(0, weekStart - 2)
      adjust = { kind: 'back', knee, date: r.date }
    } else if (knee >= KNEE_REPEAT) {
      index = weekStart
      adjust = { kind: 'repeat', knee, date: r.date }
    } else {
      index++
      adjust = undefined
    }
  }
  return { index, adjust }
}

export const STEP_LABEL: Record<RunStep['kind'], string> = {
  warm: 'Échauffement', run: 'Cours', walk: 'Marche', cool: 'Retour au calme', work: 'Effort', rest: 'Récup', free: 'Sortie libre',
}

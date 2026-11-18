import type { RunLog, RunPace, RunSplit, RunStep } from '../types'

// Programme course : 10 semaines, 2 sorties. Mercredi : allures variées. Dimanche : sortie longue et lente.
// Part de 20-25 min de course continue (habitude du basket) → 5 km en semaine 4 → 8 km en semaine 10.
// La progression avance sortie par sortie (pas à la date) : une sortie ratée ne fait rien perdre.

export const RUN_WEEKS = 10
export const RUN_DAYS = [2, 6] // mercredi, dimanche
export const RUN_GOAL = 5000
export const RUN_FINAL = 8000

const min = (m: number) => Math.round(m * 60)

export const PACES: Record<RunPace, { label: string; short: string; hint: string }> = {
  lent: { label: 'Lent', short: 'lent', hint: 'Tu peux parler en phrases entières' },
  moyen: { label: 'Allure moyenne', short: 'moyen', hint: 'Phrases courtes : souffle marqué mais contrôlé' },
  rapide: { label: 'Rapide', short: 'rapide', hint: 'Quelques mots seulement · environ 85 %, pas un sprint' },
  accel: { label: 'Accélération', short: 'accélération', hint: 'Monte progressivement jusqu’à presque sprint (90 %), relâché, sur du plat' },
  recup: { label: 'Récup', short: 'récup', hint: 'Trottine très doucement ou marche' },
}

const run = (m: number, pace: RunPace): RunStep => ({ kind: 'run', dur: min(m), pace })
const L = (m: number) => run(m, 'lent')
const M = (m: number) => run(m, 'moyen')
const rec = (m: number): RunStep => ({ kind: 'walk', dur: min(m), pace: 'recup' })
/** n × (effort + récup) : la récup suit chaque effort, y compris le dernier. */
const reps = (n: number, effort: RunStep, r: RunStep): RunStep[] => Array.from({ length: n }, () => [effort, r]).flat()
const R = (n: number, m: number, r: number) => reps(n, run(m, 'rapide'), rec(r))
const Mx = (n: number, m: number, r: number) => reps(n, M(m), rec(r))
/** 4 accélérations de 20 s, 1′40 de récup. Retirées si genou > 2/10 ou semaine allégée. */
const ACCEL = reps(4, { kind: 'run', dur: 20, pace: 'accel' }, rec(100 / 60))

export interface RunSession {
  week: number
  n: 1 | 2
  /** Résumé court, ex. « 10′ lent · 5 × 1′ rapide · 5′ lent ». */
  title: string
  main: RunStep[]
  warm: number
  cool: number
  tip?: string
}

type Day = { title: string; main: RunStep[]; tip?: string }
const long = (m: number, tip?: string): Day => ({ title: `${m}′ lent sans t’arrêter`, main: [L(m)], tip: tip ?? 'Lent = tu peux parler. Besoin de marcher 1 minute ? Fais-le et repars : ça compte quand même.' })

const W: [Day, Day][] = [
  [
    { title: '10′ lent · 5 × 1′ rapide · 5′ lent', main: [L(10), ...R(5, 1, 1.5), L(5)], tip: 'Lent = tu peux parler. Rapide = quelques mots seulement, environ 85 %. L’appli annonce l’allure à chaque changement.' },
    long(25),
  ],
  [
    { title: '10′ lent · 3 × 4′ moyen · 4 accélérations', main: [L(10), ...Mx(3, 4, 2), ...ACCEL, L(3)], tip: 'Moyen = phrases courtes. Accélération = tu montes progressivement sur 20 s jusqu’à presque sprint, relâché, sur du plat.' },
    long(28),
  ],
  [
    { title: '10′ lent · 6 × 1′ rapide · 4 accélérations', main: [L(10), ...R(6, 1, 1), ...ACCEL, L(3)] },
    long(32),
  ],
  [
    { title: '10′ lent · 2 × 8′ moyen · 5′ lent', main: [L(10), ...Mx(2, 8, 2), L(5)] },
    { title: '🏁 5 km sans t’arrêter', main: [{ kind: 'run', dist: RUN_GOAL, pace: 'lent' }], tip: 'Pars lent, vraiment. Tu accélères seulement sur le dernier kilomètre si tu te sens bien.' },
  ],
  [
    { title: 'Semaine allégée · 20′ lent', main: [L(20)], tip: 'Semaine allégée : le corps assimile les 4 premières semaines. Reste vraiment lent.' },
    long(25, 'Semaine allégée : sortie courte et facile.'),
  ],
  [
    { title: '10′ lent · 5 × 2′ rapide · 5′ lent', main: [L(10), ...R(5, 2, 1.5), L(5)] },
    long(38),
  ],
  [
    { title: '10′ lent · 3 × 6′ moyen · 4 accélérations', main: [L(10), ...Mx(3, 6, 1.5), ...ACCEL, L(3)] },
    long(42),
  ],
  [
    { title: '10′ lent · 8 × 1′ rapide · 5′ lent', main: [L(10), ...R(8, 1, 1), L(5)] },
    long(46),
  ],
  [
    { title: '10′ lent · 20′ moyen · 4 accélérations', main: [L(10), M(20), rec(2), ...ACCEL, L(3)], tip: '20 minutes à allure moyenne : c’est ton allure « course » sur 5 km.' },
    long(50),
  ],
  [
    { title: '15′ lent · 4 accélérations', main: [L(15), ...ACCEL, L(3)], tip: 'Sortie légère pour arriver frais dimanche.' },
    { title: '🏁 Objectif : 8 km', main: [{ kind: 'run', dist: RUN_FINAL, pace: 'lent' }], tip: 'Ton allure lente, pas plus vite. Besoin de marcher 1 minute ? Fais-le et repars : ça compte quand même.' },
  ],
]

export const RUN_PLAN: RunSession[] = W.flatMap(([a, b], i) => {
  const base = { week: i + 1, warm: 3, cool: 3 }
  return [
    { ...base, n: 1 as const, ...a },
    { ...base, n: 2 as const, ...b },
  ]
})

/** Genou > 2/10 ou semaine allégée : on retire les accélérations (et leur récup). */
export function withoutAccel(steps: RunStep[]): RunStep[] {
  const out: RunStep[] = []
  for (let i = 0; i < steps.length; i++) {
    if (steps[i].pace === 'accel') { if (steps[i + 1]?.pace === 'recup') i++; continue }
    out.push(steps[i])
  }
  return out
}

/** Libellé d'une étape : l'allure si elle est donnée. */
export const stepLabel = (s: RunStep) => (s.pace ? PACES[s.pace].label : STEP_LABEL[s.kind])

export const runSteps = (r: RunSession): RunStep[] => [
  { kind: 'warm', dur: min(r.warm) },
  ...r.main,
  { kind: 'cool', dur: min(r.cool) },
]

/** Durée prévue d'une étape (s), à 7 min/km pour les fractions en distance. */
export const stepSec = (s: RunStep) => s.dur ?? (s.dist ? (s.dist / 1000) * 420 : 0)
/** Durée prévue d'une sortie (s). */
export const plannedSec = (steps: RunStep[]) => steps.reduce((x, s) => x + stepSec(s), 0)
/** Durée estimée (min). */
export const runMinutes = (steps: RunStep[]) => Math.round(plannedSec(steps) / 60)

export const runTime = (r: RunSession) => r.main.filter((s) => s.kind === 'run').reduce((a, s) => a + stepSec(s), 0) / 60

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

/** Place d'une sortie dans la progression : un rattrapage compte quand il est saisi, pas à la date courue. */
export const runOrder = (r: RunLog) => r.loggedAt ?? r.startedAt

export function runProgress(runs: RunLog[]): RunProgress {
  let index = 0
  let adjust: RunProgress['adjust']
  for (const r of [...runs].sort((a, b) => runOrder(a) - runOrder(b))) {
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

/** Sortie restée ouverte bien au-delà de sa durée prévue : ne pas la valider toute seule. */
export const staleRun = (steps: RunStep[], t: number) => { const p = plannedSec(steps); return p > 0 && t > p + 1800 }
/**
 * Sortie déclarée terminée après coup : durée prévue, GPS gardé seulement s'il couvre la sortie
 * (au moins 4 km/h sur la durée), et pas de validation si une fraction a été écourtée.
 */
export function staleClose(steps: RunStep[], splits: RunSplit[], dist: number) {
  const dur = Math.round(plannedSec(steps))
  const gps = dist >= (dur / 900) * 1000
  return { dur, gps, dist: gps ? Math.round(dist) : 0, completed: splits.every((s) => (s.kind !== 'run' && s.kind !== 'work') || s.full) }
}

export const STEP_LABEL: Record<RunStep['kind'], string> = {
  warm: 'Échauffement', run: 'Cours', walk: 'Marche', cool: 'Retour au calme', work: 'Effort', rest: 'Récup', free: 'Sortie libre',
}

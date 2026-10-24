// Muscles travaillés par exercice : principaux (rouge), secondaires (orange) et stabilisateurs (jaune).
// Sert au mannequin 3D écorché, à la carte des muscles 2D et au bilan de la semaine.
import { SESSIONS } from './sessions'
import type { SessionId } from '../types'

export type Muscle =
  | 'trapHaut' | 'milieuDos' | 'grandDorsal' | 'lombaires'
  | 'pecHaut' | 'pecBas' | 'dentele'
  | 'deltAvant' | 'deltLat' | 'deltArr'
  | 'biceps' | 'brachial' | 'triceps' | 'avantbras'
  | 'abdos' | 'obliques'
  | 'fessiers' | 'moyenFessier' | 'flechisseurs' | 'adducteurs'
  | 'quadriceps' | 'vasteInterne' | 'ischios' | 'mollets' | 'tibias'

export const MUSCLE_LABEL: Record<Muscle, string> = {
  trapHaut: 'Trapèze (haut)', milieuDos: 'Milieu du dos', grandDorsal: 'Grand dorsal', lombaires: 'Lombaires',
  pecHaut: 'Haut des pecs', pecBas: 'Pecs (milieu/bas)', dentele: 'Dentelé',
  deltAvant: 'Épaule avant', deltLat: 'Épaule latérale', deltArr: 'Épaule arrière',
  biceps: 'Biceps', brachial: 'Brachial', triceps: 'Triceps', avantbras: 'Avant-bras',
  abdos: 'Grand droit (abdos)', obliques: 'Obliques',
  fessiers: 'Grand fessier', moyenFessier: 'Moyen fessier', flechisseurs: 'Fléchisseurs de hanche', adducteurs: 'Adducteurs',
  quadriceps: 'Quadriceps', vasteInterne: 'Vaste interne', ischios: 'Ischios', mollets: 'Mollets', tibias: 'Tibias',
}

export const ALL_MUSCLES = Object.keys(MUSCLE_LABEL) as Muscle[]

/** p : principaux · s : secondaires · st : stabilisateurs (travail statique). */
export interface Work { p: Muscle[]; s: Muscle[]; st: Muscle[] }

const w = (p: Muscle[], s: Muscle[] = [], st: Muscle[] = []): Work => ({ p, s, st })
const PECS: Muscle[] = ['pecHaut', 'pecBas']
const GAINAGE: Muscle[] = ['abdos', 'obliques', 'lombaires']

export const EX_MUSCLES: Record<string, Work> = {
  pushup: w(['pecBas'], ['pecHaut', 'triceps', 'deltAvant'], ['abdos', 'obliques', 'dentele']),
  'pushup-decline': w(['pecHaut', 'deltAvant'], ['pecBas', 'triceps'], ['abdos', 'dentele']),
  'pushup-diamond': w(['triceps'], ['pecBas', 'deltAvant'], ['abdos']),
  pike: w(['deltAvant'], ['deltLat', 'triceps', 'trapHaut'], ['abdos', 'dentele']),
  'dips-bed': w(['triceps'], ['pecBas', 'deltAvant']),
  'fly-band': w(PECS, ['deltAvant'], ['biceps']),
  'lat-raise': w(['deltLat'], ['trapHaut', 'deltAvant']),
  'triceps-oh': w(['triceps'], [], ['abdos']),
  'row-seated': w(['milieuDos', 'grandDorsal'], ['deltArr', 'biceps', 'brachial'], ['lombaires', 'avantbras']),
  'row-backpack': w(['grandDorsal'], ['milieuDos', 'deltArr', 'biceps'], ['avantbras', 'obliques', 'lombaires']),
  'pulldown-kneel': w(['grandDorsal'], ['biceps', 'milieuDos', 'brachial'], ['abdos']),
  pullover: w(['grandDorsal'], ['triceps', 'pecBas', 'dentele'], ['abdos']),
  'face-pull': w(['deltArr', 'milieuDos'], ['trapHaut']),
  'pull-apart': w(['deltArr', 'milieuDos'], ['trapHaut']),
  'pull-apart-warm': w([], ['deltArr', 'milieuDos']),
  curl: w(['biceps'], ['brachial', 'avantbras']),
  hammer: w(['brachial', 'avantbras'], ['biceps']),
  lunge: w(['quadriceps', 'fessiers'], ['vasteInterne', 'adducteurs', 'ischios'], ['moyenFessier', 'mollets', 'abdos']),
  'box-squat': w(['quadriceps', 'fessiers'], ['vasteInterne', 'adducteurs'], ['lombaires', 'abdos']),
  calf: w(['mollets'], [], ['tibias']),
  'hip-thrust': w(['fessiers'], ['ischios', 'moyenFessier'], ['lombaires', 'abdos']),
  'leg-curl': w(['ischios'], ['mollets']),
  rdl: w(['ischios', 'fessiers'], ['lombaires', 'adducteurs'], ['avantbras', 'milieuDos', 'abdos']),
  'crunch-band': w(['abdos'], ['obliques']),
  plank: w(['abdos'], ['obliques'], ['deltAvant', 'dentele', 'fessiers', 'lombaires']),
  'leg-raise': w(['abdos', 'flechisseurs'], ['obliques']),
  'side-plank': w(['obliques'], ['moyenFessier', 'abdos'], ['deltLat', 'lombaires']),
  'dead-bug': w(['abdos'], ['obliques'], ['lombaires', 'flechisseurs']),
  hollow: w(['abdos'], ['obliques', 'flechisseurs']),
  march: w([], ['flechisseurs', 'quadriceps'], ['abdos']),
  'arm-circles': w([], ['deltAvant', 'deltLat', 'deltArr']),
  'cat-cow': w([], GAINAGE),
  'scap-pushup': w([], ['dentele', 'milieuDos'], ['abdos']),
  inchworm: w([], ['ischios', 'abdos', 'deltAvant'], ['triceps']),
  'glute-bridge': w(['fessiers'], ['ischios'], ['abdos']),
  clamshell: w(['moyenFessier'], ['fessiers']),
  tke: w(['vasteInterne'], ['quadriceps']),
  'tib-raise': w(['tibias']),
  'wall-sit': w(['quadriceps', 'vasteInterne'], ['fessiers'], ['abdos']),
  'bw-squat': w([], ['quadriceps', 'fessiers'], ['abdos']),
  'shadow-box': w(['deltAvant'], ['triceps', 'obliques', 'dentele'], ['mollets', 'abdos']),
  'step-jack': w(['deltLat'], ['moyenFessier', 'adducteurs', 'mollets'], ['abdos']),
  climber: w(['abdos', 'flechisseurs'], ['quadriceps', 'obliques'], ['deltAvant', 'dentele']),
  'st-pecs': w(PECS, ['deltAvant']),
  'st-child': w(['grandDorsal'], ['lombaires']),
  'st-quad': w(['quadriceps'], ['flechisseurs']),
  'st-hams': w(['ischios'], ['mollets']),
  'st-hip': w(['flechisseurs'], ['quadriceps']),
}

const NONE: Work = { p: [], s: [], st: [] }
// Référence stable : le rendu 3D se reconstruit quand elle change.
export const workOf = (ex: string): Work => EX_MUSCLES[ex] ?? NONE

/** Muscles d'une liste d'exercices : on garde le rôle le plus fort trouvé pour chaque muscle. */
export function workOfMany(exs: string[]): Work {
  const p = new Set<Muscle>(), s = new Set<Muscle>(), st = new Set<Muscle>()
  for (const ex of exs) {
    const x = workOf(ex)
    x.p.forEach((m) => p.add(m))
    x.s.forEach((m) => s.add(m))
    x.st.forEach((m) => st.add(m))
  }
  return { p: [...p], s: [...s].filter((m) => !p.has(m)), st: [...st].filter((m) => !p.has(m) && !s.has(m)) }
}

export const workOfSession = (sid: SessionId) => workOfMany(SESSIONS[sid].blocks.flatMap((b) => b.items.map((it) => it.ex)))

/** Séries équivalentes par muscle : 1 en principal, 0,5 en secondaire (les stabilisateurs ne comptent pas). */
export function setsPerMuscle(sets: { ex: string; done: number }[]) {
  const out = {} as Record<Muscle, number>
  for (const m of ALL_MUSCLES) out[m] = 0
  for (const r of sets) {
    const x = workOf(r.ex)
    x.p.forEach((m) => { out[m] += r.done })
    x.s.forEach((m) => { out[m] += r.done * 0.5 })
  }
  return out
}

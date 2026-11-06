// Variantes de chaque exercice, dans l'ordre de préférence (la première est celle validée par Matei).
// Séries et repos restent ceux de la séance ; reps, durée et tempo sont propres à la variante.
// Sans `level` : le niveau actuel de Matei sur cet exercice, ajusté si le matériel manque.
import type { Swap } from '../types'

export type Variant = Omit<Swap, 'fromRound' | 'orig' | 'level'> & { level?: number }

const rowSac: Variant = { ex: 'row-backpack', reps: '8-12 / bras', tempo: '2-1-1' }
const rowBand: Variant = { ex: 'row-seated', reps: '10-15', tempo: '2-0-1' }
const pushup: Variant = { ex: 'pushup', reps: '8-12', tempo: '2-0-1' }
const diamond: Variant = { ex: 'pushup-diamond', reps: '6-10', tempo: '2-0-1' }
const proneT: Variant = { ex: 'prone-t', reps: '12-15', tempo: '2-1-1' }
const legRaise: Variant = { ex: 'leg-raise', reps: '10-15', tempo: '2-0-1' }
const plank: Variant = { ex: 'plank', duration: 30, durationLabel: '30-60 s' }

export const VARIANTS: Record<string, Variant[]> = {
  // Séance A
  pushup: [diamond],
  'row-seated': [rowSac],
  'pushup-decline': [{ ex: 'pike', reps: '6-12', tempo: '2-0-1' }, pushup],
  'pulldown-kneel': [rowSac, rowBand],
  'lat-raise': [{ ex: 'lat-raise-sac', reps: '12-15 / bras', tempo: '2-1-1' }],
  'face-pull': [{ ex: 'pull-apart', reps: '15-20', tempo: '2-1-1' }, proneT],
  curl: [{ ex: 'hammer', level: 3, reps: '10-15', tempo: '3-0-1' }],
  'triceps-oh': [{ ex: 'dips-bed', reps: '8-15', tempo: '2-0-1' }, diamond],
  'crunch-band': [legRaise],
  plank: [{ ex: 'hollow', duration: 20, durationLabel: '20-30 s' }],
  // Séance B
  pike: [{ ex: 'pushup-decline', reps: '8-12', tempo: '2-0-1' }],
  'row-backpack': [rowBand],
  'pushup-diamond': [pushup],
  pullover: [rowBand, rowSac],
  'fly-band': [{ ...pushup, reps: '10-15' }],
  'pull-apart': [proneT],
  hammer: [{ ex: 'hammer', level: 3, reps: '10-15', tempo: '3-0-1' }, { ex: 'curl', reps: '10-15', tempo: '3-0-1' }],
  'dips-bed': [{ ex: 'triceps-oh', reps: '10-15', tempo: '2-0-1' }, diamond],
  'leg-raise': [{ ex: 'dead-bug', reps: '8-10 / côté' }],
  'side-plank': [plank],
  bicycle: [{ ex: 'dead-bug', reps: '8-10 / côté' }],
  // Séance C
  lunge: [{ ex: 'lunge', level: 0, reps: '8-12 / jambe', tempo: '3-0-1' }, { ex: 'bw-squat', reps: '15-20', tempo: '3-1-1' }],
  'box-squat': [{ ex: 'wall-sit', duration: 40, durationLabel: '30-60 s' }, { ex: 'bw-squat', reps: '15-20', tempo: '3-1-1' }],
  calf: [{ ex: 'calf-floor', reps: '20-25', tempo: '2-1-1' }],
  'hip-thrust': [{ ex: 'glute-bridge', reps: '15-20', tempo: '2-1-1' }],
  'leg-curl': [{ ex: 'ham-bridge', reps: '10-12', tempo: '2-1-1' }],
  rdl: [{ ex: 'rdl', level: 3, reps: '10-12 / jambe', tempo: '3-0-1' }],
  'dead-bug': [legRaise],
  hollow: [plank],
  'crunch-sac': [{ ex: 'crunch-sac', level: 0, reps: '20-25', tempo: '2-1-1' }, { ex: 'bicycle', reps: '12-15 / côté', tempo: '1-1-1' }],
  // Échauffement et routine genoux
  march: [{ ex: 'step-jack', duration: 45, durationLabel: '45 s' }],
  'pull-apart-warm': [{ ex: 'prone-t', reps: '10' }],
  'wall-sit': [{ ex: 'bw-squat', reps: '10' }],
  tke: [{ ex: 'slr', reps: '12 / jambe', tempo: '2-1-1' }],
}

/** Exercices à écarter quand il faut faire peu de bruit. */
export const NOISY = new Set(['march'])
/** Exercices à écarter quand la place manque (corps allongé de tout son long, avec un meuble). */
export const ROOMY = new Set(['pushup-decline', 'inchworm'])

// Muscles travaillés par exercice : principaux (rouge) et secondaires (orange).
// Sert au mannequin 3D écorché et à la carte des muscles 2D.
import { SESSIONS } from './sessions'
import type { SessionId } from '../types'

export type Muscle =
  | 'pecs' | 'epaules' | 'biceps' | 'triceps' | 'avantbras'
  | 'dorsaux' | 'trapezes' | 'lombaires' | 'abdos' | 'obliques'
  | 'fessiers' | 'quadriceps' | 'ischios' | 'mollets' | 'tibias'

export const MUSCLE_LABEL: Record<Muscle, string> = {
  pecs: 'Pectoraux', epaules: 'Épaules', biceps: 'Biceps', triceps: 'Triceps', avantbras: 'Avant-bras',
  dorsaux: 'Dorsaux', trapezes: 'Haut du dos', lombaires: 'Lombaires', abdos: 'Abdos', obliques: 'Obliques',
  fessiers: 'Fessiers', quadriceps: 'Quadriceps', ischios: 'Ischios', mollets: 'Mollets', tibias: 'Tibias',
}

export interface Work { p: Muscle[]; s: Muscle[] }

const GAINAGE: Muscle[] = ['abdos', 'obliques', 'lombaires']

export const EX_MUSCLES: Record<string, Work> = {
  pushup: { p: ['pecs'], s: ['triceps', 'epaules', ...GAINAGE] },
  'pushup-decline': { p: ['pecs', 'epaules'], s: ['triceps', 'abdos'] },
  'pushup-diamond': { p: ['triceps'], s: ['pecs', 'epaules'] },
  pike: { p: ['epaules'], s: ['triceps', 'trapezes'] },
  'dips-bed': { p: ['triceps'], s: ['pecs', 'epaules'] },
  'fly-band': { p: ['pecs'], s: ['epaules'] },
  'lat-raise': { p: ['epaules'], s: ['trapezes'] },
  'triceps-oh': { p: ['triceps'], s: [] },
  'row-seated': { p: ['dorsaux', 'trapezes'], s: ['biceps', 'epaules', 'avantbras'] },
  'row-backpack': { p: ['dorsaux'], s: ['trapezes', 'biceps', 'avantbras'] },
  'pulldown-kneel': { p: ['dorsaux'], s: ['biceps', 'trapezes'] },
  pullover: { p: ['dorsaux'], s: ['triceps', 'pecs'] },
  'face-pull': { p: ['epaules', 'trapezes'], s: [] },
  'pull-apart': { p: ['trapezes', 'epaules'], s: [] },
  'pull-apart-warm': { p: [], s: ['trapezes', 'epaules'] },
  curl: { p: ['biceps'], s: ['avantbras'] },
  hammer: { p: ['avantbras', 'biceps'], s: [] },
  lunge: { p: ['quadriceps', 'fessiers'], s: ['ischios', 'mollets'] },
  'box-squat': { p: ['quadriceps', 'fessiers'], s: ['ischios', 'lombaires'] },
  calf: { p: ['mollets'], s: [] },
  'hip-thrust': { p: ['fessiers'], s: ['ischios', 'lombaires'] },
  'leg-curl': { p: ['ischios'], s: ['mollets'] },
  rdl: { p: ['ischios', 'fessiers'], s: ['lombaires', 'avantbras'] },
  'crunch-band': { p: ['abdos'], s: ['obliques'] },
  plank: { p: ['abdos'], s: ['obliques', 'lombaires', 'epaules'] },
  'leg-raise': { p: ['abdos'], s: ['obliques'] },
  'side-plank': { p: ['obliques'], s: ['abdos', 'epaules', 'fessiers'] },
  'dead-bug': { p: ['abdos'], s: ['obliques', 'lombaires'] },
  hollow: { p: ['abdos'], s: ['obliques'] },
  march: { p: [], s: ['quadriceps', 'abdos'] },
  'arm-circles': { p: [], s: ['epaules'] },
  'cat-cow': { p: [], s: ['lombaires', 'abdos'] },
  'scap-pushup': { p: [], s: ['trapezes', 'pecs', 'epaules'] },
  inchworm: { p: [], s: ['ischios', 'abdos', 'epaules'] },
  'glute-bridge': { p: ['fessiers'], s: ['ischios'] },
  clamshell: { p: ['fessiers'], s: [] },
  tke: { p: ['quadriceps'], s: [] },
  'tib-raise': { p: ['tibias'], s: [] },
  'wall-sit': { p: ['quadriceps'], s: ['fessiers'] },
  'bw-squat': { p: [], s: ['quadriceps', 'fessiers'] },
  'shadow-box': { p: ['epaules'], s: ['triceps', 'obliques', 'mollets'] },
  'step-jack': { p: ['epaules'], s: ['fessiers', 'mollets'] },
  climber: { p: ['abdos'], s: ['epaules', 'quadriceps', 'obliques'] },
  'st-pecs': { p: ['pecs'], s: ['epaules'] },
  'st-child': { p: ['dorsaux'], s: ['lombaires'] },
  'st-quad': { p: ['quadriceps'], s: [] },
  'st-hams': { p: ['ischios'], s: ['mollets'] },
  'st-hip': { p: ['quadriceps'], s: ['fessiers'] },
}

const NONE: Work = { p: [], s: [] }
// Référence stable : le rendu 3D se reconstruit quand elle change.
export const workOf = (ex: string): Work => EX_MUSCLES[ex] ?? NONE

/** Muscles d'une liste d'exercices : principal si au moins un exercice le travaille en principal. */
export function workOfMany(exs: string[]): Work {
  const p = new Set<Muscle>(), s = new Set<Muscle>()
  for (const ex of exs) {
    const w = workOf(ex)
    w.p.forEach((m) => p.add(m))
    w.s.forEach((m) => s.add(m))
  }
  return { p: [...p], s: [...s].filter((m) => !p.has(m)) }
}

export const workOfSession = (sid: SessionId) => workOfMany(SESSIONS[sid].blocks.flatMap((b) => b.items.map((it) => it.ex)))

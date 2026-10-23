import type { Session, SessionId } from '../types'

const A: Session = {
  id: 'A',
  name: 'Séance A',
  subtitle: 'Haut du corps · Pecs / Épaules',
  kind: 'muscu',
  warmup: 'general',
  cooldown: true,
  duration: '~40 min',
  blocks: [
    { id: 'A', rest: 90, express: true, restPause: true, items: [
      { ex: 'pushup', sets: 4, reps: '8-12', tempo: '3-1-1', level: 0 },
      { ex: 'row-seated', sets: 4, reps: '10-15', tempo: '2-0-1', level: 1, note: '+ 1 s serré' },
    ] },
    { id: 'B', rest: 75, express: true, restPause: true, items: [
      { ex: 'pushup-decline', sets: 3, reps: '8-12', tempo: '2-0-1', level: 0 },
      { ex: 'pulldown-kneel', sets: 3, reps: '10-15', tempo: '2-0-1', level: 1 },
    ] },
    { id: 'C', rest: 60, items: [
      { ex: 'lat-raise', sets: 3, reps: '12-20', tempo: '2-1-1', level: 0 },
      { ex: 'face-pull', sets: 3, reps: '15-20', tempo: '2-1-1', level: 0 },
    ] },
    { id: 'D', rest: 60, items: [
      { ex: 'curl', sets: 3, reps: '10-15', tempo: '3-0-1', level: 1 },
      { ex: 'triceps-oh', sets: 3, reps: '10-15', tempo: '2-0-1', level: 1 },
    ] },
    { id: 'E', rest: 45, express: true, items: [
      { ex: 'crunch-band', sets: 3, reps: '12-15', tempo: '2-1-1', level: 1 },
      { ex: 'plank', sets: 3, duration: 30, durationLabel: '30-60 s', level: 0 },
    ] },
  ],
}

const B: Session = {
  id: 'B',
  name: 'Séance B',
  subtitle: 'Haut du corps · Dos / Bras',
  kind: 'muscu',
  warmup: 'general',
  cooldown: true,
  duration: '~40 min',
  blocks: [
    { id: 'A', rest: 90, express: true, restPause: true, items: [
      { ex: 'pike', sets: 4, reps: '6-12', tempo: '2-0-1', level: 0 },
      { ex: 'row-backpack', sets: 4, reps: '8-12 / bras', tempo: '2-1-1', level: 1 },
    ] },
    { id: 'B', rest: 75, express: true, restPause: true, items: [
      { ex: 'pushup-diamond', sets: 3, reps: '8-15', tempo: '2-0-1', level: 1 },
      { ex: 'pullover', sets: 3, reps: '12-15', tempo: '2-1-1', level: 1 },
    ] },
    { id: 'C', rest: 60, items: [
      { ex: 'fly-band', sets: 3, reps: '12-15 / bras', tempo: '2-1-1', level: 0 },
      { ex: 'pull-apart', sets: 3, reps: '15-20', tempo: '2-1-1', level: 0 },
    ] },
    { id: 'D', rest: 60, items: [
      { ex: 'hammer', sets: 3, reps: '10-15', tempo: '3-0-1', level: 1 },
      { ex: 'dips-bed', sets: 3, reps: '8-15', tempo: '2-0-1', level: 0 },
    ] },
    { id: 'E', rest: 45, express: true, items: [
      { ex: 'leg-raise', sets: 3, reps: '10-15', tempo: '2-0-1', level: 1 },
      { ex: 'side-plank', sets: 3, duration: 30, durationLabel: '30-45 s / côté', level: 0 },
    ] },
  ],
}

const C: Session = {
  id: 'C',
  name: 'Séance C',
  subtitle: 'Bas du corps + Abdos',
  kind: 'muscu',
  warmup: 'genoux',
  cooldown: true,
  duration: '~40 min',
  blocks: [
    { id: 'A', rest: 60, express: true, restPause: true, items: [
      { ex: 'lunge', sets: 3, reps: '8-12 / jambe', tempo: '3-0-1', level: 0, minLevelFromWeek: { 4: 1 } },
    ] },
    { id: 'B', rest: 60, restPause: true, items: [
      { ex: 'box-squat', sets: 3, reps: '12-15', tempo: '3-1-1', level: 1 },
      { ex: 'calf', sets: 3, reps: '15-20 / jambe', tempo: '2-1-1', level: 0 },
    ] },
    { id: 'C', rest: 75, express: true, items: [
      { ex: 'hip-thrust', sets: 4, reps: '10-15', tempo: '2-1-1', level: 1, note: '2 s serré en haut' },
      { ex: 'leg-curl', sets: 3, reps: '10-15', tempo: '2-1-1', level: 0 },
    ] },
    { id: 'D', rest: 60, items: [
      { ex: 'rdl', sets: 3, reps: '12-15', tempo: '3-0-1', level: 2 },
      { ex: 'dead-bug', sets: 3, reps: '8-10 / côté' },
    ] },
    { id: 'E', rest: 30, express: true, items: [
      { ex: 'hollow', sets: 3, duration: 20, durationLabel: '20-30 s', level: 0 },
    ] },
  ],
}

const GENOUX: Session = {
  id: 'GENOUX',
  name: 'Routine genoux',
  subtitle: 'Avant la séance jambes et avant chaque basket',
  kind: 'routine',
  warmup: 'none',
  cooldown: false,
  duration: '~7 min',
  blocks: [
    { id: 'G1', rest: 0, items: [{ ex: 'glute-bridge', sets: 1, reps: '15' }] },
    { id: 'G2', rest: 0, items: [{ ex: 'clamshell', sets: 1, reps: '15 / côté' }] },
    { id: 'G3', rest: 0, items: [{ ex: 'tke', sets: 1, reps: '15 / jambe', level: 0 }] },
    { id: 'G4', rest: 0, items: [{ ex: 'tib-raise', sets: 1, reps: '15' }] },
    { id: 'G5', rest: 20, items: [{ ex: 'wall-sit', sets: 2, duration: 30, durationLabel: '30-45 s' }] },
    { id: 'G6', rest: 0, items: [{ ex: 'bw-squat', sets: 1, reps: '10' }] },
  ],
}

const WARMUP: Session = {
  id: 'WARMUP',
  name: 'Échauffement',
  subtitle: 'Avant les séances A et B',
  kind: 'routine',
  warmup: 'none',
  cooldown: false,
  duration: '~5 min',
  blocks: [
    { id: 'W1', rest: 0, items: [{ ex: 'march', sets: 1, duration: 45, durationLabel: '45 s' }] },
    { id: 'W2', rest: 0, items: [{ ex: 'arm-circles', sets: 1, reps: '10 + 10' }] },
    { id: 'W3', rest: 0, items: [{ ex: 'cat-cow', sets: 1, reps: '8' }] },
    { id: 'W4', rest: 0, items: [{ ex: 'pull-apart-warm', sets: 1, reps: '15', level: 0 }] },
    { id: 'W5', rest: 0, items: [{ ex: 'scap-pushup', sets: 1, reps: '10' }] },
    { id: 'W6', rest: 0, items: [{ ex: 'inchworm', sets: 1, reps: '5' }] },
  ],
}

const COOLDOWN: Session = {
  id: 'COOLDOWN',
  name: 'Retour au calme',
  subtitle: 'Étirements doux',
  kind: 'routine',
  warmup: 'none',
  cooldown: false,
  duration: '~4 min',
  blocks: [
    { id: 'S1', rest: 0, items: [{ ex: 'st-pecs', sets: 1, duration: 30, durationLabel: '30 s / côté' }] },
    { id: 'S2', rest: 0, items: [{ ex: 'st-child', sets: 1, duration: 30, durationLabel: '30 s' }] },
    { id: 'S3', rest: 0, items: [{ ex: 'st-quad', sets: 1, duration: 30, durationLabel: '30 s / jambe' }] },
    { id: 'S4', rest: 0, items: [{ ex: 'st-hams', sets: 1, duration: 30, durationLabel: '30 s' }] },
    { id: 'S5', rest: 0, items: [{ ex: 'st-hip', sets: 1, duration: 30, durationLabel: '30 s / jambe' }] },
  ],
}

const BONUS: Session = {
  id: 'BONUS',
  name: 'Bonus avant basket',
  subtitle: 'Routine genoux + pump bras léger (RIR 3-4)',
  kind: 'routine',
  warmup: 'genoux',
  cooldown: false,
  duration: '~12 min',
  blocks: [
    { id: 'P', rest: 45, items: [
      { ex: 'curl', sets: 2, reps: '15-20 faciles', level: 0 },
      { ex: 'triceps-oh', sets: 2, reps: '15-20 faciles', level: 0 },
    ] },
  ],
}

export const SESSIONS: Record<SessionId, Session> = { A, B, C, GENOUX, BONUS, WARMUP, COOLDOWN }
export const MAIN_SESSIONS: SessionId[] = ['A', 'B', 'C']

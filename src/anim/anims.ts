import { along, FLOOR, L, solve2, type AnimDef, type BandDef, type Limb, type Pose, type Target, type V } from './rig'

// Repères : sol y=150, cheville au sol y≈148, debout bassin y=74.
const FL = FLOOR - 2
const HANG: Limb = { a: [90, 90] }
const BODY = L.th + L.sh // 74

const stand = (x = 100, o: Partial<Pose> = {}): Pose => ({
  p: [x, FL - BODY], t: -90, aN: HANG, aF: HANG, lN: { ik: [x + 3, FL] }, lF: { ik: [x - 3, FL] }, ...o,
})

/** Corps gainé en ligne droite depuis les chevilles jusqu'aux épaules à la hauteur shoulderY. */
function plankLine(ankle: V, shoulderY: number) {
  const len = BODY + L.torso
  const ang = (Math.asin((shoulderY - ankle[1]) / len) * 180) / Math.PI
  const p = along(ankle, ang, BODY)
  const sh = along(ankle, ang, len)
  return { p, t: ang, sh }
}

function pushupPose(ankle: V, shoulderY: number, handX: number, handY = FL, extra: Partial<Pose> = {}): Pose {
  const { p, t } = plankLine(ankle, shoulderY)
  return {
    p, t, h: t + 8,
    aN: { ik: [handX, handY] }, aF: { ik: [handX - 2, handY] },
    lN: { ik: ankle }, lF: { ik: [ankle[0] - 2, ankle[1]] },
    fN: 105, fF: 105, ...extra,
  }
}

// ───────────── POUSSÉE ─────────────
const pushup: AnimDef = {
  keys: [pushupPose([40, 145], 97, 152), pushupPose([40, 145], 133, 152)],
  dur: [1.8, 0.9], hold: [0.4, 0.5],
}

const pushupDiamond: AnimDef = {
  mod: 'diamond',
  cam: { az: 60, el: 25 },
  keys: [pushupPose([40, 145], 97, 146), pushupPose([40, 145], 133, 146)],
  dur: [1.4, 0.8], hold: [0.4, 0.4],
}

const bedTop = FLOOR - 36
const pushupDecline: AnimDef = {
  scene: [{ k: 'bed', x: -10, w: 66 }],
  keys: [pushupPose([48, bedTop - 3], 96, 158), pushupPose([48, bedTop - 3], 133, 158)].map((k) => ({ ...k, fN: 170, fF: 170 })),
  dur: [1.4, 0.8], hold: [0.4, 0.5],
}

function pikePose(shoulderUp: boolean): Pose {
  const P: V = [97, 84]
  const H: V = [130, FL]
  const S = shoulderUp ? solve2(P, H, L.torso, L.ua + L.fa - 0.5, -1) : along(P, 64, L.torso)
  const t = (Math.atan2(S[1] - P[1], S[0] - P[0]) * 180) / Math.PI
  return { p: P, t, h: t + (shoulderUp ? 15 : 10), aN: { ik: H }, aF: { ik: [H[0] - 2, H[1]] }, lN: { ik: [58, 146] }, lF: { ik: [56, 146] }, fN: 110, fF: 110 }
}
const pike: AnimDef = { mod: 'pike', keys: [pikePose(true), pikePose(false)], dur: [1.3, 0.8], hold: [0.4, 0.4] }

const dipsBed: AnimDef = {
  scene: [{ k: 'bed', x: 10, w: 74 }],
  keys: [
    { p: [96, 110], t: -95, aN: { ik: [84, bedTop + 1] }, aF: { ik: [82, bedTop + 1] }, lN: { ik: [150, FL] }, lF: { ik: [146, FL] } },
    { p: [98, 134], t: -95, aN: { ik: [84, bedTop + 1] }, aF: { ik: [82, bedTop + 1] }, lN: { ik: [150, FL] }, lF: { ik: [146, FL] } },
  ],
  dur: [1.3, 0.8], hold: [0.4, 0.4],
}

const DOOR_ANCHOR_MID: V = [40, 52]
const flyBand: AnimDef = {
  scene: [{ k: 'door', x: 36 }],
  bands: [{ from: DOOR_ANCHOR_MID, to: { j: 'handN' }, z: 34 }],
  mod: 'fly',
  cam: { az: 25, el: 55 },
  keys: [
    stand(100, { aN: { a: [175, 172] }, u: 0 }),
    stand(100, { aN: { a: [5, 0] }, u: 1 }),
  ],
  dur: [1.2, 1.4], hold: [0.3, 0.6],
}

const latRaise: AnimDef = {
  view: 'front',
  bands: [{ from: { j: 'ankleN' }, to: { j: 'handN' } }, { from: { j: 'ankleF' }, to: { j: 'handF' } }],
  keys: [
    stand(100, { aN: { a: [82, 86] }, aF: { a: [98, 94] }, lN: { ik: [104, FL] }, lF: { ik: [96, FL] } }),
    stand(100, { aN: { a: [-2, 10] }, aF: { a: [182, 170] }, lN: { ik: [104, FL] }, lF: { ik: [96, FL] } }),
  ],
  dur: [1.1, 1.4], hold: [0.3, 0.5],
}

const tricepsOh: AnimDef = {
  bands: [{ from: { j: 'ankleF' }, to: { j: 'handN' } }],
  keys: [
    stand(100, { lN: { ik: [118, FL] }, lF: { ik: [74, FL] }, fF: 0, aN: { a: [-100, 125] }, aF: { a: [-102, 123] } }),
    stand(100, { lN: { ik: [118, FL] }, lF: { ik: [74, FL] }, fF: 0, aN: { a: [-98, -95] }, aF: { a: [-100, -97] } }),
  ],
  dur: [1.4, 0.9], hold: [0.4, 0.4],
}

// ───────────── TIRAGE ─────────────
const LOW_ANCHOR: V = [162, 146]
const rowSeated: AnimDef = {
  scene: [{ k: 'bed', x: 160, w: 60 }],
  bands: [{ from: LOW_ANCHOR, to: { j: 'handN' } }],
  keys: [
    { p: [70, 140], t: -88, aN: { a: [20, 18] }, aF: { a: [22, 20] }, lN: { a: [0, 0] }, lF: { a: [1, 1] }, fN: -80, fF: -80 },
    { p: [70, 140], t: -92, c: -3, aN: { a: [118, 5] }, aF: { a: [120, 7] }, lN: { a: [0, 0] }, lF: { a: [1, 1] }, fN: -80, fF: -80 },
  ],
  dur: [1.0, 1.5], hold: [0.3, 0.7],
}

const rowBackpack: AnimDef = {
  // En 3D, le lit est du côté de l'appui : la jambe tendue reste au sol à côté.
  scene: [{ k: 'bed', x: 20, w: 150, z: -48 }],
  sac: { j: 'handN', o: [0, 8] },
  keys: [
    { p: [70, 76], t: -4, h: 10, aF: { ik: [114, bedTop] }, aN: { a: [90, 90] }, lF: { a: [88, 180] }, lN: { ik: [64, FL] }, fF: 180 },
    { p: [70, 76], t: -4, h: 10, aF: { ik: [114, bedTop] }, aN: { a: [-150, 90] }, lF: { a: [88, 180] }, lN: { ik: [64, FL] }, fF: 180 },
  ],
  dur: [1.0, 1.4], hold: [0.3, 0.6],
}

const HIGH_ANCHOR: V = [168, 0]
const kneel = (o: Partial<Pose>): Pose => ({
  p: [100, FLOOR - 3 - L.th], t: -92, aN: HANG, aF: HANG, lN: { a: [90, 180] }, lF: { a: [91, 180] }, fN: 180, fF: 180, ...o,
})
const pulldownKneel: AnimDef = {
  scene: [{ k: 'door', x: 168 }],
  bands: [{ from: HIGH_ANCHOR, to: { j: 'handN' } }],
  keys: [
    kneel({ aN: { a: [-62, -62] }, aF: { a: [-64, -64] } }),
    kneel({ c: -4, aN: { a: [102, -72] }, aF: { a: [104, -70] } }),
  ],
  dur: [1.0, 1.4], hold: [0.3, 0.6],
}

const pullover: AnimDef = {
  scene: [{ k: 'door', x: 178 }],
  bands: [{ from: [178, 6], to: { j: 'handN' } }],
  keys: [
    stand(96, { t: -78, aN: { a: [-35, -35] }, aF: { a: [-37, -37] } }),
    stand(96, { t: -78, aN: { a: [82, 82] }, aF: { a: [84, 84] } }),
  ],
  dur: [1.2, 1.4], hold: [0.3, 0.6],
}

const facePull: AnimDef = {
  scene: [{ k: 'door', x: 178 }],
  bands: [{ from: [178, 16], to: { j: 'handN' } }, { from: [178, 16], to: { j: 'handF' } }],
  mod: 'facePull',
  cam: { az: 55, el: 15 },
  keys: [
    stand(100, { aN: { a: [-4, -4] }, aF: { a: [-6, -6] }, u: 0 }),
    stand(100, { aN: { a: [-172, -62] }, aF: { a: [-174, -64] }, u: 1 }),
  ],
  dur: [1.0, 1.4], hold: [0.3, 0.6],
}

const pullApart: AnimDef = {
  view: 'front',
  bands: [{ from: { j: 'handF' }, to: { j: 'handN' } }],
  keys: [
    stand(100, { aN: { a: [5, 5], s: 0.22 }, aF: { a: [175, 175], s: 0.22 } }),
    stand(100, { aN: { a: [2, 2] }, aF: { a: [178, 178] } }),
  ],
  dur: [1.0, 1.3], hold: [0.3, 0.6],
}

const curl: AnimDef = {
  bands: [{ from: { j: 'ankleN', o: [3, 0] }, to: { j: 'handN' } }],
  keys: [
    stand(100, { aN: { a: [93, 88] }, aF: { a: [95, 90] } }),
    stand(100, { aN: { a: [97, -42] }, aF: { a: [99, -40] } }),
  ],
  dur: [1.0, 1.8], hold: [0.3, 0.4],
}

// ───────────── JAMBES ─────────────
const lunge: AnimDef = {
  keys: [
    stand(92, { lN: { ik: [112, FL] }, lF: { ik: [96, FL] } }),
    stand(90, { p: [88, 110], t: -84, lN: { ik: [114, FL] }, lF: { ik: [50, 146] }, fF: 115 }),
  ],
  dur: [1.8, 0.9], hold: [0.4, 0.3],
}

const lungeBulgare: AnimDef = {
  scene: [{ k: 'bed', x: -14, w: 62 }],
  keys: [
    { ...stand(96), p: [96, 77], t: -86, lN: { ik: [114, FL] }, lF: { ik: [44, bedTop - 3] }, fF: 175 },
    { ...stand(96), p: [94, 110], t: -80, lN: { ik: [116, FL] }, lF: { ik: [44, bedTop - 3] }, fF: 175 },
  ],
  dur: [1.8, 0.9], hold: [0.4, 0.3],
}

const boxSquat: AnimDef = {
  scene: [{ k: 'bed', x: 10, w: 56 }],
  sac: { j: 'chest', o: [10, 2] },
  keys: [
    stand(98, { aN: { ik: { j: 'chest', o: [16, 4] } }, aF: { ik: { j: 'chest', o: [16, 6] } } }),
    stand(98, { p: [70, 108], t: -58, aN: { ik: { j: 'chest', o: [14, 6] } }, aF: { ik: { j: 'chest', o: [14, 8] } }, lN: { ik: [101, FL] }, lF: { ik: [97, FL] } }),
  ],
  dur: [1.8, 0.9], hold: [0.3, 0.6],
}

const calf: AnimDef = {
  scene: [{ k: 'books', x: 100, w: 22, h: 9 }, { k: 'wall', x: 150 }],
  keys: [
    stand(100, { p: [100, 71], lN: { ik: [97, 145] }, fN: -20, lF: { a: [100, 160] }, aN: { ik: [148, 46] } }),
    stand(100, { p: [101, 57], lN: { ik: [102, 131] }, fN: 59, lF: { a: [100, 160] }, aN: { ik: [148, 40] } }),
  ],
  dur: [1.0, 1.2], hold: [0.4, 0.8],
}

const hipThrust: AnimDef = {
  scene: [{ k: 'bed', x: -10, w: 66 }],
  sac: { j: 'hip', o: [0, -9] },
  keys: [
    { p: [95, 140], t: -141, h: -150, aN: { ik: { j: 'hip', o: [0, -6] } }, aF: { ik: { j: 'hip', o: [2, -6] } }, lN: { ik: [134, FL] }, lF: { ik: [131, FL] } },
    { p: [104, 104], t: 174, h: 165, aN: { ik: { j: 'hip', o: [0, -6] } }, aF: { ik: { j: 'hip', o: [2, -6] } }, lN: { ik: [134, FL] }, lF: { ik: [131, FL] } },
  ],
  dur: [0.9, 1.2], hold: [0.3, 1.2],
}

const legCurl: AnimDef = {
  scene: [{ k: 'bed', x: -40, w: 50 }],
  bands: [{ from: [8, 146], to: { j: 'ankleN' } }],
  keys: [
    { p: [112, 145], t: 0, h: -12, aN: { a: [140, 0] }, aF: { a: [142, 2] }, lN: { a: [180, 180] }, lF: { a: [181, 181] }, fN: 95, fF: 95 },
    { p: [112, 145], t: 0, h: -12, aN: { a: [140, 0] }, aF: { a: [142, 2] }, lN: { a: [180, -75] }, lF: { a: [181, 181] }, fN: -165, fF: 95 },
  ],
  dur: [1.0, 1.4], hold: [0.3, 0.6],
}

const rdl: AnimDef = {
  bands: [{ from: { j: 'ankleN', o: [3, 0] }, to: { j: 'handN' } }],
  keys: [
    stand(100, { aN: { a: [92, 92] }, aF: { a: [94, 94] } }),
    stand(100, { p: [86, 80], t: -14, h: 0, aN: { a: [90, 90] }, aF: { a: [91, 91] } }),
  ],
  dur: [1.8, 1.0], hold: [0.3, 0.4],
}

// ───────────── ABDOS ─────────────
const crunchBand: AnimDef = {
  scene: [{ k: 'door', x: 168 }],
  bands: [{ from: HIGH_ANCHOR, to: { j: 'handN' } }],
  keys: [
    kneel({ aN: { ik: { j: 'head', o: [4, 4] } }, aF: { ik: { j: 'head', o: [5, 5] } } }),
    kneel({ t: 30, c: 9, h: 70, aN: { ik: { j: 'head', o: [2, -6] } }, aF: { ik: { j: 'head', o: [3, -5] } } }),
  ],
  dur: [1.0, 1.3], hold: [0.3, 0.6],
}

function plankPose(lift: number): Pose {
  const ankle: V = [40, 145]
  const { p, t } = plankLine(ankle, 121 - lift)
  return { p: [p[0], p[1] - lift], t, h: t + 6, aN: { a: [90, 0] }, aF: { a: [91, 1] }, lN: { ik: ankle }, lF: { ik: [38, 145] }, fN: 105, fF: 105 }
}
const plank: AnimDef = { keys: [plankPose(0), plankPose(1.5)], dur: [1.8, 1.8], hold: [0.2, 0.2] }

const backLying = (o: Partial<Pose>): Pose => ({ p: [112, 145], t: 180, h: 182, aN: { a: [0, 0] }, aF: { a: [1, 1] }, lN: { a: [0, 0] }, lF: { a: [1, 1] }, ...o })
const legRaise: AnimDef = {
  keys: [
    backLying({ aN: { ik: [108, 147] }, aF: { ik: [110, 147] }, lN: { a: [-8, -8] }, lF: { a: [-9, -9] }, fN: -70, fF: -70 }),
    backLying({ p: [112, 143], aN: { ik: [108, 147] }, aF: { ik: [110, 147] }, lN: { a: [-92, -92] }, lF: { a: [-93, -93] }, fN: 0, fF: 0 }),
  ],
  dur: [1.1, 1.6], hold: [0.3, 0.3],
}

function sidePlankPose(lift: number): Pose {
  const ankle: V = [40, 146]
  const { p, t } = plankLine(ankle, 121)
  return { p: [p[0], p[1] - lift], t, h: t, aN: { a: [92, 0] }, aF: { ik: { j: 'hip', o: [0, -4] } }, lN: { ik: ankle }, lF: { ik: [40, 140] }, fN: 0, fF: 0 }
}
const sidePlank: AnimDef = { view: 'front', keys: [sidePlankPose(0), sidePlankPose(4)], dur: [1.6, 1.6], hold: [0.3, 0.3] }

const bugStart = backLying({ aN: { a: [-90, -90] }, aF: { a: [-92, -92] }, lN: { a: [-90, 0] }, lF: { a: [-88, 2] }, fN: -60, fF: -60 })
const deadBug: AnimDef = {
  keys: [
    bugStart,
    { ...bugStart, aN: { a: [-178, -178] }, lF: { a: [-8, -8] } },
    bugStart,
    { ...bugStart, aF: { a: [-176, -176] }, lN: { a: [-6, -6] } },
  ],
  dur: [1.3, 1.0, 1.3, 1.0], hold: [0.3, 0.6, 0.3, 0.6],
}

const hollowPose = (k: number): Pose =>
  backLying({ p: [112, 145], t: -172 + k, c: 6, h: -160, aN: { a: [-168, -168] }, aF: { a: [-170, -170] }, lN: { a: [-12 + k, -12 + k] }, lF: { a: [-13 + k, -13 + k] }, fN: -30 })
const hollow: AnimDef = { keys: [hollowPose(0), hollowPose(2)], dur: [1.6, 1.6], hold: [0.2, 0.2] }

// ───────────── ÉCHAUFFEMENT ─────────────
const march: AnimDef = {
  keys: [
    stand(100, { lN: { a: [-5, 90] }, lF: { a: [90, 90] }, aN: { a: [110, 120] }, aF: { a: [60, 20] }, fN: 10 }),
    stand(100, { lN: { a: [90, 90] }, lF: { a: [90, 90] } }),
    stand(100, { lF: { a: [-5, 90] }, lN: { a: [90, 90] }, aF: { a: [110, 120] }, aN: { a: [60, 20] }, fF: 10 }),
    stand(100, { lN: { a: [90, 90] }, lF: { a: [90, 90] } }),
  ],
  dur: [0.3, 0.3, 0.3, 0.3], hold: [0.05, 0, 0.05, 0],
}

const armCircles: AnimDef = {
  keys: [0, 1, 2, 3].map((i) => stand(100, { aN: { a: [90 - i * 90, 90 - i * 90] }, aF: { a: [-90 - i * 90, -90 - i * 90] } })),
  dur: [0.35, 0.35, 0.35, 0.35], hold: [0, 0, 0, 0],
}

const fours = (o: Partial<Pose>): Pose => ({
  p: [88, FLOOR - 3 - L.th], t: -10, aN: { ik: [134, FL] }, aF: { ik: [132, FL] }, lN: { a: [90, 180] }, lF: { a: [91, 180] }, fN: 180, fF: 180, ...o,
})
const catCow: AnimDef = {
  keys: [fours({ c: 13, h: 70, t: -8 }), fours({ c: -10, h: -40, t: -12 })],
  dur: [1.5, 1.5], hold: [0.5, 0.5],
}

const scapPushup: AnimDef = {
  keys: [pushupPose([40, 145], 97, 150, FL, { c: -3 }), pushupPose([40, 145], 101, 150, FL, { c: 6 })],
  dur: [0.8, 0.8], hold: [0.3, 0.3],
}

const fold: Pose = { p: [38, 76], t: 98, h: 100, aN: { ik: [60, FL] }, aF: { ik: [58, FL] }, lN: { ik: [40, FL] }, lF: { ik: [38, FL] } }
const inchworm: AnimDef = {
  keys: [
    stand(40, { lN: { ik: [40, FL] }, lF: { ik: [38, FL] }, aN: { ik: [44, 120] }, aF: { ik: [42, 120] } }),
    fold,
    { ...pushupPose([40, 145], 97, 152), lN: { ik: [40, 145] }, lF: { ik: [38, 145] } },
    fold,
  ],
  dur: [1.0, 1.6, 1.6, 1.0], hold: [0.3, 0.2, 0.4, 0.2],
}

const glutePose = (up: boolean): Pose =>
  backLying({ p: up ? [100, 121] : [104, 145], t: up ? 150 : 180, h: up ? 172 : 182, aN: { a: [2, 0] }, aF: { a: [3, 1] }, lN: { ik: [136, FL] }, lF: { ik: [133, FL] } })
const gluteBridge: AnimDef = { keys: [glutePose(false), glutePose(true)], dur: [0.9, 1.2], hold: [0.3, 0.8] }

const clamshellPose = (open: boolean): Pose => ({
  p: [112, 136], t: 180, h: 190,
  aN: { a: [60, 0] }, aF: { a: [180, -95] },
  lN: open ? { a: [-34, 28], s: 0.75 } : { a: [12, -8], s: 0.75 },
  lF: { a: [12, -8], s: 0.75 },
  fN: 0, fF: 0,
})
const clamshell: AnimDef = { view: 'front', keys: [clamshellPose(false), clamshellPose(true)], dur: [0.9, 1.1], hold: [0.3, 0.6] }

const tke: AnimDef = {
  scene: [{ k: 'bed', x: 160, w: 60 }],
  bands: [{ from: LOW_ANCHOR, to: { j: 'kneeN', o: [-3, 0] } }],
  keys: [
    stand(98, { p: [96, 78], lN: { ik: [102, FL] }, lF: { ik: [88, FL] } }),
    stand(98, { p: [99, 74], lN: { ik: [102, FL] }, lF: { ik: [88, FL] } }),
  ],
  dur: [0.8, 1.0], hold: [0.3, 1.2],
}

const tibRaise: AnimDef = {
  scene: [{ k: 'wall', x: 58 }],
  keys: [
    { ...stand(90), p: [78, 76], t: -98, lN: { ik: [98, FL] }, lF: { ik: [96, FL] }, fN: 0, fF: 0 },
    { ...stand(90), p: [78, 76], t: -98, lN: { ik: [98, FL] }, lF: { ik: [96, FL] }, fN: -35, fF: -35 },
  ],
  dur: [0.6, 0.8], hold: [0.2, 0.4],
}

const wallSitPose = (k: number): Pose => ({
  p: [72, 112 + k], t: -90, aN: { a: [80, 10] }, aF: { a: [82, 12] }, lN: { ik: [112, FL] }, lF: { ik: [109, FL] },
})
const wallSit: AnimDef = { scene: [{ k: 'wall', x: 62 }], keys: [wallSitPose(0), wallSitPose(1)], dur: [1.8, 1.8], hold: [0.2, 0.2] }

const bwSquat: AnimDef = {
  keys: [
    stand(98, { aN: { a: [92, 92] }, aF: { a: [94, 94] } }),
    stand(98, { p: [74, 112], t: -56, aN: { a: [2, 2] }, aF: { a: [4, 4] }, lN: { ik: [101, FL] }, lF: { ik: [97, FL] } }),
  ],
  dur: [1.8, 1.0], hold: [0.3, 0.3],
}

// ───────────── ÉTIREMENTS ─────────────
const breathe = (a: Pose, b: Partial<Pose>): AnimDef => ({ keys: [a, { ...a, ...b }], dur: [2, 2], hold: [0.5, 0.5] })

const stPecs: AnimDef = {
  scene: [{ k: 'wall', x: 70 }],
  ...breathe(stand(100, { aN: { a: [180, -88] } }), { p: [103, 74], t: -86 }),
}
const stChild = breathe(
  { p: [78, 132], t: 12, h: 18, aN: { a: [4, 2] }, aF: { a: [5, 3] }, lN: { a: [20, 180] }, lF: { a: [21, 181] }, fN: 180, fF: 180 },
  { p: [76, 131], t: 14 },
)
const stQuad: AnimDef = {
  scene: [{ k: 'wall', x: 150 }],
  ...breathe(
    stand(100, { lN: { a: [96, -96] }, lF: { ik: [100, FL] }, aN: { ik: { j: 'ankleN', o: [0, 4] } }, aF: { ik: [148, 48] }, fN: -100 }),
    { p: [100, 75], lN: { a: [100, -92] } },
  ),
}
const stHams = breathe(
  { p: [70, 141], t: -42, h: -30, aN: { a: [22, 22] }, aF: { a: [24, 24] }, lN: { a: [0, 0] }, lF: { a: [1, 1] }, fN: -80, fF: -80 },
  { t: -30, c: 3, aN: { a: [18, 18] } },
)
const stHip = breathe(
  { p: [86, 112], t: -88, aN: { ik: { j: 'kneeN', o: [0, -4] } }, aF: { ik: { j: 'kneeN', o: [2, -4] } }, lN: { ik: [124, FL] }, lF: { a: [96, 180] }, fF: 180 },
  { p: [94, 115], t: -84 },
)

// Silhouettes guides pour les photos de progression
const guideFace: AnimDef = {
  view: 'front', noFloor: true, dur: [1],
  keys: [stand(100, { aN: { a: [75, 85] }, aF: { a: [105, 95] }, lN: { ik: [107, FL] }, lF: { ik: [93, FL] } })],
}
const guideProfil: AnimDef = { noFloor: true, dur: [1], keys: [stand(100)] }


// ───────────── CARDIO EN CHAMBRE (sans sauts) ─────────────
const guard = (o: Partial<Pose> = {}): Pose =>
  stand(100, { t: -86, lN: { ik: [114, FL] }, lF: { ik: [86, FL] }, aN: { a: [62, -72] }, aF: { a: [58, -76] }, fN: 0, fF: 0, ...o })
const shadowBox: AnimDef = {
  cam: { az: 35, el: 12 },
  keys: [guard(), guard({ t: -84, aN: { a: [-4, -4] } }), guard(), guard({ t: -88, aF: { a: [-6, -6] } })],
  dur: [0.22, 0.28, 0.22, 0.28], hold: [0.08, 0, 0.08, 0],
}

const jack = (side: 0 | 1 | -1): Pose =>
  stand(100, {
    aN: side ? { a: [-62, -78] } : { a: [84, 88] },
    aF: side ? { a: [-118, -102] } : { a: [96, 92] },
    lN: { ik: [side === 1 ? 126 : 104, FL] },
    lF: { ik: [side === -1 ? 74 : 96, FL] },
  })
const stepJack: AnimDef = {
  view: 'front',
  keys: [jack(0), jack(1), jack(0), jack(-1)],
  dur: [0.4, 0.4, 0.4, 0.4], hold: [0.05, 0.1, 0.05, 0.1],
}

const climberPose = (near: boolean): Pose => {
  const base = pushupPose([40, 145], 97, 152)
  const knee: Limb = { a: [15, 150] }
  return near ? { ...base, lN: knee, fN: 120 } : { ...base, lF: knee, fF: 120 }
}
const climber: AnimDef = { keys: [climberPose(true), climberPose(false)], dur: [0.6, 0.6], hold: [0.15, 0.15] }

export const ANIMS: Record<string, AnimDef> = {
  'guide-face': guideFace, 'guide-profil': guideProfil,
  pushup, 'pushup-decline': pushupDecline, 'pushup-diamond': pushupDiamond, pike, 'dips-bed': dipsBed,
  'fly-band': flyBand, 'lat-raise': latRaise, 'triceps-oh': tricepsOh,
  'row-seated': rowSeated, 'row-backpack': rowBackpack, 'pulldown-kneel': pulldownKneel, pullover,
  'face-pull': facePull, 'pull-apart': pullApart, curl, hammer: curl,
  lunge, 'lunge-bulgare': lungeBulgare, 'box-squat': boxSquat, calf, 'hip-thrust': hipThrust,
  'leg-curl': legCurl, rdl,
  'crunch-band': crunchBand, plank, 'leg-raise': legRaise, 'side-plank': sidePlank, 'dead-bug': deadBug, hollow,
  march, 'arm-circles': armCircles, 'cat-cow': catCow, 'scap-pushup': scapPushup, inchworm,
  'glute-bridge': gluteBridge, clamshell, tke, 'tib-raise': tibRaise, 'wall-sit': wallSit, 'bw-squat': bwSquat,
  'shadow-box': shadowBox, 'step-jack': stepJack, climber,
  'st-pecs': stPecs, 'st-child': stChild, 'st-quad': stQuad, 'st-hams': stHams, 'st-hip': stHip,
}

// ───────────── Matériel selon le niveau ─────────────
/** Élastique ou sac ajouté par un niveau quand l'animation de base ne le montre pas (repères : personnage tourné vers la droite). */
const LEVEL_GEAR: Record<string, { sac?: Target; bands?: BandDef[] }> = {
  // Élastique en travers du haut du dos, tenu sous chaque main ; sac porté sur le dos
  pushup: {
    sac: { j: 'chest', o: [-4, -10] },
    bands: [{ from: { j: 'handN' }, to: { j: 'chest', o: [-5, -12] } }, { from: { j: 'handF' }, to: { j: 'chest', o: [-5, -12] } }],
  },
  'pushup-decline': { sac: { j: 'chest', o: [-4, -10] } },
  'dips-bed': { sac: { j: 'kneeN', o: [-12, -6] } },
  hammer: { sac: { j: 'handN', o: [0, 9] } },
  rdl: { sac: { j: 'handN', o: [0, 9] } },
  lunge: { sac: { j: 'chest', o: [-9, 0] } },
  calf: { sac: { j: 'chest', o: [-9, 0] } },
  plank: { sac: { j: 'pelvis', o: [6, -9] } },
}

/** Animation qui montre exactement le matériel du niveau choisi (élastique, sac… ou rien). */
export function gearAnim(base: string, ex: string, level?: { band?: string; sac?: string }): string {
  const d = ANIMS[base]
  if (!level || !d) return base
  const g = LEVEL_GEAR[ex]
  const bands = level.band ? (d.bands?.length ? d.bands : g?.bands) : undefined
  const sac = level.sac ? d.sac ?? g?.sac : undefined
  if (bands === d.bands && sac === d.sac) return base
  const id = `${base}@${ex}:${bands ? 'b' : ''}${sac ? 's' : ''}`
  ANIMS[id] ??= { ...d, bands, sac }
  return id
}

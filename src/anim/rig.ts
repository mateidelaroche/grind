// Mini-moteur d'animation : un squelette 2D (cinématique directe + IK à 2 os)
// interpolé entre quelques poses clés. Angles en degrés : 0 = vers la droite,
// 90 = vers le bas (repère SVG). Le personnage regarde vers la droite.

export type V = [number, number]

export type JointName =
  | 'pelvis' | 'neck' | 'head' | 'chest' | 'hip'
  | 'shoulderN' | 'shoulderF' | 'hipN' | 'hipF'
  | 'elbowN' | 'elbowF' | 'handN' | 'handF'
  | 'kneeN' | 'kneeF' | 'ankleN' | 'ankleF' | 'toeN' | 'toeF'

export type Target = V | { j: JointName; o?: V }

/** FK : angles absolus [segment 1, segment 2]. IK : cible de l'extrémité. s = raccourci (perspective). */
export type Limb = { a: [number, number]; s?: number } | { ik: Target; bend?: 1 | -1; s?: number }

export interface Pose {
  p: V
  t: number
  /** Courbure du dos (+ = dos rond, − = dos creux). */
  c?: number
  h?: number
  aN: Limb
  aF: Limb
  lN: Limb
  lF: Limb
  fN?: number
  fF?: number
  /** Avancement libre (0 → 1) interpolé, utilisé par les retouches 3D. */
  u?: number
}

export type SceneItem =
  | { k: 'bed'; x: number; w: number; h?: number; z?: number }
  | { k: 'door'; x: number }
  | { k: 'wall'; x: number }
  | { k: 'books'; x: number; w: number; h: number }

/** z : profondeur 3D d'un point d'ancrage fixe. */
export interface BandDef { from: Target; to: Target; z?: number }

export interface AnimDef {
  view?: 'side' | 'front'
  keys: Pose[]
  /** Durée de la transition clé i → i+1 (la dernière revient à la première). */
  dur: number[]
  hold?: number[]
  scene?: SceneItem[]
  bands?: BandDef[]
  sac?: Target
  noFloor?: boolean
  /** Vue 3D par défaut : azimut (0 = profil, 90 = face) et élévation, en degrés. */
  cam?: { az: number; el: number }
  /** Retouche 3D nommée (mouvements hors du plan), voir skeleton3d.ts. */
  mod?: string
}

export const FLOOR = 150
export const L = { torso: 46, neck: 12, head: 8.5, ua: 26, fa: 24, th: 38, sh: 36, foot: 11 }

const rad = (d: number) => (d * Math.PI) / 180
const deg = (r: number) => (r * 180) / Math.PI
export const dir = (a: number): V => [Math.cos(rad(a)), Math.sin(rad(a))]
export const add = (p: V, q: V): V => [p[0] + q[0], p[1] + q[1]]
export const sub = (p: V, q: V): V => [p[0] - q[0], p[1] - q[1]]
export const mul = (p: V, k: number): V => [p[0] * k, p[1] * k]
export const along = (p: V, a: number, len: number): V => add(p, mul(dir(a), len))
const lerp = (a: number, b: number, k: number) => a + (b - a) * k
const lerpV = (a: V, b: V, k: number): V => [lerp(a[0], b[0], k), lerp(a[1], b[1], k)]
/** Interpolation d'angle par le plus court chemin. */
const lerpA = (a: number, b: number, k: number) => {
  let d = ((b - a) % 360 + 540) % 360 - 180
  return a + d * k
}

/** IK à 2 os : renvoie l'articulation intermédiaire. */
export function solve2(root: V, target: V, l1: number, l2: number, bend: 1 | -1): V {
  const v = sub(target, root)
  const d = Math.min(Math.max(Math.hypot(v[0], v[1]), Math.abs(l1 - l2) + 0.01), l1 + l2 - 0.001)
  const th = deg(Math.atan2(v[1], v[0]))
  const alpha = deg(Math.acos((l1 * l1 + d * d - l2 * l2) / (2 * l1 * d)))
  return along(root, th + bend * alpha, l1)
}

export type Skeleton = Record<JointName, V> & { t: number; c: number; view: 'side' | 'front'; fN: number; fF: number }

function resolve(tg: Target, sk: Partial<Skeleton>): V {
  if (Array.isArray(tg)) return tg
  const base = sk[tg.j] as V | undefined
  if (!base) return [0, 0]
  return tg.o ? add(base, tg.o) : base
}

function limb(root: V, lb: Limb, l1: number, l2: number, defBend: 1 | -1, sk: Partial<Skeleton>): [V, V] {
  const s = lb.s ?? 1
  if ('a' in lb) {
    const j = along(root, lb.a[0], l1 * s)
    return [j, along(j, lb.a[1], l2 * s)]
  }
  const tg = resolve(lb.ik, sk)
  const j = solve2(root, tg, l1 * s, l2 * s, lb.bend ?? defBend)
  const v = sub(tg, j)
  return [j, along(j, deg(Math.atan2(v[1], v[0])), l2 * s)]
}

export function skeleton(pose: Pose, view: 'side' | 'front' = 'side'): Skeleton {
  const sk: Partial<Skeleton> = { view, t: pose.t, c: pose.c ?? 0, fN: pose.fN ?? 0, fF: pose.fF ?? 0 }
  const neck = along(pose.p, pose.t, L.torso)
  sk.pelvis = pose.p
  sk.hip = pose.p
  sk.neck = neck
  sk.chest = lerpV(pose.p, neck, 0.72)
  sk.head = along(neck, pose.h ?? pose.t, L.neck)
  if (view === 'front') {
    const perp = dir(pose.t + 90)
    sk.shoulderN = add(neck, mul(perp, 11))
    sk.shoulderF = add(neck, mul(perp, -11))
    sk.hipN = add(pose.p, mul(perp, 6))
    sk.hipF = add(pose.p, mul(perp, -6))
  } else {
    const sh = along(neck, pose.t + 180, 3)
    sk.shoulderN = sh
    sk.shoulderF = sh
    sk.hipN = pose.p
    sk.hipF = pose.p
  }
  // Jambes d'abord : les bras peuvent viser une cheville ou un genou.
  ;[sk.kneeN, sk.ankleN] = limb(sk.hipN!, pose.lN, L.th, L.sh, -1, sk)
  ;[sk.kneeF, sk.ankleF] = limb(sk.hipF!, pose.lF, L.th, L.sh, -1, sk)
  sk.toeN = along(sk.ankleN!, pose.fN ?? 0, L.foot)
  sk.toeF = along(sk.ankleF!, pose.fF ?? 0, L.foot)
  ;[sk.elbowN, sk.handN] = limb(sk.shoulderN!, pose.aN, L.ua, L.fa, 1, sk)
  ;[sk.elbowF, sk.handF] = limb(sk.shoulderF!, pose.aF, L.ua, L.fa, 1, sk)
  return sk as Skeleton
}

function lerpTarget(a: Target, b: Target, k: number): Target {
  if (Array.isArray(a) && Array.isArray(b)) return lerpV(a, b, k)
  if (!Array.isArray(a) && !Array.isArray(b) && a.j === b.j) return { j: a.j, o: lerpV(a.o ?? [0, 0], b.o ?? [0, 0], k) }
  return k < 0.5 ? a : b
}

function lerpLimb(a: Limb, b: Limb, k: number): Limb {
  const s = lerp(a.s ?? 1, b.s ?? 1, k)
  if ('a' in a && 'a' in b) return { a: [lerpA(a.a[0], b.a[0], k), lerpA(a.a[1], b.a[1], k)], s }
  if ('ik' in a && 'ik' in b) return { ik: lerpTarget(a.ik, b.ik, k), bend: a.bend, s }
  return k < 0.5 ? a : b
}

export function lerpPose(a: Pose, b: Pose, k: number): Pose {
  return {
    p: lerpV(a.p, b.p, k),
    t: lerpA(a.t, b.t, k),
    c: lerp(a.c ?? 0, b.c ?? 0, k),
    h: lerpA(a.h ?? a.t, b.h ?? b.t, k),
    aN: lerpLimb(a.aN, b.aN, k),
    aF: lerpLimb(a.aF, b.aF, k),
    lN: lerpLimb(a.lN, b.lN, k),
    lF: lerpLimb(a.lF, b.lF, k),
    fN: lerpA(a.fN ?? 0, b.fN ?? 0, k),
    fF: lerpA(a.fF ?? 0, b.fF ?? 0, k),
    u: lerp(a.u ?? 0, b.u ?? 0, k),
  }
}

const ease = (x: number) => x * x * (3 - 2 * x)

export function cycleLength(anim: AnimDef): number {
  return anim.keys.reduce((s, _, i) => s + (anim.hold?.[i] ?? 0.25) + (anim.dur[i] ?? 1), 0)
}

/** Pose à l'instant `time` (s) dans le cycle. */
export function poseAt(anim: AnimDef, time: number): Pose {
  const n = anim.keys.length
  if (n === 1) return anim.keys[0]
  let t = time % cycleLength(anim)
  for (let i = 0; i < n; i++) {
    const hold = anim.hold?.[i] ?? 0.25
    if (t < hold) return anim.keys[i]
    t -= hold
    const d = anim.dur[i] ?? 1
    if (t < d) return lerpPose(anim.keys[i], anim.keys[(i + 1) % n], ease(t / d))
    t -= d
  }
  return anim.keys[0]
}

export function resolveTarget(tg: Target, sk: Skeleton): V {
  return resolve(tg, sk)
}

/** Cadre fixe englobant toutes les poses + le décor, au ratio 4:3, sol en bas. */
export function viewBox(anim: AnimDef): [number, number, number, number] {
  let x0 = Infinity, x1 = -Infinity, y0 = Infinity
  const eat = (p: V, r = 5) => {
    x0 = Math.min(x0, p[0] - r); x1 = Math.max(x1, p[0] + r); y0 = Math.min(y0, p[1] - r)
  }
  const total = cycleLength(anim)
  for (let i = 0; i < 24; i++) {
    const sk = skeleton(poseAt(anim, (total * i) / 24), anim.view)
    for (const [k, v] of Object.entries(sk)) {
      if (Array.isArray(v)) eat(v as V, k === 'head' ? L.head + 2 : 5)
    }
  }
  for (const s of anim.scene ?? []) {
    if (s.k === 'bed' || s.k === 'books') { eat([s.x, FLOOR - (s.k === 'bed' ? s.h ?? 36 : s.h)], 2); eat([s.x + s.w, FLOOR], 2) }
    else eat([s.x, FLOOR], 4)
  }
  const pad = 10
  x0 -= pad; x1 += pad; y0 -= pad
  const y1 = FLOOR + 8
  let w = x1 - x0, h = y1 - y0
  const ratio = 4 / 3
  if (w / h < ratio) { const nw = h * ratio; x0 -= (nw - w) / 2; w = nw }
  else { const nh = w / ratio; y0 -= nh - h; h = nh }
  return [x0, y0, w, h]
}

// Passage du squelette 2D à la 3D : le plan de l'animation devient le plan sagittal
// (vue de profil) ou frontal (vue de face), les membres gauche/droite sont écartés
// en profondeur, et les segments raccourcis (perspective) retrouvent leur profondeur.
import { FLOOR, L, along, dir, skeleton, type AnimDef, type JointName, type Limb, type Pose, type Skeleton, type V } from './rig'

export type V3 = [number, number, number]

/** Repère 3D : X = devant le personnage, Y = haut, Z = côté proche (droite en vue de profil). */
export type Joints3 = Record<JointName, V3> & { spineMid: V3; face: V3 }

const SHOULDER_W = 15
const HIP_W = 7.5

const sideZ = (name: string) => (name.endsWith('N') ? 1 : name.endsWith('F') ? -1 : 0)
const isArm = (name: string) => /^(shoulder|elbow|hand)/.test(name)

export const add3 = (a: V3, b: V3): V3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]]
export const sub3 = (a: V3, b: V3): V3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]]
export const mul3 = (a: V3, k: number): V3 => [a[0] * k, a[1] * k, a[2] * k]
export const len3 = (a: V3) => Math.hypot(a[0], a[1], a[2])
export const norm3 = (a: V3): V3 => mul3(a, 1 / (len3(a) || 1))

/** Remonte la profondeur d'un segment raccourci : sa longueur réelle est conservée, vers l'avant (+X). */
function liftChain(j: Joints3, root: JointName, mid: JointName, end: JointName, l1: number, l2: number, limb: Limb) {
  if ((limb.s ?? 1) >= 0.98) return
  const a = sub3(j[mid], j[root])
  const pa = len3(a)
  const da = Math.sqrt(Math.max(0, l1 * l1 - pa * pa))
  const b = sub3(j[end], j[mid])
  const pb = len3(b)
  const db = Math.sqrt(Math.max(0, l2 * l2 - pb * pb))
  j[mid] = add3(j[mid], [da, 0, 0])
  j[end] = add3(j[end], [da + db, 0, 0])
}

export function skeleton3d(anim: AnimDef, pose: Pose): Joints3 {
  const view = anim.view ?? 'side'
  const sk: Skeleton = skeleton(pose, view)
  const cx = anim.keys[0].p[0]
  const j = {} as Joints3
  const pts = sk as unknown as Record<string, V>

  for (const [name, v] of Object.entries(pts)) {
    if (!Array.isArray(v)) continue
    const y = FLOOR - v[1]
    if (view === 'front') {
      j[name as JointName] = [0, y, v[0] - cx]
    } else {
      // En vue de profil le 2D superpose les deux côtés : on les écarte en profondeur.
      const w = sideZ(name) * (isArm(name) ? SHOULDER_W : HIP_W)
      j[name as JointName] = [v[0] - cx, y, w]
    }
  }
  liftChain(j, 'shoulderN', 'elbowN', 'handN', L.ua, L.fa, pose.aN)
  liftChain(j, 'shoulderF', 'elbowF', 'handF', L.ua, L.fa, pose.aF)
  liftChain(j, 'hipN', 'kneeN', 'ankleN', L.th, L.sh, pose.lN)
  liftChain(j, 'hipF', 'kneeF', 'ankleF', L.th, L.sh, pose.lF)
  // Les pieds suivent leurs chevilles
  j.toeN = add3(j.ankleN, sub3(to3(view, pts.toeN, cx), to3(view, pts.ankleN, cx)))
  j.toeF = add3(j.ankleF, sub3(to3(view, pts.toeF, cx), to3(view, pts.ankleF, cx)))

  // Colonne courbée (c) : point milieu décalé vers le dos
  const mid2 = along([(pts.pelvis[0] + pts.neck[0]) / 2, (pts.pelvis[1] + pts.neck[1]) / 2], sk.t - 90, sk.c / 2)
  j.spineMid = to3(view, mid2, cx)
  // Direction du visage
  const f = dir((pose.h ?? pose.t) + 90)
  j.face = view === 'front' ? [1, 0, 0] : [f[0], -f[1], 0]

  ANIM_MODS[anim.mod ?? '']?.(j, pose)
  return j
}

function to3(view: 'side' | 'front', v: V, cx: number): V3 {
  return view === 'front' ? [0, FLOOR - v[1], v[0] - cx] : [v[0] - cx, FLOOR - v[1], 0]
}

/** Bras recalculé à partir d'une direction 3D, coude légèrement fléchi vers le bas. */
function setArm(j: Joints3, side: 'N' | 'F', d: V3) {
  const n = norm3(d)
  const elbow = add3(j[`shoulder${side}`], mul3(n, L.ua))
  j[`elbow${side}`] = elbow
  j[`hand${side}`] = add3(elbow, mul3(norm3(add3(n, [0, -0.12, 0])), L.fa))
}

const deg = (a: number) => (a * Math.PI) / 180

/** Retouches 3D pour les mouvements hors du plan (écarté, face pull, pompes diamant…). */
const ANIM_MODS: Record<string, (j: Joints3, pose: Pose) => void> = {
  fly: (j, pose) => {
    // Bras proche : de l'ouverture (sur le côté, légèrement en arrière) jusque devant le sternum
    const u = pose.u ?? 0
    const phi = deg(105 - 120 * u)
    setArm(j, 'N', [Math.cos(phi), -0.08, Math.sin(phi)])
  },
  facePull: (j, pose) => {
    const u = pose.u ?? 0
    for (const side of ['N', 'F'] as const) {
      const sg = side === 'N' ? 1 : -1
      j[`elbow${side}`] = add3(j[`elbow${side}`], [0, 0, sg * 18 * u])
      j[`hand${side}`] = add3(j[`hand${side}`], [0, 0, sg * 10 * u])
    }
  },
  diamond: (j) => {
    for (const side of ['N', 'F'] as const) {
      const sg = side === 'N' ? 1 : -1
      j[`hand${side}`] = [j[`hand${side}`][0], j[`hand${side}`][1], sg * 4]
      j[`elbow${side}`] = [j[`elbow${side}`][0], j[`elbow${side}`][1], sg * 13]
    }
  },
  pike: (j) => {
    for (const side of ['N', 'F'] as const) {
      const sg = side === 'N' ? 1 : -1
      j[`elbow${side}`] = [j[`elbow${side}`][0], j[`elbow${side}`][1], sg * 22]
    }
  },
}

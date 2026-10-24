// Mannequin « écorché » : chaque muscle est un ellipsoïde accroché à un os du squelette 3D,
// placé dans le repère local de l'os (devant / côté), et coloré selon son rôle.
import * as THREE from 'three'
import type { Muscle, Work } from '../data/muscles'
import type { JointName } from './rig'
import { add3, mul3, norm3, sub3, type Joints3, type V3 } from './skeleton3d'

export const MUSCLE_IDLE = '#e9edf3'
export const MUSCLE_PRIMARY = '#ef4444'
export const MUSCLE_SECONDARY = '#fb923c'
export const MUSCLE_STAB = '#fde047'
const BASE = '#566178'

type Bone = 'torso' | 'ua' | 'fa' | 'th' | 'sh'
/** t : position le long de l'os (0 → 1) ; f : décalage vers l'avant ; s : vers l'extérieur ; r : [longueur, avant, côté]. */
interface Spec { m: Muscle | 'base' | 'none'; bone: Bone; t: number; f: number; s: number; r: [number, number, number]; pair?: boolean }

const SPECS: Spec[] = [
  // Tronc (t = 0 au bassin, 1 au cou)
  { m: 'base', bone: 'torso', t: 0.72, f: 0, s: 0, r: [13, 7.2, 10.2] },
  { m: 'base', bone: 'torso', t: 0.02, f: -0.5, s: 0, r: [7, 6.4, 9.6] },
  { m: 'pecHaut', bone: 'torso', t: 0.86, f: 6, s: 5.2, r: [3.6, 2.4, 6], pair: true },
  { m: 'pecBas', bone: 'torso', t: 0.74, f: 6.2, s: 5, r: [5, 2.8, 6.2], pair: true },
  ...[0.2, 0.36, 0.52].map((t): Spec => ({ m: 'abdos', bone: 'torso', t, f: 7.3, s: 2.4, r: [3.6, 1.6, 2.3], pair: true })),
  { m: 'dentele', bone: 'torso', t: 0.64, f: 3.4, s: 8.6, r: [6, 3, 2], pair: true },
  { m: 'obliques', bone: 'torso', t: 0.36, f: 2.6, s: 7.6, r: [9, 3.6, 2.3], pair: true },
  { m: 'grandDorsal', bone: 'torso', t: 0.6, f: -3.4, s: 8.2, r: [12, 3.2, 3.3], pair: true },
  { m: 'milieuDos', bone: 'torso', t: 0.8, f: -6.2, s: 3, r: [8, 2.2, 3.6], pair: true },
  { m: 'trapHaut', bone: 'torso', t: 1.0, f: -2.4, s: 4.8, r: [4.4, 3, 5], pair: true },
  { m: 'lombaires', bone: 'torso', t: 0.3, f: -7, s: 2.6, r: [11, 2.2, 2.4], pair: true },
  { m: 'fessiers', bone: 'torso', t: -0.1, f: -5.6, s: 4.4, r: [6.4, 4.6, 5], pair: true },
  { m: 'moyenFessier', bone: 'torso', t: 0.04, f: -2.4, s: 8.2, r: [4.2, 3.6, 2.6], pair: true },
  { m: 'flechisseurs', bone: 'torso', t: -0.02, f: 5.6, s: 5.4, r: [4.2, 1.8, 2.4], pair: true },
  // Bras (épaule → coude), avant-bras (coude → poignet)
  { m: 'deltAvant', bone: 'ua', t: 0.12, f: 2.6, s: 0.4, r: [7, 2.8, 3.8] },
  { m: 'deltLat', bone: 'ua', t: 0.1, f: 0, s: 2.6, r: [7.2, 3.6, 2.8] },
  { m: 'deltArr', bone: 'ua', t: 0.12, f: -2.6, s: 0.4, r: [7, 2.8, 3.8] },
  { m: 'biceps', bone: 'ua', t: 0.56, f: 2.4, s: -0.2, r: [8.5, 2.7, 2.5] },
  { m: 'brachial', bone: 'ua', t: 0.72, f: 1.2, s: 2.2, r: [5.5, 2, 2] },
  { m: 'triceps', bone: 'ua', t: 0.5, f: -2.4, s: 0, r: [10, 2.9, 2.8] },
  { m: 'avantbras', bone: 'fa', t: 0.3, f: 0.6, s: 0, r: [8.5, 3, 3.2] },
  // Cuisse (hanche → genou), jambe (genou → cheville)
  { m: 'quadriceps', bone: 'th', t: 0.45, f: 2.6, s: 0.5, r: [14, 4, 4.4] },
  { m: 'quadriceps', bone: 'th', t: 0.52, f: 0.8, s: 3.2, r: [13, 3.4, 3] },
  { m: 'vasteInterne', bone: 'th', t: 0.8, f: 2, s: -2.4, r: [5.5, 3, 3] },
  { m: 'adducteurs', bone: 'th', t: 0.36, f: 0, s: -3, r: [11, 3.4, 2.6] },
  { m: 'ischios', bone: 'th', t: 0.5, f: -2.8, s: 0, r: [14, 3.6, 4.2] },
  { m: 'mollets', bone: 'sh', t: 0.28, f: -2.4, s: -0.6, r: [9.5, 3.3, 3] },
  { m: 'mollets', bone: 'sh', t: 0.3, f: -1.6, s: 2.2, r: [8.5, 2.6, 2.4] },
  { m: 'tibias', bone: 'sh', t: 0.38, f: 2, s: 0.8, r: [10, 1.7, 1.8] },
]

/** Os d'un membre : articulations de départ et d'arrivée. */
const LIMB: Record<Exclude<Bone, 'torso'>, [string, string]> = { ua: ['shoulder', 'elbow'], fa: ['elbow', 'hand'], th: ['hip', 'knee'], sh: ['knee', 'ankle'] }

const cross = (a: V3, b: V3): V3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]
const dot = (a: V3, b: V3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2]
const len = (a: V3) => Math.hypot(...a)

interface Frame { o: V3; axis: V3; fwd: V3; side: V3 }

/** Repère d'un os : axe (vers l'extrémité), « avant » qui suit le corps, côté. */
function boneFrame(a: V3, b: V3, bodySide: V3, bodyFwd: V3): Frame {
  const axis = norm3(sub3(b, a))
  // Avant = côté du corps × axe ; si l'os est presque aligné avec le côté (bras écartés), on reprend l'avant du tronc.
  const c2 = cross(bodySide, axis)
  const l2 = len(c2)
  const c1 = sub3(bodyFwd, mul3(axis, dot(bodyFwd, axis)))
  const w = Math.min(1, Math.max(0, (l2 - 0.2) / 0.4))
  const fwd = norm3(add3(mul3(norm3(c2), w), mul3(norm3(c1), 1 - w)))
  return { o: a, axis, fwd, side: cross(axis, fwd) }
}

export function buildMuscles(work: Work | undefined, shadowed: <T extends THREE.Mesh>(m: T) => T) {
  const mat = (c: string, e = 0) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.5, metalness: 0.04, emissive: c, emissiveIntensity: e })
  const idle = mat(MUSCLE_IDLE)
  const prim = mat(MUSCLE_PRIMARY, 0.28)
  const sec = mat(MUSCLE_SECONDARY, 0.18)
  const stab = mat(MUSCLE_STAB, 0.1)
  const base = new THREE.MeshStandardMaterial({ color: BASE, roughness: 0.7 })
  const geo = new THREE.SphereGeometry(1, 24, 16)
  const matOf = (m: Spec['m']) => (m === 'base' ? base : m === 'none' ? idle : work?.p.includes(m) ? prim : work?.s.includes(m) ? sec : work?.st.includes(m) ? stab : idle)

  // Une instance par côté (proche N / éloigné F) pour les muscles pairs et ceux des membres.
  const items: { spec: Spec; side: 'N' | 'F' | ''; mesh: THREE.Mesh }[] = []
  for (const spec of SPECS) {
    const sides: ('N' | 'F' | '')[] = spec.bone === 'torso' ? (spec.pair ? ['N', 'F'] : ['']) : ['N', 'F']
    for (const side of sides) items.push({ spec, side, mesh: shadowed(new THREE.Mesh(geo, matOf(spec.m))) })
  }

  const m4 = new THREE.Matrix4()
  const vx = new THREE.Vector3(), vy = new THREE.Vector3(), vz = new THREE.Vector3()

  return function update(j: Joints3) {
    // Repère du tronc : en deux moitiés pour suivre la courbure du dos.
    const down = norm3(sub3(j.pelvis, j.neck))
    const rawSide = sub3(j.shoulderN, j.shoulderF)
    const bodySide = norm3(sub3(rawSide, mul3(down, dot(rawSide, down))))
    const bodyFwd = cross(bodySide, down)
    const lower = boneFrame(j.pelvis, j.spineMid, bodySide, bodyFwd)
    const upper = boneFrame(j.spineMid, j.neck, bodySide, bodyFwd)
    // Le côté du tronc doit rester « N = positif » quelle que soit la direction de l'axe.
    const torsoFrame = (t: number): Frame => {
      const fr = t < 0.5 ? lower : upper
      const k = t < 0.5 ? t / 0.5 : (t - 0.5) / 0.5
      const a = t < 0.5 ? j.pelvis : j.spineMid
      const b = t < 0.5 ? j.spineMid : j.neck
      return { o: add3(a, mul3(sub3(b, a), k)), axis: fr.axis, fwd: mul3(fr.fwd, -1), side: bodySide }
    }

    for (const { spec, side, mesh } of items) {
      let fr: Frame
      let pos: V3
      if (spec.bone === 'torso') {
        fr = torsoFrame(spec.t)
        pos = fr.o
      } else {
        const [ja, jb] = LIMB[spec.bone]
        const a = j[`${ja}${side}` as JointName], b = j[`${jb}${side}` as JointName]
        fr = boneFrame(a, b, bodySide, bodyFwd)
        pos = add3(a, mul3(sub3(b, a), spec.t))
      }
      const sg = side === 'F' ? -1 : 1
      // Membres : « extérieur » = côté du corps du membre.
      const sideDir = spec.bone === 'torso' ? fr.side : mul3(bodySide, 1)
      pos = add3(pos, add3(mul3(fr.fwd, spec.f), mul3(sideDir, spec.s * sg)))
      mesh.position.set(...pos)
      const third = cross(fr.fwd, fr.axis)
      m4.makeBasis(vx.set(...fr.fwd), vy.set(...fr.axis), vz.set(...third))
      mesh.quaternion.setFromRotationMatrix(m4)
      mesh.scale.set(spec.r[1], spec.r[0], spec.r[2])
    }
  }
}

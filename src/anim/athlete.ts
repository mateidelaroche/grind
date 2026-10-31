// Personnage réaliste (Quaternius, CC0) piloté par le squelette des animations.
// On ne joue pas d'animation du modèle : à chaque image, on recalcule la matrice monde de chaque os
// à partir des points du squelette 3D (bassin, colonne, cou, tête, coudes, mains, genoux, chevilles).
// Bras et jambes passent par une IK à 2 os pour que mains et pieds touchent exactement les mêmes
// appuis que l'animation (sol, lit, élastique), même si les proportions du modèle diffèrent.
import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js'
import { clone as cloneSkinned } from 'three/examples/jsm/utils/SkeletonUtils.js'
import { L } from './rig'
import type { Joints3, V3 } from './skeleton3d'

const URL = `${import.meta.env.BASE_URL}models/athlete.glb`
let loading: Promise<THREE.Object3D> | undefined
const HAIR_TINT = '#6a4632'

/** Charge le modèle une seule fois (il est aussi mis en cache hors ligne par le service worker). */
export function loadAthlete(): Promise<THREE.Object3D> {
  if (!loading) {
    const loader = new GLTFLoader()
    loader.setMeshoptDecoder(MeshoptDecoder)
    loading = loader.loadAsync(URL).then((g) => {
      // Cheveux et sourcils : texture grise prévue pour être teintée.
      g.scene.traverse((o) => {
        const m = (o as THREE.Mesh).material as THREE.MeshStandardMaterial | undefined
        if (m?.name === 'MI_Hair_1') m.color.set(HAIR_TINT)
      })
      return g.scene
    })
    loading.catch(() => { loading = undefined })
  }
  return loading
}

// Repère du modèle au repos : il regarde vers +Z, sa droite est vers −X.
const FWD0 = new THREE.Vector3(0, 0, 1)
const UP0 = new THREE.Vector3(0, 1, 0)
const RIGHT0 = new THREE.Vector3(-1, 0, 0)
const DOWN = new THREE.Vector3(0, -1, 0)
/** Hauteur du bassin debout dans les animations (sol à 0). */
const HIP_HEIGHT = 76
/** Dans les animations, la cheville est à 2 unités du sol. */
const ANKLE_Y = 2

interface BoneInfo {
  bone: THREE.Bone
  parent: number
  /** Repos, en monde (échelle du modèle comprise). */
  pos0: THREE.Vector3
  quat0: THREE.Quaternion
  /** Rotation de repos relative au parent, et décalage depuis le parent dans le repère du parent. */
  local0: THREE.Quaternion
  offset0: THREE.Vector3
  /** Étirement le long de l'os (bras, colonne) et axe de l'os dans son repère. */
  k: number
  axis: THREE.Vector3
  /** Courbure des doigts (rad) autour de cet axe local. */
  curlAxis?: THREE.Vector3
  curl?: number
  // Pose courante
  pos: THREE.Vector3
  quat: THREE.Quaternion
}

const v = (a: V3) => new THREE.Vector3(a[0], a[1], a[2])

/** Rotation qui envoie le repère (a0, b0) sur (a1, b1) : a exact, b au mieux. */
function frameRot(a0: THREE.Vector3, b0: THREE.Vector3, a1: THREE.Vector3, b1: THREE.Vector3, out = new THREE.Quaternion()) {
  const basis = (a: THREE.Vector3, b: THREE.Vector3) => {
    const x = a.clone().normalize()
    const y = b.clone().addScaledVector(x, -b.dot(x))
    // b parallèle à a : n'importe quelle perpendiculaire fait l'affaire.
    if (y.lengthSq() < 1e-8) y.set(x.y, -x.x, 0)
    if (y.lengthSq() < 1e-8) y.set(0, x.z, -x.y)
    y.normalize()
    const z = new THREE.Vector3().crossVectors(x, y)
    return new THREE.Matrix4().makeBasis(x, y, z)
  }
  const m0 = basis(a0, b0), m1 = basis(a1, b1)
  return out.setFromRotationMatrix(m1.multiply(m0.transpose()))
}

/** Point du coude/genou : IK à 2 os de A vers T, plié du côté de `side` (direction perpendiculaire). */
function solveIK(A: THREE.Vector3, T: THREE.Vector3, l1: number, l2: number, side: THREE.Vector3) {
  const dir = T.clone().sub(A)
  const d = Math.min(Math.max(dir.length(), Math.abs(l1 - l2) + 0.01), l1 + l2 - 0.001)
  dir.normalize()
  const cos = (l1 * l1 + d * d - l2 * l2) / (2 * l1 * d)
  const sin = Math.sqrt(Math.max(0, 1 - cos * cos))
  return A.clone().addScaledVector(dir, l1 * cos).addScaledVector(side, l1 * sin)
}

/** Direction perpendiculaire à (A→T) qui pointe vers P ; repli si P est aligné. */
function bendSide(A: THREE.Vector3, T: THREE.Vector3, P: THREE.Vector3, fallback: THREE.Vector3) {
  const n = T.clone().sub(A).normalize()
  const b = P.clone().sub(A)
  b.addScaledVector(n, -b.dot(n))
  if (b.lengthSq() < 0.25) b.copy(fallback).addScaledVector(n, -fallback.dot(n))
  return b.normalize()
}

export interface Athlete {
  object: THREE.Object3D
  /** Pose le personnage sur les points du squelette. grip : mains fermées (élastique, sac). */
  pose: (j: Joints3, opts: { handFlat: [boolean, boolean]; grip: [boolean, boolean] }) => void
}

export function makeAthlete(source: THREE.Object3D): Athlete {
  const root = cloneSkinned(source)
  root.updateMatrixWorld(true)
  const bones: THREE.Bone[] = []
  root.traverse((o) => { if ((o as THREE.Bone).isBone) bones.push(o as THREE.Bone) })
  const byName = (n: string) => bones.find((b) => b.name === n)!
  // Échelle : bassin du modèle à la hauteur du bassin des animations.
  const hipY = (byName('thigh_l').getWorldPosition(new THREE.Vector3()).y + byName('thigh_r').getWorldPosition(new THREE.Vector3()).y) / 2
  const s = HIP_HEIGHT / hipY
  root.scale.setScalar(s)
  root.updateMatrixWorld(true)

  const idx = new Map(bones.map((b, i) => [b, i]))
  const info: BoneInfo[] = bones.map((b) => {
    const pos0 = b.getWorldPosition(new THREE.Vector3())
    const quat0 = b.getWorldQuaternion(new THREE.Quaternion())
    return { bone: b, parent: idx.get(b.parent as THREE.Bone) ?? -1, pos0, quat0, local0: new THREE.Quaternion(), offset0: new THREE.Vector3(), k: 1, axis: new THREE.Vector3(0, 1, 0), pos: pos0.clone(), quat: quat0.clone() }
  })
  for (const b of info) {
    const p = info[b.parent]
    if (!p) continue
    const inv = p.quat0.clone().invert()
    b.local0.copy(inv).multiply(b.quat0)
    b.offset0.copy(b.pos0).sub(p.pos0).applyQuaternion(inv)
  }
  const I = (n: string) => info[idx.get(byName(n))!]
  const len = (a: string, b: string) => I(a).pos0.distanceTo(I(b).pos0)
  const setAxis = (n: string, child: string, k: number) => {
    const b = I(n)
    b.k = k
    b.axis.copy(I(child).offset0).normalize()
  }
  // Proportions des animations : bras et colonne un peu étirés (le modèle a des bras courts).
  const kArm = (L.ua + L.fa) / (len('upperarm_r', 'lowerarm_r') + len('lowerarm_r', 'hand_r'))
  const hipMid0 = I('thigh_l').pos0.clone().add(I('thigh_r').pos0).multiplyScalar(0.5)
  const kSpine = L.torso / hipMid0.distanceTo(I('neck_01').pos0)
  for (const side of ['l', 'r']) {
    setAxis(`upperarm_${side}`, `lowerarm_${side}`, kArm)
    setAxis(`lowerarm_${side}`, `hand_${side}`, kArm)
  }
  setAxis('spine_01', 'spine_02', kSpine)
  setAxis('spine_02', 'spine_03', kSpine)
  setAxis('spine_03', 'neck_01', kSpine)
  // Doigts : axe de flexion (vers la paume, paume vers le bas au repos).
  for (const b of info) {
    const m = /^(index|middle|ring|pinky|thumb)_0([123])_([lr])$/.exec(b.bone.name)
    if (!m) continue
    const child = info.find((c) => c.parent === info.indexOf(b))
    if (!child) continue
    const dirW = child.pos0.clone().sub(b.pos0).normalize()
    const axisW = new THREE.Vector3().crossVectors(dirW, m[1] === 'thumb' ? FWD0.clone().negate() : DOWN).normalize()
    b.curlAxis = axisW.applyQuaternion(b.quat0.clone().invert())
    b.curl = m[1] === 'thumb' ? 0.25 : [0.35, 0.45, 0.3][+m[2] - 1]
  }

  const L_ARM = [len('upperarm_r', 'lowerarm_r') * kArm, len('lowerarm_r', 'hand_r') * kArm]
  const L_LEG = [len('thigh_r', 'calf_r'), len('calf_r', 'foot_r')]
  const ankleH = I('foot_r').pos0.y
  const handDir0 = I('middle_01_r').pos0.clone().sub(I('hand_r').pos0).normalize()
  const handDir0L = I('middle_01_l').pos0.clone().sub(I('hand_l').pos0).normalize()
  const armDir0 = { r: I('lowerarm_r').pos0.clone().sub(I('upperarm_r').pos0).normalize(), l: I('lowerarm_l').pos0.clone().sub(I('upperarm_l').pos0).normalize() }
  const legDir0 = I('calf_r').pos0.clone().sub(I('thigh_r').pos0).normalize()
  const toeDir0 = I('ball_leaf_r').pos0.clone().sub(I('ball_r').pos0).normalize()

  // Maillages : pas de découpage hors champ (les bornes de repos sont fausses une fois posé).
  const meshes: THREE.Mesh[] = []
  root.traverse((o) => {
    const m = o as THREE.Mesh
    if (!m.isMesh) return
    m.castShadow = true
    m.receiveShadow = true
    m.frustumCulled = false
    meshes.push(m)
  })
  // Cheveux : maillage fixe, on le colle à l'os de la tête.
  const hair = meshes.find((m) => !(m as THREE.SkinnedMesh).isSkinnedMesh)
  const head0Inv = I('Head').bone.matrixWorld.clone().invert()
  const hairRel = hair ? head0Inv.clone().multiply(hair.matrixWorld) : undefined
  if (hair) { hair.matrixAutoUpdate = false; hair.matrixWorldAutoUpdate = false }
  for (const b of info) { b.bone.matrixAutoUpdate = false; b.bone.matrixWorldAutoUpdate = false }

  // Rotations imposées (monde) pour certains os ; les autres suivent leur parent.
  const forced = new Map<number, THREE.Quaternion>()
  const force = (n: string, q: THREE.Quaternion) => forced.set(idx.get(byName(n))!, q)
  const tmpM = new THREE.Matrix4()
  const tmpS = new THREE.Matrix4()

  /** Cinématique directe d'un os depuis son parent (position étirée selon l'os parent). */
  function fk(i: number, grip: [boolean, boolean]) {
    const b = info[i]
    const p = info[b.parent]
    if (!p) return
    const off = b.offset0.clone()
    if (p.k !== 1) off.addScaledVector(p.axis, off.dot(p.axis) * (p.k - 1))
    b.pos.copy(p.pos).add(off.applyQuaternion(p.quat))
    const q = forced.get(i)
    if (q) { b.quat.copy(q); return }
    b.quat.copy(p.quat).multiply(b.local0)
    if (b.curlAxis) {
      const right = b.bone.name.endsWith('_r')
      const k = grip[right ? 0 : 1] ? 2.1 : 1
      b.quat.multiply(new THREE.Quaternion().setFromAxisAngle(b.curlAxis, (b.curl ?? 0) * k))
    }
  }
  /** Rotation monde d'un os orienté : sa direction de repos dir0 va vers dir, son repère suit pole0 → pole. */
  const aim = (n: string, dir0: THREE.Vector3, pole0: THREE.Vector3, dir: THREE.Vector3, pole: THREE.Vector3) =>
    frameRot(dir0, pole0, dir, pole).multiply(I(n).quat0)

  function compose() {
    for (const b of info) {
      tmpM.compose(b.pos, b.quat, new THREE.Vector3(s, s, s))
      if (b.k !== 1) {
        const a = b.axis, k = b.k - 1
        tmpS.set(
          1 + k * a.x * a.x, k * a.x * a.y, k * a.x * a.z, 0,
          k * a.y * a.x, 1 + k * a.y * a.y, k * a.y * a.z, 0,
          k * a.z * a.x, k * a.z * a.y, 1 + k * a.z * a.z, 0,
          0, 0, 0, 1,
        )
        tmpM.multiply(tmpS)
      }
      b.bone.matrixWorld.copy(tmpM)
    }
    if (hair && hairRel) hair.matrixWorld.copy(I('Head').bone.matrixWorld).multiply(hairRel)
  }

  function pose(j: Joints3, { handFlat, grip }: { handFlat: [boolean, boolean]; grip: [boolean, boolean] }) {
    forced.clear()
    const pelvis = v(j.pelvis), mid = v(j.spineMid), neck = v(j.neck), head = v(j.head)
    const hipRight = v(j.hipN).sub(v(j.hipF)).normalize()
    const shRight = v(j.shoulderN).sub(v(j.shoulderF)).normalize()
    const upLow = mid.clone().sub(pelvis).normalize()
    const upHigh = neck.clone().sub(mid).normalize()
    const rLow = frameRot(UP0, RIGHT0, upLow, hipRight)
    const rUp = frameRot(UP0, RIGHT0, upHigh, shRight)
    const torsoFwd = FWD0.clone().applyQuaternion(rUp)
    const hipFwd = FWD0.clone().applyQuaternion(rLow)
    const headUp = head.clone().sub(neck).normalize()
    const rHead = frameRot(UP0, FWD0, headUp, v(j.face))

    // Bassin : placé pour que le milieu des hanches tombe sur le bassin de l'animation.
    const pel = I('pelvis')
    pel.quat.copy(rLow).multiply(pel.quat0)
    pel.pos.copy(pelvis).sub(hipMid0.clone().sub(pel.pos0).applyQuaternion(rLow))
    force('spine_01', new THREE.Quaternion().slerpQuaternions(rLow, rUp, 0.35).multiply(I('spine_01').quat0))
    force('spine_02', new THREE.Quaternion().slerpQuaternions(rLow, rUp, 0.7).multiply(I('spine_02').quat0))
    force('spine_03', rUp.clone().multiply(I('spine_03').quat0))
    force('neck_01', new THREE.Quaternion().slerpQuaternions(rUp, rHead, 0.5).multiply(I('neck_01').quat0))
    force('Head', rHead.clone().multiply(I('Head').quat0))

    // Le tronc d'abord, pour connaître la position réelle des épaules et des hanches.
    const pelIdx = idx.get(pel.bone)!
    const isTrunk = (n: string) => /^(spine_0\d|neck_01|Head|clavicle_[lr]|upperarm_[lr]|thigh_[lr])$/.test(n)
    for (let i = 0; i < info.length; i++) if (i !== pelIdx && isTrunk(info[i].bone.name)) fk(i, grip)

    for (const [side, N] of [['r', 'N'], ['l', 'F']] as const) {
      const gi = side === 'r' ? 0 : 1
      // Bras
      const A = I(`upperarm_${side}`).pos
      const T = v(j[`hand${N}`])
      const bend = bendSide(A, T, v(j[`elbow${N}`]), torsoFwd.clone().negate())
      const E = solveIK(A, T, L_ARM[0], L_ARM[1], bend)
      const Tr = A.clone().add(T.clone().sub(A).setLength(Math.min(A.distanceTo(T), L_ARM[0] + L_ARM[1])))
      const back = FWD0.clone().negate()
      force(`upperarm_${side}`, aim(`upperarm_${side}`, armDir0[side], back, E.clone().sub(A), bend))
      force(`lowerarm_${side}`, aim(`lowerarm_${side}`, armDir0[side], back, Tr.clone().sub(E), bend))
      // Main : dans le prolongement de l'avant-bras, ou à plat paume au sol.
      const hDir = Tr.clone().sub(E).normalize()
      if (handFlat[gi]) {
        const palm0 = DOWN
        force(`hand_${side}`, aim(`hand_${side}`, side === 'r' ? handDir0 : handDir0L, palm0, new THREE.Vector3(1, 0, 0), new THREE.Vector3(0, -1, 0)))
      } else {
        const qFore = frameRot(armDir0[side], back, hDir, bend)
        force(`hand_${side}`, qFore.multiply(I(`hand_${side}`).quat0))
      }
      // Jambe : la cheville du modèle est plus haute que celle de l'animation (épaisseur du pied).
      const H = I(`thigh_${side}`).pos
      const ankle = v(j[`ankle${N}`])
      const knee = v(j[`knee${N}`])
      const fd = v(j[`toe${N}`]).sub(ankle).normalize()
      const shinUp = knee.clone().sub(ankle).normalize()
      const footUp = shinUp.clone().addScaledVector(fd, -shinUp.dot(fd)).normalize()
      const K = ankle.clone().addScaledVector(footUp, ankleH - ANKLE_Y)
      const kb = bendSide(H, K, knee, hipFwd)
      const Kn = solveIK(H, K, L_LEG[0], L_LEG[1], kb)
      const Kr = H.clone().add(K.clone().sub(H).setLength(Math.min(H.distanceTo(K), L_LEG[0] + L_LEG[1])))
      force(`thigh_${side}`, aim(`thigh_${side}`, legDir0, FWD0, Kn.clone().sub(H), kb))
      force(`calf_${side}`, aim(`calf_${side}`, legDir0, FWD0, Kr.clone().sub(Kn), kb))
      force(`foot_${side}`, aim(`foot_${side}`, FWD0, UP0, fd, footUp))
      // Pied tendu vers le sol (planche, pompes) : orteils repliés à plat, tournés vers la tête.
      if (fd.y < -0.5) {
        const flatDir = neck.clone().sub(ankle).setY(0)
        if (flatDir.lengthSq() > 1e-4) force(`ball_${side}`, aim(`ball_${side}`, toeDir0, UP0, flatDir.normalize(), UP0))
      }
    }
    // Le reste du squelette, du tronc aux doigts (les os sont rangés parent avant enfant).
    for (let i = 0; i < info.length; i++) if (i !== pelIdx) fk(i, grip)
    compose()
  }

  return { object: root, pose }
}

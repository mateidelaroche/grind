import { useEffect, useRef, useState } from 'react'
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { ANIMS } from './anims'
import { BAND_COLORS } from './Figure'
import { cycleLength, FLOOR, fmtCm, poseAt, type AnimDef, type Target } from './rig'
import { add3, mul3, norm3, skeleton3d, sub3, type Joints3, type V3 } from './skeleton3d'
import type { Band } from '../types'

const SKIN = '#dcb293'
const SKIN_FAR = '#a47f66'
const SHIRT = '#3d5585'
const SHIRT_FAR = '#2c3d61'
const SHORTS = '#2b3342'
const SHORTS_FAR = '#20262f'
const SHOES = '#e2e6ec'
const HAIR = '#3a2b22'
const SCENE = '#243046'
const SCENE_HI = '#33415a'

/** Profil d'un segment : [t le long de l'os (0 → 1), demi-largeur (côtés), profondeur devant, profondeur derrière]. */
type Row = [number, number, number?, number?]

/** Tube à section ovale, de hauteur 1 (y de −0,5 à 0,5) : étiré ensuite à la longueur de l'os. */
function tube(rows: Row[], k = 1, seg = 20): THREE.BufferGeometry {
  const pos: number[] = []
  const idx: number[] = []
  const ring = seg + 1
  for (const [t, w, df = w, db = df] of rows) {
    for (let i = 0; i <= seg; i++) {
      const th = (i / seg) * Math.PI * 2
      const c = Math.cos(th)
      pos.push(c * (c > 0 ? df : db), t - 0.5, Math.sin(th) * w * k)
    }
  }
  for (let r = 0; r < rows.length - 1; r++) {
    for (let i = 0; i < seg; i++) {
      const a = r * ring + i, b = a + ring
      idx.push(a, b, a + 1, a + 1, b, b + 1)
    }
  }
  // Bouts fermés
  const cap = (r: number, flip: boolean) => {
    const c = pos.length / 3
    pos.push(0, rows[r][0] - 0.5, 0)
    for (let i = 0; i < seg; i++) {
      const a = r * ring + i
      if (flip) idx.push(c, a + 1, a)
      else idx.push(c, a, a + 1)
    }
  }
  cap(0, false)
  cap(rows.length - 1, true)
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
  g.setIndex(idx)
  g.computeVertexNormals()
  return g
}

/** Ne garde que la partie [t0, t1] d'un profil, un peu plus large (manche, short). */
function sleeve(rows: Row[], t0: number, t1: number, extra: number): Row[] {
  const at = (t: number): Row => {
    const i = Math.max(1, rows.findIndex((r) => r[0] >= t))
    const [a, b] = [rows[i - 1], rows[i] ?? rows[i - 1]]
    const k = b[0] === a[0] ? 0 : (t - a[0]) / (b[0] - a[0])
    const m = (x?: number, y?: number, d = 0) => (x ?? d) + ((y ?? d) - (x ?? d)) * k
    return [t, m(a[1], b[1]), m(a[2] ?? a[1], b[2] ?? b[1]), m(a[3] ?? a[2] ?? a[1], b[3] ?? b[2] ?? b[1])]
  }
  const inner = rows.filter((r) => r[0] > t0 && r[0] < t1)
  return [at(t0), ...inner, at(t1)].map(([t, w, df, db]) => [t, w + extra, (df ?? w) + extra, (db ?? df ?? w) + extra])
}

// Galbes, morphologie fine (mêmes proportions que la silhouette 2D).
const THIGH: Row[] = [[0, 6.8], [0.18, 7], [0.55, 6], [0.88, 4.8], [1, 4.6]]
const SHIN: Row[] = [[0, 4.5], [0.22, 4.8, 4.5, 5.6], [0.45, 4.4, 4, 4.9], [0.85, 3], [1, 2.9]]
const UPPER_ARM: Row[] = [[0, 4.8], [0.3, 4.5], [0.65, 4.1], [1, 3.4]]
const FOREARM: Row[] = [[0, 3.5], [0.25, 3.8], [0.7, 2.9], [1, 2.5]]
const NECK: Row[] = [[0, 3.5], [0.75, 3.2]]
// Tronc en deux morceaux (bassin → milieu du dos → base du cou) : [t, demi-largeur, ventre/poitrine, fesses/dos].
const TORSO_LOW: Row[] = [[-0.2, 9.5, 5, 6.5], [0.08, 12, 6.2, 8.4], [0.56, 10.8, 6, 6.4], [1, 10.4, 6.2, 6]]
const TORSO_HIGH: Row[] = [[0, 10.4, 6.2, 6], [0.44, 12.8, 8.2, 7], [0.8, 14, 7.2, 6.8], [1, 12.6, 6, 6.2], [1.12, 5, 4, 4]]

type Seg = { a: keyof Joints3; b: keyof Joints3; geo: THREE.BufferGeometry; mat: string }
type Ball = { j: keyof Joints3; r: number; mat: string }

function body(front: boolean) {
  // De face, le squelette 2D a les épaules plus serrées : le tronc suit.
  const k = front ? 0.83 : 1
  const limbs = (side: 'N' | 'F'): Seg[] => {
    const f = side === 'F' ? 'Far' : ''
    return [
      { a: `hip${side}`, b: `knee${side}`, geo: tube(THIGH), mat: 'skin' + f },
      { a: `hip${side}`, b: `knee${side}`, geo: tube(sleeve(THIGH, -0.04, 0.42, 0.5)), mat: 'shorts' + f },
      { a: `knee${side}`, b: `ankle${side}`, geo: tube(SHIN), mat: 'skin' + f },
      { a: `shoulder${side}`, b: `elbow${side}`, geo: tube(UPPER_ARM), mat: 'skin' + f },
      { a: `shoulder${side}`, b: `elbow${side}`, geo: tube(sleeve(UPPER_ARM, -0.05, 0.4, 0.45)), mat: 'shirt' + f },
      { a: `elbow${side}`, b: `hand${side}`, geo: tube(FOREARM), mat: 'skin' + f },
    ] as Seg[]
  }
  const segs: Seg[] = [
    { a: 'pelvis', b: 'spineMid', geo: tube(TORSO_LOW, k), mat: 'shirt' },
    { a: 'pelvis', b: 'spineMid', geo: tube(sleeve(TORSO_LOW, -0.2, 0.3, 0.45), k), mat: 'shorts' },
    { a: 'spineMid', b: 'neck', geo: tube(TORSO_HIGH, k), mat: 'shirt' },
    { a: 'neck', b: 'head', geo: tube(NECK), mat: 'skin' },
    ...limbs('N'),
    ...limbs('F'),
  ]
  const balls: Ball[] = (['N', 'F'] as const).flatMap((side) => {
    const f = side === 'F' ? 'Far' : ''
    return [
      { j: `shoulder${side}`, r: 5.3, mat: 'shirt' + f },
      { j: `elbow${side}`, r: 3.5, mat: 'skin' + f },
      { j: `knee${side}`, r: 4.6, mat: 'skin' + f },
      { j: `ankle${side}`, r: 3, mat: 'skin' + f },
    ] as Ball[]
  })
  return { segs, balls }
}

const UP = new THREE.Vector3(0, 1, 0)
const tmpA = new THREE.Vector3()
const tmpB = new THREE.Vector3()

function placeCylinder(m: THREE.Mesh, a: V3, b: V3) {
  tmpA.set(...a)
  tmpB.set(...b)
  const len = tmpA.distanceTo(tmpB)
  m.position.copy(tmpA).add(tmpB).multiplyScalar(0.5)
  m.scale.set(1, Math.max(0.001, len), 1)
  m.quaternion.setFromUnitVectors(UP, tmpB.sub(tmpA).normalize())
}

const tmpM = new THREE.Matrix4()
const tmpC = new THREE.Vector3()
/** Oriente un objet : son axe x suit `fwd`, son axe y suit `up` (redressé pour être perpendiculaire). */
function orient(o: THREE.Object3D, fwd: V3, up: V3) {
  tmpB.set(...up).normalize()
  const along = tmpA.set(...fwd).dot(tmpB)
  tmpA.addScaledVector(tmpB, -along)
  if (tmpA.lengthSq() < 1e-6) tmpA.set(1, 0, 0).addScaledVector(tmpB, -tmpB.x)
  tmpA.normalize()
  tmpC.crossVectors(tmpA, tmpB)
  tmpM.makeBasis(tmpA, tmpB, tmpC)
  o.quaternion.setFromRotationMatrix(tmpM)
}

/** Point 3D d'une cible : le plan de l'image est le plan de profil (ou de face pour les vues de face). */
function resolve3(tg: Target, j: Joints3, cx: number, front: boolean, z = 0): V3 {
  // Décalage du plan de l'image (repère SVG, y vers le bas) vers la 3D
  const plane = (dx: number, dy: number): V3 => (front ? [0, -dy, dx] : [dx, -dy, 0])
  if (Array.isArray(tg)) return add3(plane(tg[0] - cx, tg[1] - FLOOR), [0, 0, front ? 0 : z])
  let p = add3(j[tg.j], plane(...(tg.o ?? [0, 0])))
  if (tg.b) {
    const up = norm3(sub3(j.neck, j.pelvis))
    // Vers le dos : perpendiculaire au buste, à l'opposé du visage
    const back: V3 = front ? [-1, 0, 0] : [-up[1], up[0], 0]
    p = add3(add3(p, mul3(up, tg.b[0])), mul3(back, tg.b[1]))
  }
  return tg.z ? add3(p, [0, 0, tg.z]) : p
}

/** Étiquette 3D toujours lisible (dessinée par-dessus la scène). */
function textSprite(text: string): THREE.Sprite {
  const c = document.createElement('canvas')
  const ctx = c.getContext('2d')!
  ctx.font = '700 44px system-ui, sans-serif'
  const w = Math.ceil(ctx.measureText(text).width) + 36
  c.width = w
  c.height = 64
  ctx.font = '700 44px system-ui, sans-serif'
  ctx.fillStyle = 'rgba(8, 47, 73, 0.9)'
  ctx.strokeStyle = '#67e8f9'
  ctx.lineWidth = 3
  ctx.beginPath()
  ctx.roundRect(2, 2, w - 4, 60, 14)
  ctx.fill()
  ctx.stroke()
  ctx.fillStyle = '#67e8f9'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(text, w / 2, 34)
  const tex = new THREE.CanvasTexture(c)
  tex.colorSpace = THREE.SRGBColorSpace
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, depthTest: false, transparent: true }))
  s.scale.set((w / 64) * 7, 7, 1)
  s.renderOrder = 10
  return s
}

/** Repères chiffrés en 3D : pointillés + étiquette. Renvoie les points à garder dans le cadre. */
function buildMarks(anim: AnimDef, cx: number, scene: THREE.Scene): V3[] {
  const keep: V3[] = []
  const front = anim.view === 'front'
  const mat = new THREE.LineDashedMaterial({ color: '#67e8f9', dashSize: 3, gapSize: 2, depthTest: false, transparent: true })
  const line = (pts: V3[]) => {
    const l = new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts.map((p) => new THREE.Vector3(...p))), mat)
    l.computeLineDistances()
    l.renderOrder = 9
    scene.add(l)
  }
  const at = (x: number, y: number, z: number): V3 => (front ? [0, y, x - cx] : [x - cx, y, z])
  for (const m of anim.marks ?? []) {
    const label = (v: number) => `${fmtCm(v)}${m.note ? ` · ${m.note}` : ''}`
    if ('h' in m) {
      const top = at(m.h[0], FLOOR - m.h[1], m.z ?? 0)
      line([[top[0], 0.3, top[2]], top])
      const s = textSprite(label(FLOOR - m.h[1]))
      s.position.set(top[0], top[1] + 7, top[2])
      scene.add(s)
      keep.push([top[0], top[1] + 12, top[2]])
    } else {
      const z = m.z ?? 24
      const a = at(m.d[0], 0.4, z), b = at(m.d[1], 0.4, z)
      line([a, b])
      line([[a[0], 0.4, a[2] - 3], [a[0], 0.4, a[2] + 3]])
      line([[b[0], 0.4, b[2] - 3], [b[0], 0.4, b[2] + 3]])
      const s = textSprite(label(Math.abs(m.d[1] - m.d[0])))
      s.position.set((a[0] + b[0]) / 2, 8, (a[2] + b[2]) / 2)
      scene.add(s)
      keep.push(a, b)
    }
  }
  return keep
}

function buildScene(anim: AnimDef, cx: number, scene: THREE.Scene) {
  const mat = new THREE.MeshStandardMaterial({ color: SCENE, roughness: 0.9 })
  const matHi = new THREE.MeshStandardMaterial({ color: SCENE_HI, roughness: 0.85 })
  // Porte et mur translucides : ils ne masquent jamais le mannequin quand on tourne la vue.
  const ghost = new THREE.MeshStandardMaterial({ color: SCENE_HI, roughness: 0.9, transparent: true, opacity: 0.28, depthWrite: false })
  const box = (w: number, h: number, d: number, x: number, y: number, z: number, m = mat) => {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m)
    mesh.position.set(x, y, z)
    mesh.castShadow = mesh.receiveShadow = true
    scene.add(mesh)
  }
  for (const s of anim.scene ?? []) {
    if (s.k === 'bed') {
      const h = s.h ?? 36
      const x0 = s.x - cx
      const z = s.z ?? 0
      box(s.w, h - 8, 90, x0 + s.w / 2, (h - 8) / 2 + 2, z)
      box(s.w, 8, 90, x0 + s.w / 2, h - 4, z, matHi)
    } else if (s.k === 'door') {
      box(4, 200, 80, s.x - cx, 100, 0, ghost)
    } else if (s.k === 'wall') {
      box(5, 200, 240, s.x - cx, 100, 0, ghost)
    } else {
      box(s.w, s.h, 26, s.x - cx + s.w / 2, s.h / 2, 9, matHi)
    }
  }
}

export type CamPreset = 'profil' | '3/4' | 'face' | 'dessus'

/** at : instant figé du cycle (s) et cam : vue imposée, pour les captures de la page de dev. */
interface Props { anim: string; band?: Band; className?: string; at?: number; cam?: { az: number; el: number } }

export default function Figure3D({ anim: id, band, className, at, cam }: Props) {
  const ref = useRef<HTMLDivElement>(null)
  const api = useRef<{ setView: (p: CamPreset) => void }>(undefined)
  const [failed, setFailed] = useState(false)
  const [view, setView] = useState<CamPreset>()

  useEffect(() => {
    const el = ref.current
    const anim = ANIMS[id]
    if (!el || !anim) return
    let renderer: THREE.WebGLRenderer
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true })
    } catch {
      setFailed(true)
      return
    }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    renderer.shadowMap.enabled = true
    renderer.shadowMap.type = THREE.PCFSoftShadowMap
    el.appendChild(renderer.domElement)

    const scene = new THREE.Scene()
    scene.background = new THREE.Color('#0d121c')
    scene.fog = new THREE.Fog('#0d121c', 420, 900)
    const cx = anim.keys[0].p[0]

    scene.add(new THREE.HemisphereLight('#c7d6f0', '#1a2231', 1.1))
    const sun = new THREE.DirectionalLight('#ffffff', 1.6)
    sun.position.set(120, 260, 160)
    sun.castShadow = true
    sun.shadow.mapSize.set(1024, 1024)
    Object.assign(sun.shadow.camera, { left: -180, right: 180, top: 180, bottom: -180, near: 10, far: 700 })
    sun.shadow.radius = 4
    scene.add(sun)

    const floor = new THREE.Mesh(new THREE.CircleGeometry(420, 64), new THREE.MeshStandardMaterial({ color: '#141c2b', roughness: 1 }))
    floor.rotation.x = -Math.PI / 2
    floor.receiveShadow = true
    scene.add(floor)
    const grid = new THREE.GridHelper(600, 30, '#26324a', '#1b2436')
    grid.position.y = 0.2
    scene.add(grid)
    buildScene(anim, cx, scene)

    // Mannequin : peau, t-shirt, short, chaussures
    const std = (color: string, roughness = 0.65) => new THREE.MeshStandardMaterial({ color, roughness, metalness: 0 })
    const mats: Record<string, THREE.Material> = {
      skin: std(SKIN, 0.6), skinFar: std(SKIN_FAR, 0.65), shirt: std(SHIRT, 0.8), shirtFar: std(SHIRT_FAR, 0.85),
      shorts: std(SHORTS, 0.85), shortsFar: std(SHORTS_FAR, 0.9), shoes: std(SHOES, 0.5), hair: std(HAIR, 0.9),
    }
    const ball = new THREE.SphereGeometry(1, 20, 14)
    const shadowed = <T extends THREE.Object3D>(m: T) => { m.castShadow = true; m.receiveShadow = true; scene.add(m); return m }
    const { segs: SEGS, balls: BALLS } = body(anim.view === 'front')
    const segs = SEGS.map((s) => shadowed(new THREE.Mesh(s.geo, mats[s.mat])))
    const balls = BALLS.map((b) => {
      const m = shadowed(new THREE.Mesh(ball, mats[b.mat]))
      m.scale.setScalar(b.r)
      return m
    })
    const part = (parent: THREE.Object3D, mat: string, sc: V3, at: V3 = [0, 0, 0], geo: THREE.BufferGeometry = ball) => {
      const m = new THREE.Mesh(geo, mats[mat])
      m.scale.set(...sc)
      m.position.set(...at)
      m.castShadow = true
      parent.add(m)
      return m
    }
    // Tête dans son repère : x = visage, y = sommet du crâne, z = côté.
    const head = shadowed(new THREE.Group())
    part(head, 'skin', [8, 9.2, 7.3], [-0.4, 0.4, 0])
    part(head, 'skin', [5.6, 4.6, 5.6], [2.6, -4.4, 0])
    part(head, 'skin', [2, 2.3, 1.4], [7.9, -0.8, 0])
    part(head, 'skin', [1.3, 2.4, 1.1], [-0.8, -0.4, 7.2])
    part(head, 'skin', [1.3, 2.4, 1.1], [-0.8, -0.4, -7.2])
    const cap = new THREE.SphereGeometry(1, 22, 12, 0, Math.PI * 2, 0, Math.PI * 0.42)
    part(head, 'hair', [8.6, 9.8, 7.9], [-0.9, 0.6, 0], cap).rotation.z = 0.5
    // Mains en moufle, chaussures
    const hands = (['N', 'F'] as const).map((side) => shadowed(new THREE.Mesh(ball, mats[side === 'N' ? 'skin' : 'skinFar'])))
    const shoes = (['N', 'F'] as const).map(() => shadowed(new THREE.Mesh(ball, mats.shoes)))
    const beds = (anim.scene ?? []).flatMap((s) => (s.k === 'bed' ? [{ y: s.h ?? 36, x0: s.x - cx, x1: s.x - cx + s.w }] : []))
    const cyl = new THREE.CylinderGeometry(1, 1, 1, 18)
    const sac = anim.sac ? shadowed(new THREE.Mesh(new THREE.BoxGeometry(11, 19, 16), new THREE.MeshStandardMaterial({ color: '#3f526e', roughness: 0.8 }))) : undefined
    const bandMat = new THREE.MeshStandardMaterial({ color: BAND_COLORS[band ?? 'M'], roughness: 0.5, emissive: BAND_COLORS[band ?? 'M'], emissiveIntensity: 0.15 })
    // Un cylindre par tronçon d'élastique (entre deux points de passage)
    const bands = (anim.bands ?? []).map((b) => Array.from({ length: (b.via?.length ?? 0) + 1 }, () => shadowed(new THREE.Mesh(cyl, bandMat))))
    const joints = (anim.bands ?? []).map((b) => Array.from({ length: b.via?.length ?? 0 }, () => shadowed(new THREE.Mesh(ball, bandMat))))
    const markPts = buildMarks(anim, cx, scene)
    const anchors = (anim.bands ?? []).filter((b) => Array.isArray(b.from)).map(() => {
      const m = new THREE.Mesh(ball, new THREE.MeshStandardMaterial({ color: '#94a3b8' }))
      m.scale.setScalar(2.6)
      scene.add(m)
      return m
    })

    // Cadrage : boîte englobante de tout le mouvement
    const bb = new THREE.Box3()
    const total = cycleLength(anim)
    for (let i = 0; i < 16; i++) {
      const j = skeleton3d(anim, poseAt(anim, (total * i) / 16))
      for (const [k, v] of Object.entries(j)) if (k !== 'face' && Array.isArray(v) && v.length === 3) bb.expandByPoint(tmpA.set(...(v as V3)))
    }
    for (const p of markPts) bb.expandByPoint(tmpA.set(...p))
    const center = bb.getCenter(new THREE.Vector3())
    const size = bb.getSize(new THREE.Vector3()).length()
    const camera = new THREE.PerspectiveCamera(32, 4 / 3, 5, 2000)
    const controls = new OrbitControls(camera, renderer.domElement)
    controls.target.copy(center)
    controls.enableDamping = true
    controls.enablePan = false
    controls.minDistance = size * 0.8
    controls.maxDistance = size * 3
    controls.maxPolarAngle = Math.PI * 0.49
    const dist = size * 1.55 + 60
    const setCam = (az: number, el: number) => {
      const a = (az * Math.PI) / 180, e = (el * Math.PI) / 180
      camera.position.set(center.x + Math.sin(a) * Math.cos(e) * dist, center.y + Math.sin(e) * dist, center.z + Math.cos(a) * Math.cos(e) * dist)
      controls.update()
    }
    const def = cam ?? anim.cam ?? (anim.view === 'front' ? { az: 70, el: 12 } : { az: 35, el: 14 })
    setCam(def.az, def.el)
    api.current = {
      setView: (p) => {
        if (p === 'profil') setCam(0, 8)
        else if (p === 'face') setCam(90, 8)
        else if (p === 'dessus') setCam(def.az, 65)
        else setCam(35, 16)
      },
    }

    const resize = () => {
      const w = el.clientWidth, h = el.clientHeight
      renderer.setSize(w, h, false)
      camera.aspect = w / Math.max(1, h)
      camera.updateProjectionMatrix()
    }
    resize()
    const ro = new ResizeObserver(resize)
    ro.observe(el)

    const start = performance.now()
    let raf = 0
    const frame = (now: number) => {
      raf = requestAnimationFrame(frame)
      if (document.hidden) return
      const j = skeleton3d(anim, poseAt(anim, at ?? (now - start) / 1000))
      SEGS.forEach((s, i) => placeCylinder(segs[i], j[s.a] as V3, j[s.b] as V3))
      BALLS.forEach((b, i) => balls[i].position.set(...(j[b.j] as V3)))
      const upv = norm3(sub3(j.head, j.neck))
      orient(head, j.face, upv)
      head.position.set(...j.head)
      ;(['N', 'F'] as const).forEach((side, i) => {
        // Main : dans le prolongement de l'avant-bras, ou à plat (doigts vers l'avant) quand elle est en appui.
        const hand = j[`hand${side}`]
        let d = norm3(sub3(hand, j[`elbow${side}`]))
        const onSupport = d[1] < -0.4 && (hand[1] < 5 || beds.some((b) => Math.abs(hand[1] - b.y) < 6 && hand[0] >= b.x0 && hand[0] <= b.x1))
        if (onSupport) d = [1, 0, 0]
        hands[i].position.set(...add3(hand, mul3(d, 3.2)))
        hands[i].quaternion.setFromUnitVectors(UP, tmpA.set(...d))
        if (onSupport) hands[i].scale.set(1.9, 4.4, 3.2)
        else hands[i].scale.set(2.6, 4.4, 3)
        // Chaussure : du talon aux orteils, semelle du côté opposé au tibia.
        const ankle = j[`ankle${side}`]
        const fd = norm3(sub3(j[`toe${side}`], ankle))
        const shin = norm3(sub3(j[`knee${side}`], ankle))
        orient(shoes[i], fd, shin)
        shoes[i].position.set(...add3(add3(ankle, mul3(fd, 3.8)), mul3(shin, 0.6)))
        shoes[i].scale.set(7.6, 2.9, 3.6)
      })
      const front = anim.view === 'front'
      if (sac && anim.sac) {
        const c = resolve3(anim.sac, j, cx, front)
        sac.position.set(...c)
        // Sac posé sur le corps (dos, poitrine, hanches) : il suit l'inclinaison du buste. Tenu en main : il pend.
        const onBody = !Array.isArray(anim.sac) && !anim.sac.j.startsWith('hand')
        if (onBody && !front) {
          const up = norm3(sub3(j.neck, j.pelvis))
          orient(sac, [up[1], -up[0], 0], up)
        }
      }
      let ai = 0
      ;(anim.bands ?? []).forEach((b, i) => {
        const pts = [resolve3(b.from, j, cx, front, b.z ?? 0), ...(b.via ?? []).map((t) => resolve3(t, j, cx, front)), resolve3(b.to, j, cx, front)]
        bands[i].forEach((m, k) => {
          placeCylinder(m, pts[k], pts[k + 1])
          m.scale.x = m.scale.z = 1.5
        })
        joints[i].forEach((m, k) => { m.position.set(...pts[k + 1]); m.scale.setScalar(1.5) })
        if (Array.isArray(b.from)) anchors[ai++].position.set(...pts[0])
      })
      controls.update()
      renderer.render(scene, camera)
    }
    raf = requestAnimationFrame(frame)

    return () => {
      cancelAnimationFrame(raf)
      ro.disconnect()
      controls.dispose()
      scene.traverse((o) => {
        const m = o as THREE.Mesh
        m.geometry?.dispose()
        const mats = Array.isArray(m.material) ? m.material : m.material ? [m.material] : []
        mats.forEach((x) => x.dispose())
      })
      renderer.dispose()
      renderer.domElement.remove()
    }
  }, [id, band, at, cam?.az, cam?.el])

  if (failed) return null
  return (
    <div className={`fig3d ${className ?? ''}`}>
      <div ref={ref} className="fig3d-canvas" />
      <div className="fig3d-views">
        {(['profil', '3/4', 'face', 'dessus'] as CamPreset[]).map((p) => (
          <button key={p} className={view === p ? 'on' : ''} onClick={() => { setView(p); api.current?.setView(p) }}>{p}</button>
        ))}
      </div>
      <div className="fig3d-hint">↻ glisse pour tourner</div>
    </div>
  )
}

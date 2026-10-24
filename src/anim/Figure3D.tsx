import { useEffect, useRef, useState } from 'react'
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { ANIMS } from './anims'
import { BAND_COLORS } from './Figure'
import { cycleLength, FLOOR, poseAt, type AnimDef, type Target } from './rig'
import { skeleton3d, type Joints3, type V3 } from './skeleton3d'
import type { Band } from '../types'
import type { Work } from '../data/muscles'
import { buildMuscles } from './muscles3d'

// Écorché : « squelette » gris, muscles posés dessus (voir muscles3d.ts).
const BODY = '#5d687e'
const BODY_FAR = '#4f596d'
const HEAD = '#cfd6e1'
const SCENE = '#243046'
const SCENE_HI = '#33415a'

type Seg = { a: keyof Joints3; b: keyof Joints3; r: number; far?: boolean }
const SEGS: Seg[] = [
  { a: 'pelvis', b: 'spineMid', r: 7.4 },
  { a: 'spineMid', b: 'neck', r: 7.6 },
  { a: 'shoulderN', b: 'shoulderF', r: 4.5 },
  { a: 'hipN', b: 'hipF', r: 6 },
  { a: 'neck', b: 'head', r: 3.4 },
  { a: 'shoulderN', b: 'elbowN', r: 3 }, { a: 'elbowN', b: 'handN', r: 2.5 },
  { a: 'shoulderF', b: 'elbowF', r: 3, far: true }, { a: 'elbowF', b: 'handF', r: 2.5, far: true },
  { a: 'hipN', b: 'kneeN', r: 4.4 }, { a: 'kneeN', b: 'ankleN', r: 3.2 }, { a: 'ankleN', b: 'toeN', r: 2.8 },
  { a: 'hipF', b: 'kneeF', r: 4.4, far: true }, { a: 'kneeF', b: 'ankleF', r: 3.2, far: true }, { a: 'ankleF', b: 'toeF', r: 2.8, far: true },
]
const BALLS: { j: keyof Joints3; r: number; far?: boolean }[] = [
  { j: 'elbowN', r: 3 }, { j: 'handN', r: 3.4 }, { j: 'kneeN', r: 4.4 }, { j: 'ankleN', r: 3.2 },
  { j: 'elbowF', r: 3, far: true }, { j: 'handF', r: 3.4, far: true }, { j: 'kneeF', r: 4.4, far: true }, { j: 'ankleF', r: 3.2, far: true },
  { j: 'shoulderN', r: 4.5 }, { j: 'shoulderF', r: 4.5 }, { j: 'hipN', r: 6 }, { j: 'hipF', r: 6 }, { j: 'spineMid', r: 7.6 },
]

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

function resolve3(tg: Target, j: Joints3, cx: number, z = 0): V3 {
  if (Array.isArray(tg)) return [tg[0] - cx, FLOOR - tg[1], z]
  const base = j[tg.j]
  const o = tg.o ?? [0, 0]
  return [base[0] + o[0], base[1] - o[1], base[2]]
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

interface Props { anim: string; band?: Band; className?: string; work?: Work }

export default function Figure3D({ anim: id, band, className, work }: Props) {
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

    // Mannequin
    const near = new THREE.MeshStandardMaterial({ color: BODY, roughness: 0.55, metalness: 0.05 })
    const far = new THREE.MeshStandardMaterial({ color: BODY_FAR, roughness: 0.6, metalness: 0.05 })
    const cyl = new THREE.CylinderGeometry(1, 1, 1, 18)
    const ball = new THREE.SphereGeometry(1, 20, 14)
    const shadowed = <T extends THREE.Mesh>(m: T) => { m.castShadow = true; m.receiveShadow = true; scene.add(m); return m }
    const segs = SEGS.map((s) => {
      const m = shadowed(new THREE.Mesh(cyl, s.far ? far : near))
      m.userData.r = s.r
      return m
    })
    const balls = BALLS.map((b) => {
      const m = shadowed(new THREE.Mesh(ball, b.far ? far : near))
      m.scale.setScalar(b.r)
      return m
    })
    const muscles = buildMuscles(work, shadowed)
    const head = shadowed(new THREE.Mesh(ball, new THREE.MeshStandardMaterial({ color: HEAD, roughness: 0.55 })))
    head.scale.setScalar(9.2)
    const nose = shadowed(new THREE.Mesh(ball, new THREE.MeshStandardMaterial({ color: '#60a5fa', roughness: 0.4 })))
    nose.scale.setScalar(2.6)
    const sac = anim.sac ? shadowed(new THREE.Mesh(new THREE.BoxGeometry(16, 19, 11), new THREE.MeshStandardMaterial({ color: '#3f526e', roughness: 0.8 }))) : undefined
    const bandMat = new THREE.MeshStandardMaterial({ color: BAND_COLORS[band ?? 'M'], roughness: 0.5, emissive: BAND_COLORS[band ?? 'M'], emissiveIntensity: 0.15 })
    const bands = (anim.bands ?? []).map(() => shadowed(new THREE.Mesh(cyl, bandMat)))
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
    const def = anim.cam ?? (anim.view === 'front' ? { az: 70, el: 12 } : { az: 35, el: 14 })
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
      const j = skeleton3d(anim, poseAt(anim, (now - start) / 1000))
      SEGS.forEach((s, i) => {
        placeCylinder(segs[i], j[s.a] as V3, j[s.b] as V3)
        segs[i].scale.x = segs[i].scale.z = s.r
      })
      BALLS.forEach((b, i) => balls[i].position.set(...(j[b.j] as V3)))
      muscles(j)
      head.position.set(...j.head)
      nose.position.set(j.head[0] + j.face[0] * 8.3, j.head[1] + j.face[1] * 8.3, j.head[2] + j.face[2] * 8.3)
      if (sac && anim.sac) {
        const c = resolve3(anim.sac, j, cx)
        sac.position.set(...c)
      }
      let ai = 0
      ;(anim.bands ?? []).forEach((b, i) => {
        const p = resolve3(b.from, j, cx, b.z ?? 0)
        const q = resolve3(b.to, j, cx)
        placeCylinder(bands[i], p, q)
        bands[i].scale.x = bands[i].scale.z = 1.5
        if (Array.isArray(b.from)) anchors[ai++].position.set(...p)
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
  }, [id, band, work])

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

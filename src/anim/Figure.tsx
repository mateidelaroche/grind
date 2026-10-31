import { useEffect, useMemo, useRef, useState } from 'react'
import { ANIMS } from './anims'
import { add, along, dir, FLOOR, fmtCm, mul, poseAt, resolveTarget, skeleton, sub, viewBox, type AnimDef, type Mark, type Skeleton, type V } from './rig'
import type { Band } from '../types'

export const BAND_COLORS: Record<Band, string> = { L: '#3b82f6', M: '#facc15', F: '#f97316' }
const BAND_NAMES: Record<Band, string> = { L: 'bleu', M: 'jaune', F: 'orange' }
export const bandName = (b: Band) => BAND_NAMES[b]

const vbCache = new Map<string, [number, number, number, number]>()
function getViewBox(id: string, anim: AnimDef) {
  let vb = vbCache.get(id)
  if (!vb) { vb = viewBox(anim); vbCache.set(id, vb) }
  return vb
}

const pt = (p: V) => `${p[0].toFixed(1)},${p[1].toFixed(1)}`

/** Contour fermé lissé (Catmull-Rom) passant par tous les points. */
function smooth(pts: V[]): string {
  const n = pts.length
  let d = `M${pt(pts[0])}`
  for (let i = 0; i < n; i++) {
    const p0 = pts[(i - 1 + n) % n], p1 = pts[i], p2 = pts[(i + 1) % n], p3 = pts[(i + 2) % n]
    d += `C${pt(add(p1, mul(sub(p2, p0), 1 / 6)))} ${pt(sub(p2, mul(sub(p3, p1), 1 / 6)))} ${pt(p2)}`
  }
  return d + 'Z'
}

/** Profil d'un segment : [position le long de l'os (0 → 1), demi-largeur d'un côté, de l'autre (par défaut la même)]. */
type Prof = [number, number, number?][]

/** Forme galbée d'un segment p → q, bouts arrondis. bow : courbure vers le second côté. */
function shape(p: V, q: V, prof: Prof, bow = 0): string {
  const v = sub(q, p)
  const len = Math.hypot(v[0], v[1]) || 1
  const u = mul(v, 1 / len)
  const n: V = [-u[1], u[0]]
  const at = (t: number) => add(add(p, mul(v, t)), mul(n, -bow * 2 * t * (1 - t)))
  const left = prof.map(([t, a]) => add(at(t), mul(n, a)))
  const right = prof.map(([t, a, b]) => add(at(t), mul(n, -(b ?? a)))).reverse()
  const t0 = prof[0], t1 = prof[prof.length - 1]
  const tip = (t: number, r: number, k: number) => add(at(t), mul(u, k * r * 0.92))
  return smooth([
    ...left,
    tip(t1[0], Math.min(t1[1], t1[2] ?? t1[1]), 1),
    ...right,
    tip(t0[0], Math.min(t0[1], t0[2] ?? t0[1]), -1),
  ])
}

// Galbes (demi-largeurs) pour une morphologie fine, en unités du squelette.
const THIGH: Prof = [[0, 6.2], [0.18, 6.4], [0.55, 5.4], [0.88, 4.4], [1, 4.3]]
const SHIN: Prof = [[0, 4.2], [0.22, 4.9, 4.2], [0.45, 4.3, 3.6], [0.85, 2.8], [1, 2.7]]
const UPPER_ARM: Prof = [[0, 4.6], [0.3, 4.2], [0.65, 3.8], [1, 3.2]]
const FOREARM: Prof = [[0, 3.3], [0.25, 3.6], [0.7, 2.8], [1, 2.4]]
const NECK: Prof = [[0, 3.6], [0.75, 3.2]]
// Tronc de profil, du bassin à la base du cou : [t, devant (ventre, poitrine), derrière (fesses, dos)].
const TORSO_SIDE: Prof = [[-0.1, 5, 6.5], [0.04, 6.2, 8.2], [0.28, 6, 6.4], [0.5, 6.2, 6], [0.72, 8.2, 7], [0.9, 7.2, 6.8], [1.03, 4.2, 4.6]]
// Tronc de face : hanches, taille, poitrine, épaules.
const TORSO_FRONT: Prof = [[-0.08, 9.5], [0.08, 10.5], [0.42, 8.6], [0.75, 10.8], [0.93, 11.6], [1.03, 4.5]]

/** Pied : talon, cou-de-pied, orteils ; la semelle est du côté f + 90°. */
function footPath(ankle: V, f: number, front: boolean): string {
  const u = dir(f), n = dir(f + 90)
  const P = (a: number, b: number) => add(add(ankle, mul(u, a)), mul(n, b))
  if (front) return smooth([P(-1.5, -2.5), P(4, -2.2), P(5.5, 1.2), P(1, 2.4), P(-3, 1.6)])
  return smooth([P(-3.5, 2), P(-4, -0.8), P(-1, -3.4), P(5, -2.2), P(11, -0.6), P(12, 1.2), P(8, 2.2), P(1, 2.3)])
}

/** Tête : crâne avec menton et nez du côté du visage (le personnage regarde vers la droite), cheveux. */
function Head({ sk, front, color, hair }: { sk: Skeleton; front: boolean; color: string; hair: string }) {
  const c = sk.head
  const up = sub(c, sk.neck)
  const a = (Math.atan2(up[1], up[0]) * 180) / Math.PI
  // P(vers le sommet, vers le visage)
  const P = (x: number, y: number) => add(add(c, mul(dir(a), x)), mul(dir(a + 90), y))
  const skull = front
    ? smooth([P(9, 0), P(6.5, 7.2), P(-1, 7.4), P(-7.2, 4.2), P(-8.8, 0), P(-7.2, -4.2), P(-1, -7.4), P(6.5, -7.2)])
    : smooth([P(9.2, 0), P(6.8, 7.4), P(1, 8.2), P(-1.4, 9.6), P(-4, 7.9), P(-6.6, 7.4), P(-8.8, 3), P(-7.8, -2), P(-3, -6.8), P(4, -8)])
  const cut = front
    ? smooth([P(9.7, 0), P(7.7, 7.8), P(3.6, 7.9), P(5.6, 3.4), P(6, -3.4), P(3.6, -7.9), P(7.7, -7.8)])
    : smooth([P(9.9, 0.4), P(8, 6.6), P(5.2, 6.9), P(3.8, 2.6), P(0.8, 0.6), P(-2.2, -4), P(-3.2, -7.8), P(2.6, -9), P(7.6, -6.3)])
  return (
    <g>
      <path d={skull} fill={color} stroke={EDGE} strokeWidth={2.2} paintOrder="stroke" />
      <path d={cut} fill={hair} />
    </g>
  )
}

const EDGE = 'var(--fig-edge)'

/** Formes d'un membre : liseré sur la silhouette d'ensemble seulement, pas aux articulations. */
function Part({ d, color }: { d: string[]; color: string }) {
  return (
    <g>
      {d.map((x, i) => <path key={'e' + i} d={x} fill={color} stroke={EDGE} strokeWidth={2.2} strokeLinejoin="round" />)}
      {d.map((x, i) => <path key={i} d={x} fill={color} />)}
    </g>
  )
}

const joint = (sk: Skeleton, k: string, side: 'N' | 'F') => (sk as unknown as Record<string, V>)[k + side]

function Torso({ sk, color }: { sk: Skeleton; color: string }) {
  if (sk.view === 'front') return <Part d={[shape(sk.pelvis, sk.neck, TORSO_FRONT), shape(sk.neck, sk.head, NECK)]} color={color} />
  return <Part d={[shape(sk.neck, sk.head, NECK), shape(sk.pelvis, sk.neck, TORSO_SIDE, sk.c)]} color={color} />
}

function Leg({ sk, side, color }: { sk: Skeleton; side: 'N' | 'F'; color: string }) {
  const g = (k: string) => joint(sk, k, side)
  const f = (side === 'N' ? sk.fN : sk.fF) ?? 0
  return <Part d={[shape(g('hip'), g('knee'), THIGH), shape(g('knee'), g('ankle'), SHIN), footPath(g('ankle'), f, sk.view === 'front')]} color={color} />
}

/** Hauteurs des appuis (sol, dessus du lit) sous un point x. */
const supports = (anim: AnimDef, x: number) => [
  FLOOR,
  ...(anim.scene ?? []).flatMap((s) => (s.k === 'bed' && x >= s.x && x <= s.x + s.w ? [FLOOR - (s.h ?? 36)] : [])),
]

function Arm({ sk, side, color, anim }: { sk: Skeleton; side: 'N' | 'F'; color: string; anim: AnimDef }) {
  const g = (k: string) => joint(sk, k, side)
  const fa = sub(g('hand'), g('elbow'))
  // Main en appui (sol, lit) : à plat, doigts vers l'avant. Sinon dans le prolongement de l'avant-bras.
  const flat = sk.view === 'side' && fa[1] > 0 && supports(anim, g('hand')[0]).some((y) => Math.abs(g('hand')[1] - y) < 6)
  const a = flat ? 0 : (Math.atan2(fa[1], fa[0]) * 180) / Math.PI
  const hand = shape(along(g('hand'), a, -1), along(g('hand'), a, 6.5), [[0, 2.6], [0.4, 3.1], [1, 2.2]])
  return <Part d={[shape(g('shoulder'), g('elbow'), UPPER_ARM), shape(g('elbow'), g('hand'), FOREARM), hand]} color={color} />
}

function Scene({ anim, vb }: { anim: AnimDef; vb: number[] }) {
  return (
    <g>
      {(anim.scene ?? []).map((s, i) => {
        if (s.k === 'bed') {
          const h = s.h ?? 36
          return (
            <g key={i}>
              <rect x={s.x} y={FLOOR - h} width={s.w} height={h - 6} rx={3} fill="var(--scene)" />
              <rect x={s.x} y={FLOOR - h} width={s.w} height={7} rx={3} fill="var(--scene-hi)" />
              <rect x={s.x + 2} y={FLOOR - 7} width={4} height={7} fill="var(--scene)" />
              <rect x={s.x + s.w - 6} y={FLOOR - 7} width={4} height={7} fill="var(--scene)" />
            </g>
          )
        }
        if (s.k === 'door') return <rect key={i} x={s.x - 2} y={vb[1] - 5} width={5} height={FLOOR - vb[1] + 5} fill="var(--scene-hi)" />
        if (s.k === 'wall') return <rect key={i} x={s.x - 3} y={vb[1] - 5} width={6} height={FLOOR - vb[1] + 5} fill="var(--scene)" />
        return (
          <g key={i}>
            {[0, 1, 2].map((j) => (
              <rect key={j} x={s.x + (j % 2) * 2} y={FLOOR - s.h + (j * s.h) / 3} width={s.w - 2} height={s.h / 3 - 0.6} rx={0.8} fill={j === 1 ? 'var(--scene-hi)' : 'var(--scene)'} />
            ))}
          </g>
        )
      })}
    </g>
  )
}

/** Étiquette de mesure (pastille sombre, lisible sur la scène). */
function Tag({ x, y, text }: { x: number; y: number; text: string }) {
  const w = text.length * 3.3 + 6
  return (
    <g>
      <rect x={x - w / 2} y={y - 5} width={w} height={10} rx={3} fill="var(--mark-bg)" stroke="var(--mark)" strokeWidth={0.6} />
      <text x={x} y={y + 2.4} textAnchor="middle" fontSize={6.6} fontWeight={700} fill="var(--mark)">{text}</text>
    </g>
  )
}

/** Repères chiffrés : hauteur d'ancrage, distance au sol (en cm pour un personnage de 1 m 88). */
/** tags : seulement les étiquettes (dessinées par-dessus le personnage), sinon seulement les traits. */
function Marks({ marks, tags }: { marks: Mark[]; tags?: boolean }) {
  return (
    <g>
      {marks.map((m, i) => {
        const label = (v: number) => `${fmtCm(v)}${m.note ? ` · ${m.note}` : ''}`
        if ('h' in m) {
          const [x, y] = m.h
          if (tags) return <Tag key={i} x={x} y={y - 8} text={label(FLOOR - y)} />
          return (
            <g key={i}>
              <line x1={x} x2={x} y1={FLOOR} y2={y} stroke="var(--mark)" strokeWidth={0.8} strokeDasharray="2.5 2" />
              <line x1={x - 3} x2={x + 3} y1={y} y2={y} stroke="var(--mark)" strokeWidth={0.8} />
            </g>
          )
        }
        const [a, b] = m.d
        const y = FLOOR - 3
        if (tags) return <Tag key={i} x={(a + b) / 2} y={y - 7} text={label(Math.abs(b - a))} />
        return (
          <g key={i}>
            <line x1={a} x2={b} y1={y} y2={y} stroke="var(--mark)" strokeWidth={0.8} strokeDasharray="2.5 2" />
            <line x1={a} x2={a} y1={y - 2.5} y2={y + 2.5} stroke="var(--mark)" strokeWidth={0.8} />
            <line x1={b} x2={b} y1={y - 2.5} y2={y + 2.5} stroke="var(--mark)" strokeWidth={0.8} />
          </g>
        )
      })}
    </g>
  )
}

interface Props {
  anim: string
  band?: Band
  playing?: boolean
  /** Affiche une pose clé fixe (aperçus). */
  keyIndex?: number
  /** Repères de mesure (par défaut : seulement sur l'animation qui joue, pas sur les vignettes). */
  marks?: boolean
  className?: string
}

export default function Figure({ anim: id, band, playing = true, keyIndex, className, marks }: Props) {
  const anim = ANIMS[id]
  const [time, setTime] = useState(0)
  const raf = useRef(0)

  useEffect(() => {
    if (!anim || !playing) return
    const start = performance.now() - time * 1000
    const loop = (now: number) => {
      setTime((now - start) / 1000)
      raf.current = requestAnimationFrame(loop)
    }
    raf.current = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(raf.current)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [anim, playing])

  const vb = useMemo(() => (anim ? getViewBox(id, anim) : [0, 0, 200, 150]), [id, anim])
  if (!anim) return <div className={className} />

  const pose = keyIndex !== undefined ? anim.keys[keyIndex % anim.keys.length] : poseAt(anim, playing ? time : 0)
  const sk = skeleton(pose, anim.view)
  const front = anim.view === 'front'
  const near = 'var(--fig)'
  const far = front ? 'var(--fig)' : 'var(--fig-far)'
  const bandColor = BAND_COLORS[band ?? 'M']
  const showMarks = !!anim.marks && (marks ?? (playing && keyIndex === undefined))

  return (
    <svg className={className} viewBox={vb.join(' ')} role="img" aria-label="Démonstration du mouvement">
      {!anim.noFloor && <line x1={vb[0]} x2={vb[0] + vb[2]} y1={FLOOR} y2={FLOOR} stroke="var(--floor)" strokeWidth={2} />}
      <Scene anim={anim} vb={vb} />
      {showMarks && <Marks marks={anim.marks!} />}
      <Leg sk={sk} side="F" color={far} />
      <Arm sk={sk} side="F" color={far} anim={anim} />
      <Torso sk={sk} color={near} />
      <Head sk={sk} front={front} color={near} hair="var(--hair)" />
      {anim.sac && (() => {
        const c = resolveTarget(anim.sac, sk)
        return <rect x={c[0] - 7} y={c[1] - 8} width={14} height={16} rx={3.5} fill="var(--sac)" stroke="var(--sac-hi)" strokeWidth={1.5} />
      })()}
      <Leg sk={sk} side="N" color={near} />
      <Arm sk={sk} side="N" color={near} anim={anim} />
      {(anim.bands ?? []).map((b, i) => {
        const pts = [b.from, ...(b.via ?? []), b.to].map((t) => resolveTarget(t, sk))
        const p = pts[0]
        return (
          <g key={i}>
            <polyline points={pts.map(pt).join(' ')} fill="none" stroke={bandColor} strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" />
            {Array.isArray(b.from) && <circle cx={p[0]} cy={p[1]} r={3} fill="var(--anchor)" />}
          </g>
        )
      })}
      {showMarks && <Marks marks={anim.marks!} tags />}
    </svg>
  )
}

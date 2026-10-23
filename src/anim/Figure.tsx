import { useEffect, useMemo, useRef, useState } from 'react'
import { ANIMS } from './anims'
import { add, along, FLOOR, L, mul, poseAt, resolveTarget, skeleton, viewBox, type AnimDef, type Skeleton, type V } from './rig'
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

function Torso({ sk, color }: { sk: Skeleton; color: string }) {
  if (sk.view === 'front') {
    const o = 2.5
    return (
      <polygon
        points={[sk.shoulderN, sk.shoulderF, sk.hipF, sk.hipN].map(pt).join(' ')}
        fill={color} stroke={color} strokeWidth={o * 3} strokeLinejoin="round"
      />
    )
  }
  const a = sk.pelvis, b = sk.neck
  const mid: V = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2]
  // c > 0 : dos rond (bombé côté dos), c < 0 : dos creux
  const ctl = add(mid, mul(along([0, 0], sk.t - 90, 1), sk.c))
  return <path d={`M${pt(a)} Q${pt(ctl)} ${pt(b)}`} stroke={color} strokeWidth={12} fill="none" strokeLinecap="round" />
}

function Limbs({ sk, side, color }: { sk: Skeleton; side: 'N' | 'F'; color: string }) {
  const g = (k: string) => (sk as unknown as Record<string, V>)[k + side]
  const line = (p: V, q: V, w: number) => (
    <line x1={p[0]} y1={p[1]} x2={q[0]} y2={q[1]} stroke={color} strokeWidth={w} strokeLinecap="round" />
  )
  return (
    <g>
      {line(g('hip'), g('knee'), 8)}
      {line(g('knee'), g('ankle'), 7)}
      {line(g('ankle'), g('toe'), 5)}
      {line(g('shoulder'), g('elbow'), 7)}
      {line(g('elbow'), g('hand'), 6)}
    </g>
  )
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

interface Props {
  anim: string
  band?: Band
  playing?: boolean
  /** Affiche une pose clé fixe (aperçus). */
  keyIndex?: number
  className?: string
}

export default function Figure({ anim: id, band, playing = true, keyIndex, className }: Props) {
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

  return (
    <svg className={className} viewBox={vb.join(' ')} role="img" aria-label="Démonstration du mouvement">
      {!anim.noFloor && <line x1={vb[0]} x2={vb[0] + vb[2]} y1={FLOOR} y2={FLOOR} stroke="var(--floor)" strokeWidth={2} />}
      <Scene anim={anim} vb={vb} />
      <Limbs sk={sk} side="F" color={far} />
      <Torso sk={sk} color={near} />
      <circle cx={sk.head[0]} cy={sk.head[1]} r={L.head} fill={near} />
      {anim.sac && (() => {
        const c = resolveTarget(anim.sac, sk)
        return <rect x={c[0] - 7} y={c[1] - 8} width={14} height={16} rx={3.5} fill="var(--sac)" stroke="var(--sac-hi)" strokeWidth={1.5} />
      })()}
      <Limbs sk={sk} side="N" color={near} />
      {(anim.bands ?? []).map((b, i) => {
        const p = resolveTarget(b.from, sk)
        const q = resolveTarget(b.to, sk)
        return (
          <g key={i}>
            <line x1={p[0]} y1={p[1]} x2={q[0]} y2={q[1]} stroke={bandColor} strokeWidth={3} strokeLinecap="round" />
            {Array.isArray(b.from) && <circle cx={p[0]} cy={p[1]} r={3} fill="var(--anchor)" />}
          </g>
        )
      })}
    </svg>
  )
}

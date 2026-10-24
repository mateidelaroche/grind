// Carte des muscles 2D : corps de face et de dos, muscles travaillés en couleur.
import type { ReactNode } from 'react'
import { MUSCLE_LABEL, type Muscle, type Work } from '../data/muscles'
import { MUSCLE_PRIMARY, MUSCLE_SECONDARY } from '../anim/muscles3d'

const BASE = '#2b3648'
const IDLE = '#4a5670'

type Shape = { m: Muscle; d: ReactNode }
const mirror = (el: (sx: (x: number) => number) => ReactNode, m: Muscle, key: string): Shape[] => [
  { m, d: <g key={key + 'l'}>{el((x) => x)}</g> },
  { m, d: <g key={key + 'r'}>{el((x) => 120 - x)}</g> },
]
const ell = (cx: number, cy: number, rx: number, ry: number, rot = 0) => (sx: (x: number) => number) => {
  const x = sx(cx)
  const a = sx(cx) === cx ? rot : -rot
  return <ellipse cx={x} cy={cy} rx={rx} ry={ry} transform={rot ? `rotate(${a} ${x} ${cy})` : undefined} />
}
const path = (pts: [number, number][]) => (sx: (x: number) => number) => (
  <path d={`M${pts.map(([x, y]) => `${sx(x)},${y}`).join(' L')} Z`} strokeLinejoin="round" />
)

const FRONT: Shape[] = [
  ...mirror(ell(33, 47, 8.5, 9.5), 'epaules', 'de'),
  ...mirror(path([[59, 44], [48, 42], [40, 47], [39, 56], [46, 64], [59, 64]]), 'pecs', 'pe'),
  ...[68, 80, 92].flatMap((y, i) => mirror((sx) => <rect x={Math.min(sx(52), sx(59))} y={y} width={7} height={10} rx={2.5} />, 'abdos', 'ab' + i)),
  ...mirror(path([[44, 68], [41, 82], [43, 98], [48, 108], [51, 104], [50, 86], [51, 68]]), 'obliques', 'ob'),
  ...mirror(ell(30, 68, 5, 12, 8), 'biceps', 'bi'),
  ...mirror(ell(25, 95, 4.6, 13, 10), 'avantbras', 'ab'),
  ...mirror(ell(50, 148, 8.5, 23, -3), 'quadriceps', 'qu'),
  ...mirror(ell(48.5, 192, 3.8, 14), 'tibias', 'ti'),
]
const BACK: Shape[] = [
  ...mirror(path([[60, 34], [47, 44], [44, 50], [52, 58], [60, 80]]), 'trapezes', 'tr'),
  ...mirror(ell(33, 47, 8.5, 9.5), 'epaules', 'de'),
  ...mirror(path([[52, 60], [43, 54], [40, 66], [44, 86], [53, 100], [58, 96], [58, 74]]), 'dorsaux', 'do'),
  ...mirror(ell(55.5, 98, 3.6, 11), 'lombaires', 'lo'),
  ...mirror(ell(30, 68, 5.4, 12.5, 8), 'triceps', 'tr'),
  ...mirror(ell(25, 95, 4.6, 13, 10), 'avantbras', 'ab'),
  ...mirror(ell(50.5, 124, 9.5, 9.5), 'fessiers', 'fe'),
  ...mirror(ell(50, 155, 8, 19, -3), 'ischios', 'is'),
  ...mirror(ell(48.5, 188, 5.6, 12.5), 'mollets', 'mo'),
]

function Body() {
  return (
    <g fill={BASE} stroke={BASE} strokeLinecap="round">
      <circle cx={60} cy={18} r={11} stroke="none" />
      <rect x={54} y={26} width={12} height={12} stroke="none" />
      <path d="M36,40 L84,40 L80,72 L78,110 L81,130 L39,130 L42,110 L40,72 Z" strokeWidth={6} strokeLinejoin="round" />
      {[1, -1].map((k) => {
        const x = (v: number) => (k === 1 ? v : 120 - v)
        return (
          <g key={k} fill="none">
            <polyline points={`${x(33)},44 ${x(29)},80 ${x(24)},108`} strokeWidth={10} />
            <circle cx={x(23)} cy={113} r={4.5} fill={BASE} stroke="none" />
            <polyline points={`${x(50)},128 ${x(49)},174 ${x(48.5)},210`} strokeWidth={15} />
            <path d={`M${x(48.5)},212 L${x(42)},216`} strokeWidth={6} />
          </g>
        )
      })}
    </g>
  )
}

function Side({ shapes, work, label }: { shapes: Shape[]; work: Work; label: string }) {
  const fill = (m: Muscle) => (work.p.includes(m) ? MUSCLE_PRIMARY : work.s.includes(m) ? MUSCLE_SECONDARY : IDLE)
  return (
    <figure className="mmap-side">
      <svg viewBox="0 0 120 222" role="img" aria-label={label}>
        <Body />
        {shapes.map((s, i) => <g key={i} fill={fill(s.m)} stroke="#0d121c" strokeWidth={0.8}>{s.d}</g>)}
      </svg>
      <figcaption>{label}</figcaption>
    </figure>
  )
}

export default function MuscleMap({ work, compact }: { work: Work; compact?: boolean }) {
  if (!work.p.length && !work.s.length) return null
  return (
    <div className={`mmap ${compact ? 'compact' : ''}`}>
      <div className="mmap-figs">
        <Side shapes={FRONT} work={work} label="Face" />
        <Side shapes={BACK} work={work} label="Dos" />
      </div>
      <div className="mmap-legend">
        {work.p.map((m) => <span key={m} className="chip"><span className="dot" style={{ background: MUSCLE_PRIMARY }} />{MUSCLE_LABEL[m]}</span>)}
        {work.s.map((m) => <span key={m} className="chip"><span className="dot" style={{ background: MUSCLE_SECONDARY }} />{MUSCLE_LABEL[m]}</span>)}
      </div>
      {!compact && <div className="tiny muted">🔴 muscles principaux · 🟠 secondaires</div>}
    </div>
  )
}

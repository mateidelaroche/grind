// Planche d'anatomie 2D : face et dos, ~25 zones, fibres dessinées. Deux usages :
// - work : rôle de chaque muscle dans un exercice / une séance (principal, secondaire, stabilisateur) ;
// - heat : séries de la semaine par muscle (échelle d'une seule teinte).
import { useId, useState } from 'react'
import { MUSCLE_LABEL, type Muscle, type Work } from '../data/muscles'

export const MUSCLE_PRIMARY = '#ef4444'
export const MUSCLE_SECONDARY = '#fb923c'
export const MUSCLE_STAB = '#fde047'

const BASE = '#28324a'
const IDLE = '#4d5972'
const OUTLINE = '#0d121c'

type P = [number, number]

/** Courbe fermée lissée (Catmull-Rom → Bézier) passant par les points. */
function smooth(pts: P[], closed = true) {
  const n = pts.length
  const at = (i: number) => pts[closed ? (i + n) % n : Math.max(0, Math.min(n - 1, i))]
  let d = `M${pts[0][0]},${pts[0][1]}`
  for (let i = 0; i < (closed ? n : n - 1); i++) {
    const p0 = at(i - 1), p1 = at(i), p2 = at(i + 1), p3 = at(i + 2)
    const c1: P = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6]
    const c2: P = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6]
    d += ` C${c1[0].toFixed(1)},${c1[1].toFixed(1)} ${c2[0].toFixed(1)},${c2[1].toFixed(1)} ${p2[0]},${p2[1]}`
  }
  return closed ? d + 'Z' : d
}
const flip = (pts: P[]): P[] => pts.map(([x, y]) => [200 - x, y])

// ───────────── Silhouette (moitié gauche, du cou au pied, puis symétrie) ─────────────
const HALF: P[] = [
  [91, 50], [90, 60], [78, 66], [64, 71], [54, 79], [48, 93], [46, 110], [44, 130], [43, 148], [42, 157],
  [40, 172], [38, 192], [36, 212], [35, 222], [33, 234], [35, 247], [40, 251], [44, 241], [45, 227], [47, 216],
  [51, 190], [56, 166], [58, 153], [62, 130], [67, 112], [72, 108], [74, 130], [76, 160], [74, 184], [70, 200],
  [67, 218], [66, 240], [68, 268], [72, 292], [73, 301], [70, 318], [72, 341], [78, 366], [81, 377], [77, 389],
  [86, 394], [94, 391], [92, 378], [90, 369], [88, 340], [90, 318], [92, 299], [94, 270], [97, 241], [100, 233],
]
const OUTLINE_D = smooth([...HALF, ...flip(HALF).reverse().slice(1, -1)])

interface Shape { m: Muscle; pts: P[]; fib?: number }

const FRONT: Shape[] = [
  { m: 'trapHaut', pts: [[90, 57], [84, 64], [68, 70], [77, 73], [90, 67]], fib: 65 },
  { m: 'deltLat', pts: [[59, 74], [50, 82], [47, 96], [50, 110], [54, 104], [55, 88]], fib: 10 },
  { m: 'deltAvant', pts: [[69, 74], [61, 76], [55, 87], [56, 101], [61, 108], [67, 98], [71, 84]], fib: 15 },
  { m: 'pecHaut', pts: [[98, 72], [86, 72], [73, 76], [69, 84], [75, 90], [98, 88]], fib: 75 },
  { m: 'pecBas', pts: [[98, 91], [75, 93], [69, 99], [71, 109], [81, 116], [92, 118], [98, 116]], fib: 95 },
  { m: 'dentele', pts: [[72, 112], [79, 115], [81, 121], [74, 120]], fib: 60 },
  { m: 'dentele', pts: [[73, 124], [80, 127], [82, 133], [75, 132]], fib: 60 },
  { m: 'dentele', pts: [[74, 136], [81, 139], [82, 145], [76, 144]], fib: 60 },
  { m: 'obliques', pts: [[76, 121], [84, 126], [86, 150], [87, 178], [88, 195], [80, 189], [74, 175], [76, 150]], fib: 35 },
  { m: 'abdos', pts: [[89, 122], [98, 121], [98, 137], [89, 138]] },
  { m: 'abdos', pts: [[89, 141], [98, 141], [98, 157], [89, 157]] },
  { m: 'abdos', pts: [[89, 160], [98, 160], [98, 176], [89, 176]] },
  { m: 'abdos', pts: [[90, 179], [98, 179], [98, 206], [94, 214]] },
  { m: 'flechisseurs', pts: [[80, 195], [88, 201], [95, 221], [90, 226], [82, 211]], fib: 25 },
  { m: 'biceps', pts: [[63, 108], [57, 114], [54, 132], [57, 148], [62, 140], [66, 120]], fib: 2 },
  { m: 'brachial', pts: [[53, 124], [48, 134], [48, 147], [53, 152], [55, 140]], fib: 5 },
  { m: 'avantbras', pts: [[58, 154], [49, 154], [43, 170], [40, 199], [42, 212], [47, 212], [52, 186], [58, 166]], fib: 8 },
  { m: 'adducteurs', pts: [[97, 236], [90, 241], [86, 258], [90, 274], [95, 262]], fib: 20 },
  { m: 'quadriceps', pts: [[77, 205], [70, 226], [68, 256], [72, 284], [80, 292], [86, 284], [88, 252], [90, 232], [85, 214]], fib: 4 },
  { m: 'vasteInterne', pts: [[88, 262], [84, 281], [88, 296], [94, 291], [93, 274]], fib: 30 },
  { m: 'tibias', pts: [[77, 306], [74, 326], [76, 350], [81, 364], [83, 340], [82, 312]], fib: 4 },
  { m: 'mollets', pts: [[86, 304], [90, 322], [89, 346], [85, 334]], fib: 2 },
]

const BACK: Shape[] = [
  { m: 'trapHaut', pts: [[92, 54], [100, 57], [100, 84], [86, 80], [70, 72], [62, 72], [78, 64]], fib: 70 },
  { m: 'milieuDos', pts: [[100, 85], [86, 82], [76, 86], [80, 100], [92, 122], [100, 138]], fib: 60 },
  { m: 'deltLat', pts: [[56, 74], [49, 82], [46, 96], [50, 110], [53, 100], [53, 86]], fib: 10 },
  { m: 'deltArr', pts: [[65, 74], [57, 78], [53, 92], [57, 104], [65, 96], [73, 84]], fib: 20 },
  { m: 'triceps', pts: [[63, 104], [55, 108], [51, 126], [52, 147], [58, 152], [64, 138], [66, 116]], fib: 2 },
  { m: 'avantbras', pts: [[58, 154], [49, 154], [43, 170], [40, 199], [42, 212], [47, 212], [52, 186], [58, 166]], fib: 8 },
  { m: 'grandDorsal', pts: [[74, 98], [81, 100], [92, 125], [100, 142], [100, 168], [92, 175], [82, 160], [76, 130]], fib: 140 },
  { m: 'lombaires', pts: [[92, 148], [99, 150], [99, 200], [90, 198], [88, 175]], fib: 0 },
  { m: 'moyenFessier', pts: [[74, 192], [86, 196], [92, 204], [80, 212], [70, 210]], fib: 70 },
  { m: 'fessiers', pts: [[72, 212], [84, 206], [98, 212], [99, 244], [88, 252], [74, 246], [68, 230]], fib: 125 },
  { m: 'ischios', pts: [[70, 252], [82, 256], [94, 256], [92, 276], [86, 294], [76, 294], [70, 272]], fib: 3 },
  { m: 'adducteurs', pts: [[97, 250], [94, 262], [92, 276], [97, 270]], fib: 15 },
  { m: 'mollets', pts: [[74, 302], [70, 322], [74, 346], [82, 350], [88, 330], [88, 306], [82, 298]], fib: 2 },
]

// Lignes de détail (tendons, séparations) dessinées par-dessus, en trait fin.
const FRONT_LINES: P[][] = [[[100, 72], [100, 214]], [[71, 236], [80, 268], [84, 286]]]
const BACK_LINES: P[][] = [[[100, 58], [100, 205]], [[81, 302], [81, 346]], [[82, 258], [81, 292]]]

const HEAT = [
  { min: 0.5, c: '#7c2d12', label: '1-3' },
  { min: 3.5, c: '#c2410c', label: '4-7' },
  { min: 7.5, c: '#f97316', label: '8-11' },
  { min: 11.5, c: '#fdba74', label: '12+' },
]
const heatColor = (v: number) => [...HEAT].reverse().find((h) => v >= h.min)?.c ?? IDLE

type Mode = { work: Work } | { heat: Record<Muscle, number> }

function roleOf(mode: Mode, m: Muscle) {
  if ('heat' in mode) {
    const v = mode.heat[m]
    return { color: heatColor(v), text: `${Math.round(v * 2) / 2} série${v > 1 ? 's' : ''} cette semaine` }
  }
  const w = mode.work
  if (w.p.includes(m)) return { color: MUSCLE_PRIMARY, text: 'principal' }
  if (w.s.includes(m)) return { color: MUSCLE_SECONDARY, text: 'secondaire' }
  if (w.st.includes(m)) return { color: MUSCLE_STAB, text: 'stabilisateur' }
  return { color: IDLE, text: 'peu sollicité' }
}

function Side({ shapes, lines, mode, label, uid, sel, onSel }: {
  shapes: Shape[]; lines: P[][]; mode: Mode; label: string; uid: string; sel?: Muscle; onSel: (m: Muscle) => void
}) {
  const angles = [...new Set(shapes.flatMap((s) => (s.fib === undefined ? [] : [s.fib, 180 - s.fib])))]
  return (
    <figure className="mmap-side">
      <svg viewBox="22 6 156 392" role="img" aria-label={label}>
        <defs>
          {angles.map((a) => (
            <pattern key={a} id={`${uid}f${a}`} width={2.6} height={2.6} patternUnits="userSpaceOnUse" patternTransform={`rotate(${a})`}>
              <line x1={0} y1={0} x2={0} y2={2.6} stroke="#000" strokeOpacity={0.22} strokeWidth={0.7} />
            </pattern>
          ))}
        </defs>
        <ellipse cx={100} cy={29} rx={15.5} ry={19.5} fill={BASE} />
        <path d={OUTLINE_D} fill={BASE} />
        {shapes.flatMap((s, i) =>
          ([['l', s.pts, s.fib], ['r', flip(s.pts), s.fib === undefined ? undefined : 180 - s.fib]] as const).map(([k, pts, fib]) => {
            const d = smooth(pts as P[])
            const { color } = roleOf(mode, s.m)
            const on = sel === s.m
            return (
              <g key={i + k} onClick={() => onSel(s.m)} style={{ cursor: 'pointer' }}>
                <path d={d} fill={color} stroke={on ? '#fff' : OUTLINE} strokeWidth={on ? 1.6 : 0.9} />
                {fib !== undefined && <path d={d} fill={`url(#${uid}f${fib})`} pointerEvents="none" />}
              </g>
            )
          }),
        )}
        <g fill="none" stroke={OUTLINE} strokeOpacity={0.55} strokeWidth={0.8} pointerEvents="none">
          {lines.flatMap((l, i) => [<path key={i + 'l'} d={smooth(l, false)} />, <path key={i + 'r'} d={smooth(flip(l), false)} />])}
        </g>
      </svg>
      <figcaption>{label}</figcaption>
    </figure>
  )
}

export default function MuscleMap(props: Mode & { compact?: boolean }) {
  const uid = useId().replace(/:/g, '')
  const [sel, setSel] = useState<Muscle>()
  const mode: Mode = 'heat' in props ? { heat: props.heat } : { work: props.work }
  if ('work' in mode && !mode.work.p.length && !mode.work.s.length && !mode.work.st.length) return null
  const chips = (list: Muscle[], color: string) =>
    list.map((m) => <button key={m} className={`chip ${sel === m ? 'on' : ''}`} onClick={() => setSel(sel === m ? undefined : m)}><span className="dot" style={{ background: color }} />{MUSCLE_LABEL[m]}</button>)

  return (
    <div className={`mmap ${props.compact ? 'compact' : ''}`}>
      <div className="mmap-figs">
        <Side shapes={FRONT} lines={FRONT_LINES} mode={mode} label="Face" uid={uid + 'a'} sel={sel} onSel={(m) => setSel(sel === m ? undefined : m)} />
        <Side shapes={BACK} lines={BACK_LINES} mode={mode} label="Dos" uid={uid + 'b'} sel={sel} onSel={(m) => setSel(sel === m ? undefined : m)} />
      </div>
      <div className="mmap-sel small">{sel ? <><b>{MUSCLE_LABEL[sel]}</b> · {roleOf(mode, sel).text}</> : <span className="muted">Touche un muscle pour voir son nom</span>}</div>
      {'work' in mode ? (
        <>
          <div className="mmap-legend">
            {chips(mode.work.p, MUSCLE_PRIMARY)}
            {chips(mode.work.s, MUSCLE_SECONDARY)}
            {!props.compact && chips(mode.work.st, MUSCLE_STAB)}
          </div>
          {!props.compact && (
            <div className="mmap-key tiny muted">
              <span><span className="dot" style={{ background: MUSCLE_PRIMARY }} /> principal</span>
              <span><span className="dot" style={{ background: MUSCLE_SECONDARY }} /> secondaire</span>
              <span><span className="dot" style={{ background: MUSCLE_STAB }} /> stabilisateur</span>
            </div>
          )}
        </>
      ) : (
        <div className="mmap-key tiny muted">
          <span>Séries / semaine :</span>
          <span><span className="dot" style={{ background: IDLE }} /> 0</span>
          {HEAT.map((h) => <span key={h.label}><span className="dot" style={{ background: h.c }} /> {h.label}</span>)}
        </div>
      )}
    </div>
  )
}

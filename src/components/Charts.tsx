import { useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { fromISO } from '../lib/program'

// Couleurs validées (thème sombre, surface #121826) : série 1 bleu, série 2 orange.
export const SERIES = ['#3987e5', '#d95926']
const GRID = '#232d40'
const AXIS = '#636f85'
const TEXT_2 = '#9aa5b8'

function useWidth() {
  const ref = useRef<HTMLDivElement>(null)
  const [w, setW] = useState(320)
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const ro = new ResizeObserver(() => setW(el.clientWidth))
    ro.observe(el)
    setW(el.clientWidth)
    return () => ro.disconnect()
  }, [])
  return [ref, w] as const
}

function niceTicks(min: number, max: number, count = 4) {
  if (min === max) { min -= 1; max += 1 }
  const raw = (max - min) / count
  const mag = 10 ** Math.floor(Math.log10(raw))
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= raw) ?? raw
  const lo = Math.floor(min / step) * step
  const hi = Math.ceil(max / step) * step
  const ticks = []
  for (let v = lo; v <= hi + step / 2; v += step) ticks.push(+v.toFixed(2))
  return ticks
}

const shortDate = (d: string) => fromISO(d).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })
const fmt = (v: number) => (Number.isInteger(v) ? `${v}` : v.toFixed(1)).replace('.', ',')

export interface Series { name: string; color: string; data: { x: string; y: number }[] }

export function LineChart({ series, unit, goal, height = 170 }: { series: Series[]; unit: string; goal?: { y: number; label: string }; height?: number }) {
  const [ref, w] = useWidth()
  const [hover, setHover] = useState<string>()
  const [table, setTable] = useState(false)
  const dates = [...new Set(series.flatMap((s) => s.data.map((d) => d.x)))].sort()
  if (!dates.length) return <div className="small muted">Pas encore de données.</div>

  const pad = { l: 34, r: 40, t: 14, b: 22 }
  const ys = series.flatMap((s) => s.data.map((d) => d.y)).concat(goal ? [goal.y] : [])
  const ticks = niceTicks(Math.min(...ys), Math.max(...ys))
  const y0 = ticks[0], y1 = ticks[ticks.length - 1]
  const t0 = fromISO(dates[0]).getTime(), t1 = fromISO(dates[dates.length - 1]).getTime()
  const X = (d: string) => (t1 === t0 ? (pad.l + w - pad.r) / 2 : pad.l + ((fromISO(d).getTime() - t0) / (t1 - t0)) * (w - pad.l - pad.r))
  const Y = (v: number) => pad.t + (1 - (v - y0) / (y1 - y0)) * (height - pad.t - pad.b)

  const pick = (clientX: number, el: Element) => {
    const x = clientX - el.getBoundingClientRect().left
    let best = dates[0]
    for (const d of dates) if (Math.abs(X(d) - x) < Math.abs(X(best) - x)) best = d
    setHover(best)
  }

  return (
    <div className="stack" style={{ gap: 8 }}>
      {series.length > 1 && (
        <div className="legend">{series.map((s) => <span key={s.name}><i style={{ background: s.color }} />{s.name}</span>)}</div>
      )}
      {table ? (
        <div className="small">
          {dates.slice().reverse().map((d) => (
            <div key={d} className="list-row" style={{ padding: '6px 0' }}>
              <span className="grow muted">{shortDate(d)}</span>
              {series.map((s) => { const p = s.data.find((x) => x.x === d); return <span key={s.name} style={{ minWidth: 70, textAlign: 'right' }}>{p ? `${fmt(p.y)} ${unit}` : '–'}</span> })}
            </div>
          ))}
        </div>
      ) : (
        <div className="chart" ref={ref}>
          <svg width={w} height={height}
            onPointerDown={(e) => pick(e.clientX, e.currentTarget)}
            onPointerMove={(e) => e.buttons || e.pointerType === 'mouse' ? pick(e.clientX, e.currentTarget) : undefined}
            onPointerLeave={() => setHover(undefined)}>
            {ticks.map((t) => (
              <g key={t}>
                <line x1={pad.l} x2={w - pad.r + 8} y1={Y(t)} y2={Y(t)} stroke={GRID} strokeWidth={1} />
                <text x={pad.l - 6} y={Y(t) + 4} fontSize={11} fill={AXIS} textAnchor="end">{fmt(t)}</text>
              </g>
            ))}
            <text x={pad.l} y={height - 4} fontSize={11} fill={AXIS}>{shortDate(dates[0])}</text>
            {dates.length > 1 && <text x={w - pad.r} y={height - 4} fontSize={11} fill={AXIS} textAnchor="end">{shortDate(dates[dates.length - 1])}</text>}
            {goal && (
              <g>
                <line x1={pad.l} x2={w - pad.r + 8} y1={Y(goal.y)} y2={Y(goal.y)} stroke={TEXT_2} strokeWidth={1.5} strokeDasharray="5 5" />
                <text x={w - pad.r + 10} y={Y(goal.y) + 4} fontSize={11} fill={TEXT_2}>{goal.label}</text>
              </g>
            )}
            {hover && <line x1={X(hover)} x2={X(hover)} y1={pad.t} y2={height - pad.b} stroke={AXIS} strokeWidth={1} />}
            {series.map((s) => {
              const pts = s.data.slice().sort((a, b) => a.x.localeCompare(b.x))
              const last = pts[pts.length - 1]
              return (
                <g key={s.name}>
                  <path d={pts.map((p, i) => `${i ? 'L' : 'M'}${X(p.x).toFixed(1)},${Y(p.y).toFixed(1)}`).join('')} stroke={s.color} strokeWidth={2} fill="none" strokeLinejoin="round" strokeLinecap="round" />
                  {pts.map((p) => (pts.length <= 14 || p === last || p.x === hover) && (
                    <circle key={p.x} cx={X(p.x)} cy={Y(p.y)} r={4} fill={s.color} stroke="var(--surface)" strokeWidth={2} />
                  ))}
                  {series.length <= 2 && last && !hover && (
                    <text x={X(last.x) + 8} y={Y(last.y) + 4} fontSize={12} fontWeight={700} fill="var(--text)">{fmt(last.y)}</text>
                  )}
                </g>
              )
            })}
          </svg>
          {hover && (
            <div className="tip" style={{ left: Math.min(Math.max(X(hover), 60), w - 60) }}>
              <div className="muted">{shortDate(hover)}</div>
              {series.map((s) => { const p = s.data.find((x) => x.x === hover); return p ? <div key={s.name}><span className="dot" style={{ background: s.color, width: 8, height: 8, marginRight: 5 }} />{series.length > 1 ? `${s.name} ` : ''}<b>{fmt(p.y)} {unit}</b></div> : null })}
            </div>
          )}
        </div>
      )}
      <button className="btn sm ghost" style={{ alignSelf: 'flex-end' }} onClick={() => setTable(!table)}>{table ? 'Voir le graphique' : 'Voir en tableau'}</button>
    </div>
  )
}

export function BarChart({ data, target, height = 120, footer }: {
  data: { key: string; label: string; value: number; tip: string }[]; target?: number; height?: number; footer?: ReactNode
}) {
  const [ref, w] = useWidth()
  const [hover, setHover] = useState<number>()
  const pad = { l: 18, r: 6, t: 10, b: 20 }
  const max = Math.max(target ?? 0, ...data.map((d) => d.value), 1)
  const bw = (w - pad.l - pad.r) / data.length
  const Y = (v: number) => pad.t + (1 - v / max) * (height - pad.t - pad.b)
  return (
    <div className="chart" ref={ref}>
      <svg width={w} height={height} onPointerLeave={() => setHover(undefined)}>
        <line x1={pad.l} x2={w - pad.r} y1={Y(0)} y2={Y(0)} stroke={GRID} />
        {target !== undefined && (
          <g>
            <line x1={pad.l} x2={w - pad.r} y1={Y(target)} y2={Y(target)} stroke={TEXT_2} strokeDasharray="4 4" strokeWidth={1.2} />
            <text x={pad.l - 5} y={Y(target) + 4} fontSize={11} fill={TEXT_2} textAnchor="end">{target}</text>
          </g>
        )}
        {data.map((d, i) => {
          const x = pad.l + i * bw + 1
          const h = Y(0) - Y(d.value)
          const bar = Math.max(4, bw - 2)
          return (
            <g key={d.key} onPointerDown={() => setHover(i)} onPointerEnter={() => setHover(i)}>
              <rect x={x} y={pad.t} width={bar} height={height - pad.t - pad.b} fill="transparent" />
              {d.value > 0 && <path d={`M${x},${Y(0)} V${Y(d.value) + Math.min(4, h)} q0,-4 4,-4 H${x + bar - 4} q4,0 4,4 V${Y(0)} Z`} fill={SERIES[0]} opacity={hover === undefined || hover === i ? 1 : 0.55} />}
              {(i === 0 || i === data.length - 1) && <text x={x + bar / 2} y={height - 5} fontSize={10.5} fill={AXIS} textAnchor="middle">{d.label}</text>}
            </g>
          )
        })}
      </svg>
      {hover !== undefined && <div className="tip" style={{ left: Math.min(Math.max(pad.l + hover * bw + bw / 2, 60), w - 60) }}>{data[hover].tip}</div>}
      {footer}
    </div>
  )
}

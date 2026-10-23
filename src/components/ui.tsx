import { useEffect, useState, type ReactNode } from 'react'
import { BAND_COLORS, bandName } from '../anim/Figure'
import type { Gear } from '../lib/program'
import type { Equip } from '../types'

export function Toggle({ on, onChange, label }: { on: boolean; onChange: (v: boolean) => void; label?: string }) {
  return <button className={`toggle ${on ? 'on' : ''}`} role="switch" aria-checked={on} aria-label={label} onClick={() => onChange(!on)} />
}

export function SettingRow({ title, desc, children }: { title: string; desc?: string; children: ReactNode }) {
  return (
    <div className="list-row">
      <div className="grow">
        <div style={{ fontWeight: 600 }}>{title}</div>
        {desc && <div className="small muted">{desc}</div>}
      </div>
      {children}
    </div>
  )
}

export function Sheet({ onClose, children }: { onClose: () => void; children: ReactNode }) {
  return (
    <div className="sheet-bg" onClick={onClose}>
      <div className="sheet" onClick={(e) => e.stopPropagation()}>{children}</div>
    </div>
  )
}

export function Stepper({ value, onChange, min = 0, max = 999, step = 1, format }: {
  value: number; onChange: (v: number) => void; min?: number; max?: number; step?: number; format?: (v: number) => string
}) {
  return (
    <div className="stepper">
      <button onClick={() => onChange(Math.max(min, value - step))}>−</button>
      <span>{format ? format(value) : value}</span>
      <button onClick={() => onChange(Math.min(max, value + step))}>+</button>
    </div>
  )
}

const EQUIP: Record<Equip, string> = { elastique: '', sac: '🎒 Sac', lit: '🛏️ Lit', porte: '🚪 Porte', mur: '🧱 Mur', livres: '📚 Livres' }

export function GearChips({ gear }: { gear: Gear }) {
  const items: ReactNode[] = []
  gear.bands.forEach((b) =>
    items.push(
      <span className="chip" key={'b' + b}>
        <span className="dot" style={{ background: BAND_COLORS[b] }} /> Élastique {b} · {bandName(b)}
      </span>,
    ),
  )
  gear.sac.forEach((s) => items.push(<span className="chip" key={'s' + s}>🎒 Sac {s}</span>))
  gear.equip.filter((e) => e !== 'elastique' && e !== 'sac').forEach((e) => items.push(<span className="chip" key={e}>{EQUIP[e]}</span>))
  gear.anchors.forEach((a) => items.push(<span className="chip" key={a}>📍 {a}</span>))
  if (!items.length) items.push(<span className="chip" key="pdc">🙌 Poids du corps</span>)
  return <div className="row wrap" style={{ gap: 6 }}>{items}</div>
}

let showToast: (m: string) => void = () => {}
export const toast = (m: string) => showToast(m)

export function ToastHost() {
  const [msg, setMsg] = useState<string>()
  useEffect(() => {
    let t: number
    showToast = (m) => { setMsg(m); clearTimeout(t); t = window.setTimeout(() => setMsg(undefined), 3200) }
  }, [])
  return msg ? <div className="toast" onClick={() => setMsg(undefined)}>{msg}</div> : null
}

export const fmtTime = (s: number) => {
  s = Math.max(0, Math.ceil(s))
  const m = Math.floor(s / 60)
  return m ? `${m}:${`${s % 60}`.padStart(2, '0')}` : `${s}`
}

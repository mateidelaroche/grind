import { useEffect, useRef, useState, type ReactNode } from 'react'
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

/** Fenêtre du bas : se ferme en touchant le fond, en la glissant vers le bas ou avec Échap. */
export function Sheet({ onClose, children }: { onClose: () => void; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null)
  const drag = useRef<{ y: number; t: number; dy: number; on: boolean }>(undefined)
  const [closing, setClosing] = useState(false)
  const close = () => {
    if (closing) return
    setClosing(true)
    window.setTimeout(onClose, 200)
  }
  useEffect(() => {
    const key = (e: KeyboardEvent) => e.key === 'Escape' && close()
    window.addEventListener('keydown', key)
    return () => window.removeEventListener('keydown', key)
  })
  const move = (dy: number, animate: boolean) => {
    const el = ref.current
    if (!el) return
    el.style.transition = animate ? 'transform 0.2s ease-out' : 'none'
    el.style.transform = dy ? `translateY(${dy}px)` : ''
  }
  const onStart = (e: React.TouchEvent) => {
    // On ne tire la fenêtre que si son contenu est déjà en haut (sinon on fait défiler).
    drag.current = { y: e.touches[0].clientY, t: Date.now(), dy: 0, on: (ref.current?.scrollTop ?? 0) <= 0 }
  }
  const onMove = (e: React.TouchEvent) => {
    const d = drag.current
    if (!d?.on) return
    const dy = e.touches[0].clientY - d.y
    if (dy < 0 && d.dy === 0) { d.on = false; return }
    d.dy = Math.max(0, dy)
    move(d.dy, false)
  }
  const onEnd = () => {
    const d = drag.current
    drag.current = undefined
    if (!d?.on || !d.dy) return
    const fast = d.dy / Math.max(1, Date.now() - d.t) > 0.5
    if (d.dy > 110 || (fast && d.dy > 30)) { move(window.innerHeight, true); close() }
    else move(0, true)
  }
  return (
    <div className={`sheet-bg ${closing ? 'closing' : ''}`} onClick={close}>
      <div
        ref={ref}
        className="sheet"
        role="dialog"
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
        onTouchStart={onStart}
        onTouchMove={onMove}
        onTouchEnd={onEnd}
        onTouchCancel={onEnd}
      >
        <button className="sheet-grab" aria-label="Fermer" onClick={close} />
        {children}
      </div>
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

const EQUIP_SHORT: Record<Equip, string> = { elastique: '', sac: 'sac', lit: 'lit', porte: 'porte', mur: 'mur', livres: 'livres' }

/** Matériel en une ligne : pastilles des élastiques puis le reste, pour un coup d'œil. */
export function GearLine({ gear }: { gear: Gear }) {
  const rest = [
    ...gear.sac.map((s) => `sac ${s}`),
    ...gear.equip.filter((e) => e !== 'elastique' && e !== 'sac').map((e) => EQUIP_SHORT[e]),
  ]
  if (!gear.bands.length && !rest.length) return <div className="gear-line">🙌 Poids du corps</div>
  return (
    <div className="gear-line">
      🎒
      {gear.bands.map((b) => <span key={b} className="gear-band"><span className="dot" style={{ background: BAND_COLORS[b] }} />{b}</span>)}
      {rest.length > 0 && <span>{gear.bands.length ? '· ' : ''}{rest.join(' · ')}</span>}
    </div>
  )
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

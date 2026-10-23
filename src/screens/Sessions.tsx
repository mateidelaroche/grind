import { useState } from 'react'
import Figure from '../anim/Figure'
import { EXERCISES } from '../data/exercises'
import { SESSIONS } from '../data/sessions'
import { IconBack, IconEdit } from '../components/icons'
import { Sheet, Stepper, toast } from '../components/ui'
import { animOf, editKey, effectiveItem, effectiveLevel, effectiveRest, effectiveSets, levelOf, today, weekNumber } from '../lib/program'
import { useStore } from '../store'
import type { SessionId } from '../types'

const MAIN: SessionId[] = ['A', 'B', 'C']
const ROUTINES: SessionId[] = ['GENOUX', 'BONUS', 'WARMUP', 'COOLDOWN']

export function SessionsList({ onOpen }: { onOpen: (s: SessionId) => void }) {
  return (
    <div className="page">
      <div className="page-title">Séances</div>
      {MAIN.map((id) => {
        const s = SESSIONS[id]
        return (
          <button key={id} className="card tap" onClick={() => onOpen(id)}>
            <div className="row between"><div className="ex-name">{s.name}</div><span className="small muted">{s.duration}</span></div>
            <div className="muted small">{s.subtitle}</div>
            <div className="row wrap" style={{ gap: 6 }}>
              {s.blocks.flatMap((b) => b.items).map((it, i) => <span key={i} className="chip">{EXERCISES[it.ex].name}</span>)}
            </div>
          </button>
        )
      })}
      <div className="section-title">Routines</div>
      {ROUTINES.map((id) => {
        const s = SESSIONS[id]
        return (
          <button key={id} className="card tap" onClick={() => onOpen(id)}>
            <div className="row between"><div style={{ fontWeight: 700 }}>{s.name}</div><span className="small muted">{s.duration}</span></div>
            <div className="muted small">{s.subtitle}</div>
          </button>
        )
      })}
    </div>
  )
}

export function SessionDetail({ id, onBack, onStart, onExercise }: {
  id: SessionId; onBack: () => void; onStart: (s: SessionId, express: boolean) => void; onExercise: (ex: string) => void
}) {
  const s = useStore()
  const ses = SESSIONS[id]
  const routine = ses.kind === 'routine'
  const week = weekNumber(today(), s.startDate)
  const [editing, setEditing] = useState<{ block: string; idx: number }>()

  return (
    <div className="page">
      <div className="topbar">
        <button className="icon-btn" onClick={onBack} aria-label="Retour"><IconBack /></button>
        <div className="grow">
          <div className="ex-name">{ses.name}</div>
          <div className="small muted">{ses.subtitle}</div>
        </div>
      </div>
      {!routine && week >= 1 && (week <= 2 || week === 9) && (
        <div className="small muted">📉 Semaine {week} : séries réduites automatiquement ({week <= 2 ? '1 série en moins' : 'moitié des séries'}).</div>
      )}
      {ses.blocks.map((b) => (
        <div key={b.id} className="card" style={{ gap: 4 }}>
          <div className="row between">
            <span className="small muted">{b.items.length > 1 ? `Superset ${b.id}` : `Bloc ${b.id}`}{b.express && !routine ? ' · express' : ''}</span>
            {effectiveRest(id, b, s.edits) > 0 && <span className="small muted">Repos {effectiveRest(id, b, s.edits)} s</span>}
          </div>
          {b.items.map((_, idx) => {
            const it = effectiveItem(id, b, idx, s.edits)
            const lvl = effectiveLevel(it.ex, it, s.levels, week, routine)
            const ex = EXERCISES[it.ex]
            const edited = !!s.edits[editKey(id, b.id, idx)]
            return (
              <div key={idx} className="list-row">
                <button onClick={() => onExercise(it.ex)}><Figure anim={animOf(it.ex, lvl)} keyIndex={0} playing={false} band={levelOf(it.ex, lvl)?.band} className="figure mini" /></button>
                <button className="grow" style={{ textAlign: 'left' }} onClick={() => onExercise(it.ex)}>
                  <div style={{ fontWeight: 650 }}>{b.items.length > 1 ? `${b.id}${idx + 1} · ` : ''}{ex.name}</div>
                  <div className="small muted">
                    {effectiveSets(it.sets, week, routine)} × {it.duration ? it.durationLabel : it.reps}
                    {ex.levels && ex.levels.length > 1 ? ` · ${levelOf(it.ex, lvl)?.label}` : ''}
                    {edited ? ' · modifié' : ''}
                  </div>
                </button>
                <button className="icon-btn" aria-label="Modifier" onClick={() => setEditing({ block: b.id, idx })}><IconEdit /></button>
              </div>
            )
          })}
        </div>
      ))}
      <button className="btn primary big block" onClick={() => onStart(id, false)}>Démarrer</button>
      {!routine && <button className="btn block" onClick={() => onStart(id, true)}>⚡ Express 25 min</button>}

      {editing && (() => {
        const block = ses.blocks.find((b) => b.id === editing.block)!
        const key = editKey(id, block.id, editing.idx)
        const it = effectiveItem(id, block, editing.idx, s.edits)
        const restKey = editKey(id, block.id, 0)
        const rest = effectiveRest(id, block, s.edits)
        const cur = s.edits[key] ?? {}
        return (
          <Sheet onClose={() => setEditing(undefined)}>
            <div className="ex-name">{EXERCISES[it.ex].name}</div>
            <div className="list-row">
              <div className="grow">Séries <span className="small muted">(base, avant ajustement de phase)</span></div>
              <Stepper value={it.sets} min={1} max={8} onChange={(v) => s.setEdit(key, { ...cur, sets: v })} />
            </div>
            {!it.duration && (
              <div className="list-row">
                <div className="grow">Reps</div>
                <input className="input" style={{ width: 150 }} value={it.reps ?? ''} onChange={(e) => s.setEdit(key, { ...cur, reps: e.target.value })} />
              </div>
            )}
            <div className="list-row">
              <div className="grow">Repos du bloc</div>
              <Stepper value={rest} min={0} max={300} step={15} format={(v) => `${v} s`} onChange={(v) => s.setEdit(restKey, { ...(s.edits[restKey] ?? {}), rest: v })} />
            </div>
            <button className="btn block" onClick={() => { s.setEdit(key, undefined); if (editing.idx === 0) s.setEdit(restKey, undefined); toast('Valeurs du programme restaurées'); setEditing(undefined) }}>Revenir au programme</button>
            <button className="btn primary block" onClick={() => setEditing(undefined)}>OK</button>
          </Sheet>
        )
      })()}
    </div>
  )
}

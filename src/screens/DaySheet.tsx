// Fiche d'un jour du calendrier : ce qui était prévu, ce qui a été fait, et le rattrapage d'un oubli.
import { useMemo, useState } from 'react'
import { EXERCISES } from '../data/exercises'
import { SESSIONS } from '../data/sessions'
import { runProgress, RUN_PLAN } from '../data/running'
import { GearLine, Sheet, Stepper, toast } from '../components/ui'
import { buildSteps, dayPlan, formatDate, fromISO, isRunDay, lastReps, levelOf, runStartOf, sessionGear, today, weekNumber } from '../lib/program'
import { fmtKm, fmtDur } from '../lib/gps'
import { useStore } from '../store'
import type { SessionId, SetRecord } from '../types'

const MUSCU: SessionId[] = ['A', 'B', 'C']

interface Line { recKey: string; ex: string; level: number; total: number; timed: boolean; done: number; value: number }

/** Séries de la séance prévues ce jour-là, pré-remplies avec les reps de la dernière fois (ou le bas de la fourchette). */
function useLines(session: SessionId, date: string) {
  const s = useStore()
  return useMemo(() => {
    const week = Math.max(1, weekNumber(date, s.startDate))
    const steps = buildSteps(session, { week, express: false, levels: s.levels, edits: s.edits, timeTargets: s.timeTargets })
    const lines: Line[] = []
    for (const st of steps) {
      if (st.phase !== 'main' || st.kind !== 'work' || !st.recKey || lines.some((l) => l.recKey === st.recKey)) continue
      const timed = !!st.duration
      lines.push({
        recKey: st.recKey, ex: st.ex!, level: st.level ?? 0, total: st.rounds ?? 1, timed, done: st.rounds ?? 1,
        value: timed ? st.duration! : lastReps(st, session, s.workouts),
      })
    }
    return lines
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session, date])
}

function CatchUp({ date, session, onDone }: { date: string; session: SessionId; onDone: () => void }) {
  const logWorkout = useStore((s) => s.logWorkout)
  const init = useLines(session, date)
  const [lines, setLines] = useState(init)
  const set = (i: number, patch: Partial<Line>) => setLines((ls) => ls.map((l, k) => (k === i ? { ...l, ...patch } : l)))
  const save = () => {
    const sets: Record<string, SetRecord> = {}
    for (const l of lines) {
      sets[l.recKey] = {
        ex: l.ex, total: l.total, level: l.level, done: l.done, flags: [],
        ...(l.timed ? { best: l.done > 0 ? l.value : undefined } : { reps: l.done > 0 ? Array(l.done).fill(l.value) : undefined }),
      }
    }
    const start = fromISO(date).getTime() + 18 * 3600e3
    logWorkout({ date, session, express: false, startedAt: start, endedAt: start + 40 * 60e3, completed: true, sets })
    toast(`${SESSIONS[session].name} enregistrée pour le ${formatDate(date).toLowerCase()}.`)
    onDone()
  }
  return (
    <div className="stack" style={{ gap: 0 }}>
      <div className="small muted" style={{ marginBottom: 6 }}>Séries faites et reps par série : corrige si besoin.</div>
      {lines.map((l, i) => (
        <div key={l.recKey} className="list-row" style={{ flexWrap: 'wrap', rowGap: 6 }}>
          <div className="grow" style={{ minWidth: '100%' }}>
            <div style={{ fontWeight: 650 }}>{EXERCISES[l.ex].name}</div>
            {EXERCISES[l.ex].levels && <div className="tiny muted">{levelOf(l.ex, l.level)?.label}</div>}
          </div>
          <div className="row between" style={{ width: '100%' }}>
            <span className="small muted">Séries</span>
            <Stepper value={l.done} min={0} max={l.total} onChange={(v) => set(i, { done: v })} format={(v) => `${v}/${l.total}`} />
          </div>
          <div className="row between" style={{ width: '100%' }}>
            <span className="small muted">{l.timed ? 'Temps tenu' : 'Reps / série'}</span>
            <Stepper value={l.value} min={0} max={l.timed ? 300 : 60} step={l.timed ? 5 : 1} onChange={(v) => set(i, { value: v })} format={(v) => (l.timed ? `${v} s` : `${v}`)} />
          </div>
        </div>
      ))}
      <button className="btn primary block" style={{ marginTop: 12 }} onClick={save}>✅ Enregistrer la séance</button>
    </div>
  )
}

function RunCatchUp({ date, onDone }: { date: string; onDone: () => void }) {
  const runs = useStore((s) => s.runs)
  const addRun = useStore((s) => s.addRun)
  const idx = runProgress(runs).index
  const [min, setMin] = useState(30)
  const [km, setKm] = useState(3)
  const save = () => {
    const start = fromISO(date).getTime() + 18 * 3600e3
    addRun({ date, plan: idx < RUN_PLAN.length ? idx : -1, startedAt: start, endedAt: start + min * 60e3, dur: min * 60, dist: Math.round(km * 1000), completed: true, splits: [] })
    toast('Sortie enregistrée.')
    onDone()
  }
  return (
    <div className="stack" style={{ gap: 8 }}>
      {idx < RUN_PLAN.length && <div className="small muted">Compte comme la sortie {idx + 1} : {RUN_PLAN[idx].title}.</div>}
      <div className="row between"><span className="small muted">Durée</span><Stepper value={min} min={5} max={120} step={5} onChange={setMin} format={(v) => `${v} min`} /></div>
      <div className="row between"><span className="small muted">Distance</span><Stepper value={km} min={0} max={21} step={0.5} onChange={(v) => setKm(Math.round(v * 10) / 10)} format={(v) => `${v.toFixed(1).replace('.', ',')} km`} /></div>
      <button className="btn primary block" onClick={save}>✅ Enregistrer la sortie</button>
    </div>
  )
}

export default function DaySheet({ date, onClose, onOpenWorkout, onOpenSession, onOpenRun }: {
  date: string; onClose: () => void; onOpenWorkout: (id: string) => void; onOpenSession: (s: SessionId) => void; onOpenRun: (id: string) => void
}) {
  const s = useStore()
  const d = today()
  const past = date < d
  const future = date > d
  const plan = dayPlan(date, s.overrides)
  const runDone = runProgress(s.runs).index >= RUN_PLAN.length
  const runPlanned = isRunDay(date, runStartOf(s), runDone)
  const workouts = s.workouts.filter((w) => w.date === date && (w.completed || Object.values(w.sets).some((r) => r.done > 0)))
  const runs = s.runs.filter((r) => r.date === date)
  const basket = s.basket[date]
  const weight = s.weights[date]
  const [catchUp, setCatchUp] = useState<SessionId>()
  const [runForm, setRunForm] = useState(false)
  const [kg, setKg] = useState(weight ?? Object.entries(s.weights).sort().at(-1)?.[1] ?? 75)
  const planned = plan.type === 'session' ? plan.session : undefined
  const muscuDone = workouts.some((w) => SESSIONS[w.session].kind === 'muscu')
  const week = Math.max(1, weekNumber(date, s.startDate))

  return (
    <Sheet onClose={onClose}>
      <div className="row between">
        <div className="ex-name" style={{ textTransform: 'capitalize' }}>{formatDate(date)}</div>
        <span className="badge">{past ? 'Passé' : future ? 'À venir' : 'Aujourd’hui'}</span>
      </div>

      <div className="section-title">Prévu</div>
      <div className="card" style={{ gap: 8 }}>
        {planned && (
          <button className="row between" style={{ textAlign: 'left' }} onClick={() => onOpenSession(planned)}>
            <div className="grow">
              <div style={{ fontWeight: 700 }}>💪 {SESSIONS[planned].name}{plan.type === 'session' && plan.moved ? ' · déplacée' : ''}</div>
              <div className="small muted">{SESSIONS[planned].subtitle}</div>
              <GearLine gear={sessionGear(planned, { week, express: false, levels: s.levels, edits: s.edits, timeTargets: s.timeTargets })} />
            </div>
            <span className="muted">›</span>
          </button>
        )}
        {plan.type === 'basket' && <div style={{ fontWeight: 700 }}>🏀 {plan.match ? 'Match' : 'Entraînement de basket'} · 20h30</div>}
        {runPlanned && <div style={{ fontWeight: 700 }}>🏃 Course (programme course)</div>}
        {plan.type === 'rest' && !runPlanned && <div style={{ fontWeight: 700 }}>😴 Repos</div>}
      </div>

      {!future && (
        <>
          <div className="section-title">Fait ce jour-là</div>
          <div className="card" style={{ gap: 0, padding: '4px 16px' }}>
            {workouts.map((w) => (
              <button key={w.id} className="list-row" style={{ width: '100%', textAlign: 'left' }} onClick={() => onOpenWorkout(w.id)}>
                <span className="grow" style={{ fontWeight: 650 }}>✅ {SESSIONS[w.session].name}</span>
                <span className="small muted">{Object.values(w.sets).reduce((a, r) => a + r.done, 0)} séries ›</span>
              </button>
            ))}
            {runs.map((r) => (
              <button key={r.id} className="list-row" style={{ width: '100%', textAlign: 'left' }} onClick={() => onOpenRun(r.id)}>
                <span className="grow" style={{ fontWeight: 650 }}>✅ {r.indoor ? 'Cardio en chambre' : 'Sortie course'}</span>
                <span className="small muted">{r.dist > 0 ? `${fmtKm(r.dist)} · ` : ''}{fmtDur(r.dur)} ›</span>
              </button>
            ))}
            {plan.type === 'basket' && (
              <div className="list-row">
                <span className="grow" style={{ fontWeight: 650 }}>🏀 Basket fait</span>
                <button className={`btn sm ${basket?.done ? 'primary' : ''}`} onClick={() => s.setBasket(date, basket?.done ? undefined : { done: true })}>{basket?.done ? '✓ Fait' : 'Marquer'}</button>
              </div>
            )}
            <div className="list-row">
              <span className="grow" style={{ fontWeight: 650 }}>⚖️ Poids</span>
              <Stepper value={kg} min={40} max={150} step={0.1} onChange={(v) => setKg(Math.round(v * 10) / 10)} format={(v) => `${v.toFixed(1).replace('.', ',')} kg`} />
              <button className={`btn sm ${weight === kg ? 'primary' : ''}`} onClick={() => { s.setWeight(date, kg); toast('Poids enregistré.') }}>{weight === kg ? '✓' : 'OK'}</button>
            </div>
            {!workouts.length && !runs.length && plan.type !== 'basket' && <div className="list-row small muted">Rien d’enregistré pour l’instant.</div>}
          </div>

          {(!muscuDone || (runPlanned && !runs.length)) && <div className="section-title">Rattraper un oubli</div>}
          {!muscuDone && (
            <div className="card" style={{ gap: 10 }}>
              <div style={{ fontWeight: 700 }}>Séance muscu faite ce jour-là</div>
              <div className="row" style={{ gap: 6 }}>
                {MUSCU.map((sid) => (
                  <button key={sid} className={`chip tap ${catchUp === sid ? 'on' : ''}`} onClick={() => setCatchUp(catchUp === sid ? undefined : sid)}>
                    {SESSIONS[sid].name}{sid === planned ? ' · prévue' : ''}
                  </button>
                ))}
              </div>
              {catchUp && <CatchUp key={catchUp} date={date} session={catchUp} onDone={() => setCatchUp(undefined)} />}
            </div>
          )}
          {runPlanned && !runs.length && (
            <div className="card" style={{ gap: 10 }}>
              <button className="row between" onClick={() => setRunForm(!runForm)}>
                <span style={{ fontWeight: 700 }}>🏃 Sortie course faite ce jour-là</span>
                <span className="muted">{runForm ? '▾' : '›'}</span>
              </button>
              {runForm && <RunCatchUp date={date} onDone={() => setRunForm(false)} />}
            </div>
          )}
        </>
      )}
    </Sheet>
  )
}

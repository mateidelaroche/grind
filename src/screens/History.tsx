import { useEffect, useState } from 'react'
import { BarChart } from '../components/Charts'
import { celebrate } from '../components/Confetti'
import { DONE_LINES, pick } from '../data/coach'
import { recordsOfWorkout } from '../lib/records'
import { BodyTab, RecordsTab } from './Body'
import { RunHistoryTab } from './RunViews'
import { EXERCISES } from '../data/exercises'
import { SESSIONS } from '../data/sessions'
import { IconBack } from '../components/icons'
import { toast } from '../components/ui'
import { addDays, formatDate, fromISO, levelOf, mondayOf, suggestions, today } from '../lib/program'
import { useStore } from '../store'
import type { Workout } from '../types'
import { workOfMany } from '../data/muscles'
import MuscleMap from '../components/MuscleMap'

const minutes = (w: Workout) => (w.endedAt ? Math.max(1, Math.round((w.endedAt - w.startedAt) / 60000)) : undefined)
const setsDone = (w: Workout) => Object.values(w.sets).reduce((a, r) => a + r.done, 0)
const setsTotal = (w: Workout) => Object.values(w.sets).reduce((a, r) => a + r.total, 0)
const isMuscu = (w: Workout) => w.completed && SESSIONS[w.session].kind === 'muscu'

/** Semaines consécutives (en remontant depuis la semaine dernière) avec au moins 3 séances muscu. */
function streak(workouts: Workout[]) {
  const perWeek = new Map<string, number>()
  for (const w of workouts.filter(isMuscu)) perWeek.set(mondayOf(w.date), (perWeek.get(mondayOf(w.date)) ?? 0) + 1)
  const thisMonday = mondayOf(today())
  let n = (perWeek.get(thisMonday) ?? 0) >= 3 ? 1 : 0
  for (let m = addDays(thisMonday, -7); (perWeek.get(m) ?? 0) >= 3; m = addDays(m, -7)) n++
  return { n, thisWeek: perWeek.get(thisMonday) ?? 0 }
}

type Section = 'seances' | 'course' | 'corps' | 'records'

export function HistoryScreen({ onOpen, onRunOpen, onRunProgram }: { onOpen: (id: string) => void; onRunOpen: (id: string) => void; onRunProgram: () => void }) {
  const [section, setSection] = useState<Section>(() => (sessionStorage.getItem('hist') as Section) ?? 'seances')
  const pick = (s: Section) => { setSection(s); try { sessionStorage.setItem('hist', s) } catch { /* ignore */ } }
  return (
    <div className="page">
      <div className="page-title">Historique</div>
      <div className="seg">
        <button className={section === 'seances' ? 'on' : ''} onClick={() => pick('seances')}>Séances</button>
        <button className={section === 'course' ? 'on' : ''} onClick={() => pick('course')}>Course</button>
        <button className={section === 'corps' ? 'on' : ''} onClick={() => pick('corps')}>Corps</button>
        <button className={section === 'records' ? 'on' : ''} onClick={() => pick('records')}>Records</button>
      </div>
      {section === 'seances' && <Sessions onOpen={onOpen} />}
      {section === 'course' && <RunHistoryTab onOpen={onRunOpen} onProgram={onRunProgram} />}
      {section === 'corps' && <BodyTab />}
      {section === 'records' && <RecordsTab />}
    </div>
  )
}

function Sessions({ onOpen }: { onOpen: (id: string) => void }) {
  const workouts = useStore((s) => s.workouts)
  const basket = useStore((s) => s.basket)
  const runs = useStore((s) => s.runs)
  const { n, thisWeek } = streak(workouts)
  const done = workouts.filter((w) => w.completed).slice().reverse()
  const totalMuscu = workouts.filter(isMuscu).length

  // Grille 16 semaines façon GitHub
  const weeks = 16
  const start = addDays(mondayOf(today()), -7 * (weeks - 1))
  const muscuDays = new Set(workouts.filter(isMuscu).map((w) => w.date))
  const runDays = new Set(runs.map((r) => r.date))
  const cells = Array.from({ length: weeks * 7 }, (_, i) => {
    const d = addDays(start, i)
    if (d > today()) return 'x'
    return muscuDays.has(d) ? 'm' : runDays.has(d) ? 'r' : basket[d]?.done ? 'b' : ''
  })

  // Séances par semaine (12 dernières), objectif 3
  const perWeek = Array.from({ length: 12 }, (_, i) => {
    const m = addDays(mondayOf(today()), -7 * (11 - i))
    const value = workouts.filter((w) => isMuscu(w) && mondayOf(w.date) === m).length
    const label = fromISO(m).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })
    return { key: m, label, value, tip: `Semaine du ${label} : ${value} séance${value > 1 ? 's' : ''}` }
  })

  return (
    <>
      <div className="stats">
        <div className="stat"><span className="big-num">🔥 {n}</span><span className="tiny muted">semaine{n > 1 ? 's' : ''} d’affilée (3+ séances)</span></div>
        <div className="stat"><span className="big-num">{thisWeek}/3</span><span className="tiny muted">séances cette semaine</span></div>
        <div className="stat"><span className="big-num">{totalMuscu}</span><span className="tiny muted">séances au total</span></div>
      </div>
      <div className="card">
        <div className="heat">{cells.map((c, i) => <div key={i} className={c} />)}</div>
        <div className="row tiny muted" style={{ gap: 12 }}>
          <span className="row" style={{ gap: 4 }}><span className="dot" style={{ background: 'var(--accent-2)', borderRadius: 3 }} /> Muscu</span>
          <span className="row" style={{ gap: 4 }}><span className="dot" style={{ background: '#0e7490', borderRadius: 3 }} /> Course</span>
          <span className="row" style={{ gap: 4 }}><span className="dot" style={{ background: '#7c2d12', borderRadius: 3 }} /> Basket</span>
          <span className="grow" style={{ textAlign: 'right' }}>16 dernières semaines</span>
        </div>
      </div>
      <div className="card">
        <div style={{ fontWeight: 700 }}>Séances muscu par semaine</div>
        <BarChart data={perWeek} target={3} />
        <div className="tiny muted">Pointillés : objectif de 3 séances.</div>
      </div>
      <div className="section-title">Séances</div>
      {done.length === 0 && <div className="muted small">Aucune séance pour l’instant. La première est la plus importante 💪</div>}
      {done.map((w) => (
        <button key={w.id} className="card tap" onClick={() => onOpen(w.id)}>
          <div className="row between">
            <div style={{ fontWeight: 700 }}>{SESSIONS[w.session].name}{w.express ? ' · express' : ''}</div>
            <span className="small muted">{minutes(w) ? `${minutes(w)} min` : ''}</span>
          </div>
          <div className="row between small muted">
            <span style={{ textTransform: 'capitalize' }}>{formatDate(w.date)}</span>
            {setsTotal(w) > 0 && <span>{setsDone(w)}/{setsTotal(w)} séries</span>}
          </div>
        </button>
      ))}
    </>
  )
}

export function Recap({ id, onBack, fresh }: { id: string; onBack: () => void; fresh?: boolean }) {
  const s = useStore()
  const w = s.workouts.find((x) => x.id === id)
  const hasRecords = !!w && recordsOfWorkout(w, s.workouts).length > 0
  useEffect(() => { if (fresh && hasRecords) celebrate() }, [fresh, hasRecords])
  if (!w) return <div className="page"><button className="btn" onClick={onBack}>Retour</button></div>
  const prev = s.workouts.filter((x) => x.session === w.session && x.completed && x.startedAt < w.startedAt).at(-1)
  const sugg = suggestions(w, s.workouts.filter((x) => x.startedAt < w.startedAt), s.levels)
  const pct = setsTotal(w) ? Math.round((setsDone(w) / setsTotal(w)) * 100) : 100
  const records = recordsOfWorkout(w, s.workouts)
  const milk = s.food[w.date]?.lait

  return (
    <div className="page">
      <div className="topbar">
        <button className="icon-btn" onClick={onBack} aria-label="Retour"><IconBack /></button>
        <div className="grow">
          <div className="ex-name">{fresh ? 'Séance terminée 🎉' : SESSIONS[w.session].name}</div>
          <div className="small muted" style={{ textTransform: 'capitalize' }}>{formatDate(w.date)}</div>
        </div>
      </div>
      {fresh && s.settings.coach && <div className="card accent"><b>{pick(DONE_LINES, w.startedAt)}</b></div>}
      {records.length > 0 && (
        <div className="card" style={{ gap: 6, borderColor: '#a16207' }}>
          <div style={{ fontWeight: 800 }}>🏆 Record{records.length > 1 ? 's' : ''} battu{records.length > 1 ? 's' : ''}</div>
          {records.map((r, i) => <div key={i} className="small">{r.icon} {r.text}</div>)}
        </div>
      )}
      {fresh && s.settings.coach && SESSIONS[w.session].kind === 'muscu' && (
        <div className="card" style={{ flexDirection: 'row', alignItems: 'center' }}>
          <span style={{ fontSize: 24 }}>🥛</span>
          <div className="grow small">Un verre de lait ou un yaourt maintenant ? 30 secondes, et ça aide à grossir.</div>
          <button className={`btn sm ${milk ? 'primary' : ''}`} onClick={() => s.setFood(w.date, { lait: !milk })}>{milk ? '✓ Fait' : 'Fait'}</button>
        </div>
      )}
      <div className="stats">
        <div className="stat"><span className="big-num">{minutes(w) ?? '–'}</span><span className="tiny muted">minutes</span></div>
        <div className="stat"><span className="big-num">{setsDone(w)}/{setsTotal(w)}</span><span className="tiny muted">séries</span></div>
        <div className="stat"><span className="big-num">{pct}%</span><span className="tiny muted">complété</span></div>
      </div>
      {prev && (
        <div className="card small">
          <div style={{ fontWeight: 700 }}>Par rapport à la dernière {SESSIONS[w.session].name}</div>
          <div className="muted">
            Durée : {minutes(prev) ?? '–'} → {minutes(w) ?? '–'} min · Séries : {setsDone(prev)} → {setsDone(w)}
            {setsDone(w) > setsDone(prev) ? ' 📈' : ''}
          </div>
        </div>
      )}
      {sugg.length > 0 && (
        <>
          <div className="section-title">Progression suggérée</div>
          {sugg.map((g) => {
            const applied = (s.levels[g.ex] ?? g.from) >= g.to
            return (
              <div key={g.ex} className="card" style={{ gap: 6 }}>
                <div style={{ fontWeight: 700 }}>{EXERCISES[g.ex].name}</div>
                <div className="small muted">{g.reason}</div>
                <div className="small">{levelOf(g.ex, g.from)?.label} → <b>{levelOf(g.ex, g.to)?.label}</b></div>
                <button className={`btn sm ${applied ? '' : 'primary'}`} disabled={applied} onClick={() => { s.setLevel(g.ex, g.to); celebrate(); toast(`🆙 ${EXERCISES[g.ex].name} : niveau ${g.to + 1} débloqué`) }}>
                  {applied ? '✓ Appliqué' : 'Passer au niveau suivant'}
                </button>
              </div>
            )
          })}
        </>
      )}
      {Object.values(w.sets).some((r) => r.done > 0) && (
        <>
          <div className="section-title">Muscles travaillés</div>
          <div className="card"><MuscleMap work={workOfMany(Object.values(w.sets).filter((r) => r.done > 0).map((r) => r.ex))} /></div>
        </>
      )}
      <div className="section-title">Détail</div>
      <div className="card" style={{ padding: '4px 16px', gap: 0 }}>
        {Object.entries(w.sets).map(([k, r]) => (
          <div key={k} className="list-row small">
            <div className="grow">
              <div style={{ fontWeight: 600 }}>{EXERCISES[r.ex].name}</div>
              <div className="muted">{levelOf(r.ex, r.level)?.label ?? ''}{r.flags.length ? ` · ${r.flags.map((f) => (f === 'hard' ? '😮‍💨 dur' : '😎 facile')).join(' ')}` : ''}</div>
            </div>
            <span style={{ fontWeight: 700, color: r.done >= r.total ? 'var(--ok)' : 'var(--text-2)' }}>{r.done}/{r.total}</span>
          </div>
        ))}
        {Object.keys(w.sets).length === 0 && <div className="list-row small muted">Routine terminée.</div>}
      </div>
      <button className="btn primary big block" onClick={onBack}>{fresh ? 'Terminer' : 'Retour'}</button>
      {!fresh && (
        <button className="btn danger block" onClick={() => { if (confirm('Supprimer cette séance de l’historique ?')) { s.deleteWorkout(w.id); onBack() } }}>Supprimer cette séance</button>
      )}
    </div>
  )
}

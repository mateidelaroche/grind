import { lazy, Suspense, useEffect, useState } from 'react'
import { BarChart } from '../components/Charts'
import { celebrate } from '../components/Confetti'
import { IconBack } from '../components/icons'
import { Stepper } from '../components/ui'
import { KNEE_BACK, KNEE_REPEAT, kneeOf, RUN_PLAN, RUN_WEEKS, runMinutes, runProgress, runSteps, runTime } from '../data/running'
import { SESSIONS } from '../data/sessions'
import { fmtDur, fmtKm, fmtMin, fmtPace } from '../lib/gps'
import { addDays, dayPlan, formatDate, fromISO, mondayOf, nextRunDay, runStartOf, today } from '../lib/program'
import { recordsOfRun, runBests, RUN_KM_MILESTONES } from '../lib/records'
import { useStore } from '../store'
import type { RunLog, SessionId } from '../types'
import type { RunKind } from './Run'

const RunMap = lazy(() => import('./RunMap'))

export const runTitle = (r: RunLog) => (r.indoor ? 'Cardio en chambre' : r.plan >= 0 ? `Sortie ${r.plan + 1} · ${RUN_PLAN[r.plan].title}` : 'Sortie libre')

// ───────────── Après la sortie ─────────────
export function RunRecap({ id, fresh, onBack, onStartSession }: { id: string; fresh?: boolean; onBack: () => void; onStartSession: (s: SessionId) => void }) {
  const s = useStore()
  const r = s.runs.find((x) => x.id === id)
  const records = r ? recordsOfRun(r, s.runs) : []
  useEffect(() => { if (fresh && records.length) celebrate() }, [fresh, records.length])
  if (!r) return <div className="page"><button className="btn" onClick={onBack}>Retour</button></div>

  const before = runProgress(s.runs.filter((x) => x.id !== r.id && x.startedAt < r.startedAt))
  const after = runProgress(s.runs.filter((x) => x.startedAt <= r.startedAt))
  const efforts = r.splits.filter((x) => x.kind === 'run')
  const plan = dayPlan(r.date, s.overrides)
  const muscuDone = s.workouts.some((w) => w.date === r.date && w.completed && SESSIONS[w.session].kind === 'muscu')
  const knee = r.knee ?? 0

  return (
    <div className="page">
      <div className="topbar">
        <button className="icon-btn" onClick={onBack} aria-label="Retour"><IconBack /></button>
        <div className="grow">
          <div className="ex-name">{fresh ? (r.completed ? 'Sortie validée 🎉' : 'Sortie enregistrée') : runTitle(r)}</div>
          <div className="small muted" style={{ textTransform: 'capitalize' }}>{formatDate(r.date)}</div>
        </div>
      </div>

      {records.length > 0 && (
        <div className="card" style={{ gap: 6, borderColor: '#a16207' }}>
          <div style={{ fontWeight: 800 }}>🏆 Record{records.length > 1 ? 's' : ''} battu{records.length > 1 ? 's' : ''}</div>
          {records.map((x, i) => <div key={i} className="small">{x.icon} {x.text}</div>)}
        </div>
      )}

      {!r.indoor && r.plan >= 0 && (
        <div className="card accent">
          <div style={{ fontWeight: 700 }}>🦵 Ton genou, pendant et juste après ?</div>
          <div className="row between">
            <span className="small muted">0 = rien · 10 = très mal</span>
            <Stepper value={knee} min={0} max={10} onChange={(v) => s.setRunKnee(r.id, { knee: v })} />
          </div>
          <div className="small">
            {r.plan !== before.index ? 'Sortie refaite hors programme : elle ne change pas ta progression.'
              : !r.completed ? 'Sortie pas terminée : tu referas la même la prochaine fois.'
              : after.index < before.index + 1 && after.adjust?.kind === 'back' ? `${kneeOf(r)}/10 : on recule d’une semaine. Repos jusqu’à la prochaine sortie ; si la douleur dure plus de quelques jours, va voir un kiné.`
              : after.index < before.index + 1 ? `${kneeOf(r)}/10 : on refait cette semaine pour laisser le genou s’habituer. Aucun souci, c’est le plan.`
              : after.index >= RUN_PLAN.length ? 'Programme terminé 🏁 Bravo !'
              : `Prochaine : sortie ${after.index + 1} · ${RUN_PLAN[after.index].title}`}
          </div>
          <div className="tiny muted">À partir de {KNEE_REPEAT}/10 on refait la semaine, à partir de {KNEE_BACK}/10 on recule d’une semaine. Demain matin, l’appli te redemandera.</div>
        </div>
      )}

      {fresh && plan.type === 'session' && !muscuDone && r.date === today() && (
        <button className="btn primary big block" onClick={() => onStartSession(plan.session)}>Enchaîner : {SESSIONS[plan.session].name} 💪</button>
      )}

      <div className="stats">
        {!r.indoor && <div className="stat"><span className="big-num">{fmtKm(r.dist)}</span><span className="tiny muted">km</span></div>}
        <div className="stat"><span className="big-num">{fmtDur(r.dur)}</span><span className="tiny muted">durée</span></div>
        {!r.indoor && <div className="stat"><span className="big-num">{fmtPace(r.dist > 50 ? r.dur / (r.dist / 1000) : undefined)}</span><span className="tiny muted">allure moy. /km</span></div>}
      </div>

      {r.track && r.track.length > 1 && (
        <div className="card" style={{ padding: 0, overflow: 'hidden', gap: 0 }}>
          <Suspense fallback={<div className="run-map" />}><RunMap run={r} /></Suspense>
          <div className="row tiny muted" style={{ padding: '8px 12px', gap: 14 }}>
            <span className="row" style={{ gap: 5 }}><span className="run-dot k-run" /> Course</span>
            <span className="row" style={{ gap: 5 }}><span className="run-dot k-walk" /> Marche</span>
          </div>
        </div>
      )}
      {!r.indoor && !r.track && <div className="small muted">Pas de tracé GPS pour cette sortie.</div>}

      {efforts.length > 0 && !r.indoor && (
        <>
          <div className="section-title">Fractions de course</div>
          <div className="card" style={{ padding: '4px 16px', gap: 0 }}>
            <div className="list-row tiny muted"><span className="grow">Fraction</span><span style={{ width: 56, textAlign: 'right' }}>Temps</span><span style={{ width: 56, textAlign: 'right' }}>km</span><span style={{ width: 56, textAlign: 'right' }}>/km</span></div>
            {efforts.map((x, i) => (
              <div key={i} className="list-row small">
                <span className="grow">{i + 1}{x.full ? '' : ' (écourtée)'}</span>
                <span style={{ width: 56, textAlign: 'right' }}>{fmtMin(x.dur)}</span>
                <span style={{ width: 56, textAlign: 'right' }}>{fmtKm(x.dist)}</span>
                <b style={{ width: 56, textAlign: 'right' }}>{fmtPace(x.dist > 50 ? x.dur / (x.dist / 1000) : undefined)}</b>
              </div>
            ))}
          </div>
          <div className="tiny muted">Une allure qui baisse au fil des fractions, c’est normal. Si les dernières sont bien plus lentes, pars plus doucement la prochaine fois.</div>
        </>
      )}

      <button className="btn primary big block" onClick={onBack}>{fresh ? 'Terminer' : 'Retour'}</button>
      {!fresh && <button className="btn danger block" onClick={() => { if (confirm('Supprimer cette sortie ?')) { s.deleteRun(r.id); onBack() } }}>Supprimer cette sortie</button>}
    </div>
  )
}

// ───────────── Programme course ─────────────
export function RunProgram({ onBack, onRun }: { onBack: () => void; onRun: (k: RunKind) => void }) {
  const s = useStore()
  const { index, adjust } = runProgress(s.runs)
  const start = runStartOf(s)
  const finished = index >= RUN_PLAN.length
  const doneIdx = new Set(s.runs.filter((r) => r.completed && r.plan >= 0).map((r) => r.plan))
  return (
    <div className="page">
      <div className="topbar">
        <button className="icon-btn" onClick={onBack} aria-label="Retour"><IconBack /></button>
        <div className="grow">
          <div className="ex-name">🏃 Programme course</div>
          <div className="small muted">{RUN_WEEKS} semaines · mercredi + dimanche · objectif 5 km</div>
        </div>
      </div>

      <div className="card">
        <div className="row between">
          <b>{finished ? 'Programme terminé 🏁' : `Sortie ${index + 1}/${RUN_PLAN.length}`}</b>
          <span className="badge">Semaine {Math.min(RUN_WEEKS, Math.floor(index / 2) + 1)}</span>
        </div>
        <div className="progress"><div style={{ width: `${(index / RUN_PLAN.length) * 100}%` }} /></div>
        {today() < start && <div className="small muted">Début le {formatDate(nextRunDay(start, start))}. Tu peux faire une sortie libre avant pour tester le GPS.</div>}
        {adjust && <div className="small" style={{ color: 'var(--warn)' }}>🦵 Genou à {adjust.knee}/10 le {fromISO(adjust.date).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })} : {adjust.kind === 'back' ? 'on a reculé d’une semaine.' : 'on refait la semaine.'}</div>}
        {!finished && <button className="btn primary block" onClick={() => onRun({ plan: index })}>Faire la sortie {index + 1} maintenant</button>}
        <div className="row">
          <button className="btn grow sm" onClick={() => onRun({ indoor: true })}>🏠 Cardio chambre</button>
          <button className="btn grow sm" onClick={() => onRun({ free: true })}>🧭 Sortie libre</button>
        </div>
      </div>

      <div className="card small" style={{ gap: 6 }}>
        <b>Les règles</b>
        <span>🗣️ <b>Allure conversation</b> : tu dois pouvoir parler en courant. Trop essoufflé = trop vite.</span>
        <span>👣 <b>Petites foulées</b>, le pied se pose sous toi, pas loin devant : c’est ce qui épargne les genoux.</span>
        <span>🦵 Après chaque sortie et le lendemain matin, tu notes ton genou. ≥ {KNEE_REPEAT}/10 : on refait la semaine. ≥ {KNEE_BACK}/10 : on recule d’une semaine.</span>
        <span>📅 Une sortie ratée ne fait rien perdre : le programme avance sortie par sortie, pas à la date.</span>
        <span>🌧️ Pas possible de sortir ? Le cardio en chambre (25 min, sans sauts) garde le souffle, sans faire avancer le programme.</span>
      </div>

      {Array.from({ length: RUN_WEEKS }, (_, w) => (
        <div key={w} className="card" style={{ padding: '10px 16px', gap: 0 }}>
          <div className="row between">
            <b className="small">Semaine {w + 1}{w >= 7 ? ' · jusqu’à 40 min' : ''}</b>
            <span className="tiny muted">{Math.round(runTime(RUN_PLAN[w * 2]))}′ de course</span>
          </div>
          {[0, 1].map((n) => {
            const i = w * 2 + n
            const r = RUN_PLAN[i]
            const st = i < index ? 'done' : i === index ? 'next' : ''
            return (
              <div key={n} className="list-row small" style={{ borderBottom: n ? 'none' : undefined, opacity: st === '' ? 0.7 : 1 }}>
                <span style={{ width: 22 }}>{st === 'done' || (doneIdx.has(i) && i < index) ? '✅' : st === 'next' ? '▶️' : '○'}</span>
                <span className="grow">{r.title}</span>
                <span className="tiny muted">≈ {runMinutes(runSteps(r))} min</span>
              </div>
            )
          })}
        </div>
      ))}
    </div>
  )
}

// ───────────── Carte « Aujourd'hui » ─────────────
export function RunTodayCard({ onRun, onOpen }: { onRun: (k: RunKind) => void; onOpen: (id: string) => void }) {
  const s = useStore()
  const d = today()
  const { index } = runProgress(s.runs)
  const doneToday = s.runs.filter((r) => r.date === d)
  const r = RUN_PLAN[index]
  if (!r) return null
  const last = doneToday.at(-1)
  return (
    <div className="card accent">
      <div className="row between">
        <div className="section-title" style={{ margin: 0 }}>Aujourd’hui · course</div>
        <span className="small muted">≈ {runMinutes(runSteps(r))} min</span>
      </div>
      {last ? (
        <>
          <div className="ex-name">✅ {last.indoor ? 'Cardio fait' : `${fmtKm(last.dist)} km`}</div>
          <button className="btn sm" style={{ alignSelf: 'flex-start' }} onClick={() => onOpen(last.id)}>Voir la sortie</button>
        </>
      ) : (
        <>
          <div>
            <div className="ex-name">🏃 {r.title}</div>
            <div className="muted small">Sortie {index + 1}/{RUN_PLAN.length} · semaine {r.week} · avant ta séance muscu</div>
          </div>
          <button className="btn primary big block" onClick={() => onRun({ plan: index })}>Partir courir</button>
          <button className="btn block" onClick={() => onRun({ indoor: true })}>🌧️ Impossible de sortir → cardio chambre</button>
        </>
      )}
    </div>
  )
}

/** Le lendemain d'une sortie : « et ce matin, le genou ? » */
export function KneeNextCard() {
  const s = useStore()
  const yesterday = addDays(today(), -1)
  const r = s.runs.filter((x) => x.date === yesterday && !x.indoor && x.plan >= 0 && x.completed && x.kneeNext === undefined).at(-1)
  const [v, setV] = useState(0)
  if (!r) return null
  return (
    <div className="card">
      <div style={{ fontWeight: 700 }}>🦵 Le genou ce matin, après la course d’hier ?</div>
      <div className="row between">
        <span className="small muted">0 = rien · 10 = très mal</span>
        <Stepper value={v} min={0} max={10} onChange={setV} />
      </div>
      <button className="btn block" onClick={() => s.setRunKnee(r.id, { kneeNext: v })}>Valider</button>
    </div>
  )
}

// ───────────── Historique : onglet Course ─────────────
export function RunHistoryTab({ onOpen, onProgram }: { onOpen: (id: string) => void; onProgram: () => void }) {
  const runs = useStore((s) => s.runs)
  const { index } = runProgress(runs)
  const b = runBests(runs)
  const perWeek = Array.from({ length: 12 }, (_, i) => {
    const m = addDays(mondayOf(today()), -7 * (11 - i))
    const km = runs.filter((r) => !r.indoor && mondayOf(r.date) === m).reduce((a, r) => a + r.dist / 1000, 0)
    const label = fromISO(m).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })
    return { key: m, label, value: Math.round(km * 10) / 10, tip: `Semaine du ${label} : ${fmtKm(km * 1000)} km` }
  })
  return (
    <>
      <div className="stats">
        <div className="stat"><span className="big-num">{index}/{RUN_PLAN.length}</span><span className="tiny muted">sorties du programme</span></div>
        <div className="stat"><span className="big-num">{b.totalKm.toFixed(1).replace('.', ',')}</span><span className="tiny muted">km au total</span></div>
        <div className="stat"><span className="big-num">{b.longest ? fmtMin(Math.round(b.longest.v / 30) * 30) : '–'}</span><span className="tiny muted">sans t’arrêter</span></div>
      </div>
      <button className="card tap" style={{ flexDirection: 'row', alignItems: 'center' }} onClick={onProgram}>
        <span style={{ fontSize: 22 }}>🗓️</span>
        <div className="grow"><div style={{ fontWeight: 600 }}>Programme course</div><div className="small muted">Les 20 sorties, les règles genoux</div></div>
        <span className="muted">›</span>
      </button>
      <div className="card">
        <div style={{ fontWeight: 700 }}>Kilomètres par semaine</div>
        <BarChart data={perWeek} />
      </div>
      <div className="section-title">Sorties</div>
      {runs.length === 0 && <div className="muted small">Aucune sortie pour l’instant.</div>}
      {runs.slice().reverse().map((r) => (
        <button key={r.id} className="card tap" onClick={() => onOpen(r.id)}>
          <div className="row between">
            <div style={{ fontWeight: 700 }}>{r.indoor ? '🏠' : '🏃'} {runTitle(r)}</div>
            {r.completed && r.plan >= 0 && <span className="small" style={{ color: 'var(--ok)' }}>✓</span>}
          </div>
          <div className="row between small muted">
            <span style={{ textTransform: 'capitalize' }}>{formatDate(r.date)}</span>
            <span>{r.indoor ? fmtDur(r.dur) : `${fmtKm(r.dist)} km · ${fmtDur(r.dur)}`}{kneeOf(r) >= KNEE_REPEAT ? ` · 🦵 ${kneeOf(r)}/10` : ''}</span>
          </div>
        </button>
      ))}
    </>
  )
}

/** Section course de l'onglet Records. */
export function RunRecords() {
  const runs = useStore((s) => s.runs)
  const b = runBests(runs)
  const short = (d: string) => fromISO(d).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })
  const next = RUN_KM_MILESTONES.find((m) => m > b.totalKm)
  const rows: [string, string, string | undefined][] = [
    ['🏁 5 km', b.fiveK ? fmtDur(b.fiveK.v) : 'pas encore', b.fiveK?.date],
    ['🏃 Plus longue course sans t’arrêter', b.longest ? fmtMin(Math.round(b.longest.v)) : '–', b.longest?.date],
    ['📏 Plus longue sortie', b.farthest ? `${fmtKm(b.farthest.v)} km` : '–', b.farthest?.date],
    ['⚡ Meilleure allure (fraction ≥ 3 min)', b.pace ? `${fmtPace(b.pace.v)} /km` : '–', b.pace?.date],
    ['🎯 Total', `${b.totalKm.toFixed(1).replace('.', ',')} km${next ? ` · prochain cap ${next}` : ''}`, undefined],
  ]
  return (
    <>
      <div className="section-title">Course</div>
      <div className="card" style={{ padding: '4px 16px', gap: 0 }}>
        {rows.map(([label, v, d]) => (
          <div key={label} className="list-row"><span className="grow small">{label}</span><b>{v}</b>{d && <span className="tiny muted" style={{ marginLeft: 8 }}>{short(d)}</span>}</div>
        ))}
      </div>
    </>
  )
}

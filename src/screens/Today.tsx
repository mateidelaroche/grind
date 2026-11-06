import { useState, type ReactNode } from 'react'
import { COACH_LINES, pick } from '../data/coach'
import { SESSIONS } from '../data/sessions'
import { GearLine, Sheet, Stepper, toast } from '../components/ui'
import {
  addDays, DAY_LONG, DAY_SHORT, dayPlan, diffDays, formatDate, legWarning, mondayOf, phaseOf, PROGRAM_WEEKS,
  isRunDay, nextRunDay, runStartOf, sessionGear, today, weekday, weekNumber,
} from '../lib/program'
import { useStore } from '../store'
import type { DayPlan, SessionId } from '../types'
import type { RunKind } from './Run'
import { KneeNextCard, RunTodayCard } from './RunViews'
import { runProgress, RUN_PLAN } from '../data/running'
import { fmtDur, fmtKm } from '../lib/gps'
import { FlexSheet, flexDue, MeasuresSheet, monthlyDue, testDue, TestsSheet, weighDue, WeighIn } from './Body'
import DaySheet from './DaySheet'

const planIcon = (p: DayPlan) => (p.type === 'session' ? '💪' : p.type === 'basket' ? '🏀' : '😴')

export default function Today({ onStart, onOpenSession, onOpenWorkout, onSettings, onFood, onPhotos, onRun, onRunOpen, onRunProgram }: {
  onStart: (s: SessionId, express: boolean) => void; onOpenSession: (s: SessionId) => void; onOpenWorkout: (id: string) => void; onSettings: () => void; onFood: () => void; onPhotos: () => void
  onRun: (k: RunKind) => void; onRunOpen: (id: string) => void; onRunProgram: () => void
}) {
  const s = useStore()
  const d = today()
  const week = weekNumber(d, s.startDate)
  const phase = phaseOf(week)
  const plan = dayPlan(d, s.overrides)
  const [moving, setMoving] = useState(false)
  const [sheet, setSheet] = useState<'tests' | 'measures' | 'flex'>()
  const testId = testDue(week, s.tests)
  const doneOn = (date: string) => s.workouts.filter((w) => w.date === date && w.completed && SESSIONS[w.session].kind === 'muscu')
  const doneToday = doneOn(d)
  const basket = s.basket[d]
  const runStart = runStartOf(s)
  const runDone = runProgress(s.runs).index >= RUN_PLAN.length
  const runDay = (date: string) => isRunDay(date, runStart, runDone)
  const runToday = runDay(d) || s.runs.some((r) => r.date === d)

  const [weekOff, setWeekOff] = useState(0)
  const [dayOpen, setDayOpen] = useState<string>()
  const monday = addDays(mondayOf(d), weekOff * 7)
  const days = Array.from({ length: 7 }, (_, i) => addDays(monday, i))

  const opts = { week, express: false, levels: s.levels, edits: s.edits, timeTargets: s.timeTargets }

  // Étirements du matin : en haut de l'écran jusqu'à midi, puis plus bas ; série de jours d'affilée.
  const stretchedOn = (date: string) => s.workouts.some((w) => w.date === date && w.session === 'MATIN' && w.completed)
  const stretchedToday = stretchedOn(d)
  let streak = 0
  for (let k = stretchedToday ? 0 : 1; stretchedOn(addDays(d, -k)); k++) streak++
  const morning = new Date().getHours() < 12
  const runsToday = s.runs.filter((r) => r.date === d)
  const routinesToday = s.workouts.filter((w) => w.date === d && w.completed && SESSIONS[w.session].kind === 'routine' && w.session !== 'MATIN')
  const flexToDo = flexDue(s.flex) && stretchedToday
  const pendingTests = flexToDo || !!testId || (weighDue(s.weights) && weekday(d) === 0) || (monthlyDue(Object.keys(s.measures)) && weekday(d) <= 1)
  const allDone = stretchedToday && !pendingTests
    && (plan.type !== 'session' || doneToday.length > 0)
    && (plan.type !== 'basket' || !!basket?.done)
    && (!runToday || runsToday.length > 0)
  const line = (key: string, label: string, detail: string, onClick?: () => void, extra?: ReactNode) => (
    <div key={key} className="list-row">
      <button className="row grow" style={{ textAlign: 'left', gap: 8 }} onClick={onClick} disabled={!onClick}>
        <span className="grow" style={{ fontWeight: 650 }}>✅ {label}</span>
        <span className="small muted">{detail}{onClick ? ' ›' : ''}</span>
      </button>
      {extra}
    </div>
  )
  const mins = (w: { startedAt: number; endedAt?: number }) => (w.endedAt ? `${Math.max(1, Math.round((w.endedAt - w.startedAt) / 60000))} min` : '')
  const doneLines = [
    ...s.workouts.filter((w) => w.date === d && w.session === 'MATIN' && w.completed).slice(-1).map((w) => line(w.id, 'Étirements du matin', `${mins(w)}${streak > 1 ? ` · 🔥 ${streak} j` : ''}`, () => onOpenWorkout(w.id))),
    ...runsToday.map((r) => line(r.id, r.indoor ? 'Cardio en chambre' : 'Course', r.dist > 0 ? `${fmtKm(r.dist)} km` : fmtDur(r.dur), () => onRunOpen(r.id))),
    ...doneToday.map((w) => line(w.id, SESSIONS[w.session].name, mins(w), () => onOpenWorkout(w.id))),
    ...routinesToday.map((w) => line(w.id, SESSIONS[w.session].name, mins(w), () => onOpenWorkout(w.id))),
    ...(plan.type === 'basket' && basket?.done ? [line('basket', plan.match ? 'Match' : 'Basket', 'genou', undefined, (
      <Stepper value={basket.knee ?? 0} min={0} max={10} onChange={(v) => s.setBasket(d, { done: true, knee: v })} format={(v) => `${v}/10`} />
    ))] : []),
  ]
  const matinCard = (
    <div className={`card ${morning && !stretchedToday ? 'accent' : ''}`}>
      <div className="row between">
        <div>
          <div style={{ fontWeight: 700 }}>🧘 Étirements du matin</div>
          <div className="small muted">{SESSIONS.MATIN.duration} · dos, hanches, ischios, mollets, épaules</div>
        </div>
        {streak > 0 && <span className="badge" title="Jours d'affilée">🔥 {streak} j</span>}
      </div>
      {stretchedToday ? (
        <div className="badge ok" style={{ height: 32, alignSelf: 'flex-start' }}>✅ Fait aujourd’hui</div>
      ) : (
        <button className={`btn block ${morning ? 'primary big' : ''}`} onClick={() => onStart('MATIN', false)}>{morning ? 'Commencer' : 'Faire mes étirements'}</button>
      )}
    </div>
  )

  const nextSession = () => {
    for (let i = 1; i < 8; i++) {
      const date = addDays(d, i)
      const p = dayPlan(date, s.overrides)
      if (p.type === 'session') return `${SESSIONS[p.session].name} ${i === 1 ? 'demain' : DAY_LONG[weekday(date)].toLowerCase()}`
    }
  }

  const move = (target: string) => {
    if (plan.type !== 'session') return
    s.setOverride(d, 'rest')
    s.setOverride(target, plan.session)
    setMoving(false)
    toast(`${SESSIONS[plan.session].name} déplacée à ${DAY_LONG[weekday(target)].toLowerCase()}.`)
  }

  return (
    <div className="page">
      <div className="stack" style={{ gap: 2 }}>
        <div className="muted small" style={{ textTransform: 'capitalize' }}>{formatDate(d)}</div>
        <div className="page-title">Salut Matei 👋</div>
      </div>

      {/* Synchro activée mais en panne : les données récentes ne sont sauvegardées que sur le téléphone. */}
      {s.sync.token && (s.sync.status === 'error' || (s.sync.lastSync && Date.now() - s.sync.lastSync > 3 * 864e5)) && (
        <button className="card tap" style={{ borderColor: 'var(--warn)' }} onClick={onSettings}>
          <div style={{ fontWeight: 700, color: 'var(--warn)' }}>⚠️ Sauvegarde cloud en panne</div>
          <div className="small muted">{s.sync.status === 'error' ? `Erreur : ${s.sync.error ?? 'inconnue'}.` : 'Pas de synchro depuis plus de 3 jours.'} Tes dernières données ne sont que sur ce téléphone. Touche pour vérifier.</div>
        </button>
      )}

      {s.active && (
        <button className="card tap accent" onClick={() => onStart(s.active!.session, s.active!.express)}>
          <div style={{ fontWeight: 700 }}>▶️ Séance en cours : {SESSIONS[s.active.session].name}</div>
          <div className="small muted">Touche pour reprendre là où tu t’es arrêté.</div>
        </button>
      )}

      {/* À faire aujourd'hui : uniquement ce qui reste ; ce qui est fait descend en une ligne plus bas */}
      <div className="section-title">À faire aujourd’hui</div>
      {!stretchedToday && matinCard}
      {runToday && !runsToday.length && <RunTodayCard onRun={onRun} onOpen={onRunOpen} />}
      {plan.type === 'session' && !doneToday.length && (() => {
        const ses = SESSIONS[plan.session]
        return (
          <div className="card accent">
            <div className="row between">
              <div className="section-title" style={{ margin: 0 }}>{runToday ? 'Après la course' : 'Aujourd’hui'}{plan.moved ? ' · déplacée' : ''}</div>
              <span className="small muted">{ses.duration}</span>
            </div>
            <div>
              <div className="ex-name">{ses.name}</div>
              <div className="muted">{ses.subtitle}</div>
            </div>
            {legWarning(plan.session, d) && <div className="badge warn" style={{ height: 'auto', padding: 8 }}>⚠️ Jambes la veille d’un basket : allège ou décale si tu peux.</div>}
            {(
              <>
                <GearLine gear={sessionGear(plan.session, opts)} />
                <button className="btn primary big block" onClick={() => onStart(plan.session, false)}>Démarrer</button>
                <div className="row">
                  <button className="btn grow" onClick={() => onStart(plan.session, true)}>⚡ Express {ses.expressDuration}</button>
                  <button className="btn grow" onClick={() => setMoving(true)}>📅 Déplacer</button>
                </div>
              </>
            )}
            <button className="btn sm ghost" style={{ alignSelf: 'flex-start' }} onClick={() => onOpenSession(plan.session)}>Voir le détail de la séance</button>
          </div>
        )
      })()}

      {plan.type === 'basket' && !basket?.done && (
        <div className="card accent">
          <div className="section-title" style={{ margin: 0 }}>Aujourd’hui</div>
          <div className="ex-name">🏀 {plan.match ? 'Match' : 'Basket'} ce soir · 20h30</div>
          <div className="muted small">Fais ta routine genoux avant de partir. Jamais de jambes ni de séries à fond avant le basket.</div>
          <button className="btn primary big block" onClick={() => onStart('GENOUX', false)}>🦵 Routine genoux · 7 min</button>
          {!plan.match && <button className="btn block" onClick={() => onStart('BONUS', false)}>Bonus avant basket · 12 min</button>}
          <div className="list-row" style={{ borderTop: '1px solid var(--border)', paddingTop: 12 }}>
            <div className="grow">
              <div style={{ fontWeight: 600 }}>Basket fait</div>
              <div className="small muted">Pour ton suivi de régularité</div>
            </div>
            <button className={`btn sm ${basket?.done ? 'primary' : ''}`} onClick={() => s.setBasket(d, basket?.done ? undefined : { done: true })}>{basket?.done ? '✓ Fait' : 'Marquer'}</button>
          </div>
        </div>
      )}

      {/* À faire : tests, pesée, mensurations */}
      {testId && (
        <div className="card">
          <div style={{ fontWeight: 700 }}>🧪 Tests {testId} à faire</div>
          <div className="small muted">{testId === 'S0' ? 'Avant ta 1re séance : idéalement un jour de repos (dimanche). ~15 min, juste saisir les résultats.' : 'C’est la semaine des tests : compare-toi à toi-même.'}</div>
          <button className="btn block" onClick={() => setSheet('tests')}>Saisir mes résultats</button>
        </div>
      )}
      {weighDue(s.weights) && weekday(d) === 0 && (
        <div className="card">
          <div style={{ fontWeight: 700 }}>⚖️ Pesée du lundi</div>
          <div className="small muted">Au réveil, après les toilettes, avant de manger.</div>
          <WeighIn compact />
        </div>
      )}
      {monthlyDue(Object.keys(s.measures)) && weekday(d) <= 1 && (
        <div className="card">
          <div style={{ fontWeight: 700 }}>📏 Mensurations & photos du mois</div>
          <div className="small muted">5 minutes : bras, poitrine, taille, cuisses, puis 3 photos (face, profil, dos).</div>
          <div className="row">
            <button className="btn grow" onClick={() => setSheet('measures')}>Mensurations</button>
            <button className="btn grow" onClick={onPhotos}>Photos</button>
          </div>
        </div>
      )}

      <KneeNextCard />

      {flexToDo && (
        <div className="card">
          <div style={{ fontWeight: 700 }}>🧘 Test de souplesse du mois</div>
          <div className="small muted">1 minute, juste après tes étirements : mesure la distance doigts-sol, jambes tendues. Pour voir tes progrès.</div>
          <button className="btn block" onClick={() => setSheet('flex')}>Faire le test</button>
        </div>
      )}
      {allDone && (
        <div className="card accent" style={{ alignItems: 'center', textAlign: 'center' }}>
          <div className="ex-name">Journée bouclée 💪</div>
          <div className="small muted">Tout ce qui était prévu aujourd’hui est fait. {plan.type === 'rest' || doneToday.length ? 'Récupère bien.' : ''}</div>
        </div>
      )}
      {plan.type === 'rest' && !allDone && (
        <div className="card accent">
          <div className="section-title" style={{ margin: 0 }}>Aujourd’hui</div>
          <div className="ex-name">😴 Repos</div>
          <div className="muted small">C’est pendant le repos que tu grossis. {nextSession() ? `Prochaine : ${nextSession()}.` : ''}</div>
          {s.overrides[d] === 'rest' && (
            <button className="btn sm" style={{ alignSelf: 'flex-start' }} onClick={() => {
              const moved = Object.entries(s.overrides).find(([k, v]) => k > d && v !== 'rest')
              s.setOverride(d, undefined)
              if (moved) s.setOverride(moved[0], undefined)
            }}>Annuler le déplacement</button>
          )}
        </div>
      )}


      <div className="row between week-head">
        <button className="icon-btn" aria-label="Semaine précédente" onClick={() => setWeekOff(weekOff - 1)}>‹</button>
        <button className="grow center" onClick={() => setWeekOff(0)}>
          <div className="section-title" style={{ margin: 0 }}>{weekOff === 0 ? 'Cette semaine' : weekOff === -1 ? 'Semaine dernière' : weekOff === 1 ? 'Semaine prochaine' : `Semaine du ${formatDate(monday).split(' ').slice(1).join(' ')}`}</div>
          <div className="tiny muted">{weekOff === 0 ? 'Touche un jour pour le détail' : 'Touche ici pour revenir à cette semaine'}</div>
        </button>
        <button className="icon-btn" aria-label="Semaine suivante" onClick={() => setWeekOff(weekOff + 1)}>›</button>
      </div>
      <div className="week">
        {days.map((date, i) => {
          const p = dayPlan(date, s.overrides)
          const done = doneOn(date).length > 0 || (p.type === 'basket' && s.basket[date]?.done)
          const run = runDay(date)
          return (
            <button key={date} className={`day ${date === d ? 'today' : ''} ${done ? 'done' : ''}`} onClick={() => setDayOpen(date)}>
              <span>{DAY_SHORT[i]} {date.slice(8).replace(/^0/, '')}</span>
              <span className="ic">{done ? '✅' : run ? '🏃' : planIcon(p)}</span>
              <span>{run && p.type === 'session' ? `+${p.session}` : run ? 'course' : p.type === 'session' ? p.session : p.type === 'basket' ? (p.match ? 'match' : 'bask.') : '—'}</span>
            </button>
          )
        })}
      </div>
      {dayOpen && (
        <DaySheet
          date={dayOpen}
          onClose={() => setDayOpen(undefined)}
          onOpenWorkout={(id) => { setDayOpen(undefined); onOpenWorkout(id) }}
          onOpenSession={(sid) => { setDayOpen(undefined); onOpenSession(sid) }}
          onOpenRun={(id) => { setDayOpen(undefined); onRunOpen(id) }}
        />
      )}

      {!runDone && d < runStart && diffDays(runStart, d) <= 21 && (
        <button className="card tap" style={{ flexDirection: 'row', alignItems: 'center' }} onClick={onRunProgram}>
          <span style={{ fontSize: 22 }}>🏃</span>
          <div className="grow">
            <div style={{ fontWeight: 600 }}>La course commence {formatDate(nextRunDay(runStart, runStart))}</div>
            <div className="small muted">D’ici là, fais une petite sortie libre (même en marchant) pour tester le GPS.</div>
          </div>
          <span className="muted">›</span>
        </button>
      )}

      {/* Fait aujourd'hui : une ligne par chose faite, vers le récap */}
      {doneLines.length > 0 && (
        <>
          <div className="section-title">Fait aujourd’hui</div>
          <div className="card" style={{ padding: '4px 16px', gap: 0 }}>{doneLines}</div>
          {basket?.done && (basket.knee ?? 0) > 5 && <div className="small" style={{ color: 'var(--warn)' }}>Genou au-dessus de 5/10 : allège la prochaine séance jambes. Si ça dure plus de 2-3 semaines, va voir un kiné.</div>}
        </>
      )}

      {s.settings.coach && (
        <div className="card" style={{ flexDirection: 'row', alignItems: 'center' }}>
          <span style={{ fontSize: 26 }}>🗣️</span>
          <div className="small"><b>Coach :</b> {pick(COACH_LINES)}</div>
        </div>
      )}

      <button className="card tap" style={{ flexDirection: 'row', alignItems: 'center' }} onClick={onFood}>
        <span style={{ fontSize: 22 }}>🍽️</span>
        <div className="grow">
          <div style={{ fontWeight: 600 }}>Alimentation</div>
          <div className="small muted">3 réflexes zéro effort, si tu veux</div>
        </div>
        <span className="muted">›</span>
      </button>

      {/* Programme */}
      <div className="card">
        <div className="row between">
          <div style={{ fontWeight: 700 }}>{week === 0 ? 'Programme 12 semaines' : `Semaine ${week}${week <= PROGRAM_WEEKS ? `/${PROGRAM_WEEKS}` : ''}`}</div>
          <span className="badge">{phase.name}</span>
        </div>
        {week === 0 ? (
          <div className="small muted">Début lundi {formatDate(s.startDate).split(' ').slice(1).join(' ')} (J-{diffDays(s.startDate, d)}). D’ici là, tu peux déjà tester les séances pour prendre tes marques.</div>
        ) : (
          <div className="small muted">{phase.desc}</div>
        )}
        <div className="progress"><div style={{ width: `${Math.min(100, (Math.max(0, diffDays(d, s.startDate) + 1) / (PROGRAM_WEEKS * 7)) * 100)}%` }} /></div>
      </div>

      {sheet === 'tests' && <TestsSheet initial={testId} onClose={() => setSheet(undefined)} />}
      {sheet === 'measures' && <MeasuresSheet onClose={() => setSheet(undefined)} />}
      {sheet === 'flex' && <FlexSheet onClose={() => setSheet(undefined)} />}

      {moving && plan.type === 'session' && (
        <Sheet onClose={() => setMoving(false)}>
          <div className="ex-name">Déplacer {SESSIONS[plan.session].name}</div>
          <div className="small muted">Choisis un jour libre : une journée ne peut contenir qu’une séance ou un basket.</div>
          {Array.from({ length: 6 }, (_, i) => addDays(d, i + 1)).map((date) => {
            const p = dayPlan(date, s.overrides)
            const warn = legWarning(plan.session, date)
            const busy = p.type !== 'rest'
            return (
              <button key={date} className="level" disabled={busy} style={busy ? { opacity: 0.5 } : undefined} onClick={() => move(date)}>
                <span style={{ fontSize: 20 }}>{planIcon(p)}</span>
                <span className="grow">
                  <span style={{ fontWeight: 600, textTransform: 'capitalize' }}>{formatDate(date)}</span>
                  <span className="small muted" style={{ display: 'block' }}>
                    {p.type === 'session' ? `Déjà : ${SESSIONS[p.session].name}, choisis un autre jour` : p.type === 'basket' ? 'Basket ce jour-là, choisis un autre jour' : 'Libre'}
                    {warn && <span style={{ color: 'var(--warn)' }}> · ⚠️ veille de basket</span>}
                  </span>
                </span>
              </button>
            )
          })}
        </Sheet>
      )}
    </div>
  )
}

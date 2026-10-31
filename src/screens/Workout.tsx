import { useEffect, useMemo, useRef, useState } from 'react'
import { EXERCISES } from '../data/exercises'
import { SESSIONS } from '../data/sessions'
import { HowTo } from '../components/ExerciseInfo'
import MuscleMap from '../components/MuscleMap'
import Demo from '../anim/Demo'
import Figure from '../anim/Figure'
import { workOf } from '../data/muscles'
import { IconBack, IconCheck, IconClose, IconGuided, IconInfo, IconList, IconMetro, IconNext, IconPause, IconPlay } from '../components/icons'
import { fmtTime, GearChips, Sheet } from '../components/ui'
import { beep, keepAwake, say, unlockAudio } from '../lib/audio'
import { animOf, buildSteps, gearForExercise, levelOf, sessionGear, today, weekNumber, type Step } from '../lib/program'
import { useCountdown, useMetronome } from '../lib/timer'
import { useStore, type ActiveSession } from '../store'
import type { Workout } from '../types'

const PHASE_TITLE = { warmup: 'Échauffement', main: 'Séance', cooldown: 'Retour au calme' }

function useSteps(active: ActiveSession) {
  const s = useStore()
  const week = weekNumber(today(), s.startDate)
  return useMemo(
    () => buildSteps(active.session, { week, express: active.express, levels: s.levels, edits: s.edits, timeTargets: s.timeTargets }),
    // Figé au démarrage de la séance (sauf changement de niveau).
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [active.workoutId, s.levels],
  )
}

function stepTitle(st: Step) {
  const ex = st.ex ? EXERCISES[st.ex] : undefined
  return `${st.label ?? ''} ${ex?.name ?? ''}`.trim()
}

function announce(st: Step) {
  if (st.kind === 'rest') return say(`Repos, ${st.rest} secondes`)
  const ex = EXERCISES[st.ex!]
  const side = st.side ? `, côté ${st.side}` : ''
  say(st.rounds && st.rounds > 1 ? `${ex.name}${side}, série ${st.round} sur ${st.rounds}` : `${ex.name}${side}`)
}

function Ring({ value, total, children }: { value: number; total: number; children: React.ReactNode }) {
  const r = 46
  const c = 2 * Math.PI * r
  const k = total > 0 ? Math.max(0, Math.min(1, value / total)) : 0
  return (
    <div className="ring">
      <svg viewBox="0 0 100 100">
        <circle cx="50" cy="50" r={r} stroke="var(--surface-2)" strokeWidth="6" fill="none" />
        <circle cx="50" cy="50" r={r} stroke="var(--accent-hi)" strokeWidth="6" fill="none" strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * (1 - k)} style={{ transition: 'stroke-dashoffset 0.15s linear' }} />
      </svg>
      <div className="val">{children}</div>
    </div>
  )
}

type Nav = { prev?: () => void; next: () => void }

/** Barre fixée en bas, à portée de pouce : précédent · action principale · passer. */
function ActionBar({ nav, children }: { nav?: Nav; children: React.ReactNode }) {
  return (
    <div className="wk-bar">
      {nav && <button className="wk-side" aria-label="Précédent" disabled={!nav.prev} onClick={nav.prev}><IconBack /><span>Préc.</span></button>}
      <div className="wk-main">{children}</div>
      {nav && <button className="wk-side" aria-label="Passer" onClick={nav.next}><IconNext /><span>Passer</span></button>}
    </div>
  )
}

// ───────────── Repos ─────────────
export function RestTimer({ seconds, resetKey, onDone, nextLabel, nextAnim, feedback }: {
  seconds: number; resetKey: string; onDone: () => void; nextLabel?: string; nextAnim?: string; feedback?: React.ReactNode
}) {
  const t = useCountdown(seconds, { autoStart: true, resetKey, onEnd: () => { say('C’est reparti'); onDone() } })
  return (
    <div className="workout-body wk rest">
      <div className="wk-center">
        <div className="section-title">Repos</div>
        <div className="timer">
          <Ring value={t.remaining} total={t.total}>{fmtTime(t.remaining)}<small>sur {fmtTime(t.total)}</small></Ring>
        </div>
        <div className="adjust">
          <button className="btn" onClick={() => t.add(-15)}>−15 s</button>
          <button className="btn" onClick={t.state === 'paused' ? t.resume : t.pause}>{t.state === 'paused' ? <><IconPlay /> Reprendre</> : <><IconPause /> Pause</>}</button>
          <button className="btn" onClick={() => t.add(15)}>+15 s</button>
        </div>
      </div>
      {nextLabel && (
        <div className="next-up">
          {nextAnim && <Figure anim={nextAnim} keyIndex={0} playing={false} className="figure mini" />}
          <div className="grow"><div className="tiny muted">ENSUITE</div><b>{nextLabel}</b></div>
        </div>
      )}
      {feedback}
      <ActionBar><button className="btn primary big block" onClick={onDone}>Passer le repos <IconNext /></button></ActionBar>
    </div>
  )
}

// ───────────── Exercice en temps ─────────────
/** onDone reçoit le temps réellement tenu (s). */
function TimedWork({ step, onDone, nav }: { step: Step; onDone: (held: number) => void; nav?: Nav }) {
  const setTimeTarget = useStore((s) => s.setTimeTarget)
  const totalRef = useRef(step.duration ?? 30)
  const t = useCountdown(step.duration ?? 30, { prep: 3, autoStart: !!step.autoStart, resetKey: step.key, onEnd: () => onDone(totalRef.current) })
  totalRef.current = t.total
  const running = t.state === 'run' || t.state === 'prep'
  const changeTarget = (d: number) => {
    t.add(d)
    if (step.phase === 'main' && step.ex) setTimeTarget(step.ex, Math.max(5, (step.duration ?? 30) + d))
  }
  return (
    <>
      <div className="wk-center">
        <div className="reps-pad">
          {t.state === 'idle' && <button className="reps-btn sec" aria-label="5 secondes de moins" onClick={() => changeTarget(-5)}>−5</button>}
          <div className="timer">
            <Ring value={t.state === 'idle' ? t.total : t.remaining} total={t.total}>
              {t.state === 'prep' ? <>{t.prepLeft}<small>prépare-toi</small></> : <>{fmtTime(t.state === 'idle' ? t.total : t.remaining)}<small>{step.side ? `côté ${step.side}` : 'secondes'}</small></>}
            </Ring>
          </div>
          {t.state === 'idle' && <button className="reps-btn sec" aria-label="5 secondes de plus" onClick={() => changeTarget(5)}>+5</button>}
        </div>
        {t.state !== 'idle' && <button className="btn sm ghost" onClick={() => onDone(t.state === 'prep' ? 0 : Math.round(t.total - t.remaining))}>Terminer maintenant</button>}
      </div>
      <ActionBar nav={nav}>
        {t.state === 'idle' && <button className="btn primary big block" onClick={() => { unlockAudio(); t.start() }}><IconPlay /> Démarrer</button>}
        {running && <button className="btn big block" onClick={t.pause}><IconPause /> Pause</button>}
        {t.state === 'paused' && <button className="btn primary big block" onClick={t.resume}><IconPlay /> Reprendre</button>}
      </ActionBar>
    </>
  )
}

// ───────────── Reps ─────────────
/** Reps proposées : celles de la dernière fois sur la même série, sinon le bas de la fourchette. */
function prefillReps(st: Step, session: string, workouts: Workout[], currentId: string): number {
  for (let k = workouts.length - 1; k >= 0; k--) {
    const w = workouts[k]
    if (w.id === currentId || w.session !== session) continue
    const r = st.recKey ? w.sets[st.recKey] : undefined
    if (r && r.ex === st.ex && r.reps?.length) return r.reps[Math.min((st.round ?? 1) - 1, r.reps.length - 1)]
  }
  const n = parseInt(st.item?.reps ?? '', 10)
  return Number.isFinite(n) ? n : 10
}

function RepsPad({ value, onChange, unit }: { value: number; onChange: (v: number) => void; unit: string }) {
  return (
    <div className="reps-pad">
      <button className="reps-btn" aria-label="Une rep de moins" onClick={() => onChange(Math.max(0, value - 1))}>−</button>
      <div className="reps-val"><b>{value}</b><small>{unit}</small></div>
      <button className="reps-btn" aria-label="Une rep de plus" onClick={() => onChange(value + 1)}>+</button>
    </div>
  )
}

/** Consignes complètes, matériel et muscles : dans une fenêtre, pour garder l'écran de séance lisible. */
function HowToSheet({ exId, level, onClose }: { exId: string; level: number; onClose: () => void }) {
  const ex = EXERCISES[exId]
  const mastered = useStore((s) => !!s.mastered[exId])
  const setMastered = useStore((s) => s.setMastered)
  return (
    <Sheet onClose={onClose}>
      <div className="ex-name">{ex.name}</div>
      <GearChips gear={gearForExercise(exId, level)} />
      <HowTo exId={exId} />
      <MuscleMap work={workOf(exId)} compact />
      <button className="btn block" onClick={() => { setMastered(exId, !mastered); onClose() }}>
        {mastered ? 'Réafficher le résumé pendant la séance' : '✓ J’ai compris, masquer le résumé'}
      </button>
    </Sheet>
  )
}

// ───────────── Vue guidée ─────────────
function Guided({ steps, active, onValidate, onUnvalidate, onFinish }: {
  steps: Step[]; active: ActiveSession; onValidate: (i: number, held?: number, reps?: number) => void; onUnvalidate: (i: number) => void; onFinish: () => void
}) {
  const setStep = useStore((s) => s.setStep)
  const flagSet = useStore((s) => s.flagSet)
  const workout = useStore((s) => s.workouts.find((w) => w.id === active.workoutId))
  const i = Math.min(active.stepIndex, steps.length - 1)
  const st = steps[i]

  useEffect(() => { announce(st) }, [st.key]) // eslint-disable-line react-hooks/exhaustive-deps

  const go = (j: number) => (j >= steps.length ? onFinish() : setStep(Math.max(0, j)))
  const nav: Nav = { prev: i > 0 ? () => go(i - 1) : undefined, next: () => go(i + 1) }
  const nextWork = steps.slice(i + 1).find((x) => x.kind === 'work')
  const nextLabel = nextWork && `${stepTitle(nextWork)}${nextWork.rounds && nextWork.rounds > 1 ? ` · série ${nextWork.round}/${nextWork.rounds}` : ''}${nextWork.side ? ` · ${nextWork.side}` : ''}`

  if (st.kind === 'rest') {
    // Ressenti optionnel sur les exos du tour qui vient de se terminer
    const prev: Step[] = []
    for (let j = i - 1; j >= 0 && steps[j].kind === 'work'; j--) if (steps[j].recKey && !prev.some((p) => p.recKey === steps[j].recKey)) prev.unshift(steps[j])
    const feedback = prev.length > 0 && workout && (
      <div className="card" style={{ gap: 8 }}>
        <div className="small muted">Ressenti (facultatif)</div>
        {prev.map((p) => {
          const rec = workout.sets[p.recKey!]
          return (
            <div className="row between" key={p.key}>
              <span className="small grow">{EXERCISES[p.ex!].name}</span>
              <button className={`chip tap ${rec?.flags.includes('hard') ? 'on' : ''}`} style={rec?.flags.includes('hard') ? { borderColor: 'var(--warn)', color: 'var(--warn)' } : {}} onClick={() => flagSet(p.recKey!, 'hard')}>😮‍💨 Dur</button>
              <button className="chip tap" style={rec?.flags.includes('easy') ? { borderColor: 'var(--ok)', color: 'var(--ok)' } : {}} onClick={() => flagSet(p.recKey!, 'easy')}>😎 Facile</button>
            </div>
          )
        })}
      </div>
    )
    const nextAnim = nextWork?.ex ? animOf(nextWork.ex, nextWork.level ?? 0) : undefined
    return <RestTimer seconds={st.rest!} resetKey={st.key} onDone={() => go(i + 1)} nextLabel={nextLabel} nextAnim={nextAnim} feedback={feedback} />
  }

  const sameRoundNext = steps[i + 1]?.kind === 'work' && steps[i + 1].phase === st.phase && steps[i + 1].label?.[0] === st.label?.[0] && steps[i + 1].label !== st.label
  return (
    <WorkStep
      key={st.key}
      st={st}
      active={active}
      done={!!active.done[st.key]}
      nav={nav}
      superset={sameRoundNext ? nextLabel : undefined}
      onValidate={(held, reps) => onValidate(i, held, reps)}
      onUnvalidate={() => onUnvalidate(i)}
    />
  )
}

function WorkStep({ st, active, done, nav, superset, onValidate, onUnvalidate }: {
  st: Step; active: ActiveSession; done: boolean; nav: Nav; superset?: string
  onValidate: (held?: number, reps?: number) => void; onUnvalidate: () => void
}) {
  const ex = EXERCISES[st.ex!]
  const level = st.level ?? 0
  const lvl = levelOf(st.ex!, level)
  const mastered = useStore((s) => !!s.mastered[st.ex!])
  const metronomeSetting = useStore((s) => s.settings.metronome)
  const [metro, setMetro] = useState(false)
  const [info, setInfo] = useState(false)
  const counted = !!st.recKey && !st.duration
  const [reps, setReps] = useState(() => (counted ? prefillReps(st, active.session, useStore.getState().workouts, active.workoutId) : 0))
  useMetronome(st.item?.tempo, metro)

  const unit = `reps${st.item?.reps?.includes('/') ? ' / ' + st.item.reps.split('/ ')[1] : ''}`
  const detail = [
    st.item?.duration ? st.item.durationLabel && `Fourchette ${st.item.durationLabel}` : st.item?.reps && `Objectif ${st.item.reps}`,
    st.phase === 'main' && st.rounds! > 1 ? 'RIR 1-2' : '',
    st.item?.tempo ? `tempo ${st.item.tempo}` : '',
    st.item?.note ?? '',
  ].filter(Boolean).join(' · ')

  return (
    <div className="workout-body wk">
      <div className="wk-head">
        <div className="row wrap" style={{ gap: 6 }}>
          {st.label && st.phase === 'main' && <span className="badge lg">{st.label}</span>}
          {st.rounds! > 1 && <span className="badge lg">Série {st.round}/{st.rounds}</span>}
          {st.side && <span className="badge lg">Côté {st.side}</span>}
          {st.restPause && <span className="badge lg warn">Rest-pause</span>}
          {done && <span className="badge lg ok">Validée ✓</span>}
        </div>
        <div className="ex-name">{ex.name}</div>
        {lvl && ex.levels!.length > 1 && <div className="small muted">{lvl.label}</div>}
        {superset && <div className="small" style={{ color: 'var(--warn)' }}>⚡ Enchaîne <b>sans repos</b> avec {superset}</div>}
      </div>

      <div className="wk-fig"><Demo anim={animOf(st.ex!, level)} band={lvl?.band} /></div>

      <div className="row wrap" style={{ gap: 8 }}>
        <button className="btn sm" onClick={() => setInfo(true)}><IconInfo /> Consignes</button>
        {metronomeSetting && st.item?.tempo && (
          <button className={`btn sm ${metro ? 'primary' : ''}`} onClick={() => { unlockAudio(); setMetro(!metro) }}><IconMetro /> {st.item.tempo}</button>
        )}
        <GearChips gear={gearForExercise(st.ex!, level)} />
      </div>
      {!mastered && <p className="wk-cue" onClick={() => setInfo(true)}>▶️ {ex.execution}</p>}
      {st.restPause && <div className="next-hint">🔥 <b>Rest-pause</b> : à 1 rep de l’échec, pose-toi 15 s, puis refais le max de reps.</div>}

      {st.duration ? (
        <TimedWork step={st} nav={nav} onDone={(held) => onValidate(held)} />
      ) : (
        <>
          <div className="wk-center">
            {counted && !done ? (
              <RepsPad value={reps} onChange={setReps} unit={unit} />
            ) : (
              <div className="reps-val"><b>{st.item?.reps?.split(' ')[0]}</b><small>{unit}</small></div>
            )}
            {detail && <div className="small muted center">{detail}</div>}
            {done && <button className="btn sm ghost" onClick={onUnvalidate}>Annuler la validation</button>}
          </div>
          <ActionBar nav={nav}>
            {done ? (
              <button className="btn primary big block" onClick={nav.next}>Suivant <IconNext /></button>
            ) : (
              <button className="btn primary big block" onClick={() => { unlockAudio(); onValidate(undefined, counted ? reps : undefined) }}>
                <IconCheck /> {counted ? 'Valider' : 'Fait'}
              </button>
            )}
          </ActionBar>
        </>
      )}
      {info && <HowToSheet exId={st.ex!} level={level} onClose={() => setInfo(false)} />}
    </div>
  )
}

// ───────────── Vue liste ─────────────
function ListView({ steps, active, onToggle, onFinish }: {
  steps: Step[]; active: ActiveSession; onToggle: (i: number, held?: number) => void; onFinish: () => void
}) {
  const [rest, setRest] = useState<number>()
  const [timed, setTimed] = useState<number>()
  // Regroupe les étapes par phase → bloc → exercice
  const groups = useMemo(() => {
    const out: { phase: Step['phase']; label: string; ex: string; level: number; item: Step['item']; idx: number[]; rest?: number }[] = []
    steps.forEach((st, i) => {
      if (st.kind === 'rest') {
        const last = [...out].reverse().find((g) => g.phase === st.phase)
        if (last) last.rest = st.rest
        return
      }
      const key = `${st.phase}:${st.label}:${st.ex}`
      let g = out.find((x) => `${x.phase}:${x.label}:${x.ex}` === key)
      if (!g) { g = { phase: st.phase, label: st.label ?? '', ex: st.ex!, level: st.level ?? 0, item: st.item, idx: [] }; out.push(g) }
      g.idx.push(i)
    })
    return out
  }, [steps])

  let lastPhase = ''
  return (
    <div className="workout-body">
      {groups.map((g) => {
        const header = g.phase !== lastPhase ? PHASE_TITLE[g.phase] : undefined
        lastPhase = g.phase
        const ex = EXERCISES[g.ex]
        return (
          <div key={`${g.phase}${g.label}${g.ex}`} className="stack" style={{ gap: 8 }}>
            {header && <div className="section-title">{header}</div>}
            <div className="card" style={{ gap: 8 }}>
              <div className="row between">
                <div className="grow">
                  <div style={{ fontWeight: 700 }}>{g.phase === 'main' && <span className="badge" style={{ marginRight: 8 }}>{g.label}</span>}{ex.name}</div>
                  <div className="small muted">
                    {g.item?.duration ? g.item.durationLabel : `${g.item?.reps} reps`}
                    {g.item?.tempo ? ` · tempo ${g.item.tempo}` : ''}
                    {g.rest ? ` · repos ${g.rest} s` : ''}
                  </div>
                </div>
              </div>
              <GearChips gear={gearForExercise(g.ex, g.level)} />
              <div className="row between">
                <div className="sets">
                  {g.idx.map((si, n) => (
                    <button key={si} className={`set ${active.done[steps[si].key] ? 'on' : ''}`} onClick={() => (steps[si].duration && !active.done[steps[si].key] ? setTimed(si) : onToggle(si))}>
                      {steps[si].side ? steps[si].side![0].toUpperCase() : n + 1}
                    </button>
                  ))}
                </div>
                {g.rest ? <button className="btn sm" onClick={() => setRest(g.rest)}>⏱ Repos</button> : null}
              </div>
            </div>
          </div>
        )
      })}
      <ActionBar><button className="btn primary big block" onClick={onFinish}>Terminer la séance</button></ActionBar>
      {rest !== undefined && (
        <Sheet onClose={() => setRest(undefined)}>
          <RestTimer seconds={rest} resetKey={`list-rest-${Date.now()}`} onDone={() => setRest(undefined)} />
        </Sheet>
      )}
      {timed !== undefined && (
        <Sheet onClose={() => setTimed(undefined)}>
          <div className="ex-name">{EXERCISES[steps[timed].ex!].name}</div>
          <TimedWork step={{ ...steps[timed], autoStart: false }} onDone={(held) => { onToggle(timed, held); setTimed(undefined) }} />
        </Sheet>
      )}
    </div>
  )
}

// ───────────── Checklist matériel ─────────────
function Checklist({ active, onGo }: { active: ActiveSession; onGo: () => void }) {
  const s = useStore()
  const week = weekNumber(today(), s.startDate)
  const gear = sessionGear(active.session, { week, express: active.express, levels: s.levels, edits: s.edits, timeTargets: s.timeTargets })
  const ses = SESSIONS[active.session]
  return (
    <div className="workout-body">
      <div className="stack" style={{ gap: 4 }}>
        <div className="section-title">{active.express ? 'Séance express' : ses.duration}</div>
        <div className="page-title">{ses.name}</div>
        <div className="muted">{ses.subtitle}</div>
      </div>
      <div className="card">
        <div style={{ fontWeight: 700 }}>🎒 Matériel à préparer</div>
        <GearChips gear={gear} />
        {gear.anchors.length > 0 && <div className="small muted">Porte : elle doit s’ouvrir dans le sens opposé à toi. Ferme-la à clé si possible.</div>}
      </div>
      {ses.warmup !== 'none' && (
        <div className="card">
          <div style={{ fontWeight: 700 }}>{ses.warmup === 'genoux' ? '🦵 Routine genoux incluse' : '🔥 Échauffement inclus'}</div>
          <div className="small muted">{ses.warmup === 'genoux' ? 'Obligatoire avant les jambes : 7 min.' : '5 min pour préparer les épaules.'}</div>
        </div>
      )}
      <ActionBar><button className="btn primary big block" onClick={() => { unlockAudio(); onGo() }}>C’est parti 💪</button></ActionBar>
    </div>
  )
}

// ───────────── Écran principal ─────────────
export default function Workout({ onFinished }: { onFinished: (id: string) => void }) {
  const active = useStore((s) => s.active)!
  const view = useStore((s) => s.settings.view)
  const setSettings = useStore((s) => s.setSettings)
  const markStep = useStore((s) => s.markStep)
  const recordSet = useStore((s) => s.recordSet)
  const setStep = useStore((s) => s.setStep)
  const finishWorkout = useStore((s) => s.finishWorkout)
  const abandonWorkout = useStore((s) => s.abandonWorkout)
  const steps = useSteps(active)
  const [started, setStarted] = useState(active.stepIndex > 0 || Object.keys(active.done).length > 0)
  const [quit, setQuit] = useState(false)

  useEffect(() => { void keepAwake(true); return () => void keepAwake(false) }, [])

  const record = (i: number, delta: 1 | -1, held?: number, reps?: number) => {
    const st = steps[i]
    if (st.recKey && st.side !== 'gauche') recordSet(st.recKey, { ex: st.ex!, total: st.rounds!, level: st.level ?? 0, best: held }, delta, reps)
  }
  const finish = () => {
    beep.done()
    say('Séance terminée. Bravo Matei.')
    const id = finishWorkout()
    if (id) onFinished(id)
  }
  const validate = (i: number, held?: number, reps?: number) => {
    if (!active.done[steps[i].key]) { markStep(steps[i].key, true); record(i, 1, held, reps) }
    if (i + 1 >= steps.length) finish()
    else setStep(i + 1)
  }
  const unvalidate = (i: number) => { markStep(steps[i].key, false); record(i, -1) }
  const toggle = (i: number, held?: number) => (active.done[steps[i].key] ? unvalidate(i) : (markStep(steps[i].key, true), record(i, 1, held)))

  const doneCount = steps.filter((x) => x.kind === 'work' && active.done[x.key]).length
  const workCount = steps.filter((x) => x.kind === 'work').length
  const cur = steps[Math.min(active.stepIndex, steps.length - 1)]

  return (
    <div className="workout">
      <div className="topbar">
        <button className="icon-btn" aria-label="Quitter" onClick={() => setQuit(true)}><IconClose /></button>
        <div className="grow">
          <div style={{ fontWeight: 700 }}>{SESSIONS[active.session].name}{active.express ? ' · express' : ''}</div>
          <div className="tiny muted">{started && view === 'guided' ? `${PHASE_TITLE[cur.phase]} · ` : ''}{doneCount}/{workCount} étapes faites</div>
        </div>
        {started && (
          <button className="icon-btn" aria-label="Changer de vue" onClick={() => setSettings({ view: view === 'guided' ? 'list' : 'guided' })}>
            {view === 'guided' ? <IconList /> : <IconGuided />}
          </button>
        )}
      </div>
      <div className="progress"><div style={{ width: `${(doneCount / Math.max(1, workCount)) * 100}%` }} /></div>

      {!started ? (
        <Checklist active={active} onGo={() => setStarted(true)} />
      ) : view === 'guided' ? (
        <Guided steps={steps} active={active} onValidate={validate} onUnvalidate={unvalidate} onFinish={finish} />
      ) : (
        <ListView steps={steps} active={active} onToggle={toggle} onFinish={finish} />
      )}

      {quit && (
        <Sheet onClose={() => setQuit(false)}>
          <div className="ex-name">Quitter la séance ?</div>
          <div className="muted">Les séries déjà validées sont gardées dans l’historique.</div>
          <button className="btn primary block" onClick={finish}>Terminer et voir le récap</button>
          <button className="btn danger block" onClick={() => { abandonWorkout(); }}>Abandonner</button>
          <button className="btn ghost block" onClick={() => setQuit(false)}>Continuer la séance</button>
        </Sheet>
      )}
    </div>
  )
}

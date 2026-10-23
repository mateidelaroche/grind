import { useEffect, useMemo, useRef, useState } from 'react'
import { EXERCISES } from '../data/exercises'
import { SESSIONS } from '../data/sessions'
import { ExerciseBlock } from '../components/ExerciseInfo'
import { IconBack, IconCheck, IconClose, IconGuided, IconList, IconMetro, IconNext, IconPause, IconPlay } from '../components/icons'
import { fmtTime, GearChips, Sheet } from '../components/ui'
import { beep, keepAwake, say, unlockAudio } from '../lib/audio'
import { buildSteps, gearForExercise, sessionGear, today, weekNumber, type Step } from '../lib/program'
import { useCountdown, useMetronome } from '../lib/timer'
import { useStore, type ActiveSession } from '../store'

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

// ───────────── Repos ─────────────
export function RestTimer({ seconds, resetKey, onDone, nextLabel, feedback }: {
  seconds: number; resetKey: string; onDone: () => void; nextLabel?: string; feedback?: React.ReactNode
}) {
  const t = useCountdown(seconds, { autoStart: true, resetKey, onEnd: () => { say('C’est reparti'); onDone() } })
  return (
    <div className="stack" style={{ alignItems: 'center', gap: 14 }}>
      <div className="section-title">Repos</div>
      <div className="timer">
        <Ring value={t.remaining} total={t.total}>{fmtTime(t.remaining)}<small>sur {fmtTime(t.total)}</small></Ring>
      </div>
      <div className="adjust">
        <button className="btn" onClick={() => t.add(-15)}>−15 s</button>
        <button className="btn" onClick={t.state === 'paused' ? t.resume : t.pause}>{t.state === 'paused' ? 'Reprendre' : 'Pause'}</button>
        <button className="btn" onClick={() => t.add(15)}>+15 s</button>
      </div>
      {nextLabel && <div className="next-hint" style={{ width: '100%' }}>Ensuite : <b>{nextLabel}</b></div>}
      {feedback}
      <button className="btn primary big block" onClick={onDone}>Passer le repos <IconNext /></button>
    </div>
  )
}

// ───────────── Exercice en temps ─────────────
function TimedWork({ step, onDone }: { step: Step; onDone: () => void }) {
  const setTimeTarget = useStore((s) => s.setTimeTarget)
  const t = useCountdown(step.duration ?? 30, { prep: 3, autoStart: !!step.autoStart, resetKey: step.key, onEnd: onDone })
  const ringRef = useRef<HTMLDivElement>(null)
  const running = t.state === 'run' || t.state === 'prep'
  useEffect(() => {
    if (running) ringRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }, [running])
  const changeTarget = (d: number) => {
    t.add(d)
    if (step.phase === 'main' && step.ex) setTimeTarget(step.ex, Math.max(5, (step.duration ?? 30) + d))
  }
  return (
    <div className="stack" style={{ alignItems: 'center' }}>
      <div className="timer" ref={ringRef}>
        <Ring value={t.state === 'idle' ? t.total : t.remaining} total={t.total}>
          {t.state === 'prep' ? <>{t.prepLeft}<small>prépare-toi</small></> : <>{fmtTime(t.state === 'idle' ? t.total : t.remaining)}<small>{step.side ? `côté ${step.side}` : 'secondes'}</small></>}
        </Ring>
      </div>
      {t.state === 'idle' && (
        <div className="row" style={{ gap: 8 }}>
          <button className="btn sm" onClick={() => changeTarget(-5)}>−5 s</button>
          <span className="small muted">objectif</span>
          <button className="btn sm" onClick={() => changeTarget(5)}>+5 s</button>
        </div>
      )}
      <div className="workout-actions" style={{ width: '100%' }}>
        {t.state === 'idle' && <button className="btn primary big block" onClick={() => { unlockAudio(); t.start() }}><IconPlay /> Démarrer</button>}
        {running && <button className="btn big block" onClick={t.pause}><IconPause /> Pause · {t.state === 'prep' ? `départ dans ${t.prepLeft}` : fmtTime(t.remaining)}</button>}
        {t.state === 'paused' && <button className="btn primary big block" onClick={t.resume}><IconPlay /> Reprendre</button>}
        {t.state !== 'idle' && <button className="btn sm ghost" onClick={onDone}>Terminer maintenant</button>}
      </div>
    </div>
  )
}

// ───────────── Vue guidée ─────────────
function Guided({ steps, active, onValidate, onUnvalidate, onFinish }: {
  steps: Step[]; active: ActiveSession; onValidate: (i: number) => void; onUnvalidate: (i: number) => void; onFinish: () => void
}) {
  const setStep = useStore((s) => s.setStep)
  const flagSet = useStore((s) => s.flagSet)
  const workout = useStore((s) => s.workouts.find((w) => w.id === active.workoutId))
  const metronomeSetting = useStore((s) => s.settings.metronome)
  const [metro, setMetro] = useState(false)
  const i = Math.min(active.stepIndex, steps.length - 1)
  const st = steps[i]
  const done = !!active.done[st.key]

  useEffect(() => { announce(st); setMetro(false) }, [st.key]) // eslint-disable-line react-hooks/exhaustive-deps
  useMetronome(st.kind === 'work' ? st.item?.tempo : undefined, metro)

  const go = (j: number) => (j >= steps.length ? onFinish() : setStep(Math.max(0, j)))
  const nextWork = steps.slice(i + 1).find((x) => x.kind === 'work')
  const nextLabel = nextWork && `${stepTitle(nextWork)}${nextWork.rounds && nextWork.rounds > 1 ? ` · série ${nextWork.round}/${nextWork.rounds}` : ''}${nextWork.side ? ` · ${nextWork.side}` : ''}`

  if (st.kind === 'rest') {
    // Ressenti optionnel sur les exos du tour qui vient de se terminer
    const prev: Step[] = []
    for (let j = i - 1; j >= 0 && steps[j].kind === 'work'; j--) if (steps[j].recKey && !prev.some((p) => p.recKey === steps[j].recKey)) prev.unshift(steps[j])
    const feedback = prev.length > 0 && workout && (
      <div className="card" style={{ width: '100%', gap: 8 }}>
        <div className="small muted">Ressenti (facultatif)</div>
        {prev.map((p) => {
          const rec = workout.sets[p.recKey!]
          return (
            <div className="row between" key={p.key}>
              <span className="small grow">{EXERCISES[p.ex!].name}</span>
              <button className={`chip ${rec?.flags.includes('hard') ? 'on' : ''}`} style={rec?.flags.includes('hard') ? { borderColor: 'var(--warn)', color: 'var(--warn)' } : {}} onClick={() => flagSet(p.recKey!, 'hard')}>😮‍💨 Dur</button>
              <button className="chip" style={rec?.flags.includes('easy') ? { borderColor: 'var(--ok)', color: 'var(--ok)' } : {}} onClick={() => flagSet(p.recKey!, 'easy')}>😎 Facile</button>
            </div>
          )
        })}
      </div>
    )
    return <RestTimer seconds={st.rest!} resetKey={st.key} onDone={() => go(i + 1)} nextLabel={nextLabel} feedback={feedback} />
  }

  const sameRoundNext = steps[i + 1]?.kind === 'work' && steps[i + 1].phase === st.phase && steps[i + 1].label?.[0] === st.label?.[0] && steps[i + 1].label !== st.label
  const target = st.item?.duration
    ? st.item.durationLabel
    : st.item?.reps

  return (
    <div className="workout-body">
      <div className="row wrap" style={{ gap: 6 }}>
        {st.label && st.phase === 'main' && <span className="badge">{st.label}</span>}
        {st.rounds! > 1 && <span className="badge">Série {st.round}/{st.rounds}</span>}
        {st.side && <span className="badge">Côté {st.side}</span>}
        {st.restPause && <span className="badge warn">Rest-pause</span>}
        {done && <span className="badge ok">Validée ✓</span>}
      </div>

      <ExerciseBlock exId={st.ex!} level={st.level ?? 0}>
        <div className="row between">
          <div className="target">{st.item?.duration ? fmtTime(st.duration ?? st.item.duration) : st.item?.reps?.split(' ')[0]}<small>{st.item?.duration ? 's' : 'reps'}{st.item?.reps?.includes('/') ? ' / ' + st.item.reps.split('/ ')[1] : ''}</small></div>
          {metronomeSetting && st.item?.tempo && (
            <button className={`btn sm ${metro ? 'primary' : ''}`} onClick={() => { unlockAudio(); setMetro(!metro) }}><IconMetro /> {st.item.tempo}</button>
          )}
        </div>
        <div className="small muted">
          {target && st.item?.duration ? `Fourchette ${target}` : ''}
          {st.item?.tempo ? `Tempo ${st.item.tempo}` : ''}
          {st.item?.note ? ` · ${st.item.note}` : ''}
          {st.phase === 'main' && st.rounds! > 1 ? ` · RIR 1-2` : ''}
        </div>
        {st.restPause && <div className="next-hint">🔥 <b>Rest-pause</b> : à 1 rep de l’échec, pose-toi 15 s, puis refais le max de reps.</div>}
      </ExerciseBlock>

      {sameRoundNext && nextLabel && <div className="next-hint">⚡ Superset : enchaîne <b>sans repos</b> avec {nextLabel}</div>}

      {st.duration ? (
        <TimedWork step={st} onDone={() => onValidate(i)} />
      ) : (
        <div className="workout-actions">
          {done ? (
            <div className="row">
              <button className="btn grow" onClick={() => onUnvalidate(i)}>Annuler la validation</button>
              <button className="btn primary grow" onClick={() => go(i + 1)}>Suivant <IconNext /></button>
            </div>
          ) : (
            <button className="btn primary big block" onClick={() => { unlockAudio(); onValidate(i) }}><IconCheck /> Série validée</button>
          )}
        </div>
      )}
      <div className="row between">
        <button className="btn sm ghost" disabled={i === 0} onClick={() => go(i - 1)}><IconBack /> Précédent</button>
        <button className="btn sm ghost" onClick={() => go(i + 1)}>Passer <IconNext /></button>
      </div>
    </div>
  )
}

// ───────────── Vue liste ─────────────
function ListView({ steps, active, onToggle, onFinish }: {
  steps: Step[]; active: ActiveSession; onToggle: (i: number) => void; onFinish: () => void
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
      <div className="workout-actions">
        <button className="btn primary big block" onClick={onFinish}>Terminer la séance</button>
      </div>
      {rest !== undefined && (
        <Sheet onClose={() => setRest(undefined)}>
          <RestTimer seconds={rest} resetKey={`list-rest-${Date.now()}`} onDone={() => setRest(undefined)} />
        </Sheet>
      )}
      {timed !== undefined && (
        <Sheet onClose={() => setTimed(undefined)}>
          <div className="ex-name">{EXERCISES[steps[timed].ex!].name}</div>
          <TimedWork step={{ ...steps[timed], autoStart: false }} onDone={() => { onToggle(timed); setTimed(undefined) }} />
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
      <div className="workout-actions">
        <button className="btn primary big block" onClick={() => { unlockAudio(); onGo() }}>C’est parti 💪</button>
      </div>
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

  const record = (i: number, delta: 1 | -1) => {
    const st = steps[i]
    if (st.recKey && st.side !== 'gauche') recordSet(st.recKey, { ex: st.ex!, total: st.rounds!, level: st.level ?? 0 }, delta)
  }
  const finish = () => {
    beep.done()
    say('Séance terminée. Bravo Matei.')
    const id = finishWorkout()
    if (id) onFinished(id)
  }
  const validate = (i: number) => {
    if (!active.done[steps[i].key]) { markStep(steps[i].key, true); record(i, 1) }
    if (i + 1 >= steps.length) finish()
    else setStep(i + 1)
  }
  const unvalidate = (i: number) => { markStep(steps[i].key, false); record(i, -1) }
  const toggle = (i: number) => (active.done[steps[i].key] ? unvalidate(i) : (markStep(steps[i].key, true), record(i, 1)))

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

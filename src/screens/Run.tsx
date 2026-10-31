import { useEffect, useReducer, useRef, useState } from 'react'
import Figure from '../anim/Figure'
import { EXERCISES } from '../data/exercises'
import { FREE_STEPS, INDOOR_STEPS, RUN_PLAN, runMinutes, runSteps, STEP_LABEL } from '../data/running'
import { IconBack } from '../components/icons'
import { fmtTime, Sheet } from '../components/ui'
import { beep, keepAwake, say, unlockAudio } from '../lib/audio'
import { fmtDur, fmtKm, fmtMin, fmtPace, simplify, tracker, watchGps } from '../lib/gps'
import { useStore, type ActiveRun } from '../store'
import type { RunSplit, RunStep } from '../types'

export type RunKind = { plan: number } | { indoor: true } | { free: true }

export function stepsOf(k: RunKind): { steps: RunStep[]; plan: number; indoor: boolean; title: string } {
  if ('indoor' in k) return { steps: INDOOR_STEPS, plan: -1, indoor: true, title: 'Cardio en chambre' }
  if ('free' in k) return { steps: FREE_STEPS, plan: -1, indoor: false, title: 'Sortie libre' }
  const r = RUN_PLAN[k.plan]
  return { steps: runSteps(r), plan: k.plan, indoor: false, title: `Sortie ${k.plan + 1}/${RUN_PLAN.length} · semaine ${r.week}` }
}

const isEffort = (k: RunStep['kind']) => k === 'run' || k === 'work'
const elapsed = (r: ActiveRun, now = Date.now()) => ((r.pausedAt ?? now) - r.startedAt - r.pausedMs) / 1000

export const stepText = (s: RunStep) =>
  s.dist ? `${STEP_LABEL[s.kind]} ${fmtKm(s.dist)} km` : s.dur ? `${STEP_LABEL[s.kind]} ${fmtMin(s.dur)}` : STEP_LABEL[s.kind]

// ───────────── Avant de partir ─────────────
export function RunPrep({ kind, onBack }: { kind: RunKind; onBack: () => void }) {
  const startRun = useStore((s) => s.startRun)
  const { steps, plan, indoor, title } = stepsOf(kind)
  const session = plan >= 0 ? RUN_PLAN[plan] : undefined
  const [gps, setGps] = useState<{ acc?: number; error?: string }>({})

  useEffect(() => {
    if (indoor) return
    return watchGps((p) => setGps({ acc: p.coords.accuracy }), (error) => setGps({ error }))
  }, [indoor])

  const go = () => {
    unlockAudio()
    void keepAwake(true)
    beep.run()
    startRun({ plan, indoor, steps })
  }

  const gpsOk = gps.acc !== undefined && gps.acc <= 25
  return (
    <div className="page">
      <div className="topbar">
        <button className="icon-btn" onClick={onBack} aria-label="Retour"><IconBack /></button>
        <div className="grow">
          <div className="ex-name">{indoor ? '🏠 Cardio en chambre' : 'free' in kind ? '🧭 Sortie libre' : `🏃 ${session!.title}`}</div>
          <div className="small muted">{title} · {'free' in kind ? 'tu t’arrêtes quand tu veux' : `≈ ${runMinutes(steps)} min`}</div>
        </div>
      </div>

      {session?.tip && <div className="card accent small">💡 {session.tip}</div>}

      {!('free' in kind) && (
        <div className="card" style={{ padding: '4px 16px', gap: 0 }}>
          {compactSteps(steps).map((g, i) => (
            <div key={i} className="list-row small">
              <span className={`run-dot k-${g.kind}`} />
              <span className="grow">{g.text}</span>
            </div>
          ))}
        </div>
      )}

      {indoor ? (
        <div className="card small muted">
          Zéro saut, zéro bruit pour les voisins. 40 s d’effort, 20 s de récup, 5 tours. Tu dois être essoufflé mais capable de dire une phrase.
          La sortie course n’est pas sautée : la prochaine reprendra là où tu en étais.
        </div>
      ) : (
        <>
          <div className="card small" style={{ gap: 6 }}>
            <b>Avant de partir</b>
            <span>👟 Chaussures de running, lacets serrés</span>
            <span>🔋 Téléphone chargé : l’écran reste allumé pendant toute la sortie</span>
            <span>🔈 Mode silencieux coupé, sinon pas de bips</span>
            <span>🦺 Il fait nuit ? Haut clair ou gilet, et un parcours éclairé</span>
            <span>🦵 Douleur vive au genou pendant la sortie : tu marches et tu rentres, ça se note à la fin</span>
          </div>
          <div className="card row small" style={{ flexDirection: 'row' }}>
            <span className={`gps-dot ${gps.error ? 'bad' : gpsOk ? 'ok' : 'wait'}`} />
            <span className="grow">
              {gps.error ?? (gps.acc === undefined ? 'Recherche du GPS… (sors dehors, à découvert)' : gpsOk ? `GPS prêt · précision ${Math.round(gps.acc)} m` : `GPS en cours de calage · ${Math.round(gps.acc)} m`)}
            </span>
          </div>
        </>
      )}

      <button className="btn primary big block" onClick={go}>{indoor ? 'C’est parti' : gpsOk || gps.error ? 'C’est parti' : 'Partir sans attendre le GPS'}</button>
      {!indoor && <div className="tiny muted center">Bips : 3 notes qui montent = cours · 2 notes qui descendent = marche · tic-tic-tic = changement dans 3 s</div>}
    </div>
  )
}

/** Regroupe les fractions répétées pour l'affichage : « 6 × 2′ course / 2′ marche ». */
function compactSteps(steps: RunStep[]) {
  const out: { kind: RunStep['kind']; text: string }[] = []
  const main = steps.filter((s) => s.kind === 'run' || s.kind === 'walk' || s.kind === 'work' || s.kind === 'rest')
  const first = steps[0], last = steps[steps.length - 1]
  if (first.kind === 'warm') out.push({ kind: 'warm', text: `${stepText(first)} · marche rapide${first.ex ? ` (${EXERCISES[first.ex].name.toLowerCase()})` : ''}` })
  const efforts = main.filter((s) => isEffort(s.kind))
  const allSame = efforts.length > 2 && efforts.every((s) => s.dur === efforts[0].dur && s.ex === efforts[0].ex)
  if (allSame) {
    const rec = main.find((s) => !isEffort(s.kind))
    out.push({ kind: efforts[0].kind, text: `${efforts.length} × ${stepText(efforts[0])}${rec ? ` / ${stepText(rec).toLowerCase()}` : ''}` })
  } else if (main.some((s) => s.ex)) {
    const exs = [...new Set(main.filter((s) => s.ex).map((s) => EXERCISES[s.ex!].name))]
    const n = efforts.length / exs.length
    out.push({ kind: 'work', text: `${n} tours : ${exs.join(', ')} · 40 s / 20 s` })
  } else main.forEach((s) => out.push({ kind: s.kind, text: stepText(s) }))
  if (last.kind === 'cool') out.push({ kind: 'cool', text: `${stepText(last)} · marche tranquille` })
  return out
}

// ───────────── Pendant la sortie ─────────────
export function RunScreen({ onFinished }: { onFinished: (id: string | undefined) => void }) {
  const a = useStore((s) => s.activeRun)!
  const patch = useStore((s) => s.patchRun)
  const [, tick] = useReducer((x: number) => x + 1, 0)
  const lastBeep = useRef('')
  const [confirmEnd, setConfirmEnd] = useState(false)

  // GPS + écran allumé
  useEffect(() => {
    void keepAwake(true)
    if (!a.indoor) {
      void tracker.start(a.id, () => {
        const r = useStore.getState().activeRun
        return r && !r.pausedAt ? elapsed(r) : undefined
      })
    }
    const unsub = tracker.subscribe(tick)
    return () => { unsub() }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [a.id])

  // Moteur : avance les étapes selon le temps (ou la distance), bips aux changements.
  useEffect(() => {
    const id = window.setInterval(() => {
      const r = useStore.getState().activeRun
      if (!r) return
      tick()
      if (r.pausedAt) return
      const t = elapsed(r)
      const d = tracker.dist
      let { step, stepT0, stepD0 } = r
      const splits = [...r.splits]
      while (step < r.steps.length) {
        const st = r.steps[step]
        let end: number | undefined
        if (st.dur !== undefined && t - stepT0 >= st.dur) end = stepT0 + st.dur
        else if (st.dist !== undefined && d - stepD0 >= st.dist) end = t
        if (end === undefined) break
        splits.push({ kind: st.kind, t0: stepT0, dur: end - stepT0, dist: d - stepD0, full: true })
        step++; stepT0 = end; stepD0 = d
      }
      if (step !== r.step) {
        patch({ step, stepT0, stepD0, splits })
        if (step >= r.steps.length) { beep.done(); finish(true); return }
        announce(r.steps[step])
        return
      }
      // Décompte 3-2-1 avant chaque changement, bip à mi-parcours des longues fractions.
      const st = r.steps[step]
      if (st.dur) {
        const left = st.dur - (t - stepT0)
        const sec = Math.ceil(left)
        const key = `${step}:${sec}`
        if (sec >= 1 && sec <= 3 && lastBeep.current !== key) { lastBeep.current = key; beep.tick() }
        if (isEffort(st.kind) && st.dur >= 360 && Math.abs(left - st.dur / 2) < 0.3 && lastBeep.current !== `${step}:half`) {
          lastBeep.current = `${step}:half`; beep.half(); say('Mi-parcours')
        }
      }
    }, 250)
    return () => clearInterval(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const announce = (st: RunStep) => {
    if (isEffort(st.kind)) beep.run()
    else beep.walk()
    say(st.ex ? EXERCISES[st.ex].name : STEP_LABEL[st.kind])
  }

  const finish = (auto = false) => {
    const r = useStore.getState().activeRun
    if (!r) return
    const t = elapsed(r)
    const { points, dist } = r.indoor ? { points: [], dist: 0 } : tracker.end()
    const splits: RunSplit[] = [...r.splits]
    const cur = r.steps[r.step]
    if (!auto && cur && t - r.stepT0 > 5) splits.push({ kind: cur.kind, t0: r.stepT0, dur: t - r.stepT0, dist: dist - r.stepD0, full: cur.kind === 'free' })
    const rest = r.steps.slice(r.step + (auto ? 0 : 1))
    const curOk = !cur || !isEffort(cur.kind) || auto
    const completed = r.plan < 0 && !r.indoor ? true : curOk && !rest.some((s) => isEffort(s.kind)) && splits.filter((s) => isEffort(s.kind)).every((s) => s.full)
    void keepAwake(false)
    const id = useStore.getState().finishRun({ endedAt: Date.now(), dur: Math.round(t), dist: Math.round(dist), completed, splits, track: points.length > 1 ? simplify(points) : undefined })
    onFinished(id)
  }

  const skip = () => {
    const r = useStore.getState().activeRun
    if (!r || r.step >= r.steps.length) return
    const t = elapsed(r)
    const d = tracker.dist
    const st = r.steps[r.step]
    const full = st.kind === 'free' || !isEffort(st.kind) || (st.dist !== undefined && d - r.stepD0 >= st.dist * 0.95)
    const splits = [...r.splits, { kind: st.kind, t0: r.stepT0, dur: t - r.stepT0, dist: d - r.stepD0, full }]
    if (r.step + 1 >= r.steps.length) { patch({ splits, step: r.step + 1, stepT0: t, stepD0: d }); beep.done(); finish(true); return }
    patch({ step: r.step + 1, stepT0: t, stepD0: d, splits })
    announce(r.steps[r.step + 1])
  }

  const togglePause = () => {
    const r = useStore.getState().activeRun!
    if (r.pausedAt) { patch({ pausedMs: r.pausedMs + Date.now() - r.pausedAt, pausedAt: undefined }); beep.go() }
    else patch({ pausedAt: Date.now() })
  }

  const t = elapsed(a)
  const st = a.steps[Math.min(a.step, a.steps.length - 1)]
  const next = a.steps[a.step + 1]
  const inStep = t - a.stepT0
  const dist = tracker.dist
  const left = st.dur !== undefined ? st.dur - inStep : st.dist !== undefined ? st.dist - (dist - a.stepD0) : undefined
  const pace = tracker.pace()
  const avg = dist > 50 ? t / (dist / 1000) : undefined
  const total = a.steps.reduce((x, s) => x + (s.dur ?? (s.dist ? (s.dist / 1000) * 420 : 0)), 0)
  const efforts = a.steps.filter((s) => isEffort(s.kind)).length
  const effortN = a.steps.slice(0, a.step + 1).filter((s) => isEffort(s.kind)).length
  const perRound = new Set(a.steps.filter((s) => s.kind === 'work').map((s) => s.ex)).size || 1
  const figEx = st.ex ?? (st.kind === 'rest' ? next?.ex : undefined)
  const gpsAge = tracker.status.lastFix ? (Date.now() - tracker.status.lastFix) / 1000 : Infinity
  const gpsState = tracker.status.error ? 'bad' : gpsAge < 10 && (tracker.status.acc ?? 99) <= 35 ? 'ok' : 'wait'

  return (
    <div className={`run k-${st.kind} ${a.pausedAt ? 'paused' : ''}`}>
      <div className="row between">
        <button className="btn sm" onClick={() => setConfirmEnd(true)}>Terminer</button>
        <span className="small muted">{a.plan >= 0 ? `Sortie ${a.plan + 1}` : a.indoor ? 'Cardio chambre' : 'Sortie libre'} · {fmtDur(t)}</span>
        {!a.indoor ? (
          <span className="row tiny muted" style={{ gap: 6 }}><span className={`gps-dot ${gpsState}`} />{tracker.status.acc ? `${Math.round(tracker.status.acc)} m` : 'GPS'}</span>
        ) : <span style={{ width: 40 }} />}
      </div>

      <div className="run-phase">
        <div className="run-label">{a.pausedAt ? 'Pause' : STEP_LABEL[st.kind]}</div>
        {st.ex && <div className="ex-name">{EXERCISES[st.ex].name}</div>}
        <div className="run-big">
          {left === undefined ? fmtDur(inStep) : st.dist !== undefined ? <>{fmtKm(Math.max(0, left))}<small> km</small></> : fmtTime(left)}
        </div>
        <div className="small muted">
          {st.dist !== undefined ? 'restants' : st.kind === 'free' ? 'Tu t’arrêtes quand tu veux' : a.indoor && st.kind === 'work' ? `Tour ${Math.ceil(effortN / perRound)}/${Math.round(efforts / perRound)}` : efforts > 1 && isEffort(st.kind) ? `Fraction ${effortN}/${efforts}` : ' '}
        </div>
      </div>

      {figEx && <Figure anim={EXERCISES[figEx].anim} className="figure run-fig" />}

      {st.kind !== 'free' && (
        <div className="run-bar">
          {a.steps.map((s, i) => {
            const w = ((s.dur ?? (s.dist ? (s.dist / 1000) * 420 : 0)) / total) * 100
            const fill = i < a.step ? 100 : i === a.step && left !== undefined ? Math.min(100, (1 - left / (s.dur ?? s.dist ?? 1)) * 100) : 0
            return <div key={i} className={`k-${s.kind}`} style={{ width: `${w}%` }}><div style={{ width: `${fill}%` }} /></div>
          })}
        </div>
      )}
      {next && <div className="next-hint">Ensuite : <b>{next.ex ? EXERCISES[next.ex].name : stepText(next)}</b></div>}

      {!a.indoor && (
        <div className="run-stats">
          <div><b>{fmtKm(dist)}</b><span>km</span></div>
          <div><b>{fmtPace(pace)}</b><span>allure /km</span></div>
          <div><b>{fmtPace(avg)}</b><span>moyenne /km</span></div>
        </div>
      )}

      <div className="run-actions">
        <button className="btn big grow" onClick={togglePause}>{a.pausedAt ? '▶︎ Reprendre' : '⏸ Pause'}</button>
        {st.kind !== 'free' && <button className="btn big grow" onClick={skip}>⏭ Étape suivante</button>}
      </div>

      {confirmEnd && (
        <Sheet onClose={() => setConfirmEnd(false)}>
          <div className="ex-name">Terminer la sortie ?</div>
          {a.steps.slice(a.step).some((s) => isEffort(s.kind)) && a.plan >= 0 && (
            <div className="small muted">Il reste des fractions : la sortie ne sera pas validée et tu la referas la prochaine fois. C’est la bonne décision si ton genou tire.</div>
          )}
          <button className="btn primary block" onClick={() => finish()}>Terminer et enregistrer</button>
          <button className="btn danger block" onClick={() => { if (confirm('Supprimer cette sortie sans l’enregistrer ?')) { if (!a.indoor) tracker.end(); void keepAwake(false); useStore.getState().abandonRun(); onFinished(undefined) } }}>Annuler sans enregistrer</button>
          <button className="btn block" onClick={() => setConfirmEnd(false)}>Continuer</button>
        </Sheet>
      )}
    </div>
  )
}

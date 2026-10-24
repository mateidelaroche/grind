import { useState } from 'react'
import Demo from '../anim/Demo'
import Figure from '../anim/Figure'
import { EXERCISES } from '../data/exercises'
import { animOf, gearForExercise, levelOf } from '../lib/program'
import { useStore } from '../store'
import { GearChips } from './ui'
import { workOf } from '../data/muscles'
import MuscleMap from './MuscleMap'

export function HowTo({ exId }: { exId: string }) {
  const ex = EXERCISES[exId]
  return (
    <div className="howto stack" style={{ gap: 8 }}>
      {ex.info && <p>📌 {ex.info}</p>}
      {ex.setup && <p><b>⚙️ Mise en place.</b> {ex.setup}</p>}
      <p><b>▶️ Exécution.</b> {ex.execution}</p>
      {ex.errors && <p><b>⚠️ Erreurs.</b> {ex.errors}</p>}
      {ex.knee && <p><b>🩹 Genoux.</b> {ex.knee}</p>}
    </div>
  )
}

/** Bloc exercice d'une étape : mode coaché (animation + consignes) ou compact. */
export function ExerciseBlock({ exId, level, children }: { exId: string; level: number; children?: React.ReactNode }) {
  const ex = EXERCISES[exId]
  const mastered = useStore((s) => !!s.mastered[exId])
  const setMastered = useStore((s) => s.setMastered)
  const [show, setShow] = useState(false)
  const lvl = levelOf(exId, level)
  const gear = gearForExercise(exId, level)
  const coached = !mastered || show

  if (!coached) {
    return (
      <div className="stack">
        <div className="row" style={{ alignItems: 'flex-start' }}>
          <Figure anim={animOf(exId, level)} band={lvl?.band} className="figure thumb" />
          <div className="grow stack" style={{ gap: 4 }}>
            <div className="ex-name">{ex.name}</div>
            {lvl && ex.levels!.length > 1 && <div className="small muted">{lvl.label}</div>}
          </div>
        </div>
        {children}
        <GearChips gear={gear} />
        <button className="btn sm ghost" style={{ alignSelf: 'flex-start' }} onClick={() => setShow(true)}>Afficher les consignes</button>
      </div>
    )
  }

  return (
    <div className="stack">
      <Demo anim={animOf(exId, level)} band={lvl?.band} work={workOf(exId)} />
      <div className="stack" style={{ gap: 4 }}>
        <div className="ex-name">{ex.name}</div>
        <div className="small muted">{ex.muscles}{lvl && ex.levels!.length > 1 ? ` · ${lvl.label}` : ''}</div>
      </div>
      {children}
      <GearChips gear={gear} />
      <HowTo exId={exId} />
      <MuscleMap work={workOf(exId)} compact />
      {mastered ? (
        <button className="btn sm ghost" style={{ alignSelf: 'flex-start' }} onClick={() => setShow(false)}>Masquer les consignes</button>
      ) : (
        <button className="btn sm" style={{ alignSelf: 'flex-start' }} onClick={() => setMastered(exId, true)}>✓ J’ai compris ce mouvement</button>
      )}
    </div>
  )
}

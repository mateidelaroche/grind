import { useState } from 'react'
import Demo from '../anim/Demo'
import { EXERCISES } from '../data/exercises'
import { animOf, gearForExercise, levelOf, videoOf, type Step } from '../lib/program'
import { optionsFor, PROBLEM_LABEL, problemsFor, type SwapChoice } from '../lib/variants'
import { useStore } from '../store'
import type { Problem } from '../types'
import { HowTo } from './ExerciseInfo'
import { GearChips, Sheet } from './ui'

export const targetOf = (o: Pick<SwapChoice, 'reps' | 'duration' | 'durationLabel' | 'tempo'>) =>
  [o.duration ? o.durationLabel ?? `${o.duration} s` : o.reps?.replace(/^([\d-]+)/, '$1 reps'), o.tempo && `tempo ${o.tempo}`].filter(Boolean).join(' · ')

/** Démo, objectif et matériel d'une variante, avant de la choisir. */
export function VariantPreview({ o }: { o: SwapChoice }) {
  const lvl = levelOf(o.ex, o.level)
  return (
    <>
      <div>
        <div className="ex-name">{EXERCISES[o.ex].name}</div>
        <div className="small muted">{[lvl?.label, targetOf(o)].filter(Boolean).join(' · ')}</div>
      </div>
      <Demo anim={animOf(o.ex, o.level)} band={lvl?.band} tempo={o.tempo} video={videoOf(o.ex, o.level)} />
      <GearChips gear={gearForExercise(o.ex, o.level)} />
      {o.note && <div className="small" style={{ color: 'var(--warn)' }}>{o.note}</div>}
      <HowTo exId={o.ex} />
    </>
  )
}

/** Le problème d'abord, puis la meilleure variante qui n'en dépend pas. */
export default function VariantSheet({ st, fromRound, superset, onPick, onRestore, onClose }: {
  st: Step; fromRound: number; superset: boolean; onPick: (o: SwapChoice) => void; onRestore: () => void; onClose: () => void
}) {
  const levels = useStore((s) => s.levels)
  const unavailable = useStore((s) => s.unavailable)
  const [problem, setProblem] = useState<Problem>()
  const [pick, setPick] = useState(0)
  const ctx = { levels, unavailable: unavailable ?? [] }
  const current = { ex: st.ex!, level: st.level ?? 0 }
  const base = st.orig ?? { ...current, item: st.item! }
  const later = fromRound > (st.round ?? 1) && <div className="small muted">Série {st.round} déjà commencée : le changement s’applique à partir de la série {fromRound}.</div>

  if (!problem) {
    return (
      <Sheet onClose={onClose}>
        <div className="ex-name">Changer d’exercice</div>
        <div className="small muted" style={{ marginTop: -8 }}>{EXERCISES[st.ex!].name} : quel est le problème ?</div>
        {later}
        <div className="stack" style={{ gap: 6 }}>
          {problemsFor(base, ctx, current).map((p) => (
            <button key={p} className="level" onClick={() => { setProblem(p); setPick(0) }}><span className="grow">{PROBLEM_LABEL[p]}</span>›</button>
          ))}
        </div>
        {st.orig && <button className="btn block" onClick={onRestore}>Revenir à {EXERCISES[st.orig.ex].name}</button>}
      </Sheet>
    )
  }

  const options = optionsFor(base, ctx, problem, current)
  const o = options[Math.min(pick, options.length - 1)]
  const g = gearForExercise(o.ex, o.level), cur = gearForExercise(current.ex, current.level)
  const newGear = g.equip.some((e) => e !== 'mur' && !cur.equip.includes(e)) || g.anchors.some((a) => !cur.anchors.includes(a))
  return (
    <Sheet onClose={onClose}>
      <button className="btn sm ghost" style={{ alignSelf: 'flex-start' }} onClick={() => setProblem(undefined)}>‹ {PROBLEM_LABEL[problem]}</button>
      {options.length > 1 && (
        <div className="row wrap" style={{ gap: 6 }}>
          {options.map((x, i) => (
            <button key={`${x.ex}${x.level}`} className={`chip tap ${x === o ? 'on' : ''}`} onClick={() => setPick(i)}>
              {x.ex === base.ex ? levelOf(x.ex, x.level)?.label : EXERCISES[x.ex].name}
            </button>
          ))}
        </div>
      )}
      {superset && newGear && <div className="next-hint">⚡ Cet exercice s’enchaîne sans repos et la variante demande un autre matériel : prépare-le avant de commencer le tour.</div>}
      {later}
      <VariantPreview o={o} />
      <button className="btn primary big block" onClick={() => onPick(o)}>Remplacer</button>
    </Sheet>
  )
}

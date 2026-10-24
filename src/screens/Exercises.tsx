import Demo from '../anim/Demo'
import Figure from '../anim/Figure'
import { EXERCISES } from '../data/exercises'
import { HowTo } from '../components/ExerciseInfo'
import { IconBack } from '../components/icons'
import { GearChips, SettingRow, Stepper, Toggle } from '../components/ui'
import { animOf, gearForExercise, levelOf, programLevel } from '../lib/program'
import { useStore } from '../store'
import { BAND_COLORS } from '../anim/Figure'
import { SESSIONS } from '../data/sessions'
import { workOf } from '../data/muscles'
import MuscleMap from '../components/MuscleMap'

const CATS: [string, string[]][] = [
  ['Poussée', ['pushup', 'pushup-decline', 'pushup-diamond', 'pike', 'dips-bed', 'fly-band', 'lat-raise', 'triceps-oh']],
  ['Tirage', ['row-seated', 'row-backpack', 'pulldown-kneel', 'pullover', 'face-pull', 'pull-apart', 'curl', 'hammer']],
  ['Jambes', ['lunge', 'box-squat', 'calf', 'hip-thrust', 'leg-curl', 'rdl']],
  ['Abdos', ['crunch-band', 'plank', 'leg-raise', 'side-plank', 'dead-bug', 'hollow']],
  ['Échauffement & genoux', ['march', 'arm-circles', 'cat-cow', 'scap-pushup', 'inchworm', 'glute-bridge', 'clamshell', 'tke', 'tib-raise', 'wall-sit', 'bw-squat']],
  ['Cardio en chambre', ['shadow-box', 'step-jack', 'climber']],
  ['Étirements', ['st-pecs', 'st-child', 'st-quad', 'st-hams', 'st-hip']],
]

export function ExercisesList({ onOpen }: { onOpen: (id: string) => void }) {
  const levels = useStore((s) => s.levels)
  const mastered = useStore((s) => s.mastered)
  return (
    <div className="page">
      <div className="page-title">Exercices</div>
      {CATS.map(([cat, ids]) => (
        <div key={cat} className="stack" style={{ gap: 8 }}>
          <div className="section-title">{cat}</div>
          <div className="card" style={{ padding: '4px 14px', gap: 0 }}>
            {ids.map((id) => {
              const ex = EXERCISES[id]
              const lvl = levels[id] ?? programLevel(id)
              return (
                <button key={id} className="list-row" style={{ width: '100%', textAlign: 'left' }} onClick={() => onOpen(id)}>
                  <Figure anim={animOf(id, lvl)} keyIndex={0} playing={false} band={levelOf(id, lvl)?.band} className="figure mini" />
                  <div className="grow">
                    <div style={{ fontWeight: 650 }}>{ex.name} {mastered[id] && <span className="small" style={{ color: 'var(--ok)' }}>✓</span>}</div>
                    <div className="small muted">{ex.levels && ex.levels.length > 1 ? levelOf(id, lvl)?.label : ex.muscles}</div>
                  </div>
                </button>
              )
            })}
          </div>
        </div>
      ))}
    </div>
  )
}

/** Les objectifs de temps ne s'appliquent qu'aux séances principales (pas aux routines). */
const isMainExercise = (exId: string) =>
  Object.values(SESSIONS).some((ses) => ses.kind === 'muscu' && ses.blocks.some((b) => b.items.some((it) => it.ex === exId)))

export function ExerciseDetail({ id, onBack }: { id: string; onBack: () => void }) {
  const s = useStore()
  const ex = EXERCISES[id]
  const lvl = s.levels[id] ?? programLevel(id)
  const level = levelOf(id, lvl)
  const timedItem = Object.values(SESSIONS).flatMap((ses) => ses.blocks.flatMap((b) => b.items)).find((it) => it.ex === id && it.duration)
  const timed = isMainExercise(id) && !!timedItem
  return (
    <div className="page">
      <div className="topbar">
        <button className="icon-btn" onClick={onBack} aria-label="Retour"><IconBack /></button>
        <div className="grow ex-name">{ex.name}</div>
      </div>
      <Demo anim={animOf(id, lvl)} band={level?.band} />
      <div className="small muted">{ex.muscles}</div>
      <MuscleMap work={workOf(id)} />
      <GearChips gear={gearForExercise(id, lvl)} />
      <HowTo exId={id} />

      {ex.levels && ex.levels.length > 1 && (
        <>
          <div className="section-title">Niveau actuel</div>
          <div className="stack" style={{ gap: 6 }}>
            {ex.levels.map((l, i) => (
              <button key={i} className={`level ${i === lvl ? 'on' : ''}`} onClick={() => s.setLevel(id, i)}>
                <span className="badge" style={{ background: i === lvl ? 'var(--accent-2)' : 'var(--surface-2)' }}>{i + 1}</span>
                <span className="grow">{l.label}</span>
                {l.band && <span className="dot" style={{ background: BAND_COLORS[l.band] }} />}
              </button>
            ))}
          </div>
          <div className="small muted">Quand toutes tes séries atteignent le haut de la fourchette proprement, passe au niveau suivant.</div>
        </>
      )}

      <div className="card" style={{ padding: '4px 16px', gap: 0 }}>
        <SettingRow title="Mouvement maîtrisé" desc="Affichage compact pendant la séance">
          <Toggle on={!!s.mastered[id]} onChange={(v) => s.setMastered(id, v)} />
        </SettingRow>
        {timed && (
          <SettingRow title="Objectif de temps" desc="Utilisé par le chrono">
            <Stepper value={s.timeTargets[id] ?? timedItem?.duration ?? 30}min={10} max={180} step={5} format={(v) => `${v} s`} onChange={(v) => s.setTimeTarget(id, v)} />
          </SettingRow>
        )}
      </div>
    </div>
  )
}

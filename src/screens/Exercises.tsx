import { useState } from 'react'
import Demo from '../anim/Demo'
import Figure from '../anim/Figure'
import { EXERCISES } from '../data/exercises'
import { HowTo } from '../components/ExerciseInfo'
import { IconBack } from '../components/icons'
import { GearChips, Sheet, SettingRow, Stepper, Toggle } from '../components/ui'
import { targetOf, VariantPreview } from '../components/VariantSheet'
import { animOf, exerciseHistory, formatDate, gearForExercise, levelOf, programLevel, tempoOf, videoOf } from '../lib/program'
import { LineChart, SERIES } from '../components/Charts'
import { useStore } from '../store'
import { BAND_COLORS } from '../anim/Figure'
import { SESSIONS } from '../data/sessions'
import { workOf } from '../data/muscles'
import MuscleMap from '../components/MuscleMap'
import { optionsFor, type SwapChoice } from '../lib/variants'

const CATS: [string, string[]][] = [
  ['Poussée', ['pushup', 'pushup-decline', 'pushup-diamond', 'pike', 'dips-bed', 'fly-band', 'lat-raise', 'lat-raise-sac', 'triceps-oh']],
  ['Tirage', ['row-seated', 'row-backpack', 'pulldown-kneel', 'pullover', 'face-pull', 'pull-apart', 'prone-t', 'curl', 'hammer']],
  ['Jambes', ['lunge', 'box-squat', 'calf', 'calf-floor', 'hip-thrust', 'leg-curl', 'ham-bridge', 'rdl']],
  ['Abdos', ['crunch-band', 'crunch-sac', 'bicycle', 'plank', 'leg-raise', 'side-plank', 'dead-bug', 'hollow']],
  ['Échauffement & genoux', ['march', 'arm-circles', 'cat-cow', 'scap-pushup', 'inchworm', 'glute-bridge', 'clamshell', 'tke', 'slr', 'tib-raise', 'wall-sit', 'bw-squat']],
  ['Cardio en chambre', ['shadow-box', 'step-jack', 'climber']],
  ['Étirements', ['st-pecs', 'st-child', 'st-quad', 'st-hams', 'st-hip']],
  ['Étirements du matin', ['st-knees', 'st-fig4', 'st-squat', 'st-calf', 'st-fold', 'st-side', 'st-cross']],
]

/** Minuscules sans accents, pour chercher « elevation » ou « épaule » indifféremment. */
const fold = (x: string) => x.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()

export function ExercisesList({ onOpen }: { onOpen: (id: string) => void }) {
  const levels = useStore((s) => s.levels)
  const mastered = useStore((s) => s.mastered)
  const [q, setQ] = useState('')
  const words = fold(q).split(/\s+/).filter(Boolean)
  const match = (id: string) => {
    const ex = EXERCISES[id]
    const text = fold(`${ex.name} ${ex.muscles} ${(ex.levels ?? []).map((l) => l.label).join(' ')}`)
    return words.every((w) => text.includes(w))
  }
  const cats = CATS.map(([cat, ids]) => [cat, ids.filter(match)] as const).filter(([, ids]) => ids.length > 0)
  return (
    <div className="page">
      <div className="page-title">Exercices</div>
      <div className="search">
        <input className="input" type="search" placeholder="Chercher : pompes, épaules, élastique…" value={q} onChange={(e) => setQ(e.target.value)} enterKeyHint="search" />
        {q && <button className="search-clear" aria-label="Effacer" onClick={() => setQ('')}>×</button>}
      </div>
      {cats.length === 0 && <div className="muted center" style={{ padding: 24 }}>Aucun exercice pour « {q} ».</div>}
      {cats.map(([cat, ids]) => (
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
      <Demo anim={animOf(id, lvl)} band={level?.band} tempo={tempoOf(id)} video={videoOf(id, lvl)} />
      <div className="small muted">{ex.muscles}</div>
      <MuscleMap work={workOf(id)} />
      <GearChips gear={gearForExercise(id, lvl)} />
      <HowTo exId={id} />

      <Progress id={id} />

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

      <Variants id={id} level={lvl} />

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

/** Variantes de l'exercice : à consulter, ou à activer pour la prochaine séance qui le contient. */
function Variants({ id, level }: { id: string; level: number }) {
  const s = useStore()
  const [open, setOpen] = useState<SwapChoice>()
  const item = Object.values(SESSIONS).flatMap((ses) => ses.blocks.flatMap((b) => b.items)).find((it) => it.ex === id) ?? { ex: id, sets: 1 }
  const options = optionsFor({ ex: id, level, item }, { levels: s.levels, unavailable: s.unavailable ?? [] })
  if (!options.length) return null
  const planned = s.planned?.[id]
  const isPlanned = (o: SwapChoice) => planned?.ex === o.ex && planned.level === o.level
  return (
    <>
      <div className="section-title">Variantes</div>
      <div className="stack" style={{ gap: 6 }}>
        {options.map((o) => (
          <button key={`${o.ex}${o.level}`} className={`level ${isPlanned(o) ? 'on' : ''}`} onClick={() => setOpen(o)}>
            <span className="grow">
              {EXERCISES[o.ex].name}{o.ex === id ? ` · ${levelOf(o.ex, o.level)?.label}` : ''}
              <div className="small muted">{isPlanned(o) ? 'Prévue à la prochaine séance' : targetOf(o)}</div>
            </span>
            ›
          </button>
        ))}
      </div>
      {open && (
        <Sheet onClose={() => setOpen(undefined)}>
          <VariantPreview o={open} />
          <button className={`btn big block ${isPlanned(open) ? '' : 'primary'}`} onClick={() => { s.setPlanned(id, isPlanned(open) ? undefined : open); setOpen(undefined) }}>
            {isPlanned(open) ? 'Ne plus l’utiliser' : 'Utiliser à la prochaine séance'}
          </button>
        </Sheet>
      )}
    </>
  )
}

/** Mes progrès sur un exercice : courbe de la meilleure série et de la moyenne, changements de niveau, dernières séances. */
function Progress({ id }: { id: string }) {
  const workouts = useStore((s) => s.workouts)
  const levelLog = useStore((s) => s.levelLog)
  const hist = exerciseHistory(id, workouts)
  if (!hist.length) return null
  const timed = hist.at(-1)!.timed
  const unit = timed ? 's' : 'reps'
  const series = [
    { name: timed ? 'Meilleur temps' : 'Meilleure série', color: SERIES[0], data: hist.map((h) => ({ x: h.date, y: h.best })) },
    ...(timed ? [] : [{ name: 'Moyenne', color: SERIES[1], data: hist.map((h) => ({ x: h.date, y: Math.round((h.avg ?? h.best) * 10) / 10 })) }]),
  ]
  const ups = levelLog.filter((e) => e.ex === id)
  const first = hist[0], last = hist.at(-1)!
  const delta = last.level === first.level ? last.best - first.best : undefined
  return (
    <>
      <div className="section-title">Mes progrès</div>
      <div className="card" style={{ gap: 8 }}>
        {hist.length > 1 ? <LineChart series={series} unit={unit} height={150} /> : <div className="small muted">1re séance enregistrée : la courbe apparaît dès la 2e.</div>}
        {delta !== undefined && hist.length > 1 && (
          <div className="small">{delta > 0 ? `📈 +${delta} ${unit} sur ta meilleure série depuis le ${formatDate(first.date).toLowerCase()}` : delta < 0 ? `📉 ${delta} ${unit} depuis le ${formatDate(first.date).toLowerCase()} : vérifie ta récupération (sommeil, repas).` : '➡️ Stable pour l’instant : vise +1 rep par série à la prochaine séance.'}</div>
        )}
        {ups.map((e) => <div key={e.date + e.level} className="small">🆙 {levelOf(id, e.level)?.label ?? `Niveau ${e.level + 1}`} depuis le {formatDate(e.date).toLowerCase()}</div>)}
        <div className="stack" style={{ gap: 2 }}>
          {hist.slice(-4).reverse().map((h, i) => (
            <div key={i} className="row between small">
              <span className="muted" style={{ textTransform: 'capitalize' }}>{formatDate(h.date)}</span>
              <span>{h.reps ? h.reps.join(' · ') + ' reps' : `${h.best} s`}{levelOf(id, h.level) && EXERCISES[id].levels!.length > 1 ? <span className="muted"> · {levelOf(id, h.level)!.label}</span> : null}</span>
            </div>
          ))}
        </div>
      </div>
    </>
  )
}

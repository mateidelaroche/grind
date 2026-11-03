// Réglage des boucles vidéo à la chaîne : les vidéos pas encore réglées d'abord, une à la fois.
import { useMemo, useState } from 'react'
import { EXERCISES } from '../data/exercises'
import { VIDEOS } from '../data/videos'
import { IconBack } from '../components/icons'
import YouTubeLoop, { loopKeyOf } from '../anim/YouTubeLoop'
import { useStore } from '../store'

/** Nom lisible d'une entrée vidéo : un exercice, ou un niveau qui a sa propre vidéo (fente bulgare…). */
function nameOf(key: string) {
  if (EXERCISES[key]) return EXERCISES[key].name
  for (const ex of Object.values(EXERCISES)) {
    const l = ex.levels?.find((x) => x.anim === key)
    if (l) return `${ex.name} · ${l.label}`
  }
  return key
}

export const videoEntries = () => {
  const seen = new Set<string>()
  return Object.entries(VIDEOS).filter(([, v]) => (seen.has(v.id) ? false : (seen.add(v.id), true))).map(([key, v]) => ({ ...v, key, name: nameOf(key) }))
}

const NO_LOOPS: Record<string, [number, number]> = {}

export default function Loops({ onBack }: { onBack: () => void }) {
  const loops = useStore((s) => s.videoLoops) ?? NO_LOOPS
  const all = useMemo(videoEntries, [])
  const todo = all.filter((v) => !loops[loopKeyOf(v)])
  const [cur, setCur] = useState<string | undefined>(() => todo[0]?.key)
  const v = all.find((x) => x.key === cur)
  const nextAfter = (key: string) => {
    const left = all.filter((x) => x.key !== key && !useStore.getState().videoLoops?.[loopKeyOf(x)])
    setCur(left[0]?.key)
  }
  return (
    <div className="page">
      <div className="topbar">
        <button className="icon-btn" onClick={onBack} aria-label="Retour"><IconBack /></button>
        <div className="grow">
          <div className="ex-name">Boucles vidéo</div>
          <div className="small muted">{all.length - todo.length}/{all.length} réglées</div>
        </div>
      </div>
      <div className="progress"><div style={{ width: `${((all.length - todo.length) / all.length) * 100}%` }} /></div>
      {v ? (
        <div className="stack" style={{ gap: 10 }}>
          <div style={{ fontWeight: 700 }}>{v.name}</div>
          <YouTubeLoop key={v.key} v={v} startEditing onSaved={() => nextAfter(v.key)} />
          <button className="btn sm ghost" onClick={() => nextAfter(v.key)}>Passer cette vidéo ›</button>
        </div>
      ) : (
        <div className="card accent center"><div className="ex-name">Toutes les boucles sont réglées 🎬</div></div>
      )}
      <div className="section-title">Toutes les vidéos</div>
      <div className="card" style={{ padding: '4px 16px', gap: 0 }}>
        {all.map((x) => {
          const l = loops[loopKeyOf(x)]
          return (
            <button key={x.key} className="list-row" style={{ width: '100%', textAlign: 'left' }} onClick={() => { setCur(x.key); window.scrollTo({ top: 0, behavior: 'smooth' }) }}>
              <span className="grow" style={{ fontWeight: x.key === cur ? 800 : 600 }}>{l ? '✅' : '⬜'} {x.name}</span>
              <span className="small muted">{l ? `${Math.round(l[0])}-${Math.round(l[1])} s` : 'à régler'}</span>
            </button>
          )
        })}
      </div>
    </div>
  )
}

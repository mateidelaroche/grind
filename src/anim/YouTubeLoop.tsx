// Lecteur YouTube qui rejoue en boucle un passage court (le mouvement seul), sans contrôles ni son.
// Le passage se règle en 2 touches (Début / Fin) et s'enregistre par vidéo.
import { useEffect, useRef, useState } from 'react'
import { useStore } from '../store'
import type { VideoRef } from '../data/videos'

interface YTPlayer {
  getCurrentTime(): number
  getDuration(): number
  seekTo(s: number, allowSeekAhead: boolean): void
  playVideo(): void
  pauseVideo(): void
  mute(): void
  destroy(): void
}
interface YTNamespace {
  Player: new (el: HTMLElement, opts: Record<string, unknown>) => YTPlayer
  PlayerState: { ENDED: number; PLAYING: number }
}
declare global {
  interface Window { YT?: YTNamespace; onYouTubeIframeAPIReady?: () => void }
}

let apiReady: Promise<YTNamespace> | undefined
/** Charge l'API du lecteur YouTube une seule fois. */
function loadApi(): Promise<YTNamespace> {
  if (window.YT?.Player) return Promise.resolve(window.YT)
  apiReady ??= new Promise((resolve) => {
    const prev = window.onYouTubeIframeAPIReady
    window.onYouTubeIframeAPIReady = () => { prev?.(); resolve(window.YT!) }
    const s = document.createElement('script')
    s.src = 'https://www.youtube.com/iframe_api'
    document.head.appendChild(s)
  })
  return apiReady
}

const DEFAULT_LEN = 10
const fmt = (t: number) => `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, '0')}`

export default function YouTubeLoop({ v }: { v: VideoRef & { key: string } }) {
  // Réglage propre à cette vidéo (si la vidéo d'un exercice change, l'ancien réglage ne s'applique pas).
  const loopKey = `${v.key}@${v.id}`
  const saved = useStore((s) => s.videoLoops?.[loopKey])
  const setVideoLoop = useStore((s) => s.setVideoLoop)
  const loop: [number, number] = saved ?? v.loop ?? [0, DEFAULT_LEN]
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState<[number, number]>(loop)
  const host = useRef<HTMLDivElement>(null)
  const player = useRef<YTPlayer>(undefined)
  const range = useRef(loop)
  range.current = editing ? draft : loop

  useEffect(() => {
    let dead = false
    let timer = 0
    const el = document.createElement('div')
    host.current?.appendChild(el)
    loadApi().then((YT) => {
      if (dead) return
      player.current = new YT.Player(el, {
        videoId: v.id,
        host: 'https://www.youtube-nocookie.com',
        playerVars: {
          autoplay: 1, mute: 1, playsinline: 1, rel: 0, modestbranding: 1, iv_load_policy: 3, disablekb: 1,
          controls: editing ? 1 : 0, fs: 0, start: Math.floor(range.current[0]),
        },
        events: {
          onReady: (e: { target: YTPlayer }) => { e.target.mute(); e.target.playVideo() },
          // Fin de vidéo atteinte malgré tout : on repart au début du passage.
          onStateChange: (e: { data: number; target: YTPlayer }) => {
            if (e.data === YT.PlayerState.ENDED) { e.target.seekTo(range.current[0], true); e.target.playVideo() }
          },
        },
      })
      if (import.meta.env.DEV) (window as unknown as { __yt?: () => number }).__yt = () => player.current?.getCurrentTime?.() ?? -1
      // En lecture normale, on revient au début du passage dès qu'on en sort.
      timer = window.setInterval(() => {
        const p = player.current
        if (!p?.getCurrentTime || editing) return
        const t = p.getCurrentTime()
        const [a, b] = range.current
        if (t >= b - 0.15 || t < a - 1) p.seekTo(a, true)
      }, 200)
    })
    return () => { dead = true; clearInterval(timer); player.current?.destroy(); player.current = undefined; el.remove() }
  }, [v.id, editing])

  const now = () => player.current?.getCurrentTime?.() ?? 0
  return (
    <div className="stack" style={{ gap: 6 }}>
      <div ref={host} className={`figure video-frame ${v.vertical ? 'vertical' : ''} ${editing ? 'editing' : ''}`} />
      {editing ? (
        <div className="card" style={{ gap: 8, padding: 12 }}>
          <div className="small muted">Mets la vidéo au début du mouvement → « Début », laisse-la jouer une répétition → « Fin ».</div>
          <div className="row">
            <button className="btn sm grow" onClick={() => { const t = now(); setDraft([t, Math.max(t + 2, draft[1] > t ? draft[1] : t + DEFAULT_LEN)]) }}>⏮ Début {fmt(draft[0])}</button>
            <button className="btn sm grow" onClick={() => { const t = now(); if (t > draft[0] + 1) setDraft([draft[0], t]) }}>⏭ Fin {fmt(draft[1])}</button>
          </div>
          <div className="row">
            <button className="btn sm ghost grow" onClick={() => { setVideoLoop(loopKey, undefined); setEditing(false) }}>Réinitialiser</button>
            <button className="btn sm ghost" onClick={() => setEditing(false)}>Annuler</button>
            <button className="btn sm primary grow" onClick={() => { setVideoLoop(loopKey, draft); setEditing(false) }}>Enregistrer</button>
          </div>
        </div>
      ) : (
        <button className="tiny muted loop-tag" onClick={() => { setDraft(loop); setEditing(true) }}>
          🔁 Boucle {fmt(loop[0])} → {fmt(loop[1])}{saved ? '' : ' (par défaut)'} · <u>✂ régler</u>
        </button>
      )}
    </div>
  )
}

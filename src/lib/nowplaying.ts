// Expérimental : le minuteur de séance sur l'écran verrouillé et dans le centre de contrôle.
// Une appli web ne peut pas créer d'« activité en direct » : on passe par le lecteur « En cours de lecture »
// (piste silencieuse en boucle + Media Session). La barre de progression avance toute seule, même appli fermée.
import { useStore } from '../store'

export interface NowPlaying {
  title: string
  artist: string
  /** Minuteur : durée totale et temps restant (s). Sans durée : simple affichage. */
  dur?: number
  left?: number
  paused?: boolean
  onPause?: () => void
  onPlay?: () => void
  onNext?: () => void
}

let el: HTMLAudioElement | undefined
let active = false
let wav: string | undefined

const ms = () => ('mediaSession' in navigator ? navigator.mediaSession : undefined)
const enabled = () => !!useStore.getState().settings.lockScreen && !!ms()
const audioSession = (type: string) => {
  const nav = navigator as Navigator & { audioSession?: { type: string } }
  if (nav.audioSession) nav.audioSession.type = type
}

/** 10 s de silence (WAV 8 kHz, 8 bits) : ~80 ko, joué en boucle. */
function silence() {
  if (wav) return wav
  const n = 8000 * 10
  const b = new DataView(new ArrayBuffer(44 + n))
  const str = (o: number, s: string) => [...s].forEach((c, i) => b.setUint8(o + i, c.charCodeAt(0)))
  str(0, 'RIFF'); b.setUint32(4, 36 + n, true); str(8, 'WAVEfmt ')
  b.setUint32(16, 16, true); b.setUint16(20, 1, true); b.setUint16(22, 1, true)
  b.setUint32(24, 8000, true); b.setUint32(28, 8000, true); b.setUint16(32, 1, true); b.setUint16(34, 8, true)
  str(36, 'data'); b.setUint32(40, n, true)
  for (let i = 0; i < n; i++) b.setUint8(44 + i, 128)
  wav = URL.createObjectURL(new Blob([b.buffer], { type: 'audio/wav' }))
  return wav
}

/** À chaque toucher : lance la piste silencieuse si une séance est en cours (iOS exige un geste). */
export function primeNowPlaying() {
  if (!active || !enabled()) return
  if (!el) {
    el = new Audio(silence())
    el.loop = true
    el.setAttribute('playsinline', '')
  }
  if (el.paused) {
    audioSession('auto')
    void el.play().catch(() => {})
  }
}

export function startNowPlaying() {
  active = true
  primeNowPlaying()
}

export function stopNowPlaying() {
  active = false
  el?.pause()
  const m = ms()
  if (m) {
    m.metadata = null
    m.playbackState = 'none'
    try { m.setPositionState() } catch { /* rien à effacer */ }
    for (const a of ['play', 'pause', 'nexttrack'] as MediaSessionAction[]) try { m.setActionHandler(a, null) } catch { /* action non gérée */ }
  }
  audioSession('ambient')
}

export function showNowPlaying(info: NowPlaying) {
  const m = ms()
  if (!active || !enabled() || !m) return
  primeNowPlaying()
  const icon = new URL('icon-512.png', document.baseURI).href
  m.metadata = new MediaMetadata({ title: info.title, artist: info.artist, album: 'Grind', artwork: [{ src: icon, sizes: '512x512', type: 'image/png' }] })
  try {
    if (info.dur && info.dur > 0) {
      const position = Math.min(info.dur, Math.max(0, info.dur - (info.left ?? info.dur)))
      m.setPositionState({ duration: info.dur, position, playbackRate: 1 })
    } else m.setPositionState()
  } catch { /* pas de barre de progression sur ce navigateur */ }
  m.playbackState = info.paused ? 'paused' : 'playing'
  const handle = (a: MediaSessionAction, fn?: () => void) => { try { m.setActionHandler(a, fn ? () => fn() : null) } catch { /* action non gérée */ } }
  handle('pause', info.onPause)
  handle('play', info.onPlay)
  handle('nexttrack', info.onNext)
}

// Bips (Web Audio), voix (synthèse vocale) et maintien de l'écran allumé.
import { useStore } from '../store'

let ctx: AudioContext | undefined

/** À appeler sur un geste utilisateur (iOS exige un tap pour activer le son). */
export function unlockAudio() {
  try {
    // Mode « ambient » : les bips se mélangent à ta musique au lieu de la couper.
    const nav = navigator as Navigator & { audioSession?: { type: string } }
    if (nav.audioSession) nav.audioSession.type = 'ambient'
    if (!ctx) ctx = new AudioContext()
    if (ctx.state === 'suspended') void ctx.resume()
    const buf = ctx.createBuffer(1, 1, 22050)
    const src = ctx.createBufferSource()
    src.buffer = buf
    src.connect(ctx.destination)
    src.start(0)
  } catch {
    /* pas de son disponible */
  }
}

function tone(freq: number, dur: number, when = 0, vol = 0.5) {
  if (!useStore.getState().settings.sounds) return
  if (!ctx) unlockAudio()
  if (!ctx) return
  const t0 = ctx.currentTime + when
  const osc = ctx.createOscillator()
  const gain = ctx.createGain()
  osc.type = 'sine'
  osc.frequency.value = freq
  gain.gain.setValueAtTime(0.0001, t0)
  gain.gain.exponentialRampToValueAtTime(vol, t0 + 0.01)
  gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur)
  osc.connect(gain).connect(ctx.destination)
  osc.start(t0)
  osc.stop(t0 + dur + 0.05)
}

export const beep = {
  tick: () => tone(880, 0.12),
  go: () => tone(1320, 0.4, 0, 0.6),
  half: () => { tone(990, 0.1); tone(990, 0.1, 0.15) },
  end: () => { tone(1320, 0.18, 0, 0.6); tone(1760, 0.5, 0.2, 0.6) },
  done: () => { tone(660, 0.12); tone(880, 0.12, 0.12); tone(1320, 0.3, 0.24) },
  // Course : « cours » = montée aiguë, « marche » = descente grave (reconnaissables sans regarder l'écran)
  run: () => { tone(880, 0.14, 0, 0.7); tone(1175, 0.14, 0.16, 0.7); tone(1568, 0.45, 0.32, 0.7) },
  walk: () => { tone(784, 0.3, 0, 0.7); tone(523, 0.6, 0.32, 0.7) },
  // Métronome : descente (grave), pause (médium), montée (aigu)
  down: () => tone(440, 0.08, 0, 0.35),
  hold: () => tone(660, 0.08, 0, 0.35),
  up: () => tone(990, 0.08, 0, 0.35),
}

export function say(text: string) {
  if (!useStore.getState().settings.voice || !('speechSynthesis' in window)) return
  speechSynthesis.cancel()
  const u = new SpeechSynthesisUtterance(text)
  u.lang = 'fr-FR'
  u.rate = 1.05
  const v = speechSynthesis.getVoices().find((x) => x.lang.startsWith('fr'))
  if (v) u.voice = v
  speechSynthesis.speak(u)
}

// ───────────── Écran allumé ─────────────
let lock: WakeLockSentinel | undefined
let wanted = false

export async function keepAwake(on: boolean) {
  wanted = on && useStore.getState().settings.wakeLock
  try {
    if (wanted && !lock && 'wakeLock' in navigator) {
      lock = await navigator.wakeLock.request('screen')
      lock.addEventListener('release', () => { lock = undefined })
    } else if (!wanted && lock) {
      await lock.release()
      lock = undefined
    }
  } catch {
    /* refusé (batterie faible, etc.) */
  }
}

document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible' && wanted) void keepAwake(true)
})

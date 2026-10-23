import { useCallback, useEffect, useRef, useState } from 'react'
import { beep, say } from './audio'

export type TimerState = 'idle' | 'prep' | 'run' | 'paused' | 'done'

interface Opts {
  /** Compte à rebours de préparation « 3, 2, 1, go » (s). */
  prep?: number
  autoStart?: boolean
  onEnd?: () => void
  resetKey: string
}

/**
 * Chrono basé sur l'heure de fin (et non sur des ticks) : si iOS met l'appli en pause,
 * le temps restant est juste quand tu reviens.
 */
export function useCountdown(duration: number, { prep = 0, autoStart = false, onEnd, resetKey }: Opts) {
  const [state, setState] = useState<TimerState>('idle')
  const [remaining, setRemaining] = useState(duration)
  const [total, setTotal] = useState(duration)
  const endAt = useRef(0)
  const pausedLeft = useRef(0)
  const lastSec = useRef(-1)
  const stateRef = useRef<TimerState>('idle')
  const onEndRef = useRef(onEnd)
  onEndRef.current = onEnd
  const totalRef = useRef(duration)

  const set = (s: TimerState) => { stateRef.current = s; setState(s) }

  const run = useCallback((secs: number) => {
    endAt.current = Date.now() + secs * 1000
    lastSec.current = Math.ceil(secs)
    set('run')
  }, [])

  const start = useCallback(() => {
    if (prep > 0) {
      endAt.current = Date.now() + prep * 1000
      lastSec.current = prep + 1
      set('prep')
    } else {
      beep.go()
      run(totalRef.current)
    }
  }, [prep, run])

  useEffect(() => {
    totalRef.current = duration
    setTotal(duration)
    setRemaining(duration)
    set('idle')
    if (autoStart) start()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resetKey])

  useEffect(() => {
    const id = window.setInterval(() => {
      const st = stateRef.current
      if (st !== 'run' && st !== 'prep') return
      const left = (endAt.current - Date.now()) / 1000
      const sec = Math.ceil(left)
      if (st === 'prep') {
        if (sec < lastSec.current && sec > 0) { beep.tick(); lastSec.current = sec }
        setRemaining(totalRef.current)
        if (left <= 0) { beep.go(); run(totalRef.current) }
        return
      }
      setRemaining(Math.max(0, left))
      if (sec < lastSec.current) {
        lastSec.current = sec
        if (sec >= 1 && sec <= 3) beep.tick()
      }
      if (left <= 0) {
        set('done')
        beep.end()
        onEndRef.current?.()
      }
    }, 100)
    return () => clearInterval(id)
  }, [run])

  const pause = () => {
    if (stateRef.current !== 'run') return
    pausedLeft.current = (endAt.current - Date.now()) / 1000
    set('paused')
  }
  const resume = () => { if (stateRef.current === 'paused') run(pausedLeft.current) }
  const add = (s: number) => {
    totalRef.current = Math.max(5, totalRef.current + s)
    setTotal(totalRef.current)
    if (stateRef.current === 'run') {
      endAt.current = Math.max(Date.now() + 1000, endAt.current + s * 1000)
      setRemaining((endAt.current - Date.now()) / 1000)
    } else if (stateRef.current === 'paused') {
      pausedLeft.current = Math.max(1, pausedLeft.current + s)
      setRemaining(pausedLeft.current)
    } else setRemaining(totalRef.current)
  }
  const prepLeft = state === 'prep' ? Math.max(0, Math.ceil((endAt.current - Date.now()) / 1000)) : 0

  return { state, remaining, total, prepLeft, start, pause, resume, add }
}

/** Métronome de tempo (ex. "3-1-1") : bip grave = descends, médium = pause, aigu = monte. */
export function useMetronome(tempo: string | undefined, on: boolean) {
  useEffect(() => {
    if (!on || !tempo) return
    const parts = tempo.split('-').map(Number).filter((n) => !Number.isNaN(n))
    const phases: [number, () => void][] = [
      [parts[0] ?? 2, beep.down],
      [parts[1] ?? 0, beep.hold],
      [parts[2] ?? 1, beep.up],
    ].filter(([d]) => (d as number) > 0) as [number, () => void][]
    if (!phases.length) return
    let i = 0
    let t: number
    const step = () => {
      const [d, fn] = phases[i % phases.length]
      fn()
      i++
      t = window.setTimeout(step, d * 1000)
    }
    say('Tempo')
    t = window.setTimeout(step, 600)
    return () => clearTimeout(t)
  }, [tempo, on])
}

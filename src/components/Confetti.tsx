import { useEffect, useState } from 'react'

const COLORS = ['#3987e5', '#60a5fa', '#e8ecf3', '#facc15', '#f97316']

let fire: () => void = () => {}
/** Lance une pluie de confettis (records battus). */
export const celebrate = () => fire()

export function ConfettiHost() {
  const [burst, setBurst] = useState(0)
  useEffect(() => { fire = () => setBurst((b) => b + 1) }, [])
  useEffect(() => {
    if (!burst) return
    const t = setTimeout(() => setBurst(0), 2600)
    return () => clearTimeout(t)
  }, [burst])
  if (!burst || matchMedia('(prefers-reduced-motion: reduce)').matches) return null
  return (
    <div className="confetti" key={burst} aria-hidden>
      {Array.from({ length: 70 }, (_, i) => (
        <i
          key={i}
          style={{
            left: `${Math.random() * 100}%`,
            background: COLORS[i % COLORS.length],
            animationDelay: `${Math.random() * 0.4}s`,
            animationDuration: `${1.6 + Math.random() * 0.9}s`,
            transform: `rotate(${Math.random() * 360}deg)`,
            ['--dx' as string]: `${(Math.random() - 0.5) * 160}px`,
          }}
        />
      ))}
    </div>
  )
}

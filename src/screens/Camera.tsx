import { useEffect, useRef, useState } from 'react'
import Figure from '../anim/Figure'
import { beep, unlockAudio } from '../lib/audio'
import { compress, fileToDataURL } from '../lib/photos'
import type { PhotoPose } from '../types'

const GUIDE: Record<PhotoPose, string> = { face: 'guide-face', profil: 'guide-profil', dos: 'guide-face' }
const POSE_LABEL: Record<PhotoPose, string> = { face: 'De face', profil: 'De profil', dos: 'De dos' }

/** Prise de photo avec silhouette guide et retardateur (pour se placer à distance). */
export default function Camera({ pose, onShot, onClose }: { pose: PhotoPose; onShot: (dataUrl: string) => void; onClose: () => void }) {
  const video = useRef<HTMLVideoElement>(null)
  const file = useRef<HTMLInputElement>(null)
  const [facing, setFacing] = useState<'user' | 'environment'>('environment')
  const [delay, setDelay] = useState(10)
  const [count, setCount] = useState<number>()
  const [error, setError] = useState<string>()

  useEffect(() => {
    let stream: MediaStream | undefined
    navigator.mediaDevices?.getUserMedia({ video: { facingMode: facing, width: { ideal: 1920 }, height: { ideal: 1440 } }, audio: false })
      .then((s) => { stream = s; if (video.current) { video.current.srcObject = s; void video.current.play() } })
      .catch(() => setError('Caméra indisponible : choisis une photo depuis ta galerie.'))
    return () => stream?.getTracks().forEach((t) => t.stop())
  }, [facing])

  const shoot = async () => {
    unlockAudio()
    for (let n = delay; n > 0; n--) {
      setCount(n)
      if (n <= 3) beep.tick()
      await new Promise((r) => setTimeout(r, 1000))
    }
    setCount(undefined)
    beep.go()
    if (video.current) onShot(await compress(video.current))
  }

  return (
    <div className="cam">
      <video ref={video} playsInline muted style={facing === 'user' ? { transform: 'scaleX(-1)' } : undefined} />
      <div className="guide"><Figure anim={GUIDE[pose]} keyIndex={0} playing={false} className="" /></div>
      <div className="top">
        <span className="badge">{POSE_LABEL[pose]}</span>
        <button className="btn sm" onClick={onClose}>Fermer</button>
      </div>
      {count !== undefined && <div className="count">{count}</div>}
      {error && <div className="toast" style={{ bottom: 120 }}>{error}</div>}
      <div className="bar">
        <button className="btn sm" onClick={() => setFacing(facing === 'user' ? 'environment' : 'user')}>🔄</button>
        <button className="btn sm" onClick={() => setDelay(delay === 10 ? 3 : delay === 3 ? 0 : 10)}>⏱ {delay ? `${delay} s` : 'off'}</button>
        <button className="btn primary grow" disabled={count !== undefined || !!error} onClick={() => void shoot()}>📸 Prendre</button>
        <button className="btn sm" onClick={() => file.current?.click()}>🖼️</button>
        <input ref={file} type="file" accept="image/*" hidden onChange={async (e) => {
          const f = e.target.files?.[0]
          if (f) onShot(await fileToDataURL(f))
        }} />
      </div>
    </div>
  )
}

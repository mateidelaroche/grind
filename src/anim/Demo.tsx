import { lazy, Suspense, useSyncExternalStore } from 'react'
import Figure from './Figure'
import { tempoAnim } from './anims'
import YouTubeLoop from './YouTubeLoop'
import { useStore } from '../store'
import type { VideoRef } from '../data/videos'
import type { Band } from '../types'

// three.js n'est chargé qu'au premier affichage d'une démo 3D.
const Figure3D = lazy(() => import('./Figure3D'))

const webgl = (() => {
  try {
    const c = document.createElement('canvas')
    return !!(c.getContext('webgl2') || c.getContext('webgl'))
  } catch {
    return false
  }
})()

const subscribe = (cb: () => void) => {
  window.addEventListener('online', cb)
  window.addEventListener('offline', cb)
  return () => { window.removeEventListener('online', cb); window.removeEventListener('offline', cb) }
}
const useOnline = () => useSyncExternalStore(subscribe, () => navigator.onLine)

/** Grande démo d'un exercice : vidéo YouTube si dispo et en ligne, sinon animation 3D (ou silhouette 2D). */
export default function Demo({ anim: base, band, tempo, video }: { anim: string; band?: Band; tempo?: string; video?: VideoRef & { key: string } }) {
  const anim = tempoAnim(base, tempo)
  const use3d = useStore((s) => s.settings.anim3d) && webgl
  const mode = useStore((s) => s.settings.demo ?? 'video')
  const setSettings = useStore((s) => s.setSettings)
  const online = useOnline()
  const showVideo = !!video && online && mode === 'video'
  const animation = !use3d ? <Figure anim={anim} band={band} className="figure" /> : (
    <Suspense fallback={<Figure anim={anim} band={band} className="figure" />}>
      <Figure3D anim={anim} band={band} />
    </Suspense>
  )
  if (!video) return animation
  return (
    <div className="demo">
      {showVideo ? <YouTubeLoop key={video.key} v={video} /> : animation}
      <div className="row between demo-bar">
        <div className="seg demo-switch">
          <button className={mode === 'video' ? 'on' : ''} onClick={() => setSettings({ demo: 'video' })}>▶ Vidéo</button>
          <button className={mode === 'anim' ? 'on' : ''} onClick={() => setSettings({ demo: 'anim' })}>Animation</button>
        </div>
        <span className="tiny muted grow" style={{ textAlign: 'right' }}>
          {!online ? 'Hors ligne : animation' : showVideo ? `${video.channel} · YouTube` : 'Repères chiffrés et tempo'}
        </span>
      </div>
    </div>
  )
}

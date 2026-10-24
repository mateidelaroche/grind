import { lazy, Suspense } from 'react'
import Figure from './Figure'
import { useStore } from '../store'
import type { Band } from '../types'
import type { Work } from '../data/muscles'

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

/** Grande démo d'un exercice : 3D si activée et disponible, sinon silhouette 2D. */
export default function Demo({ anim, band, work }: { anim: string; band?: Band; work?: Work }) {
  const use3d = useStore((s) => s.settings.anim3d) && webgl
  if (!use3d) return <Figure anim={anim} band={band} className="figure" />
  return (
    <Suspense fallback={<Figure anim={anim} band={band} className="figure" />}>
      <Figure3D anim={anim} band={band} work={work} />
    </Suspense>
  )
}

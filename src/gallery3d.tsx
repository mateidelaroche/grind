// Page de dev : rendu 3D d'animations, pour capture d'écran.
// ?a=id1,id2 · &k=0,1 : figé sur ces poses clés (sinon animé) · &cols=3 · &az=0&el=8 : caméra
import { createRoot } from 'react-dom/client'
import Figure3D from './anim/Figure3D'
import { ANIMS } from './anim/anims'
import './styles.css'

const q = new URLSearchParams(location.search)
const ids = (q.get('a') ?? 'fly-band').split(',')
const k = q.get('k')
const cols = +(q.get('cols') ?? 3)
const cam = q.get('az') ? { az: +q.get('az')!, el: +(q.get('el') ?? 10) } : undefined

/** Début de la pose clé i dans le cycle (milieu de son maintien). */
function keyTime(id: string, i: number) {
  const a = ANIMS[id]
  let t = 0
  for (let m = 0; m < i % a.keys.length; m++) t += (a.hold?.[m] ?? 0.25) + (a.dur[m] ?? 1)
  return t + (a.hold?.[i % a.keys.length] ?? 0.25) / 2
}

createRoot(document.getElementById('root')!).render(
  <div style={{ display: 'grid', gridTemplateColumns: `repeat(${cols}, 1fr)`, gap: 6, padding: 6 }}>
    {(k === null ? [null] : k.split(',').map(Number)).flatMap((ki) => ids.map((id) => (
      <div key={`${id}-${ki}`}>
        <Figure3D anim={id} band="F" at={ki === null ? undefined : keyTime(id, ki)} cam={cam} />
        {id}{ki !== null ? ` · ${ki}` : ''}
      </div>
    )))}
  </div>,
)

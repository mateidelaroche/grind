// Page de dev : rendu 3D d'animations, pour capture d'écran.
// ?a=id1,id2 · &k=0,1 (poses clés) ou &k=t0,t0.5 (instants en s) : figé, sinon animé · &cols=3 · &az=0&el=8 : caméra
import { createRoot } from 'react-dom/client'
import Figure3D from './anim/Figure3D'
import { ANIMS, gearAnim } from './anim/anims'
import './styles.css'

const q = new URLSearchParams(location.search)
// « pushup~band », « lunge~sac » : variante avec le matériel d'un niveau
const ids = (q.get('a') ?? 'fly-band').split(',').map((id) => {
  const [base, gear] = id.split('~')
  return gear ? gearAnim(base, base, { band: gear.includes('band') ? 'M' : undefined, sac: gear.includes('sac') ? 'moyen' : undefined }) : base
})
const k = q.get('k')
const cols = +(q.get('cols') ?? 3)
const cam = q.get('az') ? { az: +q.get('az')!, el: +(q.get('el') ?? 10) } : undefined

/** Milieu du maintien de la pose clé i dans le cycle. */
function keyTime(id: string, i: number) {
  const a = ANIMS[id]
  let t = 0
  for (let m = 0; m < i % a.keys.length; m++) t += (a.hold?.[m] ?? 0.25) + (a.dur[m] ?? 1)
  return t + (a.hold?.[i % a.keys.length] ?? 0.25) / 2
}

createRoot(document.getElementById('root')!).render(
  <div style={{ display: 'grid', gridTemplateColumns: `repeat(${cols}, 1fr)`, gap: 6, padding: 6 }}>
    {(k === null ? [null] : k.split(',')).flatMap((ki) => ids.map((id) => {
      const at = ki === null ? undefined : ki.startsWith('t') ? +ki.slice(1) : keyTime(id, +ki)
      return (
        <div key={`${id}-${ki}`}>
          <Figure3D anim={id} band="F" at={at} cam={cam} />
          {id}{ki !== null ? ` · ${ki}` : ''}
        </div>
      )
    }))}
  </div>,
)

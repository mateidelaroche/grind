// Page de dev : toutes les poses clés de toutes les animations, pour vérification visuelle.
import { createRoot } from 'react-dom/client'
import Figure from './anim/Figure'
import { ANIMS } from './anim/anims'

const q = new URLSearchParams(location.search)
const only = q.get('only')?.split(',')
if (q.get('cols')) document.documentElement.style.setProperty('--cols', q.get('cols'))

function Gallery() {
  const ids = Object.keys(ANIMS).filter((id) => !only || only.includes(id))
  return (
    <div className="grid">
      {ids.flatMap((id) =>
        ANIMS[id].keys.map((_, k) => (
          <div className="cell" key={id + k}>
            <Figure anim={id} keyIndex={k} playing={false} band="F" marks />
            {id} · {k}
          </div>
        )),
      )}
    </div>
  )
}

createRoot(document.getElementById('root')!).render(<Gallery />)

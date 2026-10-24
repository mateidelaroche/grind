// Page de dev : rendu 3D d'une animation (?a=id&t=secondes&az=..&el=..), pour capture d'écran.
import { createRoot } from 'react-dom/client'
import Figure3D from './anim/Figure3D'
import './styles.css'

const q = new URLSearchParams(location.search)
const ids = (q.get('a') ?? 'fly-band').split(',')

createRoot(document.getElementById('root')!).render(
  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6, padding: 6 }}>
    {ids.map((id) => (
      <div key={id}>
        <Figure3D anim={id} band="F" />
        {id}
      </div>
    ))}
  </div>,
)

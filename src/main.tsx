import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { registerSW } from 'virtual:pwa-register'
import App from './App'
import { unlockAudio } from './lib/audio'
import { startAutoSync } from './lib/sync'
import { useStore } from './store'
import './styles.css'

// Une mise à jour ne recharge jamais la page pendant une séance ou une sortie, ni sur l'écran de bilan :
// elle attend qu'il n'y ait plus rien en cours et que l'appli passe en arrière-plan ou y revienne.
let updateReady = false
const applyUpdate = () => {
  const s = useStore.getState()
  if (updateReady && s.hydrated && !s.active && !s.activeRun) window.location.reload()
}
registerSW({ immediate: true, onNeedReload: () => { updateReady = true; applyUpdate() } })
document.addEventListener('visibilitychange', applyUpdate)

// Dev uniquement : accès au store depuis la console / les tests.
if (import.meta.env.DEV) {
  (window as unknown as { __store: typeof useStore }).__store = useStore
  void import('./lib/gps').then((m) => { (window as unknown as { __tracker: unknown }).__tracker = m.tracker })
}

// iOS n'autorise le son qu'après un geste, et peut le couper ensuite : chaque tap le réactive.
// Sur écran tactile, le geste n'est reconnu qu'au relâchement du doigt.
window.addEventListener('pointerup', unlockAudio)
window.addEventListener('touchend', unlockAudio)

const unsub = useStore.subscribe((s) => {
  if (s.hydrated) { unsub(); startAutoSync(); applyUpdate() }
})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

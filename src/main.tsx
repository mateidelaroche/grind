import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { registerSW } from 'virtual:pwa-register'
import App from './App'
import { unlockAudio } from './lib/audio'
import { startAutoSync } from './lib/sync'
import { useStore } from './store'
import './styles.css'

registerSW({ immediate: true })

// Dev uniquement : accès au store depuis la console / les tests.
if (import.meta.env.DEV) {
  (window as unknown as { __store: typeof useStore }).__store = useStore
  void import('./lib/gps').then((m) => { (window as unknown as { __tracker: unknown }).__tracker = m.tracker })
}

// iOS n'autorise le son qu'après un premier geste : on l'active au premier tap.
window.addEventListener('pointerdown', unlockAudio, { once: true })

const unsub = useStore.subscribe((s) => {
  if (s.hydrated) { unsub(); startAutoSync() }
})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

import { EXERCISES } from '../data/exercises'

export function HowTo({ exId }: { exId: string }) {
  const ex = EXERCISES[exId]
  return (
    <div className="howto stack" style={{ gap: 8 }}>
      {ex.info && <p>📌 {ex.info}</p>}
      {ex.setup && <p><b>⚙️ Mise en place.</b> {ex.setup}</p>}
      <p><b>▶️ Exécution.</b> {ex.execution}</p>
      {ex.errors && <p><b>⚠️ Erreurs.</b> {ex.errors}</p>}
      {ex.knee && <p><b>🩹 Genoux.</b> {ex.knee}</p>}
    </div>
  )
}

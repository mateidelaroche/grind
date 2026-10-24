import { IconBack } from '../components/icons'
import { addDays, diffDays, mondayOf, today } from '../lib/program'
import { useStore } from '../store'
import type { FoodLog } from '../types'

const HABITS: { key: keyof FoodLog; icon: string; title: string; desc: string }[] = [
  { key: 'lait', icon: '🥛', title: 'Verre de lait après la séance', desc: 'Ou un fromage blanc / yaourt. 30 secondes, pas cher.' },
  { key: 'gouter', icon: '🍌', title: 'Goûter enrichi', desc: 'Les jours de basket : banane + pain + beurre de cacahuète ou jambon.' },
  { key: 'sandwich', icon: '🥪', title: 'Sandwich avec protéine', desc: 'Poulet, thon, œuf ou jambon. Ou prends-en deux.' },
]

const PROTEINS = ['Œufs', 'Lait', 'Fromage blanc', 'Thon en boîte', 'Sardines', 'Lentilles', 'Pois chiches', 'Blanc de poulet en gros paquet']

/** Tendance du poids sur ~4 semaines : renvoie le gain (kg) et la période, ou rien si pas assez de pesées. */
export function weightTrend(weights: Record<string, number>) {
  const w = Object.entries(weights).sort(([a], [b]) => a.localeCompare(b))
  const last = w.at(-1)
  if (!last) return
  const old = w.filter(([d]) => diffDays(last[0], d) >= 28).at(-1)
  if (!old) return
  return { gain: +(last[1] - old[1]).toFixed(1), days: diffDays(last[0], old[0]) }
}

export default function Food({ onBack }: { onBack: () => void }) {
  const s = useStore()
  const d = today()
  const log = s.food[d] ?? {}
  const trend = weightTrend(s.weights)
  const monday = mondayOf(d)
  const week = Array.from({ length: 7 }, (_, i) => s.food[addDays(monday, i)] ?? {})
  const countWeek = (k: keyof FoodLog) => week.filter((f) => f[k]).length

  return (
    <div className="page">
      <div className="topbar">
        <button className="icon-btn" onClick={onBack} aria-label="Retour"><IconBack /></button>
        <div className="grow ex-name">Alimentation</div>
      </div>
      <div className="small muted">Aucune obligation. Pour prendre du volume à 1m88 et 70 kg, c’est pourtant le levier n°1. Voici le strict minimum, zéro effort.</div>

      {trend && (
        <div className={`card ${trend.gain < 0.3 ? '' : 'accent'}`} style={trend.gain < 0.3 ? { borderColor: '#a16207' } : undefined}>
          <div style={{ fontWeight: 700 }}>{trend.gain < 0.3 ? '⚠️ Ton poids ne bouge pas' : '📈 Ça monte'}</div>
          <div className="small muted">
            {trend.gain >= 0 ? '+' : ''}{`${trend.gain}`.replace('.', ',')} kg en {trend.days} jours.{' '}
            {trend.gain < 0.3
              ? 'L’entraînement fait son travail ; s’il n’y a pas plus de matériaux, le muscle ne peut pas se construire. Ajoute un des 3 réflexes ci-dessous.'
              : 'Bon rythme : vise environ +1 à 2 kg par mois.'}
          </div>
        </div>
      )}

      <div className="section-title">Aujourd’hui (facultatif)</div>
      <div className="card" style={{ padding: '4px 16px', gap: 0 }}>
        {HABITS.map((h) => (
          <div key={h.key} className="list-row">
            <span style={{ fontSize: 24 }}>{h.icon}</span>
            <div className="grow">
              <div style={{ fontWeight: 600 }}>{h.title}</div>
              <div className="small muted">{h.desc}</div>
              <div className="tiny muted">{countWeek(h.key)}/7 cette semaine</div>
            </div>
            <button className={`btn sm ${log[h.key] ? 'primary' : ''}`} onClick={() => s.setFood(d, { [h.key]: !log[h.key] })}>{log[h.key] ? '✓' : 'Fait'}</button>
          </div>
        ))}
      </div>

      <div className="section-title">Protéines pas chères</div>
      <div className="row wrap" style={{ gap: 6 }}>{PROTEINS.map((p) => <span key={p} className="chip">{p}</span>)}</div>
      <div className="small muted">La whey n’est pas nécessaire : c’est juste pratique. Hydratation 2-3 L : parfait, continue.</div>
    </div>
  )
}

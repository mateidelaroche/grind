import { useEffect, useState } from 'react'
import { celebrate } from '../components/Confetti'
import { LineChart, SERIES } from '../components/Charts'
import { Sheet, toast } from '../components/ui'
import { addPhoto, deletePhoto, getPhoto, listPhotos } from '../lib/photos'
import { diffDays, formatDate, fromISO, mondayOf, today, weekNumber } from '../lib/program'
import { holdBests, levelLabel, longestStreak, MILESTONES, recordsOfTest, TEST_IDS, testBests, TESTS } from '../lib/records'
import { EXERCISES } from '../data/exercises'
import { SESSIONS } from '../data/sessions'
import { useStore } from '../store'
import Camera from './Camera'
import type { MeasureKey, Measures, PhotoMeta, PhotoPose, TestId, TestKey } from '../types'
import { RunRecords } from './RunViews'

export const MEASURES: { key: MeasureKey; label: string }[] = [
  { key: 'brasD', label: 'Bras droit contracté' },
  { key: 'brasG', label: 'Bras gauche contracté' },
  { key: 'poitrine', label: 'Poitrine (tétons)' },
  { key: 'taille', label: 'Taille (nombril)' },
  { key: 'cuisseD', label: 'Cuisse droite (milieu)' },
  { key: 'cuisseG', label: 'Cuisse gauche (milieu)' },
]
const POSES: PhotoPose[] = ['face', 'profil', 'dos']
const POSE_LABEL: Record<PhotoPose, string> = { face: 'Face', profil: 'Profil', dos: 'Dos' }

const num = (s: string) => { const v = parseFloat(s.replace(',', '.')); return Number.isFinite(v) && v > 0 ? v : undefined }
const fmt = (v: number) => `${v}`.replace('.', ',')
const shortDate = (d: string) => fromISO(d).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })

// ───────────── Échéances (pour l'écran Aujourd'hui) ─────────────
export function weighDue(weights: Record<string, number>, d = today()) {
  const monday = mondayOf(d)
  return !Object.keys(weights).some((k) => k >= monday && k <= d)
}
export function monthlyDue(dates: string[], d = today()) {
  const last = dates.sort().at(-1)
  return !last || diffDays(d, last) >= 28
}
export function testDue(week: number, tests: Partial<Record<TestId, unknown>>): TestId | undefined {
  if (!tests.S0 && week <= 1) return 'S0'
  if (!tests.S6 && week >= 6 && week <= 7) return 'S6'
  if (!tests.S12 && week >= 12) return 'S12'
}

// ───────────── Saisies ─────────────
export function WeighIn({ compact }: { compact?: boolean }) {
  const s = useStore()
  const d = today()
  const [val, setVal] = useState(s.weights[d] ? fmt(s.weights[d]) : '')
  const save = () => {
    const kg = num(val)
    if (!kg) return toast('Entre un poids valide')
    const prevMax = Math.max(0, ...Object.entries(s.weights).filter(([k]) => k !== d).map(([, v]) => v))
    s.setWeight(d, kg)
    if (prevMax && kg > prevMax) { celebrate(); toast(`🏆 Nouveau poids max : ${fmt(kg)} kg`) } else toast('Pesée enregistrée ⚖️')
  }
  return (
    <div className="row">
      <input className="input grow" inputMode="decimal" placeholder={compact ? 'Poids (kg)' : 'Ex. 70,4'} value={val} onChange={(e) => setVal(e.target.value)} />
      <button className="btn primary" onClick={save}>OK</button>
    </div>
  )
}

export function MeasuresSheet({ onClose }: { onClose: () => void }) {
  const s = useStore()
  const d = today()
  const last = Object.keys(s.measures).sort().at(-1)
  const [vals, setVals] = useState<Record<string, string>>(
    Object.fromEntries(MEASURES.map((m) => [m.key, s.measures[d]?.[m.key] ? fmt(s.measures[d][m.key]!) : ''])),
  )
  return (
    <Sheet onClose={onClose}>
      <div className="ex-name">Mensurations du mois</div>
      <div className="small muted">En cm, avec un mètre ruban de couture (~2 €). Toujours au même endroit, le matin. Laisse vide ce que tu ne mesures pas.</div>
      {MEASURES.map((m) => (
        <div key={m.key} className="list-row" style={{ padding: '8px 0' }}>
          <div className="grow">
            <div>{m.label}</div>
            {last && s.measures[last][m.key] && <div className="tiny muted">Dernière : {fmt(s.measures[last][m.key]!)} cm ({shortDate(last)})</div>}
          </div>
          <input className="input" style={{ width: 90 }} inputMode="decimal" value={vals[m.key]} onChange={(e) => setVals({ ...vals, [m.key]: e.target.value })} />
        </div>
      ))}
      <button className="btn primary block" onClick={() => {
        const m: Measures = {}
        for (const x of MEASURES) { const v = num(vals[x.key]); if (v) m[x.key] = v }
        s.setMeasures(d, m)
        toast('Mensurations enregistrées 📏')
        onClose()
      }}>Enregistrer</button>
    </Sheet>
  )
}

export function TestsSheet({ initial, onClose }: { initial?: TestId; onClose: () => void }) {
  const s = useStore()
  const week = weekNumber(today(), s.startDate)
  const [id, setId] = useState<TestId>(initial ?? testDue(week, s.tests) ?? 'S0')
  const cur = s.tests[id]
  const [vals, setVals] = useState<Record<string, string>>({})
  useEffect(() => {
    setVals(Object.fromEntries(TESTS.map((t) => [t.key, cur?.values[t.key] !== undefined ? `${cur.values[t.key]}` : ''])))
  }, [id]) // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <Sheet onClose={onClose}>
      <div className="ex-name">Tests de forme</div>
      <div className="seg">{TEST_IDS.map((t) => <button key={t} className={t === id ? 'on' : ''} onClick={() => setId(t)}>{t}</button>)}</div>
      <div className="small muted">Échauffe-toi d’abord (routine genoux + 5 min). Une seule tentative par test, repos 2-3 min entre chaque. Technique stricte.</div>
      {TESTS.map((t) => (
        <div key={t.key} className="list-row" style={{ padding: '8px 0' }}>
          <div className="grow">{t.label}</div>
          <input className="input" style={{ width: 80 }} inputMode="numeric" placeholder={t.unit} value={vals[t.key] ?? ''} onChange={(e) => setVals({ ...vals, [t.key]: e.target.value })} />
        </div>
      ))}
      <button className="btn primary block" onClick={() => {
        const values: Partial<Record<TestKey, number>> = {}
        for (const t of TESTS) { const v = num(vals[t.key] ?? ''); if (v !== undefined) values[t.key] = Math.round(v) }
        const r = { date: cur?.date ?? today(), values }
        const recs = recordsOfTest(id, r, s.tests)
        s.setTest(id, Object.keys(values).length ? r : undefined)
        if (recs.length) { celebrate(); toast(`🏆 ${recs.length} record${recs.length > 1 ? 's' : ''} battu${recs.length > 1 ? 's' : ''} !`) } else toast(`Tests ${id} enregistrés`)
        onClose()
      }}>Enregistrer</button>
    </Sheet>
  )
}

// ───────────── Photos ─────────────
function Thumb({ id, onClick }: { id: string; onClick?: () => void }) {
  const [src, setSrc] = useState<string>()
  useEffect(() => { void getPhoto(id).then(setSrc) }, [id])
  return <img src={src} alt="" onClick={onClick} />
}

function Photos() {
  const [photos, setPhotos] = useState<PhotoMeta[]>([])
  const [shooting, setShooting] = useState<PhotoPose>()
  const [picking, setPicking] = useState(false)
  const [open, setOpen] = useState<PhotoMeta>()
  const [pose, setPose] = useState<PhotoPose>('face')
  const reload = () => void listPhotos().then(setPhotos)
  useEffect(reload, [])

  const ofPose = photos.filter((p) => p.pose === pose)
  const [a, setA] = useState<string>()
  const [b, setB] = useState<string>()
  const first = ofPose.find((p) => p.id === a) ?? ofPose[0]
  const last = ofPose.find((p) => p.id === b) ?? ofPose.at(-1)

  return (
    <div className="stack">
      <div className="row between">
        <div className="section-title" style={{ margin: 0 }}>Photos</div>
        <button className="btn sm" onClick={() => setPicking(true)}>📸 Ajouter</button>
      </div>
      <div className="small muted">Une fois par mois : face, profil, dos. Même lumière, même heure. Elles restent sur ton téléphone (pense à la sauvegarde JSON).</div>
      <div className="seg">{POSES.map((p) => <button key={p} className={p === pose ? 'on' : ''} onClick={() => { setPose(p); setA(undefined); setB(undefined) }}>{POSE_LABEL[p]}</button>)}</div>
      {ofPose.length >= 2 && first && last && (
        <div className="card" style={{ gap: 8 }}>
          <div style={{ fontWeight: 700 }}>Avant / après</div>
          <div className="compare">
            <div className="stack" style={{ gap: 4 }}><Thumb id={first.id} /><select className="input" value={first.id} onChange={(e) => setA(e.target.value)}>{ofPose.map((p) => <option key={p.id} value={p.id}>{shortDate(p.date)}</option>)}</select></div>
            <div className="stack" style={{ gap: 4 }}><Thumb id={last.id} /><select className="input" value={last.id} onChange={(e) => setB(e.target.value)}>{ofPose.map((p) => <option key={p.id} value={p.id}>{shortDate(p.date)}</option>)}</select></div>
          </div>
          <div className="tiny muted center">{diffDays(last.date, first.date)} jours d’écart</div>
        </div>
      )}
      {ofPose.length > 0 ? (
        <div className="photo-grid">{ofPose.slice().reverse().map((p) => <div key={p.id}><Thumb id={p.id} onClick={() => setOpen(p)} /><div className="tiny muted center">{shortDate(p.date)}</div></div>)}</div>
      ) : <div className="small muted">Aucune photo {POSE_LABEL[pose].toLowerCase()} pour l’instant.</div>}

      {picking && (
        <Sheet onClose={() => setPicking(false)}>
          <div className="ex-name">Quelle pose ?</div>
          <div className="small muted">Pose ton téléphone, lance le retardateur (10 s) et place-toi dans la silhouette.</div>
          {POSES.map((p) => <button key={p} className="btn block" onClick={() => { setPicking(false); setShooting(p) }}>{POSE_LABEL[p]}</button>)}
        </Sheet>
      )}
      {shooting && (
        <Camera pose={shooting} onClose={() => setShooting(undefined)} onShot={async (data) => {
          await addPhoto(data, shooting, today())
          const next = POSES[POSES.indexOf(shooting) + 1]
          toast(`Photo ${POSE_LABEL[shooting].toLowerCase()} enregistrée${next ? ` · maintenant : ${POSE_LABEL[next].toLowerCase()}` : ' ✓'}`)
          setShooting(next)
          reload()
        }} />
      )}
      {open && (
        <Sheet onClose={() => setOpen(undefined)}>
          <div className="row between"><b>{POSE_LABEL[open.pose]} · {formatDate(open.date)}</b></div>
          <Thumb id={open.id} />
          <button className="btn danger block" onClick={async () => { if (confirm('Supprimer cette photo ?')) { await deletePhoto(open.id); setOpen(undefined); reload() } }}>Supprimer</button>
        </Sheet>
      )}
    </div>
  )
}

// ───────────── Onglet Corps ─────────────
export function BodyTab() {
  const s = useStore()
  const [measuring, setMeasuring] = useState(false)
  const [goal, setGoal] = useState(false)
  const w = Object.entries(s.weights).sort(([a], [b]) => a.localeCompare(b))
  const lastW = w.at(-1)
  const firstW = w[0]
  const mDates = Object.keys(s.measures).sort()
  const lastM = mDates.at(-1)
  const series = (k: MeasureKey) => mDates.filter((d) => s.measures[d][k]).map((d) => ({ x: d, y: s.measures[d][k]! }))

  return (
    <div className="stack" style={{ gap: 14 }}>
      <div className="card">
        <div className="row between">
          <div>
            <div style={{ fontWeight: 700 }}>⚖️ Poids</div>
            <div className="small muted">Le lundi matin, au réveil, après les toilettes</div>
          </div>
          {lastW && <div className="big-num">{fmt(lastW[1])}<span className="small muted"> kg</span></div>}
        </div>
        {lastW && firstW && lastW[0] !== firstW[0] && (
          <div className="small muted">
            {lastW[1] - firstW[1] >= 0 ? '+' : ''}{fmt(+(lastW[1] - firstW[1]).toFixed(1))} kg depuis le {shortDate(firstW[0])} · objectif <button className="btn sm ghost" style={{ height: 'auto', padding: 0, color: 'var(--accent-hi)' }} onClick={() => setGoal(true)}>{s.goalWeight} kg</button>
          </div>
        )}
        <LineChart series={[{ name: 'Poids', color: SERIES[0], data: w.map(([x, y]) => ({ x, y })) }]} unit="kg" goal={{ y: s.goalWeight, label: `${s.goalWeight}` }} />
        <WeighIn />
      </div>

      <div className="card">
        <div className="row between">
          <div style={{ fontWeight: 700 }}>📏 Mensurations</div>
          <button className="btn sm" onClick={() => setMeasuring(true)}>Mesurer</button>
        </div>
        {!lastM && <div className="small muted">Une fois par mois. Il te faut un mètre ruban de couture (~2 €), ou une ficelle et une règle.</div>}
        {lastM && <div className="small muted">Dernière prise : {formatDate(lastM)}</div>}
        {lastM && (
          <div className="stack" style={{ gap: 16 }}>
            {[
              { t: 'Bras contracté', s: [{ name: 'Droit', k: 'brasD' as const }, { name: 'Gauche', k: 'brasG' as const }] },
              { t: 'Poitrine', s: [{ name: 'Poitrine', k: 'poitrine' as const }] },
              { t: 'Taille', s: [{ name: 'Taille', k: 'taille' as const }] },
              { t: 'Cuisse', s: [{ name: 'Droite', k: 'cuisseD' as const }, { name: 'Gauche', k: 'cuisseG' as const }] },
            ].filter((g) => g.s.some((x) => series(x.k).length)).map((g) => (
              <div key={g.t} className="stack" style={{ gap: 4 }}>
                <div className="small" style={{ fontWeight: 650 }}>{g.t}</div>
                <LineChart height={130} unit="cm" series={g.s.map((x, i) => ({ name: x.name, color: SERIES[i], data: series(x.k) }))} />
              </div>
            ))}
            <div className="tiny muted">🎯 Bras et poitrine qui montent, taille stable : c’est parfait.</div>
          </div>
        )}
      </div>

      <Photos />

      {measuring && <MeasuresSheet onClose={() => setMeasuring(false)} />}
      {goal && (
        <Sheet onClose={() => setGoal(false)}>
          <div className="ex-name">Objectif de poids</div>
          <input className="input" inputMode="decimal" defaultValue={fmt(s.goalWeight)} onBlur={(e) => { const v = num(e.target.value); if (v) s.setGoalWeight(v) }} />
          <button className="btn primary block" onClick={() => setGoal(false)}>OK</button>
        </Sheet>
      )}
    </div>
  )
}

// ───────────── Onglet Records ─────────────
export function RecordsTab() {
  const s = useStore()
  const [testing, setTesting] = useState<TestId>()
  const holds = holdBests(s.workouts)
  const bests = testBests(s.tests)
  const total = s.workouts.filter((w) => w.completed && SESSIONS[w.session].kind === 'muscu').length
  const streak = longestStreak(s.workouts)
  const maxW = Object.entries(s.weights).sort(([, a], [, b]) => b - a)[0]
  const nextMilestone = MILESTONES.find((m) => m > total)

  return (
    <div className="stack" style={{ gap: 14 }}>
      <div className="card">
        <div className="row between">
          <div style={{ fontWeight: 700 }}>🧪 Tests S0 · S6 · S12</div>
          <button className="btn sm" onClick={() => setTesting(testDue(weekNumber(today(), s.startDate), s.tests) ?? 'S0')}>Saisir</button>
        </div>
        <div className="small" style={{ display: 'grid', gridTemplateColumns: '1fr 44px 44px 44px', rowGap: 8, alignItems: 'center' }}>
          <span className="muted tiny">Test</span>
          {TEST_IDS.map((id) => <button key={id} className="muted tiny" style={{ textAlign: 'right' }} onClick={() => setTesting(id)}>{id}</button>)}
          {TESTS.map((t) => (
            <FragmentRow key={t.key} label={`${t.label}${t.unit === 's' ? ' (s)' : ''}`} vals={TEST_IDS.map((id) => s.tests[id]?.values[t.key])} best={bests[t.key]?.v} />
          ))}
        </div>
      </div>

      <div className="section-title">Régularité</div>
      <div className="stats">
        <div className="stat"><span className="big-num">{total}</span><span className="tiny muted">séances{nextMilestone ? ` · prochain cap ${nextMilestone}` : ''}</span></div>
        <div className="stat"><span className="big-num">🔥 {streak}</span><span className="tiny muted">record de semaines d’affilée</span></div>
        <div className="stat"><span className="big-num">{maxW ? fmt(maxW[1]) : '–'}</span><span className="tiny muted">poids max (kg)</span></div>
      </div>

      <RunRecords />

      <div className="section-title">Temps tenus</div>
      <div className="card" style={{ padding: '4px 16px', gap: 0 }}>
        {Object.keys(holds).length === 0 && <div className="list-row small muted">Planche, gainage, chaise : ton meilleur temps apparaîtra ici.</div>}
        {Object.entries(holds).map(([ex, h]) => (
          <div key={ex} className="list-row"><span className="grow">{EXERCISES[ex].name}</span><b>{h.s} s</b><span className="tiny muted" style={{ marginLeft: 8 }}>{shortDate(h.date)}</span></div>
        ))}
      </div>

      <div className="section-title">Niveaux débloqués</div>
      <div className="card" style={{ padding: '4px 16px', gap: 0 }}>
        {s.levelLog.length === 0 && <div className="list-row small muted">Quand tu passes un exercice au niveau supérieur, il s’affiche ici 🆙</div>}
        {s.levelLog.slice().reverse().map((e, i) => (
          <div key={i} className="list-row"><span>🆙</span><span className="grow">{levelLabel(e)}</span><span className="tiny muted">{shortDate(e.date)}</span></div>
        ))}
      </div>

      {testing && <TestsSheet initial={testing} onClose={() => setTesting(undefined)} />}
    </div>
  )
}

function FragmentRow({ label, vals, best }: { label: string; vals: (number | undefined)[]; best?: number }) {
  return (
    <>
      <span>{label}</span>
      {vals.map((v, i) => (
        <span key={i} style={{ textAlign: 'right', fontWeight: v !== undefined && v === best ? 800 : 500, color: v === undefined ? 'var(--text-3)' : 'var(--text)' }}>
          {v ?? '–'}{v !== undefined && v === best && vals.filter((x) => x !== undefined).length > 1 ? '🏆' : ''}
        </span>
      ))}
    </>
  )
}

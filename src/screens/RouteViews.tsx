// Parcours : choix avant de partir, dessin, guidage pendant la sortie, réglages.
import { lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react'
import { toast } from '../components/ui'
import { beep, say } from '../lib/audio'
import { tracker } from '../lib/gps'
import {
  BACK_ON, cumul, generateLoops, kmText, locate, matchingRoutes, OFF_ROUTE, round5, routeFromRun, routeInfo, routeThrough,
  type LatLng, type RunRoute, type SavedRoute,
} from '../lib/routes'
import { useStore } from '../store'
import type { RunLog } from '../types'

const Maps = () => import('./RouteMaps')
const RoutesMap = lazy(() => Maps().then((m) => ({ default: m.RoutesMap })).catch(() => ({ default: () => <></> })))
const LiveMap = lazy(() => Maps().then((m) => ({ default: m.LiveMap })).catch(() => ({ default: () => <></> })))
const COLORS = ['#ea580c', '#a855f7', '#22c55e']
const Fallback = () => <div className="run-map" />

const ready = (s: { key?: string; home?: LatLng }) => !!s.key && !!s.home

// ───────────── Avant de partir ─────────────
export function RoutePicker({ target, value, onChange }: { target: number; value?: RunRoute; onChange: (r?: RunRoute) => void }) {
  const routing = useStore((s) => s.routing)
  const saveRoute = useStore((s) => s.saveRoute)
  const [gen, setGen] = useState<RunRoute[]>([])
  const [busy, setBusy] = useState(false)
  const [attempt, setAttempt] = useState(0)
  const [all, setAll] = useState(false)
  const [draw, setDraw] = useState(false)
  const favs = all ? routing.routes : matchingRoutes(routing.routes, target)

  // Par défaut : ton parcours enregistré le plus proche de la distance.
  const init = useRef(false)
  useEffect(() => {
    if (init.current) return
    init.current = true
    if (!value && favs[0]) onChange(favs[0])
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const list: (RunRoute & { fav?: boolean })[] = [...gen, ...favs.map((f) => ({ ...f, fav: true }))]
  const selected = list.findIndex((r) => r === value || (value?.id && r.id === value.id) || (value && !value.id && r.coords === value.coords))

  const generate = async () => {
    if (!ready(routing)) return
    setBusy(true)
    try {
      const loops = await generateLoops(routing.key!, routing.home!, target, attempt)
      setGen(loops)
      setAttempt((a) => a + 1)
      onChange(loops[0])
    } catch (e) { toast((e as Error).message) }
    setBusy(false)
  }
  const keep = (r: RunRoute) => {
    const id = saveRoute(r, 'gen')
    const saved = useStore.getState().routing.routes.find((x) => x.id === id)!
    setGen((g) => g.filter((x) => x !== r))
    onChange(saved)
    toast('Parcours ajouté à tes favoris ⭐')
  }

  return (
    <div className="card" style={{ gap: 10 }}>
      <div className="row between">
        <b>🗺️ Parcours</b>
        <span className="small muted">visé ≈ {kmText(target)}</span>
      </div>
      {list.length > 0 && (
        <Suspense fallback={<Fallback />}>
          <RoutesMap routes={list.map((r) => r.coords)} selected={selected >= 0 ? selected : undefined} home={routing.home} />
        </Suspense>
      )}
      {list.map((r, i) => (
        <div key={(r as SavedRoute).id ?? `g${i}`} className={`list-row small route-row ${i === selected ? 'on' : ''}`} onClick={() => onChange(r)}>
          <span className="run-dot" style={{ background: COLORS[i % 3] }} />
          <span className="grow"><b>{r.name}</b> · {routeInfo(r)}</span>
          {r.fav ? <span>⭐</span> : <button className="btn sm" onClick={(e) => { e.stopPropagation(); keep(r) }}>⭐ Garder</button>}
        </div>
      ))}
      {list.length > 0 && (
        <div className={`list-row small route-row ${!value ? 'on' : ''}`} onClick={() => onChange(undefined)}>
          <span className="run-dot" style={{ background: 'var(--text-3)' }} />
          <span className="grow">Sans parcours</span>
        </div>
      )}
      {ready(routing) ? (
        <div className="row">
          <button className="btn grow sm" disabled={busy} onClick={generate}>{busy ? 'Calcul…' : gen.length ? '🔄 D’autres boucles' : `🔄 Boucles de ${kmText(target)}`}</button>
          <button className="btn grow sm" onClick={() => setDraw(true)}>✏️ Dessiner</button>
        </div>
      ) : (
        <div className="small muted">Pour générer des boucles depuis chez toi : Réglages → Parcours de course (clé gratuite + point de départ).</div>
      )}
      {routing.routes.length > favs.length && !all && <button className="btn ghost sm" onClick={() => setAll(true)}>Voir tous mes parcours ({routing.routes.length})</button>}
      {value && <div className="tiny muted">Le chrono mène la sortie : si tu finis la boucle avant, continue autour du départ ; s’il reste du parcours à la fin, rentre en marchant.</div>}
      {draw && <DrawRoute target={target} onClose={() => setDraw(false)} onDone={(r) => { setDraw(false); onChange(r) }} />}
    </div>
  )
}

// ───────────── Dessiner un parcours ─────────────
function DrawRoute({ target, onClose, onDone }: { target: number; onClose: () => void; onDone: (r: SavedRoute) => void }) {
  const routing = useStore((s) => s.routing)
  const saveRoute = useStore((s) => s.saveRoute)
  const [pts, setPts] = useState<LatLng[]>([])
  const [route, setRoute] = useState<RunRoute>()
  const [busy, setBusy] = useState(false)
  const [name, setName] = useState('')
  const seq = useRef(0)

  useEffect(() => {
    if (!pts.length) { setRoute(undefined); return }
    const n = ++seq.current
    setBusy(true)
    const t = window.setTimeout(() => {
      routeThrough(routing.key!, routing.home!, pts)
        .then((r) => { if (n === seq.current) setRoute(r) })
        .catch((e) => { if (n === seq.current) toast((e as Error).message) })
        .finally(() => { if (n === seq.current) setBusy(false) })
    }, 400)
    return () => clearTimeout(t)
  }, [pts, routing.key, routing.home])

  const save = () => {
    if (!route) return
    const id = saveRoute({ ...route, name: name.trim() }, 'draw')
    onDone(useStore.getState().routing.routes.find((x) => x.id === id)!)
  }

  return (
    <div className="route-draw">
      <div className="row between">
        <b>✏️ Dessine ton parcours</b>
        <button className="btn sm" onClick={onClose}>Fermer</button>
      </div>
      <div className="small muted">Touche la carte pour placer des points de passage, dans l’ordre. Le tracé suit les chemins et revient au départ.</div>
      <Suspense fallback={<Fallback />}>
        <RoutesMap className="run-map tall" routes={route ? [route.coords] : []} selected={route ? 0 : undefined} home={routing.home} points={pts} onTap={(p) => setPts((x) => [...x, round5(p)])} />
      </Suspense>
      <div className="row between small">
        <span>{busy ? 'Calcul…' : route ? `${routeInfo(route)} · visé ${kmText(target)}` : 'Aucun point'}</span>
        <span className="row" style={{ gap: 6 }}>
          <button className="btn sm" disabled={!pts.length} onClick={() => setPts((x) => x.slice(0, -1))}>↩︎ Annuler</button>
          <button className="btn sm" disabled={!pts.length} onClick={() => setPts([])}>Effacer</button>
        </span>
      </div>
      <input className="input" placeholder="Nom (ex. Tour du parc)" value={name} onChange={(e) => setName(e.target.value)} />
      <button className="btn primary block" disabled={!route || busy} onClick={save}>⭐ Enregistrer et utiliser</button>
    </div>
  )
}

// ───────────── Pendant la sortie ─────────────
export function RouteFollow({ route, paused }: { route: RunRoute; paused: boolean }) {
  const cum = useMemo(() => cumul(route.coords), [route])
  const [, setN] = useState(0)
  const st = useRef({ seg: 0, along: 0, d: 0, far: 0, off: false, ended: false })
  const pausedRef = useRef(paused)
  pausedRef.current = paused

  useEffect(() => tracker.subscribe(() => {
    const last = tracker.points[tracker.points.length - 1]
    if (!last) return
    const s = st.current
    const at = locate(route.coords, cum, [last[0], last[1]], s.seg)
    s.seg = at.seg; s.d = at.d
    if (at.d < OFF_ROUTE) s.along = Math.max(s.along, at.along)
    if (!pausedRef.current) {
      s.far = at.d >= OFF_ROUTE ? s.far + 1 : 0
      if (!s.off && s.far >= 2) { s.off = true; beep.half(); say('Tu t’écartes du parcours') }
      else if (s.off && at.d <= BACK_ON) { s.off = false; say('De retour sur le parcours') }
      if (!s.ended && s.along >= route.dist - 60 && route.dist > 500) { s.ended = true; say('Boucle terminée. Continue autour du départ jusqu’à la fin du chrono') }
    }
    setN((n) => n + 1)
  }), [route, cum])

  const pts = tracker.points
  const pos = pts.length ? ([pts[pts.length - 1][0], pts[pts.length - 1][1]] as LatLng) : undefined
  const done = pts.map((p) => [p[0], p[1]] as LatLng)
  const s = st.current
  return (
    <div className="route-live">
      <Suspense fallback={<Fallback />}>
        <LiveMap route={route.coords} done={done} pos={pos} />
      </Suspense>
      <div className="row between small" style={{ padding: '0 4px' }}>
        <span>{route.name} · {kmText(s.along)} / {kmText(route.dist)}</span>
        {s.off ? <b style={{ color: 'var(--warn)' }}>⚠️ Hors parcours · {Math.round(s.d)} m</b> : pos ? <span className="muted">sur le parcours</span> : <span className="muted">en attente du GPS</span>}
      </div>
    </div>
  )
}

// ───────────── Après la sortie ─────────────
export function SaveRunRoute({ run }: { run: RunLog }) {
  const saveRoute = useStore((s) => s.saveRoute)
  const [done, setDone] = useState(false)
  const r = useMemo(() => routeFromRun(run), [run])
  if (!r || run.indoor || r.dist < 800) return null
  return done
    ? <div className="small muted center">⭐ Parcours enregistré dans tes favoris</div>
    : <button className="btn block" onClick={() => { saveRoute(r, 'run'); setDone(true) }}>⭐ Garder ce parcours ({kmText(r.dist)}) pour d’autres sorties</button>
}

// ───────────── Réglages ─────────────
const ORS_SIGNUP = 'https://openrouteservice.org/dev/#/signup'

export function RouteSettings() {
  const routing = useStore((s) => s.routing)
  const { setRouting, renameRoute, deleteRoute } = useStore.getState()
  const [key, setKey] = useState('')
  const [placing, setPlacing] = useState(false)
  const [locating, setLocating] = useState(false)

  const here = () => {
    setLocating(true)
    navigator.geolocation.getCurrentPosition(
      (p) => { setRouting({ home: round5([p.coords.latitude, p.coords.longitude]) }); setLocating(false); toast('Point de départ enregistré 📍') },
      () => { setLocating(false); toast('Position indisponible : autorise la localisation, ou place le point sur la carte.') },
      { enableHighAccuracy: true, timeout: 20000 },
    )
  }

  return (
    <div className="card" style={{ gap: 10 }}>
      <div className="small muted">Boucles générées autour de chez toi, plutôt par les parcs et les rues calmes, classées de la plus plate à la plus vallonnée. Ton point de départ et ta clé restent sur ce téléphone ; pour générer une boucle, le départ est envoyé à OpenRouteService.</div>

      <b className="small">1. Clé OpenRouteService (gratuite)</b>
      {routing.key ? (
        <div className="row between small">
          <span>✅ Clé enregistrée</span>
          <button className="btn sm ghost danger" onClick={() => setRouting({ key: undefined })}>Retirer</button>
        </div>
      ) : (
        <>
          <div className="small">Crée un compte, puis dans <b>Dashboard → Tokens</b>, choisis <b>Standard</b> et <b>Create token</b>. Copie la clé et colle-la ici.</div>
          <a className="btn block sm" href={ORS_SIGNUP} target="_blank" rel="noreferrer">Créer le compte OpenRouteService ↗</a>
          <input className="input" placeholder="Colle ta clé ici" value={key} onChange={(e) => setKey(e.target.value)} autoCapitalize="off" autoCorrect="off" spellCheck={false} />
          <button className="btn primary block sm" disabled={key.trim().length < 20} onClick={() => { setRouting({ key: key.trim() }); setKey(''); toast('Clé enregistrée') }}>Enregistrer la clé</button>
        </>
      )}

      <b className="small">2. Point de départ</b>
      <div className="small">{routing.home ? '📍 Enregistré (chez toi)' : 'Pas encore défini'}</div>
      <div className="row">
        <button className="btn grow sm" disabled={locating} onClick={here}>{locating ? 'Localisation…' : '📍 Ma position actuelle'}</button>
        <button className="btn grow sm" onClick={() => setPlacing((x) => !x)}>{placing ? 'Terminé' : '🗺️ Placer sur la carte'}</button>
      </div>
      {(placing || routing.home) && (
        <Suspense fallback={<Fallback />}>
          <RoutesMap routes={[]} home={routing.home} onTap={placing ? (p) => setRouting({ home: round5(p) }) : undefined} />
        </Suspense>
      )}
      {placing && <div className="tiny muted">Touche la carte à l’endroit d’où tu pars.</div>}

      <b className="small">Mes parcours ({routing.routes.length})</b>
      {routing.routes.length === 0 && <div className="small muted">Garde une boucle générée, dessine-en une, ou enregistre une sortie depuis son bilan.</div>}
      {routing.routes.map((r) => (
        <div key={r.id} className="list-row small">
          <span className="grow"><b>{r.name}</b><br /><span className="muted">{routeInfo(r)}</span></span>
          <button className="btn sm" onClick={() => { const n = prompt('Nom du parcours', r.name); if (n?.trim()) renameRoute(r.id, n.trim()) }}>Renommer</button>
          <button className="btn sm ghost danger" onClick={() => { if (confirm(`Supprimer « ${r.name} » ?`)) deleteRoute(r.id) }}>✕</button>
        </div>
      ))}
    </div>
  )
}

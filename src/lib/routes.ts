// Parcours de course : distance visée par sortie, boucles générées (OpenRouteService), favoris, suivi du tracé.
// Le point de départ et la clé restent sur le téléphone (jamais dans la synchro). La génération envoie le départ à OpenRouteService.
import { RUN_PLAN, runSteps } from '../data/running'
import type { RunLog, RunPace, RunStep } from '../types'
import { haversine, unpack } from './gps'

export type LatLng = [number, number]

export interface SavedRoute {
  id: string
  name: string
  /** Tracé [lat, lng], 5 décimales. */
  coords: LatLng[]
  /** Distance (m) et dénivelé positif (m). */
  dist: number
  ascent?: number
  source: 'gen' | 'run' | 'draw'
  createdAt: number
}

/** Parcours suivi pendant une sortie. */
export type RunRoute = Pick<SavedRoute, 'name' | 'coords' | 'dist' | 'ascent'> & { id?: string }

export interface RoutingState {
  /** Clé OpenRouteService (gratuite). */
  key?: string
  /** Point de départ : chez toi. */
  home?: LatLng
  routes: SavedRoute[]
}

// ───────────── Distance visée ─────────────

const DEFAULT_LENT = 405 // s/km : 6′45
/** Temps au km relatif à l'allure lente. */
const PACE_RATIO: Record<Exclude<RunPace, 'recup'>, number> = { lent: 1, moyen: 0.9, rapide: 0.8, accel: 0.72 }
const RECUP = 540 // trot + marche : 9′/km
const WARM = 600 // marche rapide : 10′/km
const COOL = 720 // marche tranquille : 12′/km

/**
 * Ton allure lente (s/km), recalée sur tes vraies sorties : pour chacune des 3 dernières sorties du programme
 * faites dehors avec GPS, on cherche l'allure lente qui redonne la distance réellement parcourue (marche comprise).
 */
export function lentPace(runs: RunLog[]): number {
  const samples = [...runs]
    .filter((r) => !r.indoor && r.plan >= 0 && r.completed && RUN_PLAN[r.plan] && r.dist >= 1000 && r.track?.length)
    .sort((a, b) => b.startedAt - a.startedAt)
    .slice(0, 3)
    .map((r) => solveLent(runSteps(RUN_PLAN[r.plan]), r.dist))
    .filter((p): p is number => p !== undefined)
  if (!samples.length) return DEFAULT_LENT
  return Math.round(samples.reduce((a, p) => a + p, 0) / samples.length)
}

const LENT_MIN = 270, LENT_MAX = 600
/** Allure lente qui fait correspondre la distance prévue à la distance réelle (la distance baisse quand l'allure ralentit). */
export function solveLent(steps: RunStep[], dist: number): number | undefined {
  if (plannedMeters(steps, LENT_MIN) < dist) return LENT_MIN
  if (plannedMeters(steps, LENT_MAX) > dist) return LENT_MAX
  let lo = LENT_MIN, hi = LENT_MAX
  for (let i = 0; i < 30; i++) {
    const mid = (lo + hi) / 2
    if (plannedMeters(steps, mid) > dist) lo = mid
    else hi = mid
  }
  return (lo + hi) / 2
}

export function stepMeters(s: RunStep, lent: number): number {
  if (s.dist) return s.dist
  const dur = s.dur ?? 0
  const secPerKm = s.kind === 'warm' ? WARM : s.kind === 'cool' ? COOL : s.pace === 'recup' || s.kind === 'walk' ? RECUP : lent * PACE_RATIO[(s.pace as Exclude<RunPace, 'recup'>) ?? 'lent']
  return (dur / secPerKm) * 1000
}

/** Distance totale prévue d'une sortie (m), échauffement et retour au calme compris. */
export const plannedMeters = (steps: RunStep[], lent: number) => steps.reduce((a, s) => a + stepMeters(s, lent), 0)
export const planMeters = (plan: number, runs: RunLog[]) => plannedMeters(runSteps(RUN_PLAN[plan]), lentPace(runs))

/** Parcours enregistrés proches de la distance visée (± 12 % ou 400 m), du plus proche au plus loin. */
export function matchingRoutes(routes: SavedRoute[], target: number) {
  const tol = Math.max(400, target * 0.12)
  return routes.filter((r) => Math.abs(r.dist - target) <= tol).sort((a, b) => Math.abs(a.dist - target) - Math.abs(b.dist - target))
}

// ───────────── Géométrie ─────────────

export const round5 = (p: LatLng): LatLng => [Math.round(p[0] * 1e5) / 1e5, Math.round(p[1] * 1e5) / 1e5]
export const lengthOf = (c: LatLng[]) => c.slice(1).reduce((a, p, i) => a + haversine(c[i], p), 0)
export const ascentPerKm = (r: { ascent?: number; dist: number }) => ((r.ascent ?? 0) / Math.max(1, r.dist)) * 1000

/** Distance (m) d'un point à un segment, en projection locale. */
function segDist(p: LatLng, a: LatLng, b: LatLng) {
  const k = Math.cos((p[0] * Math.PI) / 180) * 111320, m = 110540
  const [px, py, ax, ay, bx, by] = [p[1] * k, p[0] * m, a[1] * k, a[0] * m, b[1] * k, b[0] * m]
  const dx = bx - ax, dy = by - ay
  const t = dx || dy ? Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy))) : 0
  return { d: Math.hypot(px - ax - t * dx, py - ay - t * dy), t }
}

/** Cumul des distances le long du tracé. */
export function cumul(c: LatLng[]) {
  const out = [0]
  for (let i = 1; i < c.length; i++) out.push(out[i - 1] + haversine(c[i - 1], c[i]))
  return out
}

/**
 * Où en est-on sur le tracé ? Cherche le segment le plus proche autour de la dernière position connue
 * (une boucle repasse parfois près d'elle-même : on avance dans l'ordre du tracé).
 */
export function locate(c: LatLng[], cum: number[], p: LatLng, lastSeg = 0) {
  let best = { d: Infinity, seg: lastSeg, along: cum[lastSeg] ?? 0 }
  const scan = (from: number, to: number) => {
    for (let i = Math.max(0, from); i < Math.min(c.length - 1, to); i++) {
      const { d, t } = segDist(p, c[i], c[i + 1])
      if (d < best.d) best = { d, seg: i, along: cum[i] + t * (cum[i + 1] - cum[i]) }
    }
  }
  scan(lastSeg - 3, lastSeg + 80)
  // Loin de la fenêtre : on regarde tout le tracé (raccourci, demi-tour, reprise après une pause).
  if (best.d > 60) scan(0, c.length - 1)
  return best
}

/** Écart au tracé : ≥ 45 m pendant 2 positions = hors parcours ; ≤ 25 m = de retour. */
export const OFF_ROUTE = 45
export const BACK_ON = 25

// ───────────── OpenRouteService ─────────────

const ORS = 'https://api.openrouteservice.org/v2/directions/foot-walking/geojson'
/** Parcs et chemins calmes : pondérations « vert » et « calme » au maximum. */
const WEIGHTINGS = { green: { factor: 1 }, quiet: { factor: 1 } }

interface OrsFeature { geometry: { coordinates: number[][] }; properties: { summary?: { distance?: number }; ascent?: number } }

async function ors(key: string, body: Record<string, unknown>): Promise<RunRoute> {
  const call = (b: Record<string, unknown>) => fetch(ORS, {
    method: 'POST',
    headers: { Authorization: key, 'Content-Type': 'application/json', Accept: 'application/geo+json' },
    body: JSON.stringify(b),
  })
  let res = await call({ ...body, elevation: true, options: { ...(body.options as object), profile_params: { weightings: WEIGHTINGS } } })
  // Pondérations refusées pour ce trajet : on réessaie sans.
  if (res.status === 400) res = await call({ ...body, elevation: true })
  if (res.status === 401 || res.status === 403) throw new Error('Clé OpenRouteService refusée : vérifie-la dans Réglages.')
  if (res.status === 429) throw new Error('Trop de demandes d’affilée : réessaie dans une minute.')
  if (!res.ok) throw new Error('Impossible de calculer le parcours (réseau ou service indisponible).')
  const f = ((await res.json()) as { features?: OrsFeature[] }).features?.[0]
  if (!f) throw new Error('Aucun parcours trouvé ici.')
  const coords = f.geometry.coordinates.map((p) => round5([p[1], p[0]]))
  return { name: '', coords, dist: Math.round(f.properties.summary?.distance ?? lengthOf(coords)), ascent: Math.round(f.properties.ascent ?? 0) }
}

/**
 * Boucles d'environ `target` m depuis `home` : plusieurs essais, on garde les plus proches de la distance,
 * classées de la plus plate à la plus vallonnée (genou).
 */
export async function generateLoops(key: string, home: LatLng, target: number, attempt = 0): Promise<RunRoute[]> {
  const seeds = [1, 2, 3, 4, 5].map((s) => s + attempt * 5)
  // La longueur demandée sort souvent un peu plus longue : on vise 5 % en dessous.
  const tries = await Promise.allSettled(seeds.map((seed, i) => ors(key, {
    coordinates: [[home[1], home[0]]],
    options: { round_trip: { length: Math.round(target * 0.95), points: i % 2 ? 4 : 3, seed } },
  })))
  const ok = tries.filter((t): t is PromiseFulfilledResult<RunRoute> => t.status === 'fulfilled').map((t) => t.value)
  if (!ok.length) throw (tries[0] as PromiseRejectedResult).reason
  const near = ok.filter((r) => Math.abs(r.dist - target) <= Math.max(500, target * 0.15))
  const pool = (near.length ? near : ok).sort((a, b) => ascentPerKm(a) - ascentPerKm(b) || Math.abs(a.dist - target) - Math.abs(b.dist - target))
  // Deux boucles presque identiques : on n'en garde qu'une.
  const out: RunRoute[] = []
  for (const r of pool) if (!out.some((o) => Math.abs(o.dist - r.dist) < 80 && Math.abs((o.ascent ?? 0) - (r.ascent ?? 0)) < 4)) out.push(r)
  return out.slice(0, 3).map((r, i) => ({ ...r, name: `Boucle ${['A', 'B', 'C'][i]}` }))
}

/** Parcours dessiné : départ → points touchés sur la carte → retour au départ, par les chemins. */
export const routeThrough = (key: string, home: LatLng, pts: LatLng[]) =>
  ors(key, { coordinates: [home, ...pts, home].map((p) => [p[1], p[0]]) })

/** Parcours d'une sortie déjà courue. */
export function routeFromRun(r: RunLog): RunRoute | undefined {
  if (!r.track || r.track.length < 2) return
  const coords = r.track.map((p) => round5(unpack(p)))
  return { name: '', coords, dist: Math.round(r.dist || lengthOf(coords)) }
}

export const kmText = (m: number) => `${(m / 1000).toFixed(1).replace('.', ',')} km`
export const routeInfo = (r: { dist: number; ascent?: number }) => `${kmText(r.dist)}${r.ascent !== undefined ? ` · ↗ ${r.ascent} m` : ''}`


// Suivi GPS d'une sortie : filtrage des points imprécis, distance, allure, tracé.
// Sur iPhone, une PWA ne reçoit plus de position écran verrouillé : l'écran reste allumé pendant la sortie.
import { del, get, set } from 'idb-keyval'

const R = 6371000
const rad = (d: number) => (d * Math.PI) / 180
export function haversine(a: [number, number], b: [number, number]) {
  const dLat = rad(b[0] - a[0]), dLon = rad(b[1] - a[1])
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a[0])) * Math.cos(rad(b[0])) * Math.sin(dLon / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(h))
}

export const gpsSupported = () => 'geolocation' in navigator

export interface GpsStatus { acc?: number; lastFix?: number; error?: string }

/** Surveille la position ; renvoie la fonction d'arrêt. */
export function watchGps(onFix: (p: GeolocationPosition) => void, onError: (msg: string) => void) {
  if (!gpsSupported()) { onError('GPS indisponible sur cet appareil'); return () => {} }
  const id = navigator.geolocation.watchPosition(onFix, (e) => {
    onError(e.code === e.PERMISSION_DENIED ? 'Localisation refusée : Réglages iOS → Confidentialité → Service de localisation → Safari' : 'Signal GPS perdu')
  }, { enableHighAccuracy: true, maximumAge: 0, timeout: 20000 })
  return () => navigator.geolocation.clearWatch(id)
}

const MAX_ACC = 35 // m : au-delà, le point est ignoré
const MIN_STEP = 5 // m : en dessous, c'est du bruit
const MAX_SPEED = 7 // m/s : au-delà, c'est un saut du GPS
const KEY = 'grind-run-track'

type Pt = [number, number, number]

class Tracker {
  runId = ''
  points: Pt[] = []
  dist = 0
  status: GpsStatus = {}
  private last?: { lat: number; lon: number; ts: number }
  private rejects = 0
  private recent: [number, number][] = [] // [ts ms, distance cumulée]
  private stop?: () => void
  private saveTimer?: number
  private listeners = new Set<() => void>()

  /** Démarre (ou reprend après un redémarrage de l'appli) le suivi d'une sortie. */
  async start(runId: string, activeT: () => number | undefined) {
    if (this.runId !== runId) {
      this.reset()
      this.runId = runId
      const saved = await get<{ id: string; points: Pt[]; dist: number }>(KEY)
      if (saved?.id === runId) { this.points = saved.points; this.dist = saved.dist }
    }
    this.stop?.()
    this.stop = watchGps((p) => this.onFix(p, activeT()), (error) => { this.status = { ...this.status, error }; this.emit() })
    clearInterval(this.saveTimer)
    this.saveTimer = window.setInterval(() => void this.save(), 10000)
  }

  private onFix(p: GeolocationPosition, t: number | undefined) {
    const { latitude: lat, longitude: lon, accuracy: acc } = p.coords
    this.status = { acc, lastFix: Date.now() }
    if (acc > MAX_ACC) return this.emit()
    const ts = p.timestamp
    // En pause : on suit la position sans compter la distance.
    if (t === undefined) { this.last = { lat, lon, ts }; return this.emit() }
    if (!this.last) {
      this.last = { lat, lon, ts }
      this.points.push([lat, lon, Math.round(t)])
      return this.emit()
    }
    const d = haversine([this.last.lat, this.last.lon], [lat, lon])
    const dt = Math.max(0.5, (ts - this.last.ts) / 1000)
    if (d < MIN_STEP) return this.emit()
    if (d / dt > MAX_SPEED && ++this.rejects < 4) return this.emit()
    // 4 rejets d'affilée : on s'est vraiment déplacé (retour d'arrière-plan…), on repart de là sans compter le saut.
    if (d / dt <= MAX_SPEED) this.dist += d
    this.rejects = 0
    this.last = { lat, lon, ts }
    this.points.push([lat, lon, Math.round(t)])
    this.recent.push([ts, this.dist])
    while (this.recent.length > 2 && ts - this.recent[0][0] > 30000) this.recent.shift()
    this.emit()
  }

  /** Allure sur les 30 dernières secondes (s/km). */
  pace() {
    if (this.recent.length < 2 || Date.now() - (this.status.lastFix ?? 0) > 15000) return undefined
    const [t0, d0] = this.recent[0]
    const [t1, d1] = this.recent[this.recent.length - 1]
    return d1 - d0 >= 20 ? (t1 - t0) / (d1 - d0) : undefined
  }

  async save() {
    if (this.runId) await set(KEY, { id: this.runId, points: this.points, dist: this.dist })
  }

  end() {
    this.stop?.()
    this.stop = undefined
    clearInterval(this.saveTimer)
    void del(KEY)
    const out = { points: this.points, dist: this.dist }
    this.reset()
    return out
  }

  private reset() {
    this.runId = ''; this.points = []; this.dist = 0; this.status = {}; this.last = undefined; this.recent = []; this.rejects = 0
  }

  subscribe(fn: () => void) { this.listeners.add(fn); return () => { this.listeners.delete(fn) } }
  private emit() { this.listeners.forEach((f) => f()) }
}

export const tracker = new Tracker()

document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') void tracker.save() })

/** Simplification Douglas-Peucker (tolérance en m) puis compression en entiers. */
export function simplify(points: Pt[], tol = 4): [number, number, number][] {
  if (points.length < 3) return points.map(pack)
  const lat0 = rad(points[0][0])
  const xy = points.map((p) => [rad(p[1]) * R * Math.cos(lat0), rad(p[0]) * R] as const)
  const keep = new Uint8Array(points.length)
  keep[0] = keep[points.length - 1] = 1
  const stack: [number, number][] = [[0, points.length - 1]]
  while (stack.length) {
    const [a, b] = stack.pop()!
    const [ax, ay] = xy[a], [bx, by] = xy[b]
    const len = Math.hypot(bx - ax, by - ay) || 1
    let best = 0, idx = -1
    for (let i = a + 1; i < b; i++) {
      const d = Math.abs((bx - ax) * (ay - xy[i][1]) - (ax - xy[i][0]) * (by - ay)) / len
      if (d > best) { best = d; idx = i }
    }
    if (best > tol && idx > 0) { keep[idx] = 1; stack.push([a, idx], [idx, b]) }
  }
  return points.filter((_, i) => keep[i]).map(pack)
}
const pack = (p: Pt): [number, number, number] => [Math.round(p[0] * 1e5), Math.round(p[1] * 1e5), p[2]]
export const unpack = (p: [number, number, number]): [number, number] => [p[0] / 1e5, p[1] / 1e5]

// ───────────── Formats ─────────────
export const fmtKm = (m: number) => (m / 1000).toFixed(m < 10000 ? 2 : 1).replace('.', ',')
export const fmtPace = (secPerKm?: number) => {
  if (!secPerKm || !isFinite(secPerKm) || secPerKm > 30 * 60) return '–'
  const s = Math.round(secPerKm)
  return `${Math.floor(s / 60)}:${`${s % 60}`.padStart(2, '0')}`
}
export const fmtDur = (sec: number) => {
  sec = Math.max(0, Math.round(sec))
  const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60), s = sec % 60
  return h ? `${h}:${`${m}`.padStart(2, '0')}:${`${s}`.padStart(2, '0')}` : `${m}:${`${s}`.padStart(2, '0')}`
}
export const fmtMin = (sec: number) => {
  if (sec < 60) return `${Math.round(sec)} s`
  const m = Math.floor(sec / 60), s = Math.round(sec % 60)
  return s ? `${m}′${`${s}`.padStart(2, '0')}` : `${m}′`
}

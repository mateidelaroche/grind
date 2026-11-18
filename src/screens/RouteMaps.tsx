// Cartes des parcours (Leaflet, chargé à la demande) : choix d'un parcours, dessin, suivi pendant la sortie.
import { useEffect, useRef } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { cumul, type LatLng } from '../lib/routes'

export const ROUTE_COLORS = ['#ea580c', '#a855f7', '#22c55e']

function baseMap(el: HTMLDivElement) {
  const map = L.map(el, { zoomControl: false, attributionControl: true })
  L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19, className: 'map-tiles',
    attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
  }).addTo(map)
  return map
}

const dot = (p: LatLng, fill: string, r = 7) => L.circleMarker(p, { radius: r, color: '#0a0e17', weight: 2, fillColor: fill, fillOpacity: 1 })

/** Flèches de sens tous les ~400 m. */
function arrows(c: LatLng[], color: string) {
  const cum = cumul(c)
  const total = cum[cum.length - 1]
  const out: L.Marker[] = []
  const step = Math.max(300, total / 12)
  for (let d = step / 2, i = 0; d < total; d += step) {
    while (i < c.length - 2 && cum[i + 1] < d) i++
    const [a, b] = [c[i], c[i + 1]]
    const k = Math.cos((a[0] * Math.PI) / 180)
    const deg = (Math.atan2((b[1] - a[1]) * k, b[0] - a[0]) * 180) / Math.PI
    out.push(L.marker(a, {
      interactive: false,
      icon: L.divIcon({ className: 'route-arrow', html: `<span style="transform:rotate(${deg}deg);color:${color}">▲</span>`, iconSize: [14, 14] }),
    }))
  }
  return out
}

/** Carte de choix : plusieurs parcours, le choisi en gras avec son sens ; en mode dessin, un toucher ajoute un point. */
export function RoutesMap({ routes, selected, home, points, onTap, className = 'run-map' }: {
  routes: LatLng[][]; selected?: number; home?: LatLng; points?: LatLng[]; onTap?: (p: LatLng) => void; className?: string
}) {
  const el = useRef<HTMLDivElement>(null)
  const map = useRef<L.Map>(undefined)
  const layer = useRef<L.LayerGroup>(undefined)
  const tap = useRef(onTap)
  tap.current = onTap
  const fitted = useRef('')

  useEffect(() => {
    const m = baseMap(el.current!)
    map.current = m
    fitted.current = ''
    layer.current = L.layerGroup().addTo(m)
    m.on('click', (e: L.LeafletMouseEvent) => tap.current?.(([e.latlng.lat, e.latlng.lng])))
    return () => { m.remove() }
  }, [])

  useEffect(() => {
    const m = map.current!, g = layer.current!
    g.clearLayers()
    routes.forEach((c, i) => {
      if (i !== selected) L.polyline(c, { color: ROUTE_COLORS[i % 3], weight: 3, opacity: 0.45 }).addTo(g)
    })
    const sel = selected !== undefined ? routes[selected] : undefined
    if (sel) {
      L.polyline(sel, { color: ROUTE_COLORS[selected! % 3], weight: 5, opacity: 0.95, lineCap: 'round' }).addTo(g)
      arrows(sel, ROUTE_COLORS[selected! % 3]).forEach((a) => a.addTo(g))
    }
    points?.forEach((p, i) => L.marker(p, { interactive: false, icon: L.divIcon({ className: 'route-pt', html: `${i + 1}`, iconSize: [20, 20] }) }).addTo(g))
    if (home) dot(home, '#22c55e').addTo(g)
    // On recadre seulement quand l'ensemble des parcours change (pas à chaque point dessiné).
    // En dessin, on cadre une seule fois : la carte ne saute pas à chaque point ajouté.
    const key = points ? `draw${home ?? ''}` : routes.map((c) => c.length).join(',') + (home ?? '')
    if (key !== fitted.current) {
      fitted.current = key
      const all = [...routes.flat(), ...(home ? [home] : [])]
      if (all.length > 1) m.fitBounds(L.latLngBounds(all), { padding: [20, 20] })
      else if (home) m.setView(home, 15)
      else m.setView([46.6, 2.4], 5)
    }
  }, [routes, selected, home, points])

  return <div ref={el} className={className} />
}

/** Pendant la sortie : le parcours, le chemin déjà fait, ta position (la carte te suit). */
export function LiveMap({ route, done, pos }: { route: LatLng[]; done: LatLng[]; pos?: LatLng }) {
  const el = useRef<HTMLDivElement>(null)
  const map = useRef<L.Map>(undefined)
  const trail = useRef<L.Polyline>(undefined)
  const me = useRef<L.CircleMarker>(undefined)
  const follow = useRef(true)

  useEffect(() => {
    const m = baseMap(el.current!)
    map.current = m
    L.polyline(route, { color: '#ea580c', weight: 5, opacity: 0.8, lineCap: 'round' }).addTo(m)
    arrows(route, '#ea580c').forEach((a) => a.addTo(m))
    dot(route[0], '#22c55e', 6).addTo(m)
    trail.current = L.polyline([], { color: '#60a5fa', weight: 4, opacity: 0.9 }).addTo(m)
    me.current = dot(route[0], '#3b82f6', 8)
    m.fitBounds(L.latLngBounds(route), { padding: [16, 16] })
    // Tu déplaces la carte à la main : elle arrête de te suivre pendant 20 s.
    let t: number | undefined
    m.on('dragstart', () => { follow.current = false; clearTimeout(t); t = window.setTimeout(() => { follow.current = true }, 20000) })
    return () => { clearTimeout(t); m.remove() }
  }, [route])

  useEffect(() => {
    trail.current?.setLatLngs(done)
    if (!pos || !map.current || !me.current) return
    me.current.setLatLng(pos)
    if (!map.current.hasLayer(me.current)) { me.current.addTo(map.current); map.current.setView(pos, 16) }
    else if (follow.current) map.current.panTo(pos, { animate: true })
  }, [done, pos])

  return <div ref={el} className="run-map live" />
}

// Carte du parcours (chargée seulement quand on ouvre une sortie : Leaflet pèse ~40 ko).
import { useEffect, useRef } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { unpack } from '../lib/gps'
import type { RunLog } from '../types'

export const RUN_COLOR = '#ea580c'
export const WALK_COLOR = '#60a5fa'

export default function RunMap({ run }: { run: RunLog }) {
  const el = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!el.current || !run.track?.length) return
    const map = L.map(el.current, { zoomControl: false, attributionControl: true })
    // Fond OpenStreetMap, assombri en CSS pour coller au thème de l'appli.
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19, className: 'map-tiles',
      attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    }).addTo(map)
    // Un segment de couleur par fraction : orange = course, bleu = marche.
    const pts = run.track.map((p) => ({ ll: unpack(p), t: p[2] }))
    const kindAt = (t: number) => run.splits.find((s) => t >= s.t0 && t < s.t0 + s.dur)?.kind ?? 'walk'
    let seg: [number, number][] = []
    let cur = kindAt(pts[0].t)
    const flush = () => {
      if (seg.length > 1) L.polyline(seg, { color: cur === 'run' ? RUN_COLOR : WALK_COLOR, weight: 4, opacity: 0.95, lineCap: 'round' }).addTo(map)
    }
    for (const p of pts) {
      const k = kindAt(p.t)
      seg.push(p.ll)
      if (k !== cur) { flush(); seg = [p.ll]; cur = k }
    }
    flush()
    const start = pts[0].ll, end = pts[pts.length - 1].ll
    L.circleMarker(start, { radius: 6, color: '#0a0e17', weight: 2, fillColor: '#22c55e', fillOpacity: 1 }).addTo(map)
    L.circleMarker(end, { radius: 6, color: '#0a0e17', weight: 2, fillColor: '#e8ecf3', fillOpacity: 1 }).addTo(map)
    map.fitBounds(L.latLngBounds(pts.map((p) => p.ll)), { padding: [18, 18] })
    return () => { map.remove() }
  }, [run])
  return <div ref={el} className="run-map" />
}

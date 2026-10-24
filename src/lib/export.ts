import { EXERCISES } from '../data/exercises'
import { SESSIONS } from '../data/sessions'
import { syncedSnapshot, useStore, type SyncedData } from '../store'
import { exportPhotos, importPhotos } from './photos'
import { levelOf } from './program'

const esc = (v: unknown) => {
  const s = String(v ?? '')
  return /[;"\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

async function share(name: string, content: string, type: string) {
  const file = new File([content], name, { type })
  const nav = navigator as Navigator & { canShare?: (d: unknown) => boolean }
  if (nav.canShare?.({ files: [file] })) {
    try { await navigator.share({ files: [file], title: name }); return } catch { /* annulé → téléchargement */ }
  }
  const url = URL.createObjectURL(file)
  const a = document.createElement('a')
  a.href = url
  a.download = name
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 5000)
}

const stamp = () => new Date().toISOString().slice(0, 10)

export function exportCSV() {
  const s = useStore.getState()
  // Séparateur « ; » : s'ouvre directement dans Excel en français.
  const rows = [['date', 'séance', 'express', 'durée (min)', 'exercice', 'niveau', 'séries faites', 'séries prévues', 'ressenti'].join(';')]
  for (const w of s.workouts) {
    const min = w.endedAt ? Math.round((w.endedAt - w.startedAt) / 60000) : ''
    for (const r of Object.values(w.sets)) {
      rows.push([
        w.date, SESSIONS[w.session].name, w.express ? 'oui' : 'non', min, EXERCISES[r.ex]?.name ?? r.ex,
        levelOf(r.ex, r.level)?.label ?? '', r.done, r.total, r.flags.map((f) => (f === 'hard' ? 'dur' : 'facile')).join(' '),
      ].map(esc).join(';'))
    }
  }
  for (const [date, b] of Object.entries(s.basket)) {
    rows.push([date, 'Basket', '', '', '', '', b.done ? 1 : 0, 1, b.knee !== undefined ? `genou ${b.knee}/10` : ''].map(esc).join(';'))
  }
  for (const r of s.runs) {
    const what = r.indoor ? 'Cardio chambre' : r.plan >= 0 ? `Course · sortie ${r.plan + 1}` : 'Course libre'
    rows.push([r.date, what, '', Math.round(r.dur / 60), 'Distance (km)', '', (r.dist / 1000).toFixed(2).replace('.', ','), '', r.knee !== undefined ? `genou ${r.knee}/10` : ''].map(esc).join(';'))
  }
  for (const [date, kg] of Object.entries(s.weights)) rows.push([date, 'Poids', '', '', 'Poids (kg)', '', kg, '', ''].map(esc).join(';'))
  for (const [date, m] of Object.entries(s.measures)) {
    for (const [k, v] of Object.entries(m)) rows.push([date, 'Mensuration', '', '', `${k} (cm)`, '', v, '', ''].map(esc).join(';'))
  }
  for (const [id, t] of Object.entries(s.tests)) {
    for (const [k, v] of Object.entries(t!.values)) rows.push([t!.date, `Test ${id}`, '', '', k, '', v, '', ''].map(esc).join(';'))
  }
  return share(`grind-${stamp()}.csv`, '﻿' + rows.join('\n'), 'text/csv')
}

/** Sauvegarde complète, photos comprises (elles ne sont pas dans la synchro). */
export async function exportJSON() {
  const doc = { ...syncedSnapshot(useStore.getState()), photos: await exportPhotos() }
  return share(`grind-sauvegarde-${stamp()}.json`, JSON.stringify(doc), 'application/json')
}

export async function importJSON(file: File) {
  const data = JSON.parse(await file.text()) as SyncedData & { photos?: Parameters<typeof importPhotos>[0] }
  if (!Array.isArray(data.workouts) || !data.settings) throw new Error('Fichier non reconnu')
  const { photos, ...rest } = data
  useStore.getState().applyRemote({ ...rest, updatedAt: Date.now() })
  if (photos?.length) await importPhotos(photos)
}

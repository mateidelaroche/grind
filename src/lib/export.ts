import { EXERCISES } from '../data/exercises'
import { SESSIONS } from '../data/sessions'
import { syncedSnapshot, useStore, type SyncedData } from '../store'
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
  return share(`grind-${stamp()}.csv`, '﻿' + rows.join('\n'), 'text/csv')
}

export function exportJSON() {
  return share(`grind-sauvegarde-${stamp()}.json`, JSON.stringify(syncedSnapshot(useStore.getState()), null, 1), 'application/json')
}

export async function importJSON(file: File) {
  const data = JSON.parse(await file.text()) as SyncedData
  if (!Array.isArray(data.workouts) || !data.settings) throw new Error('Fichier non reconnu')
  useStore.getState().applyRemote({ ...data, updatedAt: Date.now() })
}

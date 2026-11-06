// Fusion des données locales et du Gist. Fichier sans effet de bord, pour pouvoir le tester.
import type { SyncedData } from '../store'
import type { RunLog, Workout } from '../types'

/** Suppressions par clé (« workout:id », « basket:date »…) : date > 0 si supprimé, < 0 si recréé depuis. La plus récente gagne. */
export type Deleted = Record<string, number>

export function markDeleted(d: Deleted | undefined, key: string, gone: boolean, now = Date.now()): Deleted | undefined {
  if (gone) return { ...d, [key]: now }
  return (d?.[key] ?? 0) > 0 ? { ...d, [key]: -now } : d
}

function mergeDeleted(a: Deleted = {}, b: Deleted = {}) {
  const out = { ...a }
  for (const [k, v] of Object.entries(b)) if (Math.abs(v) > Math.abs(out[k] ?? 0)) out[k] = v
  return out
}

function mergeWorkouts(a: Workout[], b: Workout[]) {
  const map = new Map<string, Workout>()
  for (const w of [...a, ...b]) {
    const cur = map.get(w.id)
    if (!cur || (w.endedAt ?? 0) > (cur.endedAt ?? 0) || (w.completed && !cur.completed)) map.set(w.id, w)
  }
  return [...map.values()].sort((x, y) => x.startedAt - y.startedAt)
}

function mergeRuns(a: RunLog[] = [], b: RunLog[] = []) {
  const map = new Map<string, RunLog>()
  for (const r of [...a, ...b]) {
    const cur = map.get(r.id)
    if (!cur || (r.edited ?? r.endedAt) > (cur.edited ?? cur.endedAt)) map.set(r.id, r)
  }
  return [...map.values()].sort((x, y) => x.startedAt - y.startedAt)
}

export function mergeData(local: SyncedData, remote: SyncedData): SyncedData {
  const remoteNewer = remote.updatedAt > local.updatedAt
  const base = remoteNewer ? remote : local
  const deleted = mergeDeleted(local.deleted, remote.deleted)
  const gone = (key: string) => (deleted[key] ?? 0) > 0
  // Journaux par date : union des deux côtés, le plus récent gagne en cas de conflit.
  const map = <T,>(k: 'basket' | 'weights' | 'measures' | 'food' | 'tests' | 'flex') => {
    const l = (local[k] ?? {}) as Record<string, T>
    const r = (remote[k] ?? {}) as Record<string, T>
    const all = remoteNewer ? { ...l, ...r } : { ...r, ...l }
    return Object.fromEntries(Object.entries(all).filter(([id]) => !gone(`${k}:${id}`)))
  }
  const events = new Map([...(remote.levelLog ?? []), ...(local.levelLog ?? [])].map((e) => [`${e.ex}:${e.level}`, e]))
  return {
    ...local,
    ...Object.fromEntries(Object.entries(base).filter(([, v]) => v !== undefined)),
    push: local.push ?? remote.push,
    workouts: mergeWorkouts(local.workouts, remote.workouts).filter((w) => !gone(`workout:${w.id}`)),
    runs: mergeRuns(local.runs, remote.runs).filter((r) => !gone(`run:${r.id}`)),
    basket: map('basket'),
    weights: map('weights'),
    measures: map('measures'),
    food: map('food'),
    tests: map('tests'),
    flex: map('flex'),
    levelLog: [...events.values()].sort((a, b) => a.date.localeCompare(b.date)),
    deleted,
    updatedAt: Math.max(local.updatedAt, remote.updatedAt),
  }
}

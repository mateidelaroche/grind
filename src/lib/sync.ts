// Synchro cloud via un Gist GitHub secret : aucun compte en plus, juste un jeton « gist ».
import { syncedSnapshot, useStore, type SyncedData } from '../store'
import { notifyPlan } from './notify'
import type { Workout } from '../types'

const FILE = 'grind-data.json'
const API = 'https://api.github.com'
export const TOKEN_URL = 'https://github.com/settings/tokens/new?scopes=gist&description=Grind%20sync'

async function gh(path: string, token: string, init: RequestInit = {}) {
  const res = await fetch(API + path, {
    ...init,
    headers: { Accept: 'application/vnd.github+json', Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', ...init.headers },
  })
  if (!res.ok) throw new Error(res.status === 401 ? 'Jeton invalide ou expiré' : `GitHub ${res.status}`)
  return res.json()
}

type Doc = SyncedData & { notify?: ReturnType<typeof notifyPlan>; app: 'grind'; v: 1 }

function buildDoc(): Doc {
  const s = useStore.getState()
  return { app: 'grind', v: 1, ...syncedSnapshot(s), notify: notifyPlan(s) }
}

async function readGist(id: string, token: string): Promise<Doc | undefined> {
  const g = await gh(`/gists/${id}`, token)
  const f = g.files?.[FILE]
  if (!f) return
  const text = f.truncated ? await (await fetch(f.raw_url)).text() : f.content
  return JSON.parse(text)
}

async function findGist(token: string): Promise<string | undefined> {
  for (let page = 1; page <= 5; page++) {
    const list = await gh(`/gists?per_page=100&page=${page}`, token)
    const hit = list.find((g: { files: Record<string, unknown> }) => g.files && FILE in g.files)
    if (hit) return hit.id
    if (list.length < 100) return
  }
}

function mergeWorkouts(a: Workout[], b: Workout[]) {
  const map = new Map<string, Workout>()
  for (const w of [...a, ...b]) {
    const cur = map.get(w.id)
    if (!cur || (w.endedAt ?? 0) > (cur.endedAt ?? 0) || (w.completed && !cur.completed)) map.set(w.id, w)
  }
  return [...map.values()].sort((x, y) => x.startedAt - y.startedAt)
}

function merge(remote: Doc) {
  const s = useStore.getState()
  const local = syncedSnapshot(s)
  const remoteNewer = remote.updatedAt > local.updatedAt
  const base = remoteNewer ? remote : local
  // Journaux par date : union des deux côtés, le plus récent gagne en cas de conflit.
  const map = <T,>(k: 'basket' | 'weights' | 'measures' | 'food' | 'tests') => {
    const l = (local[k] ?? {}) as Record<string, T>
    const r = (remote[k] ?? {}) as Record<string, T>
    return remoteNewer ? { ...l, ...r } : { ...r, ...l }
  }
  const events = new Map([...(remote.levelLog ?? []), ...(local.levelLog ?? [])].map((e) => [`${e.ex}:${e.level}`, e]))
  const merged: SyncedData = {
    ...local,
    ...Object.fromEntries(Object.entries(base).filter(([, v]) => v !== undefined)),
    push: local.push ?? remote.push,
    workouts: mergeWorkouts(local.workouts, remote.workouts),
    basket: map('basket'),
    weights: map('weights'),
    measures: map('measures'),
    food: map('food'),
    tests: map('tests'),
    levelLog: [...events.values()].sort((a, b) => a.date.localeCompare(b.date)),
    updatedAt: Math.max(local.updatedAt, remote.updatedAt),
  }
  s.applyRemote(merged)
}

let pushing = false
let pending = false

export async function pushNow() {
  const { sync } = useStore.getState()
  if (!sync.token || !sync.gistId) return
  if (pushing) { pending = true; return }
  pushing = true
  try {
    useStore.getState().setSync({ status: 'syncing' })
    await gh(`/gists/${sync.gistId}`, sync.token, {
      method: 'PATCH',
      body: JSON.stringify({ files: { [FILE]: { content: JSON.stringify(buildDoc()) } } }),
    })
    useStore.getState().setSync({ status: 'idle', lastSync: Date.now(), error: undefined })
  } catch (e) {
    useStore.getState().setSync({ status: 'error', error: (e as Error).message })
  } finally {
    pushing = false
    if (pending) { pending = false; void pushNow() }
  }
}

export async function pullNow() {
  const { sync } = useStore.getState()
  if (!sync.token || !sync.gistId) return
  try {
    useStore.getState().setSync({ status: 'syncing' })
    const remote = await readGist(sync.gistId, sync.token)
    if (remote) merge(remote)
    useStore.getState().setSync({ status: 'idle', lastSync: Date.now(), error: undefined })
  } catch (e) {
    useStore.getState().setSync({ status: 'error', error: (e as Error).message })
  }
}

export async function connect(token: string) {
  token = token.trim()
  const st = useStore.getState()
  st.setSync({ status: 'syncing', token })
  try {
    let id = await findGist(token)
    if (id) {
      useStore.getState().setSync({ gistId: id })
      await pullNow()
      await pushNow()
    } else {
      const g = await gh('/gists', token, {
        method: 'POST',
        body: JSON.stringify({ description: 'Grind — données de l’appli (ne pas supprimer)', public: false, files: { [FILE]: { content: JSON.stringify(buildDoc()) } } }),
      })
      id = g.id as string
      useStore.getState().setSync({ gistId: id, status: 'idle', lastSync: Date.now() })
    }
  } catch (e) {
    useStore.getState().setSync({ status: 'error', error: (e as Error).message, token: undefined })
    throw e
  }
}

export function disconnect() {
  useStore.getState().setSync({ token: undefined, gistId: undefined, status: 'off', lastSync: undefined, error: undefined })
}

/** Démarre la synchro automatique : pull au lancement et au retour dans l'appli, push 3 s après chaque modif. */
export function startAutoSync() {
  let timer: number | undefined
  let lastUpdated = useStore.getState().updatedAt
  void pullNow()
  useStore.subscribe((s) => {
    if (s.updatedAt === lastUpdated) return
    lastUpdated = s.updatedAt
    clearTimeout(timer)
    timer = window.setTimeout(() => void pushNow(), 3000)
  })
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') void pullNow()
    else { clearTimeout(timer); void pushNow() }
  })
}

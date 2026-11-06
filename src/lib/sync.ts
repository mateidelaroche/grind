// Synchro cloud via un Gist GitHub secret : aucun compte en plus, juste un jeton « gist ».
import { syncedSnapshot, useStore, type SyncedData } from '../store'
import { mergeData } from './merge'
import { notifyPlan } from './notify'

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
  if (!f.truncated) return JSON.parse(f.content)
  const res = await fetch(f.raw_url)
  if (!res.ok) throw new Error(`GitHub ${res.status}`)
  return res.json()
}

async function findGist(token: string): Promise<string | undefined> {
  for (let page = 1; page <= 5; page++) {
    const list = await gh(`/gists?per_page=100&page=${page}`, token)
    const hit = list.find((g: { files: Record<string, unknown> }) => g.files && FILE in g.files)
    if (hit) return hit.id
    if (list.length < 100) return
  }
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

async function pull(token: string, gistId: string) {
  useStore.getState().setSync({ status: 'syncing' })
  const remote = await readGist(gistId, token)
  if (remote) {
    const s = useStore.getState()
    s.applyRemote(mergeData(syncedSnapshot(s), remote))
  }
  useStore.getState().setSync({ status: 'idle', lastSync: Date.now(), error: undefined })
}

/** Récupère le Gist. Renvoie false en cas d'échec : il ne faut alors surtout pas l'écraser. */
export async function pullNow() {
  const { sync } = useStore.getState()
  if (!sync.token || !sync.gistId) return false
  try {
    await pull(sync.token, sync.gistId)
    return true
  } catch (e) {
    useStore.getState().setSync({ status: 'error', error: (e as Error).message })
    return false
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
      await pull(token, id)
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
    useStore.getState().setSync({ status: 'error', error: (e as Error).message, token: undefined, gistId: undefined })
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

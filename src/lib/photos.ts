// Photos de progression : stockées uniquement sur le téléphone (IndexedDB), jamais synchronisées.
import { createStore, del, get, set } from 'idb-keyval'
import type { PhotoMeta, PhotoPose } from '../types'

const store = createStore('grind-photos', 'photos')
const META = 'meta'

export async function listPhotos(): Promise<PhotoMeta[]> {
  return ((await get<PhotoMeta[]>(META, store)) ?? []).sort((a, b) => a.date.localeCompare(b.date))
}

export const getPhoto = (id: string) => get<string>(`img:${id}`, store)

/** Redimensionne (1280 px max) et compresse en JPEG. */
export async function compress(src: CanvasImageSource & { width: number; height: number }, maxSide = 1280): Promise<string> {
  const w0 = 'videoWidth' in src ? (src as HTMLVideoElement).videoWidth : src.width
  const h0 = 'videoHeight' in src ? (src as HTMLVideoElement).videoHeight : src.height
  const k = Math.min(1, maxSide / Math.max(w0, h0))
  const c = document.createElement('canvas')
  c.width = Math.round(w0 * k)
  c.height = Math.round(h0 * k)
  c.getContext('2d')!.drawImage(src, 0, 0, c.width, c.height)
  return c.toDataURL('image/jpeg', 0.82)
}

export async function fileToDataURL(file: File) {
  const img = new Image()
  img.src = URL.createObjectURL(file)
  await img.decode()
  const out = await compress(img)
  URL.revokeObjectURL(img.src)
  return out
}

export async function addPhoto(dataUrl: string, pose: PhotoPose, date: string) {
  const id = `${date}-${pose}-${Date.now().toString(36)}`
  await set(`img:${id}`, dataUrl, store)
  const meta = await listPhotos()
  await set(META, [...meta, { id, date, pose }], store)
  return id
}

export async function deletePhoto(id: string) {
  await del(`img:${id}`, store)
  await set(META, (await listPhotos()).filter((p) => p.id !== id), store)
}

/** Pour la sauvegarde JSON complète. */
export async function exportPhotos() {
  const meta = await listPhotos()
  return Promise.all(meta.map(async (m) => ({ ...m, data: (await getPhoto(m.id)) ?? '' })))
}

export async function importPhotos(list: (PhotoMeta & { data: string })[]) {
  const existing = new Set((await listPhotos()).map((p) => p.id))
  const meta = await listPhotos()
  for (const p of list) {
    if (existing.has(p.id) || !p.data) continue
    await set(`img:${p.id}`, p.data, store)
    meta.push({ id: p.id, date: p.date, pose: p.pose })
  }
  await set(META, meta, store)
}

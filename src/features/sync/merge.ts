import type { Playlist } from '../../shared/types'

const TOMBSTONE_TTL_MS = 30 * 24 * 60 * 60 * 1000

// newest edit wins per playlist. deletes stay as tombstones for 30 days so they sync too
export function mergePlaylists(a: Playlist[], b: Playlist[]): Playlist[] {
  const byId = new Map<string, Playlist>()
  for (const p of a) byId.set(p.id, p)
  for (const p of b) {
    const current = byId.get(p.id)
    if (!current || p.updatedAt > current.updatedAt) byId.set(p.id, p)
  }
  const cutoff = Date.now() - TOMBSTONE_TTL_MS
  return [...byId.values()]
    .filter((p) => !(p.deleted && p.updatedAt < cutoff))
    .sort((x, y) => x.createdAt - y.createdAt || x.id.localeCompare(y.id))
}

export function samePlaylists(a: Playlist[], b: Playlist[]): boolean {
  const canonical = (list: Playlist[]) =>
    JSON.stringify([...list].sort((x, y) => x.id.localeCompare(y.id)).map((p) => ({ ...p, deleted: p.deleted === true })))
  return canonical(a) === canonical(b)
}

import type { Playlist } from '../src/shared/types'

const MAX_NAME = 60
const MAX_TEXT = 300
const text = (v: unknown, max: number): string | null => (typeof v === 'string' ? v.slice(0, max) : null)

// drops anything malformed (also used on the cloud sync file)
export function sanitizePlaylists(raw: unknown): Playlist[] {
  if (!Array.isArray(raw)) return []
  const playlists: Playlist[] = []
  for (const item of raw) {
    const p = item as Partial<Playlist> | null
    const id = text(p?.id, 64)
    const name = text(p?.name, MAX_NAME)
    if (!id || name === null || !Array.isArray(p?.entries)) continue
    const entries = p.entries.flatMap((e) => {
      const key = text(e?.key, 64)
      const title = text(e?.title, MAX_TEXT)
      const artist = text(e?.artist, MAX_TEXT)
      return key && title !== null && artist !== null ? [{ key, title, artist }] : []
    })
    const createdAt = typeof p.createdAt === 'number' ? p.createdAt : 0
    playlists.push({
      id,
      name,
      entries,
      createdAt,
      updatedAt: typeof p.updatedAt === 'number' ? p.updatedAt : createdAt,
      ...(p.deleted === true ? { deleted: true } : {}),
    })
  }
  return playlists
}

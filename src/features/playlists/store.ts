import { create } from 'zustand'
import type { Playlist, PlaylistEntry, Track } from '../../shared/types'
import { mergePlaylists } from '../sync/merge'

interface PlaylistState {
  playlists: Playlist[]
  ready: boolean
  hydrate: (raw: unknown[], library: Track[]) => void
  setAll: (playlists: Playlist[]) => void
  create: (name: string, entries?: PlaylistEntry[]) => string
  rename: (id: string, name: string) => void
  remove: (id: string) => void
  addTrack: (id: string, track: Track) => void
  removeTrack: (id: string, key: string) => void
}

const cleanName = (name: string) => name.trim().slice(0, 60) || 'Untitled playlist'

export const entryFromTrack = (t: Pick<Track, 'key' | 'title' | 'artist'>): PlaylistEntry => ({
  key: t.key,
  title: t.title,
  artist: t.artist,
})

const isEntry = (e: unknown): e is PlaylistEntry =>
  typeof e === 'object' && e !== null &&
  typeof (e as PlaylistEntry).key === 'string' &&
  typeof (e as PlaylistEntry).title === 'string' &&
  typeof (e as PlaylistEntry).artist === 'string'

// also reads the old { trackIds } format
function normalize(raw: unknown, libraryById: Map<string, Track>): Playlist | null {
  if (typeof raw !== 'object' || raw === null) return null
  const p = raw as Record<string, unknown>
  if (typeof p.id !== 'string' || typeof p.name !== 'string') return null

  let entries: PlaylistEntry[] = []
  if (Array.isArray(p.entries)) {
    entries = p.entries.filter(isEntry)
  } else if (Array.isArray(p.trackIds)) {
    entries = p.trackIds.flatMap((id) => {
      const track = typeof id === 'string' ? libraryById.get(id) : undefined
      return track ? [entryFromTrack(track)] : []
    })
  }
  const createdAt = typeof p.createdAt === 'number' ? p.createdAt : Date.now()
  return {
    id: p.id,
    name: p.name,
    entries,
    createdAt,
    updatedAt: typeof p.updatedAt === 'number' ? p.updatedAt : createdAt,
    ...(p.deleted === true ? { deleted: true } : {}),
  }
}

const touch = (p: Playlist, patch: Partial<Playlist>): Playlist => ({ ...p, ...patch, updatedAt: Date.now() })

export const usePlaylistStore = create<PlaylistState>()((set) => ({
  playlists: [],
  ready: false,

  hydrate: (raw, library) =>
    set((state) => {
      const byId = new Map(library.map((t) => [t.id, t]))
      const loaded = raw.flatMap((r) => normalize(r, byId) ?? [])
      return { playlists: mergePlaylists(loaded, state.playlists), ready: true }
    }),

  setAll: (playlists) => set({ playlists }),

  create: (name, entries = []) => {
    const id = crypto.randomUUID()
    const now = Date.now()
    set((state) => ({
      playlists: [...state.playlists, { id, name: cleanName(name), entries, createdAt: now, updatedAt: now }],
    }))
    return id
  },

  rename: (id, name) =>
    set((state) => ({ playlists: state.playlists.map((p) => (p.id === id ? touch(p, { name: cleanName(name) }) : p)) })),

  remove: (id) =>
    set((state) => ({
      playlists: state.playlists.map((p) => (p.id === id ? touch(p, { deleted: true, entries: [] }) : p)),
    })),

  addTrack: (id, track) =>
    set((state) => ({
      playlists: state.playlists.map((p) =>
        p.id === id && !p.entries.some((e) => e.key === track.key)
          ? touch(p, { entries: [...p.entries, entryFromTrack(track)] })
          : p,
      ),
    })),

  removeTrack: (id, key) =>
    set((state) => ({
      playlists: state.playlists.map((p) =>
        p.id === id ? touch(p, { entries: p.entries.filter((e) => e.key !== key) }) : p,
      ),
    })),
}))

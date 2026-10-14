import { useMemo, useState, type FormEvent } from 'react'
import { CoverArt } from '../../components/ui/CoverArt'
import { TrackRow, TRACK_ROW_GRID } from '../library/TrackRow'
import { selectCurrentTrack, usePlayerStore } from '../player/store'
import type { Track } from '../../shared/types'
import { usePlaylistStore } from './store'
import { useLivePlaylists } from './useLivePlaylists'

export function PlaylistsView() {
  const playlists = useLivePlaylists()
  const library = usePlayerStore((s) => s.library)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [newName, setNewName] = useState('')

  const selected = playlists.find((p) => p.id === selectedId) ?? null

  const onCreate = (e: FormEvent) => {
    e.preventDefault()
    if (!newName.trim()) return
    setSelectedId(usePlaylistStore.getState().create(newName))
    setNewName('')
  }

  if (selected) {
    return <PlaylistDetail playlistId={selected.id} onBack={() => setSelectedId(null)} />
  }

  return (
    <div className="flex min-h-full flex-col">
      <header className="mb-8 flex items-end justify-between gap-4">
        <h1 className="text-3xl font-bold tracking-tight">Playlists</h1>
        <form onSubmit={onCreate} className="flex items-center gap-2">
          <input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="New playlist name"
            maxLength={60}
            aria-label="New playlist name"
            className="w-56 rounded-full bg-fg/5 px-4 py-2 text-sm outline-none ring-1 ring-fg/10 placeholder:text-fg/30 focus:ring-accent-soft"
          />
          <button
            type="submit"
            disabled={!newName.trim()}
            className="rounded-full bg-accent px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-accent-glow transition hover:bg-accent-soft disabled:opacity-50"
          >
            Create
          </button>
        </form>
      </header>

      {playlists.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-3 py-24 text-center">
          <h2 className="text-xl font-semibold">No playlists yet</h2>
          <p className="max-w-sm text-sm text-fg/50">Name one above, or use the “⋯” menu on any song to add it to a new playlist.</p>
        </div>
      ) : (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(10.5rem,1fr))] gap-4">
          {playlists.map((p) => {
            const first = library.find((t) => p.entries.some((e) => e.key === t.key))
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => setSelectedId(p.id)}
                className="rounded-2xl bg-fg/[0.03] p-3 text-left ring-1 ring-fg/5 transition hover:-translate-y-0.5 hover:bg-fg/[0.07] hover:ring-fg/10"
              >
                <CoverArt track={first ?? { id: p.id, cover: null, title: p.name }} className="w-full rounded-xl shadow-lg shadow-black/40" />
                <p className="mt-3 truncate text-sm font-semibold">{p.name}</p>
                <p className="text-xs text-fg/50">{p.entries.length} {p.entries.length === 1 ? 'song' : 'songs'}</p>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}

function PlaylistDetail({ playlistId, onBack }: { playlistId: string; onBack: () => void }) {
  const playlist = usePlaylistStore((s) => s.playlists.find((p) => p.id === playlistId))
  const library = usePlayerStore((s) => s.library)
  const currentId = usePlayerStore((s) => selectCurrentTrack(s)?.id)
  const isPlaying = usePlayerStore((s) => s.isPlaying)
  const playTrack = usePlayerStore((s) => s.playTrack)
  const togglePlay = usePlayerStore((s) => s.togglePlay)
  const { rename, remove } = usePlaylistStore.getState()
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState('')

  // keep playlist order, skip entries we don't have on this device
  const tracks = useMemo(() => {
    const byKey = new Map<string, Track>()
    for (const t of library) if (!byKey.has(t.key)) byKey.set(t.key, t)
    return (playlist?.entries ?? []).flatMap((e) => byKey.get(e.key) ?? [])
  }, [library, playlist?.entries])

  if (!playlist || playlist.deleted) return null
  const unavailable = playlist.entries.length - tracks.length

  const handlePlay = (id: string) => (id === currentId ? togglePlay() : playTrack(id, tracks))
  const commitRename = () => {
    if (draft.trim()) rename(playlist.id, draft)
    setEditing(false)
  }

  return (
    <div className="flex min-h-full flex-col">
      <button type="button" onClick={onBack} className="mb-4 self-start text-sm text-fg/50 transition hover:text-fg">← All playlists</button>
      <header className="mb-8 flex items-end gap-6">
        <CoverArt track={tracks[0] ?? { id: playlist.id, cover: null, title: playlist.name }} className="size-40 shrink-0 rounded-2xl shadow-2xl shadow-black/50" />
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold uppercase tracking-wider text-fg/50">Playlist</p>
          {editing ? (
            <input
              autoFocus
              value={draft}
              maxLength={60}
              onChange={(e) => setDraft(e.target.value)}
              onBlur={commitRename}
              onKeyDown={(e) => { if (e.key === 'Enter') commitRename(); if (e.key === 'Escape') setEditing(false) }}
              aria-label="Playlist name"
              className="mt-1 w-full rounded-lg bg-fg/10 px-3 py-1 text-3xl font-bold outline-none focus:ring-1 focus:ring-accent-soft"
            />
          ) : (
            <h1
              className="mt-1 cursor-text truncate text-4xl font-bold tracking-tight"
              title="Double-click to rename"
              onDoubleClick={() => { setDraft(playlist.name); setEditing(true) }}
            >
              {playlist.name}
            </h1>
          )}
          <p className="mt-1 text-sm text-fg/50">
            {tracks.length} {tracks.length === 1 ? 'song' : 'songs'}
            {unavailable > 0 && ` · ${unavailable} not on this device`}
          </p>
          <div className="mt-4 flex items-center gap-3">
            <button
              type="button"
              disabled={tracks.length === 0}
              onClick={() => playTrack(tracks[0].id, tracks)}
              className="rounded-full bg-accent px-5 py-2 text-sm font-semibold text-white shadow-lg shadow-accent-glow transition hover:bg-accent-soft disabled:opacity-50"
            >
              Play
            </button>
            <button type="button" onClick={() => { setDraft(playlist.name); setEditing(true) }} className="rounded-full px-4 py-2 text-sm text-fg/60 ring-1 ring-fg/10 transition hover:text-fg">Rename</button>
            <button
              type="button"
              onClick={() => { remove(playlist.id); onBack() }}
              className="rounded-full px-4 py-2 text-sm text-red-300/80 ring-1 ring-fg/10 transition hover:text-red-200"
            >
              Delete
            </button>
          </div>
        </div>
      </header>

      {tracks.length === 0 ? (
        <p className="py-16 text-center text-sm text-fg/50">This playlist is empty. Use the “⋯” menu on a song in your library to add it.</p>
      ) : (
        <div>
          <div className={`${TRACK_ROW_GRID} border-b border-fg/10 pb-2 text-xs uppercase tracking-wider text-fg/40`}>
            <span className="text-center">#</span><span>Title</span><span>Album</span><span className="text-right">Time</span><span />
          </div>
          <div className="mt-2">
            {tracks.map((track, i) => (
              <TrackRow
                key={track.id}
                track={track}
                index={i}
                playlistId={playlist.id}
                isCurrent={track.id === currentId}
                isPlaying={isPlaying}
                onPlay={() => handlePlay(track.id)}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

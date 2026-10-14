import { useEffect, useMemo, useRef, useState } from 'react'
import type { LibraryFilter, LibraryLayout, LibrarySort, Track } from '../../shared/types'
import { LibraryIcon, PlusIcon } from '../../components/ui/icons'
import { HEADER_EASE, StickyHeader } from '../../components/layout/StickyHeader'
import { PageTitle } from '../../components/ui/PageTitle'
import { selectCurrentTrack, usePlayerStore } from '../player/store'
import { EmptyLibrary } from './EmptyLibrary'
import { TrackCard } from './TrackCard'
import { TRACK_ROW_GRID, TrackRow } from './TrackRow'
import { useImportTracks } from './useImportTracks'

type Layout = LibraryLayout
type Filter = LibraryFilter
type SortKey = LibrarySort

const FILTERS: Array<{ id: Filter; label: string }> = [
  { id: 'all', label: 'All' },
  { id: 'music', label: 'Music' },
  { id: 'videos', label: 'Videos' },
]

const SORTS: Array<{ id: SortKey; label: string }> = [
  { id: 'added', label: 'Date added' },
  { id: 'title', label: 'Title' },
  { id: 'artist', label: 'Artist' },
  { id: 'album', label: 'Album' },
  { id: 'duration', label: 'Duration' },
]

const compareText = (a: string, b: string) => a.localeCompare(b, undefined, { sensitivity: 'base', numeric: true })

function sortTracks(tracks: Track[], key: SortKey): Track[] {
  if (key === 'added') return tracks
  const sorted = [...tracks]
  if (key === 'duration') return sorted.sort((a, b) => a.duration - b.duration)
  return sorted.sort((a, b) => compareText(a[key], b[key]) || compareText(a.title, b.title))
}

export function LibraryView() {
  const library = usePlayerStore((s) => s.library)
  const currentId = usePlayerStore((s) => selectCurrentTrack(s)?.id)
  const isPlaying = usePlayerStore((s) => s.isPlaying)
  const playTrack = usePlayerStore((s) => s.playTrack)
  const togglePlay = usePlayerStore((s) => s.togglePlay)
  const { importTracks, isImporting } = useImportTracks()
  const [layout, setLayout] = useState<Layout>('grid')
  const [filter, setFilter] = useState<Filter>('all')
  const [query, setQuery] = useState('')
  const [sort, setSort] = useState<SortKey>('added')
  // don't write the defaults back before the saved prefs arrive
  const prefsLoaded = useRef(false)

  useEffect(() => {
    window.beatnode
      .getLibraryPrefs()
      .then((prefs) => {
        setLayout(prefs.layout)
        setFilter(prefs.filter)
        setSort(prefs.sort)
      })
      .catch(console.error)
      .finally(() => {
        prefsLoaded.current = true
      })
  }, [])

  useEffect(() => {
    if (!prefsLoaded.current) return
    window.beatnode.setLibraryPrefs({ layout, filter, sort }).catch(console.error)
  }, [layout, filter, sort])

  const matches = useMemo(() => {
    const needle = query.trim().toLowerCase()
    if (!needle) return library
    return library.filter((t) => `${t.title} ${t.artist} ${t.album}`.toLowerCase().includes(needle))
  }, [library, query])

  const totals = useMemo(() => {
    const videos = library.filter((t) => t.kind === 'video').length
    return { music: library.length - videos, videos }
  }, [library])
  const counts = useMemo(() => {
    const videos = matches.filter((t) => t.kind === 'video').length
    return { all: matches.length, music: matches.length - videos, videos }
  }, [matches])
  const visible = useMemo(() => {
    const inTab = filter === 'all' ? matches : matches.filter((t) => (filter === 'videos') === (t.kind === 'video'))
    return sortTracks(inTab, sort)
  }, [matches, filter, sort])

  // visible list is the queue, so next/prev stay in the current tab
  const handlePlay = (id: string) => (id === currentId ? togglePlay() : playTrack(id, visible))

  const subtitle = `${totals.music} ${totals.music === 1 ? 'song' : 'songs'} · ${totals.videos} ${totals.videos === 1 ? 'video' : 'videos'}`

  const ease = HEADER_EASE

  return (
    <div className="flex min-h-full flex-col">
      <StickyHeader>
        {(compact) => (
          <>
        <header className={`flex items-end justify-between gap-4 ${ease} ${compact ? 'mb-2' : 'mb-6'}`}>
          <div className="min-w-0">
            <PageTitle compact={compact} icon={<LibraryIcon />}>Library</PageTitle>
            <div className={`grid ${ease} ${compact ? 'grid-rows-[0fr] opacity-0' : 'grid-rows-[1fr] opacity-100'}`}>
              <p className="overflow-hidden text-sm text-fg/50">
                <span className="block pt-1">{subtitle}</span>
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex rounded-full bg-fg/5 p-1 ring-1 ring-fg/10" role="group" aria-label="Layout">
              {(['grid', 'list'] as const).map((mode) => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => setLayout(mode)}
                  aria-pressed={layout === mode}
                  aria-label={`${mode} view`}
                  title={`${mode} view`}
                  className={`rounded-full ${ease} ${compact ? 'px-2.5 py-0.5 text-xs' : 'px-3 py-1 text-sm'} ${layout === mode ? 'bg-fg/15 text-fg' : 'text-fg/50 hover:text-fg'}`}
                >
                  {mode === 'grid' ? 'Grid' : 'List'}
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={importTracks}
              disabled={isImporting}
              aria-label="Add media"
              title={isImporting ? 'Importing…' : 'Add media'}
              className={`flex items-center rounded-full bg-accent font-semibold text-white shadow-lg shadow-accent-glow hover:bg-accent-soft disabled:opacity-60 ${ease} ${compact ? 'h-8 px-2.5 text-xs' : 'h-10 px-3.5 text-sm'}`}
            >
              {isImporting ? <span className="size-4 shrink-0 animate-spin rounded-full border-2 border-white/30 border-t-white" /> : <PlusIcon size={18} />}
              {/* the word folds away when compact, the tooltip still names it */}
              <span className={`overflow-hidden whitespace-nowrap ${ease} ${compact ? 'ml-0 max-w-0 opacity-0' : 'ml-2 max-w-[8rem] opacity-100'}`}>
                {isImporting ? 'Importing…' : 'Add media'}
              </span>
            </button>
          </div>
        </header>

        {library.length > 0 && (
          <div className={`flex flex-wrap items-center justify-between gap-3 ${ease} ${compact ? 'mb-0' : 'mb-5'}`}>
            <div className="flex gap-2" role="tablist" aria-label="Media type">
              {FILTERS.map(({ id, label }) => (
                <button
                  key={id}
                  type="button"
                  role="tab"
                  aria-selected={filter === id}
                  onClick={() => setFilter(id)}
                  className={`rounded-full font-medium ${ease} ${compact ? 'px-3 py-1 text-xs' : 'px-4 py-1.5 text-sm'} ${filter === id ? 'bg-fg text-base' : 'bg-fg/5 text-fg/70 hover:bg-fg/10 hover:text-fg'}`}
                >
                  {label} <span className="ml-1 text-xs opacity-60">{counts[id]}</span>
                </button>
              ))}
            </div>
            <div className="flex items-center gap-2">
              <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Escape' && setQuery('')}
                placeholder="Search title, artist, album"
                aria-label="Search library"
                title="Search title, artist or album"
                className={`rounded-full bg-fg/5 ring-1 ring-fg/10 outline-none placeholder:text-fg/40 focus:ring-accent ${ease} ${compact ? 'w-52 px-3 py-1 text-xs' : 'w-64 px-4 py-1.5 text-sm'}`}
              />
              <select
                value={sort}
                onChange={(e) => setSort(e.target.value as SortKey)}
                aria-label="Sort by"
                title="Sort by"
                className={`rounded-full bg-fg/5 text-fg/70 ring-1 ring-fg/10 outline-none focus:ring-accent ${ease} ${compact ? 'px-2.5 py-1 text-xs' : 'px-3 py-1.5 text-sm'}`}
              >
                {SORTS.map(({ id, label }) => (
                  <option key={id} value={id}>{label}</option>
                ))}
              </select>
            </div>
          </div>
        )}
            {/* the column names stay with the header, so a long list still says what each column is */}
            {layout === 'list' && library.length > 0 && visible.length > 0 && (
              <div
                className={`${TRACK_ROW_GRID} text-xs uppercase tracking-wider text-fg/40 ${ease} ${
                  compact ? 'pb-0 pt-2' : 'border-b border-fg/10 pb-2'
                }`}
              >
                <span className="text-center">#</span><span>Title</span><span>Album</span><span className="text-right">Time</span><span />
              </div>
            )}
          </>
        )}
      </StickyHeader>

      {library.length === 0 ? (
        <EmptyLibrary />
      ) : visible.length === 0 ? (
        <p className="py-16 text-center text-sm text-fg/50">
          {query.trim() ? `No results for "${query.trim()}".` : `Nothing here yet. Add some ${filter === 'videos' ? 'videos' : 'music'} to see it.`}
        </p>
      ) : layout === 'grid' ? (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(10.5rem,1fr))] items-start gap-4">
          {visible.map((track) => (
            <TrackCard key={track.id} track={track} isCurrent={track.id === currentId} isPlaying={isPlaying} onPlay={() => handlePlay(track.id)} />
          ))}
        </div>
      ) : (
        <div>
          <div className="mt-2">
            {visible.map((track, i) => (
              <TrackRow key={track.id} track={track} index={i} isCurrent={track.id === currentId} isPlaying={isPlaying} onPlay={() => handlePlay(track.id)} />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

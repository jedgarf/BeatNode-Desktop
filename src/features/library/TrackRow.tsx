import { CoverArt } from '../../components/ui/CoverArt'
import { formatTime } from '../../shared/format'
import type { Track } from '../../shared/types'
import { TrackMenu } from '../playlists/TrackMenu'

export const TRACK_ROW_GRID = 'grid grid-cols-[2.5rem_minmax(0,2fr)_minmax(0,1fr)_3.5rem_2rem] items-center gap-4 px-3'

interface TrackRowProps {
  track: Track
  index: number
  isCurrent: boolean
  isPlaying: boolean
  onPlay: () => void
  playlistId?: string
}

export function TrackRow({ track, index, isCurrent, isPlaying, onPlay, playlistId }: TrackRowProps) {
  return (
    <div
      onDoubleClick={onPlay}
      className={`group ${TRACK_ROW_GRID} rounded-xl py-2 transition hover:bg-fg/[0.06] ${isCurrent ? 'bg-fg/[0.05]' : ''}`}
    >
      <div className="flex justify-center text-sm tabular-nums text-fg/40">
        <button
          type="button"
          onClick={onPlay}
          aria-label={isCurrent && isPlaying ? `Pause ${track.title}` : `Play ${track.title}`}
          className={`flex h-8 w-10 items-center justify-center rounded-full ${isCurrent ? 'text-accent-soft' : 'text-fg'}`}
        >
          <span className="group-hover:hidden">{index + 1}</span>
          <span className="hidden text-xs font-semibold group-hover:block">{isCurrent && isPlaying ? 'Pause' : 'Play'}</span>
        </button>
      </div>
      <div className="flex min-w-0 items-center gap-3">
        <CoverArt track={track} className="size-10 shrink-0 rounded-md" />
        <div className="min-w-0">
          <p className={`flex items-center gap-1.5 text-sm font-medium ${isCurrent ? 'text-accent-soft' : 'text-fg'}`}>
            <span className="truncate">{track.title}</span>
          </p>
          <p className="truncate text-xs text-fg/50">{track.artist}</p>
        </div>
      </div>
      <p className="truncate text-sm text-fg/50">{track.album}</p>
      <p className="text-right text-sm tabular-nums text-fg/50">{formatTime(track.duration)}</p>
      <TrackMenu track={track} playlistId={playlistId} className="opacity-0 transition focus-within:opacity-100 group-hover:opacity-100" />
    </div>
  )
}

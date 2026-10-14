import { CoverArt } from '../../components/ui/CoverArt'
import { PauseIcon, PlayIcon } from '../../components/ui/icons'
import type { Track } from '../../shared/types'
import { TrackMenu } from '../playlists/TrackMenu'

interface TrackItemProps {
  track: Track
  isCurrent: boolean
  isPlaying: boolean
  onPlay: () => void
}

export function TrackCard({ track, isCurrent, isPlaying, onPlay }: TrackItemProps) {
  return (
    <div className="group rounded-2xl bg-fg/[0.03] p-3 ring-1 ring-fg/5 transition hover:-translate-y-0.5 hover:bg-fg/[0.07] hover:ring-fg/10">
      <div className="relative overflow-hidden rounded-xl shadow-lg shadow-black/40">
        <CoverArt track={track} aspect={track.kind === 'video' ? 'video' : 'square'} className="w-full" />
        {track.kind === 'video' && (
          <span className="absolute left-2 top-2 rounded-md bg-black/60 px-1.5 py-0.5 text-[10px] font-semibold tracking-wider text-white">VIDEO</span>
        )}
        <button
          type="button"
          onClick={onPlay}
          aria-label={isCurrent && isPlaying ? `Pause ${track.title}` : `Play ${track.title}`}
          className={`absolute bottom-2 right-2 flex size-10 items-center justify-center rounded-full bg-accent text-white shadow-lg shadow-accent-glow transition duration-200 hover:bg-accent-soft ${isCurrent ? 'translate-y-0 opacity-100' : 'translate-y-2 opacity-0 group-hover:translate-y-0 group-hover:opacity-100 focus-visible:translate-y-0 focus-visible:opacity-100'}`}
        >
          {isCurrent && isPlaying ? <PauseIcon size={20} /> : <PlayIcon size={20} className="translate-x-px" />}
        </button>
      </div>
      <div className="mt-3 flex items-start justify-between gap-1">
        <div className="min-w-0">
          <p className={`truncate text-sm font-semibold ${isCurrent ? 'text-accent-soft' : 'text-fg'}`} title={track.title}>
            {track.title}
          </p>
          <p className="truncate text-xs text-fg/50" title={track.artist}>{track.artist}</p>
        </div>
        <TrackMenu track={track} className="-mr-1 -mt-0.5 shrink-0 opacity-0 transition focus-within:opacity-100 group-hover:opacity-100" />
      </div>
    </div>
  )
}

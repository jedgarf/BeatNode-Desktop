import type { ReactNode } from 'react'
import { CoverArt } from '../ui/CoverArt'
import { Equalizer } from '../ui/Equalizer'
import { Slider } from '../ui/Slider'
import { ChevronDownIcon, ChevronUpIcon, NextIcon, PauseIcon, PlayIcon, PrevIcon, RepeatIcon, RepeatOneIcon, ShuffleIcon, VolumeLevelIcon } from '../ui/icons'
import { formatTime } from '../../shared/format'
import { useNowPlayingStore } from '../../features/player/nowPlayingStore'
import { selectCurrentTrack, usePlayerStore } from '../../features/player/store'

interface ToggleButtonProps {
  active: boolean
  label: string
  onClick: () => void
  children: ReactNode
}

function ToggleButton({ active, label, onClick, children }: ToggleButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      aria-pressed={active}
      title={label}
      className={`relative rounded-full p-2 transition ${active ? 'text-accent-soft' : 'text-fg/50 hover:text-fg'}`}
    >
      {children}
      <span className={`absolute bottom-0.5 left-1/2 size-1 -translate-x-1/2 rounded-full bg-accent-soft transition-opacity ${active ? 'opacity-100' : 'opacity-0'}`} />
    </button>
  )
}

export function PlayerBar() {
  const track = usePlayerStore(selectCurrentTrack)
  const isPlaying = usePlayerStore((s) => s.isPlaying)
  const isBuffering = usePlayerStore((s) => s.isBuffering)
  const currentTime = usePlayerStore((s) => s.currentTime)
  const duration = usePlayerStore((s) => s.duration)
  const volume = usePlayerStore((s) => s.volume)
  const muted = usePlayerStore((s) => s.muted)
  const repeat = usePlayerStore((s) => s.repeat)
  const shuffle = usePlayerStore((s) => s.shuffle)
  const nowPlayingOpen = useNowPlayingStore((s) => s.open)
  const toggleNowPlaying = useNowPlayingStore((s) => s.toggle)
  const hasLibrary = usePlayerStore((s) => s.library.length > 0)
  const { togglePlay, next, previous, seek, setVolume, toggleMute, cycleRepeat, toggleShuffle } = usePlayerStore.getState()

  const canControl = track !== null || hasLibrary
  const effectiveVolume = muted ? 0 : volume

  return (
    <footer className="grid h-24 shrink-0 grid-cols-[minmax(0,1fr)_minmax(0,2fr)_minmax(0,1fr)] items-center gap-4 border-t border-fg/10 bg-surface/70 px-5 backdrop-blur-2xl">
      {/* Now playing */}
      <div className="flex min-w-0 items-center gap-3">
        <button
          type="button"
          onClick={toggleNowPlaying}
          aria-label={nowPlayingOpen ? 'Close now playing' : 'Open now playing'}
          className="relative shrink-0 rounded-lg transition hover:scale-105"
        >
          <CoverArt key={track?.id} track={track} className="size-14 animate-fade-up rounded-lg object-cover shadow-lg shadow-black/50" />
          {track && (
            <span className={`absolute inset-0 flex items-center justify-center rounded-lg bg-black/45 text-white transition-opacity duration-300 ${isPlaying ? 'opacity-100' : 'opacity-0'}`}>
              <Equalizer playing={isPlaying} className="h-4" />
            </span>
          )}
        </button>
        {track ? (
          <div key={track.id} className="min-w-0 animate-fade-up">
            <p className="truncate text-sm font-semibold" title={track.title}>{track.title}</p>
            <p className="truncate text-xs text-fg/50" title={track.artist}>{track.artist}</p>
          </div>
        ) : (
          <p className="text-sm text-fg/40">Nothing playing</p>
        )}
      </div>

      {/* Transport + progress */}
      <div className="flex flex-col items-center gap-1">
        <div className="flex items-center gap-2">
          <ToggleButton active={shuffle} label="Shuffle" onClick={toggleShuffle}><ShuffleIcon size={18} /></ToggleButton>
          <button type="button" onClick={previous} disabled={!track} aria-label="Previous" className="rounded-full p-2 text-fg/80 transition hover:text-fg disabled:opacity-30">
            <PrevIcon size={22} />
          </button>
          <button
            type="button"
            onClick={togglePlay}
            disabled={!canControl}
            aria-label={isPlaying ? 'Pause' : 'Play'}
            className="flex size-11 items-center justify-center rounded-full bg-fg text-base shadow-[0_0_24px_var(--c-glow)] transition hover:scale-105 active:scale-95 disabled:opacity-40 disabled:hover:scale-100"
          >
            {isBuffering && isPlaying
              ? <span className="size-5 animate-spin rounded-full border-2 border-black/20 border-t-black" />
              : isPlaying ? <PauseIcon size={22} /> : <PlayIcon size={22} className="translate-x-px" />}
          </button>
          <button type="button" onClick={() => next()} disabled={!track} aria-label="Next" className="rounded-full p-2 text-fg/80 transition hover:text-fg disabled:opacity-30">
            <NextIcon size={22} />
          </button>
          <ToggleButton active={repeat !== 'off'} label={`Repeat: ${repeat}`} onClick={cycleRepeat}>
            {repeat === 'one' ? <RepeatOneIcon size={18} /> : <RepeatIcon size={18} />}
          </ToggleButton>
        </div>
        <div className="flex w-full max-w-xl items-center gap-3 text-xs tabular-nums text-fg/50">
          <span className="w-10 text-right">{formatTime(currentTime)}</span>
          <Slider
            className="flex-1"
            label="Seek"
            value={currentTime}
            max={duration || 1}
            step={5}
            disabled={!track}
            valueText={`${formatTime(currentTime)} of ${formatTime(duration)}`}
            onCommit={seek}
          />
          <span className="w-10">{formatTime(duration)}</span>
        </div>
      </div>

      {/* Volume */}
      <div className="flex items-center justify-end gap-2">
        <button
          type="button"
          onClick={toggleNowPlaying}
          aria-label="Now playing"
          aria-pressed={nowPlayingOpen}
          title="Now playing"
          className={`rounded-full p-2 transition ${nowPlayingOpen ? 'text-accent-soft' : 'text-fg/60 hover:text-fg'}`}
        >
          {nowPlayingOpen ? <ChevronDownIcon size={18} /> : <ChevronUpIcon size={18} />}
        </button>
        <button
          type="button"
          onClick={toggleMute}
          aria-label={muted ? 'Unmute' : 'Mute'}
          title={muted ? 'Unmute (M)' : 'Mute (M)'}
          className="rounded-full p-2 text-fg/60 transition hover:text-fg"
        >
          <VolumeLevelIcon volume={volume} muted={muted} size={18} />
        </button>
        <Slider
          className="w-28"
          label="Volume"
          value={effectiveVolume}
          max={1}
          step={0.05}
          valueText={`${Math.round(effectiveVolume * 100)}%`}
          onChange={setVolume}
          onCommit={setVolume}
        />
      </div>
    </footer>
  )
}

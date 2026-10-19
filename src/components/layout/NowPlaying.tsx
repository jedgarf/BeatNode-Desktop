import { useCallback, useEffect, useRef, useState } from 'react'
import { formatTime } from '../../shared/format'
import { mediaElement } from '../../features/player/mediaElement'
import { useNowPlayingStore } from '../../features/player/nowPlayingStore'
import { selectCurrentTrack, usePlayerStore } from '../../features/player/store'
import { CoverArt } from '../ui/CoverArt'
import { ChevronDownIcon, ExitFullscreenIcon, FullscreenIcon, LyricsIcon, MicIcon, NextIcon, PauseIcon, PlayIcon, PrevIcon, VolumeLevelIcon } from '../ui/icons'
import { Equalizer } from '../ui/Equalizer'
import { Slider } from '../ui/Slider'
import { LyricsLoading, LyricsPane } from './LyricsPane'
import { useKaraokeStore } from '../../features/player/karaoke'
import { useLyrics } from '../../features/player/useLyrics'
import { useUiStore } from '../../features/settings/uiStore'
import type { Track } from '../../shared/types'

const CONTROLS_HIDE_MS = 2500

export function NowPlaying() {
  const open = useNowPlayingStore((s) => s.open)
  const [mounted, setMounted] = useState(open)
  useEffect(() => {
    if (open) setMounted(true)
  }, [open])
  if (!mounted) return null
  return <NowPlayingPanel closing={!open} onClosed={() => setMounted(false)} />
}

function NowPlayingPanel({ closing, onClosed }: { closing: boolean; onClosed: () => void }) {
  const track = usePlayerStore(selectCurrentTrack)
  const isPlaying = usePlayerStore((s) => s.isPlaying)
  const currentTime = usePlayerStore((s) => s.currentTime)
  const duration = usePlayerStore((s) => s.duration)
  const muted = usePlayerStore((s) => s.muted)
  const volume = usePlayerStore((s) => s.volume)
  const { togglePlay, next, previous, seek, toggleMute } = usePlayerStore.getState()
  const close = useNowPlayingStore((s) => s.setOpen)

  const stageRef = useRef<HTMLDivElement>(null)
  const hostRef = useRef<HTMLDivElement>(null)
  const hideTimer = useRef<number | undefined>(undefined)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [controlsVisible, setControlsVisible] = useState(true)

  const isVideo = track?.kind === 'video'
  const { lyrics, loading: lyricsLoading } = useLyrics(isVideo ? null : track)
  const lyricsOn = useUiStore((s) => s.showLyrics)
  const toggleLyrics = useUiStore((s) => s.toggleLyrics)
  const showLyrics = (lyrics !== null || lyricsLoading) && lyricsOn
  const karaoke = useKaraokeStore((s) => s.enabled)
  const toggleKaraoke = useKaraokeStore((s) => s.toggle)

  // put the shared element in the page while a video is showing
  useEffect(() => {
    const host = hostRef.current
    if (!host || !isVideo) return
    mediaElement.className = 'h-full w-full bg-black object-contain'
    host.appendChild(mediaElement)
    return () => {
      if (mediaElement.parentElement === host) host.removeChild(mediaElement)
    }
  }, [isVideo])

  const toggleFullscreen = useCallback(() => {
    if (document.fullscreenElement) void document.exitFullscreen()
    else void stageRef.current?.requestFullscreen()
  }, [])

  useEffect(() => {
    const stage = stageRef.current
    const onChange = () => setIsFullscreen(document.fullscreenElement === stage)
    document.addEventListener('fullscreenchange', onChange)
    return () => {
      document.removeEventListener('fullscreenchange', onChange)
      if (document.fullscreenElement === stage) void document.exitFullscreen()
    }
  }, [])

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.metaKey || event.ctrlKey || event.altKey) return
      if (event.code === 'KeyF' && isVideo) {
        event.preventDefault()
        toggleFullscreen()
      } else if (event.code === 'Escape' && !document.fullscreenElement) {
        close(false)
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [close, isVideo, toggleFullscreen])

  const revealControls = useCallback(() => {
    setControlsVisible(true)
    window.clearTimeout(hideTimer.current)
    hideTimer.current = window.setTimeout(() => setControlsVisible(false), CONTROLS_HIDE_MS)
  }, [])

  useEffect(() => () => window.clearTimeout(hideTimer.current), [])

  const showFullscreenControls = isFullscreen && (controlsVisible || !isPlaying)

  return (
    <div
      onAnimationEnd={(event) => {
        if (closing && event.target === event.currentTarget) onClosed()
      }}
      className={`absolute inset-0 z-20 flex flex-col overflow-hidden bg-base/95 backdrop-blur-2xl ${closing ? 'animate-panel-out' : 'animate-panel-in'}`}
    >
      {!isVideo && track && (
        <div aria-hidden="true" className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <CoverArt key={track.id} track={track} className="w-[70%] max-w-3xl animate-breathe rounded-full blur-[120px] saturate-150" />
        </div>
      )}
      {/* the window drag strip underneath swallows clicks, so buttons here opt out */}
      <header className="relative flex items-center gap-3 px-6 pb-2 pt-3">
        <button
          type="button"
          onClick={() => close(false)}
          aria-label="Close now playing"
          title="Close (Esc)"
          className="no-drag rounded-full p-2 text-fg/70 transition hover:bg-fg/10 hover:text-fg"
        >
          <ChevronDownIcon size={20} />
        </button>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold" title={track?.title}>{track?.title ?? 'Nothing playing'}</p>
          {track && <p className="truncate text-xs text-fg/50" title={track.artist}>{track.artist}</p>}
        </div>
        {track && (
          <button
            type="button"
            onClick={toggleKaraoke}
            aria-label="Karaoke"
            aria-pressed={karaoke}
            title={karaoke ? 'Karaoke on: lead vocals removed. Click to bring them back' : 'Karaoke: remove the lead vocals'}
            className={`no-drag flex items-center gap-1.5 rounded-full px-2.5 py-2 text-xs font-semibold transition hover:bg-fg/10 ${karaoke ? 'bg-accent/15 text-accent-soft' : 'text-fg/70 hover:text-fg'}`}
          >
            <MicIcon size={18} />
            {karaoke && <span>Karaoke</span>}
          </button>
        )}
        {(lyrics || lyricsLoading) && (
          <button
            type="button"
            onClick={toggleLyrics}
            aria-label={lyricsOn ? 'Hide lyrics' : 'Show lyrics'}
            aria-pressed={lyricsOn}
            title={lyricsOn ? 'Hide lyrics' : 'Show lyrics'}
            className={`no-drag rounded-full p-2 transition hover:bg-fg/10 ${lyricsOn ? 'text-accent-soft' : 'text-fg/70 hover:text-fg'}`}
          >
            <LyricsIcon size={20} />
          </button>
        )}
        {isVideo && (
          <button
            type="button"
            onClick={toggleFullscreen}
            aria-label="Fullscreen"
            title="Fullscreen (F)"
            className="no-drag rounded-full p-2 text-fg/70 transition hover:bg-fg/10 hover:text-fg"
          >
            <FullscreenIcon size={20} />
          </button>
        )}
      </header>

      <div
        ref={stageRef}
        onMouseMove={isFullscreen ? revealControls : undefined}
        className={`relative min-h-0 flex-1 ${isFullscreen ? 'bg-black' : ''} ${isFullscreen && !showFullscreenControls && isPlaying ? 'cursor-none' : ''}`}
      >
        {isVideo ? (
          <div
            ref={hostRef}
            onClick={togglePlay}
            onDoubleClick={toggleFullscreen}
            className="absolute inset-0 cursor-pointer"
            aria-label="Video"
          />
        ) : (
          <div className={`flex h-full items-center justify-center p-8 ${showLyrics ? 'gap-10' : 'flex-col gap-10'}`}>
            <div className={`flex flex-col items-center gap-10 ${showLyrics ? 'w-[42%] shrink-0' : ''}`}>
              <Record track={track} spinning={isPlaying} />
              <div key={track?.id} className="animate-fade-up text-center">
                <h2 className="text-2xl font-bold tracking-tight">{track?.title ?? 'Nothing playing'}</h2>
                {track && <p className="mt-1 text-fg/60">{track.artist}</p>}
                {track && (
                  <div className="mt-4 flex justify-center text-accent-soft">
                    <Equalizer playing={isPlaying} className="h-4" />
                  </div>
                )}
              </div>
            </div>
            {showLyrics && track && (lyrics ? <LyricsPane key={track.id} lyrics={lyrics} trackId={track.id} /> : <LyricsLoading key={track.id} />)}
          </div>
        )}

        {isFullscreen && (
          <div
            className={`absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent px-8 pb-6 pt-16 text-white transition-opacity duration-300 ${showFullscreenControls ? 'opacity-100' : 'pointer-events-none opacity-0'}`}
          >
            <div className="mb-3 flex items-center gap-3 text-xs tabular-nums">
              <span className="w-12 text-right">{formatTime(currentTime)}</span>
              <Slider className="flex-1" label="Seek" value={currentTime} max={duration || 1} step={5} onCommit={seek} />
              <span className="w-12">{formatTime(duration)}</span>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <button type="button" onClick={previous} aria-label="Previous" title="Previous" className="rounded-full p-2 hover:bg-white/10"><PrevIcon size={24} /></button>
                <button type="button" onClick={togglePlay} aria-label={isPlaying ? 'Pause' : 'Play'} title={isPlaying ? 'Pause' : 'Play'} className="rounded-full p-2 hover:bg-white/10">
                  {isPlaying ? <PauseIcon size={28} /> : <PlayIcon size={28} />}
                </button>
                <button type="button" onClick={() => next()} aria-label="Next" title="Next" className="rounded-full p-2 hover:bg-white/10"><NextIcon size={24} /></button>
                <button type="button" onClick={toggleMute} aria-label={muted ? 'Unmute' : 'Mute'} title={muted ? 'Unmute (M)' : 'Mute (M)'} className="rounded-full p-2 hover:bg-white/10">
                  <VolumeLevelIcon volume={volume} muted={muted} size={24} />
                </button>
              </div>
              <button type="button" onClick={toggleFullscreen} aria-label="Exit fullscreen" title="Exit fullscreen (F)" className="rounded-full p-2 hover:bg-white/10">
                <ExitFullscreenIcon size={24} />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// sleeve on the left, the disc slides out and spins while playing
function Record({ track, spinning }: { track: Track | null; spinning: boolean }) {
  return (
    <div className="relative aspect-[1.45] w-[min(34rem,80%,52vh)]">
      <div
        className={`absolute inset-y-[4%] left-0 aspect-square transition-transform duration-700 ease-[cubic-bezier(0.22,1,0.36,1)] ${spinning ? 'translate-x-[43%]' : 'translate-x-[16%]'}`}
      >
        <div className="vinyl relative size-full rounded-full animate-vinyl" style={{ animationPlayState: spinning ? 'running' : 'paused' }}>
          <CoverArt track={track} className="absolute left-1/2 top-1/2 w-[34%] -translate-x-1/2 -translate-y-1/2 rounded-full" />
          <span className="absolute left-1/2 top-1/2 size-[3%] -translate-x-1/2 -translate-y-1/2 rounded-full bg-base" />
        </div>
        <div className="vinyl-sheen pointer-events-none absolute inset-0 rounded-full" />
      </div>
      <div key={track?.id} className="absolute inset-y-0 left-0 aspect-square animate-fade-up">
        <CoverArt track={track} className="size-full rounded-2xl shadow-2xl shadow-black/50 ring-1 ring-white/10" />
      </div>
    </div>
  )
}

import { useCallback, useEffect, useRef, useState } from 'react'
import { formatTime } from '../../shared/format'
import { mediaElement } from '../../features/player/mediaElement'
import { useNowPlayingStore } from '../../features/player/nowPlayingStore'
import { selectCurrentTrack, usePlayerStore } from '../../features/player/store'
import { CoverArt } from '../ui/CoverArt'
import { NextIcon, PauseIcon, PlayIcon, PrevIcon } from '../ui/icons'
import { Equalizer } from '../ui/Equalizer'
import { Slider } from '../ui/Slider'
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
  const { togglePlay, next, previous, seek, toggleMute } = usePlayerStore.getState()
  const close = useNowPlayingStore((s) => s.setOpen)

  const stageRef = useRef<HTMLDivElement>(null)
  const hostRef = useRef<HTMLDivElement>(null)
  const hideTimer = useRef<number | undefined>(undefined)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [controlsVisible, setControlsVisible] = useState(true)

  const isVideo = track?.kind === 'video'

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
          className="no-drag rounded-full px-3 py-1.5 text-sm text-fg/70 transition hover:bg-fg/10 hover:text-fg"
        >
          Close
        </button>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold">{track?.title ?? 'Nothing playing'}</p>
          {track && <p className="truncate text-xs text-fg/50">{track.artist}</p>}
        </div>
        {isVideo && (
          <button
            type="button"
            onClick={toggleFullscreen}
            aria-label="Fullscreen"
            title="Fullscreen (F)"
            className="no-drag rounded-full px-3 py-1.5 text-sm text-fg/70 transition hover:bg-fg/10 hover:text-fg"
          >
            Fullscreen
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
          <div className="flex h-full flex-col items-center justify-center gap-10 p-8">
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
                <button type="button" onClick={previous} aria-label="Previous" className="rounded-full p-2 hover:bg-white/10"><PrevIcon size={24} /></button>
                <button type="button" onClick={togglePlay} aria-label={isPlaying ? 'Pause' : 'Play'} className="rounded-full p-2 hover:bg-white/10">
                  {isPlaying ? <PauseIcon size={28} /> : <PlayIcon size={28} />}
                </button>
                <button type="button" onClick={() => next()} aria-label="Next" className="rounded-full p-2 hover:bg-white/10"><NextIcon size={24} /></button>
                <button type="button" onClick={toggleMute} aria-label={muted ? 'Unmute' : 'Mute'} className="rounded-full px-3 py-2 text-sm hover:bg-white/10">
                  {muted ? 'Unmute' : 'Mute'}
                </button>
              </div>
              <button type="button" onClick={toggleFullscreen} aria-label="Exit fullscreen" className="rounded-full px-3 py-2 text-sm hover:bg-white/10">
                Exit fullscreen
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
      <div key={track?.id} className="relative h-full animate-fade-up">
        <CoverArt track={track} className="h-full rounded-2xl shadow-2xl shadow-black/50 ring-1 ring-white/10" />
      </div>
    </div>
  )
}

import { useCallback, useEffect, useRef, useState } from 'react'
import { formatTime } from '../../shared/format'
import { mediaElement } from '../../features/player/mediaElement'
import { useNowPlayingStore } from '../../features/player/nowPlayingStore'
import { selectCurrentTrack, usePlayerStore } from '../../features/player/store'
import { CoverArt } from '../ui/CoverArt'
import { NextIcon, PauseIcon, PlayIcon, PrevIcon } from '../ui/icons'
import { Slider } from '../ui/Slider'

const CONTROLS_HIDE_MS = 2500

export function NowPlaying() {
  const open = useNowPlayingStore((s) => s.open)
  if (!open) return null
  return <NowPlayingPanel />
}

function NowPlayingPanel() {
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
    <div className="absolute inset-0 z-20 flex flex-col bg-base/95 backdrop-blur-2xl">
      <header className="flex items-center gap-3 px-6 pb-2 pt-3">
        <button
          type="button"
          onClick={() => close(false)}
          aria-label="Close now playing"
          className="rounded-full px-3 py-1.5 text-sm text-fg/70 transition hover:bg-fg/10 hover:text-fg"
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
            className="rounded-full px-3 py-1.5 text-sm text-fg/70 transition hover:bg-fg/10 hover:text-fg"
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
          <div className="flex h-full flex-col items-center justify-center gap-6 p-8">
            <CoverArt track={track} className="w-full max-w-sm rounded-3xl shadow-2xl shadow-black/50" />
            <div className="text-center">
              <h2 className="text-2xl font-bold tracking-tight">{track?.title ?? 'Nothing playing'}</h2>
              {track && <p className="mt-1 text-fg/60">{track.artist}</p>}
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

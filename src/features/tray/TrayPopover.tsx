import { useEffect, useState } from 'react'
import { NextIcon, PauseIcon, PlayIcon, PrevIcon } from '../../components/ui/icons'
import type { PlaybackReport } from '../../shared/types'
import { useTheme } from '../settings/theme'

const IDLE: PlaybackReport = { hasTrack: false, title: '', artist: '', isPlaying: false }

const textButton = 'rounded-full px-3 py-1 text-xs text-fg/60 transition hover:bg-fg/10 hover:text-fg'
const iconButton = 'flex items-center justify-center rounded-full text-fg/80 transition hover:bg-fg/10 hover:text-fg active:scale-95'

export function TrayPopover() {
  useTheme()
  const [state, setState] = useState<PlaybackReport>(IDLE)

  useEffect(() => {
    // the window itself is see-through, the card below draws the background
    document.documentElement.style.background = 'transparent'
    document.body.style.background = 'transparent'
    return window.beatnode.onTrayState(setState)
  }, [])

  const send = window.beatnode.sendTrayCommand

  return (
    <div className="flex h-full flex-col items-center justify-center gap-3 rounded-2xl bg-elevated px-5 text-fg ring-1 ring-fg/10">
      <div className="w-full min-w-0 text-center">
        <p className="truncate text-sm font-semibold">{state.hasTrack ? state.title : 'Nothing playing'}</p>
        <p className="truncate text-xs text-fg/50">{state.hasTrack ? state.artist : 'BeatNode'}</p>
      </div>
      <div className="flex items-center justify-center gap-3">
        <button type="button" onClick={() => send('previous')} aria-label="Previous" title="Previous" className={`${iconButton} size-10`}>
          <PrevIcon size={22} />
        </button>
        <button
          type="button"
          onClick={() => send('toggle')}
          aria-label={state.isPlaying ? 'Pause' : 'Play'}
          title={state.isPlaying ? 'Pause' : 'Play'}
          className="flex size-12 items-center justify-center rounded-full bg-fg text-base transition hover:scale-105 active:scale-95"
        >
          {state.isPlaying ? <PauseIcon size={22} /> : <PlayIcon size={22} className="translate-x-px" />}
        </button>
        <button type="button" onClick={() => send('next')} aria-label="Next" title="Next" className={`${iconButton} size-10`}>
          <NextIcon size={22} />
        </button>
      </div>
      <div className="flex items-center justify-center gap-1">
        <button type="button" onClick={() => send('show')} className={textButton}>Show BeatNode</button>
        <button type="button" onClick={() => send('quit')} className={textButton}>Quit</button>
      </div>
    </div>
  )
}

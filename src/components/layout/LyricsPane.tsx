import { useEffect, useRef, useState } from 'react'
import { mediaElement } from '../../features/player/mediaElement'
import { OFFSET_STEP, useLyricsOffset } from '../../features/player/lyricsOffset'
import { usePlayerStore } from '../../features/player/store'
import type { LyricsResult } from '../../shared/types'

// a hair early so the line is already lit when the singer reaches it
const LEAD_SECONDS = 0.15

function activeIndex(times: number[], now: number): number {
  let low = 0
  let high = times.length - 1
  let found = -1
  while (low <= high) {
    const mid = (low + high) >> 1
    if (times[mid] <= now) {
      found = mid
      low = mid + 1
    } else {
      high = mid - 1
    }
  }
  return found
}

// line lengths of a made-up verse, so the placeholder reads like lyrics rather than a table
const SKELETON_WIDTHS = ['78%', '62%', '86%', '54%', '0', '70%', '82%', '58%']

// shown while a lookup takes a while, usually the online catalog on a first play
export function LyricsLoading() {
  return (
    <div className="flex h-full w-full max-w-xl animate-fade-up flex-col justify-center px-4" role="status" aria-live="polite">
      <p className="mb-6 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-fg/45">
        <span className="flex h-3 items-end gap-0.5 text-accent-soft" aria-hidden>
          {[0, 1, 2].map((i) => (
            <span key={i} className="w-0.5 origin-bottom animate-eq rounded-full bg-current" style={{ height: '100%', animationDelay: `${i * 0.18}s` }} />
          ))}
        </span>
        Finding lyrics&hellip;
      </p>
      <div className="space-y-4" aria-hidden>
        {SKELETON_WIDTHS.map((width, i) =>
          width === '0' ? (
            <div key={i} className="h-3" />
          ) : (
            <div
              key={i}
              className="h-6 animate-shimmer rounded-lg bg-[linear-gradient(90deg,color-mix(in_oklab,var(--c-fg)_7%,transparent)_25%,color-mix(in_oklab,var(--c-fg)_16%,transparent)_50%,color-mix(in_oklab,var(--c-fg)_7%,transparent)_75%)] bg-[length:200%_100%]"
              style={{ width, animationDelay: `${i * 0.08}s` }}
            />
          ),
        )}
      </div>
    </div>
  )
}

function signed(seconds: number): string {
  return `${seconds > 0 ? '+' : ''}${seconds.toFixed(1)}s`
}

// nudges the timing when the words were synced to a slightly different cut of the song
function OffsetControl({ trackId }: { trackId: string }) {
  const offset = useLyricsOffset((s) => s.offsets[trackId] ?? 0)
  const nudge = useLyricsOffset((s) => s.nudge)
  const reset = useLyricsOffset((s) => s.reset)
  const button = 'grid h-7 w-7 place-items-center rounded-full text-[15px] leading-none transition hover:bg-fg/10 hover:text-fg'
  return (
    <div className="absolute bottom-3 right-4 flex items-center gap-0.5 rounded-full bg-base/70 p-0.5 text-xs text-fg/70 shadow-sm ring-1 ring-fg/10 backdrop-blur">
      <button type="button" onClick={() => nudge(trackId, -OFFSET_STEP)} className={button} title="Lyrics are late, show them sooner" aria-label="Show lyrics sooner">
        &minus;
      </button>
      <button
        type="button"
        onClick={() => reset(trackId)}
        disabled={offset === 0}
        className={`min-w-12 rounded-full px-1.5 py-1 tabular-nums transition enabled:hover:bg-fg/10 enabled:hover:text-fg ${offset ? 'text-accent-soft' : ''}`}
        title={offset ? 'Reset lyrics timing' : 'Lyrics timing'}
      >
        {offset ? signed(offset) : 'Sync'}
      </button>
      <button type="button" onClick={() => nudge(trackId, OFFSET_STEP)} className={button} title="Lyrics are early, show them later" aria-label="Show lyrics later">
        +
      </button>
    </div>
  )
}

export function LyricsPane({ lyrics, trackId }: { lyrics: LyricsResult; trackId: string }) {
  const lines = lyrics.lines
  const [active, setActive] = useState(-1)
  const scroller = useRef<HTMLDivElement>(null)
  const refs = useRef<Array<HTMLButtonElement | null>>([])
  const seek = usePlayerStore((s) => s.seek)
  const offset = useLyricsOffset((s) => s.offsets[trackId] ?? 0)

  useEffect(() => {
    if (!lines) return
    const times = lines.map((l) => l.time)
    let frame = 0
    const tick = () => {
      const next = activeIndex(times, mediaElement.currentTime + LEAD_SECONDS - offset)
      setActive((prev) => (prev === next ? prev : next))
      frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [lines, offset])

  useEffect(() => {
    const box = scroller.current
    const line = refs.current[active]
    if (!box || !line) return
    box.scrollTo({ top: line.offsetTop - box.clientHeight / 2 + line.clientHeight / 2, behavior: 'smooth' })
  }, [active])

  const hidden = '[scrollbar-width:none] [&::-webkit-scrollbar]:hidden'
  const fade = '[mask-image:linear-gradient(to_bottom,transparent,black_16%,black_84%,transparent)]'

  if (!lines) {
    return (
      <div className={`h-full w-full max-w-xl animate-fade-up overflow-y-auto px-4 py-10 ${hidden} ${fade}`}>
        <p className="mb-4 text-xs font-semibold uppercase tracking-wider text-fg/40">Lyrics without timing</p>
        <p className="whitespace-pre-wrap text-lg font-medium leading-9 text-fg/75">{lyrics.plain}</p>
      </div>
    )
  }

  return (
    <div className="relative h-full w-full max-w-xl animate-fade-up">
      <div ref={scroller} className={`relative h-full w-full overflow-y-auto px-4 ${hidden} ${fade}`}>
        <div className="h-[42%]" />
        {lines.map((line, i) => {
          const distance = Math.abs(i - active)
          const tone = i === active ? 'scale-100 text-fg' : distance === 1 ? 'scale-[0.96] text-fg/55' : 'scale-[0.94] text-fg/30'
          return (
            <button
              key={`${line.time}-${i}`}
              ref={(el) => {
                refs.current[i] = el
              }}
              type="button"
              onClick={() => seek(Math.max(0, line.time + offset))}
              title="Jump to this line"
              className={`block w-full origin-left py-2 text-left text-2xl font-bold leading-snug transition-all duration-500 ease-out hover:text-fg/80 ${tone}`}
            >
              {line.text || '\u266a'}
            </button>
          )
        })}
        <div className="h-[42%]" />
      </div>
      <OffsetControl trackId={trackId} />
    </div>
  )
}

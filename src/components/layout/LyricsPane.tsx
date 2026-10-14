import { useEffect, useRef, useState } from 'react'
import { mediaElement } from '../../features/player/mediaElement'
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

export function LyricsPane({ lyrics }: { lyrics: LyricsResult }) {
  const lines = lyrics.lines
  const [active, setActive] = useState(-1)
  const scroller = useRef<HTMLDivElement>(null)
  const refs = useRef<Array<HTMLButtonElement | null>>([])
  const seek = usePlayerStore((s) => s.seek)

  useEffect(() => {
    if (!lines) return
    const times = lines.map((l) => l.time)
    let frame = 0
    const tick = () => {
      const next = activeIndex(times, mediaElement.currentTime + LEAD_SECONDS)
      setActive((prev) => (prev === next ? prev : next))
      frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [lines])

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
        <p className="whitespace-pre-wrap text-lg font-medium leading-9 text-fg/75">{lyrics.plain}</p>
      </div>
    )
  }

  return (
    <div ref={scroller} className={`relative h-full w-full max-w-xl animate-fade-up overflow-y-auto px-4 ${hidden} ${fade}`}>
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
            onClick={() => seek(line.time)}
            title="Jump to this line"
            className={`block w-full origin-left py-2 text-left text-2xl font-bold leading-snug transition-all duration-500 ease-out hover:text-fg/80 ${tone}`}
          >
            {line.text || '\u266a'}
          </button>
        )
      })}
      <div className="h-[42%]" />
    </div>
  )
}

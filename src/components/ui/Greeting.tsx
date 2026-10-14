import { useEffect, useRef, useState, type ReactNode } from 'react'
import { TitleTile } from './PageTitle'

type Period = 'night' | 'morning' | 'afternoon' | 'evening'

const stroke = { fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round' } as const
const centered = { transformOrigin: '12px 12px' }

function Svg({ children }: { children: ReactNode }) {
  return (
    <svg width={26} height={26} viewBox="0 0 24 24" aria-hidden="true" {...stroke}>
      {children}
    </svg>
  )
}

function Moon() {
  return (
    <Svg>
      <path d="M20 14.5A8.5 8.5 0 1 1 9.5 4a6.7 6.7 0 0 0 10.5 10.5Z" />
      <path d="M17 3v3M15.5 4.5h3" className="animate-twinkle" />
      <path d="M21 8.5v2M20 9.5h2" className="animate-twinkle [animation-delay:-1.3s]" />
    </Svg>
  )
}

function Sunrise() {
  return (
    <Svg>
      <path d="M17 18a5 5 0 0 0-10 0" />
      <path d="M2 18h20" />
      <g className="animate-glow">
        <path d="M12 3v3M4.9 8.9l1.6 1.6M19.1 8.9l-1.6 1.6M1.5 14H4M20 14h2.5" />
      </g>
    </Svg>
  )
}

function Sun() {
  return (
    <Svg>
      <circle cx="12" cy="12" r="4" />
      <g className="animate-sun-spin" style={centered}>
        <path d="M12 2v2.5M12 19.5V22M4.9 4.9l1.8 1.8M17.3 17.3l1.8 1.8M2 12h2.5M19.5 12H22M4.9 19.1l1.8-1.8M17.3 6.7l1.8-1.8" />
      </g>
    </Svg>
  )
}

function Sunset() {
  return (
    <Svg>
      <path d="M17 18a5 5 0 0 0-10 0" />
      <path d="M2 18h20" />
      <g className="animate-bob">
        <path d="M12 3v6M9 6.5l3 3 3-3" />
      </g>
      <path d="M4.9 11.9l1.6 1.6M19.1 11.9l-1.6 1.6M1.5 18H4M20 18h2.5" className="animate-glow" />
    </Svg>
  )
}

const PERIODS: Record<Period, { text: string; icon: ReactNode }> = {
  night: { text: 'Good night', icon: <Moon /> },
  morning: { text: 'Good morning', icon: <Sunrise /> },
  afternoon: { text: 'Good afternoon', icon: <Sun /> },
  evening: { text: 'Good evening', icon: <Sunset /> },
}

function periodFor(date: Date): Period {
  const hour = date.getHours()
  return hour < 5 ? 'night' : hour < 12 ? 'morning' : hour < 18 ? 'afternoon' : 'evening'
}

const CHECK_EVERY_MS = 20_000
const FADE_MS = 500

// follows the clock, and crossfades when the time of day rolls over
export function Greeting({ className = '' }: { className?: string }) {
  const [period, setPeriod] = useState<Period>(() => periodFor(new Date()))
  const [leaving, setLeaving] = useState<Period | null>(null)
  const [changed, setChanged] = useState(false)
  const current = useRef(period)

  useEffect(() => {
    let fadeTimer: number | undefined
    const check = () => {
      const next = periodFor(new Date())
      if (next === current.current) return
      setLeaving(current.current)
      current.current = next
      setChanged(true)
      setPeriod(next)
      window.clearTimeout(fadeTimer)
      fadeTimer = window.setTimeout(() => setLeaving(null), FADE_MS)
    }
    const interval = window.setInterval(check, CHECK_EVERY_MS)
    // a laptop that slept through the night should be right the moment it wakes
    document.addEventListener('visibilitychange', check)
    return () => {
      window.clearInterval(interval)
      window.clearTimeout(fadeTimer)
      document.removeEventListener('visibilitychange', check)
    }
  }, [])

  const shown: Period[] = leaving && leaving !== period ? [leaving, period] : [period]

  return (
    <h1 className={`grid text-3xl font-bold tracking-tight ${className}`}>
      {shown.map((p) => {
        const isLeaving = p === leaving && p !== period
        return (
          <span
            key={p}
            aria-hidden={isLeaving || undefined}
            className={`col-start-1 row-start-1 flex items-center gap-3.5 ${isLeaving ? 'animate-greet-out' : changed ? 'animate-greet-in' : ''}`}
          >
            <TitleTile>{PERIODS[p].icon}</TitleTile>
            {PERIODS[p].text}
          </span>
        )
      })}
    </h1>
  )
}

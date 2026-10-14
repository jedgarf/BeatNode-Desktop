import { useEffect, useRef, useState, type ReactNode } from 'react'

type Period = 'night' | 'morning' | 'afternoon' | 'evening'

const ownBox = '[transform-box:fill-box] origin-center'
const centered = { transformOrigin: '24px 24px' }

function Svg({ children, glow }: { children: ReactNode; glow: string }) {
  return (
    <svg width={52} height={52} viewBox="0 0 48 48" aria-hidden="true" style={{ overflow: 'visible', filter: `drop-shadow(0 0 7px ${glow})` }}>
      {children}
    </svg>
  )
}

function Linear({ id, from, to }: { id: string; from: string; to: string }) {
  return (
    <linearGradient id={id} x1="0.1" y1="0" x2="0.9" y2="1">
      <stop offset="0" stopColor={from} />
      <stop offset="1" stopColor={to} />
    </linearGradient>
  )
}

function Radial({ id, color }: { id: string; color: string }) {
  return (
    <radialGradient id={id}>
      <stop offset="0" stopColor={color} stopOpacity="0.55" />
      <stop offset="1" stopColor={color} stopOpacity="0" />
    </radialGradient>
  )
}

const SPARKLE = 'M0 -4 1.1 -1.1 4 0 1.1 1.1 0 4 -1.1 1.1 -4 0 -1.1 -1.1Z'

function Star({ x, y, size, color, delay }: { x: number; y: number; size: number; color: string; delay: string }) {
  return (
    <path
      d={SPARKLE}
      transform={`translate(${x} ${y}) scale(${size})`}
      fill={color}
      className={`animate-spark ${ownBox}`}
      style={{ animationDelay: delay }}
    />
  )
}

function Moon() {
  return (
    <Svg glow="rgba(253,224,71,0.55)">
      <defs>
        <Linear id="gMoon" from="#fffbeb" to="#fbbf24" />
        <Radial id="rMoon" color="#fde68a" />
      </defs>
      <circle cx="22" cy="27" r="19" fill="url(#rMoon)" className={`animate-halo ${ownBox}`} />
      <g className="animate-rock" style={centered}>
        <g transform="translate(5 8) scale(1.62)">
          <path d="M20 14.5A8.5 8.5 0 1 1 9.5 4a6.7 6.7 0 0 0 10.5 10.5Z" fill="url(#gMoon)" />
          <circle cx="8.6" cy="11.2" r="1.1" fill="#f59e0b" opacity="0.28" />
          <circle cx="12.6" cy="16" r="1.5" fill="#f59e0b" opacity="0.22" />
          <circle cx="6.8" cy="15.4" r="0.8" fill="#f59e0b" opacity="0.25" />
        </g>
      </g>
      <Star x={38} y={9} size={1.1} color="#fde68a" delay="0s" />
      <Star x={43} y={24} size={0.7} color="#ffffff" delay="-0.7s" />
      <Star x={29} y={5} size={0.6} color="#ffffff" delay="-1.2s" />
      <Star x={10} y={8} size={0.55} color="#fef3c7" delay="-0.3s" />
      <g className="animate-shoot">
        <path d="M44 6 36 13" stroke="#fff" strokeWidth="1.6" strokeLinecap="round" opacity="0.9" />
      </g>
    </Svg>
  )
}

function Sunrise() {
  const rays = [-62, -38, -14, 14, 38, 62]
  return (
    <Svg glow="rgba(251,146,60,0.6)">
      <defs>
        <Linear id="gRise" from="#fef08a" to="#f97316" />
        <Radial id="rRise" color="#fb923c" />
        <clipPath id="cRise">
          <rect x="-4" y="-4" width="56" height="38" />
        </clipPath>
      </defs>
      <ellipse cx="24" cy="34" rx="22" ry="14" fill="url(#rRise)" className={`animate-halo ${ownBox}`} />
      <g clipPath="url(#cRise)">
        <circle cx="24" cy="34" r="11.5" fill="url(#gRise)" className="animate-rise" />
        <g stroke="#fbbf24" strokeWidth="2.4" strokeLinecap="round">
          {rays.map((angle, i) => (
            <path
              key={angle}
              d="M24 5.5v5"
              transform={`rotate(${angle} 24 34)`}
              className="animate-glow"
              style={{ animationDelay: `${-i * 0.45}s` }}
            />
          ))}
        </g>
      </g>
      <path d="M3 34.5h42" stroke="#fb923c" strokeWidth="2.4" strokeLinecap="round" />
      <path d="M11 40h26" stroke="#fdba74" strokeWidth="2" strokeLinecap="round" className="animate-twinkle" />
      <path d="M17 45h14" stroke="#fed7aa" strokeWidth="2" strokeLinecap="round" className="animate-twinkle [animation-delay:-1.2s]" />
    </Svg>
  )
}

function Sun() {
  const rays = Array.from({ length: 12 }, (_, i) => i * 30)
  return (
    <Svg glow="rgba(250,204,21,0.6)">
      <defs>
        <Linear id="gSun" from="#fef9c3" to="#f59e0b" />
        <Radial id="rSun" color="#fde047" />
      </defs>
      <circle cx="24" cy="24" r="23" fill="url(#rSun)" className={`animate-halo ${ownBox}`} />
      <g className="animate-sun-spin" style={centered} stroke="#fbbf24" strokeWidth="2.6" strokeLinecap="round">
        {rays.map((angle, i) => (
          <path key={angle} d={i % 2 === 0 ? 'M24 2.5v6.5' : 'M24 5v3.5'} transform={`rotate(${angle} 24 24)`} />
        ))}
      </g>
      <circle cx="24" cy="24" r="9.5" fill="url(#gSun)" className={`animate-sun-pulse ${ownBox}`} />
      <circle cx="20.5" cy="20.5" r="3" fill="#fff" opacity="0.45" />
    </Svg>
  )
}

function Sunset() {
  return (
    <Svg glow="rgba(244,63,94,0.5)">
      <defs>
        <Linear id="gSet" from="#fdba74" to="#e11d48" />
        <Radial id="rSet" color="#fb7185" />
        <clipPath id="cSet">
          <rect x="-4" y="-4" width="56" height="38" />
        </clipPath>
      </defs>
      <ellipse cx="24" cy="34" rx="22" ry="15" fill="url(#rSet)" className={`animate-halo ${ownBox}`} />
      <g clipPath="url(#cSet)">
        <circle cx="24" cy="34" r="11.5" fill="url(#gSet)" className="animate-set" />
      </g>
      <g className="animate-drift">
        <rect x="6" y="14" width="15" height="4.6" rx="2.3" fill="#fecdd3" opacity="0.7" />
        <rect x="10" y="10.4" width="9" height="4.6" rx="2.3" fill="#fecdd3" opacity="0.7" />
      </g>
      <g className="animate-drift [animation-delay:-4s]">
        <rect x="28" y="20" width="14" height="4.2" rx="2.1" fill="#fda4af" opacity="0.6" />
      </g>
      <path d="M3 34.5h42" stroke="#fb7185" strokeWidth="2.4" strokeLinecap="round" />
      <path d="M11 40h26" stroke="#fda4af" strokeWidth="2" strokeLinecap="round" className="animate-twinkle" />
      <path d="M17 45h14" stroke="#fecdd3" strokeWidth="2" strokeLinecap="round" className="animate-twinkle [animation-delay:-1.2s]" />
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
            className={`col-start-1 row-start-1 flex items-center gap-4 ${isLeaving ? 'animate-greet-out' : changed ? 'animate-greet-in' : ''}`}
          >
            {PERIODS[p].icon}
            {PERIODS[p].text}
          </span>
        )
      })}
    </h1>
  )
}

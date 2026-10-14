import { useId } from 'react'

export function LogoMark({ size = 28 }: { size?: number }) {
  const id = useId().replace(/:/g, '')
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden="true">
      <defs>
        <linearGradient id={`${id}bg`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#a78bfa" />
          <stop offset="0.45" stopColor="#7c3aed" />
          <stop offset="1" stopColor="#c026d3" />
        </linearGradient>
      </defs>
      <rect width="64" height="64" rx="15" fill={`url(#${id}bg)`} />
      <g transform="translate(-2 0) scale(1.06)" fill="#fff">
        <rect x="14" y="13" width="5" height="34" rx="2.5" />
        <rect x="21" y="17" width="5" height="26" rx="2.5" />
        <rect x="28" y="21" width="5" height="18" rx="2.5" />
        <rect x="35" y="25" width="5" height="10" rx="2.5" />
        <circle cx="44.5" cy="30" r="3.2" />
      </g>
    </svg>
  )
}

export function Logo() {
  return (
    <div className="flex items-center gap-2.5">
      <LogoMark />
      <span className="text-lg tracking-tight">
        <span className="font-bold">Beat</span>
        <span className="font-light text-fg/70">Node</span>
      </span>
    </div>
  )
}

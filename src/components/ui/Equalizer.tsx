const DELAYS = [0, -0.45, -0.2, -0.7]

export function Equalizer({ playing, className = '' }: { playing: boolean; className?: string }) {
  return (
    <span aria-hidden="true" className={`flex items-end gap-[2px] ${className}`}>
      {DELAYS.map((delay) => (
        <span
          key={delay}
          className={`h-full w-[3px] origin-bottom rounded-full bg-current transition-transform duration-300 ${playing ? 'animate-eq' : 'scale-y-[0.25]'}`}
          style={{ animationDelay: `${delay}s` }}
        />
      ))}
    </span>
  )
}

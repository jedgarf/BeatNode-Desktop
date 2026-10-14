import type { Track } from '../../shared/types'

// same id always gives the same colors, so tracks without art still look different
function gradientFor(id: string): string {
  let hash = 0
  for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) >>> 0
  const hue = hash % 360
  return `linear-gradient(135deg, hsl(${hue} 60% 38%), hsl(${(hue + 50) % 360} 65% 22%))`
}

interface CoverArtProps {
  track: (Pick<Track, 'id' | 'cover' | 'title'> & { kind?: Track['kind'] }) | null
  className?: string
  aspect?: 'square' | 'video'
}

export function CoverArt({ track, className = '', aspect = 'square' }: CoverArtProps) {
  const ratio = aspect === 'video' ? 'aspect-video' : 'aspect-square'
  if (track?.cover) {
    return <img src={track.cover} alt="" draggable={false} className={`${ratio} object-cover ${className}`} />
  }
  return (
    <div
      className={`flex ${ratio} items-center justify-center overflow-hidden text-lg font-semibold text-white/70 ${className}`}
      style={{ background: track ? gradientFor(track.id) : 'var(--c-elevated)' }}
    >
      {track?.title.trim().charAt(0).toUpperCase()}
    </div>
  )
}

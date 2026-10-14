import type { SVGProps } from 'react'

type IconProps = SVGProps<SVGSVGElement> & { size?: number }

function Icon({ size = 20, children, ...props }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" {...props}>
      {children}
    </svg>
  )
}

const stroke = { fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round' } as const

export const PlayIcon = (p: IconProps) => <Icon {...p}><path d="M8 5.14v13.72a1 1 0 0 0 1.52.85l11-6.86a1 1 0 0 0 0-1.7l-11-6.86A1 1 0 0 0 8 5.14Z" /></Icon>
export const PauseIcon = (p: IconProps) => <Icon {...p}><rect x="6" y="4.5" width="4.5" height="15" rx="1.2" /><rect x="13.5" y="4.5" width="4.5" height="15" rx="1.2" /></Icon>
export const NextIcon = (p: IconProps) => <Icon {...p}><path d="M6 6.2v11.6a.8.8 0 0 0 1.25.66l8.5-5.8a.8.8 0 0 0 0-1.32l-8.5-5.8A.8.8 0 0 0 6 6.2Z" /><rect x="17" y="5" width="2.5" height="14" rx="1" /></Icon>
export const PrevIcon = (p: IconProps) => <Icon {...p}><path d="M18 6.2v11.6a.8.8 0 0 1-1.25.66l-8.5-5.8a.8.8 0 0 1 0-1.32l8.5-5.8A.8.8 0 0 1 18 6.2Z" /><rect x="4.5" y="5" width="2.5" height="14" rx="1" /></Icon>
export const ShuffleIcon = (p: IconProps) => <Icon {...p} {...stroke}><path d="M16 3h5v5M4 20 21 3M21 16v5h-5M15 15l6 6M4 4l5 5" /></Icon>
export const RepeatIcon = (p: IconProps) => <Icon {...p} {...stroke}><path d="m17 2 4 4-4 4" /><path d="M3 11v-1a4 4 0 0 1 4-4h14" /><path d="m7 22-4-4 4-4" /><path d="M21 13v1a4 4 0 0 1-4 4H3" /></Icon>
export const RepeatOneIcon = (p: IconProps) => <Icon {...p} {...stroke}><path d="m17 2 4 4-4 4" /><path d="M3 11v-1a4 4 0 0 1 4-4h14" /><path d="m7 22-4-4 4-4" /><path d="M21 13v1a4 4 0 0 1-4 4H3" /><path d="M11 10h1v4" /></Icon>

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
export const VolumeIcon = (p: IconProps) => <Icon {...p} {...stroke}><path d="M11 5 6 9H2v6h4l5 4V5Z" /><path d="M15.54 8.46a5 5 0 0 1 0 7.07" /><path d="M19.07 4.93a10 10 0 0 1 0 14.14" /></Icon>
export const VolumeLowIcon = (p: IconProps) => <Icon {...p} {...stroke}><path d="M11 5 6 9H2v6h4l5 4V5Z" /><path d="M15.54 8.46a5 5 0 0 1 0 7.07" /></Icon>
export const VolumeMutedIcon = (p: IconProps) => <Icon {...p} {...stroke}><path d="M11 5 6 9H2v6h4l5 4V5Z" /><path d="m22 9-6 6" /><path d="m16 9 6 6" /></Icon>
export const FullscreenIcon = (p: IconProps) => <Icon {...p} {...stroke}><path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3" /></Icon>
export const ExitFullscreenIcon = (p: IconProps) => <Icon {...p} {...stroke}><path d="M8 3v3a2 2 0 0 1-2 2H3m18 0h-3a2 2 0 0 1-2-2V3m0 18v-3a2 2 0 0 1 2-2h3M3 16h3a2 2 0 0 1 2 2v3" /></Icon>
export const ChevronUpIcon = (p: IconProps) => <Icon {...p} {...stroke}><path d="m18 15-6-6-6 6" /></Icon>
export const ChevronDownIcon = (p: IconProps) => <Icon {...p} {...stroke}><path d="m6 9 6 6 6-6" /></Icon>

export function VolumeLevelIcon({ volume, muted, ...p }: IconProps & { volume: number; muted: boolean }) {
  if (muted || volume === 0) return <VolumeMutedIcon {...p} />
  return volume < 0.5 ? <VolumeLowIcon {...p} /> : <VolumeIcon {...p} />
}
export const MoreIcon = (p: IconProps) => <Icon {...p}><circle cx="5" cy="12" r="1.8" /><circle cx="12" cy="12" r="1.8" /><circle cx="19" cy="12" r="1.8" /></Icon>
export const PlusIcon = (p: IconProps) => <Icon {...p} {...stroke}><path d="M12 5v14M5 12h14" /></Icon>
export const HomeIcon = (p: IconProps) => <Icon {...p} {...stroke}><path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" /><path d="M9 22V12h6v10" /></Icon>
export const LibraryIcon = (p: IconProps) => <Icon {...p} {...stroke}><path d="m16 6 4 14M12 6v14M8 8v12M4 4v16" /></Icon>
export const PlaylistsIcon = (p: IconProps) => <Icon {...p} {...stroke}><path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" /></Icon>
export const SettingsIcon = (p: IconProps) => <Icon {...p} {...stroke}><path d="M4 21v-7M4 10V3M12 21v-9M12 8V3M20 21v-5M20 12V3M1 14h6M9 8h6M17 16h6" /></Icon>
export const CollapseIcon = (p: IconProps) => <Icon {...p} {...stroke}><path d="m11 17-5-5 5-5M18 17l-5-5 5-5" /></Icon>
export const ExpandIcon = (p: IconProps) => <Icon {...p} {...stroke}><path d="m13 17 5-5-5-5M6 17l5-5-5-5" /></Icon>
export const LyricsIcon = (p: IconProps) => <Icon {...p} {...stroke}><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" /><path d="M8 8.5h8M8 12.5h5" /></Icon>

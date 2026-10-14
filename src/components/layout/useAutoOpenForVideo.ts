import { useEffect } from 'react'
import { useNowPlayingStore } from '../../features/player/nowPlayingStore'
import { selectCurrentTrack, usePlayerStore } from '../../features/player/store'

// a video opens its panel on pick and again whenever it starts playing after being closed
export function useAutoOpenForVideo(): void {
  const loadToken = usePlayerStore((s) => s.loadToken)
  const isPlaying = usePlayerStore((s) => s.isPlaying)
  useEffect(() => {
    if (!isPlaying) return
    const track = selectCurrentTrack(usePlayerStore.getState())
    if (track?.kind === 'video') useNowPlayingStore.getState().setOpen(true)
  }, [loadToken, isPlaying])
}

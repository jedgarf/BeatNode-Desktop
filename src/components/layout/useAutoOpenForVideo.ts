import { useEffect } from 'react'
import { useNowPlayingStore } from '../../features/player/nowPlayingStore'
import { selectCurrentTrack, usePlayerStore } from '../../features/player/store'

export function useAutoOpenForVideo(): void {
  const loadToken = usePlayerStore((s) => s.loadToken)
  useEffect(() => {
    const track = selectCurrentTrack(usePlayerStore.getState())
    if (track?.kind === 'video') useNowPlayingStore.getState().setOpen(true)
  }, [loadToken])
}

import { useMemo } from 'react'
import type { Playlist } from '../../shared/types'
import { usePlaylistStore } from './store'

export function useLivePlaylists(): Playlist[] {
  const playlists = usePlaylistStore((s) => s.playlists)
  return useMemo(() => playlists.filter((p) => !p.deleted), [playlists])
}

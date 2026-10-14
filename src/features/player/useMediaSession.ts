import { useEffect } from 'react'
import { selectCurrentTrack, usePlayerStore } from './store'

export function useMediaSession(): void {
  const track = usePlayerStore(selectCurrentTrack)
  const isPlaying = usePlayerStore((s) => s.isPlaying)

  useEffect(() => {
    if (!('mediaSession' in navigator)) return
    navigator.mediaSession.metadata = track
      ? new MediaMetadata({
          title: track.title,
          artist: track.artist,
          album: track.album,
          artwork: track.cover ? [{ src: track.cover }] : [],
        })
      : null
  }, [track])

  useEffect(() => {
    if (!('mediaSession' in navigator)) return
    navigator.mediaSession.playbackState = isPlaying ? 'playing' : 'paused'
  }, [isPlaying])

  useEffect(() => {
    if (!('mediaSession' in navigator)) return
    const { play, pause, next, previous, seek } = usePlayerStore.getState()
    const handlers: Array<[MediaSessionAction, MediaSessionActionHandler]> = [
      ['play', play],
      ['pause', pause],
      ['nexttrack', () => next()],
      ['previoustrack', previous],
      ['seekto', (d) => d.seekTime != null && seek(d.seekTime)],
    ]
    handlers.forEach(([action, handler]) => navigator.mediaSession.setActionHandler(action, handler))
    return () => handlers.forEach(([action]) => navigator.mediaSession.setActionHandler(action, null))
  }, [])
}

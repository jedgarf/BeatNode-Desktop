import { useEffect, useState } from 'react'
import type { LyricsResult, Track } from '../../shared/types'

// cached and local lyrics answer quicker than this, so they never flash a loader
const LOADING_DELAY_MS = 300

// lyrics is null while there is nothing to show: no track, still looking, or not found
// loading turns on only once a lookup has taken a noticeable while
export function useLyrics(track: Track | null): { lyrics: LyricsResult | null; loading: boolean } {
  const [found, setFound] = useState<{ id: string; lyrics: LyricsResult | null } | null>(null)
  const [slowId, setSlowId] = useState<string | null>(null)
  const id = track?.id
  const path = track?.path

  useEffect(() => {
    if (!id || !path || !track) return
    let stale = false
    const timer = window.setTimeout(() => !stale && setSlowId(id), LOADING_DELAY_MS)
    window.beatnode
      .getLyrics({ path, title: track.title, artist: track.artist, album: track.album, duration: track.duration })
      .then((lyrics) => {
        if (!stale) setFound({ id, lyrics: lyrics && (lyrics.lines?.length || lyrics.plain) ? lyrics : null })
      })
      .catch((error) => {
        console.error(error)
        if (!stale) setFound({ id, lyrics: null })
      })
      .finally(() => window.clearTimeout(timer))
    return () => {
      stale = true
      window.clearTimeout(timer)
    }
    // the tags rarely change mid-song, so the id is the only thing worth re-asking for
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, path])

  const done = found !== null && found.id === id
  return { lyrics: done ? found.lyrics : null, loading: !done && slowId === id && id !== undefined }
}

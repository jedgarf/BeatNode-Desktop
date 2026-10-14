import { useEffect, useState } from 'react'
import type { LyricsResult, Track } from '../../shared/types'

// null while there is nothing to show: no track, still looking, or not found
export function useLyrics(track: Track | null): LyricsResult | null {
  const [found, setFound] = useState<{ id: string; lyrics: LyricsResult } | null>(null)
  const id = track?.id
  const path = track?.path

  useEffect(() => {
    if (!id || !path || !track) return
    let stale = false
    window.beatnode
      .getLyrics({ path, title: track.title, artist: track.artist, album: track.album, duration: track.duration })
      .then((lyrics) => {
        if (!stale && lyrics && (lyrics.lines?.length || lyrics.plain)) setFound({ id, lyrics })
      })
      .catch(console.error)
    return () => {
      stale = true
    }
    // the tags rarely change mid-song, so the id is the only thing worth re-asking for
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, path])

  return found && found.id === id ? found.lyrics : null
}

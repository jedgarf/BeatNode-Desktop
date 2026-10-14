import { useCallback, useState } from 'react'
import { usePlayerStore } from '../player/store'

export function useImportTracks() {
  const addToLibrary = usePlayerStore((s) => s.addToLibrary)
  const [isImporting, setIsImporting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const importTracks = useCallback(async () => {
    setIsImporting(true)
    setError(null)
    try {
      addToLibrary(await window.beatnode.openAudioFiles())
    } catch (err) {
      console.error('[library] import failed:', err)
      setError('Could not import those files.')
    } finally {
      setIsImporting(false)
    }
  }, [addToLibrary])

  return { importTracks, isImporting, error }
}

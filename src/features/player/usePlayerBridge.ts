import { useEffect } from 'react'
import { selectCurrentTrack, usePlayerStore } from './store'

export function usePlayerBridge(): void {
  useEffect(() => {
    let last = ''
    const report = (state: ReturnType<typeof usePlayerStore.getState>) => {
      const track = selectCurrentTrack(state)
      const payload = {
        hasTrack: track !== null,
        title: track?.title ?? '',
        artist: track?.artist ?? '',
        isPlaying: state.isPlaying,
      }
      const signature = JSON.stringify(payload)
      if (signature === last) return
      last = signature
      window.beatnode.reportPlayback(payload)
    }

    report(usePlayerStore.getState())
    const unsubscribe = usePlayerStore.subscribe(report)
    const offCommand = window.beatnode.onPlayerCommand((command) => {
      const state = usePlayerStore.getState()
      if (command === 'toggle') state.togglePlay()
      else if (command === 'next') state.next()
      else if (command === 'previous') state.previous()
      else if (command === 'mute') state.toggleMute()
      else state.setVolume(state.volume + (command === 'volumeUp' ? 0.1 : -0.1))
    })

    return () => {
      unsubscribe()
      offCommand()
    }
  }, [])
}

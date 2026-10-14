import { useEffect } from 'react'
import { mediaElement } from './mediaElement'
import { selectCurrentTrack, usePlayerStore } from './store'

export function useAudioEngine(): void {
  useEffect(() => {
    const audio = mediaElement

    const store = usePlayerStore
    const safePlay = () => {
      audio.play().catch((error: unknown) => {
        // AbortError = a new load interrupted play(), fine
        if (error instanceof DOMException && error.name === 'AbortError') return
        console.error('[audio] playback failed:', error)
        store.getState().pause()
      })
    }

    const applyVolume = () => {
      const { volume, muted } = store.getState()
      audio.volume = volume
      audio.muted = muted
    }
    applyVolume()

    const onTimeUpdate = () => store.getState()._setTime(audio.currentTime)
    const onDuration = () => {
      if (Number.isFinite(audio.duration)) store.getState()._setDuration(audio.duration)
    }
    const onWaiting = () => store.getState()._setBuffering(true)
    const onReady = () => store.getState()._setBuffering(false)
    const onEnded = () => {
      if (store.getState().repeat === 'one') {
        audio.currentTime = 0
        safePlay()
      } else {
        store.getState().next({ auto: true })
      }
    }
    const onError = () => {
      console.error('[audio] failed to load track:', audio.error?.message)
      const state = store.getState()
      state._setBuffering(false)
      // skip files that won't load
      if (state.queue.length > 1) state.next({ auto: true })
      else state.pause()
    }

    const listeners: Array<[string, () => void]> = [
      ['timeupdate', onTimeUpdate],
      ['durationchange', onDuration],
      ['loadedmetadata', onDuration],
      ['waiting', onWaiting],
      ['canplay', onReady],
      ['playing', onReady],
      ['ended', onEnded],
      ['error', onError],
    ]
    listeners.forEach(([event, handler]) => audio.addEventListener(event, handler))

    let lastLoadToken = -1
    let lastPlaying = false

    const unsubscribe = store.subscribe((state) => {
      const track = selectCurrentTrack(state)

      if (state.loadToken !== lastLoadToken) {
        lastLoadToken = state.loadToken
        if (track) {
          audio.src = track.src
          audio.load()
          if (state.isPlaying) safePlay()
        } else {
          audio.removeAttribute('src')
          audio.load()
        }
      } else if (state.isPlaying !== lastPlaying && track) {
        if (state.isPlaying) safePlay()
        else audio.pause()
      }
      lastPlaying = state.isPlaying

      if (state.pendingSeek !== null) {
        audio.currentTime = state.pendingSeek
        state._clearSeek()
      }

      audio.volume = state.volume
      audio.muted = state.muted
    })

    return () => {
      unsubscribe()
      listeners.forEach(([event, handler]) => audio.removeEventListener(event, handler))
      audio.pause()
      audio.removeAttribute('src')
      audio.load()
    }
  }, [])
}

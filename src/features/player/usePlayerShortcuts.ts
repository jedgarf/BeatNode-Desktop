import { useEffect } from 'react'
import { usePlayerStore } from './store'

const SEEK_STEP_SECONDS = 5
const VOLUME_STEP = 0.05

function isTypingTarget(target: EventTarget | null): boolean {
  return target instanceof HTMLElement && (target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName))
}

export function usePlayerShortcuts(): void {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (isTypingTarget(event.target) || event.metaKey || event.ctrlKey || event.altKey) return
      const s = usePlayerStore.getState()
      switch (event.code) {
        case 'Space':
          // focused buttons keep their own space behavior
          if (event.target instanceof HTMLButtonElement) return
          event.preventDefault()
          s.togglePlay()
          break
        case 'ArrowRight':
          s.seek(s.currentTime + SEEK_STEP_SECONDS)
          break
        case 'ArrowLeft':
          s.seek(s.currentTime - SEEK_STEP_SECONDS)
          break
        case 'ArrowUp':
          event.preventDefault()
          s.setVolume(s.volume + VOLUME_STEP)
          break
        case 'ArrowDown':
          event.preventDefault()
          s.setVolume(s.volume - VOLUME_STEP)
          break
        case 'KeyM':
          s.toggleMute()
          break
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])
}

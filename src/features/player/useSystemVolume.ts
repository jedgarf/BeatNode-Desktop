import { useEffect } from 'react'
import { usePlayerStore } from './store'

const POLL_MS = 1500
const PUSH_DELAY_MS = 80
// ignore polled values for a moment after we wrote one, they may predate it
const SETTLE_MS = 700

// slider and mute follow the master volume of the computer, volume keys included
export function useSystemVolume(): void {
  useEffect(() => {
    const store = usePlayerStore
    let supported = false
    let applying = false
    let lastPush = 0
    let pushTimer: number | undefined
    let stopped = false

    const pull = async () => {
      const system = await window.beatnode.getSystemVolume().catch(() => null)
      if (stopped || Date.now() - lastPush < SETTLE_MS) return
      if (!system) {
        if (supported) {
          supported = false
          store.setState({ systemVolume: false })
        }
        return
      }
      supported = true
      applying = true
      store.setState({ volume: system.volume, muted: system.muted, systemVolume: true })
      applying = false
    }

    const unsubscribe = store.subscribe((state, previous) => {
      if (applying || !supported) return
      if (state.volume === previous.volume && state.muted === previous.muted) return
      window.clearTimeout(pushTimer)
      pushTimer = window.setTimeout(() => {
        const { volume, muted } = store.getState()
        lastPush = Date.now()
        window.beatnode.setSystemVolume({ volume, muted }).catch(console.error)
      }, PUSH_DELAY_MS)
    })

    void pull()
    const pollTimer = window.setInterval(() => {
      if (!document.hidden) void pull()
    }, POLL_MS)

    return () => {
      stopped = true
      unsubscribe()
      window.clearTimeout(pushTimer)
      window.clearInterval(pollTimer)
    }
  }, [])
}

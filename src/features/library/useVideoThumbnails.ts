import { useEffect } from 'react'
import { usePlayerStore } from '../player/store'

const THUMBNAIL_WIDTH = 480
const CAPTURE_TIMEOUT_MS = 6000

// frame about 10% in (max 10s), as a jpeg data url
function captureFrame(src: string): Promise<string | null> {
  return new Promise((resolve) => {
    const video = document.createElement('video')
    let settled = false
    const finish = (result: string | null) => {
      if (settled) return
      settled = true
      window.clearTimeout(timer)
      video.removeAttribute('src')
      video.load()
      resolve(result)
    }
    const timer = window.setTimeout(() => finish(null), CAPTURE_TIMEOUT_MS)

    video.muted = true
    video.preload = 'metadata'
    video.crossOrigin = 'anonymous' // required to read pixels back from the beatnode:// scheme
    video.onerror = () => finish(null)
    video.onloadedmetadata = () => {
      const duration = Number.isFinite(video.duration) ? video.duration : 0
      video.currentTime = Math.min(10, Math.max(0.1, duration * 0.1))
    }
    video.onseeked = () => {
      try {
        if (!video.videoWidth || !video.videoHeight) return finish(null)
        const canvas = document.createElement('canvas')
        canvas.width = THUMBNAIL_WIDTH
        canvas.height = Math.round((THUMBNAIL_WIDTH * video.videoHeight) / video.videoWidth)
        canvas.getContext('2d')?.drawImage(video, 0, 0, canvas.width, canvas.height)
        finish(canvas.toDataURL('image/jpeg', 0.8))
      } catch (error) {
        console.warn('[thumbnails] capture failed:', error)
        finish(null)
      }
    }
    video.src = src
  })
}

export function useVideoThumbnails(): void {
  useEffect(() => {
    let running = false
    let cancelled = false
    const attempted = new Set<string>() // don't retry failures within a session

    const process = async () => {
      if (running) return
      running = true
      try {
        while (!cancelled) {
          const next = usePlayerStore.getState().library.find((t) => t.kind === 'video' && !t.cover && !attempted.has(t.id))
          if (!next) break
          attempted.add(next.id)
          const dataUrl = await captureFrame(next.src)
          if (!dataUrl || cancelled) continue
          const cover = await window.beatnode.saveCover(next.id, dataUrl)
          if (cover) usePlayerStore.getState().setCover(next.id, cover)
        }
      } finally {
        running = false
      }
    }

    void process()
    const unsubscribe = usePlayerStore.subscribe((state, prev) => {
      if (state.library !== prev.library) void process()
    })
    return () => {
      cancelled = true
      unsubscribe()
    }
  }, [])
}

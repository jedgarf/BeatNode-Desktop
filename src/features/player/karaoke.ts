import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { mediaElement } from './mediaElement'
import processorUrl from './karaoke-processor.js?url'

const FADE_SECONDS = 0.12

interface KaraokeState {
  enabled: boolean
  // 0..1, how hard the shared centre (the lead vocal) is cut
  strength: number
  toggle: () => void
  setStrength: (strength: number) => void
}

// on/off starts off every launch, so the audio never opens through a graph that may still be
// suspended. the strength is a taste and is kept
export const useKaraokeStore = create<KaraokeState>()(
  persist(
    (set) => ({
      enabled: false,
      strength: 0.85,
      toggle: () => set((s) => ({ enabled: !s.enabled })),
      setStrength: (strength) => set({ strength: Math.min(1, Math.max(0, strength)) }),
    }),
    { name: 'beatnode-karaoke', partialize: ({ strength }) => ({ strength }) },
  ),
)

useKaraokeStore.subscribe((state, previous) => {
  if (state.enabled !== previous.enabled) applyKaraoke(state.enabled).catch(console.error)
  else if (state.strength !== previous.strength && graph) graph.strength.setTargetAtTime(state.strength, graph.context.currentTime, 0.05)
})

interface Graph {
  context: AudioContext
  dry: GainNode
  wet: GainNode
  strength: AudioParam
}

let graph: Graph | null = null
let building: Promise<Graph> | null = null

// built on first use only: once an element feeds Web Audio it can never go back,
// so people who never sing along keep the plain element path
async function build(): Promise<Graph> {
  const context = new AudioContext()
  await context.audioWorklet.addModule(processorUrl)
  const source = context.createMediaElementSource(mediaElement)

  const dry = context.createGain()
  source.connect(dry).connect(context.destination)

  const karaoke = new AudioWorkletNode(context, 'karaoke', { outputChannelCount: [2] })
  const strength = karaoke.parameters.get('strength') as AudioParam
  strength.value = useKaraokeStore.getState().strength
  const wet = context.createGain()
  wet.gain.value = 0
  source.connect(karaoke).connect(wet).connect(context.destination)

  return { context, dry, wet, strength }
}

export async function applyKaraoke(enabled: boolean): Promise<void> {
  if (!enabled && !graph) return
  building ??= build().catch((error: unknown) => {
    // let the next toggle try again
    building = null
    throw error
  })
  graph = await building
  const { context, dry, wet } = graph
  await context.resume()
  // the toggle may have flipped back while the worklet was loading
  const on = useKaraokeStore.getState().enabled
  const now = context.currentTime
  dry.gain.setTargetAtTime(on ? 0 : 1, now, FADE_SECONDS / 3)
  wet.gain.setTargetAtTime(on ? 1 : 0, now, FADE_SECONDS / 3)
}

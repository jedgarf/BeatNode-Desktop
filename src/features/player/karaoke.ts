import { create } from 'zustand'
import { mediaElement } from './mediaElement'

// lead vocals sit dead centre in most mixes, so left minus right cancels them while the
// panned instruments survive. the cancel also takes the bass and kick, which are centred
// too, so the lows below this go back in untouched
const BASS_KEEP_HZ = 140
const FADE_SECONDS = 0.12

interface KaraokeState {
  enabled: boolean
  toggle: () => void
}

// starts off every launch, so the audio never opens through a graph that may still be suspended
export const useKaraokeStore = create<KaraokeState>()((set) => ({
  enabled: false,
  toggle: () => set((s) => ({ enabled: !s.enabled })),
}))

useKaraokeStore.subscribe((state, previous) => {
  if (state.enabled !== previous.enabled) applyKaraoke(state.enabled)
})

interface Graph {
  context: AudioContext
  dry: GainNode
  wet: GainNode
}

let graph: Graph | null = null

// built on first use only: once an element feeds Web Audio it can never go back,
// so people who never sing along keep the plain element path
function build(): Graph {
  const context = new AudioContext()
  const source = context.createMediaElementSource(mediaElement)

  const dry = context.createGain()
  source.connect(dry).connect(context.destination)

  const split = context.createChannelSplitter(2)
  source.connect(split)

  // (L - R) for the instruments, one mono signal to both speakers
  const left = context.createGain()
  const right = context.createGain()
  right.gain.value = -1
  const side = context.createGain()
  split.connect(left, 0)
  split.connect(right, 1)
  left.connect(side)
  right.connect(side)
  const sideHigh = context.createBiquadFilter()
  sideHigh.type = 'highpass'
  sideHigh.frequency.value = BASS_KEEP_HZ

  // (L + R) / 2 below the vocal range for bass and kick
  const mid = context.createGain()
  mid.gain.value = 0.5
  split.connect(mid, 0)
  split.connect(mid, 1)
  const midLow = context.createBiquadFilter()
  midLow.type = 'lowpass'
  midLow.frequency.value = BASS_KEEP_HZ

  const wet = context.createGain()
  wet.gain.value = 0
  side.connect(sideHigh).connect(wet)
  mid.connect(midLow).connect(wet)
  wet.connect(context.destination)

  return { context, dry, wet }
}

export function applyKaraoke(enabled: boolean): void {
  if (!enabled && !graph) return
  graph ??= build()
  const { context, dry, wet } = graph
  void context.resume()
  const now = context.currentTime
  dry.gain.setTargetAtTime(enabled ? 0 : 1, now, FADE_SECONDS / 3)
  wet.gain.setTargetAtTime(enabled ? 1 : 0, now, FADE_SECONDS / 3)
}

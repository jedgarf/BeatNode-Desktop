// AudioWorklet for karaoke: per frequency, takes out what the left and right channels share.
// lead vocals are mixed dead centre, so they share the most, while panned instruments survive
// and keep their stereo place. only the vocal range is touched, bass and cymbals pass untouched.
// plain JS on purpose: worklets load as their own module, outside the app bundle

const SIZE = 2048
const HOP = SIZE / 4
// periodic sqrt-hann on both ends sums to 2 at a quarter hop, this undoes it
const OVERLAP_GAIN = 0.5
const LOW_HZ = 120
const HIGH_HZ = 8000
// how alike the two channels must be before a bin counts as centre: 1 is identical, 0 unrelated
const ALIKE_FROM = 0.35
const ALIKE_FULL = 0.9
// carries the mask over between frames so the cut doesn't flicker ("musical noise")
const MASK_SMOOTHING = 0.55
// a mono file is all centre, cutting it would leave nothing, so below this the effect bows out
const MONO_SIDE_RATIO = 0.004

class Fft {
  constructor(size) {
    this.size = size
    this.cos = new Float32Array(size / 2)
    this.sin = new Float32Array(size / 2)
    for (let i = 0; i < size / 2; i++) {
      this.cos[i] = Math.cos((2 * Math.PI * i) / size)
      this.sin[i] = Math.sin((2 * Math.PI * i) / size)
    }
    this.reverse = new Uint32Array(size)
    const bits = Math.log2(size)
    for (let i = 0; i < size; i++) {
      let r = 0
      for (let b = 0; b < bits; b++) r |= ((i >> b) & 1) << (bits - 1 - b)
      this.reverse[i] = r
    }
  }

  // in place, sign -1 forward, +1 inverse (unscaled)
  run(re, im, sign) {
    const n = this.size
    for (let i = 0; i < n; i++) {
      const j = this.reverse[i]
      if (j > i) {
        let t = re[i]; re[i] = re[j]; re[j] = t
        t = im[i]; im[i] = im[j]; im[j] = t
      }
    }
    for (let len = 2; len <= n; len <<= 1) {
      const half = len >> 1
      const step = n / len
      for (let start = 0; start < n; start += len) {
        for (let k = 0; k < half; k++) {
          const wr = this.cos[k * step]
          const wi = sign * this.sin[k * step]
          const a = start + k
          const b = a + half
          const xr = re[b] * wr - im[b] * wi
          const xi = re[b] * wi + im[b] * wr
          re[b] = re[a] - xr
          im[b] = im[a] - xi
          re[a] += xr
          im[a] += xi
        }
      }
    }
  }
}

class KaraokeProcessor extends AudioWorkletProcessor {
  static get parameterDescriptors() {
    return [{ name: 'strength', defaultValue: 1, minValue: 0, maxValue: 1, automationRate: 'k-rate' }]
  }

  constructor() {
    super()
    this.fft = new Fft(SIZE)
    this.window = new Float32Array(SIZE)
    for (let i = 0; i < SIZE; i++) this.window[i] = Math.sqrt(0.5 - 0.5 * Math.cos((2 * Math.PI * i) / SIZE))
    this.frameL = new Float32Array(SIZE)
    this.frameR = new Float32Array(SIZE)
    this.outL = new Float32Array(SIZE)
    this.outR = new Float32Array(SIZE)
    this.readyL = new Float32Array(HOP)
    this.readyR = new Float32Array(HOP)
    this.pendL = new Float32Array(HOP)
    this.pendR = new Float32Array(HOP)
    this.filled = 0
    this.reL = new Float32Array(SIZE)
    this.imL = new Float32Array(SIZE)
    this.reR = new Float32Array(SIZE)
    this.imR = new Float32Array(SIZE)
    this.mask = new Float32Array(SIZE / 2 + 1)
    this.sideRatio = 0
    // how much each bin is in the vocal range, with a soft edge of a third of an octave
    this.band = new Float32Array(SIZE / 2 + 1)
    for (let k = 0; k <= SIZE / 2; k++) {
      const hz = (k * sampleRate) / SIZE
      const rise = Math.min(1, Math.max(0, Math.log2(hz / LOW_HZ) * 3 + 1))
      const fall = Math.min(1, Math.max(0, Math.log2(HIGH_HZ / hz) * 3 + 1))
      this.band[k] = hz > 0 ? Math.min(rise, fall) : 0
    }
  }

  frame(strength) {
    const { reL, imL, reR, imR, window: w } = this
    for (let i = 0; i < SIZE; i++) {
      reL[i] = this.frameL[i] * w[i]
      reR[i] = this.frameR[i] * w[i]
      imL[i] = 0
      imR[i] = 0
    }
    this.fft.run(reL, imL, -1)
    this.fft.run(reR, imR, -1)

    let total = 0
    let side = 0
    for (let k = 0; k <= SIZE / 2; k++) {
      if (this.band[k] === 0) continue
      const dr = reL[k] - reR[k]
      const di = imL[k] - imR[k]
      side += dr * dr + di * di
      total += reL[k] * reL[k] + imL[k] * imL[k] + reR[k] * reR[k] + imR[k] * imR[k]
    }
    if (total > 1e-9) this.sideRatio = 0.9 * this.sideRatio + 0.1 * (side / total)
    const amount = strength * Math.min(1, this.sideRatio / MONO_SIDE_RATIO)

    for (let k = 0; k <= SIZE / 2; k++) {
      let cut = 0
      if (this.band[k] > 0 && amount > 0) {
        const energy = reL[k] * reL[k] + imL[k] * imL[k] + reR[k] * reR[k] + imR[k] * imR[k]
        // 2 Re(L conj R) / (|L|^2 + |R|^2): 1 for the same sound in both, 0 for one side only
        const alike = energy > 1e-12 ? (2 * (reL[k] * reR[k] + imL[k] * imR[k])) / energy : 0
        cut = Math.min(1, Math.max(0, (alike - ALIKE_FROM) / (ALIKE_FULL - ALIKE_FROM))) * this.band[k] * amount
      }
      const m = (this.mask[k] = MASK_SMOOTHING * this.mask[k] + (1 - MASK_SMOOTHING) * cut)
      // take out the shared part only, (L + R) / 2, so what is panned stays where it was
      const cr = 0.5 * (reL[k] + reR[k]) * m
      const ci = 0.5 * (imL[k] + imR[k]) * m
      reL[k] -= cr
      imL[k] -= ci
      reR[k] -= cr
      imR[k] -= ci
      // a real signal's spectrum mirrors, keep the upper half matching
      if (k > 0 && k < SIZE / 2) {
        reL[SIZE - k] = reL[k]
        imL[SIZE - k] = -imL[k]
        reR[SIZE - k] = reR[k]
        imR[SIZE - k] = -imR[k]
      }
    }

    this.fft.run(reL, imL, 1)
    this.fft.run(reR, imR, 1)
    const scale = OVERLAP_GAIN / SIZE
    for (let i = 0; i < SIZE; i++) {
      this.outL[i] += reL[i] * w[i] * scale
      this.outR[i] += reR[i] * w[i] * scale
    }
    this.readyL.set(this.outL.subarray(0, HOP))
    this.readyR.set(this.outR.subarray(0, HOP))
    this.outL.copyWithin(0, HOP)
    this.outR.copyWithin(0, HOP)
    this.outL.fill(0, SIZE - HOP)
    this.outR.fill(0, SIZE - HOP)
  }

  process(inputs, outputs, parameters) {
    const input = inputs[0]
    const output = outputs[0]
    if (!output || !output.length) return true
    const inL = input && input[0]
    const inR = input && (input[1] || input[0])
    const outL = output[0]
    const outR = output[1] || output[0]
    const strength = parameters.strength[0]

    for (let i = 0; i < outL.length; i++) {
      this.pendL[this.filled] = inL ? inL[i] : 0
      this.pendR[this.filled] = inR ? inR[i] : 0
      outL[i] = this.readyL[this.filled]
      outR[i] = this.readyR[this.filled]
      if (++this.filled === HOP) {
        this.filled = 0
        this.frameL.copyWithin(0, HOP)
        this.frameR.copyWithin(0, HOP)
        this.frameL.set(this.pendL, SIZE - HOP)
        this.frameR.set(this.pendR, SIZE - HOP)
        this.frame(strength)
      }
    }
    return true
  }
}

registerProcessor('karaoke', KaraokeProcessor)

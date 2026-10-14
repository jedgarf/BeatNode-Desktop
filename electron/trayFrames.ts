import { deflateSync } from 'node:zlib'

export const FRAME_COUNT = 12

const BARS = 4
const BAR_WIDTH = 0.11
const BAR_GAP = 0.075
const SAMPLES = 3

const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
  return c >>> 0
})

function crc32(buf: Buffer): number {
  let c = 0xffffffff
  for (const byte of buf) c = CRC_TABLE[(c ^ byte) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}

function chunk(type: string, data: Buffer): Buffer {
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data])
  const out = Buffer.alloc(body.length + 8)
  out.writeUInt32BE(data.length, 0)
  body.copy(out, 4)
  out.writeUInt32BE(crc32(body), body.length + 4)
  return out
}

function encodePng(rgba: Buffer, size: number): Buffer {
  const header = Buffer.alloc(13)
  header.writeUInt32BE(size, 0)
  header.writeUInt32BE(size, 4)
  header[8] = 8 // bit depth
  header[9] = 6 // rgba
  const raw = Buffer.alloc((size * 4 + 1) * size)
  for (let y = 0; y < size; y++) rgba.copy(raw, y * (size * 4 + 1) + 1, y * size * 4, (y + 1) * size * 4)
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', header),
    chunk('IDAT', deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0)),
  ])
}

function insideRoundedRect(x: number, y: number, left: number, top: number, w: number, h: number, r: number): boolean {
  if (x < left || x > left + w || y < top || y > top + h) return false
  const cx = Math.min(Math.max(x, left + r), left + w - r)
  const cy = Math.min(Math.max(y, top + r), top + h - r)
  return (x - cx) ** 2 + (y - cy) ** 2 <= r * r
}

// bar heights as a fraction of the icon, each bar a little out of step with its neighbour
function barHeights(frame: number): number[] {
  const phase = (frame / FRAME_COUNT) * Math.PI * 2
  return Array.from({ length: BARS }, (_, i) => 0.22 + 0.5 * (0.5 + 0.5 * Math.sin(phase + i * 1.7)))
}

// white bars on the purple tile
export function renderFrame(frame: number, size: number): Buffer {
  const heights = barHeights(frame)
  const total = BARS * BAR_WIDTH + (BARS - 1) * BAR_GAP
  const startX = (1 - total) / 2
  const rgba = Buffer.alloc(size * size * 4)

  for (let py = 0; py < size; py++) {
    for (let px = 0; px < size; px++) {
      let bar = 0
      let tile = 0
      for (let sy = 0; sy < SAMPLES; sy++) {
        for (let sx = 0; sx < SAMPLES; sx++) {
          const x = (px + (sx + 0.5) / SAMPLES) / size
          const y = (py + (sy + 0.5) / SAMPLES) / size
          if (insideRoundedRect(x, y, 0.03, 0.03, 0.94, 0.94, 0.22)) tile++
          for (let i = 0; i < BARS; i++) {
            const h = heights[i]
            if (insideRoundedRect(x, y, startX + i * (BAR_WIDTH + BAR_GAP), 0.5 - h / 2, BAR_WIDTH, h, BAR_WIDTH / 2)) {
              bar++
              break
            }
          }
        }
      }
      const samples = SAMPLES * SAMPLES
      const o = (py * size + px) * 4
      const mix = tile ? bar / tile : 0
      rgba[o] = Math.round(124 + (255 - 124) * mix)
      rgba[o + 1] = Math.round(58 + (255 - 58) * mix)
      rgba[o + 2] = Math.round(237 + (255 - 237) * mix)
      rgba[o + 3] = Math.round((tile / samples) * 255)
    }
  }
  return encodePng(rgba, size)
}

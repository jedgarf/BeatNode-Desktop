import { copyFile, mkdir, readdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { ipcMain, net } from 'electron'
import { parseFile, selectCover } from 'music-metadata'
import { getKv, putKv } from './db'
import { MEDIA_SCHEME, coversDir, isGranted, trackId } from './library'

const COVER_EXTENSIONS: Record<string, string> = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/gif': 'gif' }
const FOLDER_ART = /^(cover|folder|front|album|albumart.*)\.(jpe?g|png|webp)$/i
// itunes allows about 20 lookups a minute
const LOOKUP_GAP_MS = 3500

let lastLookup = 0
const misses = new Set<string>()
let missesLoaded = false

function coverUrl(name: string): string {
  return `${MEDIA_SCHEME}://cover/${name}`
}

export async function embeddedCover(id: string, picture: { format: string; data: Uint8Array } | null | undefined): Promise<string | null> {
  if (!picture) return null
  const name = `${id}.${COVER_EXTENSIONS[picture.format] ?? 'jpg'}`
  await mkdir(coversDir(), { recursive: true })
  await writeFile(path.join(coversDir(), name), picture.data)
  return coverUrl(name)
}

export async function folderCover(id: string, filePath: string): Promise<string | null> {
  let entries: string[]
  try {
    entries = await readdir(path.dirname(filePath))
  } catch {
    return null
  }
  const art = entries.find((name) => FOLDER_ART.test(name))
  if (!art) return null
  const ext = path.extname(art).slice(1).toLowerCase().replace('jpeg', 'jpg')
  const name = `${id}.${ext}`
  await mkdir(coversDir(), { recursive: true })
  await copyFile(path.join(path.dirname(filePath), art), path.join(coversDir(), name))
  return coverUrl(name)
}

const norm = (v: string) =>
  v.normalize('NFKD').toLowerCase().replace(/\(.*?\)|\[.*?\]/g, '').replace(/[^\p{L}\p{N}]+/gu, ' ').trim()

function looselyEqual(a: string, b: string): boolean {
  const x = norm(a)
  const y = norm(b)
  return x.length > 0 && y.length > 0 && (x.includes(y) || y.includes(x))
}

async function onlineCover(id: string, artist: string, title: string): Promise<string | null> {
  const knownArtist = artist && artist !== 'Unknown Artist'
  const wait = lastLookup + LOOKUP_GAP_MS - Date.now()
  if (wait > 0) await new Promise((resolve) => setTimeout(resolve, wait))
  lastLookup = Date.now()

  const params = new URLSearchParams({ term: knownArtist ? `${artist} ${title}` : title, media: 'music', entity: 'song', limit: '5' })
  const response = await net.fetch(`https://itunes.apple.com/search?${params}`)
  if (!response.ok) return null
  const { results } = (await response.json()) as { results?: Array<{ trackName?: string; artistName?: string; artworkUrl100?: string }> }
  const match = results?.find(
    (r) => r.artworkUrl100 && r.trackName && looselyEqual(r.trackName, title) && (!knownArtist || (r.artistName && looselyEqual(r.artistName, artist))),
  )
  if (!match?.artworkUrl100) return null

  const image = await net.fetch(match.artworkUrl100.replace('100x100bb', '600x600bb'))
  if (!image.ok) return null
  const name = `${id}.jpg`
  await mkdir(coversDir(), { recursive: true })
  await writeFile(path.join(coversDir(), name), Buffer.from(await image.arrayBuffer()))
  return coverUrl(name)
}

function rememberMiss(id: string) {
  misses.add(id)
  putKv('artworkMisses', [...misses])
}

async function findCover(filePath: string, artist: string, title: string): Promise<string | null> {
  if (!missesLoaded) {
    getKv<string[]>('artworkMisses', []).forEach((id) => misses.add(id))
    missesLoaded = true
  }
  const id = trackId(filePath)
  if (misses.has(id)) return null

  try {
    const meta = await parseFile(filePath, { duration: false })
    const cover = (await embeddedCover(id, selectCover(meta.common.picture))) ?? (await folderCover(id, filePath))
    if (cover) return cover
    if (!getKv('onlineArtwork', true)) return null
    const found = await onlineCover(id, artist, title)
    if (!found) rememberMiss(id)
    return found
  } catch (error) {
    // offline or a bad file, try again next launch
    console.warn(`[artwork] lookup failed for ${filePath}:`, error)
    return null
  }
}

export function registerArtworkIpc(): void {
  ipcMain.handle('covers:find', (_event, filePath: unknown, artist: unknown, title: unknown) => {
    if (typeof filePath !== 'string' || !isGranted(filePath) || typeof title !== 'string') return null
    return findCover(path.normalize(filePath), typeof artist === 'string' ? artist : '', title)
  })
  ipcMain.handle('onlineArtwork:get', () => getKv('onlineArtwork', true))
  ipcMain.handle('onlineArtwork:set', (_event, enabled: unknown) => {
    putKv('onlineArtwork', enabled === true)
    if (enabled === true) {
      misses.clear()
      putKv('artworkMisses', [])
    }
  })
}

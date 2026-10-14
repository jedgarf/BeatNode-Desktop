import { createHash } from 'node:crypto'
import { access, mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { app } from 'electron'
import { TrackType, parseFile, selectCover } from 'music-metadata'
import { AUDIO_EXTENSIONS, VIDEO_EXTENSIONS, type MediaKind, type Track } from '../src/shared/types'

export const MEDIA_SCHEME = 'beatnode'

// files the user picked, the protocol only serves these
const grantedPaths = new Set<string>()

export const coversDir = () => path.join(app.getPath('userData'), 'covers')

const COVER_EXTENSIONS: Record<string, string> = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/gif': 'gif' }
// only our own generated cover names get served
export const COVER_FILE_PATTERN = /^[a-f0-9]{16}\.(jpg|png|webp|gif)$/

function trackId(filePath: string): string {
  return createHash('sha1').update(filePath).digest('hex').slice(0, 16)
}

// lowercased + trimmed so tags still match across devices
export function trackKey(artist: string, title: string, album: string): string {
  const norm = (v: string) => v.normalize('NFKD').toLowerCase().replace(/\s+/g, ' ').trim()
  return createHash('sha1').update(`${norm(artist)}|${norm(title)}|${norm(album)}`).digest('hex').slice(0, 16)
}

export function revokePath(filePath: string): void {
  grantedPaths.delete(path.normalize(filePath))
}

export function grantPath(filePath: string): void {
  grantedPaths.add(path.normalize(filePath))
}

export function isGranted(filePath: string): boolean {
  return grantedPaths.has(path.normalize(filePath))
}

export function isSupportedMedia(filePath: string): boolean {
  const ext = path.extname(filePath).slice(1).toLowerCase()
  return (AUDIO_EXTENSIONS as readonly string[]).includes(ext) || (VIDEO_EXTENSIONS as readonly string[]).includes(ext)
}

export function kindFromPath(filePath: string): MediaKind {
  const ext = path.extname(filePath).slice(1).toLowerCase()
  return (VIDEO_EXTENSIONS as readonly string[]).includes(ext) ? 'video' : 'audio'
}

export function toMediaUrl(filePath: string): string {
  return `${MEDIA_SCHEME}://media/${encodeURIComponent(filePath)}`
}

export function fromMediaUrl(url: string): string {
  const { pathname } = new URL(url)
  return decodeURIComponent(pathname.slice(1))
}

// "01 - Artist - Song_Name" -> artist + title, best effort
function parseFileName(filePath: string): { title: string; artist: string } {
  const base = path.basename(filePath, path.extname(filePath))
  const cleaned = base.replace(/_/g, ' ').replace(/^\d{1,3}[\s.-]+/, '').trim()
  const parts = cleaned.split(/\s+-\s+/)
  if (parts.length >= 2) return { artist: parts[0], title: parts.slice(1).join(' - ') }
  return { artist: 'Unknown Artist', title: cleaned || base }
}

export async function readTrack(filePath: string): Promise<Track> {
  const normalized = path.normalize(filePath)
  grantPath(normalized)
  const id = trackId(normalized)

  const fallback = parseFileName(normalized)
  let title = fallback.title
  let artist = fallback.artist
  let album = 'Unknown Album'
  let duration = 0
  let cover: string | null = null
  let kind = kindFromPath(normalized)

  try {
    const meta = await parseFile(normalized, { duration: true })
    title = meta.common.title?.trim() || title
    artist = meta.common.artist?.trim() || artist
    album = meta.common.album?.trim() || album
    duration = meta.format.duration ?? 0
    // mp4/mov without a video track is just music
    const tracks = meta.format.trackInfo ?? []
    if (kind === 'video' && tracks.length > 0 && !tracks.some((t) => t.type === TrackType.video)) kind = 'audio'
    const picture = selectCover(meta.common.picture)
    if (picture) {
      const ext = COVER_EXTENSIONS[picture.format] ?? 'jpg'
      await mkdir(coversDir(), { recursive: true })
      await writeFile(path.join(coversDir(), `${id}.${ext}`), picture.data)
      cover = `${MEDIA_SCHEME}://cover/${id}.${ext}`
    }
  } catch (error) {
    // bad tags shouldn't stop playback, fall back to the filename
    console.warn(`[library] metadata read failed for ${normalized}:`, error)
  }

  return {
    id,
    path: normalized,
    title,
    artist,
    album,
    kind,
    duration,
    cover,
    src: toMediaUrl(normalized),
    key: trackKey(artist, title, album),
  }
}

export async function restoreTrack(raw: unknown): Promise<Track | null> {
  if (typeof raw !== 'object' || raw === null) return null
  const t = raw as Partial<Track>
  if (typeof t.path !== 'string' || !isSupportedMedia(t.path)) return null
  try {
    await access(t.path)
  } catch {
    return null // file was moved or deleted
  }
  const normalized = path.normalize(t.path)
  grantPath(normalized)
  const id = trackId(normalized)
  const cover = typeof t.cover === 'string' && t.cover.startsWith(`${MEDIA_SCHEME}://cover/`) ? t.cover : null
  const title = typeof t.title === 'string' ? t.title : path.basename(normalized)
  const artist = typeof t.artist === 'string' ? t.artist : 'Unknown Artist'
  const album = typeof t.album === 'string' ? t.album : 'Unknown Album'
  return {
    id,
    path: normalized,
    title,
    artist,
    album,
    kind: t.kind === 'video' || t.kind === 'audio' ? t.kind : kindFromPath(normalized),
    duration: typeof t.duration === 'number' ? t.duration : 0,
    cover,
    src: toMediaUrl(normalized),
    key: trackKey(artist, title, album),
  }
}

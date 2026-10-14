import { BrowserWindow, Menu, Tray, app, ipcMain, nativeImage, type NativeImage } from 'electron'
import path from 'node:path'
import type { PlaybackReport, PlayerCommand } from '../src/shared/types'
import { getKv, putKv } from './db'
import { FRAME_COUNT, renderFrame } from './trayFrames'

const BACKGROUND_KEY = 'backgroundPlayback'
const FRAME_MS = 130

let tray: Tray | null = null
let idleIcon: NativeImage | null = null
let frames: NativeImage[] | null = null
let frameTimer: NodeJS.Timeout | undefined
let frameIndex = 0
let quitting = false
let report: PlaybackReport = { hasTrack: false, title: '', artist: '', isPlaying: false }
let getWindow: () => BrowserWindow | null = () => null
let showWindow: () => void = () => {}

export function markQuitting(): void {
  quitting = true
  clearInterval(frameTimer)
}

// only hide when something is actually playing
export function shouldHideOnClose(): boolean {
  return !quitting && report.isPlaying && getKv<boolean>(BACKGROUND_KEY, true)
}

function sendCommand(command: PlayerCommand) {
  getWindow()?.webContents.send('player:command', command)
}

function buildMenu(): Menu {
  const label = report.hasTrack ? `${report.title} — ${report.artist}` : 'Nothing playing'
  return Menu.buildFromTemplate([
    { label, enabled: false },
    { type: 'separator' },
    { label: report.isPlaying ? 'Pause' : 'Play', click: () => sendCommand('toggle') },
    { label: 'Next', click: () => sendCommand('next') },
    { label: 'Previous', click: () => sendCommand('previous') },
    { type: 'separator' },
    { label: 'Show BeatNode', click: () => showWindow() },
    { label: 'Quit', click: () => app.quit() },
  ])
}

function buildFrames(): NativeImage[] {
  const mac = process.platform === 'darwin'
  return Array.from({ length: FRAME_COUNT }, (_, i) => {
    const image = nativeImage.createFromBuffer(renderFrame(i, mac ? 44 : 32, mac), mac ? { scaleFactor: 2 } : undefined)
    if (mac) image.setTemplateImage(true)
    return image
  })
}

// bars move while something plays, the normal icon comes back on pause
function syncAnimation() {
  if (!tray || !idleIcon) return
  if (!report.isPlaying) {
    if (frameTimer) {
      clearInterval(frameTimer)
      frameTimer = undefined
      tray.setImage(idleIcon)
    }
    return
  }
  if (frameTimer) return
  frames ??= buildFrames()
  const current = frames
  frameTimer = setInterval(() => {
    frameIndex = (frameIndex + 1) % current.length
    tray?.setImage(current[frameIndex])
  }, FRAME_MS)
}

function refreshTray() {
  if (!tray) return
  syncAnimation()
  tray.setToolTip(report.hasTrack ? `${report.title} — ${report.artist}` : 'BeatNode')
  tray.setContextMenu(buildMenu())
}

function createTray() {
  if (tray) return
  const mac = process.platform === 'darwin'
  const icon = nativeImage.createFromPath(path.join(process.env.VITE_PUBLIC, mac ? 'tray-Template.png' : 'tray.png'))
  if (mac) icon.setTemplateImage(true)
  idleIcon = icon
  tray = new Tray(icon)
  if (process.platform === 'win32') tray.on('click', () => showWindow())
  refreshTray()
}

export function registerBackgroundIpc(windowGetter: () => BrowserWindow | null, show: () => void): void {
  getWindow = windowGetter
  showWindow = show
  createTray()

  ipcMain.on('player:report', (_event, raw: unknown) => {
    const r = raw as Partial<PlaybackReport> | null
    report = {
      hasTrack: r?.hasTrack === true,
      title: typeof r?.title === 'string' ? r.title.slice(0, 120) : '',
      artist: typeof r?.artist === 'string' ? r.artist.slice(0, 120) : '',
      isPlaying: r?.isPlaying === true,
    }
    refreshTray()
  })

  ipcMain.handle('background:get', () => getKv<boolean>(BACKGROUND_KEY, true))
  ipcMain.handle('background:set', (_event, enabled: unknown) => {
    putKv(BACKGROUND_KEY, enabled === true)
  })
}

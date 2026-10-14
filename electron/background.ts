import { BrowserWindow, Menu, Tray, app, ipcMain, nativeImage, screen, type NativeImage } from 'electron'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import type { PlaybackReport, PlayerCommand, TrayCommand } from '../src/shared/types'
import { getKv, putKv } from './db'
import { FRAME_COUNT, renderFrame } from './trayFrames'

const BACKGROUND_KEY = 'backgroundPlayback'
const FRAME_MS = 130
const POPOVER_SIZE = { width: 280, height: 160 }
// the native menu stays the right-click menu, and on linux the only one
const USES_POPOVER = process.platform === 'darwin' || process.platform === 'win32'
const __dirname = path.dirname(fileURLToPath(import.meta.url))

let tray: Tray | null = null
let idleIcon: NativeImage | null = null
let frames: NativeImage[] | null = null
let frameTimer: NodeJS.Timeout | undefined
let frameIndex = 0
let quitting = false
let report: PlaybackReport = { hasTrack: false, title: '', artist: '', isPlaying: false }
let getWindow: () => BrowserWindow | null = () => null
let showWindow: () => void = () => {}
let popover: BrowserWindow | null = null
let popoverHiddenAt = 0

// a hidden popover still counts as a window and would keep the app from quitting
export function destroyPopover(): void {
  popover?.destroy()
  popover = null
}

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
    return nativeImage.createFromBuffer(renderFrame(i, mac ? 36 : 32), mac ? { scaleFactor: 2 } : undefined)
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

function createPopover(): BrowserWindow {
  const win = new BrowserWindow({
    ...POPOVER_SIZE,
    show: false,
    frame: false,
    transparent: true,
    resizable: false,
    movable: false,
    minimizable: false,
    maximizable: false,
    fullscreenable: false,
    skipTaskbar: true,
    alwaysOnTop: true,
    hasShadow: true,
    backgroundColor: '#00000000',
    webPreferences: { preload: path.join(__dirname, 'preload.mjs'), backgroundThrottling: false },
  })
  win.setAlwaysOnTop(true, 'pop-up-menu')
  win.on('blur', () => {
    popoverHiddenAt = Date.now()
    win.hide()
  })
  win.webContents.on('did-finish-load', () => win.webContents.send('tray:state', report))
  const devUrl = process.env['VITE_DEV_SERVER_URL']
  if (devUrl) void win.loadURL(`${devUrl}#tray`)
  else void win.loadFile(path.join(process.env.APP_ROOT ?? '', 'dist', 'index.html'), { hash: 'tray' })
  return win
}

function placePopover(win: BrowserWindow) {
  if (!tray) return
  const bounds = tray.getBounds()
  const area = screen.getDisplayMatching(bounds).workArea
  const [width, height] = win.getSize()
  const x = Math.min(Math.max(Math.round(bounds.x + bounds.width / 2 - width / 2), area.x + 8), area.x + area.width - width - 8)
  // menu bar on top opens downwards, a taskbar at the bottom opens upwards
  const below = bounds.y < area.y + area.height / 2
  win.setPosition(x, below ? bounds.y + bounds.height + 4 : bounds.y - height - 4, false)
}

function togglePopover() {
  if (popover?.isVisible()) {
    popover.hide()
    return
  }
  // the click that blurred it is the same one that reaches the tray
  if (Date.now() - popoverHiddenAt < 250) return
  popover ??= createPopover()
  placePopover(popover)
  popover.webContents.send('tray:state', report)
  popover.show()
  popover.focus()
}

function refreshTray() {
  if (!tray) return
  syncAnimation()
  tray.setToolTip(report.hasTrack ? `${report.title} — ${report.artist}` : 'BeatNode')
  popover?.webContents.send('tray:state', report)
  if (!USES_POPOVER) tray.setContextMenu(buildMenu())
}

function createTray() {
  if (tray) return
  const mac = process.platform === 'darwin'
  // colored on purpose, so on macOS it is not a template image that gets tinted to the menu bar
  const icon = mac
    ? nativeImage.createFromBuffer(
        nativeImage.createFromPath(path.join(process.env.VITE_PUBLIC, 'beatnode.png')).resize({ width: 36, height: 36, quality: 'best' }).toPNG(),
        { scaleFactor: 2 },
      )
    : nativeImage.createFromPath(path.join(process.env.VITE_PUBLIC, 'tray.png'))
  idleIcon = icon
  tray = new Tray(icon)
  if (USES_POPOVER) {
    tray.on('click', togglePopover)
    tray.on('right-click', () => tray?.popUpContextMenu(buildMenu()))
  }
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

  ipcMain.on('tray:command', (_event, raw: unknown) => {
    const command = raw as TrayCommand
    if (command === 'toggle' || command === 'next' || command === 'previous') sendCommand(command)
    else if (command === 'show') {
      popover?.hide()
      showWindow()
    } else if (command === 'quit') app.quit()
  })

  ipcMain.handle('background:get', () => getKv<boolean>(BACKGROUND_KEY, true))
  ipcMain.handle('background:set', (_event, enabled: unknown) => {
    putKv(BACKGROUND_KEY, enabled === true)
  })
}

import { app, BrowserWindow, dialog, ipcMain, Menu, nativeTheme, net, protocol } from 'electron'
import { fileURLToPath } from 'node:url'
import { mkdir, stat, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import { AUDIO_EXTENSIONS, VIDEO_EXTENSIONS } from '../src/shared/types'
import { COVER_FILE_PATTERN, MEDIA_SCHEME, coversDir, fromMediaUrl, isGranted, isSupportedMedia, readTrack, restoreTrack } from './library'
import { isIgnoredPath, registerFolderIpc, unexclude } from './folders'
import { getSettings } from './settings'
import { destroyPopover, markQuitting, registerBackgroundIpc, shouldHideOnClose } from './background'
import { closeDb, loadPlaylists, loadTracks, savePlaylists, saveTracks } from './db'
import { sanitizePlaylists } from './playlists'
import { registerSyncIpc } from './sync'
import { registerPrefsIpc } from './prefs'
import { registerSessionIpc } from './session'
import { withByteRanges } from './byteRanges'
import { closeSystemVolume, registerSystemVolumeIpc } from './systemVolume'
import { registerArtworkIpc } from './artwork'
import type { Playlist, Track } from '../src/shared/types'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

// The built directory structure
//
// ├─┬─┬ dist
// │ │ └── index.html
// │ │
// │ ├─┬ dist-electron
// │ │ ├── main.js
// │ │ └── preload.mjs
// │
process.env.APP_ROOT = path.join(__dirname, '..')

// 🚧 Use ['ENV_NAME'] avoid vite:define plugin - Vite@2.x
export const VITE_DEV_SERVER_URL = process.env['VITE_DEV_SERVER_URL']
export const MAIN_DIST = path.join(process.env.APP_ROOT, 'dist-electron')
export const RENDERER_DIST = path.join(process.env.APP_ROOT, 'dist')

process.env.VITE_PUBLIC = VITE_DEV_SERVER_URL ? path.join(process.env.APP_ROOT, 'public') : RENDERER_DIST

let win: BrowserWindow | null

const MAX_THUMBNAIL_BYTES = 2 * 1024 * 1024

// has to run before the app is ready. stream is what makes seeking work
protocol.registerSchemesAsPrivileged([
  {
    scheme: MEDIA_SCHEME,
    privileges: { standard: true, secure: true, supportFetchAPI: true, stream: true, bypassCSP: true, corsEnabled: true },
  },
])

// renderer is another origin, canvas needs CORS to read thumbnails
async function withCors(response: Response): Promise<Response> {
  const headers = new Headers(response.headers)
  headers.set('Access-Control-Allow-Origin', '*')
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers })
}

function registerMediaProtocol() {
  protocol.handle(MEDIA_SCHEME, async (request) => {
    const filePath = fromMediaUrl(request.url)
    if (new URL(request.url).host === 'cover') {
      const name = path.basename(filePath)
      if (!COVER_FILE_PATTERN.test(name)) return new Response('Forbidden', { status: 403 })
      return withCors(await net.fetch(pathToFileURL(path.join(coversDir(), name)).toString(), { bypassCustomProtocolHandlers: true }))
    }
    if (!isGranted(filePath) || !isSupportedMedia(filePath)) {
      return new Response('Forbidden', { status: 403 })
    }
    const [{ size }, fetched] = await Promise.all([
      stat(filePath),
      net.fetch(pathToFileURL(filePath).toString(), {
        headers: request.headers,
        bypassCustomProtocolHandlers: true,
      }),
    ])
    return withCors(await withByteRanges(fetched, size, request.headers.get('range')))
  })
}

function registerIpc() {
  ipcMain.handle('dialog:openAudioFile', async () => {
    const options: Electron.OpenDialogOptions = {
      title: 'Add music or videos',
      properties: ['openFile', 'multiSelections'],
      filters: [
        { name: 'Media', extensions: [...AUDIO_EXTENSIONS, ...VIDEO_EXTENSIONS] },
        { name: 'Audio', extensions: [...AUDIO_EXTENSIONS] },
        { name: 'Video', extensions: [...VIDEO_EXTENSIONS] },
      ],
    }
    const result = win ? await dialog.showOpenDialog(win, options) : await dialog.showOpenDialog(options)
    if (result.canceled) return []
    await unexclude(result.filePaths)
    const tracks = await Promise.all(result.filePaths.filter(isSupportedMedia).map(readTrack))
    return tracks
  })

  ipcMain.handle('covers:save', async (_event, trackId: unknown, dataUrl: unknown): Promise<string | null> => {
    if (typeof trackId !== 'string' || !/^[a-f0-9]{16}$/.test(trackId)) return null
    const match = typeof dataUrl === 'string' ? /^data:image\/jpeg;base64,([A-Za-z0-9+/=]+)$/.exec(dataUrl) : null
    if (!match) return null
    const bytes = Buffer.from(match[1], 'base64')
    if (bytes.length === 0 || bytes.length > MAX_THUMBNAIL_BYTES) return null
    await mkdir(coversDir(), { recursive: true })
    await writeFile(path.join(coversDir(), `${trackId}.jpg`), bytes)
    return `${MEDIA_SCHEME}://cover/${trackId}.jpg`
  })

  registerFolderIpc(() => win)
  registerSyncIpc(() => win)
  registerPrefsIpc()
  registerSessionIpc()
  registerSystemVolumeIpc()
  registerArtworkIpc()

  ipcMain.handle('library:load', async (): Promise<Track[]> => {
    const [restored, { folders }] = await Promise.all([Promise.all(loadTracks().map(restoreTrack)), getSettings()])
    // drops what an older, less picky scan picked up from node_modules, caches and the like
    return restored.filter((t): t is Track => t !== null && !folders.some((root) => isIgnoredPath(root, t.path)))
  })

  ipcMain.handle('library:save', (_event, tracks: unknown) => {
    if (!Array.isArray(tracks)) return
    // only save files we granted this session
    saveTracks(tracks.filter((t): t is Track => typeof t?.path === 'string' && isGranted(t.path)))
  })

  ipcMain.handle('playlists:load', (): Playlist[] => loadPlaylists())

  ipcMain.handle('playlists:save', (_event, playlists: unknown) => {
    savePlaylists(sanitizePlaylists(playlists))
  })
}

function createWindow() {
  win = new BrowserWindow({
    icon: path.join(process.env.VITE_PUBLIC, 'beatnode.png'),
    width: 1280,
    height: 800,
    minWidth: 960,
    minHeight: 600,
    backgroundColor: nativeTheme.shouldUseDarkColors ? '#0a0a0f' : '#f4f4f9',
    titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'default',
    webPreferences: {
      preload: path.join(__dirname, 'preload.mjs'),
      // keep playback and saves running while hidden
      backgroundThrottling: false,
    },
  })

  // hide to tray instead of killing playback
  win.on('close', (event) => {
    if (!shouldHideOnClose() || !win) return
    event.preventDefault()
    if (win.isFullScreen()) win.setFullScreen(false)
    win.hide()
  })
  win.on('closed', () => {
    destroyPopover()
    win = null
  })

  // Test active push message to Renderer-process.
  win.webContents.on('did-finish-load', () => {
    win?.webContents.send('main-process-message', (new Date).toLocaleString())
  })

  if (VITE_DEV_SERVER_URL) {
    win.loadURL(VITE_DEV_SERVER_URL)
  } else {
    // win.loadFile('dist/index.html')
    win.loadFile(path.join(RENDERER_DIST, 'index.html'))
  }
}

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
    win = null
  }
})

app.on('activate', () => {
  // On OS X it's common to re-create a window in the app when the
  // dock icon is clicked and there are no other windows open.
  showMainWindow()
})

function showMainWindow() {
  if (!win) {
    createWindow()
    return
  }
  if (win.isMinimized()) win.restore()
  win.show()
  win.focus()
}

app.on('before-quit', () => {
  markQuitting()
  closeDb()
  closeSystemVolume()
})

const ABOUT_DETAIL = 'Your music and videos, in one place.'

function showAbout() {
  const options = {
    type: 'none' as const,
    title: 'About BeatNode',
    message: `BeatNode ${app.getVersion()}`,
    detail: `${ABOUT_DETAIL}\n\n© ${new Date().getFullYear()} BeatNode`,
    icon: path.join(process.env.VITE_PUBLIC, 'beatnode.png'),
    buttons: ['OK'],
  }
  if (win) void dialog.showMessageBox(win, options)
  else void dialog.showMessageBox(options)
}

// windows/linux only get File > About and Exit, mac keeps the bare roles so copy/paste still work
function buildMenu() {
  app.setAboutPanelOptions({
    applicationName: 'BeatNode',
    applicationVersion: app.getVersion(),
    version: '',
    credits: ABOUT_DETAIL,
    copyright: `© ${new Date().getFullYear()} BeatNode`,
    iconPath: path.join(process.env.VITE_PUBLIC, 'beatnode.png'),
  })
  const template: Electron.MenuItemConstructorOptions[] =
    process.platform === 'darwin'
      ? [
          {
            label: 'BeatNode',
            submenu: [
              { role: 'about', label: 'About BeatNode' },
              { type: 'separator' },
              { role: 'hide', label: 'Hide BeatNode' },
              { role: 'hideOthers' },
              { role: 'unhide' },
              { type: 'separator' },
              { role: 'quit', label: 'Quit BeatNode' },
            ],
          },
          { role: 'editMenu' },
          { role: 'windowMenu' },
        ]
      : [
          {
            label: 'File',
            submenu: [{ label: 'About BeatNode', click: showAbout }, { type: 'separator' }, { label: 'Exit', click: () => app.quit() }],
          },
        ]
  Menu.setApplicationMenu(Menu.buildFromTemplate(template))
}

// windows shows this id in notifications and taskbar grouping instead of electron.app.*
if (process.platform === 'win32') app.setAppUserModelId('com.jefdev.beatnode.desktop')

app.whenReady().then(() => {
  buildMenu()
  if (VITE_DEV_SERVER_URL && process.platform === 'darwin') app.dock.setIcon(path.join(process.env.VITE_PUBLIC, 'beatnode.png'))
  registerMediaProtocol()
  registerIpc()
  registerBackgroundIpc(() => win, showMainWindow)
  createWindow()
})

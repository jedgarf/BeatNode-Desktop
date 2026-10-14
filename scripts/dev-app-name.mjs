// in dev the app is the stock Electron.app, so the menu bar and dock say "Electron".
// rename it in the bundle's plist, safe to run on every start
import { execFileSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

if (process.platform !== 'darwin') process.exit(0)

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..')
const plist = path.join(root, 'node_modules', 'electron', 'dist', 'Electron.app', 'Contents', 'Info.plist')
if (!existsSync(plist)) process.exit(0)

const NAME = 'BeatNode'
const read = (key) => {
  try {
    return execFileSync('plutil', ['-extract', key, 'raw', '-o', '-', plist], { encoding: 'utf8' }).trim()
  } catch {
    return null
  }
}

for (const key of ['CFBundleName', 'CFBundleDisplayName']) {
  if (read(key) !== NAME) execFileSync('plutil', ['-replace', key, '-string', NAME, plist])
}

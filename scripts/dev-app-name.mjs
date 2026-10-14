// in dev the app is the stock Electron.app, so the menu bar, dock and About panel say
// "Electron" and show its atom icon. rename it and swap the icon inside the bundle,
// safe to run on every start
import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

if (process.platform !== 'darwin') process.exit(0)

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..')
const bundle = path.join(root, 'node_modules', 'electron', 'dist', 'Electron.app', 'Contents')
const plist = path.join(bundle, 'Info.plist')
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

// electron.icns -> our icon, rebuilt only when build/icon.png changes
const source = path.join(root, 'build', 'icon.png')
const target = path.join(bundle, 'Resources', 'electron.icns')
const marker = path.join(bundle, 'Resources', '.beatnode-icon')
if (existsSync(source) && existsSync(target)) {
  const digest = createHash('sha1').update(readFileSync(source)).digest('hex')
  const current = existsSync(marker) ? readFileSync(marker, 'utf8') : ''
  if (current !== digest) {
    const work = mkdtempSync(path.join(os.tmpdir(), 'beatnode-icon-'))
    const iconset = path.join(work, 'icon.iconset')
    mkdirSync(iconset)
    const sizes = [16, 32, 128, 256, 512]
    for (const size of sizes) {
      execFileSync('sips', ['-z', size, size, source, '--out', path.join(iconset, `icon_${size}x${size}.png`)], { stdio: 'ignore' })
      execFileSync('sips', ['-z', size * 2, size * 2, source, '--out', path.join(iconset, `icon_${size}x${size}@2x.png`)], { stdio: 'ignore' })
    }
    const icns = path.join(work, 'icon.icns')
    execFileSync('iconutil', ['-c', 'icns', iconset, '-o', icns])
    copyFileSync(icns, target)
    writeFileSync(marker, digest)
    rmSync(work, { recursive: true, force: true })
  }
}

// yarn store:packages
//
// Downloads the Microsoft Store package CI built for the version in package.json into
// ~/Downloads/BeatNode-Store-<version>/, ready to upload in Partner Center.
// Needs the GitHub CLI signed in (brew install gh, gh auth login).
import { execFileSync, spawnSync } from 'node:child_process'
import { mkdirSync, readdirSync, readFileSync, rmSync, statSync } from 'node:fs'
import { homedir } from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..')
const { version } = JSON.parse(readFileSync(path.join(root, 'package.json'), 'utf8'))
const repo = 'jedgarf/BeatNode-Desktop'
const out = path.join(homedir(), 'Downloads', `BeatNode-Store-${version}`)

const fail = (msg) => {
  console.error(`\x1b[31mError:\x1b[0m ${msg}`)
  process.exit(1)
}
const gh = (args) => execFileSync('gh', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] })

if (version.startsWith('0.')) fail(`The Store needs 1.0.0 or later, package.json says ${version}.`)

let runs
try {
  runs = JSON.parse(gh(['run', 'list', '-R', repo, '-w', 'release.yml', '--status', 'success', '-L', '30', '--json', 'databaseId,headBranch,event']))
} catch {
  fail('Could not list the CI runs. Is gh installed and signed in? (gh auth login)')
}
// the tag's run first, then manual runs from main (those build whatever version main is at).
// older runs may predate the appx or have expired, so only take one that still has it
const hasAppx = (id) => gh(['api', `repos/${repo}/actions/runs/${id}/artifacts`, '--jq', '.artifacts[] | select(.name == "store-appx" and (.expired | not)) | .name']).trim() !== ''
const candidates = [...runs.filter((r) => r.headBranch === `v${version}`), ...runs.filter((r) => r.event === 'workflow_dispatch')]
const run = candidates.find((r) => hasAppx(r.databaseId))
if (!run) fail(`No Release run with a Store package for v${version}. Push the tag or start the workflow by hand, then try again.`)

rmSync(out, { recursive: true, force: true })
mkdirSync(out, { recursive: true })
const dl = spawnSync('gh', ['run', 'download', String(run.databaseId), '-R', repo, '-n', 'store-appx', '-D', out], { stdio: 'inherit' })
if (dl.status !== 0) fail('The download failed. Artifacts expire after 30 days, re-run the workflow if it is older.')

const files = readdirSync(out, { recursive: true }).map(String).filter((f) => f.endsWith('.appx'))
const match = files.filter((f) => f.includes(`-${version}-`))
if (!match.length) fail(`Run ${run.databaseId} built ${files.join(', ') || 'nothing'}, not ${version}.`)

console.log(`\n\x1b[1mReady: ${out}\x1b[0m`)
for (const f of match) console.log(`  ${f}  (${Math.round(statSync(path.join(out, f)).size / 1e6)} MB)`)
console.log(`
In Partner Center (Apps and games > BeatNode):
  1. Start a submission (or Update for a new version)
  2. Packages: upload the .appx above (remove the old one), Save
  3. Store listings > English (United States): fill in or update What's new, Save
  4. Submit for certification
`)
if (process.platform === 'darwin') spawnSync('open', [out])

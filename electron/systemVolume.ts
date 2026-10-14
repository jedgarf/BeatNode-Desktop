import { execFile, spawn, type ChildProcessWithoutNullStreams } from 'node:child_process'
import { createInterface } from 'node:readline'
import { ipcMain } from 'electron'
import type { SystemVolume } from '../src/shared/types'

const COMMAND_TIMEOUT_MS = 3000

function run(file: string, args: string[]): Promise<string | null> {
  return new Promise((resolve) => {
    execFile(file, args, { timeout: COMMAND_TIMEOUT_MS }, (error, stdout) => resolve(error ? null : stdout.trim()))
  })
}

// macos

async function readMac(): Promise<SystemVolume | null> {
  // osascript prints only the last expression, so both values go out as one string
  const out = await run('osascript', ['-e', 'set s to get volume settings', '-e', '(output volume of s as text) & "," & (output muted of s as text)'])
  if (!out) return null
  const [volume, muted] = out.split(',')
  const level = Number(volume)
  // "missing value" on outputs without software volume, e.g. some HDMI displays
  if (!Number.isFinite(level)) return null
  return { volume: level / 100, muted: muted === 'true' }
}

async function writeMac(volume: number | undefined, muted: boolean | undefined): Promise<void> {
  const args: string[] = []
  if (volume !== undefined) args.push('-e', `set volume output volume ${Math.round(volume * 100)}`)
  if (muted !== undefined) args.push('-e', `set volume output muted ${muted}`)
  if (args.length) await run('osascript', args)
}

// linux, pulseaudio or pipewire through pactl

async function readLinux(): Promise<SystemVolume | null> {
  const [volume, mute] = await Promise.all([run('pactl', ['get-sink-volume', '@DEFAULT_SINK@']), run('pactl', ['get-sink-mute', '@DEFAULT_SINK@'])])
  const percent = volume && /(\d+)%/.exec(volume)
  if (!percent) return null
  return { volume: Number(percent[1]) / 100, muted: /yes/i.test(mute ?? '') }
}

async function writeLinux(volume: number | undefined, muted: boolean | undefined): Promise<void> {
  if (volume !== undefined) await run('pactl', ['set-sink-volume', '@DEFAULT_SINK@', `${Math.round(volume * 100)}%`])
  if (muted !== undefined) await run('pactl', ['set-sink-mute', '@DEFAULT_SINK@', muted ? '1' : '0'])
}

// windows, core audio through one long-lived powershell so we pay the compile cost once

const WINDOWS_SCRIPT = `
Add-Type -TypeDefinition @'
using System;
using System.Runtime.InteropServices;
[Guid("5CDF2C82-841E-4546-9722-0CF74078229A"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
interface IAudioEndpointVolume {
  int f(); int g(); int h(); int i();
  int SetMasterVolumeLevelScalar(float fLevel, Guid pguidEventContext);
  int j();
  int GetMasterVolumeLevelScalar(out float pfLevel);
  int k(); int l(); int m(); int n();
  int SetMute([MarshalAs(UnmanagedType.Bool)] bool bMute, Guid pguidEventContext);
  int GetMute(out bool pbMute);
}
[Guid("D666063F-1587-4E43-81F1-B948E807363F"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
interface IMMDevice { int Activate(ref Guid id, int clsCtx, int activationParams, out IAudioEndpointVolume aev); }
[Guid("A95664D2-9614-4F35-A746-DE8DB63617E6"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
interface IMMDeviceEnumerator { int f(); int GetDefaultAudioEndpoint(int dataFlow, int role, out IMMDevice endpoint); }
[ComImport, Guid("BCDE0395-E52F-49D2-8F3D-FE4EE1B5E9FB")] class MMDeviceEnumeratorComObject { }
public class BeatNodeAudio {
  static IAudioEndpointVolume Endpoint() {
    var enumerator = new MMDeviceEnumeratorComObject() as IMMDeviceEnumerator;
    IMMDevice device = null;
    Marshal.ThrowExceptionForHR(enumerator.GetDefaultAudioEndpoint(0, 1, out device));
    IAudioEndpointVolume volume = null;
    var id = typeof(IAudioEndpointVolume).GUID;
    Marshal.ThrowExceptionForHR(device.Activate(ref id, 23, 0, out volume));
    return volume;
  }
  public static float GetVolume() { float v; Marshal.ThrowExceptionForHR(Endpoint().GetMasterVolumeLevelScalar(out v)); return v; }
  public static void SetVolume(float v) { Marshal.ThrowExceptionForHR(Endpoint().SetMasterVolumeLevelScalar(v, Guid.Empty)); }
  public static bool GetMute() { bool m; Marshal.ThrowExceptionForHR(Endpoint().GetMute(out m)); return m; }
  public static void SetMute(bool m) { Marshal.ThrowExceptionForHR(Endpoint().SetMute(m, Guid.Empty)); }
}
'@
$inv = [Globalization.CultureInfo]::InvariantCulture
while (($line = [Console]::In.ReadLine()) -ne $null) {
  try {
    $p = $line.Split(' ')
    if ($p[0] -eq 'get') {
      $v = [BeatNodeAudio]::GetVolume().ToString('0.000', $inv)
      $m = if ([BeatNodeAudio]::GetMute()) { 1 } else { 0 }
      [Console]::Out.WriteLine("$v $m")
    } elseif ($p[0] -eq 'vol') {
      [BeatNodeAudio]::SetVolume([float]::Parse($p[1], $inv)); [Console]::Out.WriteLine('ok')
    } elseif ($p[0] -eq 'mute') {
      [BeatNodeAudio]::SetMute($p[1] -eq '1'); [Console]::Out.WriteLine('ok')
    } else { [Console]::Out.WriteLine('err') }
  } catch { [Console]::Out.WriteLine('err') }
}
`

let host: ChildProcessWithoutNullStreams | null = null
let pending: Array<(reply: string) => void> = []

function failPending() {
  const waiting = pending
  pending = []
  waiting.forEach((resolve) => resolve('err'))
}

function windowsHost(): ChildProcessWithoutNullStreams {
  if (host) return host
  const encoded = Buffer.from(WINDOWS_SCRIPT, 'utf16le').toString('base64')
  const child = spawn('powershell.exe', ['-NoProfile', '-NonInteractive', '-EncodedCommand', encoded], { windowsHide: true })
  createInterface({ input: child.stdout }).on('line', (line) => pending.shift()?.(line.trim()))
  child.on('error', () => {
    host = null
    failPending()
  })
  child.on('exit', () => {
    host = null
    failPending()
  })
  host = child
  return child
}

function ask(command: string): Promise<string> {
  return new Promise((resolve) => {
    const timer = setTimeout(() => resolve('err'), 8000)
    pending.push((reply) => {
      clearTimeout(timer)
      resolve(reply)
    })
    windowsHost().stdin.write(`${command}\n`)
  })
}

async function readWindows(): Promise<SystemVolume | null> {
  const match = /^(\d(?:\.\d+)?) ([01])$/.exec(await ask('get'))
  return match ? { volume: Number(match[1]), muted: match[2] === '1' } : null
}

async function writeWindows(volume: number | undefined, muted: boolean | undefined): Promise<void> {
  if (volume !== undefined) await ask(`vol ${volume.toFixed(3)}`)
  if (muted !== undefined) await ask(`mute ${muted ? 1 : 0}`)
}

export function closeSystemVolume(): void {
  host?.kill()
  host = null
}

export function registerSystemVolumeIpc(): void {
  const read = process.platform === 'darwin' ? readMac : process.platform === 'win32' ? readWindows : readLinux
  const write = process.platform === 'darwin' ? writeMac : process.platform === 'win32' ? writeWindows : writeLinux

  ipcMain.handle('systemVolume:get', (): Promise<SystemVolume | null> => read())
  ipcMain.handle('systemVolume:set', async (_event, raw: unknown) => {
    const patch = (typeof raw === 'object' && raw !== null ? raw : {}) as { volume?: unknown; muted?: unknown }
    const volume = typeof patch.volume === 'number' && Number.isFinite(patch.volume) ? Math.min(1, Math.max(0, patch.volume)) : undefined
    const muted = typeof patch.muted === 'boolean' ? patch.muted : undefined
    await write(volume, muted)
  })
}

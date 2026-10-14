import { useEffect, useState } from 'react'
import { LogoMark } from '../../components/ui/Logo'
import { useTheme } from '../settings/theme'

export function AboutView() {
  useTheme()
  const [version, setVersion] = useState('')

  useEffect(() => {
    window.beatnode.getAppInfo().then((info) => setVersion(info.version)).catch(console.error)
    const onKeyDown = (event: KeyboardEvent) => event.key === 'Escape' && window.close()
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  return (
    <div className="flex h-full flex-col items-center justify-center gap-1 px-8 text-center text-fg">
      <LogoMark size={96} />
      <h1 className="mt-5 text-2xl tracking-tight">
        <span className="font-bold">Beat</span>
        <span className="font-light text-fg/70">Node</span>
      </h1>
      <p className="text-sm text-fg/60">{version ? `Version ${version}` : '\u00a0'}</p>
      <p className="mt-4 text-sm text-fg/80">Your music and videos, in one place.</p>
      <p className="mt-6 text-xs text-fg/40">&copy; {new Date().getFullYear()} BeatNode</p>
    </div>
  )
}

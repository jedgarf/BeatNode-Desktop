import { useEffect, useState } from 'react'
import { LogoMark } from '../../components/ui/Logo'
import { useTheme } from '../settings/theme'
import jefBuildsLogo from '../../assets/jefbuilds.svg'

const DEVELOPER_URL = import.meta.env.VITE_DEVELOPER_URL

// logo and name, a link only when a developer url is set
export function DeveloperName({ className = '', logoSize = 16 }: { className?: string; logoSize?: number }) {
  const content = (
    <>
      <img src={jefBuildsLogo} alt="" width={logoSize} height={logoSize} />
      JEFBuilds
    </>
  )
  const classes = `inline-flex items-center gap-1.5 font-semibold ${className}`
  return DEVELOPER_URL ? (
    <a href={DEVELOPER_URL} target="_blank" rel="noreferrer" className={classes}>
      {content}
    </a>
  ) : (
    <span className={classes}>{content}</span>
  )
}

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
      <p className="mt-6 text-xs text-fg/50">Developed by</p>
      <DeveloperName className="text-sm text-accent-soft hover:underline" logoSize={28} />
      <p className="mt-1 text-xs text-fg/40">&copy; {new Date().getFullYear()} JEFBuilds</p>
    </div>
  )
}

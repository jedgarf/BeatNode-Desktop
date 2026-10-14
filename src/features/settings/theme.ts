import { useEffect } from 'react'
import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export type ThemeMode = 'system' | 'light' | 'dark'

interface ThemeState {
  mode: ThemeMode
  setMode: (mode: ThemeMode) => void
}

export const useThemeStore = create<ThemeState>()(
  persist((set) => ({ mode: 'system', setMode: (mode) => set({ mode }) }), { name: 'beatnode-theme' }),
)

const darkQuery = () => window.matchMedia('(prefers-color-scheme: dark)')

function resolve(mode: ThemeMode): 'light' | 'dark' {
  return mode === 'system' ? (darkQuery().matches ? 'dark' : 'light') : mode
}

function apply(mode: ThemeMode, animate: boolean) {
  const root = document.documentElement
  if (animate) {
    root.classList.add('theme-transition')
    window.setTimeout(() => root.classList.remove('theme-transition'), 300)
  }
  root.dataset.theme = resolve(mode)
}

// before first paint, avoids a dark flash in light mode
apply(useThemeStore.getState().mode, false)

export function useTheme(): void {
  const mode = useThemeStore((s) => s.mode)

  useEffect(() => {
    apply(mode, true)
    if (mode !== 'system') return
    const query = darkQuery()
    const onChange = () => apply('system', true)
    query.addEventListener('change', onChange)
    return () => query.removeEventListener('change', onChange)
  }, [mode])
}

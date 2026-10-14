import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.tsx'
import { TrayPopover } from './features/tray/TrayPopover.tsx'
import './index.css'

// the tray popover is a second window running this same bundle
const isTrayPopover = window.location.hash === '#tray'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>{isTrayPopover ? <TrayPopover /> : <App />}</React.StrictMode>,
)

// Use contextBridge
window.ipcRenderer.on('main-process-message', (_event, message) => {
  console.log(message)
})

// let the intro play once, then fade it out
const splash = document.getElementById('splash')
if (splash && isTrayPopover) {
  splash.remove()
} else if (splash) {
  const shownFor = performance.now()
  window.setTimeout(() => {
    splash.classList.add('out')
    splash.addEventListener('transitionend', () => splash.remove(), { once: true })
  }, Math.max(0, 1600 - shownFor))
}

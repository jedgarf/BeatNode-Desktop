/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_DEVELOPER_URL?: string
}

interface Window {
  beatnode: import('./shared/types').BeatNodeApi
}

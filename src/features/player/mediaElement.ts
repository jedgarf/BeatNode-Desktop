// one element for everything. Now Playing attaches it to show video, audio plays fine detached
export const mediaElement: HTMLVideoElement = (() => {
  const element = document.createElement('video')
  element.preload = 'auto'
  element.playsInline = true
  element.controls = false
  // without it Web Audio (karaoke) only hears silence, the beatnode:// scheme answers with CORS
  element.crossOrigin = 'anonymous'
  return element
})()

// one element for everything. Now Playing attaches it to show video, audio plays fine detached
export const mediaElement: HTMLVideoElement = (() => {
  const element = document.createElement('video')
  element.preload = 'auto'
  element.playsInline = true
  element.controls = false
  return element
})()

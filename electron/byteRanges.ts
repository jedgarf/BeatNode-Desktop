// net.fetch slices a file for a Range request but answers 200 with no Content-Range,
// and chromium then treats the media as unseekable. so we put the 206 back ourselves
export async function withByteRanges(response: Response, size: number, rangeHeader: string | null): Promise<Response> {
  const headers = new Headers(response.headers)
  headers.set('Accept-Ranges', 'bytes')
  const match = rangeHeader ? /^bytes=(\d*)-(\d*)$/.exec(rangeHeader.trim()) : null
  if (!match || (match[1] === '' && match[2] === '')) {
    headers.set('Content-Length', String(size))
    return new Response(response.body, { status: 200, headers })
  }
  let start: number
  let end: number
  if (match[1] === '') {
    start = Math.max(0, size - Number(match[2]))
    end = size - 1
  } else {
    start = Number(match[1])
    end = match[2] === '' ? size - 1 : Math.min(Number(match[2]), size - 1)
  }
  if (start >= size || start > end) {
    return new Response(null, { status: 416, headers: { 'Content-Range': `bytes */${size}` } })
  }
  headers.set('Content-Range', `bytes ${start}-${end}/${size}`)
  headers.set('Content-Length', String(end - start + 1))
  return new Response(response.body, { status: 206, headers })
}

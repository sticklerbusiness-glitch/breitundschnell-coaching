// B&S: Coaches attach their own demo clip to an exercise in a routine (the cfg field `yt`).
// They paste whatever the YouTube app or the browser gave them — a watch URL, a share link,
// a Short, an embed snippet — so the parsing happens here, once, and only the 11-character
// video id is ever stored. Anything that is not recognisably a YouTube video returns null,
// which is what the config sheet uses to tell the coach the link was not understood.

const CH = '[A-Za-z0-9_-]'
// A video id is exactly 11 of those characters: without the trailing guard the first 11
// characters of a longer slug would pass as an id.
const ID = `(${CH}{11})(?!${CH})`
// `^`, `//` or `.` in front of the host so "notyoutu.be/…" is not a YouTube link.
const H = '(?:^|//|\\.)'

const PATTERNS = [
  // youtu.be/<id>, with or without ?t=…
  new RegExp(`${H}youtu\\.be/${ID}`),
  // youtube.com/shorts|embed|live|v/<id> (youtube-nocookie.com too)
  new RegExp(`${H}youtube(?:-nocookie)?\\.com/(?:shorts|embed|live|v)/${ID}`),
  // youtube.com/watch?v=<id>, wherever the v parameter sits in the query
  new RegExp(`${H}youtube(?:-nocookie)?\\.com/\\S*?[?&]v=${ID}`),
]

const BARE = new RegExp(`^${CH}{11}$`)

/** The video id in `input` (a bare id or any common YouTube URL), or null. */
export function youtubeId(input) {
  if (typeof input !== 'string') return null
  const s = input.trim()
  if (!s) return null
  if (BARE.test(s)) return s
  for (const re of PATTERNS) {
    const m = re.exec(s)
    if (m) return m[1]
  }
  return null
}

/** The privacy-mode embed URL for a video id. */
export const youtubeEmbed = id =>
  `https://www.youtube-nocookie.com/embed/${id}?rel=0&modestbranding=1&playsinline=1`

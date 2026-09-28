// B&S: a coach pastes whatever YouTube handed them; only an 11-character id is ever stored.
import { describe, expect, it } from 'vitest'
import { youtubeId, youtubeEmbed } from './youtube.js'

const ID = 'dQw4w9WgXcQ'

describe('youtubeId', () => {
  it('takes a bare id', () => {
    expect(youtubeId(ID)).toBe(ID)
    expect(youtubeId('  ' + ID + ' ')).toBe(ID)
    expect(youtubeId('_-Ab0123456')).toBe('_-Ab0123456')
  })

  it('takes every share shape', () => {
    const cases = [
      `https://youtu.be/${ID}`,
      `https://youtu.be/${ID}?t=42`,
      `youtu.be/${ID}`,
      `https://www.youtube.com/watch?v=${ID}`,
      `https://www.youtube.com/watch?v=${ID}&list=PL123&index=2`,
      `https://m.youtube.com/watch?app=desktop&v=${ID}`,
      `http://youtube.com/watch?v=${ID}`,
      `https://www.youtube.com/shorts/${ID}`,
      `https://www.youtube.com/shorts/${ID}?feature=share`,
      `https://www.youtube.com/embed/${ID}`,
      `https://www.youtube-nocookie.com/embed/${ID}?rel=0`,
      `https://www.youtube.com/live/${ID}`,
      `https://www.youtube.com/v/${ID}`,
    ]
    for (const url of cases) expect(youtubeId(url), url).toBe(ID)
  })

  it('finds the id inside a pasted embed snippet', () => {
    expect(youtubeId(`<iframe src="https://www.youtube.com/embed/${ID}" allowfullscreen></iframe>`)).toBe(ID)
  })

  it('rejects everything else', () => {
    for (const bad of [
      '', '   ', null, undefined, 42, {},
      'https://vimeo.com/123456789',
      `https://notyoutu.be/${ID}`,
      'https://www.youtube.com/watch?v=tooshort',
      'https://www.youtube.com/@breitundschnell',
      'dQw4w9WgXc',            // 10 chars
      'dQw4w9WgXcQQ',          // 12 chars
      'dQw4w9WgXc!',           // illegal character
    ]) expect(youtubeId(bad), String(bad)).toBeNull()
  })

  it('does not take the first 11 characters of a longer slug', () => {
    expect(youtubeId('https://www.youtube.com/shorts/abcdefghijklmnop')).toBeNull()
  })

  it('builds a privacy-mode embed url', () => {
    expect(youtubeEmbed(ID)).toBe(`https://www.youtube-nocookie.com/embed/${ID}?rel=0&modestbranding=1&playsinline=1`)
  })
})

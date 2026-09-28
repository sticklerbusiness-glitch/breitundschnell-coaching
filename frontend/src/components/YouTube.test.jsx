// @vitest-environment happy-dom
// B&S: the coach's demo clip, as a two-click embed. What is worth pinning here is the promise
// our Datenschutz page makes: before the member taps, NOTHING goes to Google — no iframe, no
// thumbnail, not even a preconnect. After the tap, the embed must use the privacy host with the
// playback flags, lazy loading and the fullscreen grant.
import { renderToStaticMarkup } from 'react-dom/server'
import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { describe, expect, it, beforeEach, afterEach } from 'vitest'
import YouTube from './YouTube.jsx'

const ID = 'dQw4w9WgXcQ'
const html = props => renderToStaticMarkup(<YouTube {...props} />)

describe('YouTube', () => {
  it('lädt vor dem Tippen nichts von Google', () => {
    const out = html({ id: ID, title: 'Bankdrücken' })
    expect(out).not.toContain('youtube')
    expect(out).not.toContain('ytimg')
    expect(out).not.toContain('<iframe')
    expect(out).toContain('<button')
    expect(out).toContain('Video deines Coaches abspielen')
    expect(out).toContain('aspect-ratio:16 / 9')
  })

  it('rendert nichts ohne brauchbares Video', () => {
    expect(html({ id: '' })).toBe('')
    expect(html({ id: undefined })).toBe('')
    expect(html({ id: 'https://vimeo.com/123' })).toBe('')
  })

  describe('nach dem Tippen', () => {
    let host, root
    beforeEach(() => {
      host = document.createElement('div')
      document.body.appendChild(host)
      root = createRoot(host)
    })
    afterEach(() => {
      act(() => root.unmount())
      host.remove()
    })

    const tippen = props => {
      act(() => root.render(<YouTube {...props} />))
      act(() => { host.querySelector('button').click() })
      return host.querySelector('iframe')
    }

    it('bettet über youtube-nocookie ein, mit den Wiedergabe-Flags', () => {
      const frame = tippen({ id: ID, title: 'Bankdrücken' })
      expect(frame).toBeTruthy()
      expect(frame.getAttribute('src')).toBe(
        `https://www.youtube-nocookie.com/embed/${ID}?rel=0&modestbranding=1&playsinline=1&autoplay=1`
      )
      expect(frame.getAttribute('loading')).toBe('lazy')
      expect(frame.hasAttribute('allowfullscreen')).toBe(true)
      expect(frame.getAttribute('allow')).toBe('accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture')
      expect(frame.getAttribute('title')).toBe('Bankdrücken')
    })

    it('nimmt auch eine eingefügte Adresse, nicht nur die Id', () => {
      const frame = tippen({ id: `https://youtu.be/${ID}?t=12` })
      expect(frame.getAttribute('src')).toContain(`/embed/${ID}?`)
    })
  })
})

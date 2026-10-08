// @vitest-environment happy-dom
// B&S: Eine getippte Zeit muss gespeichert sein, sobald sie eine Zeit ist — nicht erst beim
// Verlassen des Felds (WebKit lässt das Feld beim Tippen auf „Beenden" fokussiert).
import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { DurationField } from './DurationField.jsx'

globalThis.IS_REACT_ACT_ENVIRONMENT = true
let root, host
afterEach(() => { act(() => root?.unmount()); host?.remove(); root = host = null })

function render(value, onChange) {
  host = document.createElement('div')
  document.body.appendChild(host)
  root = createRoot(host)
  act(() => root.render(<DurationField value={value} onChange={onChange} />))
  return host.querySelector('input')
}
function type(input, text) {
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set
  act(() => { setter.call(input, text); input.dispatchEvent(new Event('input', { bubbles: true })) })
}

describe('DurationField', () => {
  it('saves a valid time while typing, without waiting for blur', () => {
    const onChange = vi.fn()
    const input = render(0, onChange)
    type(input, '3:10')
    expect(onChange).toHaveBeenLastCalledWith(190)
    type(input, '3,05')
    expect(onChange).toHaveBeenLastCalledWith(185)
  })

  it('never saves something that is not a time, and shows the last good value after blur', () => {
    const onChange = vi.fn()
    const input = render(190, onChange)
    expect(input.value).toBe('3:10')
    type(input, '3:7')            // 3:07 ist gültig …
    onChange.mockClear()
    type(input, '3:75')           // … 3:75 nicht
    expect(onChange).not.toHaveBeenCalled()
    act(() => { input.dispatchEvent(new FocusEvent('focusout', { bubbles: true })); input.blur() })
  })

  it('clears to 0 when emptied and left', () => {
    const onChange = vi.fn()
    const input = render(190, onChange)
    act(() => input.focus())
    type(input, '')
    act(() => input.blur())
    expect(onChange).toHaveBeenLastCalledWith(0)
  })
})

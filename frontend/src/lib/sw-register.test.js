// B&S: Der Geltungsbereich des Service Workers ist der ganze Grund, warum es dieses Modul gibt
// — hier steht fest, dass er /training OHNE Schrägstrich abdeckt (dort liegt die Seite) und was
// passiert, wenn der Header `Service-Worker-Allowed` nicht durch den Rewrite-Proxy kommt.
import { describe, expect, it, vi } from 'vitest'
import { registerServiceWorker, swScope } from './sw-register.js'

// Was der Browser beim verbotenen Scope wirft: eine DOMException mit name 'SecurityError'
// (Chrome: „The path of the provided scope … is not under the max scope allowed").
const scopeFehler = () => {
  const e = new Error('The path of the provided scope is not under the max scope allowed')
  e.name = 'SecurityError'
  return e
}

describe('swScope', () => {
  it('nimmt der Base den Schrägstrich ab — /training/ deckt dann auch /training ab', () => {
    expect(swScope('/training/')).toBe('/training')
  })

  it('lässt die Wurzel in Ruhe', () => {
    expect(swScope('/')).toBe('/')
    expect(swScope(undefined)).toBe('/')
  })
})

describe('registerServiceWorker', () => {
  it('registriert /training/sw.js mit dem erweiterten Geltungsbereich', async () => {
    const register = vi.fn().mockResolvedValue({ scope: 'https://breitundschnell.de/training' })
    const reg = await registerServiceWorker({ serviceWorker: { register } }, '/training/')
    expect(register).toHaveBeenCalledWith('/training/sw.js', { scope: '/training' })
    expect(reg).toEqual({ scope: 'https://breitundschnell.de/training' })
  })

  it('fällt auf den Standardbereich zurück, wenn der Header fehlt (SecurityError)', async () => {
    const register = vi.fn()
      .mockRejectedValueOnce(scopeFehler())
      .mockResolvedValueOnce({ scope: 'https://breitundschnell.de/training/' })
    const reg = await registerServiceWorker({ serviceWorker: { register } }, '/training/')
    expect(register).toHaveBeenNthCalledWith(1, '/training/sw.js', { scope: '/training' })
    expect(register).toHaveBeenNthCalledWith(2, '/training/sw.js')
    expect(reg).toEqual({ scope: 'https://breitundschnell.de/training/' })
  })

  it('registriert NICHT ersatzweise eng, wenn nur das Netz weg war', async () => {
    // Sonst hängt nach einem 502 des Proxys für immer eine zweite Registrierung mit dem
    // engen Bereich an der Origin: ab dann lädt jeder Deploy den Precache doppelt.
    const register = vi.fn().mockRejectedValue(new TypeError('Failed to fetch'))
    await expect(registerServiceWorker({ serviceWorker: { register } }, '/training/')).resolves.toBe(null)
    expect(register).toHaveBeenCalledTimes(1)
  })

  it('schluckt auch den zweiten Fehlschlag — eine App ohne Worker läuft trotzdem', async () => {
    const register = vi.fn()
      .mockRejectedValueOnce(scopeFehler())
      .mockRejectedValueOnce(new Error('nope'))
    await expect(registerServiceWorker({ serviceWorker: { register } }, '/training/')).resolves.toBe(null)
    expect(register).toHaveBeenCalledTimes(2)
  })

  it('räumt eine alte enge Registrierung weg, sobald die weite steht', async () => {
    const weit = { scope: 'https://breitundschnell.de/training', unregister: vi.fn() }
    const eng = { scope: 'https://breitundschnell.de/training/', unregister: vi.fn(async () => true) }
    const register = vi.fn().mockResolvedValue(weit)
    const getRegistration = vi.fn(async () => eng)
    const reg = await registerServiceWorker({ serviceWorker: { register, getRegistration } }, '/training/')
    expect(reg).toBe(weit)
    expect(eng.unregister).toHaveBeenCalled()
    expect(weit.unregister).not.toHaveBeenCalled()
  })

  it('fasst die weite Registrierung selbst nie an', async () => {
    // getRegistration('/training/') liefert die WEITE Registrierung mit, denn ihr Bereich
    // deckt /training/ ab — sie darf auf keinen Fall abgemeldet werden.
    const weit = { scope: 'https://breitundschnell.de/training', unregister: vi.fn() }
    const register = vi.fn().mockResolvedValue(weit)
    const getRegistration = vi.fn(async () => weit)
    const reg = await registerServiceWorker({ serviceWorker: { register, getRegistration } }, '/training/')
    expect(reg).toBe(weit)
    expect(weit.unregister).not.toHaveBeenCalled()
  })

  it('räumt an der Wurzel gar nicht auf — dort gibt es keinen engeren Bereich', async () => {
    const wurzel = { scope: 'https://beispiel.de/', unregister: vi.fn() }
    const register = vi.fn().mockResolvedValue(wurzel)
    const getRegistration = vi.fn(async () => wurzel)
    await registerServiceWorker({ serviceWorker: { register, getRegistration } }, '/')
    expect(getRegistration).not.toHaveBeenCalled()
    expect(wurzel.unregister).not.toHaveBeenCalled()
  })

  it('lässt sich vom Aufräumen nicht aus der Ruhe bringen', async () => {
    const weit = { scope: 'https://breitundschnell.de/training' }
    const register = vi.fn().mockResolvedValue(weit)
    const getRegistration = vi.fn(async () => { throw new Error('nope') })
    await expect(registerServiceWorker({ serviceWorker: { register, getRegistration } }, '/training/')).resolves.toBe(weit)
  })

  it('tut nichts, wenn der Browser keine Service Worker kennt', async () => {
    await expect(registerServiceWorker({}, '/training/')).resolves.toBe(null)
    await expect(registerServiceWorker(null, '/training/')).resolves.toBe(null)
  })
})

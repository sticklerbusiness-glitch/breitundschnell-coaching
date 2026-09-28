// B&S: Der Geltungsbereich des Service Workers ist der ganze Grund, warum es dieses Modul gibt
// — hier steht fest, dass er /training OHNE Schrägstrich abdeckt (dort liegt die Seite) und was
// passiert, wenn der Header `Service-Worker-Allowed` nicht durch den Rewrite-Proxy kommt.
import { describe, expect, it, vi } from 'vitest'
import { registerServiceWorker, swScope } from './sw-register.js'

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
    const register = vi.fn().mockResolvedValue({ scope: '/training' })
    const reg = await registerServiceWorker({ serviceWorker: { register } }, '/training/')
    expect(register).toHaveBeenCalledWith('/training/sw.js', { scope: '/training' })
    expect(reg).toEqual({ scope: '/training' })
  })

  it('fällt auf den Standardbereich zurück, wenn der Header fehlt (SecurityError)', async () => {
    const register = vi.fn()
      .mockRejectedValueOnce(new Error('SecurityError'))
      .mockResolvedValueOnce({ scope: '/training/' })
    const reg = await registerServiceWorker({ serviceWorker: { register } }, '/training/')
    expect(register).toHaveBeenNthCalledWith(1, '/training/sw.js', { scope: '/training' })
    expect(register).toHaveBeenNthCalledWith(2, '/training/sw.js')
    expect(reg).toEqual({ scope: '/training/' })
  })

  it('schluckt auch den zweiten Fehlschlag — eine App ohne Worker läuft trotzdem', async () => {
    const register = vi.fn().mockRejectedValue(new Error('nope'))
    await expect(registerServiceWorker({ serviceWorker: { register } }, '/training/')).resolves.toBe(null)
    expect(register).toHaveBeenCalledTimes(2)
  })

  it('tut nichts, wenn der Browser keine Service Worker kennt', async () => {
    await expect(registerServiceWorker({}, '/training/')).resolves.toBe(null)
    await expect(registerServiceWorker(null, '/training/')).resolves.toBe(null)
  })
})

import { describe, it, expect } from 'vitest'
import { deckPlugin, deckPlugins, tailwindPlugin } from '../vite.js'

describe('deckPlugin', () => {
  it('returns a valid Vite plugin object', () => {
    const plugin = deckPlugin()
    expect(plugin).toBeDefined()
    expect(plugin.name).toBe('deck-engine')
    expect(plugin.enforce).toBe('pre')
    expect(typeof plugin.config).toBe('function')
  })

  it('dedupes react and react-dom in resolve config', () => {
    const plugin = deckPlugin()
    const config = plugin.config()

    expect(config.resolve.dedupe).toContain('react')
    expect(config.resolve.dedupe).toContain('react-dom')
  })

  it('keeps optimized dependency cache local to each deck', () => {
    const plugin = deckPlugin()
    const config = plugin.config()

    expect(config.cacheDir).toBe('.vite')
  })

  it('dedupe array contains exactly react and react-dom', () => {
    const plugin = deckPlugin()
    const { dedupe } = plugin.config().resolve

    expect(dedupe).toHaveLength(2)
    expect(dedupe).toContain('react')
    expect(dedupe).toContain('react-dom')
  })

  it('returns a fresh config object on each call', () => {
    const plugin = deckPlugin()
    const config1 = plugin.config()
    const config2 = plugin.config()

    expect(config1).toEqual(config2)
    expect(config1).not.toBe(config2) // distinct object refs
  })

  it('default export matches named export', async () => {
    const mod = await import('../vite.js')
    expect(mod.default).toBe(mod.deckPlugin)
  })

  it('each call to deckPlugin returns an independent plugin', () => {
    const p1 = deckPlugin()
    const p2 = deckPlugin()

    expect(p1).not.toBe(p2)
    expect(p1.name).toBe(p2.name)
  })

  it('accepts an options object with theme', () => {
    const plugin = deckPlugin({ theme: 'shadcn' })
    expect(plugin.name).toBe('deck-engine')
  })
})

describe('deckPlugin inlineEditing option shape', () => {
  it('accepts boolean `inlineEditing: true`', () => {
    const srv = {
      registered: [],
      config: { root: process.cwd(), server: { host: 'localhost' }, logger: { warn() {} } },
      middlewares: { use(mw) { srv.registered.push(mw) } },
    }
    const plugin = deckPlugin({ inlineEditing: true })
    plugin.configureServer(srv)
    expect(srv.registered.length).toBe(1)
  })

  it('accepts namespaced `inlineEditing: { enabled: true }` per Messi spec', () => {
    const srv = {
      registered: [],
      config: { root: process.cwd(), server: { host: 'localhost' }, logger: { warn() {} } },
      middlewares: { use(mw) { srv.registered.push(mw) } },
    }
    const plugin = deckPlugin({ inlineEditing: { enabled: true } })
    plugin.configureServer(srv)
    expect(srv.registered.length).toBe(1)
  })

  it('treats `inlineEditing: { enabled: false }` as disabled', () => {
    const srv = {
      registered: [],
      config: { root: process.cwd(), server: { host: 'localhost' }, logger: { warn() {} } },
      middlewares: { use(mw) { srv.registered.push(mw) } },
    }
    const plugin = deckPlugin({ inlineEditing: { enabled: false } })
    plugin.configureServer(srv)
    expect(srv.registered.length).toBe(0)
  })

  it('treats `inlineEditing: {}` (object without enabled) as disabled', () => {
    const srv = {
      registered: [],
      config: { root: process.cwd(), server: { host: 'localhost' }, logger: { warn() {} } },
      middlewares: { use(mw) { srv.registered.push(mw) } },
    }
    const plugin = deckPlugin({ inlineEditing: {} })
    plugin.configureServer(srv)
    expect(srv.registered.length).toBe(0)
  })

  it('exports a normalizer that resolves both shapes', async () => {
    const { normalizeInlineEditingOption } = await import('../vite.js')
    expect(normalizeInlineEditingOption(true)).toBe(true)
    expect(normalizeInlineEditingOption(false)).toBe(false)
    expect(normalizeInlineEditingOption(undefined)).toBe(false)
    expect(normalizeInlineEditingOption({ enabled: true })).toBe(true)
    expect(normalizeInlineEditingOption({ enabled: false })).toBe(false)
    expect(normalizeInlineEditingOption({})).toBe(false)
    expect(normalizeInlineEditingOption(null)).toBe(false)
    expect(normalizeInlineEditingOption('yes')).toBe(false)
  })
})

describe('deckPlugin inline-edit registration', () => {
  // Build a fake Vite dev server and capture middleware registrations.
  function fakeServer({ host } = {}) {
    const middlewares = []
    return {
      registered: middlewares,
      config: {
        root: process.cwd(),
        server: { host },
        logger: { warn: () => {}, info: () => {} },
      },
      middlewares: {
        use: (mw) => middlewares.push(mw),
      },
    }
  }

  it('does NOT register the inline-edit middleware by default (opt-in)', () => {
    const plugin = deckPlugin()
    const srv = fakeServer()
    plugin.configureServer(srv)
    expect(srv.registered.length).toBe(0)
  })

  it('does NOT register when inlineEditing is explicitly false', () => {
    const plugin = deckPlugin({ inlineEditing: false })
    const srv = fakeServer()
    plugin.configureServer(srv)
    expect(srv.registered.length).toBe(0)
  })

  it('registers a refusing middleware when inlineEditing=true but host is exposed', async () => {
    const plugin = deckPlugin({ inlineEditing: true })
    const srv = fakeServer({ host: '0.0.0.0' })
    plugin.configureServer(srv)
    // Middleware is still registered, but every request is refused with NETWORK_EXPOSED.
    expect(srv.registered.length).toBe(1)
    const mw = srv.registered[0]
    const { EventEmitter } = await import('node:events')
    const req = Object.assign(new EventEmitter(), {
      method: 'POST',
      url: '/__deckio/inline-edit',
      socket: { remoteAddress: '127.0.0.1' },
      headers: { 'content-type': 'application/json' },
      destroy() {},
    })
    let body = ''; let status = 0
    const res = {
      statusCode: 200,
      setHeader() {},
      end(b) { body = b || ''; status = this.statusCode },
    }
    const p = mw(req, res, () => {})
    setImmediate(() => { req.emit('data', Buffer.from('{"field":"a","value":"b"}')); req.emit('end') })
    await p
    await new Promise((r) => setImmediate(r))
    expect(status).toBe(403)
    expect(body).toContain('INLINE_EDIT_DISABLED_REMOTE_HOST')
  })

  it('registers an active middleware when inlineEditing=true and host is loopback', () => {
    const plugin = deckPlugin({ inlineEditing: true })
    const srv = fakeServer({ host: 'localhost' })
    plugin.configureServer(srv)
    expect(srv.registered.length).toBe(1)
  })

  it('registers an active middleware when inlineEditing=true and host is undefined (default loopback)', () => {
    const plugin = deckPlugin({ inlineEditing: true })
    const srv = fakeServer()
    plugin.configureServer(srv)
    expect(srv.registered.length).toBe(1)
  })
})

describe('deckPlugins', () => {
  it('returns an array starting with deck-engine followed by tailwindcss plugins', () => {
    const plugins = deckPlugins()
    expect(Array.isArray(plugins)).toBe(true)
    expect(plugins.length).toBeGreaterThanOrEqual(2)
    expect(plugins[0].name).toBe('deck-engine')
    // Remaining plugins are from @tailwindcss/vite
    const twPlugins = plugins.slice(1)
    expect(twPlugins.length).toBeGreaterThan(0)
    for (const p of twPlugins) {
      expect(p.name).toMatch(/^@tailwindcss\/vite/)
    }
  })

  it('passes theme option through to deckPlugin', () => {
    const plugins = deckPlugins({ theme: 'light' })
    expect(plugins[0].name).toBe('deck-engine')
  })

  it('works with no options', () => {
    const plugins = deckPlugins()
    expect(plugins[0].name).toBe('deck-engine')
  })
})

describe('tailwindPlugin', () => {
  it('returns tailwindcss vite plugin(s)', () => {
    const result = tailwindPlugin()
    // @tailwindcss/vite returns an array of sub-plugins
    const plugins = Array.isArray(result) ? result : [result]
    expect(plugins.length).toBeGreaterThan(0)
    for (const p of plugins) {
      expect(p.name).toMatch(/tailwindcss|@tailwindcss/)
    }
  })
})

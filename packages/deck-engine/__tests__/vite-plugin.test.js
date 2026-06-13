import { describe, it, expect } from 'vitest'
import { deckPlugin, deckPlugins, tailwindPlugin, DECK_WATCH_IGNORED } from '../vite.js'

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
    expect(srv.registered.length).toBe(2)
  })

  it('accepts namespaced `inlineEditing: { enabled: true }` per Messi spec', () => {
    const srv = {
      registered: [],
      config: { root: process.cwd(), server: { host: 'localhost' }, logger: { warn() {} } },
      middlewares: { use(mw) { srv.registered.push(mw) } },
    }
    const plugin = deckPlugin({ inlineEditing: { enabled: true } })
    plugin.configureServer(srv)
    expect(srv.registered.length).toBe(2)
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

  it('registers refusing middlewares when inlineEditing=true but host is exposed', async () => {
    const plugin = deckPlugin({ inlineEditing: true })
    const srv = fakeServer({ host: '0.0.0.0' })
    plugin.configureServer(srv)
    // Both middlewares are still registered, but every request is refused.
    expect(srv.registered.length).toBe(2)
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

    // The slide-ops middleware (registered second) also refuses when exposed.
    const slideMw = srv.registered[1]
    const sReq = Object.assign(new EventEmitter(), {
      method: 'POST',
      url: '/__deckio/slide-op',
      socket: { remoteAddress: '127.0.0.1' },
      headers: { 'content-type': 'application/json' },
      destroy() {},
    })
    let sBody = ''; let sStatus = 0
    const sRes = {
      statusCode: 200,
      setHeader() {},
      end(b) { sBody = b || ''; sStatus = this.statusCode },
    }
    const sp = slideMw(sReq, sRes, () => {})
    setImmediate(() => { sReq.emit('data', Buffer.from('{"op":"hide","index":0,"hidden":true}')); sReq.emit('end') })
    await sp
    await new Promise((r) => setImmediate(r))
    expect(sStatus).toBe(403)
    expect(sBody).toContain('SLIDE_OP_DISABLED_REMOTE_HOST')
  })

  it('registers active middlewares when inlineEditing=true and host is loopback', () => {
    const plugin = deckPlugin({ inlineEditing: true })
    const srv = fakeServer({ host: 'localhost' })
    plugin.configureServer(srv)
    expect(srv.registered.length).toBe(2)
  })

  it('registers active middlewares when inlineEditing=true and host is undefined (default loopback)', () => {
    const plugin = deckPlugin({ inlineEditing: true })
    const srv = fakeServer()
    plugin.configureServer(srv)
    expect(srv.registered.length).toBe(2)
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

describe('deckPlugin watch ignore (chokidar)', () => {
  it('exports the DECK_WATCH_IGNORED constant with the deckio-specific paths', () => {
    // Required entries: anything the launcher / thumbnail svc writes inside a
    // deck that is NOT in the Vite module graph. The thumbnail loop is the
    // hot path — without it, every slide-mutation fan-out fires a chokidar
    // event per JPG in the per-deck Vite watcher.
    expect(DECK_WATCH_IGNORED).toContain('**/.deckio/thumbnails/**')
    expect(DECK_WATCH_IGNORED).toContain('**/.gh-pages-tmp/**')
    expect(DECK_WATCH_IGNORED).toContain('**/.github/eyes/**')
    expect(DECK_WATCH_IGNORED).toContain('**/dist/**')
    expect(DECK_WATCH_IGNORED).toContain('**/coverage/**')
  })

  it('config() sets server.watch.ignored to a SUPERSET of DECK_WATCH_IGNORED', () => {
    const plugin = deckPlugin()
    const config = plugin.config()
    expect(config.server).toBeDefined()
    expect(config.server.watch).toBeDefined()
    expect(Array.isArray(config.server.watch.ignored)).toBe(true)
    for (const pattern of DECK_WATCH_IGNORED) {
      expect(config.server.watch.ignored).toContain(pattern)
    }
  })

  it('does NOT broadly ignore .deckio/** (leaves room for HMR-relevant artifacts)', () => {
    // Regression: an earlier proposal ignored the whole .deckio dir. We
    // narrowed to thumbnails only so future runtime artifacts (manifests,
    // captures we want HMR on, etc.) can still participate in the module
    // graph.
    const plugin = deckPlugin()
    const ignored = plugin.config().server.watch.ignored
    expect(ignored).not.toContain('**/.deckio/**')
  })

  it('does NOT set followSymlinks (preserves Vite default for npm-linked packages)', () => {
    // Regression: an earlier proposal set followSymlinks: false globally.
    // That would silently break HMR for users who `npm link` a local
    // package into a deck. Vite's default `**/node_modules/**` glob already
    // filters the only symlink the launcher creates, so we don't need to
    // disable symlink-following.
    const plugin = deckPlugin()
    const watch = plugin.config().server.watch
    expect(watch.followSymlinks).toBeUndefined()
  })

  it('returns a fresh server.watch.ignored array per call (no shared mutation)', () => {
    const a = deckPlugin().config().server.watch.ignored
    const b = deckPlugin().config().server.watch.ignored
    expect(a).toEqual(b)
    expect(a).not.toBe(b)
    // Mutating one MUST NOT bleed into the other or into the source constant.
    a.push('mutation-test')
    const c = deckPlugin().config().server.watch.ignored
    expect(c).not.toContain('mutation-test')
    expect(DECK_WATCH_IGNORED).not.toContain('mutation-test')
  })
})

describe('deckPlugin watch ignore — Vite createServer merge contract', () => {
  // These tests spin up a real Vite middleware-mode server and inspect the
  // chokidar watcher's effective ignore list. In Vite 8, defaults are merged
  // at the chokidar layer (not in resolveConfig), so this is the only place
  // to verify the final contract. If Vite ever changes from append-merge to
  // replace-merge for this field, these tests will fail loudly instead of
  // silently breaking watch perf.

  async function getWatcherIgnored(userConfig = {}) {
    const { createServer } = await import('vite')
    const server = await createServer({
      plugins: [deckPlugin()],
      configFile: false,
      logLevel: 'silent',
      server: { middlewareMode: true, ...(userConfig.server || {}) },
      ...userConfig,
    })
    try {
      const watcher = server.watcher
      const ignored = watcher._ignored || watcher.options?.ignored || []
      return Array.isArray(ignored) ? ignored : [ignored]
    } finally {
      await server.close()
    }
  }

  it('preserves Vite default ignores (node_modules, .git) alongside ours', async () => {
    const list = await getWatcherIgnored()
    const asStrings = list.map(String)
    // Vite defaults must survive
    expect(asStrings.some((p) => p.includes('node_modules'))).toBe(true)
    expect(asStrings.some((p) => p.includes('.git'))).toBe(true)
    // Our entries must be present
    expect(asStrings).toContain('**/.deckio/thumbnails/**')
    expect(asStrings).toContain('**/.gh-pages-tmp/**')
    expect(asStrings).toContain('**/.github/eyes/**')
  })

  it('preserves user-supplied server.watch.ignored entries', async () => {
    const list = await getWatcherIgnored({
      server: { watch: { ignored: ['**/__sandbox__/**'] } },
    })
    const asStrings = list.map(String)
    expect(asStrings).toContain('**/__sandbox__/**')
    // Our defaults still there
    expect(asStrings).toContain('**/.deckio/thumbnails/**')
    // Vite defaults still there
    expect(asStrings.some((p) => p.includes('node_modules'))).toBe(true)
  })
})

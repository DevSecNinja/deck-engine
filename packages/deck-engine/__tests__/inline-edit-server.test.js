import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdtempSync, rmSync, readFileSync, writeFileSync, existsSync, mkdirSync, symlinkSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { EventEmitter } from 'node:events'
import {
  createInlineEditMiddleware,
  hashOverrides,
  isHostExposed,
  isLoopbackRequest,
  isSameOrigin,
  isValidField,
  isValidValue,
  readOverrides,
  safeOverridePath,
  writeOverridesAtomic,
  ERROR_CODES,
  OVERRIDE_REL_PATH,
  MAX_VALUE_LINES,
} from '../server/inline-edit-server.mjs'

let tempRoot
beforeEach(() => {
  tempRoot = mkdtempSync(join(tmpdir(), 'deckio-inline-edit-'))
})
afterEach(() => {
  rmSync(tempRoot, { recursive: true, force: true })
})

// ----------------------------------------------------------------------
// validation
// ----------------------------------------------------------------------

describe('field + value validation', () => {
  it('accepts dotted lowercase identifiers', () => {
    expect(isValidField('cover.title')).toBe(true)
    expect(isValidField('hero.subtitle_2')).toBe(true)
    expect(isValidField('a-b.c-d')).toBe(true)
  })

  it('rejects path traversal, empty, and oversized fields', () => {
    expect(isValidField('')).toBe(false)
    expect(isValidField('../etc/passwd')).toBe(false)
    expect(isValidField('foo/bar')).toBe(false)
    expect(isValidField('foo bar')).toBe(false)
    expect(isValidField('.hidden')).toBe(false)
    expect(isValidField('a'.repeat(200))).toBe(false)
    expect(isValidField(123)).toBe(false)
    expect(isValidField(null)).toBe(false)
  })

  it('accepts strings up to 4000 chars', () => {
    expect(isValidValue('hello')).toBe(true)
    expect(isValidValue('')).toBe(true)
    expect(isValidValue('a'.repeat(4000))).toBe(true)
    expect(isValidValue('a'.repeat(4001))).toBe(false)
    expect(isValidValue(42)).toBe(false)
  })

  it('rejects values with too many lines', () => {
    const tooMany = Array(MAX_VALUE_LINES + 1).fill('x').join('\n')
    expect(isValidValue(tooMany)).toBe(false)
  })

  it('rejects values containing control characters', () => {
    expect(isValidValue('hello\u0000world')).toBe(false)
    expect(isValidValue('hello\u0007world')).toBe(false)
    // tab/newline allowed
    expect(isValidValue('hello\tworld')).toBe(true)
    expect(isValidValue('hello\nworld')).toBe(true)
  })
})

// ----------------------------------------------------------------------
// path containment
// ----------------------------------------------------------------------

describe('safeOverridePath', () => {
  it('resolves under project root', () => {
    const target = safeOverridePath(tempRoot)
    expect(target.endsWith(join('src', 'data', 'inline-edits.json'))).toBe(true)
  })

  it('refuses paths that escape the project root', () => {
    expect(() => safeOverridePath(tempRoot, '../escape.json')).toThrow()
    expect(() => safeOverridePath(tempRoot, '/etc/passwd')).toThrow()
  })

  it('throws without a root', () => {
    expect(() => safeOverridePath('')).toThrow(/root/)
  })

  it('refuses denylisted segments (node_modules, .git, dist, etc.)', () => {
    expect(() => safeOverridePath(tempRoot, 'node_modules/foo.json')).toThrow()
    expect(() => safeOverridePath(tempRoot, '.git/config')).toThrow()
    expect(() => safeOverridePath(tempRoot, 'dist/bundle.json')).toThrow()
    expect(() => safeOverridePath(tempRoot, '.vite/deps.json')).toThrow()
    expect(() => safeOverridePath(tempRoot, '.cache/foo')).toThrow()
  })

  it('refuses denylisted filenames (package.json, lockfiles, .env)', () => {
    expect(() => safeOverridePath(tempRoot, 'package.json')).toThrow()
    expect(() => safeOverridePath(tempRoot, 'package-lock.json')).toThrow()
    expect(() => safeOverridePath(tempRoot, 'src/.env')).toThrow()
    expect(() => safeOverridePath(tempRoot, 'pnpm-lock.yaml')).toThrow()
  })

  it('refuses targets that escape via symlink', () => {
    // Create a directory outside root, symlink into root.
    const outside = mkdtempSync(join(tmpdir(), 'deckio-outside-'))
    try {
      mkdirSync(join(tempRoot, 'src'), { recursive: true })
      try {
        symlinkSync(outside, join(tempRoot, 'src', 'data'), 'dir')
      } catch (e) {
        // Symlink creation can fail without admin on Windows. Skip in that case.
        if (e && (e.code === 'EPERM' || e.code === 'EACCES')) return
        throw e
      }
      expect(() => safeOverridePath(tempRoot)).toThrow()
    } finally {
      rmSync(outside, { recursive: true, force: true })
    }
  })

  it('tags refusal errors with TARGET_DENIED code', () => {
    try {
      safeOverridePath(tempRoot, '../escape.json')
      throw new Error('should have thrown')
    } catch (err) {
      expect(err.code).toBe(ERROR_CODES.TARGET_DENIED)
    }
  })
})

// ----------------------------------------------------------------------
// override file read/write
// ----------------------------------------------------------------------

describe('writeOverridesAtomic + readOverrides', () => {
  it('creates parent directory and writes JSON', async () => {
    const target = safeOverridePath(tempRoot)
    await writeOverridesAtomic(target, { 'cover.title': 'Hello' })
    expect(existsSync(target)).toBe(true)
    const parsed = JSON.parse(readFileSync(target, 'utf8'))
    expect(parsed['cover.title']).toBe('Hello')
  })

  it('returns empty object for missing file', async () => {
    const target = safeOverridePath(tempRoot)
    expect(await readOverrides(target)).toEqual({})
  })

  it('returns empty object when file is malformed', async () => {
    const target = safeOverridePath(tempRoot)
    mkdirSync(join(tempRoot, 'src', 'data'), { recursive: true })
    writeFileSync(target, 'not-json')
    expect(await readOverrides(target)).toEqual({})
  })

  it('does not leave temp files behind on success', async () => {
    const target = safeOverridePath(tempRoot)
    await writeOverridesAtomic(target, { a: '1' })
    await writeOverridesAtomic(target, { a: '2' })
    const dir = join(tempRoot, 'src', 'data')
    const { readdirSync } = await import('node:fs')
    const files = readdirSync(dir)
    expect(files.filter((f) => f.includes('.tmp')).length).toBe(0)
    expect(files).toContain('inline-edits.json')
  })

  it('refuses to write payloads larger than the override file cap', async () => {
    const target = safeOverridePath(tempRoot)
    const big = {}
    // ~512 KB worth of values, exceeds 256 KB cap.
    for (let i = 0; i < 200; i++) big['k' + i] = 'x'.repeat(3000)
    await expect(writeOverridesAtomic(target, big)).rejects.toThrow()
  })
})

// ----------------------------------------------------------------------
// host & origin checks
// ----------------------------------------------------------------------

describe('isLoopbackRequest', () => {
  it('accepts loopback addresses', () => {
    expect(isLoopbackRequest({ socket: { remoteAddress: '127.0.0.1' } })).toBe(true)
    expect(isLoopbackRequest({ socket: { remoteAddress: '::1' } })).toBe(true)
    expect(isLoopbackRequest({ socket: { remoteAddress: '::ffff:127.0.0.1' } })).toBe(true)
  })

  it('refuses non-loopback', () => {
    expect(isLoopbackRequest({ socket: { remoteAddress: '10.0.0.5' } })).toBe(false)
    expect(isLoopbackRequest({ socket: {} })).toBe(false)
    expect(isLoopbackRequest({})).toBe(false)
  })
})

describe('isHostExposed', () => {
  it('treats loopback host options as not exposed', () => {
    expect(isHostExposed(undefined)).toBe(false)
    expect(isHostExposed(false)).toBe(false)
    expect(isHostExposed('localhost')).toBe(false)
    expect(isHostExposed('127.0.0.1')).toBe(false)
    expect(isHostExposed('::1')).toBe(false)
  })

  it('flags 0.0.0.0, true, LAN ips, and arbitrary hostnames as exposed', () => {
    expect(isHostExposed(true)).toBe(true)
    expect(isHostExposed('0.0.0.0')).toBe(true)
    expect(isHostExposed('::')).toBe(true)
    expect(isHostExposed('192.168.1.10')).toBe(true)
    expect(isHostExposed('demo.example.com')).toBe(true)
    expect(isHostExposed('')).toBe(true)
  })
})

describe('isSameOrigin', () => {
  it('allows requests with no Origin/Referer (e.g. curl, dev tools)', () => {
    expect(isSameOrigin({ headers: {} })).toBe(true)
  })
  it('allows loopback origins', () => {
    expect(isSameOrigin({ headers: { origin: 'http://localhost:5173' } })).toBe(true)
    expect(isSameOrigin({ headers: { origin: 'http://127.0.0.1:5173' } })).toBe(true)
    expect(isSameOrigin({ headers: { referer: 'http://[::1]:5173/foo' } })).toBe(true)
  })
  it('refuses cross-origin', () => {
    expect(isSameOrigin({ headers: { origin: 'https://evil.example.com' } })).toBe(false)
    expect(isSameOrigin({ headers: { origin: 'not-a-url' } })).toBe(false)
  })
})

// ----------------------------------------------------------------------
// middleware integration
// ----------------------------------------------------------------------

class FakeReq extends EventEmitter {
  constructor({
    method = 'POST',
    url = '/__deckio/inline-edit',
    remoteAddress = '127.0.0.1',
    contentType = 'application/json',
    origin,
  } = {}) {
    super()
    this.method = method
    this.url = url
    this.socket = { remoteAddress }
    this.headers = {}
    if (contentType) this.headers['content-type'] = contentType
    if (origin) this.headers['origin'] = origin
  }
  destroy() { /* noop for tests */ }
}

class FakeRes {
  constructor() {
    this.statusCode = 200
    this.headers = {}
    this.body = ''
    this.ended = false
  }
  setHeader(name, val) { this.headers[name.toLowerCase()] = val }
  end(body) { this.body = body || ''; this.ended = true }
}

function send(req, body) {
  setImmediate(() => {
    if (body !== null) req.emit('data', Buffer.from(body))
    req.emit('end')
  })
}

async function drive(mw, req, res, body) {
  let nextCalled = false
  const p = mw(req, res, () => { nextCalled = true })
  if (body !== undefined) send(req, typeof body === 'string' ? body : JSON.stringify(body))
  await p
  // Allow chained microtasks (write lock + atomic write) to settle.
  for (let i = 0; i < 5; i++) await new Promise((r) => setImmediate(r))
  return { nextCalled }
}

describe('createInlineEditMiddleware', () => {
  it('writes a valid override and returns ok with hash', async () => {
    const mw = createInlineEditMiddleware({ root: tempRoot })
    const req = new FakeReq()
    const res = new FakeRes()
    await drive(mw, req, res, { field: 'cover.title', value: 'New Title' })
    expect(res.statusCode).toBe(200)
    const reply = JSON.parse(res.body)
    expect(reply.ok).toBe(true)
    expect(reply.field).toBe('cover.title')
    expect(typeof reply.hash).toBe('string')
    const written = JSON.parse(readFileSync(safeOverridePath(tempRoot), 'utf8'))
    expect(written['cover.title']).toBe('New Title')
    expect(reply.hash).toBe(hashOverrides(written))
  })

  it('accepts explicit kind=override (v2-readiness discriminator)', async () => {
    const mw = createInlineEditMiddleware({ root: tempRoot })
    const req = new FakeReq()
    const res = new FakeRes()
    await drive(mw, req, res, { kind: 'override', field: 'cover.title', value: 'Hi' })
    expect(res.statusCode).toBe(200)
    expect(JSON.parse(res.body).ok).toBe(true)
  })

  it('rejects unknown kind with 400 INLINE_EDIT_UNKNOWN_KIND', async () => {
    const mw = createInlineEditMiddleware({ root: tempRoot })
    const req = new FakeReq()
    const res = new FakeRes()
    await drive(mw, req, res, { kind: 'source-span', field: 'cover.title', value: 'x' })
    expect(res.statusCode).toBe(400)
    expect(JSON.parse(res.body).code).toBe(ERROR_CODES.UNKNOWN_KIND)
    // Ensure no write happened.
    expect(existsSync(join(tempRoot, OVERRIDE_REL_PATH))).toBe(false)
  })

  it('rejects non-loopback requests with 403', async () => {
    const mw = createInlineEditMiddleware({ root: tempRoot })
    const req = new FakeReq({ remoteAddress: '8.8.8.8' })
    const res = new FakeRes()
    await drive(mw, req, res, { field: 'cover.title', value: 'x' })
    expect(res.statusCode).toBe(403)
    expect(JSON.parse(res.body).code).toBe(ERROR_CODES.REMOTE_CLIENT)
    expect(existsSync(join(tempRoot, OVERRIDE_REL_PATH))).toBe(false)
  })

  it('refuses every request with NETWORK_EXPOSED when networkExposed=true', async () => {
    const mw = createInlineEditMiddleware({ root: tempRoot, networkExposed: true })
    const req = new FakeReq()
    const res = new FakeRes()
    await drive(mw, req, res, { field: 'cover.title', value: 'x' })
    expect(res.statusCode).toBe(403)
    const reply = JSON.parse(res.body)
    expect(reply.code).toBe(ERROR_CODES.NETWORK_EXPOSED)
    // Sanitized: no path/username/stack.
    expect(reply.message).not.toMatch(/[A-Za-z]:\\|\/Users\/|\/home\//)
  })

  it('refuses cross-origin requests with 403', async () => {
    const mw = createInlineEditMiddleware({ root: tempRoot })
    const req = new FakeReq({ origin: 'https://evil.example.com' })
    const res = new FakeRes()
    await drive(mw, req, res, { field: 'cover.title', value: 'x' })
    expect(res.statusCode).toBe(403)
    expect(JSON.parse(res.body).code).toBe(ERROR_CODES.CROSS_ORIGIN)
  })

  it('rejects non-POST with 405', async () => {
    const mw = createInlineEditMiddleware({ root: tempRoot })
    const req = new FakeReq({ method: 'GET' })
    const res = new FakeRes()
    await mw(req, res, () => {})
    expect(res.statusCode).toBe(405)
  })

  it('rejects missing or wrong content-type with 415', async () => {
    const mw = createInlineEditMiddleware({ root: tempRoot })
    const req = new FakeReq({ contentType: 'text/plain' })
    const res = new FakeRes()
    await drive(mw, req, res, { field: 'cover.title', value: 'x' })
    expect(res.statusCode).toBe(415)
    expect(JSON.parse(res.body).code).toBe(ERROR_CODES.CONTENT_TYPE)
  })

  it('passes through unrelated URLs', async () => {
    const mw = createInlineEditMiddleware({ root: tempRoot })
    const req = new FakeReq({ url: '/something-else' })
    const res = new FakeRes()
    let nextCalled = false
    await mw(req, res, () => { nextCalled = true })
    expect(nextCalled).toBe(true)
    expect(res.ended).toBe(false)
  })

  it('rejects invalid field with 400', async () => {
    const mw = createInlineEditMiddleware({ root: tempRoot })
    const req = new FakeReq()
    const res = new FakeRes()
    await drive(mw, req, res, { field: '../escape', value: 'oops' })
    expect(res.statusCode).toBe(400)
    expect(JSON.parse(res.body).code).toBe(ERROR_CODES.FIELD)
  })

  it('rejects oversized value with 400', async () => {
    const mw = createInlineEditMiddleware({ root: tempRoot })
    const req = new FakeReq()
    const res = new FakeRes()
    await drive(mw, req, res, { field: 'cover.title', value: 'a'.repeat(5000) })
    expect(res.statusCode).toBe(400)
    expect(JSON.parse(res.body).code).toBe(ERROR_CODES.VALUE)
  })

  it('rejects values with too many newlines', async () => {
    const mw = createInlineEditMiddleware({ root: tempRoot })
    const req = new FakeReq()
    const res = new FakeRes()
    const tooManyLines = Array(MAX_VALUE_LINES + 1).fill('x').join('\n')
    await drive(mw, req, res, { field: 'cover.title', value: tooManyLines })
    expect(res.statusCode).toBe(400)
  })

  it('merges with existing overrides instead of clobbering', async () => {
    const target = safeOverridePath(tempRoot)
    await writeOverridesAtomic(target, { 'a.b': 'kept' })

    const mw = createInlineEditMiddleware({ root: tempRoot })
    const req = new FakeReq()
    const res = new FakeRes()
    await drive(mw, req, res, { field: 'cover.title', value: 'added' })

    const written = JSON.parse(readFileSync(target, 'utf8'))
    expect(written['a.b']).toBe('kept')
    expect(written['cover.title']).toBe('added')
  })

  it('returns 409 STALE_SOURCE when baseHash does not match', async () => {
    const target = safeOverridePath(tempRoot)
    await writeOverridesAtomic(target, { 'a.b': 'truth' })

    const mw = createInlineEditMiddleware({ root: tempRoot })
    const req = new FakeReq()
    const res = new FakeRes()
    await drive(mw, req, res, { field: 'cover.title', value: 'oops', baseHash: 'stale-hash' })

    expect(res.statusCode).toBe(409)
    const reply = JSON.parse(res.body)
    expect(reply.code).toBe(ERROR_CODES.STALE_SOURCE)
    expect(reply.hash).toBe(hashOverrides({ 'a.b': 'truth' }))
    const after = JSON.parse(readFileSync(target, 'utf8'))
    expect(after).toEqual({ 'a.b': 'truth' })
  })

  it('accepts a baseHash that matches and returns the new hash', async () => {
    const target = safeOverridePath(tempRoot)
    await writeOverridesAtomic(target, { 'a.b': 'truth' })
    const baseHash = hashOverrides({ 'a.b': 'truth' })

    const mw = createInlineEditMiddleware({ root: tempRoot })
    const req = new FakeReq()
    const res = new FakeRes()
    await drive(mw, req, res, { field: 'cover.title', value: 'added', baseHash })

    expect(res.statusCode).toBe(200)
    const reply = JSON.parse(res.body)
    expect(reply.ok).toBe(true)
    expect(reply.hash).not.toBe(baseHash)
  })

  it('persists raw text as a JSON string (no HTML/script execution context)', async () => {
    const mw = createInlineEditMiddleware({ root: tempRoot })
    const req = new FakeReq()
    const res = new FakeRes()
    const payload = '<script>alert(1)</script> & "quotes"'
    await drive(mw, req, res, { field: 'cover.title', value: payload })
    expect(res.statusCode).toBe(200)
    const target = safeOverridePath(tempRoot)
    const raw = readFileSync(target, 'utf8')
    // Round-trips as a string under the field key.
    const parsed = JSON.parse(raw)
    expect(parsed['cover.title']).toBe(payload)
    // The on-disk artifact is JSON, not HTML — quotes are properly escaped
    // and there is no top-level script context.
    expect(raw.startsWith('{')).toBe(true)
    expect(raw).toContain('\\"quotes\\"')
  })

  it('serializes concurrent writes to the same target', async () => {
    const mw = createInlineEditMiddleware({ root: tempRoot })
    const reqs = Array.from({ length: 5 }, () => new FakeReq())
    const resps = reqs.map(() => new FakeRes())
    const fields = ['a.one', 'a.two', 'a.three', 'a.four', 'a.five']

    await Promise.all(reqs.map((req, i) =>
      drive(mw, req, resps[i], { field: fields[i], value: 'v' + i }),
    ))

    for (const res of resps) expect(res.statusCode).toBe(200)
    const target = safeOverridePath(tempRoot)
    const written = JSON.parse(readFileSync(target, 'utf8'))
    for (let i = 0; i < fields.length; i++) {
      expect(written[fields[i]]).toBe('v' + i)
    }
  })

  it('error responses contain no absolute paths or stack traces', async () => {
    const mw = createInlineEditMiddleware({ root: tempRoot })
    // Missing content-type → 415
    const req = new FakeReq({ contentType: 'text/plain' })
    const res = new FakeRes()
    await drive(mw, req, res, { field: 'cover.title', value: 'x' })
    expect(res.body).not.toMatch(/[A-Za-z]:\\/) // no Windows path
    expect(res.body).not.toMatch(/\/Users\/|\/home\//)
    expect(res.body).not.toMatch(/at\s+\w+.*\(.*:\d+:\d+\)/) // no stack frames
  })
})

describe('hashOverrides', () => {
  it('is stable across calls for equivalent input', () => {
    expect(hashOverrides({ a: '1' })).toBe(hashOverrides({ a: '1' }))
  })
  it('changes when content changes', () => {
    expect(hashOverrides({ a: '1' })).not.toBe(hashOverrides({ a: '2' }))
  })
})

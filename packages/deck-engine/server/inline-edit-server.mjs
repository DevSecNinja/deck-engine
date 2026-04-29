/**
 * Inline-edit server helpers + Vite dev middleware.
 *
 * MVP scope (Decision 63):
 *   - Local Vite dev only — never enabled in production builds.
 *   - Persists field overrides to a project-local JSON file
 *     (default: src/data/inline-edits.json).
 *   - Refuses unsafe writes: paths must resolve under the project root,
 *     requests must originate from loopback, fields/values are bounded
 *     and validated.
 *
 * The HTTP surface and helpers are deliberately small so the v2
 * AST/source-span patcher can reuse `safeOverridePath`,
 * `writeOverridesAtomic`, `readOverrides`, and the loopback gate.
 */
import { promises as fs } from 'node:fs'
import path from 'node:path'
import { createHash } from 'node:crypto'

export const OVERRIDE_REL_PATH = path.posix.join('src', 'data', 'inline-edits.json')
export const FIELD_PATTERN = /^[a-zA-Z0-9][a-zA-Z0-9_.\-]{0,127}$/
export const MAX_VALUE_LENGTH = 4000
export const MAX_BODY_BYTES = 64 * 1024

const LOOPBACK_HOSTS = new Set([
  '127.0.0.1',
  '::1',
  '::ffff:127.0.0.1',
])

export function isValidField(field) {
  return typeof field === 'string' && FIELD_PATTERN.test(field)
}

export function isValidValue(value) {
  return typeof value === 'string' && value.length <= MAX_VALUE_LENGTH
}

export function hashOverrides(overrides) {
  const text = JSON.stringify(overrides || {})
  return createHash('sha256').update(text).digest('hex').slice(0, 16)
}

/**
 * Resolve and validate the override file path under the given project root.
 * Throws if the resolved path escapes the root (defense in depth even though
 * the relative path is hard-coded).
 */
export function safeOverridePath(root, relPath = OVERRIDE_REL_PATH) {
  if (typeof root !== 'string' || !root) {
    throw new Error('inline-edit: project root is required')
  }
  const resolvedRoot = path.resolve(root)
  const target = path.resolve(resolvedRoot, relPath)
  const rel = path.relative(resolvedRoot, target)
  if (!rel || rel.startsWith('..') || path.isAbsolute(rel)) {
    throw new Error('inline-edit: override path escapes project root')
  }
  return target
}

export async function readOverrides(file) {
  let raw
  try {
    raw = await fs.readFile(file, 'utf8')
  } catch (err) {
    if (err && err.code === 'ENOENT') return {}
    throw err
  }
  try {
    const parsed = JSON.parse(raw)
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return parsed
    }
  } catch {
    // Corrupt override file — fall back to empty so dev can recover by editing.
  }
  return {}
}

export async function writeOverridesAtomic(file, data) {
  const dir = path.dirname(file)
  await fs.mkdir(dir, { recursive: true })
  const tmp = path.join(
    dir,
    `.inline-edits.${process.pid}.${Date.now()}.${Math.random().toString(36).slice(2, 8)}.tmp`,
  )
  const payload = JSON.stringify(data, null, 2) + '\n'
  await fs.writeFile(tmp, payload, 'utf8')
  try {
    await fs.rename(tmp, file)
  } catch (err) {
    try { await fs.unlink(tmp) } catch { /* ignore */ }
    throw err
  }
}

export function isLoopbackRequest(req) {
  const remote = req && req.socket && req.socket.remoteAddress
  if (!remote) return false
  return LOOPBACK_HOSTS.has(remote)
}

function readJsonBody(req, limit = MAX_BODY_BYTES) {
  return new Promise((resolve, reject) => {
    let total = 0
    const chunks = []
    req.on('data', (chunk) => {
      total += chunk.length
      if (total > limit) {
        reject(new Error('inline-edit: payload too large'))
        try { req.destroy() } catch { /* ignore */ }
        return
      }
      chunks.push(chunk)
    })
    req.on('end', () => {
      try {
        const text = Buffer.concat(chunks).toString('utf8')
        resolve(text ? JSON.parse(text) : {})
      } catch (err) {
        reject(err)
      }
    })
    req.on('error', reject)
  })
}

function sendJson(res, status, body) {
  res.statusCode = status
  res.setHeader('content-type', 'application/json')
  res.end(JSON.stringify(body))
}

/**
 * Build a Vite/connect middleware that handles POST /__deckio/inline-edit.
 * Pure factory over `{ root }` so tests can drive it without a real server.
 */
export function createInlineEditMiddleware({ root, relPath = OVERRIDE_REL_PATH } = {}) {
  return async function inlineEditMiddleware(req, res, next) {
    if (!req || req.url !== '/__deckio/inline-edit') return next()
    if (req.method !== 'POST') {
      sendJson(res, 405, { ok: false, error: 'method-not-allowed' })
      return
    }
    if (!isLoopbackRequest(req)) {
      sendJson(res, 403, { ok: false, error: 'forbidden-non-loopback' })
      return
    }

    let body
    try {
      body = await readJsonBody(req)
    } catch (err) {
      sendJson(res, 400, { ok: false, error: 'invalid-json' })
      return
    }

    const { field, value } = body || {}
    if (!isValidField(field)) {
      sendJson(res, 400, { ok: false, error: 'invalid-field' })
      return
    }
    if (!isValidValue(value)) {
      sendJson(res, 400, { ok: false, error: 'invalid-value' })
      return
    }

    let target
    try {
      target = safeOverridePath(root, relPath)
    } catch (err) {
      sendJson(res, 500, { ok: false, error: 'unsafe-path' })
      return
    }

    try {
      const current = await readOverrides(target)
      const currentHash = hashOverrides(current)
      const { baseHash } = body || {}
      if (typeof baseHash === 'string' && baseHash && baseHash !== currentHash) {
        sendJson(res, 409, { ok: false, error: 'source-changed', hash: currentHash })
        return
      }
      current[field] = value
      await writeOverridesAtomic(target, current)
      const nextHash = hashOverrides(current)
      sendJson(res, 200, { ok: true, field, hash: nextHash })
    } catch (err) {
      sendJson(res, 500, { ok: false, error: 'write-failed' })
      return
    }
  }
}

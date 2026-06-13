/**
 * slide-ops-server — dev-only Vite middleware for deterministic slide ops.
 *
 * Endpoint: POST /__deckio/slide-op
 *
 * Mirrors the security posture of inline-edit-server.mjs (the two share the
 * same dev-write threat model):
 *   - Dev-only (mounted from configureServer; inert in `vite build`).
 *   - Opt-in via deckPlugin({ inlineEditing: true }).
 *   - Refused when the dev server is exposed on the network (networkExposed).
 *   - Loopback-only client + same-origin Origin/Referer.
 *   - application/json + bounded body.
 *   - Realpath-based containment for every path it touches (deck.config.js and
 *     the slide files it deletes); denylisted segments refused.
 *   - Per-target async write mutex + atomic write (tmp + rename).
 *
 * The actual edits are delegated to the pure codemods in slide-ops.mjs so they
 * are unit-testable in isolation and identical across the in-deck buttons and
 * the launcher thumbnail strip.
 *
 * Wire protocol (request body):
 *   { op: 'delete' | 'hide' | 'reorder',
 *     index: number,            // slide to operate on
 *     toIndex?: number,         // reorder target
 *     hidden?: boolean,         // hide/show flag (op === 'hide')
 *     total?: number }          // optional staleness guard
 *
 * Response (200):
 *   { ok: true, op, total, hiddenSlides: number[], slides: string[],
 *     removed?: { name, kind, files: string[] } }
 */
import { promises as fs, realpathSync } from 'node:fs'
import path from 'node:path'

import {
  isLoopbackRequest,
  isSameOrigin,
} from './inline-edit-server.mjs'
import {
  parseDeckConfig,
  reorderSlides,
  deleteSlide,
  setSlideHidden,
  SLIDE_OP_ERROR_CODES,
} from './slide-ops.mjs'

export const ENDPOINT_PATH = '/__deckio/slide-op'
export const DECK_CONFIG_REL = 'deck.config.js'

const MAX_BODY_BYTES = 16 * 1024
const MAX_CONFIG_BYTES = 512 * 1024

const DENY_SEGMENTS = new Set([
  'node_modules', '.git', '.hg', '.svn', 'dist', 'build', 'out',
  '.vite', '.cache', '.next', '.turbo', '.parcel-cache',
])

// Slide files this endpoint is permitted to delete: local slide modules and
// their CSS, anywhere under src/slides/.
const SLIDE_FILE_RE = /^src\/slides\/[\w./-]+\.(?:jsx|tsx|module\.css)$/

export const ERROR_CODES = Object.freeze({
  NETWORK_EXPOSED: 'SLIDE_OP_DISABLED_REMOTE_HOST',
  REMOTE_CLIENT: 'SLIDE_OP_REMOTE_CLIENT',
  CROSS_ORIGIN: 'SLIDE_OP_CROSS_ORIGIN',
  METHOD: 'SLIDE_OP_METHOD_NOT_ALLOWED',
  CONTENT_TYPE: 'SLIDE_OP_BAD_CONTENT_TYPE',
  PAYLOAD: 'SLIDE_OP_BAD_PAYLOAD',
  INVALID_OP: SLIDE_OP_ERROR_CODES.INVALID_OP,
  INVALID_INDEX: SLIDE_OP_ERROR_CODES.INDEX_OUT_OF_RANGE,
  UNSUPPORTED_CONFIG: SLIDE_OP_ERROR_CODES.UNSUPPORTED_CONFIG,
  NO_SLIDES_ARRAY: SLIDE_OP_ERROR_CODES.NO_SLIDES_ARRAY,
  EMPTY_RESULT: SLIDE_OP_ERROR_CODES.EMPTY_RESULT,
  TARGET_DENIED: 'SLIDE_OP_TARGET_DENIED',
  STALE_SOURCE: 'SLIDE_OP_STALE_SOURCE',
  WRITE_FAILED: 'SLIDE_OP_WRITE_FAILED',
  TOO_LARGE: 'SLIDE_OP_CONFIG_TOO_LARGE',
})

const ERROR_MESSAGES = Object.freeze({
  [ERROR_CODES.NETWORK_EXPOSED]: 'Slide ops are disabled when the dev server is exposed on the network.',
  [ERROR_CODES.REMOTE_CLIENT]: 'Slide ops only accept requests from this machine.',
  [ERROR_CODES.CROSS_ORIGIN]: 'Slide ops only accept requests from the dev server origin.',
  [ERROR_CODES.METHOD]: 'Method not allowed.',
  [ERROR_CODES.CONTENT_TYPE]: 'Content-Type must be application/json.',
  [ERROR_CODES.PAYLOAD]: 'Request body is invalid.',
  [ERROR_CODES.INVALID_OP]: 'Unknown slide operation.',
  [ERROR_CODES.INVALID_INDEX]: 'Slide index is out of range.',
  [ERROR_CODES.UNSUPPORTED_CONFIG]: 'deck.config.js uses a slides shape this tool cannot edit safely.',
  [ERROR_CODES.NO_SLIDES_ARRAY]: 'deck.config.js has no editable slides array.',
  [ERROR_CODES.EMPTY_RESULT]: 'Cannot delete the last remaining slide.',
  [ERROR_CODES.TARGET_DENIED]: 'Target is not eligible for slide ops.',
  [ERROR_CODES.STALE_SOURCE]: 'Slides changed. Refresh and try again.',
  [ERROR_CODES.WRITE_FAILED]: 'Could not save the change.',
  [ERROR_CODES.TOO_LARGE]: 'deck.config.js exceeds the size limit.',
})

function realpathOrSelf(p) {
  try { return realpathSync(p) } catch { return p }
}

function targetDenied(message) {
  const err = new Error(message || 'slide-op: target denied')
  err.code = ERROR_CODES.TARGET_DENIED
  return err
}

/**
 * Resolve + validate a path relative to the project root. Uses realpath on the
 * parent (the file may not exist) to resist symlink escapes, refuses traversal
 * outside root and denylisted segments. Returns the canonical absolute path.
 */
function safePath(root, relPath) {
  if (typeof root !== 'string' || !root) throw targetDenied('slide-op: root required')
  const resolvedRoot = realpathOrSelf(path.resolve(root))
  const target = path.resolve(resolvedRoot, relPath)
  const realParent = realpathOrSelf(path.dirname(target))
  const realTarget = path.join(realParent, path.basename(target))
  const rel = path.relative(resolvedRoot, realTarget)
  if (!rel || rel.startsWith('..') || path.isAbsolute(rel)) {
    throw targetDenied('slide-op: target outside project root')
  }
  for (const seg of rel.split(/[\\/]+/)) {
    if (DENY_SEGMENTS.has(seg)) throw targetDenied('slide-op: denied path segment')
  }
  return realTarget
}

function readJsonBody(req, limit = MAX_BODY_BYTES) {
  return new Promise((resolve, reject) => {
    let total = 0
    const chunks = []
    req.on('data', (chunk) => {
      total += chunk.length
      if (total > limit) {
        const err = new Error('slide-op: payload too large')
        err.code = ERROR_CODES.PAYLOAD
        reject(err)
        try { req.destroy() } catch { /* ignore */ }
        return
      }
      chunks.push(chunk)
    })
    req.on('end', () => {
      try {
        const text = Buffer.concat(chunks).toString('utf8')
        resolve(text ? JSON.parse(text) : {})
      } catch {
        const err = new Error('slide-op: invalid json')
        err.code = ERROR_CODES.PAYLOAD
        reject(err)
      }
    })
    req.on('error', () => {
      const err = new Error('slide-op: stream error')
      err.code = ERROR_CODES.PAYLOAD
      reject(err)
    })
  })
}

function sendJson(res, status, body) {
  res.statusCode = status
  res.setHeader('content-type', 'application/json')
  res.end(JSON.stringify(body))
}

function sendError(res, status, code) {
  sendJson(res, status, {
    ok: false,
    code,
    error: code,
    message: ERROR_MESSAGES[code] || 'Slide op failed.',
  })
}

// Per-target write mutex, keyed by canonical config path. Serializes concurrent
// ops on the same deck so two clicks can't race on deck.config.js.
const writeLocks = new Map()
async function withWriteLock(key, fn) {
  const previous = writeLocks.get(key) || Promise.resolve()
  let release
  const next = new Promise((r) => { release = r })
  writeLocks.set(key, previous.then(() => next))
  await previous
  try {
    return await fn()
  } finally {
    release()
    if (writeLocks.get(key) === next) writeLocks.delete(key)
  }
}

async function writeConfigAtomic(file, text) {
  if (Buffer.byteLength(text, 'utf8') > MAX_CONFIG_BYTES) {
    const err = new Error('slide-op: config too large')
    err.code = ERROR_CODES.TOO_LARGE
    throw err
  }
  const dir = path.dirname(file)
  const tmp = path.join(
    dir,
    `.deck.config.${process.pid}.${Date.now()}.${Math.random().toString(36).slice(2, 8)}.tmp`,
  )
  await fs.writeFile(tmp, text, 'utf8')
  try {
    await fs.rename(tmp, file)
  } catch (err) {
    try { await fs.unlink(tmp) } catch { /* ignore */ }
    throw err
  }
}

/**
 * Delete the reported slide files. Each path is re-validated to live under
 * src/slides/ with an expected extension and contained within root. Missing
 * files are tolerated; other per-file errors are swallowed so a stray
 * permission issue can't leave deck.config.js (already written) inconsistent.
 */
async function deleteSlideFiles(root, files) {
  const deleted = []
  for (const rel of Array.isArray(files) ? files : []) {
    const norm = String(rel).replace(/\\/g, '/')
    if (norm.includes('..') || !SLIDE_FILE_RE.test(norm)) continue
    let target
    try { target = safePath(root, norm) } catch { continue }
    try {
      await fs.unlink(target)
      deleted.push(norm)
    } catch (err) {
      if (err && err.code !== 'ENOENT') { /* tolerate */ }
    }
  }
  return deleted
}

function isInt(n) {
  return typeof n === 'number' && Number.isInteger(n)
}

function codeToStatus(code) {
  switch (code) {
    case ERROR_CODES.STALE_SOURCE: return 409
    case ERROR_CODES.INVALID_INDEX: return 400
    case ERROR_CODES.INVALID_OP: return 400
    case ERROR_CODES.EMPTY_RESULT: return 400
    case ERROR_CODES.UNSUPPORTED_CONFIG: return 422
    case ERROR_CODES.NO_SLIDES_ARRAY: return 422
    case ERROR_CODES.TARGET_DENIED: return 403
    case ERROR_CODES.TOO_LARGE: return 413
    default: return 500
  }
}

/**
 * Build a Vite/connect middleware that handles POST /__deckio/slide-op.
 *
 * Options:
 *   - root           (required) canonical project root
 *   - networkExposed (boolean)  if true, every request is refused
 */
export function createSlideOpsMiddleware({ root, networkExposed = false } = {}) {
  return async function slideOpsMiddleware(req, res, next) {
    if (!req || !req.url) return next()
    // Match the canonical path AND any proxy-prefixed variant ending in it
    // (the launcher forwards `/preview/<deckId>/__deckio/slide-op`).
    const url = req.url
    const queryIdx = url.indexOf('?')
    const pathname = queryIdx === -1 ? url : url.slice(0, queryIdx)
    if (pathname !== ENDPOINT_PATH && !pathname.endsWith(ENDPOINT_PATH)) return next()

    if (req.method !== 'POST') return sendError(res, 405, ERROR_CODES.METHOD)
    if (networkExposed) return sendError(res, 403, ERROR_CODES.NETWORK_EXPOSED)
    if (!isLoopbackRequest(req)) return sendError(res, 403, ERROR_CODES.REMOTE_CLIENT)
    if (!isSameOrigin(req)) return sendError(res, 403, ERROR_CODES.CROSS_ORIGIN)

    const ctype = (req.headers && req.headers['content-type']) || ''
    if (!String(ctype).toLowerCase().startsWith('application/json')) {
      return sendError(res, 415, ERROR_CODES.CONTENT_TYPE)
    }

    let body
    try {
      body = await readJsonBody(req)
    } catch {
      return sendError(res, 400, ERROR_CODES.PAYLOAD)
    }
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      return sendError(res, 400, ERROR_CODES.PAYLOAD)
    }

    const { op, index, toIndex, hidden, total } = body
    if (op !== 'delete' && op !== 'hide' && op !== 'reorder') {
      return sendError(res, 400, ERROR_CODES.INVALID_OP)
    }
    if (!isInt(index) || index < 0) return sendError(res, 400, ERROR_CODES.INVALID_INDEX)
    if (op === 'reorder' && (!isInt(toIndex) || toIndex < 0)) {
      return sendError(res, 400, ERROR_CODES.INVALID_INDEX)
    }
    if (op === 'hide' && typeof hidden !== 'boolean') {
      return sendError(res, 400, ERROR_CODES.PAYLOAD)
    }
    if (total != null && !isInt(total)) return sendError(res, 400, ERROR_CODES.PAYLOAD)

    let configPath
    try {
      configPath = safePath(root, DECK_CONFIG_REL)
    } catch {
      return sendError(res, 403, ERROR_CODES.TARGET_DENIED)
    }

    try {
      await withWriteLock(configPath, async () => {
        let current
        try {
          current = await fs.readFile(configPath, 'utf8')
        } catch {
          throw Object.assign(new Error('no config'), { code: ERROR_CODES.NO_SLIDES_ARRAY })
        }

        const before = parseDeckConfig(current)
        // Lightweight staleness guard: clients send the slide count they last
        // saw. A mismatch means the deck changed under them — bail with 409.
        if (total != null && total !== before.slides.length) {
          throw Object.assign(new Error('stale'), { code: ERROR_CODES.STALE_SOURCE })
        }

        let result
        let removed = null
        if (op === 'reorder') {
          result = reorderSlides(current, index, toIndex)
        } else if (op === 'hide') {
          result = setSlideHidden(current, index, hidden)
        } else { // delete
          if (before.slides.length <= 1) {
            throw Object.assign(new Error('empty'), { code: ERROR_CODES.EMPTY_RESULT })
          }
          const del = deleteSlide(current, index)
          result = del
          removed = { name: del.removedName, kind: del.kind, files: del.filesToDelete }
        }

        await writeConfigAtomic(configPath, result.text)

        let deletedFiles = []
        if (removed && removed.files.length) {
          deletedFiles = await deleteSlideFiles(root, removed.files)
        }

        const after = parseDeckConfig(result.text)
        sendJson(res, 200, {
          ok: true,
          op,
          total: after.slides.length,
          hiddenSlides: after.hidden,
          slides: after.slides,
          ...(removed ? { removed: { ...removed, files: deletedFiles } } : {}),
        })
      })
    } catch (err) {
      const code = (err && typeof err.code === 'string' && err.code.startsWith('SLIDE_OP_'))
        ? err.code
        : ERROR_CODES.WRITE_FAILED
      sendError(res, codeToStatus(code), code)
    }
  }
}

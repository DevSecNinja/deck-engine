/**
 * slide-op-client — browser helper for the dev-only slide-op endpoint.
 *
 * Resolves the endpoint relative to Vite's BASE_URL (so decks served behind
 * the launcher's `/preview/<deckId>/` proxy hit their own middleware) and POSTs
 * a `{ op, index, ... }` body. Mirrors Editable.jsx's defaultInlineEditEndpoint.
 */

export const SLIDE_OP_ENDPOINT_SUFFIX = '__deckio/slide-op'

/**
 * Build the slide-op endpoint URL from a BASE_URL string. Exported for tests.
 */
export function resolveSlideOpEndpoint(baseUrl) {
  let base = typeof baseUrl === 'string' && baseUrl ? baseUrl : '/'
  if (!base.endsWith('/')) base = `${base}/`
  return `${base}${SLIDE_OP_ENDPOINT_SUFFIX}`
}

export function defaultSlideOpEndpoint() {
  let base = '/'
  try {
    if (import.meta && import.meta.env && typeof import.meta.env.BASE_URL === 'string') {
      base = import.meta.env.BASE_URL || '/'
    }
  } catch { /* non-Vite env */ }
  return resolveSlideOpEndpoint(base)
}

/**
 * POST a slide operation. Returns { ok, status, data } where data is the parsed
 * JSON reply (or null). Never throws on HTTP errors — callers branch on `ok`.
 */
export async function callSlideOp(body, endpoint = defaultSlideOpEndpoint()) {
  let res
  try {
    res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    })
  } catch (err) {
    return { ok: false, status: 0, data: null, error: 'network' }
  }
  let data = null
  try { data = await res.json() } catch { /* non-JSON */ }
  return { ok: res.ok && data?.ok !== false, status: res.status, data }
}

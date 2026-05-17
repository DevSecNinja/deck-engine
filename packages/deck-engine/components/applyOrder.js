/**
 * applyOrder — client-side mirror of the server's applyOrder helper.
 *
 * Pure. Returns items in (savedOrder ∩ source) order, then appends new
 * source items not present in savedOrder in source order. Stale IDs are
 * silently dropped. Duplicate IDs in savedOrder are deduped (first wins).
 * Items with no/invalid id are appended in source order so an
 * ID-shape regression never blanks the slide.
 *
 * This MUST match `applyOrder` in
 * `packages/deck-engine/server/inline-edit-server.mjs`. Both copies are
 * pure and have explicit test coverage; if you change one, change both
 * and re-run the tests.
 */
export function applyOrder(savedOrder, sourceItems, getId) {
  if (!Array.isArray(sourceItems) || sourceItems.length === 0) return []
  if (typeof getId !== 'function') return sourceItems.slice()
  if (!Array.isArray(savedOrder) || savedOrder.length === 0) return sourceItems.slice()

  const byId = new Map()
  const noId = []
  for (let i = 0; i < sourceItems.length; i++) {
    const item = sourceItems[i]
    let id
    try { id = getId(item, i) } catch { id = null }
    if (typeof id !== 'string' || !id) {
      noId.push(item)
      continue
    }
    if (!byId.has(id)) byId.set(id, item)
  }

  const out = []
  const used = new Set()
  for (const id of savedOrder) {
    if (typeof id !== 'string' || !id) continue
    if (used.has(id)) continue
    if (!byId.has(id)) continue
    out.push(byId.get(id))
    used.add(id)
  }
  for (let i = 0; i < sourceItems.length; i++) {
    const item = sourceItems[i]
    let id
    try { id = getId(item, i) } catch { id = null }
    if (typeof id === 'string' && id && !used.has(id) && byId.get(id) === item) {
      out.push(item)
      used.add(id)
    }
  }
  for (const item of noId) out.push(item)
  return out
}

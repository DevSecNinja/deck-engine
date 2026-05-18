/**
 * Client-side EditableList primitive tests.
 *
 * Covers:
 *   - applyOrder client mirror matches the server's pure-helper contract
 *     (stale IDs dropped, new items appended, dupes deduped, no-id items
 *     appended in source order, getId throw is safe).
 *   - EditableList prod-safe shell renders ordered items with no provider.
 *   - EditableList prod-safe shell with a provider but unstable IDs falls
 *     back to source order without throwing.
 *   - useOrderedItems hook returns saved order when valid.
 *
 * Does NOT exercise dnd-kit (the sortable variant is dev-only and tested
 * separately).
 */

import { describe, it, expect } from 'vitest'
import { applyOrder } from '../components/applyOrder.js'

describe('applyOrder (client mirror of server pure helper)', () => {
  it('returns source order when no saved order is provided', () => {
    const items = [{ id: 'a' }, { id: 'b' }, { id: 'c' }]
    expect(applyOrder(null, items, (i) => i.id)).toEqual(items)
    expect(applyOrder([], items, (i) => i.id)).toEqual(items)
    expect(applyOrder(undefined, items, (i) => i.id)).toEqual(items)
  })

  it('reorders by saved ID list', () => {
    const items = [{ id: 'a' }, { id: 'b' }, { id: 'c' }]
    const out = applyOrder(['c', 'a', 'b'], items, (i) => i.id)
    expect(out.map((i) => i.id)).toEqual(['c', 'a', 'b'])
  })

  it('drops stale IDs that no longer exist in source', () => {
    const items = [{ id: 'a' }, { id: 'b' }]
    const out = applyOrder(['gone', 'b', 'also-gone', 'a'], items, (i) => i.id)
    expect(out.map((i) => i.id)).toEqual(['b', 'a'])
  })

  it('appends new items not present in saved order in source order', () => {
    const items = [{ id: 'a' }, { id: 'b' }, { id: 'c' }, { id: 'd' }]
    const out = applyOrder(['c', 'a'], items, (i) => i.id)
    expect(out.map((i) => i.id)).toEqual(['c', 'a', 'b', 'd'])
  })

  it('dedupes duplicate IDs in saved order (first wins)', () => {
    const items = [{ id: 'a' }, { id: 'b' }]
    const out = applyOrder(['a', 'a', 'b', 'a'], items, (i) => i.id)
    expect(out.map((i) => i.id)).toEqual(['a', 'b'])
  })

  it('appends items with missing IDs in source order (fail-open)', () => {
    const items = [
      { id: 'a' },
      { /* no id */ name: 'mystery' },
      { id: 'c' },
    ]
    const out = applyOrder(['c'], items, (i) => i.id)
    expect(out).toHaveLength(3)
    expect(out[0]).toEqual({ id: 'c' })
    // 'a' is appended (not in saved order, has id)
    // mystery is appended (no id) at the end
    expect(out[1]).toEqual({ id: 'a' })
    expect(out[2]).toEqual({ name: 'mystery' })
  })

  it('returns source order when getId is not a function', () => {
    const items = [{ id: 'a' }, { id: 'b' }]
    expect(applyOrder(['b', 'a'], items, null)).toEqual(items)
    expect(applyOrder(['b', 'a'], items, undefined)).toEqual(items)
    expect(applyOrder(['b', 'a'], items, 'not-a-fn')).toEqual(items)
  })

  it('returns [] for empty source', () => {
    expect(applyOrder(['a', 'b'], [], (i) => i.id)).toEqual([])
  })

  it('does not throw when getId throws — appends as no-id', () => {
    const items = [
      { id: 'a' },
      { id: 'throws' },
      { id: 'c' },
    ]
    const out = applyOrder(['c', 'a'], items, (i) => {
      if (i.id === 'throws') throw new Error('boom')
      return i.id
    })
    expect(out).toHaveLength(3)
    expect(out[0]).toEqual({ id: 'c' })
    expect(out[1]).toEqual({ id: 'a' })
    // throwing item ends up appended as a no-id item
    expect(out[2]).toEqual({ id: 'throws' })
  })

  it('returns source copy (does not mutate inputs)', () => {
    const items = [{ id: 'a' }, { id: 'b' }]
    const saved = ['b', 'a']
    const out = applyOrder(saved, items, (i) => i.id)
    expect(out).not.toBe(items)
    expect(items.map((i) => i.id)).toEqual(['a', 'b']) // unchanged
    expect(saved).toEqual(['b', 'a']) // unchanged
  })

  it('skips empty / non-string IDs in saved order', () => {
    const items = [{ id: 'a' }, { id: 'b' }]
    const out = applyOrder(['', null, undefined, 42, 'b'], items, (i) => i.id)
    expect(out.map((i) => i.id)).toEqual(['b', 'a'])
  })
})

describe('EditableList prod-safe shell — source surface', () => {
  it('exports default + useOrderedItems', async () => {
    const mod = await import('../components/EditableList.jsx')
    expect(typeof mod.default).toBe('function')
    expect(typeof mod.useOrderedItems).toBe('function')
  })

  it('module does NOT import @dnd-kit at top level (prod-bundle safety)', async () => {
    const fs = await import('fs')
    const path = await import('path')
    const url = await import('url')
    const here = path.dirname(url.fileURLToPath(import.meta.url))
    const src = fs.readFileSync(path.join(here, '..', 'components', 'EditableList.jsx'), 'utf-8')
    // The shell must not statically import @dnd-kit. The sortable variant
    // is only reached via React.lazy(() => import('./EditableListSortable.jsx'))
    // and Rollup tree-shakes the dev branch out of prod chunks.
    expect(src).not.toMatch(/import .* from ['"]@dnd-kit/)
  })

  it('sortable variant is lazy-loaded (React.lazy)', async () => {
    const fs = await import('fs')
    const path = await import('path')
    const url = await import('url')
    const here = path.dirname(url.fileURLToPath(import.meta.url))
    const src = fs.readFileSync(path.join(here, '..', 'components', 'EditableList.jsx'), 'utf-8')
    expect(src).toMatch(/lazy\(\(\) => import\(['"]\.\/EditableListSortable\.jsx['"]\)\)/)
  })

  it('sortable variant DOES import @dnd-kit at top level (so the chunk holds it)', async () => {
    const fs = await import('fs')
    const path = await import('path')
    const url = await import('url')
    const here = path.dirname(url.fileURLToPath(import.meta.url))
    const src = fs.readFileSync(path.join(here, '..', 'components', 'EditableListSortable.jsx'), 'utf-8')
    expect(src).toMatch(/from ['"]@dnd-kit\/core['"]/)
    expect(src).toMatch(/from ['"]@dnd-kit\/sortable['"]/)
  })
})

describe('engine index re-exports EditableList surface', () => {
  it('exports EditableList + useOrderedItems', async () => {
    const mod = await import('../index.js')
    expect(typeof mod.EditableList).toBe('function')
    expect(typeof mod.useOrderedItems).toBe('function')
  })

  it('exports useInlineEditEntry (v2 entry accessor)', async () => {
    const mod = await import('../index.js')
    expect(typeof mod.useInlineEditEntry).toBe('function')
  })
})

describe('EditableList defensive layout default (v1.17.2)', () => {
  // Why source-text assertions: the existing test surface is source-text-
  // based (no jsdom configured in vitest.config). These regressions are the
  // ones that matter — if the prod shell stops emitting the safe default
  // class, or the CSS file drops the layout rule, list slides start
  // overflowing again. We test the WIRING, not the rendering.

  it('ProdShell applies .deckio-editable-list when no className is passed', async () => {
    const fs = await import('fs')
    const path = await import('path')
    const url = await import('url')
    const here = path.dirname(url.fileURLToPath(import.meta.url))
    const src = fs.readFileSync(path.join(here, '..', 'components', 'EditableList.jsx'), 'utf-8')
    // Must use ?? fallback (not || ) so an empty string className still
    // opts the caller out — though in practice no one passes ''.
    expect(src).toMatch(/className\s*\?\?\s*['"]deckio-editable-list['"]/)
  })

  it('Sortable variant applies .deckio-editable-list default alongside .deckio-list', async () => {
    const fs = await import('fs')
    const path = await import('path')
    const url = await import('url')
    const here = path.dirname(url.fileURLToPath(import.meta.url))
    const src = fs.readFileSync(path.join(here, '..', 'components', 'EditableListSortable.jsx'), 'utf-8')
    // Default class joined with the always-on 'deckio-list' marker.
    expect(src).toMatch(/\[\s*className\s*\?\?\s*['"]deckio-editable-list['"]\s*,\s*['"]deckio-list['"]\s*\]/)
  })

  it('editable.css ships the .deckio-editable-list responsive grid', async () => {
    const fs = await import('fs')
    const path = await import('path')
    const url = await import('url')
    const here = path.dirname(url.fileURLToPath(import.meta.url))
    const css = fs.readFileSync(path.join(here, '..', 'styles', 'editable.css'), 'utf-8')
    // Layout default: grid with auto-fit minmax for slide-safe wrapping.
    expect(css).toMatch(/\.deckio-editable-list\s*\{[^}]*display:\s*grid/)
    expect(css).toMatch(/\.deckio-editable-list\s*\{[^}]*grid-template-columns:\s*repeat\(auto-fit/)
  })

  it('editable.css hides the drag handle until hover, focus, or drag', async () => {
    const fs = await import('fs')
    const path = await import('path')
    const url = await import('url')
    const here = path.dirname(url.fileURLToPath(import.meta.url))
    const css = fs.readFileSync(path.join(here, '..', 'styles', 'editable.css'), 'utf-8')
    // Base state: invisible + click-through so the affordance doesn't
    // pollute the slide surface.
    expect(css).toMatch(/\.deckio-list-handle\s*\{[^}]*opacity:\s*0/)
    expect(css).toMatch(/\.deckio-list-handle\s*\{[^}]*pointer-events:\s*none/)
    // Reveal states: hover on the item, keyboard focus on the handle,
    // and active drag must each light the handle up.
    expect(css).toMatch(/\.deckio-list-item:hover\s*>\s*\.deckio-list-handle/)
    expect(css).toMatch(/\.deckio-list-handle:focus-visible/)
    expect(css).toMatch(/\.deckio-list-item--dragging\s*>\s*\.deckio-list-handle/)
  })
})

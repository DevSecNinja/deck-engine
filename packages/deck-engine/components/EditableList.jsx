/**
 * EditableList — prod-safe shell for a reorderable list of items.
 *
 * Design (Decision 64):
 *   - In PRODUCTION (or with no provider / provider disabled), this renders
 *     the items in `applyOrder(savedOrder, items, keyOf)` order with ZERO
 *     dnd-kit code reachable. The sortable variant is loaded behind a
 *     `React.lazy()` import that lives inside a `ctx.isDev` branch, so
 *     Rollup splits @dnd-kit into a separate chunk that prod never asks
 *     for.
 *   - In DEV (provider active), we render the lazy-loaded sortable
 *     variant. The prod shell remains the Suspense fallback so the deck
 *     never blanks while @dnd-kit downloads.
 *
 * API:
 *   <EditableList id="agenda.blocks" items={blocks} keyOf={(b) => b.id}>
 *     {(block, i) => <AgendaBlock {...block} />}
 *   </EditableList>
 *
 *   - `id` (string, required): the override field id for the list order.
 *     Must follow the same field-id rules as <Editable id="...">.
 *   - `items` (array): source items in their default order.
 *   - `keyOf` (fn, required): returns a stable id per item. If it returns
 *     null/undefined for ANY item, reorder is disabled and a dev-only
 *     warning is logged. The list still renders in source order.
 *   - `children` (fn): render prop `(item, index, ordered) => ReactNode`.
 *   - `as` (string|component, default `'div'`): wrapper element.
 *   - `itemAs` (string|component, default `'div'`): wrapper for each item.
 *   - `onReorder` (optional fn): callback fired after a successful drag
 *     reorder with the new id array. Mostly for tests / instrumentation.
 *
 * Visibility-of-state contract:
 *   The prod shell never emits drag-handle JSX, never imports dnd-kit, and
 *   never reads from `ctx.activeField`. The sortable variant owns those.
 *
 * Edit/drag coordination (handled in EditableListSortable):
 *   If any field in the list is currently in edit mode, drag-start
 *   commits that edit first. If commit fails, the drag is canceled.
 */

import { Suspense, lazy, useContext, useMemo } from 'react'
import { InlineEditContext } from './editable-context.js'
import { applyOrder } from './applyOrder.js'

const LazyEditableListSortable = lazy(() => import('./EditableListSortable.jsx'))

// Defensive: read an override entry as a list-facet `order` array, or null.
function readOrderEntry(entry) {
  if (!entry || typeof entry !== 'object' || Array.isArray(entry)) return null
  if (!Object.prototype.hasOwnProperty.call(entry, 'order')) return null
  if (!Array.isArray(entry.order)) return null
  for (const id of entry.order) {
    if (typeof id !== 'string' || !id) return null
  }
  return entry.order
}

function validateKeyOf(items, keyOf) {
  if (typeof keyOf !== 'function') return { ok: false, reason: 'no-keyOf' }
  const seen = new Set()
  for (let i = 0; i < items.length; i++) {
    const k = keyOf(items[i], i)
    if (k == null || k === '') return { ok: false, reason: 'missing-id', index: i }
    if (typeof k !== 'string') return { ok: false, reason: 'non-string-id', index: i }
    if (seen.has(k)) return { ok: false, reason: 'duplicate-id', index: i, key: k }
    seen.add(k)
  }
  return { ok: true }
}

function ProdShell({
  fieldId,
  items,
  keyOf,
  ordered,
  children,
  as: As = 'div',
  itemAs: ItemAs = 'div',
  className,
  itemClassName,
  ...rest
}) {
  return (
    <As className={className} data-deckio-list-field={fieldId || undefined} {...rest}>
      {ordered.map((item, i) => {
        const k = keyOf ? keyOf(item, i) : i
        return (
          <ItemAs key={k != null ? String(k) : i} className={itemClassName} data-deckio-list-item-id={k != null ? String(k) : undefined}>
            {children(item, i, ordered)}
          </ItemAs>
        )
      })}
    </As>
  )
}

export default function EditableList({
  id,
  items = [],
  keyOf,
  children,
  as = 'div',
  itemAs = 'div',
  className,
  itemClassName,
  onReorder,
  ...rest
}) {
  const ctx = useContext(InlineEditContext)

  const validation = useMemo(() => validateKeyOf(items, keyOf), [items, keyOf])
  const stableIds = validation.ok

  // Always render in saved order (if valid) so prod export matches what
  // the user saw in dev. If keyOf is broken we silently fall back to
  // source order — never blank the deck.
  const savedOrder = stableIds && ctx ? readOrderEntry(ctx.overrides && ctx.overrides[id]) : null
  const ordered = useMemo(() => {
    if (!stableIds) return items
    if (!savedOrder || savedOrder.length === 0) return items
    return applyOrder(savedOrder, items, keyOf)
  }, [stableIds, savedOrder, items, keyOf])

  // Inert path: no provider, prod build, or provider explicitly disabled,
  // or unstable IDs — render prod shell only.
  if (!ctx || !ctx.isDev || !stableIds) {
    if (!stableIds && typeof console !== 'undefined' && console.warn && validation.reason !== 'no-keyOf') {
      // One-shot warning in dev so the author knows reorder is disabled.
      // Quiet in prod to avoid console spam in user decks.
      try {
        const isDevEnv = ctx && ctx.isDev
        if (isDevEnv) {
          console.warn(
            `[deckio] <EditableList id="${id}"> reorder disabled (${validation.reason}` +
            (validation.key ? `: "${validation.key}"` : '') +
            `). Add stable string \`id\` fields to your items.`,
          )
        }
      } catch { /* ignore */ }
    }
    return (
      <ProdShell
        fieldId={id}
        items={items}
        keyOf={keyOf}
        ordered={ordered}
        as={as}
        itemAs={itemAs}
        className={className}
        itemClassName={itemClassName}
        {...rest}
      >
        {children}
      </ProdShell>
    )
  }

  // Dev path: lazy-load sortable variant. Suspense fallback is the prod
  // shell rendering ordered items, so the deck never blanks.
  return (
    <Suspense
      fallback={(
        <ProdShell
          fieldId={id}
          items={items}
          keyOf={keyOf}
          ordered={ordered}
          as={as}
          itemAs={itemAs}
          className={className}
          itemClassName={itemClassName}
          {...rest}
        >
          {children}
        </ProdShell>
      )}
    >
      <LazyEditableListSortable
        id={id}
        items={items}
        keyOf={keyOf}
        ordered={ordered}
        as={as}
        itemAs={itemAs}
        className={className}
        itemClassName={itemClassName}
        onReorder={onReorder}
        {...rest}
      >
        {children}
      </LazyEditableListSortable>
    </Suspense>
  )
}

/**
 * useOrderedItems — hook variant for slides that want their own JSX wrapper
 * but still benefit from the saved order. Returns the items in the saved
 * order (or source order if the saved order is missing/invalid/etc).
 *
 * Use this when a slide can't use <EditableList> directly (e.g. complex
 * layouts where the parent isn't a simple list container). The slide
 * loses drag-and-drop UI but still respects any order saved elsewhere.
 */
export function useOrderedItems(fieldId, items, keyOf) {
  const ctx = useContext(InlineEditContext)
  const validation = useMemo(() => validateKeyOf(items, keyOf), [items, keyOf])
  const stableIds = validation.ok
  const savedOrder = stableIds && ctx ? readOrderEntry(ctx.overrides && ctx.overrides[fieldId]) : null
  return useMemo(() => {
    if (!stableIds || !savedOrder || savedOrder.length === 0) return items
    return applyOrder(savedOrder, items, keyOf)
  }, [stableIds, savedOrder, items, keyOf])
}

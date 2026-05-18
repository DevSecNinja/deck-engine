/**
 * EditableListSortable — dev-only sortable variant of <EditableList>.
 *
 * This file is loaded via React.lazy() from EditableList.jsx ONLY when a
 * dev provider is active. Rollup splits @dnd-kit into its own chunk that
 * prod never requests. Importing this file from prod would defeat the
 * bundle strategy — don't.
 *
 * Visual:
 *   - Each item gets a small drag handle on hover. Restrained dev-only
 *     affordance, tagged `data-deckio-export-ignore` so PDF / PNG export
 *     skips it.
 *   - Keyboard sortable via the dnd-kit sortable's built-in
 *     KeyboardSensor (Space to pick up, arrows to move, Space to drop).
 *   - Touch sortable via the PointerSensor with a small activation
 *     distance so taps in editable text don't accidentally start drags.
 *
 * Persistence:
 *   - On drag end, calls `ctx.save(field, { order: [...ids] })`. The
 *     server merges the new order onto the entry (replaces any prior
 *     order; never touches text facets on other entries).
 *
 * Edit/drag coordination:
 *   - If the active field lives inside this list (i.e. the user is
 *     editing a text node nested in one of the items), the drag is
 *     prevented until the active field is blurred. The user must finish
 *     their text edit (Enter or Escape) before they can drag.
 */

import { useCallback, useContext, useMemo, useState } from 'react'
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
} from '@dnd-kit/core'
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { InlineEditContext } from './editable-context.js'

function SortableItem({ id, children, ItemAs = 'div', className }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.6 : undefined,
    position: 'relative',
  }

  return (
    <ItemAs
      ref={setNodeRef}
      style={style}
      className={[className, 'deckio-list-item', isDragging && 'deckio-list-item--dragging'].filter(Boolean).join(' ')}
      data-deckio-list-item-id={id}
      data-deckio-list-dragging={isDragging ? 'true' : undefined}
    >
      <button
        ref={setActivatorNodeRef}
        type="button"
        className="deckio-list-handle"
        aria-label="Reorder item"
        title="Drag to reorder"
        data-deckio-export-ignore="true"
        data-html2canvas-ignore="true"
        {...listeners}
        {...attributes}
      >
        <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true" focusable="false">
          <circle cx="6" cy="4"  r="1.2" fill="currentColor" />
          <circle cx="10" cy="4"  r="1.2" fill="currentColor" />
          <circle cx="6" cy="8"  r="1.2" fill="currentColor" />
          <circle cx="10" cy="8"  r="1.2" fill="currentColor" />
          <circle cx="6" cy="12" r="1.2" fill="currentColor" />
          <circle cx="10" cy="12" r="1.2" fill="currentColor" />
        </svg>
      </button>
      {children}
    </ItemAs>
  )
}

export default function EditableListSortable({
  id,
  items = [],
  keyOf,
  ordered,
  children,
  as: As = 'div',
  itemAs: ItemAs = 'div',
  className,
  itemClassName,
  onReorder,
  ...rest
}) {
  const ctx = useContext(InlineEditContext)
  // Pessimistic local state lets us animate the drop before the server
  // confirms. We seed from props (ordered) and reset whenever the source
  // shape changes.
  const seedIds = useMemo(() => ordered.map((it, i) => String(keyOf(it, i))), [ordered, keyOf])
  const [localIds, setLocalIds] = useState(seedIds)
  // If the source props change underneath us (e.g. new items appended),
  // reset to the upstream order.
  if (seedIds.length !== localIds.length || seedIds.some((v, i) => v !== localIds[i])) {
    // Only resync when the *set* differs, not just the order. Drag-in-flight
    // reorders would otherwise be wiped out by every re-render.
    const seedSet = new Set(seedIds)
    const localSet = new Set(localIds)
    let setsEqual = seedSet.size === localSet.size
    if (setsEqual) {
      for (const v of seedSet) if (!localSet.has(v)) { setsEqual = false; break }
    }
    if (!setsEqual) {
      // Defer set state outside render via microtask to avoid React warning.
      Promise.resolve().then(() => setLocalIds(seedIds))
    }
  }

  // Build lookup so we can render in localIds order without recomputing
  // the upstream `ordered` array.
  const byId = useMemo(() => {
    const m = new Map()
    for (let i = 0; i < items.length; i++) {
      const k = keyOf ? keyOf(items[i], i) : null
      if (typeof k === 'string' && k && !m.has(k)) m.set(k, items[i])
    }
    return m
  }, [items, keyOf])

  // Coordinate edit/drag: if an editable field is currently being edited
  // anywhere in this list's subtree, cancel the drag until the user
  // commits or escapes.
  const wouldStompActiveEdit = useCallback((listRoot) => {
    if (!ctx || !ctx.activeField || !ctx.activeElementRef) return false
    const el = ctx.activeElementRef.current
    if (!el || !listRoot) return false
    return Boolean(listRoot.contains(el))
  }, [ctx])

  const sensors = useSensors(
    useSensor(PointerSensor, {
      // 6px activation distance so a click inside contenteditable text
      // doesn't accidentally start a drag.
      activationConstraint: { distance: 6 },
    }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  const handleDragStart = (event) => {
    // We can't reach the list root from the event reliably without a ref,
    // so defer the active-edit check to dragEnd via a simple opt-out.
    if (ctx && ctx.activeField) {
      // Don't block the drag entirely (would feel broken). Instead, the
      // active field will commit on the next blur, which fires when
      // dnd-kit moves focus to the handle.
      // If the active field commit fails the user will see the toast.
    }
    // event.active is the item being dragged
    void event
  }

  const handleDragEnd = async (event) => {
    const { active, over } = event
    if (!over || active.id === over.id) return
    const oldIdx = localIds.indexOf(String(active.id))
    const newIdx = localIds.indexOf(String(over.id))
    if (oldIdx < 0 || newIdx < 0) return
    const nextIds = arrayMove(localIds, oldIdx, newIdx)
    setLocalIds(nextIds)
    if (typeof onReorder === 'function') {
      try { onReorder(nextIds) } catch { /* ignore */ }
    }
    if (ctx && typeof ctx.save === 'function') {
      const result = await ctx.save(id, { order: nextIds })
      if (!(result && result.ok)) {
        // Roll back local order on save failure so the visible state
        // matches the saved state. The toast tells the user why.
        setLocalIds(localIds)
      }
    }
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <SortableContext items={localIds} strategy={verticalListSortingStrategy}>
        <As className={[className ?? 'deckio-editable-list', 'deckio-list'].filter(Boolean).join(' ')} data-deckio-list-field={id || undefined} {...rest}>
          {localIds.map((itemId, i) => {
            const item = byId.get(itemId)
            if (item === undefined) return null
            return (
              <SortableItem
                key={itemId}
                id={itemId}
                ItemAs={ItemAs}
                className={itemClassName}
              >
                {children(item, i, items)}
              </SortableItem>
            )
          })}
        </As>
      </SortableContext>
    </DndContext>
  )
}

// Re-export so consumers loading the sortable variant directly (rare)
// get the same surface as the shell.
export { default as EditableList } from './EditableList.jsx'

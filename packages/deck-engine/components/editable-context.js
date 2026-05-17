/**
 * InlineEditContext — module-local context shared by <Editable>, its
 * provider, and the floating <EditableToolbar>. Extracted into its own
 * module so the toolbar can import it without dragging the entire
 * Editable component tree (and so we have one canonical createContext()
 * call: re-creating it inside Editable.jsx and EditableToolbar.jsx would
 * yield two different context identities and silently break the wiring).
 *
 * Consumers should keep importing the public hooks/components from
 * `./Editable.jsx`. This module is an internal implementation detail.
 */
import { createContext } from 'react'

export const InlineEditContext = createContext(null)

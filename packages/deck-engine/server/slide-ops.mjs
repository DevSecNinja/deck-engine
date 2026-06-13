/**
 * slide-ops — deterministic codemods over a deck's `deck.config.js`.
 *
 * These are PURE text transforms (no filesystem, no network). The dev
 * middleware (`slide-ops-server.mjs`) owns IO and security; this module owns
 * the actual edits so they can be unit-tested in isolation and stay identical
 * across the in-deck buttons and the launcher thumbnail strip.
 *
 * Supported operations on the `slides: [...]` array:
 *   - reorderSlides(text, from, to)   → move one entry; remaps hiddenSlides.
 *   - deleteSlide(text, index)        → remove one entry; remaps hiddenSlides;
 *                                       reports orphaned local slide files +
 *                                       prunes the now-unused import.
 *   - setSlideHidden(text, index, on) → toggle membership in `hiddenSlides`.
 *
 * Hidden slides are stored as a top-level `hiddenSlides: [<index>, ...]` array
 * of integer indices into `slides`. Indices are kept consistent by every
 * transform here, so all tool-driven mutations stay in sync. The engine reads
 * this field at runtime to skip hidden slides during presentation.
 *
 * Safety posture: the parser only accepts a `slides` array whose entries are
 * bare identifiers (the documented DECKIO convention). Anything else (inline
 * JSX, function calls, spreads) aborts the op with `UNSUPPORTED_CONFIG` rather
 * than risk corrupting a hand-rolled config.
 */

export const SLIDE_OP_ERROR_CODES = Object.freeze({
  UNSUPPORTED_CONFIG: 'SLIDE_OP_UNSUPPORTED_CONFIG',
  NO_SLIDES_ARRAY: 'SLIDE_OP_NO_SLIDES_ARRAY',
  INDEX_OUT_OF_RANGE: 'SLIDE_OP_INDEX_OUT_OF_RANGE',
  INVALID_OP: 'SLIDE_OP_INVALID_OP',
  EMPTY_RESULT: 'SLIDE_OP_EMPTY_RESULT',
})

const IDENTIFIER_RE = /^[A-Za-z_$][\w$]*$/

function slideOpError(code, message) {
  const err = new Error(message ? `${code}: ${message}` : code)
  err.code = code
  return err
}

/**
 * Strip `// line` and `/* block *\/` comments from a snippet so comma-splitting
 * a small array body is safe. Only used on the array interior, never the whole
 * file, so we don't have to worry about strings here (array entries are bare
 * identifiers by contract).
 */
function stripComments(text) {
  return text
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\/\/[^\n\r]*/g, '')
}

/**
 * Scan a balanced bracket pair starting at the `[` located at or after
 * `fromIndex`. Returns { open, close } absolute indices of `[` and `]`, or null.
 */
function scanBracketArray(text, fromIndex) {
  const open = text.indexOf('[', fromIndex)
  if (open === -1) return null
  let depth = 0
  for (let i = open; i < text.length; i++) {
    const ch = text[i]
    if (ch === '[') depth++
    else if (ch === ']') {
      depth--
      if (depth === 0) return { open, close: i }
    }
  }
  return null
}

/**
 * Locate the `slides:` array. Returns { keyStart, open, close, inner } where
 * `open`/`close` are the bracket positions and `inner` is the raw interior.
 */
function locateSlidesArray(text) {
  const keyMatch = /(^|[^\w$])slides\s*:/m.exec(text)
  if (!keyMatch) return null
  const keyStart = keyMatch.index + (keyMatch[1] ? keyMatch[1].length : 0)
  const colon = text.indexOf(':', keyStart)
  const arr = scanBracketArray(text, colon)
  if (!arr) return null
  return { keyStart, open: arr.open, close: arr.close, inner: text.slice(arr.open + 1, arr.close) }
}

/** Parse the entries of a slides array body into bare identifiers. */
function parseEntries(inner) {
  const cleaned = stripComments(inner)
  const parts = cleaned.split(',').map((s) => s.trim()).filter((s) => s.length > 0)
  for (const p of parts) {
    if (!IDENTIFIER_RE.test(p)) {
      throw slideOpError(
        SLIDE_OP_ERROR_CODES.UNSUPPORTED_CONFIG,
        `slides array entry "${p}" is not a bare identifier`,
      )
    }
  }
  return parts
}

/**
 * Detect the indentation used for entries inside an array body, and the
 * indentation of the line the array closes on. Falls back to sensible defaults.
 */
function detectIndent(text, open, close) {
  // Indent of the line containing the closing bracket.
  const beforeClose = text.lastIndexOf('\n', close)
  const closeIndent = beforeClose === -1 ? '' : text.slice(beforeClose + 1, close).match(/^[ \t]*/)[0]
  // Indent of the first entry line (first newline after open).
  const firstNl = text.indexOf('\n', open)
  let itemIndent = closeIndent + '  '
  if (firstNl !== -1 && firstNl < close) {
    const lineStart = firstNl + 1
    const lead = text.slice(lineStart).match(/^[ \t]*/)[0]
    // Only trust it if the line actually has content (not the closing bracket).
    const rest = text.slice(lineStart + lead.length, close).trimStart()
    if (rest && rest[0] !== ']') itemIndent = lead
  }
  return { closeIndent, itemIndent }
}

/** Render a slides array body (multiline, trailing comma) from identifiers. */
function renderSlidesArray(ids, itemIndent, closeIndent) {
  if (ids.length === 0) return '[]'
  const body = ids.map((id) => `${itemIndent}${id},`).join('\n')
  return `[\n${body}\n${closeIndent}]`
}

/** Locate an existing `hiddenSlides:` array, if present. */
function locateHiddenArray(text) {
  const keyMatch = /(^|[^\w$])hiddenSlides\s*:/m.exec(text)
  if (!keyMatch) return null
  const keyStart = keyMatch.index + (keyMatch[1] ? keyMatch[1].length : 0)
  const colon = text.indexOf(':', keyStart)
  const arr = scanBracketArray(text, colon)
  if (!arr) return null
  return { keyStart, open: arr.open, close: arr.close, inner: text.slice(arr.open + 1, arr.close) }
}

/** Parse a hiddenSlides body into a sorted, de-duplicated list of indices. */
function parseHidden(inner) {
  const cleaned = stripComments(inner)
  const parts = cleaned.split(',').map((s) => s.trim()).filter((s) => s.length > 0)
  const out = new Set()
  for (const p of parts) {
    if (!/^\d+$/.test(p)) {
      throw slideOpError(
        SLIDE_OP_ERROR_CODES.UNSUPPORTED_CONFIG,
        `hiddenSlides entry "${p}" is not an integer index`,
      )
    }
    out.add(parseInt(p, 10))
  }
  return [...out].sort((a, b) => a - b)
}

function renderHiddenInline(indices) {
  return `[${indices.join(', ')}]`
}

/**
 * Write the hiddenSlides set back into the config text. Updates an existing
 * field, inserts one just before `slides:` when absent and non-empty, or
 * removes/empties an existing field when the set is empty.
 */
function writeHidden(text, indices) {
  const sorted = [...new Set(indices)].sort((a, b) => a - b)
  const existing = locateHiddenArray(text)
  if (existing) {
    const replacement = renderHiddenInline(sorted)
    return text.slice(0, existing.open) + replacement + text.slice(existing.close + 1)
  }
  if (sorted.length === 0) return text
  // Insert `hiddenSlides: [...],` on its own line right before `slides:`.
  const slides = locateSlidesArray(text)
  if (!slides) throw slideOpError(SLIDE_OP_ERROR_CODES.NO_SLIDES_ARRAY, 'no slides array')
  const lineStart = text.lastIndexOf('\n', slides.keyStart) + 1
  const indent = text.slice(lineStart, slides.keyStart).match(/^[ \t]*/)[0]
  const insertion = `${indent}hiddenSlides: ${renderHiddenInline(sorted)},\n`
  return text.slice(0, lineStart) + insertion + text.slice(lineStart)
}

/**
 * Parse the declarative slide state from a config. Returns
 *   { slides: string[], hidden: number[] }
 * `hidden` is clamped to valid indices. Throws SLIDE_OP errors on malformed
 * configs.
 */
export function parseDeckConfig(text) {
  const located = locateSlidesArray(text)
  if (!located) throw slideOpError(SLIDE_OP_ERROR_CODES.NO_SLIDES_ARRAY, 'no slides array found')
  const slides = parseEntries(located.inner)
  const hiddenLoc = locateHiddenArray(text)
  let hidden = hiddenLoc ? parseHidden(hiddenLoc.inner) : []
  hidden = hidden.filter((i) => i >= 0 && i < slides.length)
  return { slides, hidden }
}

/** Replace the slides array body in `text` with `ids`. */
function rewriteSlides(text, ids) {
  const located = locateSlidesArray(text)
  if (!located) throw slideOpError(SLIDE_OP_ERROR_CODES.NO_SLIDES_ARRAY, 'no slides array')
  const { itemIndent, closeIndent } = detectIndent(text, located.open, located.close)
  const rendered = renderSlidesArray(ids, itemIndent, closeIndent)
  return text.slice(0, located.open) + rendered + text.slice(located.close + 1)
}

function assertIndex(index, length) {
  if (!Number.isInteger(index) || index < 0 || index >= length) {
    throw slideOpError(
      SLIDE_OP_ERROR_CODES.INDEX_OUT_OF_RANGE,
      `index ${index} out of range [0, ${length})`,
    )
  }
}

/**
 * Move the slide at `from` to `to`. Returns { text }.
 * hiddenSlides indices are remapped through the same permutation so hidden
 * marks follow their slides.
 */
export function reorderSlides(text, from, to) {
  const { slides, hidden } = parseDeckConfig(text)
  assertIndex(from, slides.length)
  assertIndex(to, slides.length)
  if (from === to) return { text }

  const nextSlides = slides.slice()
  const [moved] = nextSlides.splice(from, 1)
  nextSlides.splice(to, 0, moved)

  // Build old→new index map for the move and remap hidden indices.
  const remap = (oldIndex) => {
    if (oldIndex === from) return to
    if (from < to) {
      // items between (from, to] shift left by one
      if (oldIndex > from && oldIndex <= to) return oldIndex - 1
      return oldIndex
    }
    // to < from: items in [to, from) shift right by one
    if (oldIndex >= to && oldIndex < from) return oldIndex + 1
    return oldIndex
  }
  const nextHidden = hidden.map(remap)

  let out = rewriteSlides(text, nextSlides)
  out = writeHidden(out, nextHidden)
  return { text: out }
}

/**
 * Find an `import` statement that binds `localName`. Returns descriptor with
 * the statement range and (for named imports) the matched specifier so callers
 * can prune precisely.
 */
function findImportBinding(text, localName) {
  const importRe = /import\s+([\s\S]*?)\s+from\s*(['"])([^'"]+)\2\s*;?/g
  let m
  while ((m = importRe.exec(text)) !== null) {
    const clause = m[1]
    const importPath = m[3]
    const statementStart = m.index
    const statementEnd = importRe.lastIndex
    // Default import: `import Name from '...'`
    const defaultMatch = clause.match(/^\s*([A-Za-z_$][\w$]*)\s*$/)
    if (defaultMatch && defaultMatch[1] === localName) {
      return { kind: 'default', statementStart, statementEnd, importPath }
    }
    // Named import(s): `import { A as B, C } from '...'`
    const braceMatch = clause.match(/\{([\s\S]*)\}/)
    if (braceMatch) {
      const specifiers = braceMatch[1].split(',').map((s) => s.trim()).filter(Boolean)
      for (const spec of specifiers) {
        const asMatch = spec.match(/^([A-Za-z_$][\w$]*)\s+as\s+([A-Za-z_$][\w$]*)$/)
        const bound = asMatch ? asMatch[2] : (/^[A-Za-z_$][\w$]*$/.test(spec) ? spec : null)
        if (bound === localName) {
          return {
            kind: 'named',
            statementStart,
            statementEnd,
            importPath,
            specifiers,
            specifier: spec,
          }
        }
      }
    }
  }
  return null
}

/** Count word-boundary occurrences of an identifier in text. */
function countIdentifier(text, name) {
  const re = new RegExp(`(^|[^\\w$])${name}(?![\\w$])`, 'g')
  let count = 0
  while (re.exec(text) !== null) count++
  return count
}

/** Remove the import statement (and a trailing blank line) for a default import. */
function removeStatement(text, start, end) {
  let s = start
  let e = end
  // Swallow the trailing newline (and one following blank line) for tidiness.
  if (text[e] === '\r') e++
  if (text[e] === '\n') e++
  // Also remove leading indentation on the statement's line.
  const lineStart = text.lastIndexOf('\n', s - 1) + 1
  if (/^[ \t]*$/.test(text.slice(lineStart, s))) s = lineStart
  return text.slice(0, s) + text.slice(e)
}

/** Remove a single specifier from a named import, or the whole statement if last. */
function removeNamedSpecifier(text, descriptor) {
  const remaining = descriptor.specifiers.filter((s) => s !== descriptor.specifier)
  if (remaining.length === 0) {
    return removeStatement(text, descriptor.statementStart, descriptor.statementEnd)
  }
  const statement = text.slice(descriptor.statementStart, descriptor.statementEnd)
  const rebuilt = statement.replace(/\{([\s\S]*)\}/, `{ ${remaining.join(', ')} }`)
  return text.slice(0, descriptor.statementStart) + rebuilt + text.slice(descriptor.statementEnd)
}

/**
 * Delete the slide at `index`. Returns:
 *   { text, removedName, kind, filesToDelete }
 * where `kind` is 'local' | 'engine' | 'unknown', and `filesToDelete` lists the
 * project-relative paths of the orphaned slide JSX + sibling CSS module (only
 * for local slides whose import becomes unused). The import is pruned only when
 * the identifier is no longer referenced anywhere else.
 */
export function deleteSlide(text, index) {
  const { slides, hidden } = parseDeckConfig(text)
  assertIndex(index, slides.length)

  const removedName = slides[index]
  const nextSlides = slides.slice()
  nextSlides.splice(index, 1)

  // Remap hidden: drop the deleted index, shift higher indices down by one.
  const nextHidden = hidden
    .filter((i) => i !== index)
    .map((i) => (i > index ? i - 1 : i))

  let out = rewriteSlides(text, nextSlides)
  out = writeHidden(out, nextHidden)

  const filesToDelete = []
  let kind = 'unknown'
  const stillUsedInArray = nextSlides.includes(removedName)
  const binding = findImportBinding(out, removedName)

  if (binding) {
    const isLocalSlide = binding.kind === 'default' &&
      /^\.\/src\/slides\//.test(binding.importPath)
    kind = isLocalSlide ? 'local' : 'engine'

    if (!stillUsedInArray) {
      // Tentatively prune the import, then verify the identifier is no longer
      // referenced anywhere (counting on the pruned text avoids matching the
      // component name inside its own import path). If it is still used (e.g.
      // a duplicate array entry or a code reference), keep the import + files.
      const pruned = binding.kind === 'named'
        ? removeNamedSpecifier(out, binding)
        : removeStatement(out, binding.statementStart, binding.statementEnd)
      if (countIdentifier(pruned, removedName) === 0) {
        out = pruned
        if (isLocalSlide) {
          filesToDelete.push(binding.importPath.replace(/^\.\//, ''))
          const cssPath = binding.importPath
            .replace(/\.[jt]sx?$/, '.module.css')
            .replace(/^\.\//, '')
          filesToDelete.push(cssPath)
        }
      }
    }
  }

  return { text: out, removedName, kind, filesToDelete }
}

/**
 * Toggle the hidden state of the slide at `index`. Returns { text, hidden }.
 */
export function setSlideHidden(text, index, hidden) {
  const parsed = parseDeckConfig(text)
  assertIndex(index, parsed.slides.length)
  const set = new Set(parsed.hidden)
  if (hidden) set.add(index)
  else set.delete(index)
  const next = [...set].sort((a, b) => a - b)
  return { text: writeHidden(text, next), hidden: next }
}

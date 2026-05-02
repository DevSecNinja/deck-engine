/**
 * Theme loader for deck-engine.
 *
 * Resolves theme names to CSS file paths and provides discovery.
 * Themes are plain CSS files in this directory that set CSS custom
 * properties consumed by the engine and mapped to Tailwind utilities
 * via @theme inline blocks.
 */
import { readdirSync } from 'fs'
import { dirname, join, resolve } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))

const BUILTIN_THEMES = ['dark', 'light', 'shadcn', 'fabric']
const LEGACY_THEMES = new Set(['funky-punk'])
const DEFAULT_THEME = 'dark'

/**
 * Returns the absolute path to a theme CSS file.
 * Accepts a bare name ("dark") or a path to a custom CSS file.
 */
export function resolveTheme(theme) {
  if (!theme) return resolve(__dirname, `${DEFAULT_THEME}.css`)

  // Absolute or relative path — treat as custom theme
  if (theme.endsWith('.css')) return resolve(theme)

  // Built-in theme name
  const file = resolve(__dirname, `${theme}.css`)
  return file
}

/**
 * Lists all surfaced theme names (filenames without extension).
 * Legacy themes may remain on disk so old decks keep rendering, but they
 * should not appear in new-deck selection surfaces.
 */
export function getAvailableThemes() {
  try {
    return readdirSync(__dirname)
      .filter((f) => f.endsWith('.css'))
      .map((f) => f.replace(/\.css$/, ''))
      .filter((name) => !LEGACY_THEMES.has(name))
  } catch {
    return [...BUILTIN_THEMES]
  }
}

export { DEFAULT_THEME, BUILTIN_THEMES }

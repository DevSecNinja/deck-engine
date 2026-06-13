/**
 * Vite plugin for deck-engine projects.
 *
 * The main entry (@deckio/deck-engine) is pre-bundled by Vite
 * into a single module so SlideContext, SlideProvider, useSlides, Slide,
 * Navigation, and BottomBar all share one React context instance.
 *
 * Sub-path exports (e.g. slides/GenericThankYouSlide) are served as raw
 * source and import from the package name (not relative paths) so they
 * also resolve to the pre-bundled context singleton.
 *
 * The plugin also integrates Tailwind CSS v4 via @tailwindcss/vite
 * and injects the selected theme CSS from deck.config.js.
 */
import tailwindcss from '@tailwindcss/vite'
import { resolveTheme, getAvailableThemes, DEFAULT_THEME, BUILTIN_THEMES } from './themes/theme-loader.js'
import { createInlineEditMiddleware, isHostExposed } from './server/inline-edit-server.mjs'
import { createSlideOpsMiddleware } from './server/slide-ops-server.mjs'

// Re-export theme utilities for Node.js consumers
export { resolveTheme, getAvailableThemes, DEFAULT_THEME, BUILTIN_THEMES }

/**
 * Directories the per-deck Vite dev server should NOT watch.
 *
 * Why: in the hosted launcher (and locally), the launcher + thumbnail
 * service write files inside the deck on every slide mutation:
 *   - .deckio/thumbnails/ JPG files — regenerated whenever the agent
 *     adds, edits, or deletes a slide; can fire dozens of times per
 *     chat turn.
 *   - .gh-pages-tmp/ — transient staging dir created during Publish.
 *   - .github/eyes/ — sketches / captures saved by the deck-sketch skill.
 *
 * None of these participate in the Vite module graph. Without an explicit
 * ignore, chokidar still fires an event per write and Vite dispatches it
 * through its watcher before discarding — pure overhead that scales with
 * the number of slides × mutations per session, and noticeably worse on
 * Azure Files (SMB) RWX mounts.
 *
 * Vite's defaults already ignore .git, node_modules, test-results, and the
 * resolved cacheDir. The plugin only adds deckio-specific paths on top —
 * user server.watch.ignored entries are preserved.
 *
 * NOT included intentionally:
 *   - A broad ignore of all .deckio/ — kept narrow so future deckio runtime
 *     artifacts (e.g. manifests) can still participate in HMR.
 *   - followSymlinks: false — Vite's default node_modules glob already
 *     filters the only symlink the launcher creates (node_modules ->
 *     /app/node_modules); turning this off would break HMR for any
 *     legitimately symlinked source package (e.g. npm link).
 *   - .github/memory/ — no writer observed in the launcher.
 */
export const DECK_WATCH_IGNORED = Object.freeze([
  '**/.deckio/thumbnails/**',
  '**/.gh-pages-tmp/**',
  '**/.github/eyes/**',
  '**/coverage/**',
  '**/dist/**',
])

/**
 * Normalize the `inlineEditing` plugin option to a boolean.
 *
 * Accepts:
 *   - `true` / `false`
 *   - `{ enabled: true }` / `{ enabled: false }` (namespaced shape Messi
 *     blessed for future option growth)
 *   - anything else / missing → `false` (default off, opt-in only)
 */
export function normalizeInlineEditingOption(value) {
  if (value === true) return true
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value.enabled === true
  }
  return false
}

/**
 * @param {object} [options]
 * @param {string} [options.theme] - Theme name or path. Defaults to "dark".
 * @param {boolean | { enabled?: boolean }} [options.inlineEditing] - Opt in
 *   to the local-only inline-edit dev endpoint. Accepts both `true` and the
 *   namespaced `{ enabled: true }` shape so future inline-editing options
 *   can grow under the same key without scattered top-level flags. Defaults
 *   to disabled. Even when enabled, the middleware refuses to register if
 *   Vite is exposed on the network (host: '0.0.0.0', true, LAN ip, etc.).
 */
export function deckPlugin(options = {}) {
  const themePath = resolveTheme(options.theme)
  const inlineEditing = normalizeInlineEditingOption(options.inlineEditing)

  return {
    name: 'deck-engine',
    enforce: 'pre',
    config() {
      return {
        // Keep Vite's optimized dependency chunks inside each deck instead of
        // shared node_modules. Shared node_modules speeds startup, but sharing
        // node_modules/.vite lets parallel dev servers invalidate each other's
        // chunk files and causes intermittent 404s on /node_modules/.vite/deps.
        cacheDir: '.vite',
        resolve: {
          dedupe: ['react', 'react-dom'],
        },
        // Avoid wasted chokidar events for launcher-written artifacts that
        // never participate in HMR. See DECK_WATCH_IGNORED above.
        // Vite merges these with its defaults (node_modules, .git, ...);
        // user-supplied ignored patterns are preserved.
        server: {
          watch: {
            ignored: [...DECK_WATCH_IGNORED],
          },
        },
      }
    },
    // Vite 8's @vitejs/plugin-react loads /@react-refresh as a module import.
    // If that module fails to load (e.g. behind a reverse proxy with auth),
    // $RefreshSig$ is undefined and every component crashes.
    // Inject synchronous fallbacks so components always render.
    // When /@react-refresh loads successfully, it overwrites these with the
    // real HMR implementations.
    transformIndexHtml() {
      return [{
        tag: 'script',
        children: 'window.$RefreshReg$=window.$RefreshReg$||function(){};window.$RefreshSig$=window.$RefreshSig$||function(){return function(t){return t}};',
        injectTo: 'head-prepend',
      }]
    },
    // Dev-only: mount the inline-edit endpoint. configureServer is never
    // called for production builds, so the write surface is inert in `vite build`.
    // Opt-in via `deckPlugin({ inlineEditing: true })`. When enabled, requests
    // are still refused server-side if Vite is bound to a non-loopback host.
    configureServer(server) {
      if (!inlineEditing) return
      const root = server.config.root
      const hostOption = server.config.server && server.config.server.host
      const networkExposed = isHostExposed(hostOption)
      if (networkExposed && server.config.logger && server.config.logger.warn) {
        server.config.logger.warn(
          '[deck-engine] inline editing disabled: dev server is exposed on the network.',
        )
      }
      server.middlewares.use(createInlineEditMiddleware({ root, networkExposed }))
      server.middlewares.use(createSlideOpsMiddleware({ root, networkExposed }))
    },
  }
}

/**
 * Returns an array of Vite plugins for a deck-engine project:
 * - deckPlugin (react dedup + theme injection)
 * - @tailwindcss/vite plugins (Tailwind CSS v4 processing)
 *
 * Use this in vite.config.js when you want the full setup in one call.
 *
 * @param {object} [options]
 * @param {string} [options.theme] - Theme name or path.
 */
export function deckPlugins(options = {}) {
  return [
    deckPlugin(options),
    ...tailwindcss(),
  ]
}

/**
 * Returns the @tailwindcss/vite plugin for projects that want
 * to compose their own plugin array.
 */
export function tailwindPlugin() {
  return tailwindcss()
}

export default deckPlugin

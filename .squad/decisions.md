# Squad Decisions

## Active Decisions

---

### DEV-001: Dev Workflow Conventions
**Author:** Basher | **Date:** 2026-03-13 | **Status:** Implemented

1. **Root scripts delegate via npm workspaces** — `dev` and `build` target `@deckio/deck-engine`; `test` and `lint` use `--workspaces --if-present` to broadcast.
2. **No build step for the engine** — ships raw `.jsx`; `build` uses `--if-present` (no-op until needed).
3. **`prepublishOnly` gates on tests** — `npm test --if-present` in the engine. Enforced once tests exist (now they do).
4. **`.tgz` files in `.gitignore`** — never commit pack artifacts.
5. **Cross-platform browser detection in `capture-screen.mjs`** — auto-detects Edge or Chrome on Windows, macOS, Linux.
6. **Scaffolder engine dep stays current** — bumped `^1.7.7` → `^1.8.2` to reflect actual engine version.

---

### TEST-001: Vitest Workspace Test Harness
**Author:** Linus | **Date:** 2026-03-13 | **Status:** Implemented

1. **Vitest 4.x at root** with `vitest.workspace.js` pointing at `packages/*`. Each package has its own `vitest.config.js`.
2. **Root `npm test`** → `npx vitest run` (runs all workspace tests).
3. **Extracted `utils.mjs`** from `create-deckio/index.mjs` — CLI entry auto-runs `main()` on import; pure logic must be exported from a utilities module for testability.
4. **Tests live in** `packages/<pkg>/__tests__/*.test.js`.
5. **Phase 2 React component tests** will need `@vitejs/plugin-react` + jsdom environment in deck-engine's vitest config.

---

### DESIGN-001: Design Token Audit Findings
**Author:** Saul | **Date:** 2026-03-13 | **Status:** Informational — feeds Phase 2

1. **Token coverage minimal** — 16 custom properties (14 color, 2 layout). Zero typography/spacing/radius/z-index/transition tokens.
2. **3 unused tokens** — `--blue-bright`, `--purple-deep`, `--orange` defined but never consumed.
3. **`--blue-glow` bypassed 6×** — raw `rgba(31,111,235,...)` hardcoded instead of using the token.
4. **`ThankYouSlide.module.css` is dead code** — 132 lines, not imported anywhere.
5. **Hardcoded colors need tokens** — `#f85149` error red (2 places), translucent surface rgba (4 places).
6. **No accessibility foundations** — no `focus-visible` styles, no `prefers-reduced-motion` queries.
7. Full audit at `.squad/agents/saul/design-token-audit.md`.

---

---

### 2026-03-13T01:15:00Z: User Directive — Theme System Scope
**By:** Ali Soliman (via Copilot) | **Date:** 2026-03-13 | **Status:** Implemented

Phase 2 will include a pluggable theme system with 3 initial themes (current dark, light, shadcn-inspired). Themes should use actual shadcn/Tailwind token values — not just CSS variable maps. Design tokens must be codified first. Theme picker added to CLI onboarding. Architecture must support future community/pluggable themes.

---

### ARCH-001: Theme System Scope
**Author:** Rusty | **Date:** 2026-03-13 | **Status:** Implemented

1. **Semantic token contract defined before theme expansion** — tokens codified first (DESIGN-002), then themes built on top. Contract is the stable interface.
2. **Three initial theme presets** — dark (default, original aesthetic), light (projection-optimized), shadcn (oklch values, editorial-neutral). New themes = drop a CSS file.
3. **Shadcn as visual language, not dependency** — neutral surfaces, clean typography, subtle borders, moderate radius, restrained accent. No shadcn component imports.
4. **`accent` overrides within themes, not replaces them** — per-deck color customization lives inside a selected theme.
5. **No runtime plugin system in Phase 2** — config-driven CSS variable approach sufficient. Plugin system deferred to later phase.
6. **Theme choice affects tokens and component chrome only** — slide content structure unchanged by theme selection.

---

### THEME-001: Tailwind CSS v4 + Pluggable Theme Architecture
**Author:** Basher | **Date:** 2026-03-13 | **Status:** Implemented

1. **Tailwind CSS v4 installed** — `tailwindcss` + `@tailwindcss/vite` as dependencies in deck-engine. Downstream projects get them as devDependencies via the scaffolder.
2. **Vite plugin expanded** — `vite.js` exports three functions:
   - `deckPlugin(options)` — core plugin (react dedup), accepts `{ theme }` option
   - `deckPlugins(options)` — combo array: deckPlugin + @tailwindcss/vite sub-plugins
   - `tailwindPlugin()` — standalone @tailwindcss/vite for manual composition
3. **Theme system is CSS-file-based** — each theme is a `.css` file in `packages/deck-engine/themes/`. Contains `:root` CSS custom properties + `@theme inline` block that bridges them to Tailwind utility classes. Adding a theme = drop a CSS file.
4. **Three built-in themes** — `dark.css` (original DECKIO aesthetic), `light.css` (projection-optimized), `shadcn.css` (exact shadcn/ui oklch values + card/popover/chart extras).
5. **Theme loader** (`themes/theme-loader.js`) — `resolveTheme(name)` resolves name to absolute CSS path, `getAvailableThemes()` reads directory listing. Supports custom paths (ending in `.css`). Unknown theme names silently return non-existent path (by design, allows custom themes — consumers check `existsSync()`).
6. **`deck.config.js` schema updated** — new `theme` field, defaults to `'dark'` for backwards compatibility.
7. **CLI onboarding** — theme prompt added after accent color: "Theme (dark / light / shadcn)". Validates input, falls back to "dark". Non-interactive mode reads `DECK_THEME` env var.
8. **Generated projects are Tailwind-ready** — `main.jsx` imports `@deckio/deck-engine/themes/{theme}.css`, `vite.config.js` includes `tailwindPlugin()`, `package.json` includes tailwindcss devDeps.
9. **Backwards compatible** — decks without a `theme` field still work (dark is the default everywhere).

**Key files:**
- `packages/deck-engine/vite.js` — plugin exports
- `packages/deck-engine/themes/` — theme CSS files + loader
- `packages/deck-engine/index.js` — re-exports theme functions
- `packages/create-deckio/utils.mjs` — deckConfig with theme param
- `packages/create-deckio/index.mjs` — CLI theme picker + vite config template

---

### DESIGN-002: Design Token System Codified
**Author:** Saul | **Date:** 2026-03-13 | **Status:** Implemented

1. **Token naming follows shadcn/ui conventions** — `--background`, `--foreground`, `--primary`, `--secondary`, `--muted`, `--accent`, `--destructive`, `--border`, `--input`, `--ring`, `--radius`, `--card` + `-foreground` variants. Engine CSS and all 3 theme files aligned.
2. **9 token categories in global.css** — Core semantic colors, decorative palette, derived overlays & glows, presentation layout, typography scale (font sizes 2xs→display, weights, letter-spacing, line-height), spacing scale (4px base, 15 steps), border radius, z-index, transitions. Documentation comment at top of file.
3. **Token renames (breaking):**
   - `--bg-deep` → `--background`
   - `--bg` → `--card`
   - `--text` → `--foreground`
   - `--text-muted` → `--muted-foreground`
   - `--surface` → `--secondary`
   - All references updated across engine CSS, export scripts, scaffolder, and theme files.
4. **Removed tokens:** `--blue-bright` and `--orange` (genuinely unused). Kept `--purple-deep` (consumed by scaffolder inline template).
5. **Zero hardcoded colors in component CSS** — All raw `rgba()` and hex values in rule bodies replaced with token references. Raw values only appear in `:root` token definitions.
6. **Dead CSS deleted** — `ThankYouSlide.module.css` (132 lines, not imported anywhere).
7. **All 49 tests pass** — no regressions at time of token work.

**Warning:** Always check JS template strings when auditing token usage, not just CSS files. `--purple-deep` appeared unused in CSS audit but is consumed by `create-deckio/index.mjs` line ~166.

---

### THEME-002: SlideContext Theme Integration
**Author:** Livingston | **Date:** 2026-03-14 | **Status:** Implemented

1. **`SlideProvider` accepts `theme` prop** — passed to context, sets initial theme state.
2. **`data-theme` attribute on `document.documentElement`** — CSS authors scope per-theme rules with `[data-theme="light"]` selectors without modifying theme CSS files.
3. **Context exposes `theme` and `setTheme`** — consumer components can read active theme and switch at runtime.
4. **No Node.js imports in browser code** — `SlideContext` uses a local `DEFAULT_THEME` constant instead of importing from `theme-loader.js` (which requires `fs`). Browser/Node.js boundary respected.
5. **Theme CSS loading is build-time** — scaffolded `main.jsx` imports the right theme CSS. `data-theme` is a signaling mechanism only. Full runtime switching deferred (requires pre-compiled CSS per theme).
6. **Export fallbacks valid** — `#080b10` in exportDeckPdf/Pptx is a safe server-side fallback for the dark background.

**Key files:**
- `packages/deck-engine/src/SlideContext.jsx` — theme prop, data-theme attribute, context value

---

---

### CLI-001: Version Bump + Export Map Fix for Tailwind Plugin
**Author:** Basher | **Date:** 2026-03-14 | **Status:** Implemented

1. **Engine version bumped `1.8.2` → `1.9.0`** — the theme/tailwind work from THEME-001 was never reflected in a version bump, so downstream `npm install` fetched old v1.8.2 without `tailwindPlugin`. Next publish must use this version or higher.
2. **Exports map includes both `./vite` and `./vite.js`** — Vite's resolver sometimes appends `.js` to the specifier. Both paths now resolve to `vite.js`.
3. **Scaffolder dep updated `^1.8.2` → `^1.9.0`** — ensures scaffolded projects pull the version that has tailwind/theme support.
4. **Default accent color changed `#3fb950` → `#6366f1`** — indigo-500 is more modern, works well across all three themes. Previous GitHub green was too brand-specific.
5. **CLI uses ANSI colors, no external dependencies** — decided against `gum` (charmbracelet) to avoid requiring a separate binary install. Pure ANSI escape codes via a `fmt` helper in `index.mjs`. Keeps the scaffolder zero-dependency.

**Key files:**
- `packages/deck-engine/package.json` — version + exports map
- `packages/create-deckio/utils.mjs` — scaffolded dep version
- `packages/create-deckio/index.mjs` — CLI prompts, colors, swatch preview

---

### 2026-03-14T01:52:00Z: User Directive — Verification Loop Required
**By:** Ali Soliman (via Copilot) | **Date:** 2026-03-14 | **Status:** Active

Every feature must go through a verification loop before being declared done. No half-baked features. Agents must test their work end-to-end — not just unit tests, but actual integration verification (scaffold a project, run it, confirm it works). Sloppy behavior is unacceptable.

**Why captured:** The `tailwindPlugin` export bug shipped because nobody verified the scaffolded project actually ran. Unit tests passed; the real project was broken.

---

### PROCESS-001: E2E Verification Standard for Scaffolder Features
**Author:** Linus | **Date:** 2026-03-14 | **Status:** Active

1. **Full E2E matrix is the minimum bar** — scaffold → npm install → dev server → production build. All four steps must pass for any scaffolder feature to be considered complete.
2. **Production build is not covered by unit tests** — unit tests validate pure function outputs (string generation). They never run a Vite build of the generated project. A passing unit suite does not imply a working production build.
3. **Dev server ≠ production build** — Vite serves modules individually in dev mode. Node.js builtins are available in the dev server's module graph but never sent to the browser. Rollup (production) is stricter.
4. **Browser/Node.js boundary must be respected in `index.js`** — `packages/deck-engine/index.js` is the browser entry point. Any module it imports (directly or transitively) must be browser-safe. Node.js-only utilities (fs, path, url) belong in server-only entry points (e.g., `vite.js`, `themes/theme-loader.js`).
5. **CI should automate the E2E check** — an automated step that scaffolds a project, installs deps, and runs `vite build` would catch the entire class of production bundle regressions that unit tests miss.

---

## Governance

- All meaningful changes require team consensus
- Document architectural decisions here
- Keep history focused on work, decisions focused on direction

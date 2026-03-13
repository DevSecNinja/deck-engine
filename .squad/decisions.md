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

### THEME-002: Theme Descriptor Architecture
**Author:** Rusty | **Date:** 2026-03-15 | **Status:** Implemented

1. **Theme authoring is descriptor-driven** — built-in themes no longer rely on hardcoded prose inside every skill. Each theme ships a dedicated authoring contract at `packages/deck-engine/themes/descriptors/<theme>.md`.
2. **Built-in descriptors are first-class package assets** — `dark.md`, `light.md`, and `shadcn.md` live beside the theme CSS and are exported from `@deckio/deck-engine` for downstream decks and tools.
3. **New themes scale without skill edits** — adding a theme means adding its CSS plus a descriptor file. Custom/on-demand themes can ship their own local descriptor and plug into the same workflow.
4. **`designSystem` remains the safety rail, not the source of visual truth** — skills resolve the descriptor from `theme`, then use `designSystem` only to cross-check for structural mismatches.

**Key files:**
- `packages/deck-engine/themes/descriptors/dark.md`
- `packages/deck-engine/themes/descriptors/light.md`
- `packages/deck-engine/themes/descriptors/shadcn.md`

---

### SKILL-001: Theme-Aware Skills
**Author:** Rusty | **Date:** 2026-03-15 | **Status:** Implemented

1. **Skills now start from project config** — Step 0 reads `deck.config.js`, captures `theme` and `designSystem`, and resolves the active descriptor before any slide work begins.
2. **Descriptor rules replaced hardcoded theme sections** — the old Section A–D / Section S split is gone. Skills follow the resolved descriptor exactly for JSX skeletons, CSS skeletons, tokens, components, and anti-patterns.
3. **The whole authoring toolchain was updated** — `deck-add-slide`, `deck-validate-project`, `deck-inspect`, `deck-sketch`, and `deck-generate-image` all use the same descriptor-resolution procedure.
4. **Skills are written for AI coding CLIs** — they are executable behavioral procedures with explicit steps and guardrails, not human-oriented narrative docs.

**Key files:**
- `packages/deck-engine/skills/deck-add-slide/SKILL.md`
- `packages/deck-engine/skills/deck-validate-project/SKILL.md`
- `packages/deck-engine/skills/deck-inspect/SKILL.md`
- `packages/deck-engine/skills/deck-sketch/SKILL.md`
- `packages/deck-engine/skills/deck-generate-image/SKILL.md`

---

### SCAFFOLD-001: Scaffolder Copies Engine Assets
**Author:** Basher | **Date:** 2026-03-15 | **Status:** Implemented

1. **`copyEngineAssets(dir)` runs before npm install** — the scaffolder copies skills, instructions, and `AGENTS.md` into the generated deck before dependency installation starts.
2. **The copy step is resilient to install failures** — Copilot assets remain available even if `npm install` fails, while `init-project.mjs` still re-syncs stateful project files after install.
3. **Descriptor files are reachable from generated decks** — built-in descriptors resolve through the local `node_modules/@deckio/deck-engine/themes/descriptors/*` path, including `file:` protocol symlink installs.
4. **The engine package explicitly exports descriptors** — `package.json` includes `"./themes/descriptors/*"` so tools can read them without private path hacks.

**Key files:**
- `packages/create-deckio/index.mjs` — `copyEngineAssets()`
- `packages/deck-engine/package.json` — descriptor export
- `packages/deck-engine/scripts/init-project.mjs` — post-install sync

---

### THEME-003: SlideContext Theme Integration
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

### BUILD-001: Browser/Node Boundary
**Author:** Basher | **Date:** 2026-03-15 | **Status:** Implemented

1. **`@deckio/deck-engine` browser entry stays browser-safe** — `packages/deck-engine/index.js` exports runtime React components only and no longer pulls in modules that transitively require Node.js builtins.
2. **Node-only theme resolution lives behind `vite.js`** — `resolveTheme()`, `getAvailableThemes()`, and filesystem-backed theme loading stay in `packages/deck-engine/vite.js` and `themes/theme-loader.js`, not the browser entry.
3. **Exports map enforces the split** — `.` resolves to `index.js` for browser consumers, while `./vite` and `./vite.js` expose the Node-side integration point explicitly.
4. **This fixed production build crashes** — dev mode could mask the mistake, but Rollup production builds broke when browser bundles touched `fs`/`path` code.

**Key files:**
- `packages/deck-engine/index.js` — browser-safe exports
- `packages/deck-engine/vite.js` — Node-only theme helpers
- `packages/deck-engine/package.json` — exports map boundary

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

### CLI-001: CLI TUI Overhaul
**Author:** Basher | **Date:** 2026-03-15 | **Status:** Implemented

1. **`@clack/prompts` replaced the old readline flow** — the scaffolder now uses a proper TUI with `intro()`, `text()`, `select()`, `spinner()`, and `outro()`, plus graceful Ctrl+C handling.
2. **Prompt flow is hierarchical** — interactive onboarding now asks for design system first, then appearance, then the right color control for that path (accent presets for default decks, Aurora palette for shadcn decks).
3. **Default-system color choice uses curated swatches** — 8 preset accent colors render with ANSI swatches, plus a validated custom-hex escape hatch.
4. **Appearance is chosen at scaffold time** — there is no runtime ModeToggle in generated decks. The scaffolded `ThemeProvider` only applies the selected dark/light appearance.
5. **Non-interactive mode follows the same model** — `DECK_DESIGN_SYSTEM`, `DECK_APPEARANCE`, `DECK_ACCENT`, and `DECK_AURORA_PALETTE` mirror the interactive flow.

**Key files:**
- `packages/create-deckio/package.json` — `@clack/prompts`
- `packages/create-deckio/index.mjs` — prompt tree + install spinner
- `packages/create-deckio/utils.mjs` — preset exports and scaffolded app wiring

---

### REACTBITS-001: ReactBits Integration
**Author:** Basher | **Date:** 2026-03-15 | **Status:** Implemented

1. **Generated shadcn decks ship real ReactBits source** — Aurora, BlurText, ShinyText, DecryptedText, and SpotlightCard are scaffolded from verified local source files instead of hand-rolled imitations.
2. **Aurora is part of the app shell, not a single slide** — `App.jsx` renders the Aurora background once in a fixed global layer so it persists across navigation instead of only appearing on the cover.
3. **Starter slides exercise the curated component set** — the default shadcn slides use BlurText, ShinyText, DecryptedText, and SpotlightCard so fresh projects immediately demonstrate the intended ecosystem.
4. **shadcn onboarding includes curated Aurora palettes** — Ocean, Sunset, Forest, Nebula, Arctic, and Minimal are the supported palette choices, and the scaffold derives the accent from the selected palette.
5. **The ReactBits registry remains available for expansion** — generated `components.json` keeps `@react-bits` configured so users can pull in more components later with the shadcn CLI.

**Key files:**
- `packages/create-deckio/templates/react-bits/aurora.jsx`
- `packages/create-deckio/templates/react-bits/blur-text.jsx`
- `packages/create-deckio/templates/react-bits/shiny-text.jsx`
- `packages/create-deckio/templates/react-bits/decrypted-text.jsx`
- `packages/create-deckio/templates/react-bits/spotlight-card.jsx`
- `packages/create-deckio/utils.mjs`

---

### ARCH-002: Multi-Design-System Architecture Assessment
**Author:** Rusty | **Date:** 2026-03-15 | **Status:** Active

1. **Do not reposition DECKIO as a general multi-design-system engine** — too broad, too early, too likely to blur the product identity.
2. **`theme` and `designSystem` are separate axes** — `theme` controls CSS tokens (visual appearance); `designSystem` controls component library infrastructure. Conflating them will make the product muddy.
3. **One opt-in `shadcn` adapter is the right experiment** — framed as "presentation authoring with familiar components," not "full app UI inside slides."
4. **Engine stays lean** — shadcn infrastructure belongs in scaffolder presets and generated project files only. Never a runtime dep of `@deckio/deck-engine`.
5. **Presentation-valid shadcn primitives:** Card, Badge, Button (visual CTA), Separator, Tabs, Accordion, Table, Alert, Avatar. App-interaction widgets (Dialog, Sheet, Tooltip, Input) are low-value in a presentation context.
6. **Prove usage before supporting a second design system** — adapter explosion (MUI, Chakra, Park UI) is a real scope-creep risk.
7. **Success criteria:** do authors actually use generated shadcn components in real decks?

---

### SHADCN-001: shadcn/ui Design System Integration
**Author:** Basher | **Date:** 2026-03-15 | **Status:** Implemented

1. **`designSystem` is separate from `theme`** — `theme` controls visual appearance; `designSystem` controls component library infrastructure. You can have `theme: "shadcn"` with `designSystem: "none"` (just the look) or `designSystem: "shadcn"` (the full component system).
2. **CLI flow chooses design system first** — the scaffolder asks for design system, then appearance, then writes the shadcn-specific files only when the shadcn path is selected.
3. **Pre-generated files, not `npx shadcn init`** — generates `components.json`, `src/lib/utils.js`, `jsconfig.json`, and the Vite `@` alias. Running `npx shadcn init` is interactive and fragile; pre-generation is faster and deterministic.
4. **`jsconfig.json` is required** — shadcn CLI fails without it. Needs the `@/*` path mapping to resolve `@/lib/utils` and `@/components/ui/*`.
5. **`tsx: false`, `rsc: false`** — DECKIO uses JSX (not TypeScript) and has no React Server Components. shadcn CLI generates `.jsx` accordingly.
6. **ReactBits registry in `components.json`** — `registries: { "@react-bits": "https://reactbits.dev/r/{name}.json" }` enables `npx shadcn add @react-bits/animated-content` in shadcn-enabled projects.
7. **Non-interactive mode mirrors the interactive flow** — `DECK_DESIGN_SYSTEM` and `DECK_APPEARANCE` drive the shadcn path without needing interactive prompts.
8. **`VITE_CONFIG` replaced with `viteConfig()` function** — needed to conditionally include the `resolve.alias` block based on `designSystem`.

**Key files:**
- `packages/create-deckio/utils.mjs` — `packageJson()`, `deckConfig()`, `viteConfig()`, `componentsJson()`, `cnUtility()`, `jsConfig()`
- `packages/create-deckio/index.mjs` — shadcn prompt, conditional file generation, README shadcn section

---

### CSS-001: @layer Strategy for shadcn/ui Compatibility
**Author:** Livingston | **Date:** 2026-03-15 | **Status:** Implemented

1. **Engine adapts to the ecosystem** — `global.css` now declares `@layer theme, base, components, utilities;` matching Tailwind v4's internal layer names exactly.
2. **Layer order declaration lives in `global.css`** — it is imported first in scaffolded projects, so this declaration wins.
3. **Engine reset and token defaults in `@layer base`** — same cascade priority as Tailwind's preflight; no override war with spacing/margin/padding utilities.
4. **Engine component styles in `@layer components`** — Tailwind utilities (`@layer utilities`) correctly override engine defaults when needed.
5. **Theme CSS `:root` blocks remain unlayered** — unlayered = highest cascade priority; theme token values always win over Tailwind and engine defaults.
6. **CSS Modules don't need layers** — scoped hashed class names are inherently safe from Tailwind utility name collisions.
7. **Full shadcn compatibility** — engine and shadcn share the same CSS variable names (`--background`, `--foreground`, `--primary`, etc.); shadcn components read engine tokens correctly.

**Key files:**
- `packages/deck-engine/styles/global.css` — layer order declaration, `@layer base`, `@layer components`

---

### 2026-03-13T02:47:00Z: User Directive — ReactBits as Complementary Library
**By:** Ali Soliman (via Copilot) | **Date:** 2026-03-13 | **Status:** Implemented

ReactBits (reactbits.dev) should be included as a complementary animation and components library alongside shadcn in the design system. It has cool animations and UI components that complement shadcn's more structural components. Implemented via ReactBits registry entry in generated `components.json` for shadcn-enabled projects.

---

### SLIDES-001: shadcn-Specific Starter Slide Templates
**Author:** Saul + Livingston | **Date:** 2026-03-15 | **Status:** Implemented

1. **`designSystem` drives template selection** — when `designSystem: "shadcn"`, the scaffolder emits a four-slide starter deck (`CoverSlide`, `FeaturesSlide`, `GettingStartedSlide`, `ThankYouSlide`). Dark/light themes keep the original two-slide orb/glow starter.
2. **shadcn CoverSlide removes orbs entirely** — no gradient orbs, no accent-bar. Replaced with a pill badge (pulsing dot + project slug), shimmer accent line, gradient-shift title, and clean card-style meta bar. All CSS uses semantic tokens (`--background`, `--foreground`, `--card`, `--border`, `--radius`, `--muted-foreground`, `--secondary`).
3. **shadcn ThankYouSlide is a local file** — dark/light themes reuse the engine's `GenericThankYouSlide` (with glows/streaks). shadcn generates a local `ThankYouSlide.jsx` + `.module.css` with animated gradient text, clean divider, no orbs/streaks. `deckConfig()` imports accordingly.
4. **Starter slides use real ReactBits components** — generated shadcn decks scaffold actual `BlurText`, `ShinyText`, `DecryptedText`, and `SpotlightCard` source files locally, then import them directly in the starter slides. No network fetch is required at runtime.
5. **New exports from `utils.mjs`** — `coverSlideJsxShadcn()`, `featuresSlideJsxShadcn()`, `gettingStartedSlideJsxShadcn()`, `thankYouSlideJsxShadcn()` plus their CSS constants. All stay testable as pure functions.

**Key files:**
- `packages/create-deckio/utils.mjs` — shadcn template functions + CSS constants
- `packages/create-deckio/index.mjs` — conditional template selection

---

### DARK-001: Scaffold-Time Appearance Selection for shadcn
**Author:** Basher | **Date:** 2026-03-15 | **Status:** Implemented

1. **Only shadcn decks get appearance selection** — default DECKIO themes stay single-mode CSS themes, while shadcn decks choose `dark` or `light` during scaffolding.
2. **Generated projects still use the standard shadcn class pattern** — `ThemeProvider` applies `.dark` / `.light` classes on `<html>` so the same semantic tokens can drive both appearances.
3. **There is no runtime toggle UI** — `ModeToggle` was intentionally removed. Appearance is set when the deck is scaffolded, not changed live during presentations.
4. **`appJsx()` wires the chosen appearance into the scaffold** — the provider seeds the selected default theme, while non-shadcn projects still render without `ThemeProvider`.

**Key files:**
- `packages/create-deckio/utils.mjs` — `themeProviderJsx()` and `appJsx()`
- `packages/create-deckio/index.mjs` — appearance prompt + scaffolded file generation

---

### 2026-03-13T13:50:00Z: User Directive — Use Ecosystem Components First
**By:** Ali Soliman (via Copilot) | **Date:** 2026-03-13 | **Status:** Active

1. **Use existing ecosystem components whenever they fit** — prefer ReactBits, shadcn, and other established libraries over custom rebuilds.
2. **Do not reinvent integrated primitives** — shipping a homegrown substitute for something ReactBits/shadcn already provides is a product mistake, not craftsmanship.
3. **Custom implementations are the fallback path** — only build from scratch when the ecosystem genuinely does not cover the need.

---

### 2026-03-15T11:30:00Z: User Directive — No Runtime Dark/Light Toggle
**By:** Ali Soliman (via Copilot) | **Date:** 2026-03-15 | **Status:** Active

1. **Appearance is chosen at scaffold time** — generated decks should start in the selected appearance and stay there.
2. **`ModeToggle` is intentionally absent** — this is a design decision, not a bug or unfinished feature.
3. **Dark/light variation belongs in onboarding and config** — not in presentation-time chrome.

---

### 2026-03-15T12:00:00Z: User Directive — Skills Are for AI Coding CLIs
**By:** Ali Soliman (via Copilot) | **Date:** 2026-03-15 | **Status:** Active

1. **Skills are operational procedures for AI coding agents** — they must tell the agent exactly what to read, how to resolve the descriptor, and what rules to follow.
2. **Human-friendly essays are insufficient** — every skill needs explicit behavior, exact skeletons, and guardrails that an AI CLI can execute reliably.
3. **Future skill work should optimize for agent consumption first** — wording, structure, and examples should reduce ambiguity for autonomous coding tools.

---

## Governance

- All meaningful changes require team consensus
- Document architectural decisions here
- Keep history focused on work, decisions focused on direction

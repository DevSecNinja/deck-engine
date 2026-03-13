# Project Context

- **Owner:** Ali Soliman
- **Project:** DECKIO / deck-engine — a presentation engine and scaffolder for creating beautiful, Copilot-powered slide decks
- **Stack:** Node.js monorepo (npm workspaces), Vite, HTML/CSS/JS, packages: `@deckio/deck-engine` and `@deckio/create-deck-project`
- **Created:** 2026-03-13

## Learnings

<!-- Append new learnings below. Each entry is something lasting about the project. -->
- **2026-03-13 Team Kickoff:** Zero dev scripts exist; `npm run dev` missing entirely. Export code duplicated across browser/export and cli/pdf; consolidation into shared utility is Phase 1 priority. Bundling solid but no dev loop ergonomics. CLI export driver works but lacks error handling and progress indicators.
- **Team Findings (Rusty synthesis):** SlideProvider handles state persistence elegantly; Vite integration dedupes react/react-dom via subpath import magic. Copilot skills are file-driven (no code plugins). Export uses modern-screenshot for slides + Puppeteer for PDF assembly. No generalized plugin API yet; extensibility via React composition.
- **Phase 1 Roadmap:** Implement dev/build/preview scripts, consolidate export logic, add CLI error handling. Phase 1 is dev workflow + Vitest infrastructure (Linus concurrent). Phase 2 layout + animation (Livingston). Phase 3 polish + presenter mode.
- **Phase 1 Dev Workflow (done):** Root scripts added (dev/build/test/lint) via npm workspace delegation. Engine ships raw .jsx — no build step needed, `build` uses `--if-present`. `prepublishOnly` added to engine. Scaffolder pinned engine dep `^1.7.7` → `^1.8.2`. `capture-screen.mjs` was Windows-only (hardcoded Edge path) — now cross-platform. Stale `.tgz` removed and `*.tgz` added to `.gitignore`. Key paths: root `package.json` (scripts), `packages/deck-engine/package.json` (prepublishOnly), `packages/deck-engine/scripts/capture-screen.mjs` (browser detection).
- **Team Update (2026-03-13T00:58:09Z):** Linus completed Vitest setup — 33 tests now passing. `prepublishOnly` gate is now live and meaningful (will run tests on publish). Saul's design audit found no CSS in create-deckio; Phase 2 token work is scoped entirely to deck-engine. DEV-001 filed in decisions.md.
- **Tailwind CSS v4 + Theme Architecture (2026-03-13T01:45:00Z):** Installed `tailwindcss` + `@tailwindcss/vite` in deck-engine. Vite plugin (`vite.js`) now exports `deckPlugin()`, `deckPlugins()` (combo), and `tailwindPlugin()`. Created `themes/` directory with pluggable theme system: `dark.css`, `light.css`, `shadcn.css` — each has CSS custom properties + `@theme inline` bridge for Tailwind utility generation. Theme loader (`themes/theme-loader.js`) provides `resolveTheme()` and `getAvailableThemes()`. New themes = drop a CSS file. Scaffolder updated: `deck.config.js` now has `theme` field (defaults to "dark"), CLI asks for theme during onboarding, `main.jsx` imports theme CSS from engine. Generated projects include `tailwindcss` + `@tailwindcss/vite` in devDeps. Backwards compatible — existing decks without `theme` field still work. 49 tests passing (was 33). THEME-001 filed.

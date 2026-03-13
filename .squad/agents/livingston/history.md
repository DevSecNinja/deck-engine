# Project Context

- **Owner:** Ali Soliman
- **Project:** DECKIO / deck-engine — a presentation engine and scaffolder for creating beautiful, Copilot-powered slide decks
- **Stack:** Node.js monorepo (npm workspaces), Vite, HTML/CSS/JS, packages: `@deckio/deck-engine` and `@deckio/create-deck-project`
- **Created:** 2026-03-13

## Learnings

<!-- Append new learnings below. Each entry is something lasting about the project. -->
- **2026-03-13 Team Kickoff:** No layout component library; layouts hardcoded per-slide. Animation system missing entirely (CSS transitions only). Presenter mode not implemented. Slide rendering is robust; chrome and export flows clean. `@deckio/deck-engine` provides primitives: SlideProvider, Slide, Navigation.
- **Team Findings (Rusty synthesis):** Rendering foundation strong. Export uses modern-screenshot (browser) + Puppeteer (CLI) + PDF assembly. Navigation handles PDF/PPTX export props. Design tokens missing; typography in docs only. No animation library (framer-motion, react-spring).
- **Phase 2 Roadmap:** Build layout library (Title, 2-Column, Grid, Full-Bleed, Cards), add animation presets, design speaker notes schema. Phase 1 concurrent work: Basher dev scripts + Linus Vitest. Phase 2 blocks on design tokens (Saul). Phase 3 includes presenter mode + keyboard controls.
- **Theme Wiring (2026-03-13T02:15:00Z):** Wired theme system into SlideContext. SlideProvider now accepts `theme` prop, sets `data-theme` on `<html>`, exposes `theme`/`setTheme` in context. All component CSS (Navigation, BottomBar, GenericThankYouSlide) already uses Saul's semantic tokens — zero hardcoded colors. Theme CSS is imported at build time (main.jsx); `data-theme` attribute provides a CSS hook for per-theme scoping. Runtime switching is supported at context level (consumer swaps CSS import or uses scoped selectors). Export fallbacks (`#080b10`) in exportDeckPdf/Pptx are valid safety nets. No Node.js imports in browser code — `SlideContext` uses `DEFAULT_THEME` constant instead of importing from `theme-loader.js`. Full runtime switching deferred (requires pre-compiled CSS per theme). THEME-002 filed.

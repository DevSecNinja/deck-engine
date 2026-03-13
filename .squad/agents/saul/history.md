# Project Context

- **Owner:** Ali Soliman
- **Project:** DECKIO / deck-engine — a presentation engine and scaffolder for creating beautiful, Copilot-powered slide decks
- **Stack:** Node.js monorepo (npm workspaces), Vite, HTML/CSS/JS, packages: `@deckio/deck-engine` and `@deckio/create-deck-project`
- **Created:** 2026-03-13

## Learnings

<!-- Append new learnings below. Each entry is something lasting about the project. -->
- **2026-03-13 Team Kickoff:** Typography defined in README but not codified as tokens. No spacing scale; margins/padding hardcoded. Color system minimal (only --accent var). Dead CSS found; design system scattered. Global.css has slide shell primitives but incomplete token foundation.
- **Team Findings (Rusty synthesis):** SlideProvider + Slide + Navigation architecture solid. Export is modern-screenshot + Puppeteer + PDF assembly. CLI scaffolder seeds Copilot skills/instructions into generated decks. No plugin API yet; extensibility via React composition. Vite dedupe pattern critical for SlideContext sharing.
- **Phase 2 Roadmap:** Extract typography tokens (fonts, sizes, weights, line heights), define spacing scale (4px base), add semantic colors (success/error/warning/info). Create design-tokens.md + CSS token defs. Refactor component styles to use tokens. Phase 1 concurrent: Basher + Linus. Phase 3: dark mode + accessibility audit.
- **2026-03-13 Design Token Audit:** Full audit completed → `.squad/agents/saul/design-token-audit.md`. Key findings: 16 custom properties in `:root` (14 color, 2 layout). 3 unused tokens (`--blue-bright`, `--purple-deep`, `--orange`). `--blue-glow` defined but bypassed 6× with raw rgba. Zero typography/spacing/radius/z-index/transition tokens. `ThankYouSlide.module.css` is 132 lines of dead code (not imported anywhere). `#f85149` error red hardcoded in 2 places needs `--error` token. Font sizes: 10/11/12/13/20/28/40–64px — ad-hoc, no scale. Spacing: roughly 4px-base but uncodified. All 4 CSS files audited: global.css, Navigation.module.css, BottomBar.module.css, ThankYouSlide.module.css. No CSS in create-deckio scaffolder. No line-height values set anywhere. No focus-visible or reduced-motion styles exist.
- **Team Update (2026-03-13T00:58:09Z):** Phase 1 complete — dev workflow and tests now live. Phase 2 design work can begin. Dead CSS deletion (`ThankYouSlide.module.css`) and token additions must be coordinated with Livingston's layout component work to avoid merge conflicts. DESIGN-001 filed in decisions.md. Basher confirmed no CSS concerns in scaffolder.

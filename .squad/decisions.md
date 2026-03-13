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

## Governance

- All meaningful changes require team consensus
- Document architectural decisions here
- Keep history focused on work, decisions focused on direction

# SKILL-002: Design-System Supplement Layer Pattern

**Author:** Basher
**Date:** 2026-03-15
**Status:** Proposed
**Relates to:** SHADCN-001, Issue #10

## Decision

When `designSystem` is set in `deck.config.js`, skills and agents should load a supplementary authoring layer alongside the theme descriptor. For shadcn, this means three files:

1. **Theme descriptor** (`shadcn.md`) — visual language, token contract, slide personality
2. **Setup contract** (`shadcn-setup.instructions.md`) — infrastructure wiring, verification checklist
3. **Component reference** (`shadcn-components.instructions.md`) — availability matrix, migration patterns, decision tree

## Rationale

The theme descriptor alone doesn't tell agents which components exist and how to use them. Separating visual rules (Saul's domain) from component authoring rules (engineering domain) lets both evolve independently. The `designSystem` field is already the trigger — no new runtime mechanism needed.

## Pattern for future design systems

If a new design system is added (e.g., `designSystem: 'radix'`), create matching `<name>-setup.instructions.md` and `<name>-components.instructions.md` files. Skills already check `designSystem` — they just need to load the right supplement.

## Team impact

- **Saul:** Descriptors remain his domain. Supplement files don't overlap.
- **Livingston:** Component reference informs which imports are valid in slide JSX.
- **Linus:** Validate skill now checks preinstalled component integrity for shadcn decks.
- **Rusty:** Pattern extends cleanly to future design system axes.

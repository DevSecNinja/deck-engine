---
name: deck-add-slide
description: Guide for adding a new slide to a deck project. Use this when asked to create, add, or build a new slide component.
---

# Adding a Slide to a Deck Project

## Step 0 — Resolve the descriptor and design system

Read `.github/instructions/descriptor-resolution.instructions.md` first. It tells you how to pick the right theme descriptor, how to cross-check `designSystem`, and which shadcn supplements to load. Follow the descriptor exactly for slide structure, CSS, tokens, decorative elements, allowed components, and anti-patterns.

## Step 1 — Inline editing contract

Also read `.github/instructions/inline-editing.instructions.md` before writing slide JSX.

- Import `Editable` from `@deckio/deck-engine` for any slide with user-facing copy.
- Import `EditableList` from `@deckio/deck-engine` when the slide renders a list of user content.
- Wrap titles, subtitles, body copy, captions, semantic labels, metrics, badges, list items, quotes, and `BottomBar` footer text in `<Editable>`.
- Wrap any `.map()` over a user-content array (cards, bullets, steps, KPIs, features) in `<EditableList id="<slide>.<list>" items={…} keyOf={(i) => i.id}>`. Each item MUST have a stable `id` field. Skip `EditableList` only for decorative arrays (icons, orbs, dots, glyphs).
- Use stable, semantic IDs such as `slideName.title`, `slideName.items.<itemId>.label`, or `slideName.footer`.
- Do not wrap decorative glyphs, watermarks, fixed counters, icons, or layout-only text.

## Step 2 — Create the slide from the descriptor

The descriptor is the source of truth. Read these sections before generating code:

1. **Exact JSX skeleton**
2. **Exact CSS skeleton**
3. **Token table**
4. **Decorative elements available**
5. **Available components**
6. **Anti-patterns**
7. **Example slide direction**

Do not paraphrase the structure if the descriptor gives an exact skeleton. Start from it, then fill in real content.

## Step 3 — Registration in `deck.config.js`

After creating the slide files:

1. Add an import at the top: `import MyNewSlide from './src/slides/MyNewSlide.jsx'`
2. Add the component to the `slides` array at the desired position.
3. Do **not** change `theme`, `designSystem`, or `aurora` while registering the slide.

The generic `App.jsx` renders slides from this array and passes `index` automatically. You do **not** manage slide indices manually.

## Step 4 — Common limits and guardrails

These apply regardless of theme:

- Always include `content-frame content-gutter`
- Always include `BottomBar` as the last child inside `<Slide>`
- Always wrap `BottomBar text` in `<Editable as="span" id="slideName.footer">...</Editable>` when the footer text is user-facing
- Always wrap user-content `.map()` calls in `<EditableList>` with a stable item `id` field (skip only for decorative arrays)
- Always use ESM imports for images and logos
- Never use string paths for images
- Never use `flex: 1` on the body wrapper
- Never add `flex-direction: column` on the slide root
- Never overload a slide until it overflows the viewport

### Content density limits

| Layout | Max items | Notes |
|--------|-----------|-------|
| Cards (3-col grid) | 6 (2 rows) | Reduce card padding if tight |
| Cards (2-col grid) | 4 (2 rows) | Preferred for detailed cards |
| Timeline / event list | 3–4 items | Use compact card height for 4 |
| Bullet points | 6–8 | Depends on line length |
| Full-width content blocks | 2–3 | Split across slides if it gets tight |

## Step 5 — Verify

After writing the slide:

1. Re-read the descriptor and confirm the slide still matches it.
2. Run the project validation flow.
3. Visually inspect the slide in the deck.

## Quick checklist

- [ ] Resolved the descriptor + designSystem per `descriptor-resolution.instructions.md`
- [ ] Read `inline-editing.instructions.md`
- [ ] Imported `Editable` when the slide contains user-facing text
- [ ] Imported `EditableList` when the slide renders a user-content list, and wrapped the `.map()` with stable item IDs
- [ ] Wrapped user-facing text and `BottomBar text` in `<Editable>` with unique semantic IDs
- [ ] Left decorative glyphs, icons, counters, and watermarks non-editable
- [ ] Used the descriptor's exact JSX skeleton or direct variant of it
- [ ] Used the descriptor's exact CSS skeleton or direct variant of it
- [ ] Stayed inside the descriptor's token set and component ecosystem
- [ ] Avoided the descriptor's anti-patterns
- [ ] Added the import to `deck.config.js`
- [ ] Added the slide to the `slides` array
- [ ] Left `theme`, `designSystem`, and `aurora` unchanged

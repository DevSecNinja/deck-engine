---
description: "Use when creating or editing slides. Explains how to mark user-facing text as editable for inline editing in local development."
applyTo: "**/slides/**/*.jsx"
---

# Inline Editing — Marking Text as Editable

## When to use `<Editable>`

Wrap **user-facing presentation content** (titles, subtitles, body copy, captions, labels, footer text) in `<Editable>` so users can double-click to edit during local development.

### ✅ DO wrap

- Slide titles, headings, subheadings
- Body text, descriptions, captions
- List item text, bullet points
- Quote text, testimonials
- Footer text passed to `<BottomBar>`
- Labels, badges, and tags that carry semantic meaning
- Data labels and metric titles

### ❌ DO NOT wrap

- Decorative text (e.g., "DECKIO" watermark, brand lockups)
- Icon glyphs, emoji used as decorative elements
- Structural CSS classes or layout text
- Code snippets, syntax-highlighted content (unless it's example code the user would customize)
- Fixed UI labels that are part of the slide chrome (e.g., "Step 1 of 3" counters)

## Import

```jsx
import { Editable } from '@deckio/deck-engine'
// or
import { BottomBar, Editable, Slide } from '@deckio/deck-engine'
```

## Basic usage

```jsx
<Editable as="h1" id="cover.title" className={styles.title}>
  My Presentation Title
</Editable>

<Editable as="p" id="slide.description">
  This is a description paragraph.
</Editable>

<Editable as="span" id="metric.label">Revenue</Editable>
```

## Props

- **`id`** (required): Unique field identifier. Use dot-notation for hierarchy (e.g., `cover.title`, `features.item1.title`)
- **`as`**: HTML tag (default `span`). Use `h1`, `h2`, `h3`, `p`, `span`, etc.
- **`className`**: CSS classes to apply
- **`multiline`**: Set to `true` for multi-line text (e.g., paragraphs, descriptions). Allows Shift+Enter for line breaks.
- **`allowEmpty`**: Set to `true` if the field can be empty. By default, empty values are rejected.

## BottomBar footer pattern

When passing footer text to `<BottomBar>`, wrap it in `<Editable>`:

```jsx
<BottomBar text={<Editable as="span" id="slide.footer">Footer Text</Editable>} />
```

If the footer is optional/dynamic:

```jsx
<BottomBar text={footerText && <Editable as="span" id="slide.footer">{footerText}</Editable>} />
```

## Dynamic IDs for lists/arrays

When mapping over data arrays, use template literal IDs to ensure each item has a unique, stable ID:

```jsx
{features.map((f) => (
  <div key={f.id}>
    <Editable as="h3" id={`features.items.${f.id}.title`}>
      {f.title}
    </Editable>
    <Editable as="p" id={`features.items.${f.id}.desc`}>
      {f.description}
    </Editable>
  </div>
))}
```

Use `f.id` (or another stable identifier) in the template literal, NOT the array index `i`.

## Conditional content

If the content is optional, only render `<Editable>` when the content exists:

```jsx
{tagline && <Editable as="p" id="slide.tagline">{tagline}</Editable>}
```

## Combining with other components

`<Editable>` can wrap text inside shadcn components:

```jsx
<Badge variant="outline">
  <Editable as="span" id="badge.label">Premium</Editable>
</Badge>

<Button>
  <Editable as="span" id="button.label">Click Me</Editable>
</Button>

<CardTitle>
  <Editable as="span" id="card.title">Card Title</Editable>
</CardTitle>
```

## ID naming conventions

Use hierarchical dot-notation:

- `cover.title`, `cover.subtitle`, `cover.footer`
- `features.heading`, `features.lead`
- `features.items.<itemId>.title`, `features.items.<itemId>.desc`
- `step1.title`, `step2.description`
- `thankYou.title`, `thankYou.subtitle`, `thankYou.footer`

Avoid generic IDs like `text1`, `paragraph`, `heading`. Use semantic names that describe the content's role.

## Production behavior

In production builds or when the inline editing provider is not present:
- `<Editable>` renders as a plain HTML element (no special behavior)
- No event listeners, no contenteditable attribute
- Zero bundle overhead

## Edge cases

### Default/fallback content

```jsx
<Editable as="p" id="slide.subtitle">
  {subtitle || <>Default subtitle text</>}
</Editable>
```

### Props passed to underlying element

`<Editable>` forwards props to the underlying HTML element:

```jsx
<Editable as="h1" id="title" className={styles.hero} style={{ color: 'red' }}>
  Title
</Editable>
```

Renders as `<h1 className="styles.hero deckio-editable" style="..." data-deckio-field="title">`.

## What NOT to do

❌ **Do NOT nest `<Editable>` inside another `<Editable>`**

```jsx
// BAD
<Editable as="h1" id="title">
  <Editable as="span" id="highlight">Word</Editable>
</Editable>
```

❌ **Do NOT use the same ID twice**

```jsx
// BAD — IDs must be unique per deck
<Editable id="title">Slide 1</Editable>
<Editable id="title">Slide 2</Editable>
```

❌ **Do NOT wrap large blocks with mixed structural + semantic content**

```jsx
// BAD — wrap only the text, not the container
<Editable as="div" id="section">
  <h2>Title</h2>
  <p>Description</p>
</Editable>

// GOOD — wrap individual text elements
<div>
  <Editable as="h2" id="section.title">Title</Editable>
  <Editable as="p" id="section.desc">Description</Editable>
</div>
```

## When generating new slides

Always wrap user-facing text in `<Editable>` by default. Follow the patterns in the scaffolded CoverSlide and shadcn slide templates (check `coverSlideJsx`, `coverSlideJsxShadcn`, `featuresSlideJsxShadcn`, etc. in `create-deckio/utils.mjs` and `create-deckio/index.mjs`).

## Related

- **Editable component implementation**: `packages/deck-engine/components/Editable.jsx`
- **Scaffold templates**: `packages/create-deckio/index.mjs`, `packages/create-deckio/utils.mjs`
- **Tests**: `packages/create-deckio/__tests__/utils.test.js` (search for "inline editing")

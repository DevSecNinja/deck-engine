---
name: deck-generate-image
description: Generate images (icons, illustrations, diagrams) using chatgpt-image-latest for use in slide components. Use this when a slide needs a visual element too complex for pure HTML/CSS.
---

# Generate Images for Slides

Generate images via the OpenAI **Image API** with `chatgpt-image-latest` for specific visual elements within slides.

> If `chatgpt-image-latest` returns a 403, pass `--model gpt-image-1.5` as a fallback.

## When to use

- A slide needs an **icon or illustration** that doesn't exist in the codebase.
- A sketch element is too detailed to reproduce with CSS.
- The user explicitly asks for a generated graphic.

## When NOT to use

- For entire slides — use **deck-add-slide** instead.
- For simple shapes — use CSS or inline SVG.
- For logos or photos — source them directly.

## Prerequisites

The `OPENAI_API_KEY` must be set. Create/edit `.env` in the project root:

```
OPENAI_API_KEY=sk-proj-...
```

## Workflow

### Step 1 — Read the active theme descriptor

Open `deck.config.js`, read `theme` and `designSystem`, then resolve the active theme descriptor using the same rules as `deck-add-slide`.

Use the descriptor as the source of truth for:

- palette and semantic token intent
- overall image style
- what decorative language belongs in the project
- what to avoid so the image does not fight the slide system

### Step 2 — Craft the prompt

Write a detailed prompt including:

- **Subject** — what the image depicts
- **Style** — match the descriptor's slide personality and example direction
- **Colors** — derive from the descriptor's token table and visual language instead of hardcoded hex values
- **Background** — usually "transparent background"
- **Aspect ratio** — square (`1024x1024`) for icons, wide (`1536x1024`) for banners

Examples:

- Dark descriptor → deep, high-contrast accents, presentation-friendly glow restraint
- Light descriptor → brighter, cleaner palette with subtle contrast and restrained glow
- shadcn descriptor → clean editorial/system aesthetic with semantic surfaces and no deep-space ornament

### Step 3 — Generate

Run from the project root:

```bash
node node_modules/@deckio/deck-engine/scripts/generate-image.mjs --prompt "your prompt" --name my-icon
node node_modules/@deckio/deck-engine/scripts/generate-image.mjs --prompt "..." --name hero --size 1536x1024
```

| Flag | Description | Default |
|---|---|---|
| `--prompt` | Image description (required) | — |
| `--name` | Filename without extension (required) | — |
| `--size` | `1024x1024`, `1536x1024`, `1024x1536`, `auto` | `1024x1024` |
| `--quality` | `low`, `medium`, `high`, `auto` | `auto` |
| `--model` | OpenAI model | `chatgpt-image-latest` |

Images are saved to `src/data/generated/`.

### Step 4 — Use in a slide

```jsx
import myIcon from '../data/generated/my-icon.png'

<img src={myIcon} alt="Bridge icon" style={{ width: 120, height: 120 }} />
```

### Step 5 — Iterate

If the image doesn't match expectations, refine the prompt and re-run with the same `--name` to overwrite. Use **deck-inspect** to verify how it looks in the slide.

## SVG alternative

For simple icons, write SVG markup directly in JSX:

```jsx
<svg width="48" height="48" viewBox="0 0 48 48" fill="none">
  <circle cx="24" cy="24" r="20" stroke="currentColor" strokeWidth="2" />
</svg>
```

Prefer inline SVG for geometric shapes. Use image generation for complex illustrations.

---
name: canvas-generate-image
description: Generate images (icons, illustrations, diagrams) using chatgpt-image-latest for use in slide components. Use this when a slide needs a visual element that is too complex for pure HTML/CSS — icons, illustrations, diagrams, or artistic elements. NOT for full slides.
---

# Generate Images for Slides

Generate images via the OpenAI **Image API** with `chatgpt-image-latest` for specific visual elements within slides. Use this when HTML/CSS alone can't achieve the desired visual — complex icons, illustrations, technical diagrams, or artistic elements.

> If `chatgpt-image-latest` returns a 403 (org verification required), pass `--model gpt-image-1.5` as a fallback.

## When to use

- A slide needs an **icon or illustration** that doesn't exist in the codebase.
- A sketch element is too detailed to reproduce with CSS (e.g. hand-drawn style diagram).
- The user explicitly asks for a generated graphic.

## When NOT to use

- For entire slides — use **canvas-add-slide** instead.
- For simple shapes, lines, or boxes — use CSS.
- For text-based content — use HTML typography.
- For logos or photos — source them directly, don't generate.

## Prerequisites

The `OPENAI_API_KEY` is stored in `deck/.env` (gitignored). The script reads it automatically.

If the key is missing or needs updating, create/edit `deck/.env`:

```
OPENAI_API_KEY=sk-proj-...
```

## Workflow

### Step 1 — Craft the prompt

Write a detailed prompt describing exactly what image is needed. Include:

- **Subject** — what the image depicts.
- **Style** — flat icon, line art, illustration, isometric, hand-drawn, etc.
- **Colors** — match the slide design system: `#0d1117` (bg-deep), `#58a6ff` (accent-blue), `#f0f6fc` (text-primary), `#3fb950` (green), `#f78166` (orange).
- **Background** — almost always "transparent background" for slide use.
- **Aspect ratio** — square (1024x1024) for icons, wide (1536x1024) for banners, tall (1024x1536) for portraits.

Good prompt example:
> "A flat-style line icon of a bridge connecting two platforms, using blue (#58a6ff) strokes on a transparent background. Minimal, clean, suitable for a dark-background presentation slide."

### Step 2 — Generate the image

Run from the `deck/` directory:

```bash
node scripts/generate-image.mjs --prompt "your prompt here" --name my-icon
node scripts/generate-image.mjs --prompt "..." --name hero-banner --size 1536x1024
```

| Flag | Description | Default |
|---|---|---|
| `--prompt` | Image description (required) | — |
| `--name` | Filename without extension (required) | — |
| `--size` | `1024x1024`, `1536x1024`, `1024x1536`, or `auto` | `1024x1024` |
| `--quality` | `low`, `medium`, `high`, or `auto` | `auto` |
| `--model` | OpenAI model | `chatgpt-image-latest` (fallback: `gpt-image-1.5`) |

Images are saved to `deck/src/data/generated/`.

### Step 3 — Use in a slide

Import the generated image in the slide component:

```jsx
import myIcon from '../../data/generated/my-icon.png'

// Then use it
<img src={myIcon} alt="Bridge icon" style={{ width: 120, height: 120 }} />
```

### Step 4 — Iterate if needed

If the image doesn't match expectations:
1. Refine the prompt (add more detail about style, colors, composition).
2. Re-run with the same `--name` to overwrite.
3. Use **canvas-eyes** to verify how it looks in the slide.

## SVG alternative

For simple icons or shapes, write SVG markup directly in JSX instead of generating a raster image:

```jsx
<svg width="48" height="48" viewBox="0 0 48 48" fill="none">
  <circle cx="24" cy="24" r="20" stroke="#58a6ff" strokeWidth="2" />
  <path d="M16 24h16M24 16v16" stroke="#58a6ff" strokeWidth="2" />
</svg>
```

Prefer inline SVG when:
- The shape is geometric or icon-like.
- You need it to scale perfectly.
- You want to match CSS variables for colors.

Use image generation when:
- The visual is too complex for hand-written SVG.
- You need an illustration, texture, or artistic element.
- The user provided a sketch reference that needs a polished version.

## Notes

- Generated images are **committed to git** (under `src/data/generated/`).
- Always use transparent backgrounds for slide overlays.
- Match the design system colors in your prompts for visual consistency.
- The API key is per-session — set it in the terminal, never in files.

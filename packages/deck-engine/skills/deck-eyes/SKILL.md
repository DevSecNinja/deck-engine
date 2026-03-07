````skill
---
name: deck-eyes
description: Capture a screenshot of the deck app to visually inspect slides. Use this when asked to look at, see, view, inspect, check visually, or preview a slide.
---

# Visual Inspection — Capture a Slide Screenshot

Captures a screenshot of the running deck via headless Edge to visually inspect slides.

## Deciding what to capture

1. **Slide** — resolve in this order:
   - If the user said "slide 3" or "the cover slide" → map to a 1-based number and use `--slide <N>`.
   - If you just created or edited a specific slide → use that slide's array position + 1.
   - If not specified → omit `--slide` (captures slide 1).

2. **Label** — optional. Use `--label` when taking multiple screenshots to distinguish them.

## Prerequisites

The dev server must be running. Check `.github/memory/state.md` for the port. Default is `5173`.

## Usage

Run from the project root:

```bash
node node_modules/@lopezleandro03/deck-engine/scripts/capture-screen.mjs --project <id> --port <port>
node node_modules/@lopezleandro03/deck-engine/scripts/capture-screen.mjs --slide 3
node node_modules/@lopezleandro03/deck-engine/scripts/capture-screen.mjs --slide 2 --label "cover-check"
```

The `--project` and `--port` values are read from `.github/memory/state.md` if not provided.

## After capturing

1. Read the script output — it prints the relative path under `.github/eyes/`.
2. Reference the screenshot image to visually inspect layout, typography, spacing, colors.
3. Report issues found (misalignment, overflow, missing elements, color problems).

## CLI flags

| Flag | Description | Default |
|---|---|---|
| `--project <id>` | Project id | from `deck.config.js` / `state.md` |
| `--slide <N>` | 1-based slide number | 1 |
| `--label <text>` | Custom filename label | — |
| `--port <N>` | Dev server port | from `state.md` (5173) |

````

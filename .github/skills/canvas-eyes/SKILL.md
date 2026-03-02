---
name: canvas-eyes
description: Capture a screenshot of the canvas app as rendered in the browser to visually inspect slides. Use this when asked to look at, see, view, inspect, check visually, or preview the app or a specific slide.
---

# Visual Inspection — Capture the Canvas App

Captures a screenshot of the running canvas app via headless Edge to visually inspect slides.

## Deciding what to capture

Before running the script, determine the **project** and **slide**:

1. **Project** — resolve in this order:
   - If the user named a project → use `--project <id>`.
   - If the conversation context makes the project obvious (e.g. you just edited a slide in `dev-plan`) → use that.
   - Otherwise read `project:` from `.github/memory/state.md`.
   - If still empty → ask the user.

2. **Slide** — resolve in this order:
   - If the user said "slide 3" or "the cover slide" → map to a 1-based number and use `--slide <N>`.
   - If you just created or edited a specific slide and the user says "let me see it" → use that slide's index + 1.
   - If not specified → omit `--slide` (captures slide 1).

3. **Label** — optional. Use `--label` when taking multiple screenshots of the same project/slide to distinguish them (e.g. `--label "before"` / `--label "after"`).

## Prerequisites

The dev server must be running. Check `.github/memory/state.md` for port. If not running:

```bash
cd deck && npx vite --port 5175
```

## Usage

Run from the `deck/` directory:

```bash
node scripts/capture-screen.mjs                                # project + port from state.md
node scripts/capture-screen.mjs --project dev-plan             # specific project
node scripts/capture-screen.mjs --slide 3                      # specific slide (1-based)
node scripts/capture-screen.mjs --project dev-plan --slide 2 --label "cover-check"
```

## After capturing

1. Read the script output — it prints the relative path under `.github/eyes/`.
2. Reference the screenshot image to visually inspect layout, typography, spacing, colors.
3. Report issues found (misalignment, overflow, missing elements, color problems).

## Cleanup

```bash
Remove-Item .github/eyes/*.png
```

The `.github/eyes/` folder is in `.gitignore` — do not commit screenshots.

## CLI flags

| Flag | Description | Default |
|---|---|---|
| `--project <id>` | Project to capture | `project:` from `state.md` |
| `--slide <N>` | 1-based slide number | 1 |
| `--label <text>` | Custom filename label | — |
| `--port <N>` | Dev server port | `port:` from `state.md` (5175) |

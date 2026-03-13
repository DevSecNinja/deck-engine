---
name: deck-inspect
description: Capture a screenshot of the deck app to visually inspect slides. Use this when asked to look at, see, view, inspect, check visually, or preview a slide.
---

# Visual Inspection — Capture a Slide Screenshot

Captures a screenshot of the running deck using VS Code browser tools (Edge "Sharing with Agent").

## Step 0 — Read `deck.config.js` and the active theme descriptor

Before deciding what to capture:

1. Open `deck.config.js`
2. Read `theme` and `designSystem`
3. Resolve and read the active theme descriptor using the same rules as `deck-add-slide`
4. Use that descriptor as the visual source of truth

Judge the screenshot against the descriptor's:

- slide personality
- decorative elements
- surface treatment
- component ecosystem
- anti-patterns

## Deciding what to capture

1. **Slide** — resolve in this order:
   - If the user said "slide 3" or "the cover slide" → map to a 1-based number.
   - If you just created or edited a specific slide → use that slide's array position + 1.
   - If not specified → capture slide 1.

## Prerequisites

The dev server must be running. Check `.github/memory/state.md` for the port. Default is `5173`.

## Workflow

### Step 1 — Open or reuse a browser page

Check the attached browser pages for an existing deck tab. If none exists, open one:

```
open_browser_page → http://localhost:<port>/#/<project-id>
```

Read `project` and `port` from `.github/memory/state.md` if not known.

### Step 2 — Navigate to the target slide

The deck opens on slide 1. To reach slide N, press `ArrowRight` (N − 1) times.

If the page is already on a different slide, navigate to slide 1 first by pressing `Home`, then advance forward.

### Step 3 — Take a screenshot

Use `screenshot_page` with the page ID to capture the current view.

### Step 4 — Inspect and report

Study the screenshot and check for:

- Layout alignment and spacing
- Typography hierarchy
- Missing or broken elements
- Color and contrast issues
- Overflow or clipping
- Theme or design-system mismatches

### Step 5 — Use the descriptor to judge fit

Examples of descriptor mismatches to flag:

- A default descriptor slide missing the left accent bar or orb treatment
- A shadcn descriptor slide showing DECKIO orb backgrounds or gradient card-top bars
- A shadcn descriptor slide that ignores semantic surfaces and looks like a dark DECKIO default slide
- A light descriptor slide using heavy dark-theme glows that muddy the canvas
- A slide importing or visually implying the wrong component ecosystem

If `designSystem` and the descriptor disagree, explicitly report that as a configuration mismatch.

When a mismatch exists, say the slide was built with the wrong theme/design-system pattern set and should be corrected using `deck-add-slide`.

---
name: canvas-add-slide
description: Guide for adding a new slide to an existing canvas project. Use this when asked to create, add, or build a new slide component within an existing deck/project. If the target project is not specified, ask the user which project the slide should be added to.
---

# Adding a Slide to an Existing Canvas Project

## Determine the target project

1. If the user specified a project in their prompt, use that.
2. Otherwise, check `.github/memory/state.md` for the `project:` field under `## Active Project`. If it has a value, use that project.
3. Only if both are empty, **ask the user** which project the slide belongs to. List available projects by checking `deck/src/App.jsx` for registered routes or by listing sub-directories under `deck/src/projects/`.

---

## A. Slide Component Structure (mandatory skeleton)

Every slide **must** follow this structure:

```jsx
import Slide from '../../components/Slide'
import BottomBar from '../../components/BottomBar'
import styles from './MyNewSlide.module.css'

export default function MyNewSlide() {
  return (
    <Slide index={N} className={styles.myNewSlide}>
      {/* 1. Decorative elements — always first */}
      <div className="accent-bar" />
      <div className={`orb ${styles.orb1}`} />
      <div className={`orb ${styles.orb2}`} />

      {/* 2. Content area — vertically centered */}
      <div className={`${styles.body} content-frame content-gutter`}>
        {/* Slide content */}
      </div>

      {/* 3. Footer — always last child */}
      <BottomBar text="Project Footer Text" />
    </Slide>
  )
}
```

### Mandatory elements (in order inside `<Slide>`):

1. **`<div className="accent-bar" />`** — Left gradient accent bar. Include on every slide.
2. **Orbs** — 2–4 `<div className={\`orb ${styles.orbN}\`} />` for ambient background glow.
3. **Content wrapper** — `<div className="content-frame content-gutter">` constrains width to `1280px` and adds `72px` horizontal padding. **All visible content goes inside this wrapper.**
4. **`<BottomBar text="..." />`** — Sticky footer, always the last child. The `text` must match the project's convention (check existing slides in the same project).

### Import paths (from `deck/src/projects/<project-id>/`):

| Resource | Import Path |
|---|---|
| `Slide` | `../../components/Slide` |
| `BottomBar` | `../../components/BottomBar` |
| `useSlides` | `../../context/SlideContext` |
| Shared slides | `../../slides/<SlideName>` |
| Data / logos | `../../data/<file>` |

---

## B. CSS Module Rules

Create a companion `.module.css` file matching the JSX filename (e.g., `MyNewSlide.module.css`).

### Required root class properties

```css
.myNewSlide {
  background: var(--bg-deep);
  flex-direction: column;
  padding: 0 0 44px 0;
}
```

- `background: var(--bg-deep)` — dark background on every slide
- `flex-direction: column` — global `.slide` sets `display: flex`; this orients content vertically
- `padding: 0 0 44px 0` — reserves space for the 44px BottomBar

Optional: add `justify-content: center` to vertically center content (cover slides, thank-you slides).

### Orb positioning (standard recipe)

```css
.orb1 {
  width: 420px; height: 420px;
  top: -100px; right: -60px;
  background: radial-gradient(circle at 40% 40%, var(--accent), var(--blue-glow) 50%, transparent 70%);
}
.orb2 {
  width: 320px; height: 320px;
  bottom: -40px; right: 100px;
  background: radial-gradient(circle at 50% 50%, var(--purple-deep), rgba(110,64,201,0.25) 60%, transparent 75%);
}
```

- 2–4 orbs, placed at edges/corners with negative offsets so they overflow
- Always use `radial-gradient` fading to `transparent`
- Palette: `var(--accent)`, `var(--blue-glow)`, `var(--purple-deep)`, `var(--cyan)`, `var(--pink)`

### Vertical centering body wrapper

```css
.body {
  position: relative;
  z-index: 10;
  display: flex;
  flex-direction: column;
  justify-content: center;
  flex: 1;
  min-height: 0;
}
```

This pattern is used on most content slides to vertically center the content area between the top and the BottomBar. **Always include it.**

### Available CSS custom properties

```
--bg-deep: #080b10       --surface: #161b22      --border: #30363d
--text: #e6edf3          --text-muted: #8b949e   --accent: #58a6ff
--blue-glow: #1f6feb     --purple: #bc8cff       --purple-deep: #6e40c9
--pink: #f778ba          --cyan: #56d4dd         --green: #3fb950
--orange: #d29922
```

### Available global CSS classes (no import needed)

| Class | Purpose |
|---|---|
| `accent-bar` | Left gradient accent bar |
| `orb` | Base decorative orb (absolute, rounded, blur, opacity) |
| `grid-dots` | Dot grid pattern (200×200px) |
| `content-frame` | Width constraint to `1280px`, centered |
| `content-gutter` | `72px` left/right padding |
| `deck` | Container for all slides in a project |

---

## C. Typography Conventions

| Element | Size | Weight | Spacing | Usage |
|---|---|---|---|---|
| `h1` | `clamp(42px, 5vw, 72px)` | 900 | `-2px` | Cover slides only |
| `h2` | `clamp(28px, 3.2vw, 36px)` | 700 | `-0.8px` | Main slide heading |
| `h3` | `16px–20px` | 700 | `-0.3px` | Card titles |
| Subtitle | `17px` | 300–400 | — | `color: var(--text-muted)`, below heading, `max-width: 720px` |
| Body text | `13px–14px` | 400 | — | `color: var(--text-muted)` |
| Badge/label | `10px–11px` | 600–700 | `1.5px` | Uppercase, rounded bg, accent color |

### Gradient text effect

```css
.highlight {
  background: linear-gradient(135deg, var(--accent), var(--cyan));
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}
```

---

## D. Content Layout Patterns

### Card grid

```css
.cards { display: grid; grid-template-columns: repeat(3, 1fr); gap: 24px; }
```

Variants: `repeat(2, 1fr)`, `repeat(4, 1fr)`, `repeat(6, 1fr)`.

### Two-panel split

```css
.body { display: grid; grid-template-columns: 1fr 1.2fr; gap: 20px; }
```

### Standard card

```css
.card {
  position: relative;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 16px;
  padding: 24px;
  overflow: hidden;
  transition: transform 0.3s ease, border-color 0.3s ease, box-shadow 0.3s ease;
}
.card::before {
  content: '';
  position: absolute;
  top: 0; left: 0; right: 0; height: 3px;
  background: linear-gradient(90deg, var(--purple), var(--accent));
  opacity: 0.6;
}
.card:hover {
  transform: translateY(-3px);
  border-color: rgba(88,166,255,0.4);
  box-shadow: 0 12px 48px rgba(0,0,0,0.3);
}
```

### Colored card variants

```css
.cardPurple { background: rgba(188,140,255,0.04); border-color: rgba(188,140,255,0.15); }
.cardGreen  { background: rgba(63,185,80,0.04);   border-color: rgba(63,185,80,0.15);   }
.cardCyan   { background: rgba(86,212,221,0.04);   border-color: rgba(86,212,221,0.15);  }
```

### Custom bullet list

```css
.bulletList { list-style: none; padding: 0; }
.bulletList li {
  position: relative; padding: 6px 0 6px 18px;
  font-size: 14px; color: var(--text-muted); line-height: 1.55;
}
.bulletList li::before {
  content: ''; position: absolute; left: 0; top: 14px;
  width: 6px; height: 6px; border-radius: 50%; background: var(--accent);
}
.bulletList li strong { color: var(--text); font-weight: 600; }
```

---

## E. Data Patterns

| Pattern | When to use | Example |
|---|---|---|
| Inline `const` array | Data unique to this slide | `const items = [{ title: '...', desc: '...' }]` |
| Imported data | Shared across slides | `import { customers } from '../../data/opportunity'` |
| Props | Reusable slides | `export default function MySlide({ index, title })` |
| Context | Needs navigation or selection state | `const { selectedCustomer, goTo } = useSlides()` |
| Image imports | Any images/logos | `import logo from '../../data/logos/company.png'` — never use string paths |

---

## F. Index Management (critical)

### How indexes work

- Every `<Slide index={N}>` has a 0-based `index` prop.
- `SlideProvider` has a `totalSlides` prop that **must** equal the number of slides.
- Indexes must form a **contiguous sequence** from `0` to `TOTAL - 1`.

### When adding a slide at position K, you must:

1. **Set the new slide's index to K.**

2. **Increment every subsequent slide's index by 1.** For each slide with `index >= K`:
   - If the index is hardcoded in the slide file → edit the `.jsx` file
   - If the index is passed as a prop in the App file → edit the prop value in the App file

3. **Increment `TOTAL` by 1** in the project's App component.

4. **Import and place** the new slide in the correct render order in the App component.

### Example: inserting at position 3 in a 9-slide project

Before:
```
TOTAL = 9
0=Cover, 1=Objective, 2=Sessions, 3=Timeline, 4=Coaching, 5=TestFlight, 6=Appendix, 7=Certs, 8=ThankYou
```

After:
```
TOTAL = 10
0=Cover, 1=Objective, 2=Sessions, 3=NEW, 4=Timeline(+1), 5=Coaching(+1), 6=TestFlight(+1), 7=Appendix(+1), 8=Certs(+1), 9=ThankYou(+1)
```

**Appending before the last slide** (usually ThankYou) is simplest — only `TOTAL` and the ThankYou index need updating.

---

## G. Anti-Patterns to Avoid

1. **Wrong `TOTAL`** — must exactly match number of `<Slide>` children. Navigation breaks otherwise.
2. **Non-contiguous or duplicate indexes** — causes invisible or overlapping slides.
3. **Missing `accent-bar`** — include on every slide.
4. **Missing `content-frame content-gutter`** — content will be full-width without standard margins.
5. **Missing `BottomBar`** — every slide needs it as the last child.
6. **Wrong import paths** — project slides are 2 levels deep: use `../../components/`, not `../components/`.
7. **Inconsistent `BottomBar text`** — check existing slides in the project and match their footer text.
8. **String paths for images** — always use `import logo from '...'` (Vite resolves to URL).
9. **Missing `padding: 0 0 44px 0`** on the slide root CSS class — content will overlap the BottomBar.
10. **Interactive elements without `e.stopPropagation()`** — clicking anywhere navigates; buttons/links need it.

---

## H. Complete Step-by-Step

### 1. Determine project and placement

- Check if the user specified a project. If not, read `.github/memory/state.md` for the active `project:` value. Only ask the user if neither is set.
- Open the project's App file to see current slide order and `TOTAL`.
- Decide insertion position. Default: insert before the last slide (usually ThankYou).

### 2. Create the slide `.jsx` file

- File: `deck/src/projects/<project-id>/<SlideName>Slide.jsx`
- Follow the mandatory skeleton from section A.
- Set `index={K}` where K is the insertion position.

### 3. Create the `.module.css` file

- File: `deck/src/projects/<project-id>/<SlideName>Slide.module.css`
- Include required root properties from section B.
- Add orbs, body wrapper, typography, and layout styles.

### 4. Update subsequent slide indexes

- Every slide with `index >= K` must have its index incremented by 1.
- Check both hardcoded indexes in slide files and prop values in the App file.

### 5. Register in the project App file

- Add `import <SlideName>Slide from './<SlideName>Slide'`
- Increment `const TOTAL = N + 1`
- Place `<SlideName>Slide />` in the correct render position inside `<div className="deck">`
- Update index props on any shared slides that shifted

### 6. Ensure the dev server is running

Check `.github/memory/state.md` for the dev server configuration. The server should be running at **http://localhost:5175/**.

- If the server is **not running**, start it: `cd deck && npx vite --port 5175`
- If the server **is running**, it will hot-reload the new slide automatically (no restart needed — unlike adding a new project, adding a slide to an existing project works with HMR).
- **Verify** the server is accessible by confirming it responds on `http://localhost:5175/`.

### 7. Verify

- Open **http://localhost:5175/** and navigate to the project (`#/<project-id>`).
- Confirm:
  - New slide appears at the correct position
  - All slides navigable (arrows, keyboard)
  - Progress bar reflects correct total
  - No missing or duplicated slides

### Quick checklist

- [ ] Resolved target project (from prompt, state.md, or asked user)
- [ ] Created `<SlideName>Slide.jsx` with Slide, accent-bar, orbs, content-frame, BottomBar
- [ ] Created `<SlideName>Slide.module.css` with `background: var(--bg-deep)`, `flex-direction: column`, `padding: 0 0 44px 0`, body centering wrapper
- [ ] `index` value is correct for all slides (new + shifted)
- [ ] `TOTAL` incremented in project App
- [ ] New slide imported and placed in correct render order
- [ ] `BottomBar text` matches project convention
- [ ] Dev server running at http://localhost:5175/

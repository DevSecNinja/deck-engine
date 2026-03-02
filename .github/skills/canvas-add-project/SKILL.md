---
name: canvas-add-project
description: Guide for adding a new slide-deck project to the canvas presentation app. Use this when asked to create, add, or scaffold a new project or slide deck.
---

To add a new project (slide deck) to the canvas app, follow this process step by step.

## 1. Create the project directory

Create a new folder under `deck/src/projects/<project-id>/` using **kebab-case** for the folder name (e.g., `customer-onboarding`, `quarterly-review`).

## 2. Create the project App component

Create `<ProjectName>App.jsx` in the new directory. Use **PascalCase + `App` suffix** (e.g., `CustomerOnboardingApp.jsx`).

The App component must follow this exact structure:

```jsx
import { SlideProvider } from '../../context/SlideContext'
import Navigation from '../../components/Navigation'
import CoverSlide from './CoverSlide'
// import additional project-local slides...
import GenericThankYouSlide from '../../slides/GenericThankYouSlide'

const TOTAL = 3 // must equal the exact number of <Slide> children

export default function MyProjectApp() {
  return (
    <SlideProvider totalSlides={TOTAL} project="my-project-id">
      <Navigation />
      <div className="deck">
        <CoverSlide />
        {/* additional slides in order, index 0..TOTAL-1 */}
        <GenericThankYouSlide index={TOTAL - 1} tagline="Thank you" footerText="Footer" />
      </div>
    </SlideProvider>
  )
}
```

Key rules:
- The `TOTAL` constant **must** equal the exact number of `<Slide>` children rendered inside `<div className="deck">`.
- The `project` prop on `<SlideProvider>` **must** match the route id used in `App.jsx`.
- Always wrap slides in `<SlideProvider>`, then `<Navigation />`, then `<div className="deck">`.
- Use `deck/src/projects/dev-plan/DevPlanApp.jsx` as the canonical reference implementation.

## 3. Create slide components

Each slide needs a `.jsx` file and a `.module.css` file, using **PascalCase + `Slide` suffix** (e.g., `CoverSlide.jsx`, `CoverSlide.module.css`).

Every slide component must follow this pattern:

```jsx
import Slide from '../../components/Slide'
import BottomBar from '../../components/BottomBar'
import styles from './MySlide.module.css'

export default function MySlide() {
  return (
    <Slide index={0} className={styles.mySlide}>
      <div className="accent-bar" />
      <div className={`orb ${styles.orb1}`} />

      <div className="content-frame content-gutter">
        {/* Slide content goes here */}
      </div>

      <BottomBar text="Footer Text" />
    </Slide>
  )
}
```

Key rules:
- Every slide wraps its content in `<Slide index={N}>` — the `index` prop controls visibility via `SlideContext`.
- Hardcode the `index` in project-local slides. For shared/reusable slides, accept `index` as a prop.
- Include `<div className="accent-bar" />` for the left gradient accent bar.
- Use `<BottomBar text="..." />` at the bottom of each slide.
- Use `content-frame content-gutter` CSS classes for consistent width and padding.
- Decorative orbs use the global `orb` class combined with module-scoped positioning classes.

### CSS module conventions

```css
.mySlide {
  background: var(--bg-deep);
  display: flex;
  flex-direction: column;
}

.orb1 {
  top: 10%;
  left: -5%;
  width: 400px;
  height: 400px;
  background: radial-gradient(circle, var(--accent) 0%, transparent 70%);
}
```

Available CSS custom properties from `global.css`: `--accent`, `--purple`, `--cyan`, `--green`, `--text`, `--text-muted`, `--surface`, `--border`, `--bg-deep`.

Card-based layouts typically use `border: 1px solid var(--border)`, `border-radius: 14px`, and `backdrop-filter: blur()`.

## 4. Register the project in App.jsx

Edit `deck/src/App.jsx` to add three things:

1. **Import** the new project App component at the top of the file.
2. **Add a route** in the `getRoute()` function: `if (hash === '<project-id>') return '<project-id>'`
3. **Add a render condition**: `if (route === '<project-id>') return <NewProjectApp />`

## 5. Register the project in ProjectPicker.jsx

Edit `deck/src/ProjectPicker.jsx` and add an entry to the `projects` array:

```js
{
  id: '<project-id>',           // must match the hash route and SlideProvider project prop
  title: 'Project Title',
  subtitle: 'Short subtitle',
  description: 'One-line description of this deck.',
  icon: '🎯',                   // emoji icon for the card
  accent: 'var(--accent)',       // CSS custom property for card accent color
}
```

The `id` must match exactly: the folder name, the hash route in `App.jsx`, and the `project` prop on `<SlideProvider>`.

## 6. Shared resources available for reuse

| Resource | Import Path (from project dir) | Purpose |
|---|---|---|
| `Slide` | `../../components/Slide` | Visibility/animation wrapper — required for every slide |
| `BottomBar` | `../../components/BottomBar` | Footer bar with text |
| `Navigation` | `../../components/Navigation` | Progress bar, nav arrows, PDF export link |
| `SlideProvider` | `../../context/SlideContext` | Slide state provider — required in every project App |
| `GenericThankYouSlide` | `../../slides/GenericThankYouSlide` | Reusable thank-you slide (props: `index`, `tagline`, `footerText`) |
| Any shared slide | `../../slides/*` | Shared slides can be reused with custom `index` props |
| Data files | `../../data/*` | Shared data (speakers, logos, opportunity info) |

## 7. Set as active project

After creating the project, set it as the active project in `.github/memory/state.md`. Update the `project:` field under `## Active Project` to the new project's id:

```md
# Canvas State

## Active Project

project: <project-id>
```

This ensures subsequent skills (like `canvas-add-slide`) automatically target the new project.

## 8. Restart the dev server (mandatory)

The Vite dev server **must be restarted** after adding a new project. The new route in `App.jsx` and new imports will not be picked up by hot-reload alone.

Check `.github/memory/state.md` for the dev server configuration (port and start command).

1. **Kill** any running Vite dev server.
2. **Restart** it:
   ```bash
   cd deck && npx vite --port 5175
   ```
3. The dev server runs at **http://localhost:5175/**.

> **Do not skip this step.** Without a restart, navigating to `#/<project-id>` will show a blank page or the project picker.

## 9. Verify the project works

1. Open **http://localhost:5175/** in a browser — confirm the new project card appears on the project picker.
2. Click the card — confirm the slide deck loads and navigation works.
3. Verify keyboard navigation (← → Space) and that the slide count is correct.

## Summary checklist

- [ ] Created `deck/src/projects/<project-id>/` directory
- [ ] Created `<ProjectName>App.jsx` with `SlideProvider`, `Navigation`, and slides
- [ ] Created at least a `CoverSlide.jsx` + `CoverSlide.module.css`
- [ ] `TOTAL` constant matches the exact number of slides
- [ ] Added import + route + render in `deck/src/App.jsx`
- [ ] Added entry to `projects` array in `deck/src/ProjectPicker.jsx`
- [ ] Project `id` is consistent across folder name, route, `SlideProvider` prop, and `ProjectPicker` entry
- [ ] Set as active project in `.github/memory/state.md`
- [ ] Dev server restarted (mandatory — new routes require restart)

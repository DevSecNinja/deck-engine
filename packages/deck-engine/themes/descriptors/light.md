# Theme Descriptor — Light

## Metadata

- **Theme id:** `light`
- **Primary slide authoring pattern:** `default`
- **Compatible design systems:** `default`
- **Mood:** crisp, professional, airy, projection-friendly
- **Read this file when:** `deck.config.js` uses `theme: 'light'` and you need to create, inspect, validate, or generate assets for slides

## Slide personality

Light slides still use the DECKIO default structure, but the feel should be cleaner and brighter than dark: lighter surfaces, softer glow usage, and more breathing room. Keep decoration present but restrained.

## Exact JSX skeleton

Use this exact starting structure for new slides:

```jsx
import { BottomBar, Slide } from '@deckio/deck-engine'
import styles from './MyNewSlide.module.css'

export default function MyNewSlide({ index, project }) {
  return (
    <Slide index={index} className={styles.myNewSlide}>
      <div className="accent-bar" />
      <div className={`orb ${styles.orb1}`} />
      <div className={`orb ${styles.orb2}`} />

      <div className={`${styles.body} content-frame content-gutter`}>
        {/* Slide content */}
      </div>

      <BottomBar text="Project Footer Text" />
    </Slide>
  )
}
```

### Required child order inside `<Slide>`

1. `<div className="accent-bar" />`
2. `2–4` decorative orb elements using the global `orb` class plus local positioning classes
3. One content wrapper using `content-frame content-gutter`
4. `<BottomBar text="..." />` as the last child

## Exact CSS skeleton

```css
.myNewSlide {
  background: var(--background);
  padding: 0 0 44px 0;
}

.orb1 {
  width: 420px;
  height: 420px;
  top: -100px;
  right: -60px;
  background: radial-gradient(
    circle at 40% 40%,
    color-mix(in srgb, var(--accent) 82%, white),
    color-mix(in srgb, var(--cyan) 20%, transparent) 52%,
    transparent 72%
  );
}

.orb2 {
  width: 320px;
  height: 320px;
  bottom: -40px;
  right: 100px;
  background: radial-gradient(
    circle at 50% 50%,
    color-mix(in srgb, var(--purple) 72%, white),
    color-mix(in srgb, var(--purple-deep) 18%, transparent) 60%,
    transparent 76%
  );
}

.body {
  position: relative;
  z-index: 10;
  display: flex;
  flex-direction: column;
  gap: 24px;
}

.cards {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 24px;
}

.card {
  position: relative;
  overflow: hidden;
  background: var(--card);
  border: 1px solid var(--border);
  border-radius: 16px;
  padding: 24px;
  box-shadow: var(--shadow-elevated);
}

.card::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 3px;
  background: linear-gradient(90deg, var(--accent), var(--cyan));
  opacity: 0.45;
}
```

## Token table

### Use these tokens

- `var(--background)`
- `var(--foreground)`
- `var(--muted-foreground)`
- `var(--card)`
- `var(--secondary)`
- `var(--border)`
- `var(--accent)`
- `var(--blue-glow)`
- `var(--purple)`
- `var(--purple-deep)`
- `var(--pink)`
- `var(--cyan)`
- `var(--green)`
- `var(--surface-overlay)`
- `var(--shadow-elevated)`

### Never regress to

- Heavy dark-theme glow stacks that overpower a light background
- `var(--bg-deep)` in new slide code
- `var(--surface)` in new slide code
- `var(--text)` or `var(--text-muted)` in new slide code

## Decorative elements available

| Element | How to use it |
|---|---|
| `accent-bar` | Required first child for default DECKIO slides |
| `orb` | Required, but keep the glow softer than dark |
| `grid-dots` | Optional light patterning inside a content area |
| Card top gradient | Acceptable, but use lower opacity than dark |

## Available components

| Resource | Import path |
|---|---|
| `Slide`, `BottomBar`, `Navigation`, `SlideProvider`, `useSlides`, `GenericThankYouSlide` | `'@deckio/deck-engine'` |
| Data / logos | `'../data/<file>'` |

## Anti-patterns

1. Removing the default DECKIO frame entirely
2. Making the orbs as loud as the dark theme
3. Missing `content-frame content-gutter`
4. Missing `BottomBar`
5. Using `flex: 1` on the body wrapper
6. Overloading the slide until it overflows the viewport
7. Importing shadcn-only UI components into a default DECKIO slide

## Example slide direction

A strong light slide should feel polished and executive-ready: crisp white or off-white surfaces, subtle blue/cyan motion in the decoration, and clear contrast between heading, body copy, and cards.

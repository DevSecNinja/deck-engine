# Theme Descriptor — Dark

## Metadata

- **Theme id:** `dark`
- **Primary slide authoring pattern:** `default`
- **Compatible design systems:** `default`
- **Mood:** deep-space, cinematic, high-contrast, presentation-first
- **Read this file when:** `deck.config.js` uses `theme: 'dark'` or no explicit theme and you need to create, inspect, validate, or generate assets for slides

## Slide personality

Dark slides should feel unmistakably DECKIO: a deep background, a left accent bar, ambient orb decoration, and high-contrast content surfaces that glow subtly without looking noisy.

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
    var(--accent),
    color-mix(in srgb, var(--green) 30%, transparent) 50%,
    transparent 70%
  );
}

.orb2 {
  width: 320px;
  height: 320px;
  bottom: -40px;
  right: 100px;
  background: radial-gradient(
    circle at 50% 50%,
    var(--purple-deep),
    color-mix(in srgb, var(--purple-deep) 30%, transparent) 60%,
    transparent 75%
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
  background: var(--secondary);
  border: 1px solid var(--border);
  border-radius: 16px;
  padding: 24px;
}

.card::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 3px;
  background: linear-gradient(90deg, var(--purple), var(--accent));
  opacity: 0.6;
}
```

## Token table

### Use these tokens

- `var(--background)`
- `var(--foreground)`
- `var(--muted-foreground)`
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

### Never regress to

- `var(--bg-deep)` in new slide code
- `var(--surface)` in new slide code
- `var(--text)` or `var(--text-muted)` in new slide code

## Decorative elements available

| Element | How to use it |
|---|---|
| `accent-bar` | Required first child for default DECKIO slides |
| `orb` | Required ambient decoration; add 2–4 per slide |
| `grid-dots` | Optional subtle pattern layer inside the content area |
| Card top gradient | Acceptable via `.card::before` in the default system |

## Available components

| Resource | Import path |
|---|---|
| `Slide`, `BottomBar`, `Navigation`, `SlideProvider`, `useSlides`, `GenericThankYouSlide` | `'@deckio/deck-engine'` |
| Data / logos | `'../data/<file>'` |

## Anti-patterns

1. Missing `accent-bar`
2. Missing orb decoration
3. Missing `content-frame content-gutter`
4. Missing `BottomBar`
5. Using `flex: 1` on the body wrapper
6. Adding `flex-direction: column` on the slide root
7. Overloading the slide until it overflows the viewport
8. Importing shadcn-only UI components into a default DECKIO slide

## Example slide direction

A strong dark slide should combine a bold heading, restrained supporting copy, and 3-card content blocks over a deep background. The cards can use the default gradient top rule; the overall frame should still feel calm and readable from a distance.

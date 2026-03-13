# deck-add-slide skill test output

Captured from `packages/deck-engine/skills/deck-add-slide/SKILL.md` before the descriptor refactor. These are the exact JSX and CSS skeletons the skill instructed an AI assistant to generate.

## Test A — Default / dark theme slide

### Exact JSX

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

### Exact CSS

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

### Assessment

- **Does it look like a proper dark theme slide?** Yes.
- Why: it uses the DECKIO default frame (`accent-bar` + orbs), dark-friendly semantic tokens (`--background`, `--secondary`, `--border`), and the gradient card top rule that matches the dark DECKIO visual language.

## Test B — shadcn theme slide

### Exact JSX

```jsx
import { BottomBar, Slide } from '@deckio/deck-engine'
import styles from './MyNewSlide.module.css'

export default function MyNewSlide({ index, project }) {
  return (
    <Slide index={index} className={styles.myNewSlide}>
      <div className={`${styles.body} content-frame content-gutter`}>
        <div className={styles.overline}>
          <span className={styles.overlineDash} />
          <span className={styles.overlineText}>SECTION LABEL</span>
        </div>

        <h2 className={styles.title}>Slide Title</h2>
        <p className={styles.subtitle}>Supporting copy for the slide.</p>

        <div className={styles.cards}>
          <article className={styles.card}>
            <h3>Card title</h3>
            <p>Card body text.</p>
          </article>
        </div>
      </div>

      <BottomBar text="Project Footer Text" />
    </Slide>
  )
}
```

### Exact CSS

```css
.myNewSlide {
  background: color-mix(in oklch, var(--background) 85%, transparent);
  padding: 0 0 44px 0;
}

.body {
  position: relative;
  z-index: 10;
  display: flex;
  flex-direction: column;
  gap: 24px;
}

.overline {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 4px;
}

.overlineDash {
  width: 32px;
  height: 2px;
  border-radius: 999px;
  background: var(--primary);
}

.overlineText {
  font-size: 13px;
  font-weight: 500;
  letter-spacing: 3px;
  text-transform: uppercase;
  color: var(--muted-foreground);
}

.title {
  font-size: clamp(28px, 3.2vw, 36px);
  font-weight: 700;
  color: var(--foreground);
}

.subtitle {
  font-size: clamp(16px, 1.6vw, 19px);
  font-weight: 400;
  color: var(--muted-foreground);
}

.cards {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 20px;
}

.card {
  background: var(--card);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  padding: 24px;
  box-shadow: 0 1px 3px color-mix(in srgb, var(--foreground) 4%, transparent);
}
```

### Assessment

- **Does it look distinctly different from dark?** Yes. It removes the DECKIO accent bar, orbs, and card-top gradient, and instead uses a clean editorial overline + semantic card treatment.
- **Does it use semantic tokens?** Yes: `--background`, `--foreground`, `--card`, `--border`, `--radius`, `--primary`, `--muted-foreground`.
- **No orbs?** Correct. The JSX and CSS contain no `orb` usage.
- **Does it mention available ReactBits components?** Yes. The skill explicitly listed `BlurText`, `ShinyText`, `DecryptedText`, and `SpotlightCard` as available imports, although this exact skeleton does not use them.

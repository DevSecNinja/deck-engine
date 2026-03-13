# Theme Descriptor — shadcn

## Metadata

- **Theme id:** `shadcn`
- **Primary slide authoring pattern:** `shadcn`
- **Compatible design systems:** `shadcn`
- **Mood:** editorial, product-grade, semantic-token-driven, clean
- **Read this file when:** `deck.config.js` uses `theme: 'shadcn'` or `designSystem: 'shadcn'` and you need to create, inspect, validate, or generate assets for slides

## Slide personality

shadcn slides should look intentionally different from the default DECKIO system: cleaner surfaces, no deep-space ornament, no left accent bar, no floating orbs, and strong reliance on semantic tokens.

## Exact JSX skeleton

Use this exact starting structure for new slides:

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

## Exact CSS skeleton

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

Use `background: var(--background)` instead of the semi-transparent mix only when the slide intentionally needs a solid backdrop, such as a cover or thank-you slide.

## Token table

### Use these semantic tokens

- `var(--background)`
- `var(--foreground)`
- `var(--card)`
- `var(--card-foreground)`
- `var(--primary)`
- `var(--primary-foreground)`
- `var(--secondary)`
- `var(--secondary-foreground)`
- `var(--muted)`
- `var(--muted-foreground)`
- `var(--border)`
- `var(--ring)`
- `var(--radius)`
- `var(--destructive)`
- `var(--surface-overlay)`
- `var(--shadow-elevated)`

### Decorative accents allowed only inside content

- `var(--blue-glow)`
- `var(--purple)`
- `var(--purple-deep)`
- `var(--pink)`
- `var(--cyan)`
- `var(--green)`

## Decorative elements available

| Element | Rule |
|---|---|
| `content-frame` | Required layout wrapper |
| `content-gutter` | Required layout wrapper |
| Overline row | Preferred shadcn framing element |
| Clean cards | Preferred surface treatment |
| Decorative gradients | Allowed only inside content blocks, never as full-slide space effects |

## Available components

### Core imports

| Resource | Import path |
|---|---|
| `Slide`, `BottomBar`, `Navigation`, `SlideProvider`, `useSlides`, `GenericThankYouSlide` | `'@deckio/deck-engine'` |
| Data / logos | `'../data/<file>'` |
| ReactBits / shadcn components | `'@/components/ui/<component>'` |

### Pre-installed ReactBits components

- `import BlurText from '@/components/ui/blur-text'`
- `import ShinyText from '@/components/ui/shiny-text'`
- `import DecryptedText from '@/components/ui/decrypted-text'`
- `import SpotlightCard from '@/components/ui/spotlight-card'`

### Common shadcn/ui additions

- `npx shadcn add button` → `import { Button } from '@/components/ui/button'`
- `npx shadcn add badge` → `import { Badge } from '@/components/ui/badge'`
- `npx shadcn add card` → `import { Card, CardHeader, CardContent } from '@/components/ui/card'`
- `npx shadcn add separator` → `import { Separator } from '@/components/ui/separator'`

## Anti-patterns

1. Never use `accent-bar`
2. Never use `orb`
3. Never use `grid-dots`
4. Never use `var(--bg-deep)`
5. Never use `var(--surface)`
6. Never use `var(--text)`
7. Never use `var(--text-muted)`
8. Never add gradient `::before` bars to cards
9. Never hardcode deep-space glow decoration as full-slide ornament

## Example slide direction

A strong shadcn slide should read like a polished product or strategy artifact: overline, clear heading hierarchy, calm card surfaces, semantic token usage, and optional component accents such as `Badge`, `Separator`, `BlurText`, or `SpotlightCard` when they truly help the story.

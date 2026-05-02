# Theme Descriptor - Fabric

## Metadata

- **Theme id:** `fabric`
- **Primary slide authoring pattern:** `default`
- **Compatible design systems:** `default`
- **Mood:** friendly, integrated, empowering, enterprise-grade, professional
- **Read this file when:** `deck.config.js` uses `theme: 'fabric'` and you need to create, inspect, validate, or generate assets for slides

## Slide personality

Fabric slides embody Microsoft Fabric's design philosophy: friendly yet professional, dimensional without being flashy, clean data presentation with subtle depth. Light warm background (#FFF8F3) creates an inviting canvas. Primary teal (#225B62, #49C5B1) and soft mint (#B9DCD2) establish the core palette. Secondary accents (#0078D4 blue, #8661C5 purple, #FFB900 yellow, #F4364C red, #8DE971 green) used sparingly for emphasis.

Typography is **Segoe UI** with clean letter-spacing and balanced weights. Layouts emphasize dimensional data blocks with subtle shadows and clean borders. No neon, no glassmorphism, no excessive ornament - just purposeful, accessible, enterprise-ready slides.

## Exact JSX skeleton

Use this exact starting structure for new slides:

```jsx
import { BottomBar, Slide } from '@deckio/deck-engine'
import styles from './MyNewSlide.module.css'

export default function MyNewSlide({ index, project }) {
  return (
    <Slide index={index} className={styles.myNewSlide}>
      <div className="accent-bar" />

      <div className={`${styles.body} content-frame content-gutter`}>
        {/* Slide content */}
      </div>

      <BottomBar text="Project Footer Text" />
    </Slide>
  )
}
```

### Required child order inside `<Slide>`

1. `<div className="accent-bar" />` - renders as primary teal
2. One content wrapper using `content-frame content-gutter`
3. `<BottomBar text="..." />` as the last child

## Exact CSS skeleton

```css
.myNewSlide {
  background: var(--background);
  padding: 0 0 44px 0;
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
  gap: 20px;
}

.card {
  position: relative;
  overflow: hidden;
  background: var(--card);
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  padding: 24px;
  box-shadow: var(--shadow-elevated);
  transition: transform var(--transition-fast), box-shadow var(--transition-fast);
}

.card:hover {
  transform: translateY(-2px);
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.12);
}

.card::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 3px;
  background: var(--accent);
}
```

### Key CSS rules for Fabric

- **Dimensional elevation.** Use `var(--shadow-elevated)` for cards. Add subtle `:hover` transforms (`translateY(-2px)`).
- **Clean borders.** Use `1px solid var(--border)` for definition. Never use heavy or colored borders except for accents.
- **Moderate radius.** Use `var(--radius-lg)` (8px) for cards, `var(--radius-md)` (4px) for smaller elements. Avoid sharp edges or over-rounded.
- **Accent stripes.** Card top-stripe should be `3px` high with `var(--accent)` or `var(--primary)`.
- **Smooth transitions.** Use `var(--transition-fast)` (0.15s) or `var(--transition-base)` (0.25s). Nothing instant, nothing slow.
- **Segoe UI typography.** Use `var(--font-family)` for all text. Keep letter-spacing minimal or zero.

## Token table

### Use these tokens

| Token | Value | When to use |
|---|---|---|
| `var(--background)` | `#FFF8F3` | Slide backgrounds, main canvas |
| `var(--foreground)` | `#000000` | Primary text, headings, body copy |
| `var(--card)` | `#FFFFFF` | Card / panel backgrounds |
| `var(--card-foreground)` | `#000000` | Text inside cards |
| `var(--primary)` | `#225B62` | Primary teal - hero elements, key actions, headings |
| `var(--primary-foreground)` | `#FFFFFF` | Text on primary-colored surfaces |
| `var(--secondary)` | `#B9DCD2` | Soft mint - secondary surfaces, subtle backgrounds |
| `var(--secondary-foreground)` | `#000000` | Text on secondary surfaces |
| `var(--accent)` | `#49C5B1` | Teal accent - highlights, links, emphasis |
| `var(--accent-foreground)` | `#000000` | Text on accent surfaces |
| `var(--muted)` | `#F5F5F5` | Muted backgrounds, input fields, subtle zones |
| `var(--muted-foreground)` | `#6B6B6B` | Subdued text, captions, metadata |
| `var(--border)` | `#E0E0E0` | Clean borders for cards, dividers |
| `var(--ring)` | `rgba(34, 91, 98, 0.4)` | Focus rings, interactive outlines |
| `var(--radius)` | `4px` | Base radius for small elements |
| `var(--destructive)` | `#F4364C` | Error / danger states |
| `var(--blue-accent)` | `#0078D4` | Microsoft blue - sparingly for emphasis |
| `var(--purple-accent)` | `#8661C5` | Purple accent - data visualization |
| `var(--yellow-accent)` | `#FFB900` | Yellow accent - warnings, highlights |
| `var(--red-accent)` | `#F4364C` | Red accent - alerts (alias of destructive) |
| `var(--green-accent)` | `#8DE971` | Green accent - success, positive metrics |
| `var(--surface-overlay)` | `rgba(255, 248, 243, 0.92)` | Translucent overlay panels |
| `var(--surface-overlay-heavy)` | `rgba(255, 248, 243, 0.97)` | Near-opaque overlay for modals |
| `var(--border-subtle)` | `rgba(224, 224, 224, 0.5)` | Lighter borders for secondary elements |
| `var(--glow-primary)` | `rgba(34, 91, 98, 0.08)` | Subtle teal glow for depth |
| `var(--glow-accent)` | `rgba(73, 197, 177, 0.1)` | Accent glow for emphasis |
| `var(--shadow-elevated)` | multi-stop clean shadow | Elevated card shadows |

### Never regress to

- Neon colors or glassmorphism effects
- Deep-space ornaments or floating orbs inside content
- Excessive decorative gradients
- Hardcoded `rgba(...)` or `#hex` values when a token exists

## Typography tokens

| Token | Value | Usage |
|---|---|---|
| `var(--font-family)` | `'Segoe UI', ...` | All text: headings, body, labels |
| `var(--font-family-mono)` | `'Cascadia Code', 'Consolas', ...` | Code, technical labels |
| `var(--font-size-display)` | `clamp(42px, 6vw, 72px)` | Hero / title text |
| `var(--font-size-2xl)` | `32px` | Section headings |
| `var(--font-size-xl)` | `24px` | Sub-headings |
| `var(--font-size-lg)` | `20px` | Large body / lead text |
| `var(--font-size-base)` | `16px` | Body copy |
| `var(--font-weight-bold)` | `700` | Headings |
| `var(--font-weight-semibold)` | `600` | Sub-headings, emphasis |
| `var(--font-weight-medium)` | `500` | Strong body text |
| `var(--letter-spacing-normal)` | `0` | Default spacing |
| `var(--letter-spacing-wide)` | `0.5px` | Subtle widening for labels |
| `var(--line-height-tight)` | `1.2` | Headings |
| `var(--line-height-normal)` | `1.5` | Body text |

## Decorative elements available

| Element | How to use it |
|---|---|
| `accent-bar` | Required first child - renders in primary teal |
| Card top-stripe | Apply via `.card::before` - 3px high accent or primary color |
| Clean box-shadow | Use `var(--shadow-elevated)` for dimensional lift |
| Hover transforms | Subtle `translateY(-2px)` on hover for interactivity |
| Dimensional blocks | Cards with borders, shadows, and slight hover effects |

## Available components

| Resource | Import path |
|---|---|
| `Slide`, `BottomBar`, `Navigation`, `SlideProvider`, `useSlides`, `GenericThankYouSlide` | `'@deckio/deck-engine'` |
| Data / logos | `'../data/<file>'` |
| Fabric icons helper | `'../data/fabric-icons.js'` (scaffolded in fabric theme projects) |

## Anti-patterns

1. **Neon colors** - never use hot pink, electric lime, cyan glows from other themes
2. **Missing `accent-bar`** - every slide must have it as the first child
3. **Missing `content-frame content-gutter`** - body wrapper must use these globals
4. **Missing `BottomBar`** - required as the last child
5. **Glassmorphism** - no frosted glass effects, heavy blurs, or translucent overlays as primary pattern
6. **Deep-space ornament** - no floating orbs or cosmic gradients inside slide content
7. **Excessive decorative gradients** - keep backgrounds clean; use solid colors or very subtle gradients
8. **Over-rounded corners** - avoid `border-radius` above `12px` except for pills/circles
9. **Heavy borders** - borders should be `1px solid` with subtle colors, never thick or bright
10. **Slow transitions** - everything should be responsive, use fast or base transition speeds

## Example slide direction

A strong Fabric slide presents dimensional data cards on a clean warm canvas. Each card has a subtle shadow, a 3px accent stripe at the top, and clean 1px borders. Hover states add slight lift via `translateY`. Typography is balanced Segoe UI with moderate weights. The slide feels professional, friendly, and empowering - ready for executive presentations or technical deep-dives without compromising clarity or accessibility.

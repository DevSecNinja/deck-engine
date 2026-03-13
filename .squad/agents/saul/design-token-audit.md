# Design Token Audit — DECKIO Engine

**Author:** Saul (UI/UX & Theme Coherence Specialist)
**Date:** 2025-07-18
**Scope:** `packages/deck-engine/` — all 4 CSS files
**Purpose:** Document current token state, identify gaps, and feed Phase 2 token codification

---

## 1. Current Custom Properties (`:root` in `global.css`)

### Color Tokens (14 defined)

| Token | Value | Category | Used By |
|---|---|---|---|
| `--bg` | `#0d1117` | Background | `html,body,#root` (via `--bg-deep`) |
| `--bg-deep` | `#080b10` | Background | body bg, `.deck-ty`, ThankYouSlide |
| `--surface` | `#161b22` | Surface | `.kbd` bg only |
| `--border` | `#30363d` | Border | BottomBar, Navigation (buttons, menus, kbd) |
| `--text` | `#e6edf3` | Text | body color, Navigation buttons |
| `--text-muted` | `#8b949e` | Text | BottomBar, key hints, subtitles, taglines |
| `--accent` | `#58a6ff` | Accent/Primary | Progress bar, hover states, gradients, streaks |
| `--blue-bright` | `#79c0ff` | Decorative | ⚠️ **UNUSED in any CSS rule** |
| `--blue-glow` | `#1f6feb` | Decorative | ⚠️ **UNUSED as a var()** — but its raw value `rgba(31,111,235,...)` is hardcoded 6 times |
| `--purple` | `#bc8cff` | Decorative | Gradients, streaks, accent bar |
| `--purple-deep` | `#6e40c9` | Decorative | ⚠️ **UNUSED in any CSS rule** |
| `--pink` | `#f778ba` | Decorative | Streak5 only |
| `--cyan` | `#56d4dd` | Decorative | Gradients, streaks |
| `--green` | `#3fb950` | Decorative | Streak4 only |
| `--orange` | `#d29922` | Decorative | ⚠️ **UNUSED in any CSS rule** |

### Layout Tokens (2 defined)

| Token | Value | Used By |
|---|---|---|
| `--content-max-width` | `1280px` | `.content-frame` |
| `--content-gutter` | `72px` | `.content-gutter` |

### Token Health Summary
- **16 tokens defined** total
- **3 color tokens unused:** `--blue-bright`, `--purple-deep`, `--orange`
- **1 token defined but bypassed:** `--blue-glow` is defined as `#1f6feb` but its raw rgba equivalent `rgba(31,111,235,...)` is hardcoded 6 times across Navigation.module.css
- **0 typography tokens** exist
- **0 spacing tokens** exist
- **0 border-radius tokens** exist
- **0 z-index tokens** exist
- **0 transition/animation tokens** exist

---

## 2. Typography Audit

### Font Family
- Single family: `'Inter', -apple-system, BlinkMacSystemFont, sans-serif`
- Set on `html,body,#root` — inherited everywhere
- Navigation overrides with `font-family: inherit` (redundant but harmless)
- Google Fonts import: weights 300–900

### Font Sizes (all hardcoded — no tokens)

| Value | Where Used | Suggested Token |
|---|---|---|
| `clamp(40px, 6vw, 64px)` | Thank-you title (global + dead module) | `--font-size-display` |
| `28px` | Plus sign between logos (dead ThankYouSlide.module.css) | — (dead code) |
| `20px` | Subtitle text (global + dead module) | `--font-size-xl` |
| `13px` | Overflow warning, tagline | `--font-size-sm` |
| `12px` | Export menu items | `--font-size-sm` (merge with 13px?) |
| `11px` | BottomBar, export label, key hints | `--font-size-xs` |
| `10px` | Kbd hint keys | `--font-size-2xs` |

**Observations:**
- No type scale exists. Sizes are scattered: 10, 11, 12, 13, 20, 28, 40–64
- The gap between 13px and 20px suggests missing intermediate sizes (16px, 18px)
- `clamp()` only used for display text — responsive typography is minimal

### Font Weights (all hardcoded)

| Value | Where Used | Suggested Token |
|---|---|---|
| `300` | Plus sign (dead code only) | `--font-weight-light` |
| `400` | Subtitle, body default | `--font-weight-regular` |
| `500` | Export menu items | `--font-weight-medium` |
| `600` | Overflow warning, export label, kbd | `--font-weight-semibold` |
| `800` | Thank-you title | `--font-weight-extrabold` |

### Letter Spacing (all hardcoded)

| Value | Where Used |
|---|---|
| `-2px` | Display title (tight) |
| `0.04em` | Export label |
| `0.3px` | Overflow warning |
| `0.5px` | Subtitle |
| `2.5px` | BottomBar |
| `3px` | Tagline (uppercase labels) |

**No line-height values are explicitly set anywhere** — everything inherits browser defaults.

---

## 3. Color Audit

### Hardcoded Colors (not using tokens)

| Raw Value | Semantic Meaning | Location | Should Be Token? |
|---|---|---|---|
| `#f85149` | Error/warning red | `global.css` overflow warn (border + text) | ✅ `--error` or `--danger` |
| `#080b10` | Fallback bg-deep | `exportDeckPdf.js`, `exportDeckPptx.js` | Already a token — use `var(--bg-deep)` in JS context (acceptable as fallback) |
| `rgba(31,111,235,...)` | Blue glow (0.2, 0.22, 0.18 opacity) | `Navigation.module.css` × 6 | ✅ Should use `--blue-glow` with opacity |
| `rgba(22,27,34,...)` | Surface transparent (0.8, 0.95) | `Navigation.module.css` × 4 | ✅ `--surface-overlay` or derive from `--surface` |
| `rgba(48,54,61,0.6)` | Border transparent | `Navigation.module.css` progress track | ✅ Derive from `--border` |
| `rgba(13,17,23,0.85)` | Deep bg transparent | `BottomBar.module.css` | ✅ Derive from `--bg` |
| `rgba(139,148,158,0.25)` | Grid dot color | `global.css` | ✅ Derive from `--text-muted` |
| `rgba(88,166,255,0.10)` | Accent glow | `global.css` + dead module | ✅ Derive from `--accent` |
| `rgba(188,140,255,0.10)` | Purple glow | `global.css` + dead module | ✅ Derive from `--purple` |
| `rgba(86,212,221,0.08)` | Cyan glow | `global.css` + dead module | ✅ Derive from `--cyan` |
| `rgba(255,255,255,0.05)` | White ghost bg | Dead ThankYouSlide.module.css | Dead code |
| `rgba(255,255,255,0.1)` | White ghost border | Dead ThankYouSlide.module.css | Dead code |
| `rgba(121,192,255,0.18)` | Blue-bright glow | `Navigation.module.css` exportBtnBusy | ✅ Derive from `--blue-bright` |

### Missing Semantic Colors
The current palette has no semantic intent layer. Recommended additions:

| Proposed Token | Purpose | Suggested Value |
|---|---|---|
| `--error` / `--danger` | Overflow warning, errors | `#f85149` |
| `--success` | Future: success states | `#3fb950` (reuse `--green`) |
| `--warning` | Future: caution states | `#d29922` (reuse `--orange`) |
| `--info` | Future: informational | `#58a6ff` (reuse `--accent`) |
| `--surface-overlay` | Translucent surface | `rgba(22,27,34,0.8)` |
| `--border-subtle` | Translucent border | `rgba(48,54,61,0.6)` |

---

## 4. Spacing Audit

### Current Values (all ad-hoc — no scale)

| Value | Where Used |
|---|---|
| `0` | Global reset, various |
| `2px` | Export menu gap |
| `4px` | Export menu padding |
| `5px` | Kbd padding |
| `6px` | Export btn gap, key hint gap, menu offset |
| `8px` | Export menu item gap + padding |
| `12px` | Export btn padding, menu item padding |
| `16px` | Home btn top, title margin-bottom |
| `20px` | Nav btn left/right, home btn left |
| `24px` | Divider margin, logo gap |
| `40px` | BottomBar padding, logo margin-bottom |
| `44px` | Deck-ty bottom padding |
| `48px` | Accent bar left, nav btn size |
| `56px` | Overflow warn padding-bottom, keyHint bottom |
| `72px` | Content gutter (tokenized ✅) |

**Observations:**
- No spacing scale. Values are purely aesthetic/ad-hoc.
- Closest natural pattern: 4, 8, 12, 16, 20, 24, 40 — roughly a 4px base scale but with many deviations
- `--content-gutter` (72px) is the only tokenized spacing value

### Recommended Spacing Scale (4px base)

```
--space-1:  4px    --space-6:  24px
--space-2:  8px    --space-8:  32px
--space-3:  12px   --space-10: 40px
--space-4:  16px   --space-12: 48px
--space-5:  20px   --space-14: 56px
```

---

## 5. Border Radius Audit

| Value | Where Used |
|---|---|
| `50%` | Orbs, glows, nav buttons (circle) |
| `20px` | Logo containers (dead code) |
| `10px` | Home btn, export btn, export menu |
| `6px` | Export menu items |
| `4px` | Kbd keys |
| `2px` | Accent bar, progress bar |
| `1px` | Streaks, dividers |

No radius tokens exist. Suggested:
```
--radius-sm: 4px   --radius-lg: 10px
--radius-md: 6px   --radius-xl: 20px
--radius-full: 50%
```

---

## 6. Z-Index Audit

| Value | Element | Notes |
|---|---|---|
| `9999` | `.slide-overflow-warn` | Dev-only, appropriately high |
| `300` | `.progressTrack` | Progress bar |
| `200` | `.homeBtn`, `.exportBtn`, `.exportGroup`, `.navBtn`, `.keyHint` | All nav chrome |
| `100` | `.bar` (BottomBar) | Below nav, above slides |
| `2` | `.deck-ty-content` | Content above decorations |

No z-index tokens. Suggested scale:
```
--z-content: 2     --z-nav: 200
--z-bar: 100        --z-progress: 300
--z-overlay: 9999
```

---

## 7. Transition / Animation Audit

### Transitions (all hardcoded)

| Duration | Easing | Used For |
|---|---|---|
| `0.6s` | `cubic-bezier(0.4, 0, 0.2, 1)` | Slide enter/exit (opacity + transform) |
| `0.5s` | `cubic-bezier(0.4, 0, 0.2, 1)` | Progress bar width |
| `0.4s` | `ease` | Nav wrapper fade |
| `0.25s` | `ease` | Button hover states |
| `0.15s` | `ease` | Menu item hover, menu appear |

### Animations

| Name | Duration | Easing | Purpose |
|---|---|---|---|
| `deck-ty-pulse` | `6s` | `ease-in-out` | Glow orb pulse |
| `deck-ty-streak-move` | `4s` | `ease-in-out` | Speed streaks |
| `deck-ty-grad-shift` | `6s` | `ease` | Title gradient shift |
| `menuFadeIn` | `0.15s` | `ease` | Export menu appear |
| `fadeOut` | `3s` (5s delay) | — | Key hints auto-hide |
| `tyPulse` | `6s` | `ease-in-out` | Dead code duplicate |
| `streakMove` | `4s` | `ease-in-out` | Dead code duplicate |
| `gradShift` | `6s` | `ease` | Dead code duplicate |

Suggested tokens:
```
--transition-fast: 0.15s ease
--transition-base: 0.25s ease
--transition-slow: 0.4s ease
--ease-slide: cubic-bezier(0.4, 0, 0.2, 1)
```

---

## 8. Dead CSS

### `slides/ThankYouSlide.module.css` — CONFIRMED DEAD

- **132 lines** of completely unused CSS
- **Not imported** by any JSX/JS file in the codebase
- `GenericThankYouSlide.jsx` uses **global classes** (`deck-ty-*` from `global.css`), not this CSS module
- Contains duplicate animations (`tyPulse`, `streakMove`, `gradShift`) that mirror the global equivalents
- Contains logo styles (`.logos`, `.logoGithub`, `.logoMs`, `.plus`) that have no corresponding JSX in GenericThankYouSlide — these were likely from an older, non-generic version

**Recommendation:** Delete this file entirely in Phase 2.

### Unused Tokens (defined but never consumed)
- `--blue-bright` (`#79c0ff`) — defined in `:root`, never used as `var(--blue-bright)`
- `--purple-deep` (`#6e40c9`) — defined in `:root`, never used as `var(--purple-deep)`
- `--orange` (`#d29922`) — defined in `:root`, never used as `var(--orange)`
- `--bg` (`#0d1117`) — defined in `:root`, never consumed directly (only `--bg-deep` is used; `--bg`'s raw value appears once as `rgba(13,17,23,0.85)` in BottomBar)

**Note:** `--blue-bright`'s raw rgba `(121,192,255)` appears once in Navigation.module.css — the token exists but is bypassed.

---

## 9. Recommendations for Phase 2

### Priority 1 — Quick Wins
1. **Delete** `ThankYouSlide.module.css` (dead code, 132 lines)
2. **Replace** 6 instances of hardcoded `rgba(31,111,235,...)` with a `--blue-glow` derived value
3. **Add** `--error: #f85149` semantic token and use in overflow warning
4. **Audit** `--blue-bright`, `--purple-deep`, `--orange` — keep for future use or remove

### Priority 2 — Token Codification
5. **Typography tokens:** font-size scale (2xs → display), font-weight scale, letter-spacing tokens
6. **Spacing tokens:** 4px-base scale from `--space-1` to `--space-14`
7. **Border-radius tokens:** `--radius-sm` through `--radius-full`

### Priority 3 — Architecture
8. **Z-index scale:** Named layers instead of magic numbers
9. **Transition tokens:** Duration + easing combinations
10. **Surface overlay tokens:** Translucent surface, border, and bg values
11. **Semantic color layer:** Map decorative colors to intent (`--success`, `--warning`, `--info`)

### Priority 4 — Future (Phase 3)
12. **Dark/light mode:** Current palette is dark-only. Token layer enables future theming
13. **Accessibility:** No focus-visible styles exist. No reduced-motion media queries for animations

---

*This audit feeds directly into Phase 2 token codification. No code changes were made.*

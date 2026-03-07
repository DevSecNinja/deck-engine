---
description: "Use when editing deck.config.js to register slides or modify project configuration."
applyTo: "**/deck.config.js"
---

# deck.config.js Conventions

## Structure

```js
import CoverSlide from './src/slides/CoverSlide.jsx'
import MySlide from './src/slides/MySlide.jsx'

export default {
  id: 'my-project',          // lowercase-hyphens, unique slug
  title: 'Project Title',
  subtitle: 'Tagline',
  description: 'Metadata',
  icon: '🚀',                // emoji for launcher
  accent: '#7c3aed',         // CSS color, sets --accent
  order: 1,                  // sort position in launcher
  slides: [
    CoverSlide,
    MySlide,
    // ThankYouSlide is typically last
  ],
}
```

## Registering a new slide

1. Add an import at the top: `import NewSlide from './src/slides/NewSlide.jsx'`
2. Insert the component in the `slides` array at the desired position
3. Indices are assigned by array position — do not manage them manually

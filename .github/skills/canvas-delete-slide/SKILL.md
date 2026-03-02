---
name: canvas-delete-slide
description: Guide for removing a slide from an existing canvas project. Use this when asked to delete, remove, or drop a slide from a deck/project.
---

# Removing a Slide from an Existing Canvas Project

This is the reverse of `canvas-add-slide`. It removes a slide and repairs all indexes.

## Determine the target project

1. If the user specified a project in their prompt, use that.
2. Otherwise, check `.github/memory/state.md` for the `project:` field under `## Active Project`.
3. Only if both are empty, **ask the user** which project the slide belongs to.

## Identify the slide to remove

If the user didn't specify precisely which slide to remove, open the project's App file and list all slides with their indexes so the user can choose.

---

## Step 1: Remove the slide from the project App

Edit the project's App file (e.g., `deck/src/projects/<project-id>/<ProjectName>App.jsx`):

1. **Remove the import statement** for the slide being deleted.
2. **Remove the JSX element** (e.g., `<MySlide />`) from inside `<div className="deck">`.
3. **Decrement `TOTAL` by 1.**

## Step 2: Decrement subsequent slide indexes

Every slide that appeared **after** the deleted slide must have its index decremented by 1.

If the deleted slide had `index={K}`:
- Every slide with `index > K` must change to `index - 1`.
- For **project-local slides** with hardcoded indexes — edit the `<Slide index={N}` in each `.jsx` file.
- For **shared slides with index props** — edit the prop value in the App file.

### Example: removing slide at position 3 from a 10-slide project

Before:
```
TOTAL = 10
0=Cover, 1=Objective, 2=Sessions, 3=DELETED, 4=Timeline, 5=Coaching, 6=TestFlight, 7=Appendix, 8=Certs, 9=ThankYou
```

After:
```
TOTAL = 9
0=Cover, 1=Objective, 2=Sessions, 3=Timeline(-1), 4=Coaching(-1), 5=TestFlight(-1), 6=Appendix(-1), 7=Certs(-1), 8=ThankYou(-1)
```

Files to update:
- `TimelineSlide.jsx` → `index={4}` becomes `index={3}`
- `CoachingTeamSlide.jsx` → `index={5}` becomes `index={4}`
- `TestFlightTeamSlide.jsx` → `index={6}` becomes `index={5}`
- `AppendixSlide.jsx` → `index={7}` becomes `index={6}`
- `CertificationsSlide.jsx` → `index={8}` becomes `index={7}`
- In the App file: `<GenericThankYouSlide index={9} .../>` becomes `index={8}`, and `TOTAL = 10` becomes `TOTAL = 9`

## Step 3: Delete the slide files

If the slide is **project-local** (lives in `deck/src/projects/<project-id>/`), delete:

- `<SlideName>Slide.jsx`
- `<SlideName>Slide.module.css`

If the slide is **shared** (lives in `deck/src/slides/`), do **not** delete it — it may be used by other projects. Only remove the import and JSX from this project's App file.

## Step 4: Check for references

Search the project directory for any remaining references to the deleted slide:

- Other slides that import or reference the deleted component
- Data files specific to the deleted slide (if any)
- Remove any orphaned references

## Step 5: Verify

1. Run `npm run dev` from `deck/`.
2. Navigate to the project and confirm:
   - The deleted slide no longer appears
   - All remaining slides are navigable (← → arrows, keyboard)
   - Progress bar reflects the correct new total
   - No slides are missing or duplicated
   - No console errors

## Quick checklist

- [ ] Removed import from project App file
- [ ] Removed JSX element from `<div className="deck">`
- [ ] Decremented `TOTAL` by 1
- [ ] All subsequent slide indexes decremented by 1
- [ ] Indexes are contiguous: 0, 1, 2, ..., TOTAL-1
- [ ] Deleted slide `.jsx` and `.module.css` files (project-local only)
- [ ] No orphaned references to the deleted slide
- [ ] No console errors, all slides navigable

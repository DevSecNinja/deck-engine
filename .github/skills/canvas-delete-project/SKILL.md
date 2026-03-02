---
name: canvas-delete-project
description: Guide for removing a project from the canvas presentation app. Use this when asked to delete, remove, or tear down an existing project or slide deck.
---

# Removing a Project from the Canvas App

This is the reverse of `canvas-add-project`. It removes all traces of a project from the codebase.

## Determine the target project

1. If the user specified a project in their prompt, use that.
2. Otherwise, check `.github/memory/state.md` for the `project:` field under `## Active Project`.
3. Only if both are empty, **ask the user** which project to delete.

**Confirm with the user before proceeding** — this operation deletes files permanently.

---

## Step 1: Unregister from App.jsx

Edit `deck/src/App.jsx` and remove three things:

1. **The import statement** for the project's App component (e.g., `import DevPlanApp from './projects/dev-plan/DevPlanApp'`).
2. **The route check** in `getRoute()`: remove the `if (hash === '<project-id>') return '<project-id>'` line.
3. **The render condition**: remove the `if (route === '<project-id>') return <ProjectApp />` line.

## Step 2: Unregister from ProjectPicker.jsx

Edit `deck/src/ProjectPicker.jsx` and remove the entry from the `projects` array that has `id: '<project-id>'`.

## Step 3: Delete the project directory

Delete the entire directory `deck/src/projects/<project-id>/` and all its contents (App component, slide files, CSS modules).

## Step 4: Clean up exports

Delete any exported PDFs for this project:

```
deck/exports/<project-id>-slides.pdf
```

Only delete if the file exists. Do not fail if it doesn't.

## Step 5: Clear active project state

Read `.github/memory/state.md`. If the `project:` field under `## Active Project` matches the deleted project, clear it (set to empty):

```md
## Active Project

project: 
```

## Step 6: Verify

1. Run `npm run dev` from `deck/`.
2. Confirm the project no longer appears on the project picker.
3. Confirm no console errors or broken imports.

## Quick checklist

- [ ] User confirmed deletion
- [ ] Removed import + route + render from `deck/src/App.jsx`
- [ ] Removed entry from `projects` array in `deck/src/ProjectPicker.jsx`
- [ ] Deleted `deck/src/projects/<project-id>/` directory
- [ ] Deleted `deck/exports/<project-id>-slides.pdf` (if it existed)
- [ ] Cleared active project in `.github/memory/state.md` (if it was set to this project)
- [ ] No broken imports or console errors

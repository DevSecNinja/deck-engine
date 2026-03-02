---
name: canvas-set-project
description: Set the active canvas project. Use this when the user wants to switch, select, or set the current project they are working on.
---

# Set Active Project

This skill sets the active project in `.github/memory/state.md` so that other skills (like `canvas-add-slide`) know which project to operate on without asking.

## Steps

### 1. List available projects

Check `deck/src/App.jsx` for registered project routes, or list sub-directories under `deck/src/projects/`. Also check if `ghcp` is registered as a top-level project in `App.jsx` (it lives at `deck/src/GhcpApp.jsx`, not under `projects/`).

Present the list to the user and ask them to choose.

### 2. Update state.md

Open `.github/memory/state.md` and set the `project:` field under `## Active Project` to the chosen project id (kebab-case).

Example — setting `dev-plan` as active:

```md
# Canvas State

## Active Project

project: dev-plan
```

### 3. Confirm

Tell the user which project is now active. All subsequent project-scoped skills (like adding slides) will use this project automatically.

## Rules

- The project id must match the kebab-case folder name under `deck/src/projects/` (or `ghcp` for the top-level GhcpApp).
- If the user asks to set a project that doesn't exist, suggest they create it first using the `canvas-add-project` skill.
- Only one project can be active at a time.
- The `state.md` file may contain other state fields — only modify the `project:` line under `## Active Project`. Do not remove or alter other sections.

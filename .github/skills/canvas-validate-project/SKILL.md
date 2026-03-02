---
name: canvas-validate-project
description: Validate and polish a canvas project. Use this when asked to validate, audit, polish, review, check, or verify a project for correctness. Checks slide indexes, import consistency, TOTAL count, and exports to PDF.
---

# Validate & Polish a Canvas Project

Use this skill to audit a project for correctness, fix any issues, and produce a verified PDF export.

## Determine the target project

1. If the user specified a project in their prompt, use that.
2. Otherwise, check `.github/memory/state.md` for the `project:` field under `## Active Project`.
3. Only if both are empty, **ask the user** which project to validate.

---

## Step 1: Audit slide indexes

Open the project's App file (e.g., `deck/src/projects/<project-id>/<ProjectName>App.jsx`) and verify:

### 1a. Count slides vs TOTAL

- Count every `<...Slide />` component rendered inside `<div className="deck">`.
- Compare with the `TOTAL` constant. **They must match exactly.**
- If they differ, fix `TOTAL`.

### 1b. Verify contiguous indexes (0 to TOTAL-1)

For each slide in render order, check its `index` value:

- **Project-local slides** — open the `.jsx` file and find `<Slide index={N}`.
- **Shared slides used with props** — check the `index` prop in the App file (e.g., `<GenericThankYouSlide index={8} />`).
- **Shared slides with hardcoded defaults** — open the shared slide file to see the default, but the App file prop overrides it.

Verify:
- Indexes start at `0` and increment by `1` with no gaps or duplicates.
- The render order in the App file matches the index sequence.
- The last slide has `index={TOTAL - 1}`.

If any indexes are wrong, fix them in the slide files and/or App file.

### 1c. Check for duplicate component names

Ensure no two slide files in the project directory export the same component name.

---

## Step 2: Verify imports and file integrity

For each slide referenced in the App file:

1. **Import exists** — the import statement points to a file that actually exists.
2. **CSS module exists** — every project-local `.jsx` slide has a matching `.module.css` file.
3. **Shared component imports are correct** — verify paths use `../../components/` and `../../slides/` (two levels up from `projects/<id>/`).
4. **No unused imports** — every imported slide is rendered in the JSX.
5. **No missing imports** — every rendered slide component has a corresponding import.

---

## Step 3: Validate slide structure

For each project-local slide, open the `.jsx` file and verify:

- [ ] Wrapped in `<Slide index={N} className={styles.xxx}>` with correct index
- [ ] Contains `<div className="accent-bar" />` as first child
- [ ] Contains at least one `<div className={\`orb ${styles.orbN}\`} />` decorative orb
- [ ] Content is inside `<div className="content-frame content-gutter">` (or combined with a body wrapper)
- [ ] `<BottomBar />` is the **last child** inside `<Slide>`
- [ ] `BottomBar text` is consistent with other slides in the same project

For each `.module.css` file, verify the root class has:
- [ ] `background: var(--bg-deep)`
- [ ] `flex-direction: column`
- [ ] `padding: 0 0 44px 0` (or equivalent bottom padding for BottomBar)

---

## Step 4: Validate project registration

### In `deck/src/App.jsx`:

- [ ] Import statement for the project's App component exists
- [ ] `getRoute()` has a matching `if (hash === '<project-id>') return '<project-id>'` line
- [ ] Render section has a matching `if (route === '<project-id>') return <ProjectApp />` line

### In `deck/src/ProjectPicker.jsx`:

- [ ] Entry exists in the `projects` array with matching `id`
- [ ] Entry has `title`, `subtitle`, `description`, `icon`, and `accent` fields

### Consistency check:

The project `id` must be identical across:
- Folder name under `deck/src/projects/`
- Route string in `App.jsx` `getRoute()`
- `project` prop on `<SlideProvider>` in the project App
- `id` field in `ProjectPicker.jsx` `projects` array

---

## Step 5: Export to PDF

Run the PDF export command from the `deck/` directory:

```bash
node scripts/export-pdf.mjs --project <project-id>
```

### Verify the export:

1. Check that the file `deck/exports/<project-id>-slides.pdf` was created.
2. Verify the file size is reasonable (not 0 bytes).
3. If the export fails, check the error output and fix the underlying issue (usually a rendering error, missing dependency, or incorrect TOTAL).

### Common export issues:

| Symptom | Cause | Fix |
|---|---|---|
| `0 slides` detected | Project route not matching | Verify hash route matches `project` prop |
| Export hangs | Infinite loop in slide rendering | Check for circular navigation or broken `SlideContext` usage |
| Missing slides in PDF | Wrong `TOTAL` or index gaps | Fix indexes per Step 1 |
| Blank pages | CSS not loading | Verify `.module.css` imports in slide files |
| Script error on launch | Missing `puppeteer` | Run `npm install` in `deck/` |

---

## Step 6: Report results

Summarize findings to the user:

- Number of slides validated
- Any issues found and fixed (index mismatches, missing files, structural issues)
- PDF export status (success + file path, or failure + reason)
- Overall project health: **pass** or **issues found**

---

## Quick checklist

- [ ] `TOTAL` matches actual slide count
- [ ] Indexes are contiguous: 0, 1, 2, ..., TOTAL-1
- [ ] No duplicate or missing indexes
- [ ] All imports resolve to existing files
- [ ] Every `.jsx` slide has a companion `.module.css`
- [ ] All slides have accent-bar, content-frame, BottomBar
- [ ] BottomBar text is consistent across the project
- [ ] CSS root classes have required properties
- [ ] Project registered in `App.jsx` (import + route + render)
- [ ] Project registered in `ProjectPicker.jsx` (projects array)
- [ ] Project id is consistent everywhere
- [ ] PDF exported successfully to `deck/exports/<project-id>-slides.pdf`
- [ ] PDF file exists and has non-zero size

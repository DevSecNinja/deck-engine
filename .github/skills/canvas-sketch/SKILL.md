---
name: canvas-sketch
description: Sketch a slide on Whiteboard, capture the sketch, and use it as inspiration to create a new slide component. Use this when the user wants to draw, sketch, wireframe, or visually design a slide before building it.
---

# Sketch a Slide

Use Whiteboard to sketch a slide layout, capture the result, and translate it into a real slide component.

## Workflow

### Step 1 — Determine the target project

Resolve the project using the same order as canvas-eyes:
- User named it → use that.
- Obvious from conversation context → use that.
- Read `project:` from `.github/memory/state.md`.
- Still empty → ask the user.

### Step 2 — Open Whiteboard

Run this command to launch the Whiteboard app:

```powershell
Start-Process "ms-whiteboard-cmd:"
```

Then tell the user:

> **Whiteboard is open. Sketch your slide layout. When you're done, use "Fit to screen" (Ctrl+Shift+F or the zoom menu) so the entire sketch is visible, then tell me you're ready.**

**STOP here.** Do NOT proceed until the user explicitly says the sketch is ready.

### Step 3 — Capture the sketch

When the user says the sketch is ready, capture a screenshot of the Whiteboard window:

```powershell
Add-Type @"
using System;
using System.Runtime.InteropServices;
using System.Drawing;
public class WinCapture {
    [DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr h);
    [DllImport("user32.dll")] public static extern bool GetWindowRect(IntPtr h, out RECT r);
    [DllImport("user32.dll")] public static extern bool SetProcessDPIAware();
    [StructLayout(LayoutKind.Sequential)] public struct RECT { public int L, T, R, B; }
}
"@
[WinCapture]::SetProcessDPIAware() | Out-Null
Add-Type -AssemblyName System.Drawing
# Find the Whiteboard window (works across all monitors)
$h = (Get-Process | Where-Object { $_.MainWindowTitle -like '*Whiteboard*' } | Select-Object -First 1).MainWindowHandle
if (!$h -or $h -eq [IntPtr]::Zero) { Write-Error "Whiteboard window not found"; return }
[WinCapture]::SetForegroundWindow($h) | Out-Null
Start-Sleep -Milliseconds 500
$r = New-Object WinCapture+RECT
[WinCapture]::GetWindowRect($h, [ref]$r) | Out-Null
$w = $r.R - $r.L; $ht = $r.B - $r.T
$bmp = New-Object Drawing.Bitmap $w, $ht
$g = [Drawing.Graphics]::FromImage($bmp)
$g.CopyFromScreen($r.L, $r.T, 0, 0, (New-Object Drawing.Size $w, $ht))
$dir = "c:\code\canvas\.github\eyes"
if (!(Test-Path $dir)) { New-Item -ItemType Directory -Path $dir -Force | Out-Null }
$file = Join-Path $dir "sketch-$(Get-Date -Format 'yyyy-MM-ddTHH-mm-ss').png"
$bmp.Save($file)
$g.Dispose(); $bmp.Dispose()
Write-Host "Sketch saved: $file"
```

### Step 4 — Analyze the sketch

Reference the saved screenshot image. Study it carefully and identify:

- **Layout structure** — how many columns/rows, content zones, header/footer areas.
- **Text elements** — headings, labels, bullet points, callouts.
- **Visual elements** — boxes, icons, images, dividers, backgrounds.
- **Data patterns** — tables, grids, lists, charts, metrics.
- **Spatial relationships** — alignment, spacing, grouping, hierarchy.

Describe what you see back to the user and confirm your interpretation before proceeding.

### Step 5 — Create the slide

Use the **canvas-add-slide** skill to build the slide, guided by the sketch:

1. Map sketch regions to CSS Grid or Flexbox layout.
2. Translate hand-drawn text into real content with proper typography (see canvas-add-slide § B).
3. Replace rough shapes with styled `<div>` containers using CSS Modules.
4. Follow all canvas-add-slide conventions (background, padding, index management).
5. Use the sketch as a **guide**, not a pixel-perfect spec — apply the design system's colors, fonts, and spacing from `global.css`.

### Step 6 — Visual verification

After creating the slide, use the **canvas-eyes** skill to capture a screenshot of the rendered result.

Compare the rendered slide against the original sketch. If the user is present, show both and ask if adjustments are needed.

## Notes

- Whiteboard sketches are rough — interpret intent, not exact pixels.
- If the sketch contains text that's hard to read, ask the user to clarify.
- The sketch screenshot is saved under `.github/eyes/` (gitignored) with a `sketch-` prefix.
- You can capture multiple sketches in one session (each gets a unique timestamp).

# Controls

Settings → Input device selects how scrolling behaves:

- **Mouse:** every wheel movement zooms toward the cursor, including small and fractional steps.
- **Trackpad:** two-finger swipes pan in screen X/Y; pinch zooms. Existing explicit Trackpad preferences are retained.

Browsers do not reliably distinguish smooth mouse wheels from trackpad swipes. Input device is explicit; the former automatic small-delta heuristic is removed. The setting is independent of the button navigation preset. Touchscreens use one finger to orbit and two fingers to pan/pinch. In 2D drawings, orbit gestures pan.

## Button presets

Left-drag orbits in 3D. Settings → Navigation style selects the other button bindings. Ctrl also accepts Command on macOS. Modifiers are captured when the drag starts.

| Preset | Orbit | Pan | Drag zoom |
| --- | --- | --- | --- |
| Onshape (default) | Right | Middle, Shift/Ctrl+right | — |
| SolidWorks | Middle | Ctrl+middle | Shift+middle |
| Creo / NX | Middle | Shift+middle | Ctrl+middle |
| Rhino | Right | Middle, Shift+right | Ctrl+right |
| Fusion 360 / Inventor | Shift+middle | Middle | — |
| Blender | Middle | Shift+middle | Ctrl+middle |

Reverse scroll zoom affects mouse wheels only; pinch direction and drag zoom remain unchanged. Double-click does not reposition the camera pivot.

## View shortcuts

| Shortcut | Action |
| --- | --- |
| Shift+1–7 | Front, back, left, right, top, bottom, isometric |
| F / Shift+F | Fit model / fit selection |
| N | Normal to a selected planar face; repeat to flip |
| Shift+X | Toggle section |
| Y / Shift+Y | Hide selected or hovered part / show all |
| C | Add anchored comment |
| P / E | Point / feature measurement |
| Escape | Clear selection and current measurement |

View shortcuts are inactive while typing or while a dialog is open. Measurements retain their two/three-point picking workflow; this viewer does not implement CAD editing or window/crossing box selection.

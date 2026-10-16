# Controls

The viewport uses one automatic control scheme:

| Input                                      | Action                                             |
| ------------------------------------------ | -------------------------------------------------- |
| Left-button drag                           | Pan                                                |
| Middle-button drag                         | Pan                                                |
| Right-button drag                          | Orbit around the current view center               |
| Two-finger trackpad swipe in any direction | Pan                                                |
| Trackpad pinch                             | Zoom                                               |
| Mouse wheel                                | Zoom                                               |
| Single click                               | Pick for the current measurement or selection tool |

Zoom stays centered in the view. Panning moves the view center, and subsequent orbiting uses that center. Double-click does not reposition it.

Touchscreens use one finger to orbit and two fingers to pan and pinch. In 2D drawings, orbit gestures pan. Previous input-device, navigation-preset, and reverse-wheel preferences are ignored; no device selection is required.

The Chromium macOS app also supports two-finger trackpad twist: it rolls the view around the current sight line. The model, measurement coordinates, view center and zoom stay unchanged. Twist applies only over the canvas; view presets reset the orientation. This uses native AppKit rotation events and is not available through the browser fallback or lightweight Tauri shell. Android and iOS retain one-finger orbit and two-finger pan/pinch.

The macOS desktop app distinguishes trackpad gestures from mouse wheels using native scroll-event phases when its AppKit input bridge is available. The browser version cannot access those phases. It uses wheel tick, precision, horizontal-scroll, and momentum information as a fallback; some smooth mouse wheels and vertical trackpad swipes produce indistinguishable browser events and can be misclassified. Pinch still zooms, and left/middle drag always pans.

The fixed mapping and browser fallback passed 1,262 assertions in headed Chromium using the Apple M5 Max Metal renderer, including button/modifier combinations, centered navigation, touch gestures, and measurement overlays. This browser run does not validate native AppKit event delivery; that bridge is tested separately.

## View shortcuts

| Shortcut    | Action                                           |
| ----------- | ------------------------------------------------ |
| Shift+1–7   | Front, back, left, right, top, bottom, isometric |
| F / Shift+F | Fit model / fit selection                        |
| N           | Normal to a selected planar face; repeat to flip |
| Shift+X     | Toggle section                                   |
| Y / Shift+Y | Hide selected or hovered part / show all         |
| C           | Add anchored comment                             |
| P / E       | Point / feature measurement                      |
| Escape      | Clear selection and current measurement          |

View shortcuts are inactive while typing or while a dialog is open. Measurements retain their two/three-point picking workflow; this viewer does not implement CAD editing or window/crossing box selection.

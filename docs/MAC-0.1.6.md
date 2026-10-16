# Mac 0.1.6 delivery

## Navigation correction

Middle-button dragging pans in screen X/Y, matching two-finger trackpad panning. It no longer follows left-button orbit. This applies when opening a model and when changing between perspective and orthographic projection. Left drag still orbits 3D models; left drag pans 2D drawings. Help and mouse navigation labels describe the corrected controls.

Wheel and pinch zoom sensitivity increased from 1.1 to 1.3 (about 18%). Trackpad swipes continue to pan; zoom buttons retain their existing step.

The 0.1.5 copy cleanup is retained. The signed 0.1.5 checkpoint remains available for comparison; its unpublished release drafts are superseded by 0.1.6.

## Validation and delivery

The production frontend build, 135 unit tests and 46 actual Apple M5 Max Metal navigation/measurement checks pass. The hardware checks verify 2D/3D and perspective/orthographic pan invariants, equivalence with actual trackpad wheel deltas, unchanged left-drag behavior, no accidental selection after a drag, and an 18.18% increase in logarithmic wheel/pinch zoom response. Measurement overlay/export checks also pass.

Separate Casimir and Mirror package variants identify their fixed update repository; the Updates panel displays that source read-only. All 43 Electron unit tests pass, covering both owners, credential migration and feed validation. An actual unsigned Mirror package reports Mirror as its source and rejects a Casimir switch; ASAR metadata and dependency checks run before production signing. The upload helper passed 20 guard tests, including rejection of cross-repository artifacts. Fresh production signing, notarization and publication are pending. Apple upload transport failures affected the previous checkpoint. Published 0.1.4 remains unchanged.

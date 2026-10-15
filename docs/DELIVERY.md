# Shenzhen 3D 0.1.2 delivery

Private review/rendering preview, 16 October 2026 (Asia/Shanghai).

- [Casimir Engineering downloads](https://github.com/casimir-engineering/shenzhen-3D/releases/tag/preview-0.1.2)

The update adds comments attached to parts, points and model features; portable `.sz3d` projects containing original source files, notes, measurements and units; shaded/edge/wireframe/dashed hidden-line modes; movable and uniform lighting; and genuine progressive WebGPU ray tracing with measurement overlays and PNG export. [Review files](REVIEW.md) and [rendering](RENDERING.md) describe use and limits.

## Packages

The release set contains 16 assets: macOS universal DMG; Apple Silicon Chromium Performance DMG; Windows x64 EXE/MSI; Linux x64 AppImage/DEB/RPM; Android ARM64 development APK/unsigned AAB; registered-device iOS IPA/ARM64 simulator archive; web ZIP; native notices ZIP; README; build provenance; and SHA-256 checksums. The source tag is `preview-0.1.2`, at `44761a8`.

Every package uses the frozen frontend with `index.html` SHA-256 `5b2e883a9034762dff05e565a6176259cf1540892adc14636d0b98cf4f718350` and JavaScript entry `assets/index-dpyKHpus.js`. The manifest records individual native build inputs and verification. CI's web output matched all 79 frozen files byte for byte.

Mac apps are Developer ID signed but not notarized. Windows installers are unsigned. Android uses a development key; the AAB requires production signing. The iOS IPA is development signed for the team's registered devices, with profile expiry on 15 October 2027; it is not an App Store or arbitrary-device installer. No app-store or public website publication was performed. Serve the web ZIP's `dist/` over HTTP(S); HTTPS or localhost enables its offline PWA.

## Verification

All nine platform jobs passed in [Casimir CI](https://github.com/casimir-engineering/shenzhen-3D/actions/runs/38800931430) at `44761a8`. Windows/Linux startup checks passed; these are not full interactive tests on those operating systems.

Local checks passed: 115 unit tests, 12 exact-CAD checks and 18 production desktop/mobile browser workflows, with two expected viewport-specific skips. Sample STEP comments and exact measurements survived portable-project save/reopen. Offline reload/import, render controls, archive validation and unsupported-WebGPU recovery passed. Hardware tests verified genuine tracing, retained assembly instancing, measurement overlays, cancellation and exact display/export color parity. The packaged Chromium app passed 19 runtime checks, including native project open/save and tracing.

The final [performance regression](PERFORMANCE.md) retained approximately 120 fps on the M5 Max at a 2880×1800 drawing buffer: 376,000 parts / 98.30 million logical triangles with 86.37 million navigation triangles submitted, and 37,600 separate geometry identities / 9.83 million triangles at full detail. These are specified replicated workloads and renderer scheduling measurements, not a guarantee for arbitrary geometry, perfect frame intervals or physical presentation. Ray tracing progressively refines still views; navigation uses raster rendering.

The signed lightweight Mac app imported the sample STEP in 3.02 seconds, rendered hidden lines, exported PNG and saved/reopened a portable project. Android ARM64 installation/launch/rendering and 16 KB alignment passed. The iOS 26.5 simulator launched the demo, accepted a note anchor/text and exported a native project; note saving and native touch scrolling remain unverified. See [platform evidence](PLATFORMS.md) for runtime scope. No physical mobile device was tested. Detailed per-artifact evidence is in the release manifest.

Notes and measurements are retained by saving `.sz3d` files; the offline application cache does not persist a working model/session. Review files are editable snapshots rather than live collaboration. Prior private previews `preview-0.1.0` and `preview-0.1.1` remain available unchanged.

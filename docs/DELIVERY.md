# Shenzhen 3D 0.1.0 delivery

Private preview delivered on 16 October 2026 (Asia/Shanghai).

- [Casimir Engineering downloads](https://github.com/casimir-engineering/shenzhen-3D/releases/tag/preview-0.1.0)

Both releases contain the same 15 assets: macOS universal DMG; Windows x64 EXE and MSI; Linux x64 AppImage, DEB and RPM; Android ARM64 development APK and unsigned AAB; iOS registered-device IPA and ARM64 simulator archive; web ZIP; native notices supplement; README; build provenance; and SHA-256 checksums. Every uploaded asset was compared with its local SHA-256 using GitHub's stored digest. Temporary upload parts were removed after verified assembly.

## Verification

The [final nine-job CI run](https://github.com/casimir-engineering/shenzhen-3D/actions/runs/38778039486) passed on application/build source `d710bc1`: web, universal macOS, Windows x64, Linux x64, iOS, and Android ARM64, ARMv7, x86-64 and x86. Windows and Linux executables passed 15-second startup smoke checks. This establishes startup, not full interactive testing on those operating systems.

Local validation passed 38 unit/geometry/format checks, 12 exact-CAD regression checks, and 10 applicable desktop/mobile browser workflows with two deliberate viewport-specific skips. Offline reload and local STEP import passed against production-server `Vary: Origin` headers after the cache-variant fix. See [geometry evidence](VALIDATION.md), [browser evidence](E2E_VALIDATION.md), [format fixtures](FORMAT_VALIDATION.md), and [native runtime evidence](PLATFORMS.md).

The sample STEP file imported in 2.76 seconds in the signed Mac app. On the iPhone simulator, the same STEP opened through Files, point measurements worked, and PNG export saved through the native Files sheet. Android installation, launch, rendering, safe areas and crash logs were checked; Android touch interaction and physical iOS devices were not tested.

## Package scope

The Mac app and DMG are Developer ID signed but not notarized. Windows installers are unsigned. The Android APK uses a development signing key; the AAB requires production signing. The iOS IPA is development signed for the team's registered devices, with a profile expiring 15 October 2027; it is not an App Store or arbitrary-device installer. No store or public website publication was performed.

Serve the web ZIP's `dist/` directory over HTTP(S); use HTTPS or localhost for offline service-worker support. A local production preview runs on port 1424 while its server process remains active. Model files and saved measurement sessions are not persisted by the offline application cache.

`build-manifest.json` records per-artifact source revisions. Some packages precede documentation/CI-only commits; the final app entry is `index-BsJDuriz.js`, with `index.html` SHA-256 `711dcf41688d1d9b18a7bec00657378539ddc717158caa0dbbf8545685f7824c`. The later service-worker correction applies only to the web package; native shells do not register it. Dependency provenance and remaining redistribution requirements are recorded in [THIRD_PARTY.md](THIRD_PARTY.md).

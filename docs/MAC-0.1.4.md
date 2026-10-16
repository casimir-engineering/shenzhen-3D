# Mac 0.1.4 delivery

The Apple Silicon package is built from clean source `e54627711733b94f15f9e26aeb5ac0e9492dd4f9`. It is named **Shenzhen 3D** and requires macOS 13 or later. Its stable bundle identifier remains unchanged so native signed updates retain continuity.

Open `Shenzhen-3D-0.1.4-Apple-Silicon.dmg`, drag Shenzhen 3D into Applications, then launch it from Applications. The installer uses native draggable icons, a real Applications shortcut and a background with 760×500 and 1520×1000 Retina representations.

## Changes

- Distance measurements display a dashed X/Y/Z route with red, green and blue lines and matching labels. The shortest connector remains visible. Zero-length axes are omitted and labels avoid one another.
- Middle-button dragging follows the current left-button navigation behavior. Smooth two-finger trackpad swipes pan horizontally and vertically; pinch zooms. Auto, Mouse and Trackpad preferences accommodate hardware whose wheel events cannot be distinguished reliably.
- The welcome screen always offers recent files and returns when a document is closed. Recent names persist locally; the last small file can reopen immediately within the session. After restarting, or for large uncached files, selecting a recent entry opens the file picker. History does not retain large model blobs or an idle renderer.
- The native app, menu and package use the name Shenzhen 3D. Existing preferences from the previous app name are retained.
- The Updates panel loads on demand. Automatic private GitHub release checks run after startup and at most daily; downloads and installation require explicit actions. Installation asks users to save their work and restart.

## Private updates

Open **Shenzhen 3D → Check for Updates…**, or select **Updates** in the footer. Connect the existing GitHub CLI login, or supply a token with read access to repository contents. Select Casimir Engineering; credentials must be authorized for the selected private repository. Preview releases are enabled by default for this private preview channel.

Credentials remain in the main process and are encrypted using macOS-backed Electron safe storage in a mode-0600 settings file. No credential is shipped in the app, feed, installer or renderer. Disconnect removes the saved credential. The updater selects the newest eligible stable or preview release, verifies the downloaded artifact hash and retains native Squirrel signature checks during installation. It never installs automatically when quitting.

The app and disk image are Developer ID signed. **This build is not notarized:** no notarization credentials were configured. Signing alone does not establish notarization, and downloaded copies may encounter Gatekeeper restrictions.

## Validation

The final packaged executable passed all 20 runtime checks, including native STEP import, worker/WASM assets, portable project reopening, CAD face annotations, saved measurements, PNG/CSV exports, lazy startup and WebGPU ray-tracing convergence/export. Strict deep app signature verification, the DMG signature and checksum, all 84 embedded frontend file hashes and all 16 packaged updater dependencies passed. The actual first-open Finder window was visually checked. Its TIFF contains the expected 72 dpi and 144 dpi representations.

The packaged app reached Open in 2.19 seconds including process startup, with its document loaded in 45.6 ms. This was a single release smoke measurement. Metal-backed animation scheduling was approximately 120 fps; this is not a huge-geometry benchmark.

The source passed 135 unit tests, 30 Electron unit tests, and 28 desktop/mobile browser checks with two expected skips. Additional hardware checks passed 34 measurement/navigation assertions. The final updater panel and recent-file regressions passed separately after the last UI changes.

Three browser startup runs measured a median 76.2 ms to enable Open, 100 ms to first contentful paint and 30.3 ms to enable Open on a warm load. The initial welcome screen requested 91,691 compressed JavaScript bytes and created no renderer canvas. These local HTTP/browser measurements exclude browser process startup and are not network-wide guarantees.

This delivery refreshes the Apple Silicon Electron package. Mobile-sized browser testing does not establish new physical-device validation for Windows, Linux, Android or iOS. Earlier platform packages remain separate. The performance evidence in PERFORMANCE.md describes measured workloads; this release does not promise 120 fps for every huge assembly.

## Artifacts

The DMG is 140,849,393 bytes, SHA-256 `1f6d1089acedc62612180f8c0ec09afe8fe900814dc6682cdf59ae681e23cb86`. The updater ZIP is 140,229,780 bytes, SHA-256 `f80fe7e12cf6809a6f16e87b0763919e1fb6a06385a703b70a76c8fcb5310cd8`. The release feed includes matching SHA-512 fingerprints.

Local delivery: `~/Downloads/Shenzhen-3D-0.1.4-Apple-Silicon.dmg`; app and evidence: `artifacts/releases-0.1.4/Shenzhen 3D.app` and adjacent reports.

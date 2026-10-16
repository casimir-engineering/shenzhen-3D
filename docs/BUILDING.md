# Building and testing

Use Node.js 24+ (CI uses Node 24), npm and the committed lockfile. Native targets additionally require Rust stable and the tools for their operating system. [PLATFORMS.md](PLATFORMS.md) owns platform prerequisites, signing, output paths and the current build/run evidence.

```sh
npm ci
npm run dev
```

The browser development server uses port 1420. `npm ci` runs asset preparation, copying LibreDWG WASM and Draco decoder assets from installed packages into `public/`. The exact CAD bridge/WASM is pinned in `vendor/occt`; its source revision is recorded in `REVISION`. Keep these assets available to both web and native builds.

## Web and PWA

```sh
npm run build
npm run preview
```

The build type-checks TypeScript and writes static files to `dist/`. Serve that directory from the origin root; the current decoder/worker resource URLs assume root deployment. A static HTTP server is required rather than opening `index.html` as a local file. Use HTTPS for hosted deployment; localhost is suitable for local browser development.

Production builds generate `dist/sw.js` and include the web manifest. The browser registers the service worker after load; it caches the app assets and supports offline navigation after installation and asset caching succeed. Open the production app online first, allow the asset downloads to complete, then reload before testing offline. Browser storage limits or private-browsing restrictions can prevent caching. CAD files remain user-selected local files, and saved measurement sessions are not persisted by the service worker. Development mode does not register it. Native Tauri builds use bundled assets and skip service-worker registration.

## Native targets

The Chromium desktop performance shell avoids the default 60 Hz scheduling observed in the Mac system WebKit view. It uses the same built frontend, sandboxed rendering, local asset protocol, native file picker and save dialog. On Apple Silicon:

```sh
npm run build:electron:mac
npm run test:electron
```

The package script always builds the frontend first, then creates a Developer ID signed ARM64 app and DMG when the configured signing identity is available. Timestamped output folders in `artifacts/electron/` include `build-info.json` with the source commit and SHA-256 hashes of every frontend file. The DMG includes a drag-to-Applications shortcut and 1×/2× artwork; regenerate the committed artwork from its editable SVG with `npm run build:dmg:artwork`. Signing does not establish notarization. Electron and Chromium notices are included with the bundle. See [measured renderer performance](PERFORMANCE.md) for browser, Electron and system WebKit evidence. The Tauri builds below remain available as lightweight desktop and mobile packages.

For desktop development:

```sh
npm run tauri dev
```

Build on the appropriate desktop OS after installing its [Tauri prerequisites](https://v2.tauri.app/start/prerequisites/). The repository's platform script forwards additional flags to Tauri and prefers the rustup-managed toolchain:

| Target                                 | Example command                                                                             |
| -------------------------------------- | ------------------------------------------------------------------------------------------- |
| macOS, universal Intel + Apple Silicon | `node scripts/platform-build.mjs desktop --target universal-apple-darwin --bundles app,dmg` |
| Windows                                | `node scripts/platform-build.mjs desktop --bundles nsis,msi`                                |
| Linux                                  | `node scripts/platform-build.mjs desktop --bundles deb,rpm,appimage`                        |
| Android development APK                | `node scripts/platform-build.mjs android --debug --apk --target aarch64 x86_64 --ci`        |
| iOS simulator, on macOS                | `node scripts/platform-build.mjs ios --target aarch64-sim --no-sign --ci`                   |
| iPhone/iPad unsigned archive, on macOS | `node scripts/platform-build.mjs ios --target aarch64 --no-sign --archive-only --ci`        |

Install the target Rust architectures before invoking these commands. The platform script initializes missing Android/Apple projects. Android needs the SDK/NDK/JDK; iOS needs Xcode and the Apple build tools. Device installation and external distribution need the appropriate signing/provisioning setup; an unsigned archive establishes compilation, not an installable iPhone app. Follow [platform instructions](PLATFORMS.md) for those details.

GitHub Actions is configured to test the web app and package universal macOS, Windows, Linux, Android and iOS artifacts on suitable runners. A configured workflow is not a completed validation result. Check the workflow run and [platform evidence](PLATFORMS.md) for the specific artifact/target. Private repository access controls who can retrieve its artifacts; release signing and product distribution remain separate operations.

## Reproducible validation

```sh
npm test
npm run test:cad
npm run benchmark:gpu
npm run test:viewer
npm run benchmark -- fixtures/sample-assembly.step
npx playwright install chromium
npm run test:e2e
node tests/formats-browser.mjs
node tests/drawing-browser.mjs
node scripts/license-audit.mjs
node tests/render-styles-browser.mjs --software
node scripts/perf/check-ray-tracing.mjs --sample
```

`npm test` runs the unit/geometry suites, including mesh features, source units, formats, drawings and surface routes. The CAD script exercises generated solids and the sample STEP assembly against the pinned exact kernel. The benchmark records local startup/import timing and assembly statistics; it is not a device-wide performance guarantee.

`benchmark:gpu` needs the development server on port 1420 and runs headed Chromium on the real Apple GPU; keep its window visible. `test:viewer` uses the same server with software rendering for deterministic geometry, material and shader regression checks. Hardware performance and software correctness results are reported separately. The [benchmark guide](../tests/perf/README.md) documents reproducible parameters and comparisons.

Playwright covers the real application in desktop and mobile-sized Chromium projects. Mobile emulation is useful for layout/touch interactions and does not replace Android/iOS device tests. It starts the Vite server unless `E2E_BASE_URL` points to an existing deployment. On a Linux CI machine, use `npx playwright install --with-deps chromium` to include browser system dependencies.

The ray-tracing check requires a genuine WebGPU device and runs headed on Metal; it checks retained sample-assembly instancing, convergence, immutable source geometry, navigation pause/resume and GPU PNG readback. Unsupported devices retain the raster viewer. Run these GPU checks sequentially when measuring performance.

The standalone format browser check isolates XML loaders, companion object URLs and texture decoding from the UI shell. The drawing browser check exercises DXF/DWG parsing and text rendering. Generated evidence lives under ignored `artifacts/`; browser failures retain traces/screenshots under `test-results/`, with the Playwright report under `playwright-report/`.

Read [measurement validation](VALIDATION.md), [format validation](FORMAT_VALIDATION.md) and [platform evidence](PLATFORMS.md) alongside test results. Fixtures validate specific cases rather than every vendor's format variants or all drawing entities. Windows/Linux packaging, native-device runtime, GPU behavior and browser offline behavior each need their own evidence.

## Distribution materials

The owner controls this private product's license and distribution. Dependencies retain their licenses; private delivery to another organization still requires the applicable third-party notices/source materials. [THIRD_PARTY.md](THIRD_PARTY.md) records components, pinned sources, inventory commands and remaining distribution work. License text copies do not replace matching-source delivery or native dependency inventories.

Private source locations: [Casimir Engineering](https://github.com/casimir-engineering/shenzhen-3D).

# Browser interaction validation

Playwright exercises the running application in Chromium at 1440 × 1000 and an iPhone 13 viewport with touch enabled. The suite uses the existing `@playwright/test` dependency and Chromium installation.

## Run

```sh
npm run test:e2e
```

The configuration reuses a local Vite server on port 1420, or starts one when needed. CI starts its own server. `E2E_BASE_URL` points tests at an alternative running application and disables automatic server startup. Traces and screenshots are retained on failure under `test-results/`; the HTML report is written to `playwright-report/`.

While application source is being edited, use a static copy of a successful build to prevent Vite hot reload from clearing the active model during a test. The validation run used `artifacts/e2e-build` served on port 1423:

```sh
E2E_BASE_URL=http://127.0.0.1:1423 npm run test:e2e
```

To check test/config types independently from the application build:

```sh
npx tsc --ignoreConfig --noEmit --skipLibCheck --target es2022 --module esnext --moduleResolution bundler --types node --lib es2022,dom tests/e2e.spec.ts playwright.config.ts
```

## Coverage

| Workflow | Desktop | Mobile |
| --- | --- | --- |
| Import `fixtures/sample-assembly.step` through the real file input | Yes | Yes |
| Pick two rendered model locations and read distance | Mouse | Touch |
| Convert mm to cm; override source to inches and apply a custom scale | Yes | Yes |
| Save, restore and delete measurements | Yes | Yes |
| Download JSON and CSV and validate units and numeric data | Yes | Yes |
| CAD face area query and exact minimum distance between faces | Yes | Yes |
| Assembly search, hide, show, isolate and show all | Yes | Yes |
| Three-point angle on the sample geometry | Yes | Yes |
| Orthographic projection and section position/axis controls | Toolbar | Settings |
| Edges, ground grid, PNG screenshot download | Yes | — |
| Opacity and assembly explode through settings | — | Yes |
| Uncaught exceptions and browser console errors | Checked after every test | Checked after every test |

Model picks come from WebGL pixel readback after selecting top view and fitting the model. The tests confirm candidate points hit geometry through the visible hover status before clicking. This permits the sample assembly to be measured without hardcoded screen coordinates or private application state. Exact queries use the real CAD worker. Export checks read browser downloads and compare converted values with the saved raw measurement.

## Scope

These are functional browser interaction tests. They do not certify visual design, native file dialogs, signed application bundles, physical phone behavior, OS clipboard integration, or every supported import format. Chromium uses SwiftShader in headless runs, so timing is not a hardware performance benchmark.

## Recorded result

On 2026-10-16, the static-build run completed with **6 passed and 2 intentionally skipped** in 1.2 minutes. Each project skips the control test specific to the other viewport; all workflows listed above ran in their applicable project. No uncaught application exceptions or browser console errors occurred. The independent test/config TypeScript check also passed.

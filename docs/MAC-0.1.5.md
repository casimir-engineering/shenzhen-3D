# Mac 0.1.5 delivery

The Apple Silicon package is built from clean source `612e5bce12972b70f6e9cfcc3f73b5cb1b5de95c` and requires macOS 13 or later.

## Changes

- Removed promotional headings, taglines, reassurance badges and redundant instructions throughout the welcome screen, panels, Help, Settings and Updates.
- The empty workspace contains file actions, a drop target and recent files. Model tools appear after a document opens.
- Controls and statuses use descriptive labels: Sample model, Settings, Dark, Light, No notes and Clear measurement.
- The Retina installer retains native draggable icons and the Applications shortcut, with one instruction: Drag into Applications.

Measurement, rendering, annotation and updater behavior remain unchanged. The copy rule is recorded in `.interface-design/system.md`.

## Validation

Source validation passed 135 frontend unit tests, 30 Electron unit tests and 28 desktop/mobile browser workflows, with two expected viewport-specific skips. Native Electron Updates UI and mobile touch scrolling passed separately. Desktop and mobile welcome/Settings layouts and desktop Help were visually inspected. Browser regression includes the sample STEP, CAD measurements, portable projects, offline reopening, import failures/retry and recent files.

The signed production app passed all 20 packaged checks, including native STEP import, worker/WASM loading, portable project reopening, CAD annotations, saved measurements, PNG/CSV exports and WebGPU tracing/export. It contains 84 verified frontend files and 16 updater dependencies. The welcome screen created no renderer canvas; this single packaged run reached Open in 2.63 seconds including process startup, with DOM content loaded in 81.4 ms. No new huge-model performance claim is made for this copy-only release.

Apple notarization and final distribution verification are in progress.

This delivery refreshes the Apple Silicon Electron package. Shared browser UI uses the same source changes; mobile viewport tests do not establish new physical-device testing or refreshed Windows, Linux, Android or iOS packages.

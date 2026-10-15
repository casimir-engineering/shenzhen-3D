# Platforms and packaging

Shenzhen 3D uses one local React/Three.js viewer and a Tauri 2 native shell. Files are parsed locally. Native applications package the same static assets as the web application; they do not need a running web server.

| Platform | Package | Build command |
| --- | --- | --- |
| Web | Static site / installable PWA | `node scripts/platform-build.mjs web` |
| macOS 12+ | `.app`, `.dmg` | `node scripts/platform-build.mjs desktop --bundles app,dmg` |
| Windows | NSIS `.exe`, MSI | `node scripts/platform-build.mjs desktop --bundles nsis,msi` |
| Linux | AppImage, Debian, RPM | `node scripts/platform-build.mjs desktop --bundles deb,rpm,appimage` |
| Android 7+ | APK, AAB | `node scripts/platform-build.mjs android --apk --aab` |
| iOS/iPadOS 15+ | App archive, simulator app | `node scripts/platform-build.mjs ios --archive-only` |

Build on the target desktop operating system. Windows uses WebView2; its installer bootstraps the runtime when needed. Linux requires WebKitGTK 4.1. Browsers and native webviews need WebGL2 and WebAssembly. Complex CAD documents require enough memory for both the CAD kernel and triangulated geometry; mobile devices generally have lower limits.

## Local development

Install Node.js 24+, Rust stable, and the [Tauri platform prerequisites](https://v2.tauri.app/start/prerequisites/), then run:

```sh
npm ci
npm run tauri dev
```

For the browser use `npm run dev`. Vite runs on port 1420. Production assets go to `dist/`. Native desktop installers go to `src-tauri/target/release/bundle/`.

The native shell provides standard File/Edit/Measure/View/Window/Help menus, keyboard shortcuts, resizable windows, full screen, additional viewer windows, and saved window geometry. File dialogs and filesystem access use Tauri's permission system. Only files chosen through the native picker are added to the filesystem scope; there is no blanket home-directory grant. Dropping files uses the viewer's HTML drop handler. Browser file input remains the portable fallback.

Menu actions are delivered to the focused window as `native-menu` events with `{ action }`: `open`, `export`, `fit`, `isometric`, `front`, `top`, `right`, `clear`, `point`, `feature`, `help`. New Window is handled by Rust.

## Android

Install JDK 17, Android SDK API 36, build tools 36, and NDK 28.2.13676358. Set `JAVA_HOME`, `ANDROID_HOME`, and `NDK_HOME`. Install Rust targets:

```sh
rustup target add aarch64-linux-android armv7-linux-androideabi x86_64-linux-android i686-linux-android
node scripts/platform-build.mjs android --debug --apk --target aarch64 x86_64
```

The platform script initializes missing native projects. Committed Android project settings use API 36. Debug APKs are signed with the machine's development key and can be installed using `adb install -r path/to/app.apk`. Release APK/AAB signing requires the product's private keystore. Do not commit keystores or passwords. Native projects ignore `key.properties`, `keystore.properties`, local SDK paths and generated binaries. See [Android signing](https://v2.tauri.app/distribute/sign/android/).

APK/AAB outputs are under `src-tauri/gen/android/app/build/outputs/`. Use NDK 28+ for 16 KB native library page alignment. The platform script prefers Rust's rustup toolchain so mobile standard libraries are found even when Homebrew Rust is also installed.

## iOS and iPadOS

A Mac with Xcode, CocoaPods and XcodeGen is required. Install the Rust targets:

```sh
rustup target add aarch64-apple-ios aarch64-apple-ios-sim x86_64-apple-ios
node scripts/platform-build.mjs ios --target aarch64-sim --no-sign --ci
node scripts/platform-build.mjs ios --target aarch64 --no-sign --archive-only --ci
```

An unsigned archive proves compilation but cannot be installed on an iPhone. For devices or App Store/TestFlight distribution, set `APPLE_DEVELOPMENT_TEAM` to the authorized team, open `src-tauri/gen/apple` in Xcode, and configure the app's signing/provisioning. Then build with the appropriate `--export-method` (`debugging`, `release-testing`, or `app-store-connect`). Signing credentials remain outside the repository. See [iOS signing](https://v2.tauri.app/distribute/sign/ios/).

## Continuous integration

`.github/workflows/build.yml` runs web tests and packages macOS, Windows, Linux, Android and iOS on their respective GitHub runners. Artifacts are private while the repository is private. CI creates development Android APKs and unsigned release packages/Apple archives without requiring distribution credentials. Store publication, Windows signing, macOS notarization and iOS provisioning are separate release operations. macOS distributions should be signed and notarized before public download; see [macOS signing](https://v2.tauri.app/distribute/sign/macos/).

## Verification record

- Desktop Rust native shell: `cargo check` passed on Apple Silicon macOS.
- Cross-platform build and runtime results are recorded in the project validation report and CI logs. A configured packaging job alone is not evidence of a successful build or a device runtime test.

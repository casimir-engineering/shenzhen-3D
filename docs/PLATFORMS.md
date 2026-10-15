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

Menu actions are delivered to the focused window as `native-menu` events with `{ action }`: `open`, `export`, `fit`, `isometric`, `front`, `top`, `right`, `clear`, `point`, `feature`, `settings`, `help`. New Window is handled by Rust.

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

`.github/workflows/build.yml` runs web tests and packages macOS, Windows, Linux, Android and iOS on their respective GitHub runners. Artifacts are private while the repository is private. macOS CI packages a universal binary for Apple Silicon and Intel. CI creates development Android APKs and unsigned release packages/Apple archives without requiring distribution credentials. Store publication, Windows signing, macOS notarization and iOS provisioning are separate release operations. macOS distributions should be signed and notarized before public download; see [macOS signing](https://v2.tauri.app/distribute/sign/macos/).

## Verification record

- Desktop Rust native shell: `cargo check` passed on Apple Silicon macOS.
- Intel macOS native shell: `cargo check --target x86_64-apple-darwin` passed.
- Android native shell: `cargo check --target aarch64-linux-android` passed.
- iOS native shell: `cargo check --target aarch64-apple-ios` passed. Optional desktop logging is excluded on mobile to avoid an upstream local-time dependency incompatibility on iOS.
- Cross-platform build and runtime results are recorded in the project validation report and CI logs. A configured packaging job alone is not evidence of a successful build or a device runtime test.


### Native runtime checks (16 October 2026)

The production macOS app imported the sample STEP assembly locally in 2.76 seconds in the final signed build. Native Open and Save dialogs worked; a viewport PNG was exported. The native Settings shortcut (Command-comma) opened the settings panel. The universal build includes Apple Silicon and Intel binaries. This local runtime test used Apple Silicon.

The iPhone 17 Pro simulator on iOS 26.5 rendered the demo model and measured two selected points (62.048 mm in the final build), with markers and the mobile measurement panel visible. A native Files Save dialog exported a nonempty PNG to the app Documents folder. The sample STEP also opened successfully through Files and rendered all instances. Documents are exposed in Files for opening local models. Simulator behavior does not establish performance on a physical iPhone or iPad.

The Android API 35 ARM64 emulator installed and launched the APK, rendered the WebGL welcome screen, and had no AndroidRuntime crash in the launch log. Android touch gestures have not been exercised. The native activity applies status/navigation-bar and display-cutout insets and uses light system-bar icons on the dark application background.

Evidence images are in the local `artifacts/` directory. CI has also successfully built Linux packages and the iOS simulator/device archives. CI build success is distinct from interactive testing on those operating systems.

A local device IPA was successfully exported with the authorized Apple Development identity and a team provisioning profile covering 19 registered devices, expiring 15 October 2027. Its code signature passed strict verification. This development IPA can be installed on devices covered by that profile; it is not an App Store distribution. No physical iOS device was used for runtime testing. Credentials and profiles are not in the repository.

The optimized local Android ARM64 APK is development-signed for direct installation (approximately 18 MB); the unsigned release APK and AAB are also retained. This signing key is for development, not a production Play release.

CI includes Linux and Windows startup smoke tests that check whether the packaged executable remains alive for 15 seconds (Linux under Xvfb). These checks do not establish that rendering, file dialogs, or interaction work on those systems. The web CI job also runs the real CAD-kernel measurement fixtures with `npm run test:cad`.


### Final local deliverables

The final native packages use `index-BsJDuriz.js` and `index-B8pKqrJx.css`, from the frozen production assets with `dist/index.html` SHA-256 `711dcf41688d1d9b18a7bec00657378539ddc717158caa0dbbf8545685f7824c`. The embedded JavaScript filename was checked in both macOS architectures, Android APK/AAB, iOS simulator binary, and the exported device IPA.

Packages are copied into `artifacts/releases/`:

| File | Status |
| --- | --- |
| `shenzhen-3d-0.1.0-macos-universal.dmg` | Developer ID signed, Apple Silicon + Intel; strict code-signature verification passed for app and DMG. Not notarized. The signed app launched and imported the sample STEP. |
| `shenzhen-3d-0.1.0-android-arm64-development.apk` | Optimized ARM64 release with development signature; APK v2/v3 verification passed; installed and launched on emulator. |
| `shenzhen-3d-0.1.0-android-arm64-unsigned.aab` | ARM64 Play bundle; requires production signing/release setup. |
| `shenzhen-3d-0.1.0-ios-registered-devices.ipa` | Signed development IPA for the team's registered devices; archive strict signature verification passed. |
| `shenzhen-3d-0.1.0-ios-arm64-simulator.tar.gz` | ARM64 simulator app, preserving executable modes; installed and tested on iOS 26.5. |

Final iOS checks confirmed safe header/toolbar/footer layout, point selections without activating the panel beneath the tap, and the sample STEP opening through Files. `artifacts/native-ios-measurement.png` and `artifacts/native-ios-step.png` record those final checks. `artifacts/native-android-launch.png` records the final Android startup layout. Android touch interaction and physical iOS-device runtime behavior remain unverified.

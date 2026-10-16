# Private Mac update packaging

The Chromium Mac app uses `electron-updater` 6.8.9. The packaged feed is fixed to GitHub repository **casimir-engineering/shenzhen-3D**, stable channel `latest`, with `private: true`. The Mirror repository is a distribution mirror; copying assets there does not change the installed app's primary feed.

## Build artifacts without publishing

Run `npm ci`, then `npm run package:electron:mac`. The packaging script always runs a fresh production frontend build before creating its isolated staging directory. It invokes electron-builder with **`--publish never`**, even when publishing credentials or a Git tag are present. Publishing is a separate operator action.

For version `<version>`, the timestamped output directory under `artifacts/electron/` contains:

- `Shenzhen-3D-<version>-Apple-Silicon.dmg`, for installation.
- `Shenzhen-3D-<version>-Apple-Silicon.zip`, required by the Mac updater.
- `latest-mac.yml`, generated from those exact artifact bytes.
- Any builder-generated blockmap sidecars, retained with the corresponding artifacts.
- `build-info.json`, recording source revision/dirty state, frontend SHA-256 hashes, production CJS hashes, the root lock hash, updater dependency versions/integrities and final artifact hashes.

The `.app` includes its original build provenance and `Contents/Resources/app-update.yml`. The latter contains `provider: github`, `owner: casimir-engineering`, `repo: shenzhen-3D`, `private: true`, `channel: latest`, and the builder's updater cache directory. It must contain **no token**.

The generated `latest-mac.yml` contains the application `version`, `releaseDate`, and `files` entries identifying the ZIP and DMG by filename, base64 SHA-512 and size where supplied by the target. Its compatibility `path` and top-level `sha512` identify the ZIP. The packaging script verifies those hashes and names against the files on disk. Preserve the generated YAML; renaming an artifact or recreating its ZIP changes the feed's fingerprint.

The app must remain signed with the expected Developer ID identity for Mac update verification. Current notarization configuration is unchanged. A successful local package build does not establish that private GitHub access, an actual version upgrade or notarization has been tested.

## Runtime dependency staging

Frontend dependencies are already bundled into `dist/`. The staged main-process manifest declares only the exactly pinned `electron-updater` dependency. The staging script includes production `electron/**/*.cjs` helpers, excluding test/spec files and test directories, so preload and updater helpers accompany `main.cjs`.

A staging-only `node_modules` symlink points to the root installation produced by `npm ci`. A matching thin lock contains the updater's resolved production dependency closure, including nested versions. Every resolved package must remain inside that root installation and match its root lock entry. electron-builder's normal production dependency collector copies the actual files into ASAR; the final app does not depend on the staging symlink or the developer's workspace. The build script checks that every locked updater dependency and production helper is present in the completed ASAR.

Verification performed for electron-builder 26.15.3: its npm collector resolved **16 updater runtime packages** from the symlinked staging directory, including `electron-updater` 6.8.9, without pulling in Three, React, Vite, Electron or electron-builder as app dependencies. `node electron/package-mac.mjs --stage-only` rebuilds the frontend and records the staging manifest/provenance without signing or creating installers. A signed DMG/ZIP package and real update installation must be checked separately after the app is frozen.

## Publish a complete release

1. Freeze and commit the intended source; build the DMG and ZIP together. Inspect `build-info.json`, the app signature, packaged updater feed and generated `latest-mac.yml`. Run the native app smoke before publishing.
2. Create a version-tagged GitHub release with a strictly newer app version. Upload the unmodified DMG, ZIP, `latest-mac.yml`, relevant blockmaps and provenance. Keep a draft until the complete asset set is present and verified.
3. Publish the release as a stable release when it is ready. Draft releases are not the stable update feed. Mirror the same artifact and YAML bytes to **mirror-org/shenzhen-3D**; verify hashes rather than rebuilding a second ZIP for the mirror.
4. Test an authorized recipient on an older installed version: check, download, verify and install the update. Also test missing/expired credentials, an unavailable feed and cancellation using the app's raster/model workflow as appropriate.

Do not substitute a Tauri DMG, web ZIP, generic source archive or version-tag source ZIP for the updater ZIP. The updater artifact is electron-builder's ZIP containing the signed Chromium `.app`.

## Authentication

In Shenzhen 3D, open **Updates** in the footer or **Shenzhen 3D → Check for Updates…**. Choose the team's repository, then connect using an existing GitHub CLI login or a read-only repository token. The app verifies repository access before saving the token with Electron safeStorage encryption in a mode-0600 settings file. Credentials stay in the main process and are never returned to the viewer. Switching repository disconnects the previous credential; connect again for the new repository.

Automatic checks are delayed until after the window opens and throttled to once per day. The updater module and its network stack stay off the first-paint path. Available updates are indicated in the footer. Download is explicit and runs in the background; installation requires **Restart & install** and a native reminder to save open projects. Closing the app normally does not install an update. Squirrel.Mac verifies the replacement app's code signature during installation; a downloaded ZIP alone is not proof that native signature verification has completed. Apps running from a disk image or translocated path must be moved to Applications before updating.

The current release stream uses preview releases, enabled by default. Turning previews off selects the latest stable GitHub release; until a stable release is published, that check may report that it cannot find an update feed. The web app continues to use its service worker; this updater applies to the packaged Chromium Mac app.

`private: true` selects private-feed behavior; it does not grant repository access. Shenzhen 3D explicitly supplies the connected recipient's token in the main process and refuses private-feed checks without one. It does not fall back to the library's unauthenticated public provider or bundle publisher credentials. Finder-launched apps normally do not inherit a terminal's environment, so the connection panel supplies authorized read access independently of shell environment variables.

A recipient credential needs permission to read releases/assets in the primary repository. Keep it in the main process and appropriate OS credential storage. Never put credentials in the frontend, `electron-builder.cjs`, staged package metadata, `app-update.yml`, `latest-mac.yml`, build provenance or release assets. Publisher credentials have a separate purpose and must never be distributed with the app. No build-time credential is required to generate the feed locally with `--publish never`.

Primary implementation references: [electron-builder update metadata generation](https://github.com/electron-userland/electron-builder/blob/master/packages/app-builder-lib/src/publish/updateInfoBuilder.ts), [updater provider selection](https://github.com/electron-userland/electron-builder/blob/master/packages/electron-updater/src/providerFactory.ts), and [private GitHub provider](https://github.com/electron-userland/electron-builder/blob/master/packages/electron-updater/src/providers/PrivateGitHubProvider.ts). The installed versions and root lock remain the authority for this build.

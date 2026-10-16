# Mac notarization and updater tests

These developer tools use existing Keychain and GitHub CLI credentials. They never accept a token or password argument. The `.mjs` files are not included in the packaged main-process runtime.

## Notarize a frozen package

First create a clean signed package with `npm run package:electron:mac`. Keep that timestamped output immutable. Create a separate output folder whose name includes `-notarized-`, under `artifacts/electron/`.

```sh
signed_output="$PWD/artifacts/electron/<signed-build>"
notarized_output="$PWD/artifacts/electron/<version>-notarized-<timestamp>"
notary_profile="<existing-keychain-profile>"
mkdir "$notarized_output"

xcrun notarytool submit "$signed_output/Shenzhen-3D-<version>-Apple-Silicon.zip" \
  --keychain-profile "$notary_profile" --output-format json --no-wait \
  --no-s3-acceleration
```

Save the returned submission ID. Use `notarytool info <id>` with the same profile to check status at reasonable intervals. After a transport failure, reconcile submission history/status before retrying: a registered ID can exist even when multipart upload failed. Keep raw transport diagnostics and unrelated team history out of release assets.

Once the ZIP submission is **Accepted**:

```sh
node electron/notarize-finalize.mjs \
  --original="$signed_output" --output="$notarized_output" \
  --profile="$notary_profile" --phase=package \
  --zip-submission="<accepted-zip-id>"
```

The helper verifies Apple's archive SHA-256, copies the signed app, staples and validates its ticket, checks its signature/Gatekeeper result, and runs electron-builder with `--prepackaged` and `--publish never`. The app is not re-signed. The existing Retina DMG artwork/configuration is retained. `mac.notarize: false` remains appropriate here because submissions are performed explicitly.

The new ZIP can be independently checked and frozen before DMG processing:

```sh
node electron/notarize-finalize.mjs \
  --original="$signed_output" --output="$notarized_output" \
  --profile="$notary_profile" --phase=verify-zip
```

Submit the newly created DMG using `notarytool submit` and the same nonblocking options. After its submission is **Accepted**:

```sh
node electron/notarize-finalize.mjs \
  --original="$signed_output" --output="$notarized_output" \
  --profile="$notary_profile" --phase=finalize \
  --dmg-submission="<accepted-dmg-id>"
```

Finalization staples the DMG, verifies signatures, tickets, Gatekeeper and disk-image integrity, regenerates external blockmaps and `latest-mac.yml` from final bytes, and records final artifact hashes in `build-info.json`. It extracts the ZIP and mounts the DMG read-only to validate both embedded apps. Original frontend/runtime/source provenance is retained; original signed artifact hashes are checked again. Completed output is immutable.

Apple's notarization log identifies the submitted archive **before** stapling/repacking. Distribution hashes identify the final ZIP and stapled DMG. Those digests are intentionally recorded separately. Apple documents stapling the app and recreating its ZIP because ZIP archives cannot themselves receive a stapled ticket. See [Apple's notarization workflow](https://developer.apple.com/documentation/security/customizing-the-notarization-workflow).

## Isolated native update installation

For an upgrade from a released app that already includes the updater, copy that signed app into a new fixture directory. Keep the original untouched:

```sh
fixture_run="$PWD/artifacts/updater-e2e/<new-fixture-run>"
mkdir -p "$fixture_run/fixture/mac-arm64"
ditto "$PWD/artifacts/releases-0.1.4/Shenzhen 3D.app" \
  "$fixture_run/fixture/mac-arm64/Shenzhen 3D.app"
```

The install report reads the fixture's signed build provenance. A released-app copy is identified separately from a synthetic version override.

`electron/prepare-update-fixture.mjs` reproduces the verified 0.1.4 test fixture: it copies frozen 0.1.4 staging, overrides only the copied package/lock/provenance to 0.1.3, and produces a signed `--dir --publish never` app with the same bundle ID. It does not change source versions or the released app.

```sh
node electron/prepare-update-fixture.mjs \
  --staging="$signed_output/staging" \
  --reference-app="$notarized_output/mac-arm64/Shenzhen 3D.app" \
  --run-dir="$PWD/artifacts/updater-e2e/<new-fixture-run>"
```

After the target ZIP and final feed are published, run:

```sh
node electron/update-install-smoke.mjs \
  --fixture="$PWD/artifacts/updater-e2e/<fixture-run>/fixture/mac-arm64/Shenzhen 3D.app" \
  --reference-app="$notarized_output/mac-arm64/Shenzhen 3D.app" \
  --zip="$notarized_output/Shenzhen-3D-<version>-Apple-Silicon.zip" \
  --output="$PWD/artifacts/updater-e2e/<new-install-run>" \
  --check-mirror
```

The script requires a real fixture path under `artifacts/updater-e2e/` with the expected bundle layout and a new output directory. It refuses an app in Applications, a released original, path escapes, other running Shenzhen 3D apps, and preexisting native updater cache/ShipIt state. It redirects the JavaScript cache into the test output and creates only temporary, owned native cache links. An explicit temporary profile prevents profile migration.

Checks cover packaged version/profile, existing CLI authorization encrypted in a mode-0600 settings file, both private feeds when `--check-mirror` is supplied, downloaded ZIP SHA-512, native Squirrel replacement, frozen target ASAR/signature/ticket/Gatekeeper, and new-version launch with the same temporary profile. Successful cleanup disconnects access, removes the isolated credential file and removes only test-owned native state. `result.json` records checks and cleanup status without credentials. If installation is still in progress after a failure, native state is retained for investigation rather than interrupted.

The test intercepts the app's confirmation response and disables `autoRunAppAfterInstall` only in the test process. Squirrel still downloads, verifies and replaces the signed bundle. The new version is launched manually with the explicit temporary profile, since Squirrel's [launch request](https://github.com/Squirrel/Squirrel.Mac/blob/main/Squirrel/SQRLShipItRequest.h) does not carry the original CLI arguments. This verifies replacement and launch; it does not verify automatic relaunch argument preservation or native dialog rendering.

## Recorded 0.1.4 result

On 16 October 2026, both private feeds offered 0.1.4 to the signed synthetic 0.1.3 fixture. Casimir's ZIP downloaded with the expected SHA-512; native Squirrel replaced the fixture, and the resulting signed/notarized 0.1.4 app launched with the same isolated profile. Its ASAR matched the frozen target. Credential/cache/job/preference cleanup was verified.

The fixture contains final updater code with an older package version. This is not evidence that the original 0.1.3 release, which lacked the updater, can self-update. The report is attached as `updater-install-report.json` to the [Casimir release](https://github.com/casimir-engineering/shenzhen-3D/releases/tag/preview-0.1.4). Apple's accepted ZIP/DMG submissions and final artifact fingerprints are recorded separately in the release provenance.

# Third-party components and distribution

Inventory date: 16 October 2026. Run `node scripts/license-audit.mjs` after `npm ci` to write `artifacts/third-party-inventory.json`, including exact installed production versions, available license files and SHA-256 hashes of the vendored CAD files. This inventory records engineering evidence; it is not legal clearance.

| Component | Local evidence | Role |
| --- | --- | --- |
| Vendored `occt-js` | `vendor/occt/REVISION`, `vendor/occt/LICENSE` | Active CAD WASM bridge, pinned revision `ad8ffb6007eb3fd25179232f291b626d6e78a195`. Bridge notice declares LGPL-2.1; underlying OCCT 7.9.3 uses LGPL-2.1 with an additional exception. |
| `@tx-code/occt-js` | Installed package metadata declares LGPL-2.1 | npm dependency; the application imports the pinned vendor files instead. |
| `@mlightcad/libredwg-web` 0.8.0 | Installed package metadata declares GPL-3.0 | DWG reader and deployed WASM runtime. [Upstream repository](https://github.com/mlightcad/libredwg-web). |
| Three.js | Installed MIT license | Scene rendering and mesh/XML loaders. |
| Draco decoder assets | Three.js `examples/jsm/libs/draco/README.md` identifies Apache-2.0 | glTF compressed-mesh decoding; copied into `public/draco`. [Upstream license](https://github.com/google/draco/blob/main/LICENSE). |
| Other npm dependencies | Generated inventory | React, DXF parsing, compression, BVH, Tauri frontend and UI icons; retain their applicable notices. |

The user has authorized private distribution to organizations. Access control does not eliminate license obligations. The GNU FAQ distinguishes copies used within one organization from copies transferred to other organizations or individuals; private customer delivery falls into the latter category. See the [GNU internal-distribution explanation](https://www.gnu.org/licenses/gpl-faq.en.html#InternalDistribution).

The GPL permits private, commercial and organizational use. When conveying GPL-covered object code, its corresponding-source and recipient-rights requirements apply. A private repository alone does not provide recipients with the required source rights or source delivery. Because the app imports LibreDWG into its frontend, the release plan must address the license of the combined work as well as the parser; a separate chunk or worker does not by itself establish a separate-program boundary. See [GPLv3 sections 5–6](https://www.gnu.org/licenses/gpl-3.0.html) and the [GNU explanation of combined programs](https://www.gnu.org/licenses/gpl-faq.en.html#GPLInProprietarySystem). The product's license remains an owner decision; the current `UNLICENSED` package metadata is not a GPL distribution plan.

For the CAD bridge, preserve copyright and license notices, supply the applicable LGPL texts and exception, and provide the exact corresponding library/bridge source, modifications and applicable replacement/relinking material. Packaging a WASM library does not remove these requirements. The LGPL permits combination under its stated conditions; read [LGPL-2.1 section 6](https://www.gnu.org/licenses/old-licenses/lgpl-2.1.html) and [OCCT licensing](https://dev.opencascade.org/resources/licenses) against the actual shipped binaries and build process.

The current tree is not a complete redistribution package: `vendor/occt/LICENSE` is only a short notice, the installed LibreDWG npm package includes no full license file, and `prepare-assets.mjs` copies binary assets without a notice/source bundle. Before conveying installers or browser assets outside the organization, prepare the chosen product license, full third-party license/exception texts, exact matching source and build/replacement instructions required by those licenses. Preserve recipients' license rights. Shipping source privately to recipients can satisfy a suitable source-delivery route; public publication is not automatically required by private delivery. Verify the selected route against the applicable license text.

Native bundles also contain Rust crates and platform dependencies. The npm inventory does not cover those, OS/SDK license terms, or final app-store distribution terms. A release inventory must include the actual shipped native dependencies and decoder assets.

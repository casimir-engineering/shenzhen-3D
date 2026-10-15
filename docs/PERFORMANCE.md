# Renderer performance on Apple M5 Max

The optimized renderer sustained approximately **120 render submissions and animation callbacks per second** in all five measured Chromium workloads, including 376,000 logical parts / 98.30 million logical triangles and 37,600 independently identified mesh geometries / 9.83 million triangles. These are observed browser scheduling/render-invocation rates, not direct measurements of physical display presentation.

Measurements were collected consecutively on this Mac: Apple M5 Max, 40 GPU cores, 64 GiB memory, macOS 26.5.1, Chromium 156.0.8078.4, ANGLE Metal (`Apple M5 Max`). Every case used a 1440×900 CSS viewport, DPR 2 and a **2880×1800 drawing buffer**. The idle browser schedule was approximately 120 Hz. Software rendering was rejected by the runner.

The comparison uses baseline application source `7937fa8` and optimized renderer source `515e088`. The JSON records the viewer SHA-256 as well as the Git revision; no application source changed during the measured orbit windows. Baseline and current source used the same installed Three.js and the same browser.

| Workload                                     | Logical parts | Logical triangles | Baseline render fps | Optimized render fps | Draw calls, before → after |
| -------------------------------------------- | ------------: | ----------------: | ------------------: | -------------------: | -------------------------: |
| Included sample STEP                            |             — |                 — |              120.00 |               120.01 |                 1,600 → 43 |
| Sample ×10                                      |        37,600 |         9,829,620 |              120.00 |               120.02 |                 1,600 → 42 |
| Sample ×50                                      |       188,000 |        49,148,100 |              120.01 |               120.01 |                 1,600 → 47 |
| Sample ×100                                     |       376,000 |        98,296,200 |              101.03 |               120.02 |                 1,600 → 51 |
| Sample ×10, separate geometry identity per part |        37,600 |         9,829,620 |                1.85 |               120.00 |               931,891 → 37 |

The last workload improved approximately 64.7×. Initial multi-draw batching reached about 77 fps there; merging eligible single-occurrence geometries into actual shared GPU draws removed the remaining draw-command overhead. Repeated geometry stays on hardware instancing.

| Workload                              | CPU render p95, before → after (ms) | GPU timer p95, before → after (ms) | Hover pick CPU p95, before → after (ms) |
| ------------------------------------- | ----------------------------------: | ---------------------------------: | --------------------------------------: |
| Included sample STEP                     |                         1.00 → 0.30 |                        1.40 → 1.22 |                             1.30 → 0.40 |
| Sample ×10                               |                         0.90 → 0.30 |                        4.70 → 4.02 |                             8.70 → 0.30 |
| Sample ×50                               |                         1.00 → 0.30 |                        5.38 → 5.18 |                            44.40 → 0.30 |
| Sample ×100                              |                         1.00 → 0.30 |                       10.46 → 6.92 |                            92.40 → 0.30 |
| Sample ×10, separate geometry identities |                       559.10 → 0.30 |                       47.99 → 4.15 |                             5.50 → 0.40 |

Optimized Chromium render intervals had p50 8.30 ms and p95 9.20 ms in every case. No optimized measured interval exceeded 12.5 ms. Each orbit ran for eight seconds after a two-second warm-up; sample counts and maxima are retained in the JSON. This establishes the measured target for these scenes and this machine, rather than an unlimited model-size guarantee.

## Detail, picking and workload scope

Navigation LOD is index-only and runs in a worker. Original coordinates, topology, source triangle indices and measurement geometry remain intact. Material boundaries are locked during simplification; normals, UVs and vertex colors participate in the simplifier's error metric. Its relative error limit is 0.002. At draw time, the estimated error must project to at most 0.75 physical pixel using conservative nearest-batch depth and transform-scale bounds. This is meshoptimizer's reported metric, not a formal Hausdorff-distance guarantee. Full detail returns after navigation stops, and the user can select full detail throughout.

The ×10, ×50 and ×100 navigation runs actually submitted **8,673,700**, **43,209,300** and **86,368,600** triangles per frame, respectively. The 98.30 million figure describes the complete logical model; it is not a claim that all original triangles were submitted during the 120 fps orbit. The single sample-assembly and separate-geometry workload submitted all of their triangles. Drawing-buffer resolution remained constant throughout.

The source STEP is `fixtures/sample-assembly.step`, imported at balanced quality. Replicated assemblies are translated into a grid. The separate-geometry case assigns each part its own geometry identity while cloning the same source mesh content; it stresses many mesh objects and material groups but is not a genuinely heterogeneous assembly with 37,600 different shapes.

Picking uses original geometry. Hover requests are coalesced to an animation callback: CPU pick work is much smaller, while pointer-dispatch-to-pick completion p95 is approximately 9.2–9.4 ms, including that scheduled delay. The test sends sixty projected part centers and sixty viewport-grid positions, so it includes hits and misses. It measures programmatic event delivery rather than operating-system input latency.

CPU renderer time wraps `WebGLRenderer.render`; whole `Viewer.draw` and GPU-query-poll CPU times are recorded separately. GPU time uses asynchronous `EXT_disjoint_timer_query_webgl2` queries, with disjoint samples discarded. CPU and GPU work overlap and must not be summed. The renderer harness excludes React and other application UI work; import and model setup are reported separately.

## Browser, native WebKit and Electron

A standalone probe using **the installed macOS system WKWebView** reported Apple GPU / WebGL 2 and approximately **60.30 Hz idle rAF** at the same viewport and DPR. It supported multi-draw but did not expose GPU timer queries. This is the operating-system WebKit engine, not Playwright's patched WebKit, and the probe is not the Tauri release app. An eight-second **active sample-assembly orbit** also stayed near 60 Hz: 59.74 render invocations/s, p95 interval 17 ms, maximum 33 ms, full triangle count. CPU renderer p95 was 1 ms; GPU elapsed time was unavailable. Its active and idle schedules are separate evidence from Chromium's 120 Hz results.

The **actual Electron desktop shell** was also measured through `electron/main.cjs` and its development-only benchmark URL, using Electron 44.7.2 / Chromium 152.0.7977.149 with its normal default Metal backend. The real content area was 1440×900 at the display's DPR 2. Renderer and shell source hashes and Git revision `45d1343` are recorded. This measures the actual desktop runtime with the isolated viewer harness; it does not include the production React UI or constitute a packaged-release presentation test.

| Actual Electron workload              | Observed render fps | Render interval p95 (ms) | CPU render p95 (ms) | GPU timer p95 (ms) |
| ------------------------------------- | ------------------: | -----------------------: | ------------------: | -----------------: |
| Included sample STEP                     |              120.01 |                     8.90 |                0.30 |               1.11 |
| Sample ×100                              |              120.00 |                     8.80 |                0.30 |               8.32 |
| Sample ×10, separate geometry identities |              120.00 |                     9.30 |                0.30 |               4.03 |

The separate-geometry Electron run had one 24.3 ms render-invocation interval outlier; its average remained 120 fps and p95 was 9.3 ms. These results establish the measured 120 fps target, rather than a zero-jitter guarantee. Actual navigation triangle totals match the Chromium runs above.

## Reproduction and evidence

Start `npm run dev`, then run:

```sh
node scripts/perf/browser-benchmark.mjs --baseline --output=artifacts/perf/baseline-paired.json
node scripts/perf/browser-benchmark.mjs --output=artifacts/perf/current-paired.json
```

For the actual desktop shell, run `node scripts/perf/electron-benchmark.mjs` after installing dependencies. Leave the measured window visible and avoid other GPU or heavy CPU work. See [the benchmark protocol](../tests/perf/README.md) for scene construction, instrumentation, adjustable durations, resolution checks and timer-free diagnostics. Functional GPU checks additionally compare original and optimized render pixels and verify picking, clipping, hiding, explode, textures, normals, edges and idle detail restoration; those checks do not substitute for hardware timing.

Durable raw measurements:

- [Original renderer](../tests/perf/results/apple-m5-max-baseline.json)
- [Optimized Chromium renderer](../tests/perf/results/apple-m5-max-chromium.json)
- [Actual Electron desktop runtime](../tests/perf/results/apple-m5-max-electron.json)
- [Standalone system WKWebView capabilities and idle cadence](../tests/perf/results/apple-m5-max-system-webkit-info.json)
- [Standalone system WKWebView active sample-assembly orbit](../tests/perf/results/apple-m5-max-system-webkit-active.json)

The WKWebView probe is reproducible without changing production code:

```sh
mkdir -p artifacts/perf
swiftc scripts/perf/native-webkit-benchmark.swift -o artifacts/perf/native-webkit-benchmark
artifacts/perf/native-webkit-benchmark
```

Set `PERF_CASES=1,100` to measure model scenarios in the standalone WebKit probe; the default captures capabilities and idle callback cadence only.

# Validation evidence

Initial geometry validation: 16 October 2026. Commands run locally with Node 26 and the repository's pinned Open Cascade WASM kernel. These checks validate the geometry engine; they do not certify native packaging, GPU frame rate or every vendor's format variant.

## Reproducible checks

- `npm test`: 38 checks across five suites covering unit conversions, signed X/Y/Z distance components, three-point angles, surface routes, drawing imports, mesh formats and connected planar mesh features.
- `npm run test:cad`: generated solids with known dimensions plus the sample STEP assembly; writes `artifacts/cad-validation.json`.
- `npm run benchmark -- fixtures/sample-assembly.step`: cold kernel startup and import timing, compact assembly and memory statistics; writes `artifacts/step-benchmark.json`. An optional STEP path can replace the fixture.

## Exact CAD kernel: 12 checks passed

A generated 10 × 20 × 30 mm box verifies edge lengths, 200 mm² cap area, 30 mm parallel-face minimum distance and thickness, and perpendicular face angle. A generated radius-5 mm cylinder verifies 10 mm diameter, quarter-circle arc lengths and 25π mm² cap area. Pair distance checks cover translated faces and rotated/translated vertex occurrences. Lifecycle checks cover retain, release, invalid IDs, rejection after release and zero remaining live models.

**Kernel angle results are radians.** The application must convert them to degrees for display. Generated-model dimensions and analytic exact measurements agree within 1e-7 in native units.

The STEP assembly regression verifies all triangle-to-face IDs, valid exact geometry bindings and positive exact areas on a representative face of every unique geometry.

## Sample assembly

Fixture: `fixtures/sample-assembly.step`.

| Property | Observed |
| --- | ---: |
| Declared unit | MM |
| Invalid transforms | 0 |

The first compact benchmark measured 20 ms WASM startup and 2,314 ms STEP import. The later regression run measured 3,234 ms import while other build work was running. These are local observations, not platform-wide latency guarantees. Buffer bytes count positions, normals, triangle indices and face maps; they exclude edges, object overhead, exact kernel memory and GPU allocations.

Bounds are computed by multiplying ancestor and occurrence transforms, then transforming actual mesh vertices. Dimensions are checked to 0.001 mm. The difference between mesh occurrences and part nodes is expected: one part can reference several geometries.

## Surface routes

Six automated cases pass: actual interior picked-point anchors; direct same-triangle segments; seam welding across unindexed triangles; indexed geometry with triangle discovery; disconnected surfaces including tiny gaps; invalid/off-surface inputs; and cache invalidation after position updates (some checks share a test case).

The route uses A* with a binary heap on welded triangle edges, plus segments from the actual picked anchors to their containing triangle's vertices. It is explicitly **an approximation**, and can overestimate the continuous geodesic on a coarse mesh. Distinct coordinates are not welded across gaps. Coincident vertices are shared, so geometrically touching surfaces in one mesh are connected. Coordinates are local to the selected geometry; callers must transform the result to the occurrence's world placement. Separate disconnected surfaces return no route.

## Integration evidence

See [browser and touch interaction results](E2E_VALIDATION.md), [supported-format fixtures](FORMAT_VALIDATION.md), and [native build/run evidence](PLATFORMS.md). The browser suite opens the actual STEP fixture, measures CAD faces, exercises units, saves/exports measurements, and tests the offline web cache. Platform evidence distinguishes compiled packages from actual runtime checks. A passing kernel regression alone is not an end-to-end platform test.

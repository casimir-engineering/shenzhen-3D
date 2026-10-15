# Shenzhen 3D implementation plan

Started 2026-10-16 (Asia/Shanghai). Requested delivery window: under nine hours.

## Product
A local-first engineering viewer for inspecting supplied parts, checking fit, and communicating dimensions. The model dominates the screen. A compact assembly tree sits left; a measurement inspector sits right. On touch devices, panels become sheets. File content stays on the device.

## Milestones and verification gates
1. Foundation: private mirrored repositories, reproducible dependencies, CAD worker, STEP assembly benchmark. Verify a sample STEP assembly imports with topology, colors, transforms, and units.
2. Viewer: GPU rendering, BVH selection, camera presets, orthographic/perspective, trackpad/mouse/touch controls, assembly visibility/isolation, section plane, exploded view, transparency. Verify browser desktop/mobile layouts and real rendered geometry.
3. Measurement: point snapping, signed XYZ deltas and straight-line minimum distance, face/edge selection, CAD feature metrics and exact minimum distance where the kernel supports it, mesh approximations clearly identified, angles, surface paths, unit override, saved/exported measurements. Test against analytic fixtures and the sample STEP model.
4. Formats: STEP/STP, IGES/IGS, BREP, STL, OBJ/MTL, GLTF/GLB, 3MF, PLY, OFF, FBX, DAE, KiCad WRL/VRML, DXF, SVG, DWG. Preserve colors/materials/textures as provided. Report format/entity limitations rather than silently claiming full fidelity.
5. Applications: web/PWA, Tauri macOS/Windows/Linux/Android/iOS. Run platform builds locally where supported and CI on host-specific runners. Distinguish a configured build from a tested binary. Signing/store distribution is separate from compilation.
6. Final acceptance: import regression suite, measurement tests, browser interactions, performance report, application builds, documentation and private repository sync.

Commit each verified milestone. Keep evidence and unresolved gaps in docs/VALIDATION.md.

## Performance design
Worker-isolated CAD and DWG parsing; transferable typed buffers; shared instance geometry; lazy-loaded format engines; BVH raycasting; render on demand; bounded device pixel ratio; cancelable import; explicit geometry/material/worker disposal. Benchmark cold and warm imports; do not make universal speed claims from one fixture.

## Measurement contract
Coordinates have a known internal unit, independently converted to display units. Source overrides rescale all length/area/volume results consistently. Point-to-point defaults to ΔX, ΔY, ΔZ and Euclidean shortest distance. Feature minimum distance is distinct from a surface-constrained path. Mesh and tessellated curve results must be labeled approximate. Measurements reference original model coordinates and must not change with explode display offsets.

## Design brief
Domain: datum planes, calipers, part trees, snapped vertices, cut faces, dimension witnesses.
Color world: graphite instrument housings, anodized aluminum, pale drafting paper, jade PCB soldermask, copper traces, restrained XYZ axis colors.
Signature: a four-component measurement readout paired with A/B picks and dimension witnesses directly on the model.
Avoid generic dashboard cards, oversized empty hero pages, and a wall of unexplained CAD icons. Use a dominant viewport, compact labeled tool groups, contextual feature properties, and progressive disclosure.
Intent: an engineer checks a supplier model before fabrication; precise, calm, discoverable.
Hierarchy: geometry first, active dimension second, tools third.
Palette/depth: cool graphite neutrals and jade selection, fine separators, quiet surface shifts.
Typography: native system UI for platform legibility; tabular monospace values for measurements; 12/14/17/24 px scale.
Spacing: 4 px base, 12–16 px panel padding; compact desktop controls, 44 px touch targets.

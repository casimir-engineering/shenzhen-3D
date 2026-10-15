# Rendering and progressive ray tracing

Raster modes include shaded surfaces, shaded surfaces with crease edges, triangle wireframe and hidden-line drawing. Wireframe and hidden-line modes first render depth-only surfaces, then draw visible edges with normal depth testing and occluded edges with reversed depth testing and a screen-space dash pattern. Edge buffers are cached and instance transforms remain shared. Section clipping, hidden parts and explode transforms apply to both edge passes. They do not change the original topology used by measurements.

The directional light moves by azimuth and elevation around the model; its intensity is adjustable. An optional uniform ambient fill has its own intensity control. These controls change presentation without changing measurements. The original default shaded pixels, material groups, colors, textures, transparency, nonuniform normals, clipping, hidden parts and exploded parts retain exact source-versus-batched parity in the headed Metal shader check.

Style checks: `node tests/render-styles-browser.mjs`, `node scripts/perf/check-viewer-correctness.mjs`, and `npx vitest run tests/render-styles.test.ts`. Shader correctness checks using software rendering are not performance evidence.

## Progressive GPU ray tracing

The optional ray-tracing mode uses the WebGPU compute backend of `three-gpu-pathtracer` **0.0.27**, pinned with Three.js **0.186.1** and `three-mesh-bvh` **0.9.16**. It traces rays against a two-level BVH and accumulates actual per-pixel samples. It is a still-view renderer; the measured 120 Hz navigation figures in [PERFORMANCE.md](PERFORMANCE.md) apply to raster rendering.

A dedicated module worker owns its WebGPU renderer, OffscreenCanvas, scene, acceleration structures and GPU resources. Preparation copies each distinct geometry and its material bindings once, then copies instance transforms instead of expanding assembly triangles. The original geometry, topology, textures, camera and picking objects remain available to the raster viewer. BVH construction and shader compilation run in the worker. Cancellation terminates that worker, including pending preparation, and removes its canvas. Enabling this feature is the first action that creates a worker or WebGPU context.

Camera movement immediately hides and pauses the traced view. After 180 ms without movement, accumulation restarts with a private camera. The target is 32, 128 or 512 samples per pixel at half or full drawing-buffer resolution. Progress comes from the backend's GPU sample counters; no time-based sample count is synthesized. The canvas accepts no pointer events. Measurement and selection overlays are composited above it by the viewer. PNG export reads the accumulated GPU render target and removes WebGPU's 256-byte row padding.

## Capability and resource limits

WebGPU with compute support and worker OffscreenCanvas is required. There is no WebGL substitute labeled ray tracing. Unsupported APIs, material features, GPU storage limits, preparation failures or device loss leave raster rendering available and report a reason.

The preflight currently permits up to 400,000 instances, 128 MiB of estimated unique geometry/BVH storage, 2,048 distinct serialized materials, 64 textures and 64 MiB of estimated texture storage. Textures are limited to 4,096 pixels per side. A frame is limited to 6 million pixels. The combined working estimate must remain below 512 MiB: scene storage, 64 bytes per pixel for accumulation/output/readback, and a 64 MiB wavefront working reserve. Compute dispatches are capped at 65,536 path slots. The worker also checks the device's storage-buffer binding limits before constructing its private scene. These are conservative eligibility estimates, **not a measured bound on total browser/process peak memory**; drivers and compilation allocate additional resources. A large resolution may require half resolution even when the model itself qualifies.

Standard and physical materials preserve diffuse/vertex/instance colors, supported image and data textures, roughness, metalness, opacity, alpha cutouts and physical transmission settings. Raster and traced images can differ because their lighting and transparency algorithms differ. The current backend uses four surface bounces and eight alpha-transparency crossings. Custom shaders, section clipping, animated/morphed/skinned meshes, partial draw ranges and compressed/video/cube material textures are explicitly unavailable. Single-material meshes ignore face material groups as Three's raster renderer does; multi-material groups retain their bindings and are compacted by material for the BVH. No model simplification is applied to traced geometry.

## Reproduce the hardware checks

Start `npm run dev -- --host 127.0.0.1`, then run:

```sh
node scripts/perf/check-ray-tracing.mjs
node scripts/perf/check-ray-tracing.mjs --sample
npx vitest run tests/ray-tracing-scene.test.ts tests/progressive-ray-tracer.test.ts
```

The headed Chromium probe requires a nonfallback WebGPU adapter. It checks 32-sample convergence, nonuniform visible PNG pixels, source immutability, immediate navigation pause and subsequent convergence. Its material fixture includes textured, colored instances and a transparent physical material. The sample STEP fixture shares geometry across its repeated instances. It converged at **480 × 300 / 32 samples** on the Apple Metal WebGPU adapter with zero shader-validation errors. The full-assembly export is not a detailed material-quality assessment. The hardware sample-assembly record is [ray-tracing-sample.json](../tests/perf/results/ray-tracing-sample.json). Each probe writes its JSON and PNG captures in ignored `artifacts/perf/`.

The unit checks cover geometry sharing, budgets, copied material texture transforms, unchanged raster data, hidden/singular transforms, unsupported features, camera isolation, nonaligned readback rows, worker lifetime, external cancellation after preparation, navigation idle timing and GPU-error export rejection. Software rendering is not used as hardware evidence.

Upstream references: [WebGPUPathTracer API](https://gkjohnson.github.io/tools/docs/three-gpu-pathtracer/webgpu/WebGPUPathTracer/), [project source and license](https://github.com/gkjohnson/three-gpu-pathtracer), [Three WebGPURenderer](https://threejs.org/docs/pages/WebGPURenderer.html), and [Three OffscreenCanvas workers](https://threejs.org/manual/pages/offscreencanvas.html).

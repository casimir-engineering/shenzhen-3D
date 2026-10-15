/// <reference lib="webworker" />
// Upstream ESM loader has a sibling declaration with the same factory contract.
// @ts-expect-error generated Emscripten module
import OcctFactory from "../../vendor/occt/occt-js.mjs";
import wasmUrl from "../../vendor/occt/occt-js.wasm?url";
import type {
  OcctJSModule,
  OcctJSMatrix4,
  OcctJSExactElementKind,
} from "../../vendor/occt/occt-js";
import type { Pick } from "../core/types";
let kernel: Promise<OcctJSModule> | undefined;
const getKernel = (): Promise<OcctJSModule> =>
  (kernel ||= OcctFactory({ locateFile: () => wasmUrl }));
self.onmessage = async ({ data }) => {
  const { id, action, payload } = data;
  try {
    const k = await getKernel();
    let result: unknown;
    if (action === "open") {
      const start = performance.now();
      result = k.OpenExactModel(
        payload.format,
        new Uint8Array(payload.buffer),
        {
          linearUnit: "millimeter",
          linearDeflectionType: "absolute_value",
          linearDeflection:
            payload.quality === "fine"
              ? 0.01
              : payload.quality === "fast"
                ? 0.2
                : 0.05,
          angularDeflection: 0.3,
          colorMode: "source",
          readNames: true,
          rootMode: "multiple-shapes",
        },
      );
      const r =
        result as import("../../vendor/occt/occt-js").OcctJSExactOpenResult;
      if (!r.success)
        throw new Error(r.error || "The CAD file could not be read.");
      self.postMessage({ id, result, importMs: performance.now() - start });
      return;
    }
    if (action === "release") result = k.ReleaseExactModel(payload.modelId);
    if (action === "properties") {
      const p = payload.pick as Pick;
      const args = [
        payload.modelId,
        p.exactHandle!,
        p.kind as OcctJSExactElementKind,
        p.elementId!,
      ] as const;
      const family = k.GetExactGeometryType(...args),
        radius = k.MeasureExactRadius(...args),
        center = k.MeasureExactCenter(...args);
      const length = k.MeasureExactEdgeLength(...args),
        area = k.MeasureExactFaceArea(...args);
      result = {
        exact: true,
        ...(family.ok ? { family: family.family } : {}),
        ...(radius.ok
          ? { radius: radius.radius, diameter: radius.diameter }
          : {}),
        ...(length.ok ? { length: length.value } : {}),
        ...(area.ok ? { area: area.value } : {}),
        ...(center.ok
          ? { center: center.localCenter }
          : area.ok
            ? { center: area.localCentroid }
            : length.ok
              ? {
                  center: length.localStartPoint.map(
                    (v, i) => (v + length.localEndPoint[i]) / 2,
                  ),
                }
              : {}),
      };
    }
    if (action === "pair") {
      const a = payload.a as Pick,
        b = payload.b as Pick;
      const args = [
        payload.modelId,
        a.exactHandle!,
        a.kind as OcctJSExactElementKind,
        a.elementId!,
        b.exactHandle!,
        b.kind as OcctJSExactElementKind,
        b.elementId!,
        a.matrix as OcctJSMatrix4,
        b.matrix as OcctJSMatrix4,
      ] as const;
      const angle = k.MeasureExactAngle(...args);
      if (angle.ok) angle.value = (angle.value * 180) / Math.PI;
      result = {
        distance: k.MeasureExactDistance(...args),
        angle,
        thickness: k.MeasureExactThickness(...args),
        relation: k.ClassifyExactRelation(...args),
      };
    }
    self.postMessage({ id, result });
  } catch (error) {
    self.postMessage({
      id,
      error: error instanceof Error ? error.message : String(error),
    });
  }
};

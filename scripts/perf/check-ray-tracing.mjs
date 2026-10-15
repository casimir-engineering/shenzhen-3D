import { chromium } from "@playwright/test";
import fs from "node:fs";
const browser = await chromium.launch({
  headless: false,
  args: ["--use-gl=angle", "--use-angle=metal"],
});
try {
  const page = await browser.newPage({ viewport: { width: 600, height: 500 } });
  let logs = 0;
  const errors = [];
  page.on("console", (m) => {
    if (
      /GPU.*(error|failed)|Shader.*(error|failed)|validation failed/i.test(
        m.text(),
      )
    )
      errors.push(m.text().slice(0, 1000));
    if (logs++ < 20) console.log(m.text().slice(0, 1000));
  });
  page.on("pageerror", (e) => {
    errors.push(e.message);
    console.error(e);
  });
  const model = process.argv.includes("--sample") ? "sample" : "materials";
  await page.goto(
    `http://127.0.0.1:1420/tests/perf/ray-tracing.html?model=${model}`,
  );
  await page.bringToFront();
  const hardware = await page.evaluate(async () => {
    const adapter = await navigator.gpu?.requestAdapter({
      powerPreference: "high-performance",
    });
    if (!adapter) return { unsupported: true };
    const info = adapter.info;
    return {
      vendor: info.vendor,
      architecture: info.architecture,
      device: info.device,
      description: info.description,
      isFallbackAdapter: info.isFallbackAdapter,
    };
  });
  if (
    hardware.unsupported ||
    hardware.isFallbackAdapter ||
    /swiftshader|llvmpipe|software/i.test(JSON.stringify(hardware))
  )
    throw new Error("Hardware WebGPU adapter required");
  console.log(JSON.stringify({ hardware }));
  await page.waitForFunction(
    () =>
      window.rtStates?.some((s) =>
        ["ready", "error", "unsupported"].includes(s.status),
      ),
    null,
    { timeout: 180000 },
  );
  const states = await page.evaluate(() => window.rtStates);
  console.log(JSON.stringify(states.at(-1)));
  if (states.at(-1).status !== "ready")
    throw new Error(
      states.at(-1).reason || "No converged GPU ray tracing result",
    );
  if (!(await page.evaluate(() => window.rtUnchanged())))
    throw new Error("Ray tracing changed original source geometry/camera");
  fs.mkdirSync("artifacts/perf", { recursive: true });
  await page.screenshot({ path: "artifacts/perf/ray-tracer-page.png" });
  const result = await page.evaluate(async () => {
    const blob = await window.rtSnapshot(),
      bitmap = await createImageBitmap(blob),
      canvas = new OffscreenCanvas(bitmap.width, bitmap.height),
      context = canvas.getContext("2d");
    context.drawImage(bitmap, 0, 0);
    const pixels = context.getImageData(0, 0, bitmap.width, bitmap.height).data,
      colors = new Set();
    for (let i = 0; i < pixels.length; i += 4)
      colors.add(`${pixels[i]},${pixels[i + 1]},${pixels[i + 2]}`);
    bitmap.close();
    return {
      bytes: Array.from(new Uint8Array(await blob.arrayBuffer())),
      colors: colors.size,
      stats: window.rtStats,
    };
  });
  if (result.colors < 20)
    throw new Error("GPU ray-traced image has insufficient visible variation");
  if (
    model === "sample" &&
    (result.stats.instances < 1 || result.stats.geometryCount < 1)
  )
    throw new Error("Sample assembly instancing was not preserved");
  const bytes = result.bytes;
  console.log(
    JSON.stringify({ model, colors: result.colors, scene: result.stats }),
  );
  fs.mkdirSync("artifacts/perf", { recursive: true });
  fs.writeFileSync(
    `artifacts/perf/ray-traced-${model}.png`,
    Buffer.from(bytes),
  );
  await page.screenshot({ path: "artifacts/perf/ray-tracer-page.png" });
  if ((await page.evaluate(() => window.rtPause())) !== "hidden")
    throw new Error("Navigation failed to reveal raster immediately");
  const previousStates = states.length;
  await page.evaluate(() => window.rtMove());
  await page.waitForFunction(
    (previous) =>
      window.rtStates.slice(previous).some((s) => s.status === "ready"),
    previousStates,
    { timeout: 180000 },
  );
  await page.evaluate(() => window.rtCancel());
  if (errors.length) throw new Error(errors.join("\n"));
  fs.writeFileSync(
    `artifacts/perf/ray-tracing-${model}.json`,
    JSON.stringify(
      {
        date: new Date().toISOString(),
        hardware,
        model,
        states,
        scene: result.stats,
        colors: result.colors,
        immutable: true,
        navigationPauseResume: true,
        pngReadback: true,
        shaderErrors: errors,
      },
      null,
      2,
    ) + "\n",
  );
  console.log(
    "GPU ray-tracing convergence, immutable source and PNG snapshot verified",
  );
} finally {
  await browser.close();
}

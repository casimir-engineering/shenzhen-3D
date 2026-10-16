import { _electron as electron, expect } from "@playwright/test";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
const directory = await fs.mkdtemp(
  path.join(os.tmpdir(), "shenzhen-recent-native-"),
);
const profile = path.join(directory, "profile");
const model = path.join(directory, "part.obj"),
  companion = path.join(directory, "paint.mtl");
await fs.writeFile(
  model,
  "mtllib paint.mtl\nv 0 0 0\nv 1 0 0\nv 0 1 0\nf 1 2 3\n",
);
await fs.writeFile(companion, "newmtl paint\nKd 1 0 0\n");
const env = { ...process.env };
delete env.SHENZHEN_3D_DEV_URL;
let application;
const launch = async (files = []) => {
  application = await electron.launch({
    args: [
      path.resolve("electron/main.cjs"),
      ...files,
      `--user-data-dir=${profile}`,
    ],
    env,
  });
  const page = await application.firstWindow();
  await application.evaluate(({ BrowserWindow }) =>
    BrowserWindow.getAllWindows().forEach((window) => window.hide()),
  );
  await page.waitForFunction(() =>
    Boolean(window.shenzhenRecentFiles && window.shenzhenFiles),
  );
  return page;
};
try {
  let page = await launch([model]);
  const cold = await page.evaluate(() => window.shenzhenFiles.takeOpen());
  expect(cold.map((batch) => batch.map((file) => file.name))).toEqual([
    ["part.obj"],
  ]);
  await page.evaluate(() => {
    const input = document.createElement("input");
    input.type = "file";
    input.multiple = true;
    input.id = "recent-native-fixture";
    document.body.appendChild(input);
  });
  await page
    .locator("#recent-native-fixture")
    .setInputFiles([model, companion]);
  const entry = await page.evaluate(() =>
    window.shenzhenRecentFiles.remember(
      [...document.querySelector("#recent-native-fixture").files],
      "part.obj",
      "obj",
    ),
  );
  expect(entry.storage).toBe("native");
  expect(entry.fileCount).toBe(2);
  const fake = await page.evaluate(async () =>
    window.shenzhenRecentFiles.remember(
      [new File(["fake"], "fake.step")],
      "fake.step",
      "step",
    ),
  );
  expect(fake).toBeNull();
  await application.close();
  application = undefined;
  page = await launch();
  const reopened = await page.evaluate(
    async (id) =>
      (await window.shenzhenRecentFiles.open(id)).map((file) => ({
        name: file.name,
        text: new TextDecoder().decode(file.bytes),
      })),
    entry.id,
  );
  expect(reopened.map((file) => file.name)).toEqual(["part.obj", "paint.mtl"]);
  expect(reopened[1].text).toContain("Kd 1 0 0");
  await application.evaluate(
    ({ app }, file) => app.emit("open-file", { preventDefault() {} }, file),
    model,
  );
  const warm = await page.evaluate(() => window.shenzhenFiles.takeOpen());
  expect(warm.map((batch) => batch.map((file) => file.name))).toEqual([
    ["part.obj"],
  ]);
  await fs.rm(companion);
  expect(
    await page.evaluate(async (id) => {
      try {
        await window.shenzhenRecentFiles.open(id);
        return false;
      } catch (error) {
        return /moved, removed/.test(error.message);
      }
    }, entry.id),
  ).toBe(true);
  console.log(
    JSON.stringify({
      passed: true,
      checks: [
        "cold OS file queue",
        "File-backed preload grant",
        "companions",
        "no synthetic File path",
        "isolated profile restart",
        "warm macOS file queue",
        "explicit missing-file failure",
      ],
    }),
  );
} finally {
  await application?.close();
  await fs.rm(directory, { recursive: true, force: true });
}

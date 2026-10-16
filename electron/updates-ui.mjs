import { _electron as electron, expect } from "@playwright/test";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
const directory = await fs.mkdtemp(
  path.join(os.tmpdir(), "shenzhen-updates-ui-"),
);
const environment = { ...process.env };
delete environment.SHENZHEN_3D_DEV_URL;
const application = await electron.launch({
  args: [path.resolve("electron/main.cjs"), `--user-data-dir=${directory}`],
  env: environment,
});
try {
  const page = await application.firstWindow();
  await expect(
    page.getByRole("button", { name: "Updates", exact: true }),
  ).toBeVisible();
  expect(await page.locator("canvas").count()).toBe(0);
  expect(
    await page.evaluate(() =>
      performance
        .getEntriesByType("resource")
        .some((item) => /UpdatesDialog/.test(item.name)),
    ),
  ).toBe(false);
  const blocked = await application.evaluate(({ ipcMain, BrowserWindow }) => {
    const handler = ipcMain._invokeHandlers.get("shenzhen-updates");
    const sender = BrowserWindow.getAllWindows()[0].webContents;
    const attempt = (event, method, value) => {
      try {
        handler(event, method, value);
        return false;
      } catch {
        return true;
      }
    };
    const remoteFrame = { url: "https://example.com/" };
    return [
      attempt(
        { sender, senderFrame: sender.mainFrame },
        "setFeedURL",
        "https://example.com/",
      ),
      attempt({ sender, senderFrame: { url: "app://local/" } }, "getState"),
      attempt(
        { sender: { mainFrame: remoteFrame }, senderFrame: remoteFrame },
        "getState",
      ),
      attempt({ sender, senderFrame: sender.mainFrame }, "configure", {
        feed: "https://example.com/",
      }),
      attempt({ sender, senderFrame: sender.mainFrame }, "connect", 42),
    ];
  });
  expect(blocked).toEqual([true, true, true, true, true]);
  await application.evaluate(({ ipcMain, BrowserWindow }) => {
    let state = {
      supported: true,
      version: "0.1.4",
      status: "idle",
      automatic: true,
      repository: "casimir-engineering",
      prereleases: true,
      connected: false,
      message: "Connect to receive private releases.",
    };
    const send = () => {
      for (const win of BrowserWindow.getAllWindows())
        win.webContents.send("shenzhen-update-state", state);
      return state;
    };
    ipcMain.removeHandler("shenzhen-updates");
    ipcMain.handle("shenzhen-updates", async (_event, method, value) => {
      if (method === "configure") Object.assign(state, value);
      if (method === "connect") {
        if (value !== "fixture-token") throw Error("invalid fixture");
        state.connected = true;
        state.message = "Connected to GitHub.";
      }
      if (method === "disconnect") {
        state.connected = false;
        state.status = "needs-auth";
      }
      if (method === "check") {
        state.status = state.connected ? "available" : "needs-auth";
        state.availableVersion = "0.1.5";
        state.lastChecked = Date.now();
        state.message = state.connected
          ? "A new version is ready to download."
          : "Connect a GitHub account first.";
      }
      if (method === "download") {
        state.status = "downloading";
        state.progress = 47;
        send();
        await new Promise((resolve) => setTimeout(resolve, 600));
        state.status = "ready";
        state.message =
          "The update is ready. Save your project before restarting.";
      }
      if (method === "install") {
        state.message = "Install confirmation canceled.";
      }
      return send();
    });
  });
  await application.evaluate(({ Menu }) =>
    Menu.getApplicationMenu()
      .items[0].submenu.items.find(
        (item) => item.label === "Check for Updates…",
      )
      .click(),
  );
  await expect(
    page.getByRole("dialog", { name: "Updates", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByLabel("Or use a read-only access token"),
  ).toBeVisible();
  await page
    .getByLabel("Or use a read-only access token")
    .fill("fixture-token");
  await page.getByRole("button", { name: "Connect securely" }).click();
  await page.getByText("GitHub access", { exact: false }).first().click();
  await expect(
    page.getByText("Access is stored securely on this Mac."),
  ).toBeVisible();
  await page.getByLabel("Release repository").selectOption("mirror-org");
  await expect(page.getByLabel("Release repository")).toHaveValue(
    "mirror-org",
  );
  await page.getByLabel("Check automatically").click();
  await expect(page.getByLabel("Check automatically")).not.toBeChecked();
  await page
    .getByRole("button", { name: "Check for updates", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Version 0.1.5 is available" }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Download update", exact: true })
    .click();
  await expect(
    page.getByRole("progressbar", { name: "Update download" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Restart & install" }),
  ).toBeVisible();
  await expect(page.getByLabel("Release repository")).toBeDisabled();
  await page.getByRole("button", { name: "Restart & install" }).click();
  await expect(page.getByText("Install confirmation canceled.")).toBeVisible();
  await fs.mkdir("artifacts/releases-0.1.4", { recursive: true });
  await page.screenshot({
    path: "artifacts/releases-0.1.4/updates-preview.png",
  });
  await page.keyboard.press("Escape");
  await expect(
    page.getByRole("dialog", { name: "Updates", exact: true }),
  ).not.toBeVisible();
  expect(await page.locator("canvas").count()).toBe(0);
  console.log(
    "PASS: lazy update UI, private access form, preferences, repository selection, availability, download progress, install state, Escape, renderer-free startup",
  );
} finally {
  await application.close();
  await fs.rm(directory, { recursive: true, force: true });
}

import { _electron as electron, expect } from '@playwright/test';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';

const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'shenzhen-electron-smoke-'));
const environment = { ...process.env };
delete environment.SHENZHEN_3D_DEV_URL;
const packaged = process.argv.find(argument => argument.startsWith('--executable='))?.slice(13);
const application = await electron.launch({ ...(packaged ? { executablePath: packaged } : {}), args: packaged ? [] : [path.resolve('electron/main.cjs')], env: environment });
const errors = [];
try {
  const page = await application.firstWindow();
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') { errors.push(message.text()); console.error(message.text()); } });
  await expect(page.locator('canvas')).toBeVisible();
  await page.bringToFront();
  await application.evaluate(({ app, BrowserWindow }) => { app.focus({ steal: true }); BrowserWindow.getAllWindows()[0].focus(); });
  console.log('Electron production app loaded');
  const preferences = await application.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].webContents.getLastWebPreferences());
  expect(preferences.sandbox).toBe(true);
  expect(preferences.contextIsolation).toBe(true);
  expect(preferences.nodeIntegration).toBe(false);
  expect(page.url()).toBe('app://local/');
  expect(await page.evaluate(() => typeof window.require)).toBe('undefined');
  const capability = await page.evaluate(async () => {
    const gl = document.querySelector('canvas').getContext('webgl2');
    const debug = gl.getExtension('WEBGL_debug_renderer_info');
    const frames = [];
    for (let i = 0; i < 120; i++) frames.push(await new Promise(resolve => requestAnimationFrame(resolve)));
    const intervals = frames.slice(1).map((time, i) => time - frames[i]).sort((a, b) => a - b);
    return { renderer: debug ? gl.getParameter(debug.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER), rafFps: (frames.length - 1) * 1000 / (frames.at(-1) - frames[0]), rafP50Ms: intervals[Math.floor(intervals.length / 2)] };
  });
  expect(capability.renderer).not.toMatch(/SwiftShader|llvmpipe/i);
  console.log('Hardware capability', capability);
  const chooserWait = page.waitForEvent('filechooser', { timeout: 20_000 });
  await application.evaluate(({ Menu }) => Menu.getApplicationMenu().items.find(item => item.label === 'File').submenu.items.find(item => item.label === 'Open…').click());
  await (await chooserWait).setFiles(path.resolve('fixtures/sample-assembly.step'));
  console.log('Native Open selected STEP');
  await Promise.race([
    expect(page.locator('.model-badge')).toContainText('CAD model', { timeout: 120_000 }),
    page.getByRole('alert').waitFor({ state: 'visible', timeout: 120_000 }).then(async () => { throw new Error(await page.getByRole('alert').innerText()); }),
  ]);
  await expect(page.getByRole('alert')).toHaveCount(0);
  console.log('STEP worker/WASM import complete');
  const png = path.join(directory, 'export.png');
  // Main-process test automation supplies the chosen path, pauses longer than
  // the frontend's 5s URL lifetime, then resumes the existing DownloadItem.
  // Production exposes no renderer IPC or automatic save destination.
  await application.evaluate(({ session }, target) => {
    session.defaultSession.once('will-download', (_event, item) => {
      item.setSavePath(target);
      item.pause();
      setTimeout(() => item.resume(), 6500);
    });
  }, png);
  await page.getByRole('button', { name: 'Save screenshot', exact: true }).click();
  await expect.poll(async () => fs.stat(png).then(stat => stat.size).catch(() => 0), { timeout: 30_000 }).toBeGreaterThan(1000);
  expect((await fs.readFile(png)).subarray(0, 8).toString('hex')).toBe('89504e470d0a1a0a');
  await page.evaluate(() => { window.open('https://example.com/'); });
  expect(await application.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows().length)).toBe(1);
  await page.evaluate(() => { location.href = 'https://example.com/'; });
  expect(page.url()).toBe('app://local/');
  expect(errors).toEqual([]);
  console.log(JSON.stringify({ ...capability, checks: ['sandbox', 'context isolation', 'local protocol', 'native Cmd+O STEP import', 'worker/WASM', 'PNG after delayed native download', 'remote navigation blocked', 'popups blocked', 'no application errors'] }, null, 2));
} finally {
  await application.close();
  await fs.rm(directory, { recursive: true, force: true });
}

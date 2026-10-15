import {test, expect, type Page, type Download} from '@playwright/test';
import {resolve} from 'node:path';

const fixture = resolve('fixtures/sample-assembly.step');

test.beforeEach(async ({page}) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => {if (message.type() === 'error') errors.push(message.text());});
  await page.goto('/');
  await expect(page.locator('canvas')).toBeVisible();
  (page as Page & {applicationErrors: string[]}).applicationErrors = errors;
});

test.afterEach(async ({page}, info) => {
  const errors = (page as Page & {applicationErrors: string[]}).applicationErrors || [];
  await info.attach('application-errors', {body: JSON.stringify(errors, null, 2), contentType: 'application/json'});
  expect(errors, 'No uncaught application or console errors').toEqual([]);
});

async function closeInspector(page: Page) {
  const close = page.getByRole('button', {name: 'Close measurements', exact: true});
  if (await close.isVisible()) await close.click();
}

async function showInspector(page: Page) {
  const open = page.getByRole('button', {name: 'Show measurements', exact: true});
  if (await open.isVisible()) await open.click();
  await expect(page.locator('.inspector')).toBeVisible();
}

// Sample actual rendered pixels, then verify a raycast through the UI hover status.
// This avoids assumptions about STEP placement, camera fit, tessellation or viewport size.
async function geometryLocations(page: Page) {
  await closeInspector(page);
  await page.getByTitle('Top · 2', {exact: true}).click();
  await page.getByRole('button', {name: 'Fit model', exact: true}).click();
  await page.evaluate(() => new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
  const locations = await page.locator('canvas').evaluate(canvas => {
    const gl = (canvas as HTMLCanvasElement).getContext('webgl2')!;
    const width = gl.drawingBufferWidth, height = gl.drawingBufferHeight;
    const pixels = new Uint8Array(width * height * 4);
    gl.readPixels(0, 0, width, height, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
    const rect = canvas.getBoundingClientRect();
    const points: {x: number; y: number}[] = [];
    // Bright model surfaces are well above both the graphite background and grid.
    for (let y = 65; y < rect.height - 85; y += 3) for (let x = 30; x < rect.width - 48; x += 3) {
      const px = Math.floor(x / rect.width * width), py = height - 1 - Math.floor(y / rect.height * height);
      const i = (py * width + px) * 4;
      if (pixels[i] > 75 && pixels[i + 1] > 75 && pixels[i + 2] > 75) points.push({x: rect.x + x, y: rect.y + y});
    }
    return points;
  });
  expect(locations.length, 'Model has visible rendered surfaces').toBeGreaterThan(10);
  const picks: {x: number; y: number}[] = [];
  // Pick separated regions along the longest screen axis, not neighbouring triangles.
  const xs = locations.map(p => p.x), ys = locations.map(p => p.y);
  const axis = Math.max(...xs) - Math.min(...xs) > Math.max(...ys) - Math.min(...ys) ? 'x' : 'y';
  locations.sort((a, b) => a[axis] - b[axis]);
  for (const fraction of [0.18, 0.8, 0.5]) {
    const middle = Math.floor(locations.length * fraction);
    for (let offset = 0; offset < 100; offset++) {
      const p = locations[Math.min(middle + offset, locations.length - 1)];
      await page.mouse.move(p.x, p.y);
      if ((await page.locator('.status-main').textContent())?.includes(' · ')) {picks.push(p); break;}
    }
  }
  expect(picks, 'Rendered locations raycast to model geometry').toHaveLength(3);
  return picks;
}

async function pickAt(page: Page, location: {x: number; y: number}, mobile: boolean) {
  await closeInspector(page);
  if (mobile) await page.touchscreen.tap(location.x, location.y);
  else await page.mouse.click(location.x, location.y);
}

async function downloadText(download: Download) {
  const stream = await download.createReadStream();
  expect(stream).toBeTruthy();
  const chunks: Buffer[] = [];
  for await (const chunk of stream!) chunks.push(Buffer.from(chunk));
  return Buffer.concat(chunks).toString('utf8');
}

test('STEP import, real surface picks, unit overrides, saved JSON/CSV and exact feature query', async ({page, isMobile}) => {
  await page.locator('input[type=file]').setInputFiles(fixture);
  await expect(page.locator('.model-badge')).toContainText('CAD model', {timeout: 120_000});
  await expect(page.getByRole('alert')).toHaveCount(0);
  const locations = await geometryLocations(page);
  await pickAt(page, locations[0], isMobile);
  await expect(page.locator('.point-row.filled')).toHaveCount(1);
  await pickAt(page, locations[1], isMobile);
  await expect(page.locator('.point-row.filled')).toHaveCount(2);
  const result = page.locator('.result-hero strong');
  await expect(result).toBeVisible();
  const millimeters = Number((await result.innerText()).replaceAll(',', ''));
  expect(millimeters).toBeGreaterThan(0);
  await expect(page.locator('.accuracy-tag')).toContainText(/Picked-point measurement|Exact CAD geometry/);
  await page.getByLabel('Display units', {exact: true}).selectOption('cm');
  await expect.poll(async () => Number((await result.innerText()).replaceAll(',', ''))).toBeCloseTo(millimeters / 10, 2);
  await page.getByLabel('Display units', {exact: true}).selectOption('mm');
  await page.locator('.units-details summary').click();
  await page.getByLabel('Source units', {exact: true}).selectOption('in');
  await page.getByLabel('Custom scale factor', {exact: true}).fill('2');
  await expect.poll(async () => Number((await result.innerText()).replaceAll(',', ''))).toBeCloseTo(millimeters * 50.8, 0);
  await page.getByRole('button', {name: 'Save measurement', exact: true}).click();
  await page.getByRole('button', {name: 'Saved 1', exact: true}).click();
  await expect(page.locator('.saved-measurement')).toHaveCount(1);
  const jsonWait = page.waitForEvent('download');
  await page.getByRole('button', {name: 'JSON', exact: true}).click();
  const report = JSON.parse(await downloadText(await jsonWait));
  expect(report).toMatchObject({file: 'sample-assembly.step', sourceUnit: 'in', customScale: 2, displayUnit: 'mm'});
  expect(report.measurements).toHaveLength(1);
  expect(report.measurements[0].displayDistance).toBeCloseTo(report.measurements[0].distance * 50.8, 8);
  const csvWait = page.waitForEvent('download');
  await page.getByRole('button', {name: 'CSV', exact: true}).click();
  const csv = await downloadText(await csvWait);
  expect(csv).toContain('"Distance (mm)"');
  expect(csv).toContain('"Distance 1"');
  expect(csv).toContain(String(report.measurements[0].displayDistance));
  await page.locator('.saved-measurement > button').first().click();
  await expect(page.locator('.point-row.filled')).toHaveCount(2);
  await page.getByTitle('Pick CAD features · E', {exact: true}).click();
  await expect(page.locator('.point-row.filled')).toHaveCount(0);
  await page.getByLabel('Feature selection filter').selectOption('face');
  await pickAt(page, locations[0], isMobile);
  await expect(page.locator('.feature-properties .subheading')).toContainText('Exact', {timeout: 60_000});
  await expect(page.locator('.feature-properties')).toContainText('Area');
  await expect(page.locator('.point-row small').first()).toContainText('CAD face');
  await pickAt(page, locations[1], isMobile);
  await expect(page.locator('.accuracy-tag')).toContainText('Exact CAD geometry', {timeout: 60_000});
  await expect(page.locator('.measurement-note')).toContainText('Exact minimum distance between CAD features');
  await page.getByRole('button', {name: 'Start a new measurement', exact: false}).click();
  await expect(page.locator('.point-row.filled')).toHaveCount(0);
});

test('sample assembly visibility, isolate, point angle, and saved deletion', async ({page, isMobile}) => {
  await page.getByRole('button', {name: 'Explore a sample model', exact: true}).click();
  await expect(page.locator('.model-badge')).toContainText('4 parts');
  const openAssembly = page.getByRole('button', {name: 'Show assembly', exact: true});
  if (await openAssembly.isVisible()) await openAssembly.click();
  await page.getByLabel('Search assembly', {exact: true}).fill('Base plate');
  await expect(page.getByRole('treeitem')).toHaveCount(1);
  await page.getByRole('button', {name: 'Hide Base plate · 80 × 56 × 6', exact: true}).click();
  await expect(page.getByRole('treeitem')).toHaveClass(/muted/);
  await page.getByRole('button', {name: 'Show Base plate · 80 × 56 × 6', exact: true}).click();
  await expect(page.getByRole('treeitem')).not.toHaveClass(/muted/);
  await page.getByRole('button', {name: 'Isolate Base plate · 80 × 56 × 6', exact: true}).click();
  await page.getByLabel('Search assembly', {exact: true}).fill('');
  await expect(page.locator('.tree-row.muted')).toHaveCount(3);
  await page.getByRole('button', {name: 'Show all', exact: true}).click();
  await expect(page.locator('.tree-row.muted')).toHaveCount(0);
  const closeAssembly = page.getByRole('button', {name: 'Close assembly', exact: true});
  if (await closeAssembly.isVisible()) await closeAssembly.click();
  const locations = await geometryLocations(page);
  await showInspector(page);
  await page.getByRole('button', {name: 'Angle', exact: true}).click();
  await pickAt(page, locations[0], isMobile);
  await pickAt(page, locations[1], isMobile);
  await pickAt(page, locations[2], isMobile);
  await expect(page.locator('.point-row.filled')).toHaveCount(3);
  await expect(page.locator('.result-hero')).toContainText('ANGLE');
  const angle = Number(await page.locator('.result-hero strong').innerText());
  expect(angle).toBeGreaterThan(0);
  expect(angle).toBeLessThan(180);
  await page.getByRole('button', {name: 'Save measurement', exact: true}).click();
  await page.getByRole('button', {name: 'Saved 1', exact: true}).click();
  await page.getByRole('button', {name: 'Delete measurement', exact: true}).click();
  await expect(page.locator('.saved-measurement')).toHaveCount(0);
  await expect(page.getByText('Keep the useful numbers.', {exact: true})).toBeVisible();
});

test('desktop section, orthographic projection, display tools and PNG export', async ({page, isMobile}) => {
  test.skip(isMobile, 'These controls are hidden by the mobile responsive toolbar.');
  await page.getByRole('button', {name: 'Explore a sample model', exact: true}).click();
  await expect(page.locator('.model-badge')).toContainText('4 parts');
  await page.getByRole('button', {name: 'Perspective', exact: true}).click();
  await expect(page.getByRole('button', {name: 'Orthographic', exact: true})).toBeVisible();
  await page.getByTitle('Top · 2', {exact: true}).click();
  await page.getByRole('button', {name: 'Show edges', exact: true}).click();
  await expect(page.getByRole('button', {name: 'Show edges', exact: true})).toHaveAttribute('aria-pressed', 'true');
  await page.getByRole('button', {name: 'Ground grid', exact: true}).click();
  await expect(page.getByRole('button', {name: 'Ground grid', exact: true})).toHaveAttribute('aria-pressed', 'false');
  await page.getByRole('button', {name: 'Section plane', exact: true}).click();
  await expect(page.getByLabel('Section position', {exact: true})).toBeVisible();
  await page.getByLabel('Section axis', {exact: true}).selectOption('x');
  await page.getByLabel('Section position', {exact: true}).fill('0.35');
  await expect(page.getByLabel('Section position', {exact: true})).toHaveValue('0.35');
  const pngWait = page.waitForEvent('download');
  await page.getByRole('button', {name: 'Save screenshot', exact: true}).click();
  const screenshot = await pngWait;
  expect(screenshot.suggestedFilename()).toMatch(/\.png$/);
  const stream = await screenshot.createReadStream();
  const chunks: Buffer[] = [];
  for await (const chunk of stream!) chunks.push(Buffer.from(chunk));
  const png = Buffer.concat(chunks);
  expect(png.subarray(0, 8).toString('hex')).toBe('89504e470d0a1a0a');
  expect(png.length).toBeGreaterThan(1000);
  await page.getByRole('button', {name: 'Close section', exact: true}).click();
  await expect(page.getByLabel('Section position', {exact: true})).toHaveCount(0);
  await page.getByRole('button', {name: 'Orthographic', exact: true}).click();
  await expect(page.getByRole('button', {name: 'Perspective', exact: true})).toBeVisible();
});

test('mobile view settings expose section, projection, opacity and assembly explode', async ({page, isMobile}) => {
  test.skip(!isMobile, 'Mobile toolbar uses the settings dialog for view controls.');
  await page.getByRole('button', {name: 'Explore a sample model', exact: true}).click();
  await page.getByRole('button', {name: 'Settings', exact: true}).click();
  const settings = page.getByRole('dialog');
  await settings.getByRole('button', {name: 'Orthographic', exact: true}).click();
  await expect(settings.getByRole('button', {name: 'Orthographic', exact: true})).toHaveClass('active');
  await page.getByLabel('Settings opacity', {exact: true}).fill('0.5');
  await expect(page.getByLabel('Settings opacity', {exact: true})).toHaveValue('0.5');
  await page.getByLabel('Settings explode', {exact: true}).fill('0.25');
  await expect(page.getByLabel('Settings explode', {exact: true})).toHaveValue('0.25');
  await settings.getByRole('button', {name: 'Section', exact: true}).click();
  await expect(settings).not.toBeVisible();
  await expect(page.getByLabel('Section axis', {exact: true})).toBeVisible();
  await page.getByLabel('Section axis', {exact: true}).selectOption('y');
  await page.getByLabel('Section position', {exact: true}).fill('0.25');
  await page.getByRole('button', {name: 'Close section', exact: true}).click();
  await expect(page.getByLabel('Section position', {exact: true})).toHaveCount(0);
});

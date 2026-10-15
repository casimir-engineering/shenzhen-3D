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
  // Capture the composited canvas: its WebGL drawing buffer is discarded after
  // presenting a frame when preserveDrawingBuffer is false.
  const screenshot = await page.locator('canvas').screenshot();
  const locations = await page.locator('canvas').evaluate(async (canvas, png) => {
    const image = new Image();
    image.src = `data:image/png;base64,${png}`;
    await image.decode();
    const width = image.naturalWidth, height = image.naturalHeight;
    const sampler = document.createElement('canvas');
    sampler.width = width;
    sampler.height = height;
    const context = sampler.getContext('2d')!;
    context.drawImage(image, 0, 0);
    const pixels = context.getImageData(0, 0, width, height).data;
    const rect = canvas.getBoundingClientRect();
    const points: {x: number; y: number}[] = [];
    // Bright model surfaces are well above both the graphite background and grid.
    for (let y = 65; y < rect.height - 85; y += 3) for (let x = 30; x < rect.width - 48; x += 3) {
      const px = Math.floor(x / rect.width * width), py = Math.floor(y / rect.height * height);
      const i = (py * width + px) * 4;
      if (pixels[i] > 75 && pixels[i + 1] > 75 && pixels[i + 2] > 75) points.push({x: rect.x + x, y: rect.y + y});
    }
    return points;
  }, screenshot.toString('base64'));
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
      // Hover picking runs once per animation frame; let its status commit.
      await page.evaluate(() => new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
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
  await page.getByLabel('Distance reference', {exact: true}).selectOption('center');
  await expect(page.locator('.point-row.filled')).toHaveCount(0);
  await pickAt(page, locations[0], isMobile);
  await pickAt(page, locations[1], isMobile);
  await expect(page.locator('.result-hero')).toContainText('CENTER DISTANCE', {timeout: 60_000});
  await expect(page.locator('.accuracy-tag')).toContainText('Exact CAD geometry');
  await expect(page.locator('.measurement-note')).toContainText('Distance between feature centers / centroids');
  const centerDistance = Number((await result.innerText()).replaceAll(',', ''));
  expect(Number.isFinite(centerDistance)).toBe(true);
  expect(centerDistance).toBeGreaterThan(0);
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
  await page.getByLabel('Explode assembly', {exact: true}).fill('0.25');
  await expect(page.getByLabel('Explode assembly', {exact: true})).toHaveValue('0.25');
  await page.getByRole('button', {name: 'Ground grid', exact: true}).click();
  await expect(page.getByRole('button', {name: 'Ground grid', exact: true})).toHaveAttribute('aria-pressed', 'false');
  await page.getByRole('button', {name: 'Section plane', exact: true}).click();
  await expect(page.getByLabel('Section position', {exact: true})).toBeVisible();
  await page.getByLabel('Section axis', {exact: true}).selectOption('x');
  await page.getByLabel('Section position', {exact: true}).fill('0.35');
  await expect(page.getByLabel('Section position', {exact: true})).toHaveValue('0.35');
  // Verify the instanced edge shader actually draws after explode + clipping,
  // rather than merely checking the toolbar toggle and console errors.
  await page.getByRole('button', {name: 'Show edges', exact: true}).click();
  const withoutEdges = await page.locator('canvas').screenshot();
  await page.getByRole('button', {name: 'Show edges', exact: true}).click();
  const withEdges = await page.locator('canvas').screenshot();
  const edgePixels = await page.evaluate(async ({before, after}) => {
    const readPixels = async (png: string) => {
      const image = new Image();
      image.src = `data:image/png;base64,${png}`;
      await image.decode();
      const canvas = document.createElement('canvas');
      canvas.width = image.naturalWidth;
      canvas.height = image.naturalHeight;
      const context = canvas.getContext('2d')!;
      context.drawImage(image, 0, 0);
      return context.getImageData(0, 0, canvas.width, canvas.height);
    };
    const a = await readPixels(before), b = await readPixels(after);
    let changed = 0, visible = 0;
    // Ignore controls along the canvas boundary and compare rendered content.
    for (let y = 80; y < a.height - 80; y++) for (let x = 20; x < a.width - 20; x++) {
      const i = (y * a.width + x) * 4;
      if (Math.max(Math.abs(a.data[i] - b.data[i]), Math.abs(a.data[i + 1] - b.data[i + 1]), Math.abs(a.data[i + 2] - b.data[i + 2])) > 12) changed++;
      if (b.data[i] > 75 && b.data[i + 1] > 75 && b.data[i + 2] > 75) visible++;
    }
    return {changed, visible};
  }, {before: withoutEdges.toString('base64'), after: withEdges.toString('base64')});
  expect(edgePixels.visible, 'Exploded section still renders model surfaces').toBeGreaterThan(20);
  expect(edgePixels.changed, 'Instanced edges add visible pixels to the exploded section').toBeGreaterThan(20);
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

test('mesh circular cap reports approximate diameter and coplanar area', async ({page, isMobile}) => {
  await page.getByRole('button', {name: 'Explore a sample model', exact: true}).click();
  const openAssembly = page.getByRole('button', {name: 'Show assembly', exact: true});
  if (await openAssembly.isVisible()) await openAssembly.click();
  await page.getByLabel('Search assembly', {exact: true}).fill('Fastener');
  await expect(page.getByRole('treeitem')).toHaveCount(2);
  await page.getByRole('button', {name: 'Isolate Fastener · Ø10', exact: true}).first().click();
  await page.getByRole('button', {name: 'Hide assembly', exact: true}).click();
  await page.getByTitle('Pick CAD features · E', {exact: true}).click();
  await page.getByLabel('Feature selection filter').selectOption('face');
  const locations = await geometryLocations(page);
  await pickAt(page, locations[2], isMobile);
  await expect(page.getByRole('button', {name: 'Measure', exact: true}), 'A geometry tap opens Measure without activating a newly appeared sheet control').toHaveClass('selected');
  const properties = page.locator('.feature-properties');
  await expect(properties).toContainText('Approx.');
  const diameter = properties.locator('.metric').filter({hasText: 'Diameter'}).locator('strong');
  const area = properties.locator('.metric').filter({hasText: 'Area'}).locator('strong');
  await expect(diameter).toHaveText('10.000');
  // A 32-segment mesh cap has polygon area 78.036 mm² rather than πr².
  expect(Number(await area.innerText())).toBeCloseTo(78.036, 2);
});

test('production app reloads and imports STEP after the network goes offline', async ({page, context}) => {
  const response = await page.request.get('/sw.js');
  test.skip(!response.ok() || !(await response.text()).includes('shenzhen-3d-'), 'Offline precaching is generated by the production build.');
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
    if (!navigator.serviceWorker.controller) {
      await new Promise<void>(resolve => navigator.serviceWorker.addEventListener('controllerchange', () => resolve(), {once: true}));
    }
  });
  const cached = await page.evaluate(async () => {
    const names = (await caches.keys()).filter(name => name.startsWith('shenzhen-3d-'));
    return (await Promise.all(names.map(async name => (await (await caches.open(name)).keys()).map(request => request.url)))).flat();
  });
  expect(cached.some(url => url.endsWith('/index.html'))).toBe(true);
  expect(cached.some(url => url.endsWith('.wasm'))).toBe(true);
  await context.setOffline(true);
  try {
    await page.reload({waitUntil: 'domcontentloaded'});
    await expect(page.getByRole('button', {name: 'Explore a sample model', exact: true})).toBeVisible();
    await page.locator('input[type=file]').setInputFiles(fixture);
    await expect(page.locator('.model-badge')).toContainText('CAD model', {timeout: 120_000});
    await expect(page.locator('.model-badge')).toContainText(' parts');
    await expect(page.getByRole('alert')).toHaveCount(0);
  } finally {
    await context.setOffline(false);
  }
});

test('portable review projects preserve point, feature and part notes with editable anchors', async ({page, isMobile}) => {
  await page.getByRole('button', {name: 'Explore a sample model'}).click();
  const locations = await geometryLocations(page);
  for (const [index, scope, text] of [
    [0, 'point', 'Check clearance at this point.'],
    [1, 'feature', 'Keep this face free of coating.'],
    [2, 'part', 'Supplier approval required for this part.'],
  ] as const) {
    await showInspector(page);
    await page.getByRole('button', {name: /^Notes/}).click();
    await page.getByRole('button', {name: 'Add note', exact: true}).click();
    await page.getByLabel('Annotation target').selectOption(scope);
    await pickAt(page, locations[index], isMobile);
    await expect(page.locator('.note-anchor.attached')).toBeVisible();
    await page.getByLabel('Annotation text', {exact: true}).fill(text);
    await page.getByRole('button', {name: 'Save note', exact: true}).click();
    await expect(page.locator('.review-note')).toHaveCount(index + 1);
  }
  await expect(page.locator('.review-pin')).toHaveCount(3);
  await page.screenshot({path: `artifacts/review-${isMobile ? 'mobile' : 'desktop'}.png`});
  await page.getByRole('button', {name: 'Edit note 1', exact: true}).click();
  await page.getByLabel('Edit annotation text').fill('Revised clearance: check with the mating part.');
  await page.getByRole('button', {name: 'Save changes', exact: true}).click();
  await page.locator('.review-note').nth(1).getByRole('button', {name: 'Resolve', exact: true}).click();
  await expect(page.locator('.review-pin')).toHaveCount(2);
  await page.getByLabel('Show resolved').check();
  await expect(page.locator('.review-note.resolved')).toHaveCount(1);
  await page.getByRole('button', {name: 'Measure', exact: true}).click();
  await page.locator('.units-details summary').click();
  await page.getByLabel('Source units', {exact: true}).selectOption('cm');
  await page.getByLabel('Custom scale factor').fill('2.5');
  await page.evaluate(() => Object.defineProperty(navigator, 'canShare', {configurable: true, value: () => false}));
  const downloadPromise = page.waitForEvent('download');
  await page.locator('header').getByRole('button', {name: 'Share commented project', exact: true}).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toMatch(/\.sz3d$/);
  const stream = await download.createReadStream();
  const chunks: Buffer[] = [];
  for await (const chunk of stream!) chunks.push(Buffer.from(chunk));
  await page.reload();
  await page.locator('input[type=file]').setInputFiles({name: download.suggestedFilename(), mimeType: 'application/octet-stream', buffer: Buffer.concat(chunks)});
  await expect(page.locator('.review-note')).toHaveCount(2);
  await expect(page.locator('.review-note').first()).toContainText('Revised clearance');
  await expect(page.locator('.review-pin')).toHaveCount(2);
  await expect(page.getByRole('alert')).toHaveCount(0);
  await page.getByLabel('Show resolved').check();
  await expect(page.locator('.review-note')).toHaveCount(3);
  await page.getByRole('button', {name: 'Focus note 3', exact: true}).click();
  await expect(page.locator('.review-pin.selected')).toHaveCount(1);
  await page.getByRole('button', {name: 'Measure', exact: true}).click();
  await page.locator('.units-details summary').click();
  await expect(page.getByLabel('Source units', {exact: true})).toHaveValue('cm');
  await expect(page.getByLabel('Custom scale factor')).toHaveValue('2.5');
});

test('render styles and lighting are available in desktop and touch settings', async ({page}) => {
  await page.getByRole('button', {name: 'Explore a sample model'}).click();
  await page.getByRole('button', {name: 'Settings', exact: true}).click();
  await page.getByLabel('Settings render style').selectOption('hidden-line');
  await page.getByLabel('Light direction', {exact: true}).fill('120');
  await page.getByLabel('Light elevation', {exact: true}).fill('25');
  await page.getByLabel('Uniform fill light', {exact: true}).check();
  await page.getByLabel('Uniform light intensity', {exact: true}).fill('1.5');
  await page.getByRole('button', {name: 'Done', exact: true}).click();
  await expect(page.locator('canvas').first()).toBeVisible();
  await page.getByRole('button', {name: 'Settings', exact: true}).click();
  await expect(page.getByLabel('Settings render style')).toHaveValue('hidden-line');
  await expect(page.getByLabel('Light direction', {exact: true})).toHaveValue('120');
  await expect(page.getByLabel('Uniform fill light', {exact: true})).toBeChecked();
  await page.getByLabel('Settings render style').selectOption('shaded');
  await page.getByRole('button', {name: 'Reset lighting', exact: true}).click();
  await expect(page.getByLabel('Uniform fill light', {exact: true})).not.toBeChecked();
});

test('CAD review bundle carries the original STEP and exact saved measurements', async ({page, isMobile}) => {
  await page.locator('input[type=file]').setInputFiles(fixture);
  await expect(page.locator('.model-badge')).toContainText('CAD model', {timeout: 120_000});
  const locations = await geometryLocations(page);
  await page.getByTitle('Pick CAD features · E', {exact: true}).click();
  await page.getByLabel('Feature selection filter').selectOption('face');
  await pickAt(page, locations[0], isMobile);
  await pickAt(page, locations[1], isMobile);
  await expect(page.locator('.accuracy-tag')).toContainText('Exact CAD geometry', {timeout: 60_000});
  const distance = await page.locator('.result-hero strong').innerText();
  await page.getByRole('button', {name: 'Save measurement', exact: true}).click();
  await page.getByRole('button', {name: /^Notes/}).click();
  await page.getByRole('button', {name: 'Add note', exact: true}).click();
  await page.getByLabel('Annotation target').selectOption('feature');
  await pickAt(page, locations[0], isMobile);
  await expect(page.locator('.note-anchor.attached')).toContainText('face');
  await page.getByLabel('Annotation text', {exact: true}).fill('Verify this CAD face before manufacturing.');
  await page.getByRole('button', {name: 'Save note', exact: true}).click();
  await page.evaluate(() => Object.defineProperty(navigator, 'canShare', {configurable: true, value: () => false}));
  const wait = page.waitForEvent('download');
  await page.locator('header').getByRole('button', {name: 'Share commented project', exact: true}).click();
  const download = await wait, stream = await download.createReadStream(), chunks: Buffer[] = [];
  for await (const chunk of stream!) chunks.push(Buffer.from(chunk));
  await page.reload();
  await page.locator('input[type=file]').setInputFiles({name: download.suggestedFilename(), mimeType: 'application/octet-stream', buffer: Buffer.concat(chunks)});
  await expect(page.locator('.model-badge')).toContainText('CAD model', {timeout: 120_000});
  await expect(page.locator('.review-note')).toHaveCount(1);
  await expect(page.locator('.review-note')).toContainText('Verify this CAD face');
  await expect(page.locator('.note-location small')).toContainText('face');
  await expect(page.getByRole('alert')).toHaveCount(0);
  await page.getByRole('button', {name: 'Saved 1', exact: true}).click();
  await page.locator('.saved-measurement > button').first().click();
  await expect(page.locator('.result-hero strong')).toHaveText(distance);
  await expect(page.locator('.accuracy-tag')).toContainText('Exact CAD geometry');
});

test('ray tracing reports unsupported devices and keeps the normal viewer usable', async ({page}) => {
  await page.addInitScript(() => Object.defineProperty(navigator, 'gpu', {configurable: true, value: undefined}));
  await page.reload();
  await page.getByRole('button', {name: 'Explore a sample model'}).click();
  await page.getByRole('button', {name: 'Settings', exact: true}).click();
  await page.getByLabel('GPU ray tracing', {exact: true}).check();
  await expect(page.locator('.raytrace-controls')).toContainText('requires WebGPU', {timeout: 20_000});
  await page.getByLabel('GPU ray tracing', {exact: true}).uncheck();
  await page.getByRole('button', {name: 'Done', exact: true}).click();
  await expect(page.locator('.ray-status-badge')).toHaveCount(0);
  await page.getByRole('button', {name: 'Fit model', exact: true}).click();
  await expect(page.locator('canvas').first()).toBeVisible();
});

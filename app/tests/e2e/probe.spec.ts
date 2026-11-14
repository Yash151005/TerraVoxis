import { expect, test, type Page } from '@playwright/test';

/** Behaviour checks for phase 3-4: values, pitch direction, events, scan voices. Logs measured numbers. */

type Latest = {
  t: number;
  global: { u: number | null; classFractions?: Record<string, number> };
  probes: { x: number; y: number; value: number | null; u: number | null; confidence: number; coverage: number }[];
  events: unknown[];
};

const latest = (page: Page) =>
  page.evaluate(() => (window as unknown as { __terravoxis: { latest: { current: Latest } } }).__terravoxis.latest.current);

const level = (page: Page) => page.evaluate(() => (window as unknown as { __terravoxis: { engine: { level(): number } } }).__terravoxis.engine.level());

/** Frequency of the loudest probe voice as scheduled on the audio graph. */
const probeFreq = (page: Page) =>
  page.evaluate(() => {
    const g = (window as unknown as { __terravoxis: { engine: { graph: { probes: { oscs: OscillatorNode[] }[] } } } }).__terravoxis.engine.graph;
    return g.probes[0].oscs[0].frequency.value;
  });

test('ocean: warm water reads warm, cold water reads cold, and pitch falls', async ({ page }) => {
  await page.goto('#/scene/ocean');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Global Sea Surface Currents and Temperature');
  await page.getByRole('button', { name: 'Play', exact: true }).click();
  await page.waitForTimeout(1500);
  expect(await level(page)).toBeGreaterThan(0.001);

  // Default probe: off the south-east US coast (Gulf Stream).
  const probe = page.locator('[data-probe="1"]');
  await probe.focus();
  await page.waitForTimeout(500);
  const warm = await latest(page);
  const warmFreq = await probeFreq(page);
  console.log('warm probe', JSON.stringify(warm.probes[0]), 'freq', warmFreq.toFixed(1));

  // Move north-east toward the cold North Atlantic with Shift+arrows: +5% x, -5% y per press.
  for (let i = 0; i < 3; i++) await page.keyboard.press('Shift+ArrowUp');
  for (let i = 0; i < 2; i++) await page.keyboard.press('Shift+ArrowRight');
  await page.waitForTimeout(1200);
  const cold = await latest(page);
  const coldFreq = await probeFreq(page);
  console.log('cold probe', JSON.stringify(cold.probes[0]), 'freq', coldFreq.toFixed(1));
  expect(warm.probes[0].value).not.toBeNull();
  expect(cold.probes[0].value).not.toBeNull();
  expect(cold.probes[0].value!).toBeLessThan(warm.probes[0].value!);
  expect(coldFreq).toBeLessThan(warmFreq);

  const perf = await page.evaluate(() => (window as unknown as { __terravoxis: { perf: { current: { count: number; meanMs: number; maxMs: number } } } }).__terravoxis.perf.current);
  console.log('analysis perf', JSON.stringify(perf));
});

test('lightning: events are detected while playing', async ({ page }) => {
  await page.goto('#/scene/lightning');
  // The video has no dots for its first ~6 seconds; seek to 20 s with the slider keys (+5 s each).
  await page.getByRole('slider', { name: 'Seek' }).waitFor();
  await expect(page.getByRole('button', { name: 'Play', exact: true })).toBeEnabled();
  await page.getByRole('slider', { name: 'Seek' }).focus();
  for (let i = 0; i < 4; i++) await page.keyboard.press('ArrowRight');
  await page.getByRole('button', { name: 'Play', exact: true }).click();
  let total = 0;
  for (let i = 0; i < 20; i++) {
    await page.waitForTimeout(150);
    total += (await latest(page)).events.length;
  }
  console.log('lightning events seen in 20 samples', total);
  expect(total).toBeGreaterThan(5);
});

test('aerosols: scan reports class fractions that change along the scan', async ({ page }) => {
  await page.goto('#/scene/aerosols');
  await page.getByRole('button', { name: 'Play scan' }).click();
  const seen: Record<string, number> = {};
  for (let i = 0; i < 12; i++) {
    await page.waitForTimeout(400);
    const f = await latest(page);
    for (const [k, v] of Object.entries(f.global.classFractions ?? {})) seen[k] = Math.max(seen[k] ?? 0, v);
  }
  console.log('max class fractions in first ~5 s of scan', JSON.stringify(seen));
  expect(Object.values(seen).filter((v) => v > 0.01).length).toBeGreaterThanOrEqual(3);
  expect(await level(page)).toBeGreaterThan(0.001);
});

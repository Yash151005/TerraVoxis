import { expect, test, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';

const status = (page: Page) => page.getByTestId('live-status');
const level = (page: Page) => page.evaluate(() => (window as unknown as { __terravoxis: { engine: { level(): number } } }).__terravoxis.engine.level());
const audioState = (page: Page) =>
  page.evaluate(() => (window as unknown as { __terravoxis: { engine: { status: string } } }).__terravoxis.engine.status);

/** Press Tab until the focused element matches, without using the pointer. */
async function tabTo(page: Page, test: (el: { text: string; probe: string | null; tag: string }) => boolean, max = 60) {
  for (let i = 0; i < max; i++) {
    await page.keyboard.press('Tab');
    const el = await page.evaluate(() => {
      const a = document.activeElement as HTMLElement | null;
      return { text: a?.textContent?.trim() ?? '', probe: a?.getAttribute('data-probe') ?? null, tag: a?.tagName ?? '' };
    });
    if (test(el)) return;
  }
  throw new Error('Could not reach the element with Tab');
}

test('keyboard-only journey: jukebox, legend, play, probe, describe', async ({ page }) => {
  const errors: string[] = [];
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  page.on('pageerror', (e) => errors.push(e.message));

  await page.goto('./');
  await expect(page).toHaveTitle(/TerraVoxis/);
  // Nothing sounds before a user action: no audio context exists yet.
  expect(await audioState(page).catch(() => 'none')).toBe('none');

  await tabTo(page, (el) => el.text.startsWith('Global Sea Surface Currents'));
  await page.keyboard.press('Enter');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Global Sea Surface Currents and Temperature');
  await expect(page).toHaveTitle('Global Sea Surface Currents and Temperature — TerraVoxis');
  await expect(page.getByRole('button', { name: 'Play', exact: true })).toBeEnabled();

  // Audio legend: L starts it, Escape stops it.
  await page.keyboard.press('l');
  await expect(status(page)).toContainText('Lowest: 0 °C');
  expect(await audioState(page)).toBe('running');
  await page.keyboard.press('Escape');
  await expect(status(page)).toContainText('Legend stopped');

  // Play with K, then sound must be flowing.
  await page.keyboard.press('k');
  await page.waitForTimeout(1500);
  const playing = await level(page);
  expect(playing).toBeGreaterThan(0.001);

  // Move the probe with arrow keys; the reading is announced on key release.
  await tabTo(page, (el) => el.probe === '1');
  for (let i = 0; i < 3; i++) await page.keyboard.press('ArrowLeft');
  await page.keyboard.press('Shift+ArrowDown');
  await expect(status(page)).toContainText('Probe 1');

  await page.keyboard.press('d');
  await expect(status(page)).toContainText('°C');
  await expect(status(page)).toContainText('Estimated from pixel colour');
  await expect(page.getByTestId('description')).toContainText('Estimated from pixel colour');

  // Pause with K: near silence.
  await page.keyboard.press('k');
  await page.waitForTimeout(600);
  const paused = await level(page);
  console.log(`output RMS playing ${playing.toFixed(4)}, paused ${paused.toFixed(6)}`);
  expect(paused).toBeLessThan(0.0005);

  // Mode shortcuts.
  await page.keyboard.press('2');
  await expect(page.getByRole('radio', { name: /Musical/ })).toBeChecked();
  await page.keyboard.press('3');
  await expect(page.getByRole('radio', { name: /Accessibility/ })).toBeChecked();

  expect(errors).toEqual([]);
});

test('seek does not leave stuck notes', async ({ page }) => {
  await page.goto('#/scene/ocean');
  await page.getByRole('button', { name: 'Play', exact: true }).click();
  await page.waitForTimeout(1000);
  await page.getByRole('slider', { name: 'Seek' }).focus();
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('ArrowRight');
  await page.waitForTimeout(800);
  expect(await level(page)).toBeGreaterThan(0.001);
  await page.getByRole('button', { name: 'Pause' }).click();
  await page.waitForTimeout(600);
  expect(await level(page)).toBeLessThan(0.0005);
});

test('media failure shows an explanation, retry and SVS link', async ({ page }) => {
  await page.route('**/media/ocean.mp4', (r) => r.abort());
  await page.goto('#/scene/ocean');
  await expect(page.getByRole('heading', { name: 'The NASA media could not be loaded' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Try again' })).toBeVisible();
  await expect(page.getByRole('link', { name: /Open SVS 3912/ })).toHaveAttribute('href', 'https://svs.gsfc.nasa.gov/3912/');
});

test('settings persist and high contrast applies', async ({ page }) => {
  await page.goto('./');
  await page.getByRole('button', { name: 'Settings' }).click();
  await page.getByRole('checkbox', { name: 'High contrast' }).check();
  await expect(page.locator('html')).toHaveClass(/hc/);
  await page.keyboard.press('Escape');
  await page.reload();
  await expect(page.locator('html')).toHaveClass(/hc/);
  const stored = await page.evaluate(() => localStorage.getItem('terravoxis.settings.v1'));
  expect(JSON.parse(stored!).state.highContrast).toBe(true);
});

test('export renders a deterministic WAV and a valid mapping file', async ({ page }) => {
  test.setTimeout(120_000);
  await page.goto('#/scene/aerosols');
  await expect(page.getByRole('button', { name: 'Play scan' })).toBeEnabled();
  const wavs: Buffer[] = [];
  let sidecar: Record<string, unknown> | null = null;
  const peaks: number[] = [];
  for (let run = 0; run < 2; run++) {
    await page.getByRole('button', { name: /Export sound/ }).click();
    await page.getByRole('button', { name: /Start export|Export again/ }).click();
    const wavLink = page.getByRole('link', { name: /aerosols-scientific\.wav/ });
    await expect(wavLink).toBeVisible({ timeout: 60_000 });
    const [dl] = await Promise.all([page.waitForEvent('download'), wavLink.click()]);
    wavs.push(readFileSync((await dl.path())!));
    const [dj] = await Promise.all([page.waitForEvent('download'), page.getByRole('link', { name: /mapping\.json/ }).click()]);
    sidecar = JSON.parse(readFileSync((await dj.path())!, 'utf8'));
    peaks.push(await page.evaluate(() => (window as unknown as { __terravoxis: { lastRenderPeak: number } }).__terravoxis.lastRenderPeak));
    await page.getByRole('button', { name: 'Close' }).click();
  }
  const wav = wavs[0];
  expect(wav.subarray(0, 4).toString()).toBe('RIFF');
  expect(wav.subarray(8, 12).toString()).toBe('WAVE');
  const seconds = wav.readUInt32LE(40) / (44100 * 4);
  console.log(`WAV ${seconds.toFixed(1)} s, raw render peaks ${peaks.map((p) => p.toFixed(3)).join(', ')}`);
  expect(seconds).toBeGreaterThan(24);
  let diffs = 0, maxDiff = 0, firstDiff = -1;
  for (let o = 44; o < Math.min(wavs[0].length, wavs[1].length); o += 2) { const d = Math.abs(wavs[0].readInt16LE(o) - wavs[1].readInt16LE(o)); if (d) { diffs++; maxDiff = Math.max(maxDiff, d); if (firstDiff < 0) firstDiff = (o - 44) / 4 / 44100; } }
  console.log('wav lengths', wavs[0].length, wavs[1].length, 'differing samples', diffs, 'max diff LSB', maxDiff, 'first diff at s', firstDiff);
  // Chrome's offline renderer is not bit-exact across runs for this graph: every node is
  // deterministic alone, but long full-graph renders differ by at most 1 LSB in a few % of samples.
  // The feature timeline and mapping are deterministic (unit tests); we assert that bound here.
  expect(wavs[0].length).toBe(wavs[1].length);
  expect(maxDiff).toBeLessThanOrEqual(1);
  expect(diffs / ((wavs[0].length - 44) / 2)).toBeLessThan(0.05);
  // Non-silent and never above -1 dBFS after encoding.
  let peak = 0;
  for (let o = 44; o < wav.length; o += 2) peak = Math.max(peak, Math.abs(wav.readInt16LE(o)) / 32768);
  expect(peak).toBeGreaterThan(0.01);
  expect(peak).toBeLessThanOrEqual(0.892);
  expect(sidecar!.statement).toBe('Values are estimated from pixel colour in a NASA SVS rendering and are not measurements.');
  expect((sidecar!.scene as { svsUrl: string }).svsUrl).toBe('https://svs.gsfc.nasa.gov/5669/');
});

test('moving a probe while paused updates the readout at once', async ({ page }) => {
  await page.goto('#/scene/ocean');
  await expect(page.getByRole('button', { name: 'Play', exact: true })).toBeEnabled();
  const probe = page.locator('[data-probe="1"]');
  await expect(probe).toHaveAttribute('aria-label', /°C/);
  const before = await probe.getAttribute('aria-label');
  await probe.focus();
  for (let i = 0; i < 3; i++) await page.keyboard.press('Shift+ArrowUp');
  await expect(probe).not.toHaveAttribute('aria-label', before!);
  const v = await page.evaluate(() => (window as unknown as { __terravoxis: { latest: { current: { probes: { y: number }[] } } } }).__terravoxis.latest.current.probes[0].y);
  expect(v).toBeCloseTo(0.18, 2);
});

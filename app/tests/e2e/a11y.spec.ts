import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

const ROUTES = ['#/', '#/scene/ocean', '#/scene/lightning', '#/scene/aerosols', '#/method', '#/credits'];

for (const route of ROUTES) {
  for (const hc of [false, true]) {
    test(`axe: no serious or critical issues on ${route}${hc ? ' (high contrast)' : ''}`, async ({ page }) => {
      if (hc) await page.addInitScript(() => localStorage.setItem('terravoxis.settings.v1', JSON.stringify({ state: { highContrast: true }, version: 1 })));
      await page.goto(route);
      await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
      await page.waitForTimeout(1500);
      const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa', 'best-practice']).analyze();
      const bad = results.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical');
      const all = results.violations.map((v) => `${v.impact} ${v.id}: ${v.nodes.length}`);
      if (all.length) console.log(route, hc ? 'hc' : '', all.join('; '));
      expect(bad.map((v) => `${v.id}: ${v.help} (${v.nodes.map((n) => n.target.join(' ')).slice(0, 3).join(', ')})`)).toEqual([]);
    });
  }
}

test('page structure: one h1, landmarks, live regions, language', async ({ page }) => {
  await page.goto('#/scene/ocean');
  await expect(page.locator('h1')).toHaveCount(1);
  await expect(page.locator('main')).toHaveCount(1);
  await expect(page.getByRole('navigation', { name: 'Main' })).toBeVisible();
  await expect(page.getByRole('status').filter({ has: page.locator('[data-testid="live-status"]') }).or(page.getByTestId('live-status'))).toHaveCount(1);
  await expect(page.locator('html')).toHaveAttribute('lang', /en/);
  const probe = page.locator('[data-probe="1"]');
  await expect(probe).toHaveAttribute('aria-roledescription', 'listening probe');
  await expect(probe).toHaveAttribute('aria-label', /Probe 1, \d+° (north|south)/);
  const box = await probe.boundingBox();
  expect(box!.width).toBeGreaterThanOrEqual(24);
});

test('skip link moves focus to main content', async ({ page }) => {
  await page.goto('#/credits');
  await page.keyboard.press('Tab');
  await expect(page.getByRole('link', { name: 'Skip to main content' })).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.locator('main')).toBeFocused();
});

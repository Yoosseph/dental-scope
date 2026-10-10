import { expect, test } from '@playwright/test';

test('replay advances when the page became visible before the guide opened', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('ds.guide.seen.v1', 'seen');
    Object.defineProperty(document, 'hidden', { configurable: true, value: true });
  });
  await page.goto('/');
  await expect(page.getByRole('status')).toHaveCount(0);
  await page.evaluate(() => {
    Object.defineProperty(document, 'hidden', { configurable: true, value: false });
    document.dispatchEvent(new Event('visibilitychange'));
  });
  await page.getByRole('button', { name: 'Replay guide', exact: true }).click();
  await expect(page.locator('#ds-tour-body')).toContainText('Watch a short demonstration');
  await expect(page.locator('.ds-tour-count')).toHaveText('2 / 17', { timeout: 10_000 });
  await page.getByRole('button', { name: 'Close guide', exact: true }).click();
});

test('the complete guide finishes and can be replayed', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('ds.guide.seen.v1', 'seen'));
  await page.goto('/');
  await expect(page.getByRole('status')).toHaveCount(0);
  await page.getByRole('button', { name: 'Replay guide', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Start exploring', exact: true })).toBeVisible({ timeout: process.env.CI ? 180_000 : 90_000 });
  await expect(page.locator('.ds-tour-count')).toHaveText('17 / 17');
  await page.getByRole('button', { name: 'Start exploring', exact: true }).click();
  await expect(page.locator('.ds-tour-card')).toHaveCount(0);
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByRole('button', { name: 'Replay guide', exact: true })).toBeFocused();
  await page.getByRole('button', { name: 'Replay guide', exact: true }).click();
  await expect(page.locator('.ds-tour-count')).toHaveText('2 / 17');
  await page.keyboard.press('Escape');
  await expect(page.locator('.ds-tour-card')).toHaveCount(0);
});

test('the guide card does not change sides repeatedly within a step', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop');
  await page.addInitScript(() => localStorage.setItem('ds.guide.seen.v1', 'seen'));
  await page.goto('/');
  await expect(page.getByRole('status')).toHaveCount(0);
  await page.getByRole('button', { name: 'Replay guide', exact: true }).click();
  await expect(page.locator('.ds-tour-count')).toHaveText('2 / 17');
  await expect(page.locator('.ds-tour-cursor')).toBeVisible();
  await page.getByRole('button', { name: 'Pause', exact: true }).click();
  const positions = await page.evaluate(async () => {
    const target = document.querySelector<HTMLElement>('[data-tour="development-primary"]')!;
    const measure = target.getBoundingClientRect.bind(target);
    let calls = 0;
    target.getBoundingClientRect = () => new DOMRect(innerWidth * .65 + (++calls % 2 ? 2 : -2), 150, 100, 32);
    const values: string[] = [];
    for (let frame = 0; frame < 12; frame++) {
      await new Promise<void>(resolve => requestAnimationFrame(() => resolve()));
      values.push(document.querySelector<HTMLElement>('.ds-tour-card')!.dataset.position!);
    }
    target.getBoundingClientRect = measure;
    return values;
  });
  expect(new Set(positions).size).toBe(1);
  await page.getByRole('button', { name: 'Close guide', exact: true }).click();
});

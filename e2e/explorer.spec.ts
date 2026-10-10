import { expect, test, type Page } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('ds.guide.seen.v1', 'seen'));
});

async function searchTooth(page: Page, fdi: number) {
  await page.locator('[data-tour="search"]:visible').click();
  const input = page.getByRole('combobox', { name: 'Search anatomy' });
  await input.fill(`fdi ${fdi}`);
  await expect(page.locator('#ds-search-results').getByRole('option').first()).toContainText(`FDI ${fdi}`);
  await input.press('Enter');
}

test('search selections and dissection support Back and Forward', async ({ page }) => {
  await page.goto('/');
  await searchTooth(page, 36);
  await expect(page).toHaveURL(/\/tooth\/36\/$/);
  await searchTooth(page, 11);
  await expect(page).toHaveURL(/\/tooth\/11\/$/);
  await page.goBack();
  await expect(page.getByRole('heading', { name: 'Mandibular left first molar' })).toBeVisible();
  await page.goForward();
  await expect(page.getByRole('heading', { name: 'Maxillary right central incisor' })).toBeVisible();
  await page.getByRole('button', { name: 'Explore inside this tooth' }).click();
  await expect(page).toHaveURL(/\/tooth\/11\/dissect$/);
  await page.goBack();
  await expect(page.getByRole('button', { name: 'Explore inside this tooth' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Back to the full mouth' })).toHaveCount(0);
  await page.getByRole('button', { name: 'Close details', exact: true }).click();
  await expect(page).toHaveURL(/\/$/);
  await page.goBack();
  await expect(page.getByRole('heading', { name: 'Maxillary right central incisor' })).toBeVisible();
});

test('search contains keyboard focus and restores its opener', async ({ page }) => {
  await page.goto('/');
  const opener = page.locator('[data-tour="search"]:visible');
  await opener.click();
  const input = page.getByRole('combobox', { name: 'Search anatomy' });
  await expect(input).toBeFocused();
  await input.press('Shift+Tab');
  await expect.poll(() => page.locator('.ds-search-layer').evaluate(element => element.contains(document.activeElement))).toBe(true);
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog', { name: 'Search anatomy' })).toBeHidden();
  await expect(opener).toBeFocused();
  await opener.click();
  await page.locator('.ds-search-layer').click({ position: { x: 5, y: 5 } });
  await expect(page.getByRole('dialog', { name: 'Search anatomy' })).toBeHidden();
});

test('desktop layers remain reachable with nerve settings expanded', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop');
  await page.goto('/');
  await page.locator('.ds-nerve-controls summary').click();
  await expect.poll(() => page.locator('.ds-layer-scroll').evaluate(element => element.clientHeight)).toBeGreaterThan(100);
  await page.getByRole('button', { name: 'Show only Permanent teeth', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Show Permanent teeth', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('.ds-count[aria-label="32 teeth"]')).toHaveText('32');
});

test('primary dentition has an explicit development action', async ({ page }, testInfo) => {
  await page.goto('/');
  if (testInfo.project.name === 'phone') await page.getByRole('button', { name: 'Layers', exact: true }).click();
  await page.getByRole('button', { name: 'Open primary dentition', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Make Primary teeth translucent' })).toHaveCount(0);
  await expect(page.locator('.ds-development-panel')).toBeVisible();
});

test('phone detail actions stay visible and the reading tray expands', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'phone');
  await page.goto('/tooth/11/');
  const action = page.getByRole('button', { name: 'Explore inside this tooth' });
  await expect(action).toBeInViewport();
  await page.locator('.ds-detail-body').evaluate(element => { element.scrollTop = element.scrollHeight; });
  await expect(action).toBeInViewport();
  const tray = page.locator('.ds-detail');
  const initialHeight = await tray.evaluate(element => element.clientHeight);
  await page.getByRole('button', { name: 'Expand details' }).click();
  await expect.poll(() => tray.evaluate(element => element.clientHeight)).toBeGreaterThan(initialHeight + 100);
  await expect(action).toBeInViewport();
  await page.getByRole('button', { name: 'Collapse details' }).click();
  await action.click();
  await expect(page).toHaveURL(/\/tooth\/11\/dissect$/);
});

test('a failed tooth download can be retried without reloading', async ({ page }, testInfo) => {
  await page.route('**/models/teeth/tooth-11.glb', route => route.abort());
  await page.goto('/tooth/36/');
  await expect(page.getByRole('heading', { name: 'Mandibular left first molar' })).toBeVisible();
  await searchTooth(page, 11);
  await expect(page.getByRole('alert')).toContainText('This anatomy could not be loaded');
  await page.unroute('**/models/teeth/tooth-11.glb');
  if (testInfo.project.name === 'phone') await page.screenshot({ path: testInfo.outputPath('retry-visible.png') });
  await page.getByRole('button', { name: 'Retry', exact: true }).click({ timeout: 10_000 });
  await expect(page).toHaveURL(/\/tooth\/11\/$/);
  await expect(page.getByRole('alert')).toHaveCount(0);
});

test('credits deep links retain theme and keyboard dismissal', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('ds.theme', 'dark'));
  await page.goto('/credits/');
  await expect(page.getByRole('dialog', { name: 'Credits', exact: true })).toBeVisible();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await expect(page.getByRole('link', { name: 'Roy Namo — GitHub' })).toHaveAttribute('href', 'https://github.com/roynamo');
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog', { name: 'Credits', exact: true })).toBeHidden();
  await expect(page).toHaveURL(/\/$/);
});

import { expect, test } from '@playwright/test';

declare global {
  interface Window { restoreGuideRendering: () => void }
}

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    // Keep playback and geometry live; skip costly software rasterization for UI checks.
    const drawElements = Object.getOwnPropertyDescriptor(WebGL2RenderingContext.prototype, 'drawElements')!;
    const drawArrays = Object.getOwnPropertyDescriptor(WebGL2RenderingContext.prototype, 'drawArrays')!;
    Object.assign(window, { restoreGuideRendering: () => {
      Object.defineProperty(WebGL2RenderingContext.prototype, 'drawElements', drawElements);
      Object.defineProperty(WebGL2RenderingContext.prototype, 'drawArrays', drawArrays);
    } });
    WebGL2RenderingContext.prototype.drawElements = () => {};
    WebGL2RenderingContext.prototype.drawArrays = () => {};
  });
});

test('the guide stays on the right through the adult to teeth transition', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop');
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.addInitScript(() => {
    localStorage.setItem('ds.guide.seen.v1', 'seen');
  });
  await page.goto('/');
  await expect(page.getByRole('status')).toHaveCount(0);
  await page.getByRole('button', { name: 'Replay guide', exact: true }).click();
  await expect(page.locator('.ds-tour-count')).toHaveText('3 / 17');
  const samples = await page.evaluate(async () => {
    const values: { step: string; left: number; position: string | undefined }[] = [];
    const deadline = performance.now() + 15_000;
    while (performance.now() < deadline) {
      await new Promise<void>(resolve => requestAnimationFrame(() => resolve()));
      const card = document.querySelector<HTMLElement>('.ds-tour-card')!;
      const step = card.querySelector('.ds-tour-count')!.textContent;
      if (step === '6 / 17') break;
      if (step === '4 / 17' || step === '5 / 17') {
        values.push({ step, left: card.getBoundingClientRect().left, position: card.dataset.position });
      }
    }
    return values;
  });
  expect(new Set(samples.map(sample => sample.step))).toEqual(new Set(['4 / 17', '5 / 17']));
  expect(samples.filter(sample => sample.left < 640).length, 'guide frames that jumped to the left').toBe(0);
  await page.getByRole('button', { name: 'Close guide', exact: true }).click();
});

test('guide circles form a complete outline around a moving control', async ({ page }, testInfo) => {
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.addInitScript(() => {
    localStorage.setItem('ds.guide.seen.v1', 'seen');
  });
  await page.goto('/');
  await expect(page.getByRole('status')).toHaveCount(0);
  await page.getByRole('button', { name: 'Replay guide', exact: true }).click();
  await expect(page.locator('.ds-tour-circle')).toBeAttached();
  await page.getByRole('button', { name: 'Pause', exact: true }).click();
  const geometry = await page.locator('.ds-tour-circle').evaluate(element => {
    const path = element.querySelector('path')!;
    for (const animation of path.getAnimations()) { animation.pause(); animation.currentTime = 750; }
    const length = path.getTotalLength();
    const start = path.getPointAtLength(0), end = path.getPointAtLength(length);
    return { gap: Math.hypot(start.x - end.x, start.y - end.y) };
  });
  await page.screenshot({ path: testInfo.outputPath('circle-outline.png') });
  expect(geometry.gap, 'the red outline closes completely').toBeLessThan(.1);
  const alignment = await page.evaluate(async () => {
    const target = document.querySelector<HTMLElement>('[data-tour="development-primary"]')!;
    target.style.transform = 'translate(18px, -14px)';
    target.style.width = '240px';
    for (let i = 0; i < 3; i++) await new Promise<void>(resolve => requestAnimationFrame(() => resolve()));
    const rect = target.getBoundingClientRect();
    const circle = document.querySelector<SVGSVGElement>('.ds-tour-circle')!;
    const outline = circle.getBoundingClientRect();
    const path = circle.querySelector('path')!;
    const bounds = path.getBBox();
    return {
      dx: Math.abs(outline.left + outline.width / 2 - rect.left - rect.width / 2),
      dy: Math.abs(outline.top + outline.height / 2 - rect.top - rect.height / 2),
      width: outline.width, drawnWidth: bounds.width,
    };
  });
  expect(alignment.dx).toBeLessThan(1);
  expect(alignment.dy).toBeLessThan(1);
  expect(alignment.drawnWidth).toBeGreaterThan(alignment.width - 10);
  await page.screenshot({ path: testInfo.outputPath('circle-wide.png') });
  await page.getByRole('button', { name: 'Close guide', exact: true }).click();
});

test('the nerve step shows a focused view with a clear explanation', async ({ page }, testInfo) => {
  await page.addInitScript(() => localStorage.setItem('ds.guide.seen.v1', 'seen'));
  await page.goto('/');
  await expect(page.getByRole('status')).toHaveCount(0);
  await page.getByRole('button', { name: 'Replay guide', exact: true }).click();
  await expect(page.locator('.ds-tour-count')).toHaveText('16 / 17', { timeout: 70_000 });
  await expect(page.locator('[data-tour="preset-nerves"]')).toHaveAttribute('aria-checked', 'true');
  await page.getByRole('button', { name: 'Pause', exact: true }).click();
  await expect(page.locator('#ds-tour-body')).toContainText('camera now frames the gold nerve paths');
  await expect(page.getByText('Use the translucent button beside a layer,', { exact: false })).toHaveCount(0);
  await page.evaluate(async () => {
    window.restoreGuideRendering();
    document.dispatchEvent(new Event('visibilitychange'));
    for (let i = 0; i < 3; i++) await new Promise<void>(resolve => requestAnimationFrame(() => resolve()));
  });
  await page.screenshot({ path: testInfo.outputPath('guide-nerves.png') });
  await page.getByRole('button', { name: 'Close guide', exact: true }).click();
});

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

test('the complete guide resets all, closes automatically and can be replayed', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('ds.guide.seen.v1', 'seen');
    localStorage.setItem('ds.numbering', 'universal');
    localStorage.setItem('ds.orbit', 'free');
  });
  await page.goto('/');
  await expect(page.getByRole('status')).toHaveCount(0);
  await page.getByRole('button', { name: 'Replay guide', exact: true }).click();
  await expect(page.locator('.ds-tour-card')).toBeVisible();
  await expect(page.locator('.ds-tour-card')).toHaveCount(0, { timeout: process.env.CI ? 180_000 : 90_000 });
  expect(await page.evaluate(() => [localStorage.getItem('ds.numbering'), localStorage.getItem('ds.orbit')])).toEqual(['fdi', 'fixed']);
  await expect(page.locator('.ds-tour-cursor, .ds-tour-circle')).toHaveCount(0);
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

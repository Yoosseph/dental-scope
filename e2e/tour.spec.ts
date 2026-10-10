import { expect, test, type Page } from '@playwright/test';

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
  await expect(page.locator('.ds-tour-card')).toHaveAttribute('data-step', 'mixed');
  const samples = await page.evaluate(async () => {
    const values: { step: string; left: number; position: string | undefined }[] = [];
    const deadline = performance.now() + 15_000;
    while (performance.now() < deadline) {
      await new Promise<void>(resolve => requestAnimationFrame(() => resolve()));
      const card = document.querySelector<HTMLElement>('.ds-tour-card')!;
      const step = card.dataset.step!;
      if (step === 'search') break;
      if (step === 'adult' || step === 'teeth') {
        values.push({ step, left: card.getBoundingClientRect().left, position: card.dataset.position });
      }
    }
    return values;
  });
  expect(new Set(samples.map(sample => sample.step))).toEqual(new Set(['adult', 'teeth']));
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
  await expect(page.locator('.ds-tour-card')).toHaveAttribute('data-step', 'primary');
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
  await expect(page.locator('.ds-tour-card')).toHaveAttribute('data-step', 'nerves', { timeout: 100_000 });
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

test('the opening proceeds directly from dissection to the labelled teeth', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.addInitScript(() => localStorage.setItem('ds.guide.seen.v1', 'seen'));
  await page.goto('/');
  await expect(page.getByRole('status')).toHaveCount(0);
  await page.getByRole('button', { name: 'Replay guide', exact: true }).click();
  const card = page.locator('.ds-tour-card');
  await expect(card).toHaveAttribute('data-step', 'open-skull');
  await expect(page.getByRole('slider', { name: 'Dissect anatomy', exact: true })).toHaveValue('1');
  const steps = await page.evaluate(async () => {
    const seen = new Set<string>();
    const deadline = performance.now() + 15_000;
    while (performance.now() < deadline) {
      const step = document.querySelector<HTMLElement>('.ds-tour-card')!.dataset.step!;
      seen.add(step);
      if (step === 'opening-teeth') break;
      await new Promise<void>(resolve => requestAnimationFrame(() => resolve()));
    }
    return [...seen];
  });
  expect(steps).toEqual(['open-skull', 'opening-teeth']);
  await expect(page.locator('[data-tour="preset-dentition"]')).toHaveAttribute('aria-checked', 'true');
  await page.locator('.ds-reset-all').click();
  await expect(card).toHaveCount(0);
});

test('Reset all is available throughout the guide and cancels every active run', async ({ page }, testInfo) => {
  await page.addInitScript(() => localStorage.setItem('ds.guide.seen.v1', 'seen'));
  await page.goto('/');
  await expect(page.getByRole('status')).toHaveCount(0);
  const card = page.locator('.ds-tour-card');
  const reset = page.locator('.ds-reset-all');
  // Reproduce the blocked panic button first, before any step navigation.
  await page.getByRole('button', { name: 'Replay guide', exact: true }).click();
  await reset.click({ timeout: 3000 });
  await expect(card).toHaveCount(0);

  for (const mode of ['playing', 'paused', 'hidden', 'preparing'] as const) {
    await page.getByRole('button', { name: 'Replay guide', exact: true }).click();
    await card.getByRole('button', { name: 'Pause', exact: true }).click();
    await card.getByRole('combobox', { name: 'Guide step' }).selectOption('dentin');
    if (mode !== 'preparing') {
      await expect(page.locator('[data-tour="dissect-2"]')).toHaveAttribute('aria-checked', 'true');
      if (mode === 'playing') await card.getByRole('button', { name: 'Resume', exact: true }).click();
      if (mode === 'hidden') await card.getByRole('button', { name: 'Hide guide', exact: true }).click();
    }
    if (mode === 'paused') {
      // Reset also belongs to the guide's keyboard focus loop.
      await card.getByRole('button', { name: 'Resume', exact: true }).focus();
      await page.keyboard.press('Tab');
      await expect(reset).toBeFocused();
      await page.screenshot({ path: testInfo.outputPath('guide-panic-reset.png') });
      await page.keyboard.press('Enter');
    } else await reset.click({ timeout: 3000 });
    await expect(card).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Show guide', exact: true })).toHaveCount(0);
    await expect(page.locator('.ds-tour-cursor, .ds-tour-circle')).toHaveCount(0);
    await expect(page.locator('.ds-detail-title')).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Back to the full mouth', exact: true })).toHaveCount(0);
    await expect(page).toHaveURL(/\/$/);
    await expect(page.getByRole('button', { name: 'Labels', exact: true, includeHidden: true })).toHaveAttribute('aria-pressed', 'false');
  }
  // Give cancelled holds a chance to fire: the guide must not select anything again.
  await page.waitForTimeout(2500);
  await expect(card).toHaveCount(0);
  await expect(page.locator('.ds-detail-title')).toHaveCount(0);
  await expect(page).toHaveURL(/\/$/);
});

test('the guide can hide in the top bar while playback continues and restores the same run', async ({ page }, testInfo) => {
  await page.addInitScript(() => localStorage.setItem('ds.guide.seen.v1', 'seen'));
  await page.goto('/');
  await expect(page.getByRole('status')).toHaveCount(0);
  await page.getByRole('button', { name: 'Replay guide', exact: true }).click();
  const card = page.locator('.ds-tour-card');
  await expect(page.locator('#ds-tour-body')).toContainText('Watch a short demonstration');
  await card.getByRole('button', { name: '2×', exact: true }).click();
  await card.getByRole('button', { name: 'Hide guide', exact: true }).click();
  const show = page.getByRole('button', { name: 'Show guide', exact: true });
  await expect(card).toBeHidden();
  await expect(show).toBeVisible();
  await expect(show).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(page.locator('.ds-reset-all')).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(show).toBeFocused();
  await expect(card).toHaveAttribute('data-step', 'open-skull');
  const initial = await show.boundingBox();
  await expect(card).toHaveAttribute('data-step', 'primary');
  const current = await show.boundingBox();
  expect(initial).toEqual(current);
  await page.screenshot({ path: testInfo.outputPath('guide-hidden-top-bar.png') });
  await show.click();
  await expect(card).toBeVisible();
  await expect(card).toHaveAttribute('data-step', 'primary');
  await card.getByRole('button', { name: 'Pause', exact: true }).click();
  await expect(card.getByRole('button', { name: '2×', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await card.getByRole('combobox', { name: 'Guide step' }).selectOption('surface-description');
  await expect(page.locator('.ds-tour-circle')).toHaveAttribute('data-target', 'tooth-details');
  await card.getByRole('button', { name: 'Hide guide', exact: true }).click();
  await expect(card).toBeHidden();
  await show.click();
  await expect(card).toHaveAttribute('data-step', 'surface-description');
  await expect(card.getByRole('button', { name: 'Resume', exact: true })).toBeVisible();
  expect(await card.evaluate(element => element.scrollWidth <= element.clientWidth)).toBe(true);
  await page.screenshot({ path: testInfo.outputPath('guide-restored-panel.png') });
  await card.getByRole('button', { name: 'Hide guide', exact: true }).click();
  await page.keyboard.press('Escape');
  await expect(card).toHaveCount(0);
  await expect(show).toHaveCount(0);

  await page.getByRole('button', { name: 'Replay guide', exact: true }).click();
  await expect(card).toBeVisible();
  await card.getByRole('button', { name: 'Pause', exact: true }).click();
  await card.getByRole('combobox', { name: 'Guide step' }).selectOption('nerves');
  await expect(page.locator('#ds-tour-body')).toContainText('camera now frames the gold nerve paths');
  await card.getByRole('button', { name: 'Resume', exact: true }).click();
  await card.getByRole('button', { name: 'Hide guide', exact: true }).click();
  await expect(card).toHaveCount(0);
  await expect(show).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Replay guide', exact: true })).toBeFocused();
});

test('guide speed controls and stage jumps preserve the scene and manual pause', async ({ page }, testInfo) => {
  await page.addInitScript(() => localStorage.setItem('ds.guide.seen.v1', 'seen'));
  await page.goto('/');
  await expect(page.getByRole('status')).toHaveCount(0);
  await page.getByRole('button', { name: 'Replay guide', exact: true }).click();
  const card = page.locator('.ds-tour-card');
  await expect(page.locator('#ds-tour-body')).toContainText('Watch a short demonstration');
  await card.getByRole('button', { name: 'Pause', exact: true }).click();
  await expect(card.getByRole('button', { name: '1×', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await card.getByRole('button', { name: '1.5×', exact: true }).click();
  await expect(card.getByRole('button', { name: '1.5×', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await card.getByRole('button', { name: '2×', exact: true }).click();
  await expect(card.getByRole('button', { name: '2×', exact: true })).toHaveAttribute('aria-pressed', 'true');

  await card.getByRole('combobox', { name: 'Guide step', exact: true }).selectOption('surface-description');
  await expect(page.locator('#ds-tour-body')).toContainText('detail panel now describes');
  await expect(page.locator('.ds-tour-circle')).toHaveAttribute('data-target', 'tooth-details');
  await expect(page.locator('.ds-detail-title')).toHaveText('Central groove');
  await expect(page.locator('[data-tour="surface-features-toggle"]')).toHaveAttribute('aria-pressed', 'true');
  await expect(card.getByRole('button', { name: 'Resume', exact: true })).toBeVisible();
  await expect(card.getByRole('button', { name: '2×', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await expect(card.getByRole('combobox', { name: 'Guide step' })).toBeInViewport();
  expect(await card.evaluate(element => element.scrollWidth <= element.clientWidth)).toBe(true);
  await page.evaluate(async () => {
    window.restoreGuideRendering();
    for (let frame = 0; frame < 3; frame++) await new Promise<void>(resolve => requestAnimationFrame(() => resolve()));
  });
  await page.screenshot({ path: testInfo.outputPath('guide-playback-controls.png') });
  await page.evaluate(() => {
    WebGL2RenderingContext.prototype.drawElements = () => {};
    WebGL2RenderingContext.prototype.drawArrays = () => {};
  });

  await card.getByRole('button', { name: 'Next step', exact: true }).click();
  await expect(page.locator('.ds-tour-circle')).toHaveAttribute('data-target', 'surface-view-facial');
  await expect(card.getByRole('button', { name: 'Resume', exact: true })).toBeVisible();
  await card.getByRole('button', { name: 'Previous step', exact: true }).click();
  await expect(page.locator('.ds-tour-circle')).toHaveAttribute('data-target', 'tooth-details');
  await expect(page.locator('.ds-detail-title')).toHaveText('Central groove');

  // A second jump cancels reconstruction without letting the first run click later.
  await card.getByRole('combobox', { name: 'Guide step' }).selectOption('nerves');
  await card.getByRole('combobox', { name: 'Guide step' }).selectOption('primary');
  await expect(page.locator('#ds-tour-body')).toContainText('The primary teeth occupy both arches');
  await expect(page.locator('[data-tour="development-primary"]')).toHaveAttribute('aria-pressed', 'true');
  await card.getByRole('combobox', { name: 'Guide step' }).selectOption('welcome');
  await expect(page.locator('#ds-tour-body')).toContainText('Watch a short demonstration');
  await expect(card.getByRole('button', { name: 'Previous step', exact: true })).toBeDisabled();
  await expect(card.getByRole('button', { name: 'Resume', exact: true })).toBeVisible();
  await card.getByRole('button', { name: 'Resume', exact: true }).click();
  await expect(card).toHaveAttribute('data-step', 'open-skull');
  await card.getByRole('button', { name: 'Pause', exact: true }).click();
  await card.getByRole('combobox', { name: 'Guide step' }).selectOption('nerves');
  await expect(page.locator('#ds-tour-body')).toContainText('camera now frames the gold nerve paths');
  await expect(page.locator('[data-tour="preset-nerves"]')).toHaveAttribute('aria-checked', 'true');
  await card.getByRole('button', { name: 'Resume', exact: true }).click();
  await expect(card).toHaveCount(0);
  await expect(page.locator('.ds-tour-cursor, .ds-tour-circle')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Replay guide', exact: true })).toBeFocused();
});

async function captureGuide(page: Page, path: string, paused = false) {
  if (!paused) await page.locator('.ds-tour-card').getByRole('button', { name: 'Pause', exact: true }).click();
  await page.evaluate(async () => {
    window.restoreGuideRendering();
    document.dispatchEvent(new Event('visibilitychange'));
    for (let i = 0; i < 3; i++) await new Promise<void>(resolve => requestAnimationFrame(() => resolve()));
  });
  await page.screenshot({ path });
  await page.evaluate(() => {
    WebGL2RenderingContext.prototype.drawElements = () => {};
    WebGL2RenderingContext.prototype.drawArrays = () => {};
  });
  await page.getByRole('button', { name: 'Resume', exact: true }).click();
}

test('the guide opens the labelled anatomy before development and demonstrates tooth surfaces before tissues', async ({ page }, testInfo) => {
  await page.addInitScript(() => localStorage.setItem('ds.guide.seen.v1', 'seen'));
  await page.goto('/');
  await expect(page.getByRole('status')).toHaveCount(0);
  await page.getByRole('button', { name: 'Replay guide', exact: true }).click();
  const card = page.locator('.ds-tour-card');
  await expect(card).toHaveAttribute('data-step', 'open-skull');
  await expect(page.getByRole('slider', { name: 'Dissect anatomy', exact: true })).toHaveValue('1');
  await expect(page.getByRole('button', { name: 'Labels', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await captureGuide(page, testInfo.outputPath('guide-opening-anatomy.png'));
  await expect(card).toHaveAttribute('data-step', 'opening-teeth');
  await expect(page.locator('[data-tour="preset-dentition"]')).toHaveAttribute('aria-checked', 'true');
  await expect(card).toHaveAttribute('data-step', 'primary');
  await expect(page.locator('[data-tour="development-primary"]')).toHaveAttribute('aria-pressed', 'true');
  await expect(card).toHaveAttribute('data-step', 'surfaces');
  const surfaceToggle = page.locator('[data-tour="surface-features-toggle"]');
  await expect(surfaceToggle).toHaveAttribute('aria-pressed', 'true');
  await expect(card).toHaveAttribute('data-step', 'surface-feature');
  await expect(page.locator('[data-tour="surface-central-groove-36"]')).toHaveClass(/is-active/);
  await expect(page.locator('.ds-detail-title')).toHaveText('Central groove');
  await expect(card).toHaveAttribute('data-step', 'surface-description');
  await expect(page.locator('.ds-tour-circle')).toHaveAttribute('data-target', 'tooth-details');
  await card.getByRole('button', { name: 'Pause', exact: true }).click();
  await expect(page.locator('[data-tour="tooth-details"]')).toBeInViewport();
  if (testInfo.project.name === 'phone') {
    await expect(page.locator('[data-tour="detail-size-toggle"]')).toHaveAttribute('aria-expanded', 'true');
    await expect.poll(() => page.locator('[data-tour="tooth-details"]').evaluate(element => {
      const text = element.getBoundingClientRect();
      const body = element.closest('.ds-detail-body')!.getBoundingClientRect();
      return text.top >= body.top - 1 && text.bottom <= body.bottom + 1;
    }), { message: 'the complete description fits inside the expanded phone panel' }).toBe(true);
  }
  await captureGuide(page, testInfo.outputPath('guide-surface-feature.png'), true);
  await expect(card).toHaveAttribute('data-step', 'surface-angle');
  await expect(page.locator('[data-tour="detail-size-toggle"]')).toHaveAttribute('aria-expanded', 'false');
  await expect(card).toHaveAttribute('data-step', 'surface-top');
  await expect(surfaceToggle).toHaveAttribute('aria-pressed', 'true');
  await expect(card).toHaveAttribute('data-step', 'surface-hide');
  await expect(surfaceToggle).toHaveAttribute('aria-pressed', 'false');
  await expect(card).toHaveAttribute('data-step', 'inside');
  await expect(page.locator('.ds-detail-title')).toContainText('first molar');
  await expect(card).toHaveAttribute('data-step', 'dentin');
  await expect(page.locator('[data-tour="dissect-2"]')).toHaveAttribute('aria-checked', 'true');
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
  await expect(page.locator('.ds-tour-card')).toHaveAttribute('data-step', 'open-skull', { timeout: 10_000 });
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
  await page.locator('.ds-tour-card').getByRole('button', { name: '2×', exact: true }).click();
  await expect(page.locator('.ds-tour-card')).toHaveCount(0, { timeout: process.env.CI ? 180_000 : 110_000 });
  expect(await page.evaluate(() => [localStorage.getItem('ds.numbering'), localStorage.getItem('ds.orbit')])).toEqual(['fdi', 'fixed']);
  await expect(page.locator('.ds-tour-cursor, .ds-tour-circle')).toHaveCount(0);
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByRole('button', { name: 'Replay guide', exact: true })).toBeFocused();
  await page.getByRole('button', { name: 'Replay guide', exact: true }).click();
  await expect(page.locator('.ds-tour-card')).toHaveAttribute('data-step', 'open-skull');
  await page.keyboard.press('Escape');
  await expect(page.locator('.ds-tour-card')).toHaveCount(0);
});

test('the guide card does not change sides repeatedly within a step', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop');
  await page.addInitScript(() => localStorage.setItem('ds.guide.seen.v1', 'seen'));
  await page.goto('/');
  await expect(page.getByRole('status')).toHaveCount(0);
  await page.getByRole('button', { name: 'Replay guide', exact: true }).click();
  await expect(page.locator('.ds-tour-card')).toHaveAttribute('data-step', 'primary');
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

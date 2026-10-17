import { expect, test, type Page } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('ds.guide.seen.v1', 'seen'));
});

/** Desktop has the segmented switch in the top bar; phones have a button in the bottom bar. */
async function enterQuiz(page: Page) {
  await page.goto('/');
  await page.locator('.ds-mode-switch button:visible, .ds-mobile-mode:visible').filter({ hasText: /^\s*Quiz\s*$/ }).first().click();
  await expect(page.locator('.ds-quiz')).toBeVisible();
}

/** The center of an element is not covered by anything else (e.g. the dock). */
async function isUncovered(page: Page, selector: string) {
  return page.locator(selector).evaluate((el) => {
    const r = el.getBoundingClientRect();
    const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
    return !!hit && (hit === el || el.contains(hit));
  });
}

test('a quiz round never shows the answer before it is submitted', async ({ page }, testInfo) => {
  await enterQuiz(page);
  const question = (await page.locator('.ds-quiz-prompt-name').textContent())?.trim() ?? '';
  expect(question.length).toBeGreaterThan(0);

  // pick a tooth by board position (the keyboard / screen-reader path)
  await page.getByLabel('Or pick by board position').selectOption({ index: 1 });
  await expect(page.locator('.ds-quiz-guide')).toHaveAttribute('data-state', 'picked');

  // the address and the hover tooltip must not name the picked tooth
  await expect(page).toHaveURL(/\/$/);
  if (testInfo.project.name === 'desktop') {
    const box = (await page.locator('.ds-stage canvas').boundingBox())!;
    for (let x = box.x + box.width * 0.35; x < box.x + box.width * 0.95; x += 60) {
      await page.mouse.move(x, box.y + box.height * 0.5);
      await expect(page.locator('#ds-hover-info')).toBeHidden();
    }
  }
  await expect(page.locator('.ds-quiz-answer')).toHaveCount(0);

  const submit = page.getByRole('button', { name: 'Submit answer' });
  expect(await isUncovered(page, '.ds-quiz-actions .ds-primary')).toBe(true);
  await submit.click();

  // after submitting, the answer appears and Next takes keyboard focus
  await expect(page.locator('.ds-quiz-answer')).toContainText(question);
  await expect(page.getByRole('button', { name: /Next tooth|Finish/ })).toBeFocused();
  await expect(page).toHaveURL(/\/$/);

  await page.getByRole('button', { name: 'Exit quiz mode' }).first().click();
  await expect(page.locator('.ds-quiz')).toHaveCount(0);
});

test('Back leaves the quiz instead of selecting a tooth from history', async ({ page }) => {
  await page.goto('/tooth/36/');
  await expect(page.getByRole('heading', { name: 'Mandibular left first molar' })).toBeVisible();
  await page.locator('.ds-mode-switch button:visible, .ds-mobile-mode:visible').filter({ hasText: /^\s*Quiz\s*$/ }).first().click();
  await expect(page.locator('.ds-quiz')).toBeVisible();
  await expect(page).toHaveURL(/\/$/);
  await page.goBack();
  await expect(page.locator('.ds-quiz')).toHaveCount(0);
});

test('the quiz layout keeps the title, prompt and controls clear of each other', async ({ page }, testInfo) => {
  await enterQuiz(page);
  await page.getByLabel('Or pick by board position').selectOption({ index: 1 });
  // the dock's inspection tools must not cover the card's main action
  expect(await isUncovered(page, '.ds-quiz-actions .ds-primary')).toBe(true);
  if (testInfo.project.name === 'phone') {
    const title = (await page.locator('.ds-title').boundingBox())!;
    for (const el of await page.locator('.ds-top-actions > *:visible').all()) {
      const b = (await el.boundingBox())!;
      expect(b.x >= title.x + title.width || b.y >= title.y + title.height).toBe(true);
    }
  }
});

import { expect, test, type Page, type TestInfo } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('ds.guide.seen.v1', 'seen'));
});

const TITLE = 'Found an issue, or something you want to tell me?';

async function openForm(page: Page, testInfo: TestInfo) {
  await page.goto('/');
  if (testInfo.project.name === 'phone') {
    // the header has no room on phones; the About dialog links to the form
    await expect(page.locator('.ds-identity').getByRole('button', { name: 'Feedback', exact: true })).toBeHidden();
    await page.getByRole('button', { name: 'About Dental Scope', exact: true }).click();
    await page.getByRole('dialog', { name: 'About Dental Scope', exact: true }).getByRole('button', { name: 'Feedback', exact: true }).click();
  } else await page.locator('.ds-identity').getByRole('button', { name: 'Feedback', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: TITLE });
  await expect(dialog).toBeVisible();
  return dialog;
}

test('feedback form sends the message with page context', async ({ page }, testInfo) => {
  let posted: Record<string, unknown> | null = null;
  await page.route('**/api/contact', async (route) => {
    posted = route.request().postDataJSON() as Record<string, unknown>;
    await route.fulfill({ status: 200, contentType: 'application/json', body: '{"ok":true}' });
  });
  const dialog = await openForm(page, testInfo);
  await dialog.getByRole('radio', { name: 'An idea or request' }).check();
  await dialog.getByRole('textbox', { name: 'Name (optional)' }).fill('Anna');
  await dialog.getByRole('textbox', { name: 'Email (optional, so I can reply)' }).fill('anna@example.com');
  await dialog.getByRole('textbox', { name: 'Message' }).fill('Please add the primary canines to the quiz.');
  await dialog.getByRole('button', { name: 'Send', exact: true }).click();
  await expect(dialog.getByRole('status')).toHaveText('Thank you! Your message has been sent.');
  expect(posted).toMatchObject({ kind: 'idea', name: 'Anna', email: 'anna@example.com', lang: 'en', website: '' });
  expect(String(posted!.page)).toContain('127.0.0.1');
  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();
});

test('without the email function the form points to GitHub issues', async ({ page }, testInfo) => {
  // `vite preview` has no /api function, like a fork on a static host
  const dialog = await openForm(page, testInfo);
  await dialog.getByRole('textbox', { name: 'Message' }).fill('Something looks wrong on tooth 36.');
  await dialog.getByRole('button', { name: 'Send', exact: true }).click();
  await expect(dialog.getByRole('alert')).toContainText('not available on this copy');
  await expect(dialog.getByRole('link', { name: 'Open an issue on GitHub' })).toHaveAttribute('href', /\/issues\/new$/);
  // the draft is kept
  await expect(dialog.getByRole('textbox', { name: 'Message' })).toHaveValue('Something looks wrong on tooth 36.');
});

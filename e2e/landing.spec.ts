/// Browser smoke tests for the public landing page and the unauthenticated route guard.
import { expect, test } from '@playwright/test';

test.describe('auth gateway', () => {
  test('renders the landing page with a PAT login form', async ({ page }) => {
    await page.goto('/');

    await expect(page.getByRole('heading', { level: 1, name: 'NekoGit' })).toBeVisible();
    await expect(page.locator('#github-pat-input')).toBeVisible();

    const cookies = await page.context().cookies();
    const csrfCookie = cookies.find((cookie) => cookie.name === 'nekogit_csrf');
    expect(csrfCookie?.value.length).toBeGreaterThan(20);
  });

  test('redirects unauthenticated dashboard visits to the landing page', async ({ page }) => {
    await page.goto('/dashboard');

    await expect.poll(() => new URL(page.url()).pathname).toBe('/');
    await expect(page.locator('#github-pat-input')).toBeVisible();
  });
});

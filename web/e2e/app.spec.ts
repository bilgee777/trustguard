import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

async function analyzeSample(page: Page, sample: string) {
  await page.goto('/');
  await page.getByRole('button', { name: sample }).click();
  await page.getByRole('button', { name: 'Analyze', exact: true }).click();
  await expect(page).toHaveURL(/\/analysis\//);
}

test.describe('analysis flow', () => {
  test('a phishing email is rated critical with explained, linked evidence', async ({ page }) => {
    await analyzeSample(page, 'Phishing email');
    await expect(page.getByRole('heading', { name: 'Analysis result' })).toBeFocused();
    await expect(page.getByText('Critical risk', { exact: true })).toBeVisible();
    await expect(page.getByText(/Demo: Phishing email/)).toBeVisible();
    await expect(page.getByRole('heading', { name: /Sender address/ })).toBeVisible();

    const first = page.getByRole('button', { name: 'Highlight in text' }).first();
    await first.click();
    await expect(page.locator('mark[data-active]').first()).toBeVisible();
    await expect(page.getByRole('button', { name: 'Clear highlight' })).toHaveAttribute('aria-pressed', 'true');
  });

  test('a legitimate message is low risk but never called safe', async ({ page }) => {
    await analyzeSample(page, 'Legitimate message');
    await expect(page.getByText('Low risk', { exact: true })).toBeVisible();
    await expect(page.getByText(/a low score is not a guarantee/)).toBeVisible();
    await expect(page.getByText('Official Amazon domain.')).toBeVisible();
  });

  test('works with the keyboard alone', async ({ page }) => {
    await page.goto('/');
    await page.getByLabel('Content to analyze').focus();
    await page.keyboard.type('Send me the OTP code we sent you, urgent!');
    await page.keyboard.press('Control+Enter');
    await expect(page).toHaveURL(/\/analysis\//);
    await expect(page.getByRole('heading', { name: 'Asks for a one-time code' })).toBeVisible();
  });

  test('results are not persisted across reloads', async ({ page }) => {
    await analyzeSample(page, 'Fake bank SMS');
    await page.reload();
    await expect(page.getByRole('heading', { name: 'This result is no longer available' })).toBeVisible();
  });

  test('links from a result open in the URL Inspector without visiting them', async ({ page }) => {
    const requests: string[] = [];
    page.on('request', (r) => requests.push(r.url()));
    await analyzeSample(page, 'Fake delivery notification');
    await page.getByRole('button', { name: 'Inspect link' }).click();
    await expect(page).toHaveURL(/url-inspector/);
    await expect(page.getByText('dhl-parcel-redelivery.xyz').first()).toBeVisible();
    expect(requests.some((u) => u.includes('dhl-parcel-redelivery'))).toBe(false);
  });
});

test.describe('URL Inspector', () => {
  test('reveals the real host behind an @ sign', async ({ page }) => {
    await page.goto('/url-inspector');
    await page.getByLabel('Link to inspect').fill('https://www.paypal.com@login-check.example/account');
    await page.getByRole('button', { name: 'Inspect', exact: true }).click();
    await expect(page.getByText(/This link really opens login-check\.example/)).toBeVisible();
  });

  test('explains invalid input', async ({ page }) => {
    await page.goto('/url-inspector');
    await page.getByRole('button', { name: 'Inspect', exact: true }).click();
    await expect(page.getByRole('alert')).toHaveText('Paste the link you want to inspect.');
  });
});

test.describe('app shell', () => {
  test('demo scenarios run through the live engine', async ({ page }) => {
    await page.goto('/demo');
    await page.getByRole('button', { name: 'Run analysis' }).nth(3).click();
    await expect(page).toHaveURL(/\/analysis\//);
    await expect(page.getByText(/Demo: Cryptocurrency investment scam/)).toBeVisible();
  });

  test('theme choice persists across reloads', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: 'Dark theme' }).click();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
    await page.getByRole('button', { name: 'Light theme' }).click();
    await page.reload();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  });

  test('unknown routes show a helpful 404', async ({ page }) => {
    await page.goto('/does-not-exist');
    await expect(page.getByRole('heading', { name: 'This page does not exist' })).toBeVisible();
  });
});

test.describe('accessibility (axe, WCAG 2.1 AA)', () => {
  for (const theme of ['light', 'dark'] as const) {
    test.describe(theme, () => {
      test.use({ colorScheme: theme });
      for (const path of ['/', '/url-inspector', '/demo', '/privacy']) {
        test(`${path} has no violations`, async ({ page }) => {
          await page.goto(path);
          const results = await new AxeBuilder({ page })
            .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
            .analyze();
          expect(
            results.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`),
          ).toEqual([]);
        });
      }
      test('result page has no violations', async ({ page }) => {
        await analyzeSample(page, 'Fake remote job offer');
        const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
        expect(results.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`)).toEqual(
          [],
        );
      });
    });
  }
});

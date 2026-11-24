import { expect, test, type Page } from '@playwright/test';

/**
 * The whole account lifecycle against the real API and a real database. Runs only when E2E_API is set,
 * because it needs the .NET API and PostgreSQL behind the web server's /api proxy.
 */
test.skip(!process.env.E2E_API, 'Needs the API and a database (set E2E_API=1).');

const PASSWORD = 'correct horse battery staple';
const PII_MESSAGE =
  'Your PayPal account is limited. Call +90 532 123 45 67, card 4111 1111 1111 1111. Verify at https://paypa1-login.top/signin?token=SECRET123 now';

/** On narrow screens the account controls live in the collapsed menu; on wide screens they are always visible. */
async function openMenuIfCollapsed(page: Page) {
  const toggle = page.getByRole('button', { name: 'Open menu' });
  if (await toggle.isVisible()) await toggle.click();
}

async function analyze(page: Page, text: string) {
  await page.goto('/');
  await page.getByRole('radio', { name: 'Email' }).click();
  await page.getByLabel('Content to analyze').fill(text);
  await page.getByRole('button', { name: 'Analyze', exact: true }).click();
  await expect(page).toHaveURL(/\/analysis\//);
}

async function saveHistoryMode(page: Page, mode: string | RegExp) {
  await page.goto('/settings');
  await page.getByRole('radio', { name: mode }).check();
  await page.getByRole('button', { name: 'Save settings' }).click();
  await expect(page.getByText('Settings saved.')).toBeVisible();
}

test('account lifecycle: privacy by default, opt-in history, masking, deletion', async ({ page }) => {
  const email = `e2e-${Date.now()}-${Math.floor(Math.random() * 1e6)}@example.com`;

  await test.step('an anonymous analysis never leaves the browser', async () => {
    const apiCalls: string[] = [];
    page.on('request', (request) => {
      if (request.url().includes('/api/analyses')) apiCalls.push(request.url());
    });
    await page.goto('/');
    await page.getByRole('button', { name: 'Fake bank SMS' }).click();
    await page.getByRole('button', { name: 'Analyze', exact: true }).click();
    await expect(page).toHaveURL(/\/analysis\//);
    await expect(page.getByText('Analyzed in your browser.')).toBeVisible();
    expect(apiCalls).toEqual([]);
  });

  await test.step('private pages send visitors to sign in', async () => {
    await page.goto('/history');
    await expect(page).toHaveURL(/\/login$/);
  });

  await test.step('sign-up validates input before the server sees it', async () => {
    await page.goto('/register');
    await page.getByRole('button', { name: 'Create account' }).click();
    await expect(page.getByText('Enter your name.')).toBeVisible();
    await expect(page.getByText('Enter a valid email address.')).toBeVisible();
    await expect(page.getByLabel('Name')).toBeFocused();
    await page.getByLabel('Password', { exact: true }).fill('short');
    await page.getByLabel('Name').fill('E2E User');
    await page.getByLabel('Email').fill(email);
    await page.getByRole('button', { name: 'Create account' }).click();
    await expect(page.getByText('Use at least 10 characters.')).toBeVisible();
  });

  await test.step('creating the account signs the user in', async () => {
    await page.getByLabel('Password', { exact: true }).fill(PASSWORD);
    await page.getByRole('button', { name: 'Create account' }).click();
    await expect(page).toHaveURL('/');
    await openMenuIfCollapsed(page);
    await expect(page.getByRole('link', { name: /Settings for E2E User/ })).toBeVisible();
  });

  await test.step('history starts off, the most private choice', async () => {
    await page.goto('/settings');
    await expect(page.getByRole('radio', { name: /^Off/ })).toBeChecked();
    await page.goto('/history');
    await expect(page.getByRole('heading', { name: 'History is turned off' })).toBeVisible();
  });

  await test.step('with masked-text history on, the message is saved without personal data', async () => {
    await saveHistoryMode(page, /Summary and masked text/);
    await analyze(page, PII_MESSAGE);
    await expect(page.getByText('Saved to your history with personal data masked.')).toBeVisible();
    await page.getByRole('link', { name: 'Open in history' }).click();

    await expect(page.getByText('Saved copy', { exact: true })).toBeVisible();
    const body = await page.locator('main').innerText();
    expect(body).toContain('[card]');
    expect(body).toContain('[phone]');
    expect(body).not.toContain('4111');
    expect(body).not.toContain('532 123');
    expect(body).not.toContain('SECRET123');
  });

  await test.step('the list can be searched and filtered, and the filter lives in the URL', async () => {
    await page.goto('/history');
    await expect(page.getByRole('list', { name: 'Saved analyses' }).getByRole('listitem')).toHaveCount(1);

    await page.getByLabel('Search').fill('zzzz-no-such-thing');
    await expect(page.getByRole('heading', { name: 'No analyses match these filters' })).toBeVisible();
    await expect(page).toHaveURL(/q=zzzz-no-such-thing/);

    await page.getByRole('button', { name: 'Clear filters' }).first().click();
    await expect(page.getByRole('list', { name: 'Saved analyses' }).getByRole('listitem')).toHaveCount(1);

    await page.getByRole('checkbox', { name: 'Low' }).check();
    await expect(page.getByRole('heading', { name: 'No analyses match these filters' })).toBeVisible();
    await page.getByRole('checkbox', { name: 'Low' }).uncheck();
    await page.getByRole('checkbox', { name: 'Critical' }).check();
    await expect(page.getByRole('list', { name: 'Saved analyses' }).getByRole('listitem')).toHaveCount(1);
  });

  await test.step('stepping down to summary-only deletes the stored text', async () => {
    await page.goto('/settings');
    await page.getByRole('radio', { name: /^Summary only/ }).check();
    await expect(page.getByText(/permanently delete the masked message text/)).toBeVisible();
    await page.getByRole('button', { name: 'Save settings' }).click();
    await expect(page.getByText('Settings saved.')).toBeVisible();

    await page.goto('/history');
    await page.getByRole('list', { name: 'Saved analyses' }).getByRole('link').first().click();
    await expect(page.getByText('Summary only').first()).toBeVisible();
    await expect(page.getByText('Only a summary was saved. The message text was never stored.')).toBeVisible();
  });

  await test.step('deleting an analysis needs confirmation and empties the list', async () => {
    await page.goto('/history');
    await page.getByRole('button', { name: /Delete the analysis from/ }).click();
    const dialog = page.getByRole('dialog', { name: 'Delete this analysis?' });
    await expect(dialog.getByRole('button', { name: 'Cancel' })).toBeFocused();
    await dialog.getByRole('button', { name: 'Delete analysis' }).click();
    await expect(page.getByRole('heading', { name: 'No saved analyses yet' })).toBeVisible();
  });

  await test.step('signing out protects private pages, and sign-in returns to where the user was headed', async () => {
    await openMenuIfCollapsed(page);
    await page.getByRole('button', { name: 'Sign out' }).click();
    await openMenuIfCollapsed(page);
    await expect(page.getByRole('link', { name: 'Sign in' })).toBeVisible();
    await page.goto('/history');
    await expect(page).toHaveURL(/\/login$/);

    await page.getByLabel('Email').fill(email);
    await page.getByLabel('Password', { exact: true }).fill('wrong password here');
    await page.getByRole('button', { name: 'Sign in', exact: true }).click();
    await expect(page.getByText('Email or password is incorrect.')).toBeVisible();

    await page.getByLabel('Password', { exact: true }).fill(PASSWORD);
    await page.getByRole('button', { name: 'Sign in', exact: true }).click();
    await expect(page).toHaveURL(/\/history$/);
  });

  await test.step('the session survives a reload', async () => {
    await page.reload();
    await expect(page.getByRole('heading', { name: 'History', exact: true })).toBeVisible();
  });

  await test.step('deleting the account removes it for good', async () => {
    await page.goto('/settings');
    await page.getByRole('button', { name: 'Delete my account' }).click();
    const dialog = page.getByRole('dialog', { name: 'Delete your account?' });
    await dialog.getByLabel('Confirm with your password').fill('not my password');
    await dialog.getByRole('button', { name: 'Delete account' }).click();
    await expect(dialog.getByText('Enter your current password to delete the account.')).toBeVisible();

    await dialog.getByLabel('Confirm with your password').fill(PASSWORD);
    await dialog.getByRole('button', { name: 'Delete account' }).click();
    await expect(page).toHaveURL('/');

    await page.goto('/login');
    await page.getByLabel('Email').fill(email);
    await page.getByLabel('Password', { exact: true }).fill(PASSWORD);
    await page.getByRole('button', { name: 'Sign in', exact: true }).click();
    await expect(page.getByText('Email or password is incorrect.')).toBeVisible();
  });
});

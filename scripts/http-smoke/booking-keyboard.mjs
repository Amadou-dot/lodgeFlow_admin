import assert from 'node:assert/strict';
import { chromium, expect as playwrightExpect } from 'playwright/test';

const expect = playwrightExpect.configure({ timeout: 30_000 });

async function navigateTo(page, target, key = 'Tab') {
  await expect(target).toBeVisible();
  for (let i = 0; i < 60; i++) {
    if (await target.evaluate(el => el === document.activeElement)) return;
    await page.keyboard.press(key);
  }
  await expect(target).toBeFocused();
}

async function checkPreview(page) {
  const opener = page.getByRole('button', { name: 'Print / Download' });
  await navigateTo(page, opener);
  await page.keyboard.press('Enter');

  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();
  await expect(dialog).toHaveAccessibleName('Print Preview');
  await expect(page.locator('[role="dialog"]:focus-within')).toBeVisible();
  for (const key of ['Tab', 'Shift+Tab']) {
    const visited = new Set();
    for (let i = 0; i < 4; i++) {
      await page.keyboard.press(key);
      await expect(page.locator('[role="dialog"]:focus-within')).toBeVisible();
      visited.add(
        await dialog
          .locator(':focus')
          .evaluate(
            el => el.getAttribute('aria-label') || el.textContent.trim()
          )
      );
    }
    for (const button of ['Close', 'Print', 'Download PDF']) {
      assert(visited.has(button), `${key} did not reach ${button}`);
    }
  }
  await page.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0);
  await expect(opener).toBeFocused();
}

async function checkPaymentDialog(page) {
  const opener = page.getByRole('button', {
    name: 'Record Payment',
    exact: true,
  });
  await navigateTo(page, opener);
  await page.keyboard.press('Enter');
  const payment = page.getByRole('dialog', { name: /Record Payment/ });
  const method = payment.getByRole('button', {
    name: /Select payment method/i,
  });
  await navigateTo(page, method);
  await page.keyboard.press('Space');
  const options = page.getByRole('listbox');
  await expect(options).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(options).toBeHidden();
  await expect(method).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(payment).toHaveCount(0);
  await expect(opener).toBeFocused();
}

export async function verifyBookingKeyboard({ origin, headers }) {
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage({
      viewport: { width: 1440, height: 900 },
    });
    page.setDefaultTimeout(60_000);
    const pageErrors = [];
    page.on('pageerror', error => pageErrors.push(error.message));
    await page.route('**/*', route => {
      const url = new URL(route.request().url());
      // The staff test UI uses the signed session on the server. Keep the
      // hosted Clerk browser client out of this local keyboard check.
      if (
        url.hostname === 'clerk.smoke.test' &&
        url.pathname.endsWith('/clerk.browser.js')
      ) {
        return route.fulfill({
          contentType: 'application/javascript',
          headers: { 'access-control-allow-origin': origin },
          body: 'window.Clerk = { load: async () => {} };',
        });
      }
      if (url.origin !== origin) return route.abort();
      return route.continue({
        headers: { ...route.request().headers(), ...headers },
      });
    });
    const listResponse = page.waitForResponse(
      response => new URL(response.url()).pathname === '/api/bookings'
    );
    await page.goto(`${origin}/bookings`);
    const {
      data: [first, second],
    } = await (await listResponse).json();
    assert(first && second, 'The check needs two distinct bookings');
    assert.notEqual(first._id, second._id);
    const grid = page.getByRole('grid', { name: 'Bookings table' });
    const rows = grid.locator('tbody').getByRole('row');
    await expect(rows.nth(1)).toBeVisible();
    await navigateTo(page, rows.first());
    await page.keyboard.press('ArrowDown');
    await expect(rows.nth(1)).toBeFocused();
    assert(await rows.nth(1).evaluate(row => row.matches(':focus-visible')));
    await page.keyboard.press('Enter');
    await expect(page).toHaveURL(`${origin}/bookings/${second._id}`);
    await expect(
      page.getByText(`Booking ID: ${second._id}`, { exact: true })
    ).toBeVisible();
    await checkPreview(page);

    await page.goto(`${origin}/bookings`);
    const actions = rows
      .first()
      .getByRole('button', { name: 'Booking actions' });
    const details = page.getByRole('menuitem', { name: 'View Details' });
    await navigateTo(page, rows.first());
    await navigateTo(page, actions, 'ArrowRight');
    await page.keyboard.press('Enter');
    await expect(details).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(page).toHaveURL(`${origin}/bookings/${first._id}`);
    await checkPaymentDialog(page);

    await page.goto(`${origin}/bookings`);
    await actions.scrollIntoViewIfNeeded();
    await actions.click();
    await details.click();
    await expect(page).toHaveURL(`${origin}/bookings/${first._id}`);
    assert.deepEqual(pageErrors, []);
    console.log(
      `PASS Chromium ${browser.version()} desktop booking row, actions menu, Print Preview and nested payment method focus`
    );
  } finally {
    await browser.close();
  }
}

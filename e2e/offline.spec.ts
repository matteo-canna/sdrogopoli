// App installabile e offline.
import { expect, test } from '@playwright/test';
import { apri } from './aiuti';

test('installabile e giocabile senza rete', async ({ page, context }) => {
  await apri(page, { 'sdrogopoli-vista': '2d' });
  await page.evaluate(() => navigator.serviceWorker.ready);
  await page.reload();
  const cdp = await context.newCDPSession(page);
  const { installabilityErrors } = await cdp.send('Page.getInstallabilityErrors');
  expect(installabilityErrors).toEqual([]);
  await context.setOffline(true);
  await page.reload();
  await expect(page.locator('#setup-form')).toBeVisible();
  await page.click('#setup-form button[type=submit]');
  await expect(page.locator('.board')).toBeVisible();
});

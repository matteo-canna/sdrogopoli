// Schermata iniziale giocosa: lo sfondo animato si sceglie nelle impostazioni e con il movimento ridotto sta fermo.
import { expect, test } from '@playwright/test';
import { apri } from './aiuti';

test('lo sfondo si cambia dalle impostazioni e resta scelto', async ({ page }) => {
  await apri(page);
  await expect(page.locator('.setup-bg.bg-citta')).toHaveCount(1);
  await page.click('[data-settings]');
  await page.locator('.settings-dialog input[name=background][value=festa]').check();
  await expect(page.locator('.setup-bg.bg-festa')).toHaveCount(1);
  await expect(page.locator('.setup-bg')).toHaveCount(1);
  await page.keyboard.press('Escape');
  await page.reload();
  await expect(page.locator('.setup-bg.bg-festa')).toHaveCount(1);
  // le animazioni ci sono…
  expect(await page.locator('.bg-float').first().evaluate((el) => getComputedStyle(el).animationName)).not.toBe('none');
});

test('con il movimento ridotto lo sfondo e il titolo stanno fermi', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await apri(page);
  for (const sel of ['.bg-cloud', '.bg-plane', '.title-letters span']) {
    expect(await page.locator(sel).first().evaluate((el) => getComputedStyle(el).animationName), sel).toBe('none');
  }
});

test('toccando un giocatore del riepilogo si sceglie la sua pedina', async ({ page }) => {
  await apri(page);
  await page.click('[data-summary-look="1"]');
  await expect(page.locator('.look-dialog')).toBeVisible();
  await expect(page.locator('.look-dialog [data-look-seat="1"]')).toHaveAttribute('aria-pressed', 'true');
});

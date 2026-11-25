// Accessibilità oltre axe: partita solo da tastiera, annunci per il lettore di schermo, impostazioni.
import { expect, test } from '@playwright/test';
import { apri, stato } from './aiuti';
import type { Page } from '@playwright/test';

// Con il solo Tab si arriva al nome del primo giocatore, poi Invio avvia la partita.
async function iniziaConLaTastiera(page: Page): Promise<void> {
  for (let i = 0; i < 80; i++) {
    await page.keyboard.press('Tab');
    if (await page.evaluate(() => (document.activeElement as HTMLInputElement | null)?.name === 'p0')) break;
  }
  await expect(page.locator('input[name=p0]')).toBeFocused();
  await page.keyboard.press('Enter');
  await page.locator('.game').waitFor();
}

test('una partita giocata solo con la tastiera: il focus resta sul pulsante del turno', async ({ page }, info) => {
  test.skip(info.project.name === 'telefono', 'la tastiera si prova sul computer');
  const errori: string[] = [];
  page.on('pageerror', (e) => errori.push(e.message));
  await apri(page, { 'sdrogopoli-vista': '2d', 'sdrogopoli-velocita': 'istantanea' });
  await iniziaConLaTastiera(page);
  await expect(page.locator('.actions [data-action=roll]')).toBeFocused();
  // si preme solo Invio sul pulsante che ha il focus, finché si arriva al giro 4
  let mosse = 0;
  await expect
    .poll(
      async () => {
        const s = await stato(page);
        if (s.phase === 'gameOver' || s.round >= 4) return true;
        const pronto = await page.evaluate(() => {
          const el = document.activeElement as HTMLButtonElement | null;
          return !!el && el.tagName === 'BUTTON' && !el.disabled && !!el.closest('.actions') && !el.closest('.game.busy');
        });
        if (pronto) {
          await page.keyboard.press('Enter');
          mosse++;
        }
        return false;
      },
      { timeout: 90_000, intervals: [50] },
    )
    .toBe(true);
  expect(mosse).toBeGreaterThan(5);
  expect(errori).toEqual([]);
  // gli annunci per il lettore di schermo raccontano le mosse
  await expect(page.locator('#annunci')).toHaveAttribute('aria-live', 'polite');
  await expect(page.locator('#annunci')).not.toBeEmpty();
});

test('tabellone con le frecce: una sola sosta del Tab, Invio apre la carta, Esc la chiude', async ({ page }, info) => {
  test.skip(info.project.name === 'telefono', 'la tastiera si prova sul computer');
  await apri(page, { 'sdrogopoli-vista': '2d', 'sdrogopoli-velocita': 'istantanea' });
  await iniziaConLaTastiera(page);
  // una sola casella del tabellone entra nel giro del Tab
  await expect(page.locator('.board [data-space][tabindex="0"]')).toHaveCount(1);
  await page.locator('.board [data-space][tabindex="0"]').focus();
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('ArrowRight');
  const id = await page.evaluate(() => (document.activeElement as HTMLElement).dataset.space);
  expect(id).toBe('periferia-2');
  await page.keyboard.press('Enter');
  await expect(page.locator('.space-card')).toBeVisible();
  await expect(page.locator('#annunci')).toContainText('Carta aperta');
  await expect(page.locator('.board [data-space="periferia-2"]')).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(page.locator('.space-card')).toHaveCount(0);
  await expect(page.locator('.board [data-space="periferia-2"]')).toBeFocused();
});

test('impostazioni: testo, movimento e volumi si salvano e valgono subito', async ({ page }) => {
  await apri(page, { 'sdrogopoli-vista': '2d' });
  await page.click('[data-settings]');
  const finestra = page.locator('.settings-dialog');
  await expect(finestra).toBeVisible();
  await finestra.getByLabel('Molto grande').check();
  await finestra.getByLabel('Ridotto').check();
  await finestra.locator('input[name=musicVolume]').fill('30');
  const radice = page.locator('html');
  await expect(radice).toHaveAttribute('data-text', 'enorme');
  await expect(radice).toHaveAttribute('data-motion', 'ridotto');
  expect(await page.evaluate(() => getComputedStyle(document.documentElement).fontSize)).toBe('20px');
  await finestra.getByRole('button', { name: 'Fatto' }).click();
  await expect(finestra).toHaveCount(0);
  await page.reload();
  await expect(radice).toHaveAttribute('data-text', 'enorme');
  const salvate = await page.evaluate(() => JSON.parse(localStorage.getItem('sdrogopoli-impostazioni') ?? '{}'));
  expect(salvate).toMatchObject({ text: 'enorme', motion: 'ridotto', musicVolume: 30 });
});

test('tabellone 3D: con le frecce si scelgono le caselle', async ({ page }, info) => {
  test.skip(info.project.name === 'telefono', 'la tastiera si prova sul computer');
  await apri(page, { 'sdrogopoli-vista': '3d', 'sdrogopoli-velocita': 'istantanea' });
  await iniziaConLaTastiera(page);
  const tabellone = page.locator('.board3d');
  await expect(tabellone.locator('canvas')).toBeVisible({ timeout: 30_000 });
  await tabellone.focus();
  await page.keyboard.press('ArrowRight');
  await expect(page.locator('.space-card')).toBeVisible();
  await expect(page.locator('#annunci')).toContainText('Carta aperta');
  await expect(tabellone).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(page.locator('.space-card')).toHaveCount(0);
});

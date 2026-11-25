// Quote di quartiere ed edifici speciali: si accendono nelle regole della casa, si comprano dalla
// carta della casella e si vedono sul tabellone.
import { expect, test } from '@playwright/test';
import { apri, stato } from './aiuti';

test('quote ed edifici speciali dalla carta della casella', async ({ page }, info) => {
  test.skip(info.project.name === 'telefono', 'basta il computer');
  const errori: string[] = [];
  page.on('pageerror', (e) => errori.push(e.message));
  await apri(page, { 'sdrogopoli-vista': '2d', 'sdrogopoli-velocita': 'istantanea' });
  const form = page.locator('#setup-form');
  await form.locator('details.house-rules > summary').click();
  await form.locator('input[name=shares]').check();
  await form.locator('input[name=landmarks]').check();
  await form.locator('button[type=submit]').click();
  await page.locator('.game').waitFor();

  // tocca alla persona: compra una quota della Periferia
  await page.click('.board [data-space="periferia-1"]');
  const card = page.locator('.space-card');
  await expect(card.locator('.extras.shares')).toContainText('0 su 3 vendute');
  await card.locator('[data-action=buyShare]').click();
  await expect(page.locator('.space-card .extras.shares')).toContainText('1 su 3 vendute');
  const s1 = (await stato(page)) as unknown as { shares: Record<string, number[]> };
  expect(s1.shares.periferia).toEqual([0]);

  // con tutta la Periferia si può costruire un edificio speciale
  await page.evaluate(() => {
    const raw = JSON.parse(localStorage.getItem('sdrogopoli-partita')!);
    for (const id of ['periferia-1', 'periferia-2']) raw.state.ownership[id] = { owner: 0, houses: 0, mortgaged: false };
    raw.state.players[0].money = 1500;
    localStorage.setItem('sdrogopoli-partita', JSON.stringify(raw));
  });
  await page.reload();
  await page.locator('[data-resume]').click();
  await page.click('.board [data-space="periferia-1"]');
  const pick = page.locator('.space-card .landmark-pick button');
  await expect(pick).toHaveCount(3);
  await page.locator('.space-card [data-landmark=teatro]').click();
  await expect(page.locator('.space-card .extras.landmarks')).toContainText('Teatro');
  // il teatro si vede sulle vie del quartiere
  await expect(page.locator('.board [data-space="periferia-2"] .lm')).toHaveText('🎭');
  // e si annulla come le case
  await page.locator('[data-action=undo]').click();
  await expect(page.locator('.board [data-space="periferia-2"] .lm')).toHaveCount(0);
  expect(errori).toEqual([]);
});

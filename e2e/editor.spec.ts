// Editor di tabelloni: si parte da Valle Stretta, si cambiano nome, una via, un colore e un prezzo,
// si salva, si gioca; poi il link porta lo stesso tabellone in un browser che non ce l'ha.
import { expect, test } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { apri, giocaUnPasso } from './aiuti';

test('crea, gioca e condividi un tabellone', async ({ page, browser }, info) => {
  test.skip(info.project.name === 'telefono', 'basta il computer');
  const errori: string[] = [];
  page.on('pageerror', (e) => errori.push(e.message));
  await apri(page, { 'sdrogopoli-vista': '2d', 'sdrogopoli-velocita': 'istantanea' });

  await page.click('[data-board-editor]');
  const ed = page.locator('dialog.board-editor');
  await expect(ed).toBeVisible();
  await ed.locator('[data-be-base]').selectOption('valle');
  await expect(ed.locator('.be-ok')).toBeVisible();

  // un nome non valido blocca il salvataggio e lo dice
  const via = ed.locator('[data-space-name="v-pineta-1"]');
  await via.fill('<b>');
  await expect(ed.locator('.be-errors')).toContainText('casella 2 ');
  await expect(via).toHaveAttribute('aria-invalid', 'true');
  await expect(ed.locator('[data-be-save]')).toBeDisabled();

  await via.fill('Via dei Ciliegi');
  await ed.locator('input[name=title]').fill('Paese di Prova');
  await ed.locator('input[name=money]').fill('1200');
  await ed.locator('[data-group-color="pineta"]').fill('#123456');
  await ed.locator('[data-space-price="v-pineta-1"]').fill('100');
  await expect(ed.locator('.be-ok')).toBeVisible();
  await ed.locator('[data-be-save]').click();
  await expect(ed.locator('.be-status')).toContainText('Paese di Prova');

  // il file esportato contiene il tabellone
  const [download] = await Promise.all([page.waitForEvent('download'), ed.locator('[data-be-export]').click()]);
  expect(download.suggestedFilename()).toBe('paese-di-prova.sdrogo-tabellone');
  const file = JSON.parse(readFileSync((await download.path())!, 'utf8'));
  expect(file.kind).toBe('sdrogopoli-tabellone');
  expect(file.board.spaces[1]).toMatchObject({ name: 'Via dei Ciliegi', price: 100, mortgage: 50 });

  // il link
  await ed.locator('[data-be-share]').click();
  await expect(ed.locator('[data-be-link]')).toHaveValue(/#tabellone=z/);
  const link = await ed.locator('[data-be-link]').inputValue();
  await ed.locator('.be-close button').click();

  // il tabellone nuovo è nell'elenco ed è già scelto
  const scelto = page.locator('#setup-form input[name=board]:checked');
  await expect(scelto.locator('xpath=..')).toContainText('Paese di Prova');

  // si gioca sul tabellone nuovo, coi nomi nuovi
  await page.click('#setup-form button[type=submit]');
  await page.locator('.game').waitFor();
  await expect(page.locator('.board [data-space="v-pineta-1"]')).toContainText('Via dei Ciliegi');
  await expect(page.locator('.board [data-space]')).toHaveCount(28);
  for (let i = 0; i < 10; i++) await giocaUnPasso(page);
  // ricaricando, la partita riprende sullo stesso tabellone
  await page.reload();
  await page.locator('[data-resume]').click();
  await expect(page.locator('.board [data-space="v-pineta-1"]')).toContainText('Via dei Ciliegi');
  expect(errori).toEqual([]);

  // un altro browser, senza niente salvato, apre il link
  const altro = await browser.newContext({ baseURL: info.project.use.baseURL });
  const p2 = await altro.newPage();
  const errori2: string[] = [];
  p2.on('pageerror', (e) => errori2.push(e.message));
  await p2.addInitScript(() => localStorage.setItem('sdrogopoli-tutorial', '{"on":false}'));
  await p2.goto(link.replace(/^https?:\/\/[^/]+/, ''));
  await p2.locator('#setup-form').waitFor();
  await expect(p2.locator('.notice')).toContainText('Paese di Prova');
  await expect(p2.locator('#setup-form input[name=board]:checked').locator('xpath=..')).toContainText('Paese di Prova');
  // l'indirizzo non si porta più dietro il tabellone
  expect(new URL(p2.url()).hash).toBe('');
  expect(errori2).toEqual([]);
  await altro.close();
});

test('un link rovinato lo dice e non cambia niente', async ({ page }, info) => {
  test.skip(info.project.name === 'telefono', 'basta il computer');
  await page.addInitScript(() => localStorage.setItem('sdrogopoli-tutorial', '{"on":false}'));
  await page.goto('./#tabellone=zAAAA');
  await page.locator('#setup-form').waitFor();
  await expect(page.locator('.notice')).toContainText('non è valido');
  await expect(page.locator('#setup-form input[name=board]')).toHaveCount(2);
});

test('l\'editor sta in uno schermo da telefono', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 800 });
  await apri(page);
  await page.click('[data-board-editor]');
  const ed = page.locator('dialog.board-editor');
  await expect(ed).toBeVisible();
  // niente scorrimento in orizzontale dentro la finestra
  const { scroll, client } = await ed.evaluate((d) => ({ scroll: d.scrollWidth, client: d.clientWidth }));
  expect(scroll).toBeLessThanOrEqual(client + 1);
  await expect(ed.locator('.be-ok')).toBeVisible();
});

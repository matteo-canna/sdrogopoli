// I personaggi fatti nel codice (robottino, gatto, astronauta): si scelgono dall'editor dell'aspetto,
// il loro pezzo di codice arriva solo a chi li sceglie, e in partita si vedono sul tabellone 3D.
import { expect, test } from '@playwright/test';
import { apri, nuovaPartita } from './aiuti';

test('scegliendo il robottino il suo codice arriva solo allora', async ({ page }, info) => {
  test.skip(info.project.name === 'telefono', 'basta il computer');
  const errori: string[] = [];
  page.on('pageerror', (e) => errori.push(e.message));
  const scaricati: string[] = [];
  page.on('request', (r) => {
    if (/figures/.test(r.url())) scaricati.push(r.url());
  });
  await apri(page, { 'sdrogopoli-vista': '3d', 'sdrogopoli-velocita': 'istantanea' });

  // finché non si sceglie, il codice delle figure non viene scaricato
  expect(scaricati).toEqual([]);

  // l'editor dell'aspetto propone il robottino, e il cappello spare perché non ce l'ha
  await page.click('[data-look="0"]');
  const editor = page.locator('.look-editor');
  await editor.waitFor();
  await editor.locator('[data-character=robot]').click();
  await expect(editor.locator('[data-character=robot]')).toHaveAttribute('aria-checked', 'true');
  await expect(editor.locator('input[name^=cape]')).toHaveCount(0);
  await editor.locator('[data-look-done]').click();

  // l'anteprima 3D del posto ha bisogno della figura, quindi ora il pezzo di codice arriva
  await expect.poll(() => scaricati.length, { timeout: 30_000 }).toBeGreaterThan(0);

  await nuovaPartita(page);
  await expect(page.locator('.board3d canvas')).toBeVisible({ timeout: 30_000 });
  expect(errori).toEqual([]);
});

test('ogni figura si avvia senza errori', async ({ page }, info) => {
  test.skip(info.project.name === 'telefono', 'basta il computer');
  const errori: string[] = [];
  page.on('pageerror', (e) => errori.push(e.message));
  await apri(page, { 'sdrogopoli-vista': '3d', 'sdrogopoli-velocita': 'istantanea' });
  await page.click('[data-look="0"]');
  const editor = page.locator('.look-editor');
  await editor.waitFor();
  for (const id of ['robot', 'gatto', 'astronauta']) {
    await editor.locator(`[data-character=${id}]`).click();
    await expect(editor.locator(`[data-character=${id}]`)).toHaveAttribute('aria-checked', 'true');
  }
  await editor.locator('[data-look-done]').click();
  await nuovaPartita(page);
  await expect(page.locator('.board3d canvas')).toBeVisible({ timeout: 30_000 });
  expect(errori).toEqual([]);
});

test('le pedine da collezione si scelgono per reparto e arrivano solo se scelte', async ({ page }, info) => {
  test.skip(info.project.name === 'telefono', 'basta il computer');
  const errori: string[] = [];
  page.on('pageerror', (e) => errori.push(e.message));
  const scaricati: string[] = [];
  page.on('request', (r) => {
    if (/collection/.test(r.url())) scaricati.push(r.url());
  });
  await apri(page, { 'sdrogopoli-vista': '3d', 'sdrogopoli-velocita': 'istantanea' });
  expect(scaricati).toEqual([]);

  // una statuetta d'oro su basetta di marmo per il primo giocatore
  await page.click('[data-look="0"]');
  const editor = page.locator('.look-editor');
  await editor.locator('[data-look-family=personaggi]').click();
  await editor.locator('[data-character=char_knight]').click();
  await expect(editor.locator('[data-character=char_knight]')).toHaveAttribute('aria-checked', 'true');
  await editor.locator('[data-finish=gold]').click();
  await editor.locator('[data-base-style=marble]').click();
  await editor.locator('[data-accent="#ffffff"]').click();
  await expect.poll(() => scaricati.length, { timeout: 30_000 }).toBeGreaterThan(0);

  // un oggetto per il secondo: si passa a lui senza chiudere la finestra
  await editor.locator('[data-look-seat="1"]').click();
  await expect(editor.locator('[data-look-seat="1"]')).toHaveAttribute('aria-pressed', 'true');
  await editor.locator('[data-look-family=icone]').click();
  await editor.locator('[data-character=moka]').click();
  await editor.locator('[data-look-done]').click();

  // le scelte sono ricordate per la prossima partita
  const scelte = await page.evaluate(() => JSON.parse(localStorage.getItem('sdrogopoli-aspetto') ?? '[]'));
  expect(scelte[0]).toMatchObject({ character: 'char_knight', finish: 'gold', baseStyle: 'marble', accentColor: '#ffffff' });
  expect(scelte[1]).toMatchObject({ character: 'moka' });

  await nuovaPartita(page);
  await expect(page.locator('.board3d canvas')).toBeVisible({ timeout: 30_000 });
  expect(errori).toEqual([]);
});

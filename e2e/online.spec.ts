// Gioco online: due schede dello stesso browser si siedono allo stesso tavolo e giocano insieme.
// Con ?rete=locale le schede si parlano con BroadcastChannel invece che con WebRTC.
import { expect, test, type Page } from '@playwright/test';
import { giocaUnPasso } from './aiuti';

async function giro(page: Page): Promise<number> {
  const t = (await page.locator('.turn').first().textContent()) ?? '';
  return Number(/Giro (\d+)/.exec(t)?.[1] ?? 0);
}

test('due persone e un computer giocano online sullo stesso tavolo', async ({ context }) => {
  await context.addInitScript(() => {
    if (sessionStorage.getItem('e2e')) return;
    sessionStorage.setItem('e2e', '1');
    localStorage.setItem('sdrogopoli-tutorial', '{"on":false}');
    localStorage.setItem('sdrogopoli-vista', '2d');
    localStorage.setItem('sdrogopoli-velocita', 'istantanea');
  });
  const errori: string[] = [];
  const oste = await context.newPage();
  oste.on('pageerror', (e) => errori.push(`oste: ${e.message}`));
  await oste.goto('./?rete=locale');
  await oste.click('[data-online-create]');
  const code = (await oste.locator('[data-table-code]').textContent())!.trim();
  expect(code).toMatch(/^[A-Z2-9]{6}$/);
  await expect(oste.locator('[data-table-link]')).toHaveValue(new RegExp(`#tavolo=${code}$`));
  await oste.fill('[data-lobby-name]', 'Anna');
  await oste.locator('[data-lobby-name]').blur();
  // da soli non si può iniziare
  await expect(oste.locator('[data-lobby-start]')).toBeDisabled();

  const ospite = await context.newPage();
  ospite.on('pageerror', (e) => errori.push(`ospite: ${e.message}`));
  await ospite.goto(`./?rete=locale#tavolo=${code}`);
  await ospite.locator('[data-ready]').waitFor();
  await ospite.fill('[data-lobby-name]', 'Bruno');
  await ospite.locator('[data-lobby-name]').blur();
  await expect(oste.locator('.lobby-members li')).toHaveCount(2);
  await expect(oste.locator('.lobby-members')).toContainText('Bruno');
  await expect(ospite.locator('.lobby-members li', { hasText: 'Bruno' })).toContainText('(tu)');
  // finché l'ospite non è pronto si aspetta
  await expect(oste.locator('[data-lobby-start]')).toBeDisabled();
  await ospite.click('[data-ready]');
  await oste.click('[data-computers="1"]');
  await expect(oste.locator('.lobby-members li')).toHaveCount(3);
  await expect(oste.locator('[data-lobby-start]')).toBeEnabled();
  await oste.click('[data-lobby-start]');
  await expect(oste.locator('.game')).toBeVisible();
  await expect(ospite.locator('.game')).toBeVisible();
  await expect(ospite.locator('.saved')).toContainText(code);
  // tocca ad Anna: Bruno vede chi sta giocando invece dei pulsanti
  await expect(ospite.locator('.actions.waiting')).toContainText('gioca Anna');

  await expect
    .poll(
      async () => {
        await giocaUnPasso(oste);
        await giocaUnPasso(ospite);
        return (await giro(oste)) >= 6 || (await oste.locator('.summary').count()) > 0;
      },
      { timeout: 150_000, intervals: [100] },
    )
    .toBe(true);
  // i due schermi mostrano la stessa partita
  await expect.poll(async () => (await ospite.locator('.players-list').textContent()) === (await oste.locator('.players-list').textContent())).toBe(true);
  expect(errori).toEqual([]);

  // chi crea il tavolo esce: l'ospite lo viene a sapere
  await oste.click('[data-action=quit]');
  await oste.click('[data-action=quit]');
  await expect(oste.locator('#setup-form')).toBeAttached();
  await expect(ospite.locator('.error')).toContainText(/tavolo/);
});

test('un codice sbagliato si segnala subito', async ({ page }) => {
  await page.goto('./?rete=locale');
  await page.fill('#online-code', 'abc');
  await page.click('[data-online-join] button[type=submit]');
  await expect(page.locator('[data-online-error]')).toBeVisible();
});

test('chi ricarica la pagina, ospite o oste, torna al suo posto', async ({ context }) => {
  await context.addInitScript(() => {
    localStorage.setItem('sdrogopoli-tutorial', '{"on":false}');
    localStorage.setItem('sdrogopoli-vista', '2d');
  });
  const oste = await context.newPage();
  await oste.goto('./?rete=locale');
  await oste.click('[data-online-create]');
  const code = (await oste.locator('[data-table-code]').textContent())!.trim();
  const ospite = await context.newPage();
  await ospite.goto(`./?rete=locale#tavolo=${code}`);
  await ospite.click('[data-ready]');
  await expect(oste.locator('[data-lobby-start]')).toBeEnabled();
  await oste.click('[data-lobby-start]');
  await expect(ospite.locator('.game')).toBeVisible();

  // l'ospite ricarica: per un attimo gioca il computer, poi riprende il suo posto
  await ospite.reload();
  await expect(ospite.locator('.game')).toBeVisible();
  await expect(ospite.locator('.actions.waiting')).toBeVisible();
  await expect(oste.locator('.actions [data-action=roll]')).toBeVisible();

  // l'oste ricarica: il tavolo riparte con lo stesso codice e l'ospite resta seduto
  await oste.reload();
  await expect(oste.locator('.game')).toBeVisible();
  await expect(oste.locator('.saved')).toContainText(code);
  await expect(ospite.locator('.error')).toHaveCount(0);
  await oste.click('.actions [data-action=roll]');
  await expect(ospite.locator('.turn .roll')).toBeVisible();
});

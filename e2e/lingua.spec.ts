// Interfaccia in inglese: si sceglie da sola con la lingua del browser e si cambia dalle impostazioni.
import { expect, test } from '@playwright/test';
import { apri, nuovaPartita } from './aiuti';

test.describe('con il browser in inglese', () => {
  test.use({ locale: 'en-US' });

  test('schermata iniziale e partita in inglese, poi si passa all\'italiano', async ({ page }, info) => {
    test.skip(info.project.name === 'telefono', 'basta il computer');
    const errori: string[] = [];
    page.on('pageerror', (e) => errori.push(e.message));
    await apri(page, { 'sdrogopoli-vista': '2d', 'sdrogopoli-velocita': 'istantanea' });
    await expect(page.locator('html')).toHaveAttribute('lang', 'en');
    await expect(page.locator('#setup-form button[type=submit]')).toContainText('Start the game');
    await nuovaPartita(page);
    await expect(page.locator('.actions [data-action=roll]')).toContainText('Roll the dice');
    // le caselle che non sono vie hanno il nome inglese
    await expect(page.locator('.board')).toContainText('Start');

    await page.click('[data-action=settings]');
    const finestra = page.locator('.settings-dialog');
    await expect(finestra).toContainText('Language');
    await finestra.locator('input[name=lang][value=it]').check();
    await expect(finestra).toContainText('Lingua');
    await expect(page.locator('html')).toHaveAttribute('lang', 'it');
    await finestra.locator('button.primary').click();
    await expect(page.locator('.actions [data-action=roll]')).toContainText('Lancia i dadi');
    // la scelta resta dopo aver ricaricato la pagina
    await page.reload();
    await expect(page.getByRole('button', { name: /Continua la partita/ })).toBeVisible();
    await expect(page.locator('html')).toHaveAttribute('lang', 'it');
    expect(errori).toEqual([]);
  });
});

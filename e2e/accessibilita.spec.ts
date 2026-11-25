// Accessibilità con axe: nessun errore grave o critico nelle schermate principali.
import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { apri, nuovaPartita } from './aiuti';

async function erroriGravi(page: Page): Promise<string[]> {
  const r = await new AxeBuilder({ page }).analyze();
  return r.violations
    .filter((v) => v.impact === 'serious' || v.impact === 'critical')
    .map((v) => `${v.id}: ${v.help} (${v.nodes.map((n) => n.target.join(' ')).slice(0, 3).join(', ')})`);
}

for (const tema of ['light', 'dark'] as const) {
  test(`schermate senza errori gravi, tema ${tema}`, async ({ page }) => {
    await page.emulateMedia({ colorScheme: tema, reducedMotion: 'reduce' });
    await apri(page, { 'sdrogopoli-vista': '2d', 'sdrogopoli-velocita': 'istantanea' });
    expect(await erroriGravi(page), 'schermata iniziale').toEqual([]);
    await nuovaPartita(page);
    expect(await erroriGravi(page), 'partita 2D').toEqual([]);
    await page.click('[data-space="periferia-1"]');
    await expect(page.locator('.space-card')).toBeVisible();
    expect(await erroriGravi(page), 'carta della casella').toEqual([]);
  });
}

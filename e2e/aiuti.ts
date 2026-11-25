// Funzioni comuni ai test nel browser.
import type { Page } from '@playwright/test';

// Apre il gioco con le preferenze indicate (solo al primo caricamento della pagina).
export async function apri(page: Page, prefs: Record<string, string> = {}): Promise<void> {
  await page.addInitScript((p) => {
    if (sessionStorage.getItem('e2e')) return;
    sessionStorage.setItem('e2e', '1');
    localStorage.clear();
    localStorage.setItem('sdrogopoli-tutorial', '{"on":false}');
    for (const [k, v] of Object.entries(p)) localStorage.setItem(k, v);
  }, prefs);
  await page.goto('./');
  await page.locator('#setup-form').waitFor();
}

// Avvia una partita con i posti proposti (una persona e tre computer).
export async function nuovaPartita(page: Page): Promise<void> {
  await page.click('#setup-form button[type=submit]');
  await page.locator('.game').waitFor();
}

// Stato della partita salvata.
export async function stato(page: Page): Promise<{ round: number; phase: string; players: { bankrupt: boolean }[] }> {
  return page.evaluate(() => JSON.parse(localStorage.getItem('sdrogopoli-partita') ?? 'null')?.state);
}

// Fa giocare la persona: il pulsante principale, altrimenti passa o rinuncia.
export async function giocaUnPasso(page: Page): Promise<void> {
  const primo = async (sel: string) => {
    const l = page.locator(sel).first();
    return (await l.count()) && (await l.isVisible()) && (await l.isEnabled()) ? l : null;
  };
  const l =
    (await primo('.actions button.primary')) ??
    (await primo('.actions [data-action=pass]')) ??
    (await primo('.actions [data-action=decline]')) ??
    (await primo('.actions [data-action=endTurn]'));
  if (l) {
    await l.click();
    return;
  }
  // bancarotta: serve un secondo tocco di conferma
  const fallito = await primo('[data-action=bankrupt]');
  if (fallito) {
    await fallito.click();
    await fallito.click().catch(() => {});
  }
}

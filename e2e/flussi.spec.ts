// Test nel browser per tre flussi chiave (compito 23): annulla acquisto, scambio tra due persone e asta.
import { expect, test, type Page } from '@playwright/test';
import { apri } from './aiuti';

interface SavedPlayer {
  id: number;
  name: string;
  money: number;
  position: number;
  bankrupt: boolean;
}

interface SavedState {
  current: number;
  round: number;
  phase: string;
  players: SavedPlayer[];
  ownership: Record<string, { owner: number; houses: number; mortgaged: boolean }>;
  // turn è la posizione nella lista bidders, non il numero del giocatore
  auction?: { spaceId: string; highestBid: number; highestBidder: number | null; bidders: number[]; turn: number } | null;
}

// Legge lo stato corrente della partita dal salvataggio automatico del browser.
async function leggiStato(page: Page): Promise<SavedState> {
  return page.evaluate(() => JSON.parse(localStorage.getItem('sdrogopoli-partita') ?? 'null')?.state);
}

// Avvia una partita in 2D tra due persone (Ada e Bea) sullo stesso dispositivo, usando solo selettori accessibili.
async function avviaDuePersone(page: Page): Promise<void> {
  await apri(page, { 'sdrogopoli-vista': '2d', 'sdrogopoli-velocita': 'istantanea' });
  await page.getByRole('textbox', { name: 'Nome giocatore 1' }).fill('Ada');
  await page.getByRole('textbox', { name: 'Nome giocatore 2' }).fill('Bea');
  await page.getByRole('combobox', { name: 'Chi controlla il giocatore 2' }).selectOption('human');
  await page.getByRole('button', { name: /Inizia la partita/ }).click();
  await expect(page.getByRole('button', { name: 'Lancia i dadi' })).toBeVisible();
}

// Avanza i turni finché non si raggiunge la fase di acquisto ("buy") su una casella libera.
async function arrivaSuCasellaLibera(page: Page): Promise<SavedState> {
  const pannello = page.getByRole('complementary', { name: 'Giocatori e registro' });
  for (let passi = 0; passi < 40; passi++) {
    const s = await leggiStato(page);
    if (s.phase === 'buy') return s;
    if (s.phase === 'roll') {
      await pannello.getByRole('button', { name: /Lancia i dadi|Doppio! Rilancia|Tenta il doppio/ }).click();
    } else if (s.phase === 'cardChoice') {
      // i pulsanti di scelta della carta sono i primi pulsanti del pannello in questa fase
      await pannello.getByRole('button').first().click();
    } else if (s.phase === 'endTurn') {
      await pannello.getByRole('button', { name: 'Fine turno' }).click();
    }
  }
  throw new Error('Nessuna casella libera raggiunta entro 40 passi.');
}

test.describe('flussi di gioco nel browser', () => {
  test('acquisto e annulla: soldi e proprietario tornano come prima', async ({ page }) => {
    const errori: string[] = [];
    page.on('pageerror', (e) => errori.push(e.message));

    await avviaDuePersone(page);
    const prima = await arrivaSuCasellaLibera(page);
    const acquirente = prima.current;
    const soldiPrima = prima.players[acquirente].money;
    const proprietaPrima = Object.keys(prima.ownership);

    // Compra la casella su cui è arrivato
    await page.getByRole('button', { name: /^Compra / }).click();

    const dopoAcquisto = await leggiStato(page);
    const nuove = Object.keys(dopoAcquisto.ownership).filter((id) => !proprietaPrima.includes(id));
    expect(nuove).toHaveLength(1);
    const spaceId = nuove[0];
    expect(dopoAcquisto.ownership[spaceId].owner).toBe(acquirente);
    expect(dopoAcquisto.players[acquirente].money).toBeLessThan(soldiPrima);

    // Preme "Annulla": la casella torna libera e i soldi tornano al valore precedente
    await page.getByRole('button', { name: /Annulla/ }).click();

    const dopoAnnulla = await leggiStato(page);
    expect(dopoAnnulla.phase).toBe('buy');
    expect(dopoAnnulla.ownership[spaceId]).toBeUndefined();
    expect(dopoAnnulla.players[acquirente].money).toBe(soldiPrima);
    expect(errori).toEqual([]);
  });

  test('scambio locale tra due persone: soldi in cambio di una via', async ({ page }) => {
    const errori: string[] = [];
    page.on('pageerror', (e) => errori.push(e.message));

    await avviaDuePersone(page);
    const pannello = page.getByRole('complementary', { name: 'Giocatori e registro' });

    // Se l'avversario non ha ancora vie (partita classica), ne facciamo comprare una prima di scambiare
    let primaScambio = await leggiStato(page);
    let proponente = primaScambio.current;
    let venditore = primaScambio.players.find((p) => p.id !== proponente)!.id;
    if (!Object.values(primaScambio.ownership).some((o) => o.owner === venditore)) {
      const primaAcquisto = await arrivaSuCasellaLibera(page);
      venditore = primaAcquisto.current;
      await pannello.getByRole('button', { name: /^Compra / }).click();
      for (let i = 0; i < 15; i++) {
        const s = await leggiStato(page);
        if (s.current !== venditore && (s.phase === 'roll' || s.phase === 'endTurn')) break;
        if (s.phase === 'endTurn') await pannello.getByRole('button', { name: 'Fine turno' }).click();
        else if (s.phase === 'roll') await pannello.getByRole('button', { name: /Lancia i dadi|Doppio! Rilancia|Tenta il doppio/ }).click();
        else if (s.phase === 'buy') await pannello.getByRole('button', { name: /^Compra / }).click();
        else if (s.phase === 'cardChoice') await pannello.getByRole('button').first().click();
      }
      primaScambio = await leggiStato(page);
      proponente = primaScambio.current;
    }

    expect(proponente).not.toBe(venditore);
    const soldiProponentePrima = primaScambio.players[proponente].money;
    const soldiVenditorePrima = primaScambio.players[venditore].money;

    // La persona di turno apre lo scambio, offre 100 e chiede la prima via del venditore
    await pannello.getByRole('button', { name: /Proponi scambio/ }).click();
    await pannello.getByRole('group', { name: 'Tu dai' }).getByRole('spinbutton', { name: 'Soldi' }).fill('100');
    const casellaScelta = pannello.getByRole('group', { name: /^Chiedi a / }).getByRole('checkbox').first();
    const spaceId = await casellaScelta.getAttribute('value');
    expect(spaceId).toBeTruthy();
    await casellaScelta.check();
    await pannello.getByRole('button', { name: 'Proponi', exact: true }).click();

    // L'altra persona vede la proposta e accetta
    await expect(pannello.getByRole('button', { name: 'Accetta', exact: true })).toBeVisible();
    await pannello.getByRole('button', { name: 'Accetta', exact: true }).click();

    const dopoScambio = await leggiStato(page);
    expect(dopoScambio.ownership[spaceId!].owner).toBe(proponente);
    expect(dopoScambio.players[proponente].money).toBe(soldiProponentePrima - 100);
    expect(dopoScambio.players[venditore].money).toBe(soldiVenditorePrima + 100);
    expect(errori).toEqual([]);
  });

  test('asta: nessuno compra, un giocatore rilancia e l’altro passa', async ({ page }) => {
    const errori: string[] = [];
    page.on('pageerror', (e) => errori.push(e.message));

    await avviaDuePersone(page);
    await arrivaSuCasellaLibera(page);

    // Rifiuta l'acquisto: parte l'asta
    await page.getByRole('button', { name: "Lascia all'asta" }).click();

    const inizioAsta = await leggiStato(page);
    expect(inizioAsta.phase).toBe('auction');
    const spaceId = inizioAsta.auction!.spaceId;
    const vincitoreAtteso = inizioAsta.auction!.bidders[inizioAsta.auction!.turn];
    await expect(page.getByRole('heading', { name: /Asta:/ })).toBeVisible();

    // Il primo offerente fa un'offerta, il secondo passa
    await page.getByRole('button', { name: /^Offri / }).first().click();
    await page.getByRole('button', { name: 'Passa', exact: true }).click();

    const dopoAsta = await leggiStato(page);
    expect(dopoAsta.phase).not.toBe('auction');
    expect(dopoAsta.ownership[spaceId]?.owner).toBe(vincitoreAtteso);
    expect(errori).toEqual([]);
  });
});

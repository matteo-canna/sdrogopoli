// Test della valutazione delle aste per il computer di livello difficile (auctionValue).
import { describe, it, expect } from 'vitest';
import { applyAction, auctionValue, chooseBotAction } from '../src/engine';
import { ctxWith, newGame, own } from './helpers';

describe('auctionValue e offerte all\'asta del computer difficile', () => {
  it('restituisce il prezzo base quando il quartiere è libero e ci sono abbastanza contanti', () => {
    const s = newGame(['Anna', 'Bruno']);
    const ctx = ctxWith();
    // borgo-1 costa 100
    expect(auctionValue(s, ctx, 0, 'borgo-1')).toBe(100);
  });

  it('aggiunge un premio quando con quella casella manca una sola via per completare il quartiere', () => {
    const s = newGame(['Anna', 'Bruno']);
    const ctx = ctxWith();
    const base = auctionValue(s, ctx, 0, 'borgo-2'); // borgo ha 3 vie (100, 100, 120)
    own(s, 'borgo-1', 0);
    const withOneOwned = auctionValue(s, ctx, 0, 'borgo-2');
    expect(withOneOwned).toBeGreaterThan(base);
  });

  it('aggiunge un premio maggiore quando la casella completa il quartiere', () => {
    const s = newGame(['Anna', 'Bruno']);
    const ctx = ctxWith();
    const base = auctionValue(s, ctx, 0, 'borgo-3');
    own(s, 'borgo-1', 0);
    const missingOne = auctionValue(s, ctx, 0, 'borgo-3');
    own(s, 'borgo-2', 0);
    const completes = auctionValue(s, ctx, 0, 'borgo-3');
    expect(completes).toBeGreaterThan(missingOne);
    expect(missingOne).toBeGreaterThan(base);
  });

  it('aggiunge un premio di blocco se un avversario completerebbe un quartiere con quella casella', () => {
    const s = newGame(['Anna', 'Bruno']);
    const ctx = ctxWith();
    const base = auctionValue(s, ctx, 0, 'periferia-2');
    own(s, 'periferia-1', 1); // Bruno ha già l'altra via di Periferia
    const blocking = auctionValue(s, ctx, 0, 'periferia-2');
    expect(blocking).toBeGreaterThan(base);
  });

  it('applica una penalità se dopo l\'acquisto al prezzo base resterebbero meno di 150 contanti', () => {
    const s = newGame(['Anna', 'Bruno']);
    const ctx = ctxWith();
    const rich = auctionValue(s, ctx, 0, 'borgo-1'); // prezzo 100, contanti 1500
    s.players[0].money = 180; // dopo l'acquisto resterebbero 80 (< 150)
    const lowCash = auctionValue(s, ctx, 0, 'borgo-1');
    expect(lowCash).toBeLessThan(rich);
    expect(lowCash).toBe(30); // 100 - (150 - 80)
  });

  it('il livello difficile rilancia fino ad auctionValue, mentre facile e normale restano invariati', () => {
    let s = applyAction(newGame(['Difficile', 'Normale']), { type: 'roll' }, ctxWith(1, 2)); // periferia-2, prezzo 60
    s.players[0].isBot = true;
    s.players[0].bot = { level: 'difficile', style: 'equilibrato' };
    s.players[1].isBot = true;
    s.players[1].bot = { level: 'normale', style: 'equilibrato' };
    // A nessuno manca una sola via prima, ma il difficile ha già borgo-1 e all'asta va borgo-2 (prezzo 100)
    own(s, 'borgo-1', 0);
    s = applyAction(s, { type: 'decline' }, ctxWith());
    s.auction!.spaceId = 'borgo-2';

    const ctx = ctxWith();
    const val = auctionValue(s, ctx, 0, 'borgo-2'); // 135 (100 + 35)
    expect(val).toBe(135);

    // Con offerta attuale a 120, il normale (limite 90) passa, mentre il difficile rilancia a 130
    s.auction!.highestBid = 120;
    s.auction!.highestBidder = 1;
    s.auction!.turn = 0; // tocca al difficile
    expect(chooseBotAction(s, ctx)).toEqual({ type: 'bid', amount: 130 });

    s.auction!.turn = 1; // tocca al normale
    s.auction!.highestBidder = 0;
    expect(chooseBotAction(s, ctx)).toEqual({ type: 'pass' });

    // Superato auctionValue (offerta a 130, prossimo rilancio 140 > 135), anche il difficile passa
    s.auction!.highestBid = 130;
    s.auction!.highestBidder = 1;
    s.auction!.turn = 0;
    expect(chooseBotAction(s, ctx)).toEqual({ type: 'pass' });
  });
});

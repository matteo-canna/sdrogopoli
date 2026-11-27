// Test della regola facoltativa "aste con rilancio minimo crescente" (rules.fastAuctions).
import { describe, it, expect } from 'vitest';
import { board, cards } from '../src/data';
import {
  applyAction,
  chooseBotAction,
  createGame,
  migrateState,
  minRaise,
  RuleError,
  seededRng,
  type GameContext,
  type GameState,
} from '../src/engine';
import { ctxWith, newGame } from './helpers';

function startTestAuction(fastAuctions: boolean, names = ['Anna', 'Bruno', 'Carla', 'Dario']): GameState {
  let s = newGame(names);
  s.rules.fastAuctions = fastAuctions;
  // Tutti con molti soldi per poter testare molti rilanci di fila
  for (const p of s.players) p.money = 5000;
  s = applyAction(s, { type: 'roll' }, ctxWith(1, 2)); // Via del Cassonetto
  s = applyAction(s, { type: 'decline' }, ctxWith());
  return s;
}

describe('aste con rilancio minimo crescente (fastAuctions)', () => {
  it('con la regola spenta il rilancio minimo resta sempre 10', () => {
    let s = startTestAuction(false);
    for (let i = 0; i < 10; i++) {
      expect(minRaise(s)).toBe(10);
      s = applyAction(s, { type: 'bid', amount: s.auction!.highestBid + 10 }, ctxWith());
    }
    expect(minRaise(s)).toBe(10);
  });

  it('con la regola accesa il rilancio minimo raddoppia ogni 3 rilanci (10, 20, 40, 80…)', () => {
    let s = startTestAuction(true);
    const expectedRaises = [10, 10, 10, 20, 20, 20, 40, 40, 40, 80, 80, 80];
    for (const expected of expectedRaises) {
      expect(minRaise(s)).toBe(expected);
      const nextAmount = s.auction!.highestBid + expected;
      s = applyAction(s, { type: 'bid', amount: nextAmount }, ctxWith());
    }
    expect(s.auction!.bids).toBe(12);
    expect(minRaise(s)).toBe(160);
  });

  it('rifiuta i rilanci sotto il minimo richiesto dal passo corrente', () => {
    let s = startTestAuction(true);
    // Primi 3 rilanci: minimo 10 (offerte a 10, 20, 30)
    expect(() => applyAction(s, { type: 'bid', amount: 5 }, ctxWith())).toThrow(RuleError);
    s = applyAction(s, { type: 'bid', amount: 10 }, ctxWith());
    s = applyAction(s, { type: 'bid', amount: 20 }, ctxWith());
    s = applyAction(s, { type: 'bid', amount: 30 }, ctxWith());

    // 4° rilancio: minimo 20 (serve almeno 50)
    expect(minRaise(s)).toBe(20);
    expect(() => applyAction(s, { type: 'bid', amount: 40 }, ctxWith())).toThrow(RuleError);
    expect(() => applyAction(s, { type: 'bid', amount: 49 }, ctxWith())).toThrow(RuleError);
    s = applyAction(s, { type: 'bid', amount: 50 }, ctxWith());
    s = applyAction(s, { type: 'bid', amount: 70 }, ctxWith());
    s = applyAction(s, { type: 'bid', amount: 90 }, ctxWith());

    // 7° rilancio: minimo 40 (serve almeno 130)
    expect(minRaise(s)).toBe(40);
    expect(() => applyAction(s, { type: 'bid', amount: 120 }, ctxWith())).toThrow(RuleError);
    s = applyAction(s, { type: 'bid', amount: 130 }, ctxWith());
    expect(s.auction!.highestBid).toBe(130);
  });

  it('il computer rispetta il rilancio minimo crescente a ogni passo', () => {
    const ctx: GameContext = { board, cards };
    let s = createGame(
      ['A', 'B', 'C', 'D'].map((name) => ({ name, isBot: true })),
      ctx,
      { fastAuctions: true },
      7,
    );
    // Mettiamo all'asta la via più costosa del tabellone così i 4 computer fanno più rilanci
    const costly = board.spaces
      .filter((sp) => sp.type === 'property')
      .reduce((best, sp) => (sp.type === 'property' && best.type === 'property' && sp.price > best.price ? sp : best));
    s.players[0].position = board.spaces.findIndex((sp) => sp.id === costly.id);
    s.phase = 'buy';
    s = applyAction(s, { type: 'decline' }, ctx);

    let bidsCount = 0;
    while (s.phase === 'auction') {
      const prevHighest = s.auction!.highestBid;
      const requiredRaise = minRaise(s);
      const action = chooseBotAction(s, ctx);
      if (action.type === 'bid') {
        expect(action.amount - prevHighest).toBeGreaterThanOrEqual(requiredRaise);
        bidsCount++;
      }
      s = applyAction(s, action, ctx);
    }
    expect(bidsCount).toBeGreaterThan(6);
  });

  it('su 100 aste simulate tra 4 computer la media dei rilanci è più bassa con la regola accesa', () => {
    const buyableSpaces = board.spaces.filter(
      (sp) => sp.type === 'property' || sp.type === 'station' || sp.type === 'utility',
    );
    const styles = ['equilibrato', 'collezionista', 'costruttore', 'mercante'] as const;

    function runSimulatedAuctions(fastAuctions: boolean): number {
      let totalBids = 0;
      for (let i = 0; i < 100; i++) {
        const ctx: GameContext = { board, cards, rng: seededRng(i + 1) };
        let s = createGame(
          styles.map((style, idx) => ({
            name: `B${idx}`,
            isBot: true,
            bot: { level: idx % 2 === 0 ? 'normale' : 'difficile', style },
          })),
          ctx,
          { fastAuctions },
          i + 1,
        );
        const target = buyableSpaces[i % buyableSpaces.length];
        s.players[0].position = board.spaces.findIndex((sp) => sp.id === target.id);
        s.phase = 'buy';
        s = applyAction(s, { type: 'decline' }, ctx);
        while (s.phase === 'auction') {
          const action = chooseBotAction(s, ctx);
          if (action.type === 'bid') totalBids++;
          s = applyAction(s, action, ctx);
        }
      }
      return totalBids / 100;
    }

    const avgNormal = runSimulatedAuctions(false);
    const avgFast = runSimulatedAuctions(true);
    expect(avgFast).toBeLessThan(avgNormal);
  });

  it('migrateState completa il contatore dei rilanci per un salvataggio con fastAuctions', () => {
    const s = startTestAuction(true);
    delete (s.auction as { bids?: number }).bids;
    const migrated = migrateState(s, { board, cards }, 1);
    expect(migrated.auction?.bids).toBe(0);
    expect(minRaise(migrated)).toBe(10);
  });
});

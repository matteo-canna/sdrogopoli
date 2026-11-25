import { describe, it, expect } from 'vitest';
import { applyAction } from '../src/engine';
import { bigMoments, moneyChanges, moneyNotices } from '../src/ui/moments';
import { text } from '../src/i18n';
import { ctxWith, newGame, own } from './helpers';

describe('soldi e momenti dopo una mossa', () => {
  it('un affitto: chi paga, chi incassa, e perché', () => {
    const s = newGame();
    own(s, 'periferia-2', 1);
    const next = applyAction(s, { type: 'roll' }, ctxWith(1, 2));
    const ch = moneyChanges(s, next);
    expect(ch.find((c) => c.seat === 0)!.delta).toBeLessThan(0);
    expect(ch.find((c) => c.seat === 1)!.delta).toBe(-ch.find((c) => c.seat === 0)!.delta);
    const lines = moneyNotices(s, next).map(text);
    expect(lines).toHaveLength(1);
    expect(lines[0]).toMatch(/paga \d+ di affitto a Bruno/);
  });

  it('niente avvisi se i soldi non si muovono', () => {
    const s = newGame();
    const next = applyAction(s, { type: 'roll' }, ctxWith(1, 2));
    // periferia-2 è libera: si arriva e basta
    expect(moneyChanges(s, next)).toEqual([]);
    expect(moneyNotices(s, next)).toEqual([]);
  });

  it('quartiere completato, palazzo e bancarotta', () => {
    const ctx = ctxWith();
    const s = newGame();
    own(s, 'periferia-1', 0);
    const next = structuredClone(s);
    own(next, 'periferia-2', 0);
    expect(bigMoments(s, next, ctx).map((m) => text(m.msg))).toEqual(['Anna completa il quartiere Periferia!']);
    // già completo prima: niente da festeggiare
    expect(bigMoments(next, structuredClone(next), ctx)).toEqual([]);

    const built = structuredClone(next);
    built.ownership['periferia-1'].houses = 4;
    const hotel = structuredClone(built);
    hotel.ownership['periferia-1'].houses = 5;
    expect(bigMoments(built, hotel, ctx).map((m) => m.icon)).toEqual(['🏢']);

    const broke = structuredClone(s);
    broke.players[1].bankrupt = true;
    expect(bigMoments(s, broke, ctx).map((m) => m.msg.k)).toEqual(['moment.bankrupt']);
  });
});

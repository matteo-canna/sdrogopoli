import { describe, it, expect } from 'vitest';
import { dailyPlayers, dailyResult, dailySeed, dailyText, dayId, parseDaily, DAILY_BOTS } from '../src/ui/daily';
import { createGame } from '../src/engine';
import { board, cards } from '../src/data';
import { ctxWith, newGame, own } from './helpers';

describe('partita del giorno', () => {
  it('il giorno è quello di chi gioca, il seme ne dipende', () => {
    expect(dayId(new Date(2026, 10, 25, 23, 30))).toBe('2026-11-25');
    expect(dayId(new Date(2026, 0, 2, 0, 5))).toBe('2026-01-02');
    expect(dailySeed('2026-11-25')).toBe(dailySeed('2026-11-25'));
    expect(dailySeed('2026-11-25')).not.toBe(dailySeed('2026-11-26'));
    expect(Number.isInteger(dailySeed())).toBe(true);
  });

  it('con lo stesso seme la partita è identica per tutti', () => {
    const ctx = { board, cards };
    const names = dailyPlayers('Anna');
    expect(names).toHaveLength(DAILY_BOTS + 1);
    expect(names[0].name).toBe('Anna');
    const a = createGame(names, ctx, { maxRounds: 15 }, dailySeed('2026-11-25'));
    const b = createGame(names, ctx, { maxRounds: 15 }, dailySeed('2026-11-25'));
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
    const c = createGame(names, ctx, { maxRounds: 15 }, dailySeed('2026-11-26'));
    expect(JSON.stringify(c)).not.toBe(JSON.stringify(a));
  });

  it('il risultato dice posizione e patrimonio, e si copia come testo', () => {
    const s = newGame();
    own(s, 'periferia-1', 1);
    const r = dailyResult(s, ctxWith(), 0, '2026-11-25');
    expect(r).toMatchObject({ day: '2026-11-25', players: 2 });
    expect(r.place).toBeGreaterThanOrEqual(1);
    const text = dailyText(r);
    expect(text).toContain('2026-11-25');
    expect(text).toContain(String(r.worth));
  });

  it('un risultato salvato rovinato si ignora', () => {
    expect(parseDaily(null)).toBe(null);
    expect(parseDaily('non json')).toBe(null);
    expect(parseDaily('{"day":"2026-11-25"}')).toBe(null);
    expect(parseDaily('{"day":"2026-11-25","worth":1200.4,"place":2,"players":4}')).toEqual({ day: '2026-11-25', worth: 1200, place: 2, players: 4 });
  });
});

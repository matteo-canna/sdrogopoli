// Tassa sul patrimonio a fine giro (compito 10), regola facoltativa del motore.
import { describe, expect, it } from 'vitest';
import { board, cards } from '../src/data';
import {
  applyAction,
  chooseBotAction,
  createGame,
  migrateState,
  netWorth,
  openRound,
  RuleError,
  teamWorth,
  type GameContext,
  type GameRules,
  type GameState,
  type PropertySpace,
} from '../src/engine';
import { own } from './helpers';
import { setLang, text } from '../src/i18n';

const ctx: GameContext = { board, cards };
const props = board.spaces.filter((s): s is PropertySpace => s.type === 'property');

function game(rules: Partial<GameRules> = { wealthTax: true }, names = ['Ada', 'Bea', 'Ciro', 'Dino']): GameState {
  return createGame(names, ctx, { seatBonus: 0, ...rules }, 21);
}

const err = (fn: () => unknown) => {
  try {
    fn();
  } catch (e) {
    return e instanceof RuleError ? e.key : String(e);
  }
  return null;
};

describe('tassa sul patrimonio', () => {
  it('1. ai giri 5, 10, 15... il giocatore con il patrimonio più alto paga il 5% arrotondato a 10', () => {
    let s = game();
    // Ada ha 2000, gli altri 1500: al giro 5 Ada paga 5% di 2000 = 100
    s.players[0].money = 2000;
    s.round = 4;
    // Nei giri non multipli di 5 non paga nessuno
    expect(openRound(s, ctx).players[0].money).toBe(2000);

    s.round = 5;
    s = openRound(s, ctx);
    expect(s.players[0].money).toBe(1900);
    expect(s.stats[0].taxesPaid).toBe(100);
    setLang('it');
    expect(s.log.map(text).some((l) => l.includes('Ada paga 100 di tassa sul patrimonio'))).toBe(true);

    // verifica arrotondamento a 10: patrimonio 2100 -> 5% = 105 -> arrotondato a 110
    let s2 = game();
    s2.players[1].money = 2100;
    s2.round = 10;
    s2 = openRound(s2, ctx);
    expect(s2.players[1].money).toBe(1990);
    expect(s2.stats[1].taxesPaid).toBe(110);
  });

  it('2. in caso di pari merito per il primo posto non paga nessuno', () => {
    let s = game();
    // Ada e Bea entrambi a 2000
    s.players[0].money = 2000;
    s.players[1].money = 2000;
    s.round = 5;
    s = openRound(s, ctx);
    expect(s.players[0].money).toBe(2000);
    expect(s.players[1].money).toBe(2000);
    expect(s.stats[0].taxesPaid).toBe(0);
    expect(s.stats[1].taxesPaid).toBe(0);
  });

  it('3. con parkPot acceso la tassa finisce sulla Panchina del Parco, altrimenti va alla banca', () => {
    let withPot = game({ wealthTax: true, parkPot: true });
    withPot.players[0].money = 2000;
    withPot.round = 5;
    withPot = openRound(withPot, ctx);
    expect(withPot.pot).toBe(100);

    let noPot = game({ wealthTax: true, parkPot: false });
    noPot.players[0].money = 2000;
    noPot.round = 5;
    noPot = openRound(noPot, ctx);
    expect(noPot.pot).toBe(0);
  });

  it('4. con le squadre paga la squadra con teamWorth più alto, divisa a metà tra i compagni', () => {
    let s = game({ wealthTax: true, teams: true });
    // Squadra 0: Ada (0) e Ciro (2); Squadra 1: Bea (1) e Dino (3)
    s.players[0].money = 2200;
    s.players[2].money = 1800; // teamWorth squadra 0 = 4000 -> 5% = 200 -> 100 a testa
    expect(teamWorth(s, ctx, 0)).toBe(4000);
    expect(teamWorth(s, ctx, 1)).toBe(3000);

    s.round = 5;
    s = openRound(s, ctx);
    expect(s.players[0].money).toBe(2100);
    expect(s.players[2].money).toBe(1700);
    expect(s.stats[0].taxesPaid).toBe(100);
    expect(s.stats[2].taxesPaid).toBe(100);
    expect(s.players[1].money).toBe(1500);
    expect(s.players[3].money).toBe(1500);

    // In caso di pari merito tra le due squadre non paga nessuno
    let tied = game({ wealthTax: true, teams: true });
    tied.round = 5;
    tied = openRound(tied, ctx);
    expect(tied.players.map((p) => p.money)).toEqual([1500, 1500, 1500, 1500]);
  });

  it('5. se chi è in testa ha proprietà ma pochi contanti entra nella fase di debito verso la banca', () => {
    let s = game({ wealthTax: true }, ['Ada', 'Bea']);
    // Ada ha solo 10 contanti ma possiede molte proprietà (patrimonio alto)
    s.players[0].money = 10;
    for (const sp of props.slice(0, 15)) own(s, sp.id, 0);
    const worth = netWorth(s, ctx, 0);
    expect(worth).toBeGreaterThan(1500);
    const expectedTax = Math.round((worth * 0.05) / 10) * 10;

    // Fine del giro 4: Bruno passa il turno ad Ada -> inizia il giro 5 e scatta la tassa sul patrimonio
    s.round = 4;
    s.current = 1;
    s.phase = 'endTurn';
    s = applyAction(s, { type: 'endTurn' }, ctx);
    expect(s.round).toBe(5);
    expect(s.current).toBe(0);
    expect(s.players[0].money).toBe(10 - expectedTax);
    expect(s.players[0].money).toBeLessThan(0);
    expect(s.creditor).toBeNull();
    expect(s.phase).toBe('endTurn');
    expect(err(() => applyAction(s, { type: 'endTurn' }, ctx))).toBe('err.payDebtFirst');
  });

  it('6. regola spenta e compatibilità salvataggi', () => {
    const off = game({});
    off.players[0].money = 2400;
    off.round = 5;
    expect(openRound(off, ctx).players[0].money).toBe(2400);

    const migrated = migrateState(off, ctx, 1);
    expect(migrated.rules.wealthTax).toBeUndefined();
  });

  it('7. partita completa tra 4 computer con tassa sul patrimonio attiva', () => {
    let s = createGame(
      ['P1', 'P2', 'P3', 'P4'].map((name) => ({ name, isBot: true })),
      ctx,
      { wealthTax: true, maxRounds: 25 },
      42,
    );
    let guard = 0;
    while (s.phase !== 'gameOver' && guard++ < 4000) {
      s = applyAction(s, chooseBotAction(s, ctx), ctx);
    }
    expect(s.phase).toBe('gameOver');
    expect(s.stats.reduce((a, st) => a + st.taxesPaid, 0)).toBeGreaterThan(0);
  });
});

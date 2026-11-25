import { describe, expect, it } from 'vitest';
import { board, cards } from '../src/data';
import { applyAction, boardSides, chooseBotAction, createGame, estimatedMinutes, goalProgress, PRESETS, seededRng, type GameState } from '../src/engine';
import { ctxWith, newGame, own } from './helpers';

function withRules(s: GameState, rules: Partial<GameState['rules']>): GameState {
  s.rules = { ...s.rules, ...rules };
  return s;
}

describe('vittorie alternative', () => {
  it('chi completa i quartieri richiesti vince subito', () => {
    const s = withRules(newGame(), { goalGroups: 2 });
    // Bruno ha già Periferia e Borgo completi: alla prima mossa la partita finisce
    for (const id of ['periferia-1', 'periferia-2', 'borgo-1', 'borgo-2', 'borgo-3']) own(s, id, 1);
    const next = applyAction(s, { type: 'roll' }, ctxWith(4, 5));
    expect(next.phase).toBe('gameOver');
    expect(next.winner).toBe(1);
    expect(next.winReason).toMatch(/2 quartieri/);
  });

  it('chi arriva al patrimonio richiesto vince subito', () => {
    const s = withRules(newGame(), { goalWorth: 3000 });
    s.players[0].money = 3000;
    const next = applyAction(s, { type: 'roll' }, ctxWith(1, 1));
    expect(next.phase).toBe('gameOver');
    expect(next.winner).toBe(0);
  });

  it('un lato intero del tabellone fa vincere', () => {
    const s = withRules(newGame(), { goalSide: true });
    const [first] = boardSides({ board, cards });
    expect(first).toContain('periferia-1');
    expect(first).toContain('fermata-nord');
    first.forEach((id) => own(s, id, 0));
    expect(goalProgress(s, { board, cards }, 0).side).toBe(1);
    const next = applyAction(s, { type: 'roll' }, ctxWith(1, 2));
    expect(next.winner).toBe(0);
  });

  it('senza obiettivi non cambia nulla', () => {
    const s = newGame();
    s.players[0].money = 99999;
    expect(applyAction(s, { type: 'roll' }, ctxWith(1, 2)).phase).not.toBe('gameOver');
  });
});

describe('Dado Sprint', () => {
  it('i numeri aggiungono passi', () => {
    const s = withRules(newGame(), { sprintDie: true });
    const next = applyAction(s, { type: 'roll' }, ctxWith(1, 2, 2));
    expect(next.lastSprint).toBe(2);
    expect(next.players[0].position).toBe(5);
  });

  it('"Occasione" porta alla prossima proprietà in vendita', () => {
    const s = withRules(newGame(), { sprintDie: true });
    own(s, 'periferia-2', 1);
    // 1 + 1 = 2 (una carta, non in vendita): si prosegue oltre periferia-2 (già venduta) fino alla Fermata Nord
    const next = applyAction(s, { type: 'roll' }, ctxWith(1, 2, 4));
    expect(next.lastSprint).toBe('occasione');
    expect(next.players[0].position).toBe(5);
    expect(next.phase).toBe('buy');
  });

  it('"Affitto pieno" fa pagare il 50% in più', () => {
    const s = withRules(newGame(), { sprintDie: true });
    own(s, 'borgo-1', 1);
    const next = applyAction(s, { type: 'roll' }, ctxWith(2, 4, 6));
    expect(next.lastSprint).toBe('pieno');
    expect(next.players[1].money - s.players[1].money).toBe(9);
  });

  it('accorcia le partite tra computer', () => {
    const rounds = (sprintDie: boolean) => {
      const all: number[] = [];
      for (let g = 1; g <= 40; g++) {
        const ctx = { board, cards, rng: seededRng(g * 31 + 7) };
        let s = createGame(['A', 'B', 'C', 'D'].map((name) => ({ name, isBot: true })), ctx, { sprintDie, quickStart: true }, g);
        while (s.phase !== 'gameOver' && s.round <= 150) s = applyAction(s, chooseBotAction(s, ctx), ctx);
        all.push(s.round);
      }
      return all.reduce((a, b) => a + b, 0) / all.length;
    };
    expect(rounds(true)).toBeLessThan(rounds(false));
  }, 60_000);
});

describe('tipi di partita', () => {
  it('ogni tipo crea una partita valida e ha una durata', () => {
    for (const p of PRESETS) {
      const s = createGame(['A', 'B'], { board, cards }, p.rules, 1);
      expect(s.phase).toBe('roll');
      expect(p.rounds).toBeGreaterThan(0);
    }
    expect(estimatedMinutes({ rounds: 30 }, 4, 0)).toBe(50);
    expect(estimatedMinutes({ rounds: 30 }, 1, 3)).toBeLessThan(estimatedMinutes({ rounds: 30 }, 4, 0));
  });
});

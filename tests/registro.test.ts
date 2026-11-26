// Esportazione del registro della partita in testo semplice (compito 29).
import { describe, expect, it } from 'vitest';
import { board, cards } from '../src/data';
import { applyAction, createGame, type GameContext } from '../src/engine';
import { logToText } from '../src/ui/logText';
import { reportUrl } from '../src/ui/report';

const ctx: GameContext = { board, cards };

describe('esportazione del registro in testo', () => {
  it('formatta ogni voce come "Giro N · Giocatore · testo" in italiano e in inglese', () => {
    const state = createGame([{ name: 'Ada' }, { name: 'Bea' }], ctx, undefined, 7);
    state.log.push({ k: 'log.turn', p: { name: 'Bea' } });
    state.log.push({ k: 'log.buys', p: { name: 'Bea', space: 'periferia-1', price: 60 } });

    const itLines = logToText(state, 'it').split('\n');
    expect(itLines).toHaveLength(state.log.length);
    expect(itLines[0]).toMatch(/^Giro 1 · Ada · /);
    expect(itLines[1]).toBe('Giro 1 · Bea · Tocca a Bea.');
    expect(itLines[2]).toContain('Giro 1 · Bea · ');
    expect(itLines[2]).toContain('Vicolo dei Gatti Neri');

    const enLines = logToText(state, 'en').split('\n');
    expect(enLines[0]).toMatch(/^Round 1 · Ada · /);
    expect(enLines[1]).toBe("Round 1 · Bea · It's Bea's turn.");
    expect(enLines[2]).toContain('Round 1 · Bea · ');
  });

  it('aggiorna il numero di giro quando i turni completano un giro', () => {
    let state = createGame([{ name: 'Ada' }, { name: 'Bea' }], ctx, undefined, 3);
    // Avanza fino al giro 2 giocando turni completi
    for (let i = 0; i < 40 && state.round < 2; i++) {
      if (state.phase === 'roll') state = applyAction(state, { type: 'roll' }, ctx);
      else if (state.phase === 'buy') state = applyAction(state, { type: 'buy' }, ctx);
      else if (state.phase === 'cardChoice') state = applyAction(state, { type: 'chooseCard', option: 0 }, ctx);
      else if (state.phase === 'endTurn') state = applyAction(state, { type: 'endTurn' }, ctx);
      else break;
    }
    expect(state.round).toBe(2);
    const lines = logToText(state, 'it').split('\n');
    expect(lines.some((l) => l.startsWith('Giro 1 · '))).toBe(true);
    expect(lines.some((l) => l.startsWith('Giro 2 · '))).toBe(true);
  });

  it('mantiene le righe testuali delle partite vecchie e gestisce il registro vuoto', () => {
    const state = createGame([{ name: 'Ada' }, { name: 'Bea' }], ctx);
    state.log = [];
    expect(logToText(state, 'it')).toBe('');

    state.log = ['Riga di una partita vecchia'];
    expect(logToText(state, 'it')).toBe('Giro 1 · Ada · Riga di una partita vecchia');
  });

  it('Segnala un problema allega al massimo le ultime 30 righe del registro', () => {
    (globalThis as { window?: unknown }).window = { innerWidth: 800, innerHeight: 600 };
    const state = createGame([{ name: 'Ada' }, { name: 'Bea' }], ctx);
    state.log = Array.from({ length: 45 }, (_, i) => `Voce numero ${i + 1}`);
    const body = new URL(reportUrl(state, '2d', 'Test/1.0')).searchParams.get('body')!;
    const quoted = body.split('\n').filter((l) => l.startsWith('> '));
    expect(quoted).toHaveLength(30);
    expect(quoted[0]).toContain('Voce numero 16');
    expect(quoted[29]).toContain('Voce numero 45');
  });
});

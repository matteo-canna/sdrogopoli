import { describe, it, expect, vi } from 'vitest';
import { applyAction, newSave, type Action, type SaveFile } from '../src/engine';
import { board as boardData, cards as cardsData } from '../src/data';
import { cardHeight, drawResultCard, resultRows, resultText, CARD_W } from '../src/ui/share';
import { Replay, replayStates, stepDelay } from '../src/ui/replay';
import { ctxWith, newGame, own } from './helpers';

function finita() {
  const s = newGame();
  own(s, 'periferia-1', 0);
  s.players[1].bankrupt = true;
  s.stats = [s.stats![0], { ...s.stats![1], bankruptRound: 7 }];
  s.winner = 0;
  s.phase = 'gameOver';
  s.round = 21;
  return s;
}

describe('immagine dei risultati', () => {
  it('le righe dicono posizione, nome e come è finita', () => {
    const rows = resultRows(finita(), ctxWith());
    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({ place: '🥇', name: 'Anna' });
    expect(rows[0].detail).toMatch(/patrimonio/i);
    expect(rows[1]).toMatchObject({ place: '🥈', name: 'Bruno' });
    expect(rows[1].detail).toContain('7');
  });

  it('il testo da condividere ha il titolo e tutte le righe', () => {
    const text = resultText(finita(), ctxWith());
    expect(text.split('\n')).toHaveLength(3);
    expect(text).toContain('Anna');
    expect(text).toContain('21');
  });

  it('la cartolina si disegna senza uscire dai bordi', () => {
    const calls: { x: number; y: number }[] = [];
    const c = {
      fillRect: vi.fn(), fillText: vi.fn((_t: string, x: number, y: number) => calls.push({ x, y })),
      measureText: vi.fn(() => ({ width: 10 }) as TextMetrics), beginPath: vi.fn(), arc: vi.fn(), fill: vi.fn(), roundRect: vi.fn(),
      fillStyle: '', font: '', textAlign: 'left' as CanvasTextAlign, textBaseline: 'middle' as CanvasTextBaseline,
    };
    drawResultCard(c, finita(), ctxWith());
    expect(c.fillText).toHaveBeenCalled();
    const h = cardHeight(2);
    for (const p of calls) {
      expect(p.x).toBeGreaterThanOrEqual(0);
      expect(p.x).toBeLessThanOrEqual(CARD_W);
      expect(p.y).toBeLessThanOrEqual(h);
    }
    // con più giocatori l'immagine è più alta
    expect(cardHeight(8)).toBeGreaterThan(h);
  });
});

describe('rivedi la partita', () => {
  const plain = { board: boardData, cards: cardsData };
  function partitaGiocata(): SaveFile {
    // la partita si rigioca dal seme: senza rng nel contesto i dadi vengono dallo stato
    const ctx = plain;
    let s = newGame();
    const { initial, actions } = newSave(s);
    // si gioca "alla cieca": a ogni passo l'azione valida più semplice
    for (let i = 0; i < 12 && s.phase !== 'gameOver'; i++) {
      const a = (s.phase === 'roll' ? { type: 'roll' } : s.phase === 'buy' ? { type: 'decline' } : s.phase === 'auction' ? { type: 'passBid' } : { type: 'endTurn' }) as Action;
      try {
        s = applyAction(s, a, ctx);
      } catch {
        break;
      }
      actions.push(a);
    }
    return { version: 2, initial, actions, state: s };
  }

  it('rigiocando le azioni si arriva allo stesso stato', () => {
    const file = partitaGiocata();
    const states = replayStates(file, plain);
    expect(states).toHaveLength(file.actions.length + 1);
    expect(states.at(-1)!.log).toEqual(file.state.log);
  });

  it('un salvataggio con un azione impossibile si ferma dov è arrivato', () => {
    const file = partitaGiocata();
    const rotto = { ...file, actions: [...file.actions, { type: 'buy' } as const] };
    expect(replayStates(rotto, plain)).toHaveLength(file.actions.length + 1);
  });

  it('si va avanti, indietro e si salta a un punto', () => {
    const file = partitaGiocata();
    const viste: number[] = [];
    const r = Replay.from(file, plain, (v) => viste.push(v.progress));
    expect(r.length).toBe(file.actions.length + 1);
    expect(r.view().progress).toBe(0);
    r.step(2);
    expect(r.view().progress).toBeCloseTo(2 / (r.length - 1));
    r.step(-5);
    expect(r.view().progress).toBe(0);
    r.seek(1);
    expect(r.view().done).toBe(true);
    // dopo la fine non si va oltre
    r.step(3);
    expect(r.view().done).toBe(true);
    expect(viste).toHaveLength(4);
  });

  it('più veloce vuol dire pause più corte', () => {
    expect(stepDelay({ type: 'roll' }, 1)).toBeGreaterThan(stepDelay({ type: 'roll' }, 4));
    expect(stepDelay({ type: 'endTurn' }, 2)).toBeLessThan(stepDelay({ type: 'roll' }, 2));
  });
});

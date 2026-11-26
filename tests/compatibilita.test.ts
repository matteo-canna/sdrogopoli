// Test di compatibilità dei salvataggi v2: controlla che i salvataggi di esempio si aprano
// con readSave, che il replay dallo stato iniziale coincida con lo stato salvato e che si
// possa continuare a giocare senza errori.
import { describe, it, expect } from 'vitest';
import { statSync } from 'node:fs';
import { resolve } from 'node:path';
import { boardChoice, cards } from '../src/data';
import {
  applyAction,
  chooseBotAction,
  fileBoard,
  readSave,
  replay,
  SAVE_VERSION,
  type GameContext,
} from '../src/engine';
import cittaSave from './fixtures/salvataggio-v2-citta.json';
import valleSave from './fixtures/salvataggio-v2-valle.json';
import regoleSave from './fixtures/salvataggio-v2-regole.json';

const MAX_FIXTURE_BYTES = 100 * 1024;
const FOLLOW_UP_MOVES = 20;

interface FixtureCase {
  name: string;
  file: string;
  raw: unknown;
  expectedBoard: string;
}

const FIXTURES: FixtureCase[] = [
  { name: 'Città sul Lago (metà partita, 4 giocatori)', file: 'salvataggio-v2-citta.json', raw: cittaSave, expectedBoard: 'citta' },
  { name: 'Valle Stretta (metà partita, 4 giocatori)', file: 'salvataggio-v2-valle.json', raw: valleSave, expectedBoard: 'valle' },
  { name: 'Squadre, quote ed edifici speciali', file: 'salvataggio-v2-regole.json', raw: regoleSave, expectedBoard: 'citta' },
];

describe('compatibilità dei salvataggi v2', () => {
  describe.each(FIXTURES)('$name', ({ file, raw, expectedBoard }) => {
    it('il file fixture resta sotto i 100 KB', () => {
      const size = statSync(resolve(__dirname, 'fixtures', file)).size;
      expect(size).toBeGreaterThan(0);
      expect(size).toBeLessThan(MAX_FIXTURE_BYTES);
    });

    it('si apre con readSave, il replay coincide con state e regge altre 20 mosse', () => {
      const boardId = fileBoard(raw);
      expect(boardId).toBe(expectedBoard);

      const ctx: GameContext = { board: boardChoice(boardId).data, cards };
      const loaded = readSave(raw, ctx, 0);
      expect(loaded).not.toBeNull();
      expect(loaded!.version).toBe(SAVE_VERSION);
      expect(loaded!.actions.length).toBeGreaterThan(0);

      // Rigiocare le azioni dallo stato iniziale deve restituire lo stesso stato salvato.
      const replayed = replay(loaded!.initial, loaded!.actions, ctx);
      expect(replayed).toEqual(loaded!.state);

      // Da qui il computer deve poter fare altre 20 mosse valide senza errori.
      let state = loaded!.state;
      let applied = 0;
      while (applied < FOLLOW_UP_MOVES && state.phase !== 'gameOver') {
        const action = chooseBotAction(state, ctx);
        state = applyAction(state, action, ctx);
        applied++;
      }
      expect(applied).toBe(FOLLOW_UP_MOVES);
      expect(state.eventCount).toBeGreaterThan(loaded!.state.eventCount);
    });
  });

  it('il salvataggio con regole facoltative conserva squadre, quote ed edifici speciali', () => {
    const ctx: GameContext = { board: boardChoice(fileBoard(regoleSave)).data, cards };
    const loaded = readSave(regoleSave, ctx, 0)!;
    expect(loaded.state.rules.teams).toBe(true);
    expect(loaded.state.rules.shares).toBe(true);
    expect(loaded.state.rules.landmarks).toBe(true);
    expect(Object.values(loaded.state.shares ?? {}).some((h) => h.length > 0)).toBe(true);
    expect(Object.keys(loaded.state.landmarks ?? {}).length).toBeGreaterThan(0);
  });
});

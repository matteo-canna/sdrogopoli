import { describe, it, expect } from 'vitest';
import { board, cards } from '../src/data';
import v1 from './fixtures/salvataggio-v1.json';
import { applyAction, chooseBotAction, createGame, isUndoable, newSave, readSave, replay, SAVE_VERSION, type Action, type GameContext, type GameState } from '../src/engine';

// senza rng: i dadi vengono dal seme della partita
const ctx: GameContext = { board, cards };

function playBots(seed: number, steps: number): { initial: GameState; actions: Action[]; state: GameState } {
  let s = createGame(['A', 'B', 'C'].map((name) => ({ name, isBot: true })), ctx, { quickStart: true }, seed);
  const initial = s;
  const actions: Action[] = [];
  for (let i = 0; i < steps && s.phase !== 'gameOver'; i++) {
    const a = chooseBotAction(s, ctx);
    actions.push(a);
    s = applyAction(s, a, ctx);
  }
  return { initial, actions, state: s };
}

describe('seme della partita', () => {
  it('stesso seme e stesse azioni danno lo stesso stato finale', () => {
    const a = playBots(42, 400);
    const b = playBots(42, 400);
    expect(b.state).toEqual(a.state);
    expect(a.state.seed).toBe(42);
  });

  it('semi diversi danno partite diverse', () => {
    expect(playBots(1, 200).state).not.toEqual(playBots(2, 200).state);
  });

  it('il seme decide anche i mazzi e le proprietà della partita rapida', () => {
    const g = (seed: number) => createGame(['A', 'B'], ctx, { quickStart: true }, seed);
    expect(g(5).decks).toEqual(g(5).decks);
    expect(g(5).ownership).toEqual(g(5).ownership);
    expect(g(5).ownership).not.toEqual(g(6).ownership);
  });
});

describe('registro delle azioni', () => {
  it('rigiocando il registro si ottiene lo stato salvato', () => {
    const { initial, actions, state } = playBots(9, 600);
    expect(replay(initial, actions, ctx)).toEqual(state);
  });

  it('il salvataggio passa da JSON e si rigioca uguale', () => {
    const { initial, actions, state } = playBots(11, 300);
    const file = JSON.parse(JSON.stringify({ version: SAVE_VERSION, initial, actions, state }));
    const loaded = readSave(file, ctx, 0)!;
    expect(loaded.state).toEqual(state);
    expect(replay(loaded.initial, loaded.actions, ctx)).toEqual(state);
  });
});

describe('versioni del salvataggio', () => {
  it('un salvataggio della versione 1 (solo lo stato) si carica e si continua a giocare', () => {
    const raw = structuredClone(v1) as unknown as GameState & { version?: number };
    expect(raw.version).toBeUndefined();
    const file = readSave(raw, ctx, 123)!;
    expect(file.version).toBe(SAVE_VERSION);
    expect(file.state.players).toHaveLength(2);
    expect(file.state.rngState).toBe(123);
    expect(file.actions).toEqual([]);
    let s = file.state;
    for (let i = 0; i < 50 && s.phase !== 'gameOver'; i++) s = applyAction(s, chooseBotAction(s, ctx), ctx);
    expect(s.rngState).not.toBe(123);
  });

  it('salvataggi rovinati o di versioni future non si caricano', () => {
    expect(readSave(null, ctx, 0)).toBeNull();
    expect(readSave({ foo: 1 }, ctx, 0)).toBeNull();
    const s = createGame(['A', 'B'], ctx, {}, 1);
    expect(readSave({ ...newSave(s), version: 99 }, ctx, 0)).toBeNull();
  });
});

describe('annulla', () => {
  it('si annullano acquisti e case, mai lanci, aste o scambi', () => {
    expect(isUndoable({ type: 'buy' })).toBe(true);
    expect(isUndoable({ type: 'build', spaceId: 'x' })).toBe(true);
    expect(isUndoable({ type: 'roll' })).toBe(false);
    expect(isUndoable({ type: 'bid', amount: 10 })).toBe(false);
    expect(isUndoable({ type: 'endTurn' })).toBe(false);
    expect(isUndoable({ type: 'acceptTrade' })).toBe(false);
  });
});

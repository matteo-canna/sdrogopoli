// Strumenti comuni per i test del motore.
import { board, cards } from '../src/data';
import { createGame, type GameContext, type GameState } from '../src/engine';

// RNG che fa uscire esattamente i dadi indicati, in ordine.
export function diceRng(...values: number[]) {
  let i = 0;
  return () => {
    if (i >= values.length) throw new Error('Il test ha lanciato più dadi del previsto');
    return (values[i++] - 1) / 6 + 0.01;
  };
}

export function ctxWith(...dice: number[]): GameContext {
  return { board, cards, rng: diceRng(...dice) };
}

// Nuova partita con mazzi in ordine fisso (RNG che non mescola).
export function newGame(names = ['Anna', 'Bruno']): GameState {
  return createGame(names, { board, cards, rng: () => 0.999 });
}

export function indexOf(spaceId: string): number {
  return board.spaces.findIndex((s) => s.id === spaceId);
}

export function own(state: GameState, spaceId: string, owner: number, houses = 0, mortgaged = false) {
  state.ownership[spaceId] = { owner, houses, mortgaged };
}

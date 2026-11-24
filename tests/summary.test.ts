import { describe, it, expect } from 'vitest';
import { board, cards } from '../src/data';
import { addResult, awards, standings } from '../src/ui/summary';
import { newGame, own } from './helpers';

const ctx = { board, cards, rng: () => 0.999 };

function finished() {
  const s = newGame(['Anna', 'Bruno', 'Carla']);
  s.phase = 'gameOver';
  s.winner = 2;
  s.players[0].bankrupt = true;
  s.stats[0].bankruptRound = 7;
  s.players[1].money = 900;
  s.stats[1].rentReceived = 300;
  s.stats[2].built = 4;
  s.stats[2].rentReceived = 120;
  own(s, 'lungolago-2', 2);
  return s;
}

describe('riepilogo di fine partita', () => {
  it('ordina: vincitore, poi chi è in gioco, poi i falliti', () => {
    expect(standings(finished(), ctx)).toEqual([2, 1, 0]);
  });

  it('assegna i premi solo a chi ha fatto qualcosa', () => {
    const a = awards(finished());
    expect(a.find((x) => x.title === 'Re degli affitti')?.playerId).toBe(1);
    expect(a.find((x) => x.title === 'Costruttore')?.playerId).toBe(2);
    expect(a.find((x) => x.title === 'Cliente della Caserma')).toBeUndefined();
  });

  it('la classifica tra amici somma partite e vittorie per nome', () => {
    let lb = addResult([], finished(), ctx);
    lb = addResult(lb, finished(), ctx);
    expect(lb[0]).toMatchObject({ name: 'Carla', wins: 2, played: 2 });
    expect(lb.find((e) => e.name === 'Anna')).toMatchObject({ wins: 0, played: 2, best: 0 });
    expect(lb.find((e) => e.name === 'Bruno')?.best).toBe(900);
  });
});

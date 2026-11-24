import { describe, it, expect } from 'vitest';
import { board, cards } from '../src/data';
import { createGame, replay, type GameContext } from '../src/engine';
import { GameSession } from '../src/ui/session';
import { soundFor } from '../src/ui/sounds';

const ctx: GameContext = { board, cards };

function started(): GameSession {
  const s = new GameSession(ctx);
  s.start(createGame(['Anna', 'Bruno'], ctx, { seatBonus: 0 }, 3));
  return s;
}

describe('partita in corso', () => {
  it('registra le azioni e si rigioca uguale', () => {
    const s = started();
    s.apply({ type: 'roll' });
    if (s.state!.phase === 'buy') s.apply({ type: 'buy' });
    expect(replay(s.initial!, s.actions, ctx)).toEqual(s.state);
  });

  it('annulla un acquisto ma non il lancio dei dadi', () => {
    const s = started();
    // si lancia finché si arriva su una casella da comprare
    for (let i = 0; i < 40 && s.state!.phase !== 'buy'; i++) {
      s.apply(s.state!.phase === 'roll' ? { type: 'roll' } : { type: 'endTurn' });
    }
    expect(s.state!.phase).toBe('buy');
    expect(s.canUndo).toBe(false);
    const before = s.state;
    const count = s.actions.length;
    s.apply({ type: 'buy' });
    expect(s.canUndo).toBe(true);
    expect(s.undo()).toBe(true);
    expect(s.state).toBe(before);
    expect(s.actions).toHaveLength(count);
    expect(s.undo()).toBe(false);
  });

  it('copre il debito in un colpo e si annulla in un colpo', () => {
    const s = started();
    s.apply({ type: 'roll' });
    const st = s.state!;
    st.phase = 'endTurn';
    st.ownership['periferia-1'] = { owner: st.current, houses: 0, mortgaged: false };
    st.ownership['borgo-1'] = { owner: st.current, houses: 0, mortgaged: false };
    st.players[st.current].money = -40;
    s.coverDebt();
    expect(s.state!.players[st.current].money).toBeGreaterThanOrEqual(0);
    expect(s.undo()).toBe(true);
    expect(s.state!.players[st.current].money).toBe(-40);
  });

  it('chiudere la partita cancella anche il registro', () => {
    const s = started();
    s.apply({ type: 'roll' });
    s.clear();
    expect(s.state).toBeNull();
    expect(s.actions).toEqual([]);
  });
});

describe('suoni', () => {
  it('pagare suona "pay", incassare "coin"', () => {
    const a = createGame(['A', 'B'], ctx, {}, 1);
    const b = structuredClone(a);
    b.players[0].money -= 50;
    expect(soundFor(a, b, { type: 'endTurn' })).toBe('pay');
    b.players[0].money += 100;
    expect(soundFor(a, b, { type: 'endTurn' })).toBe('coin');
  });
});

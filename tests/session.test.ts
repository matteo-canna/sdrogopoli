import { describe, it, expect } from 'vitest';
import { board, cards } from '../src/data';
import { createGame, replay, type GameContext, type PlayerSetup } from '../src/engine';
import { GameSession, rematchSetup } from '../src/ui/session';
import { standings } from '../src/ui/summary';
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

describe('rivincita (rematchSetup)', () => {
  it('conserva giocatori, aspetto, livello e carattere dei computer, tabellone e regole, cambia seme e inverte la classifica', () => {
    const players: PlayerSetup[] = [
      { name: 'Anna', isBot: false, appearance: { character: 'knight', color: '#e4572e', hat: true, cape: true, item: '1H_Sword' } },
      { name: 'Bruno', isBot: true, appearance: { character: 'mage', color: '#2e86de', hat: true, cape: false, item: 'Spellbook' }, bot: { level: 'difficile', style: 'costruttore' } },
      { name: 'Carla', isBot: true, appearance: { character: 'rogue', color: '#f4b400', hat: false, cape: true, item: 'Knife' }, bot: { level: 'facile', style: 'mercante' } },
    ];
    const rules = { startingMoney: 2000, maxRounds: 25, parkPot: true, seatBonus: 30, quickStart: true, demo: false, sprintDie: true };
    const finalState = createGame(players, ctx, rules, 77);
    // Classifica finale: 1° Carla (vincitrice), 2° Bruno (1800), 3° Anna (fallita al giro 5)
    finalState.phase = 'gameOver';
    finalState.winner = 2;
    finalState.players[1].money = 1800;
    finalState.players[0].bankrupt = true;
    finalState.stats[0].bankruptRound = 5;
    expect(standings(finalState, ctx)).toEqual([2, 1, 0]);

    const next = rematchSetup(finalState, { players, rules, boardId: 'valle', seed: 77, tipsOn: false }, ctx, () => 77);
    // anche se il generatore restituisce lo stesso seme, rematchSetup ne garantisce uno nuovo
    expect(next.seed).not.toBe(77);
    expect(next.boardId).toBe('valle');
    expect(next.tipsOn).toBe(false);
    expect(next.rules).toMatchObject(rules);
    // ordine invertito rispetto alla classifica: ultimo (Anna, 0), secondo (Bruno, 1), vincitrice (Carla, 2)
    expect(next.seatOrder).toEqual([0, 1, 2]);
    expect(next.players.map((p) => p.name)).toEqual(['Anna', 'Bruno', 'Carla']);

    // se invece Anna vince, Bruno è 2° e Carla è ultima (fallita), la rivincita parte da Carla, poi Bruno, poi Anna
    finalState.winner = 0;
    finalState.players[0].bankrupt = false;
    finalState.players[0].money = 2500;
    finalState.players[2].bankrupt = true;
    finalState.stats[2].bankruptRound = 4;
    expect(standings(finalState, ctx)).toEqual([0, 1, 2]);

    const next2 = rematchSetup(finalState, { boardId: 'valle' }, ctx, () => 12345);
    expect(next2.seed).toBe(12345);
    expect(next2.seatOrder).toEqual([2, 1, 0]);
    expect(next2.players).toEqual([players[2], players[1], players[0]]);
  });
});

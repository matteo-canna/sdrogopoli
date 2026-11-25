import { describe, it, expect } from 'vitest';
import { applyAction, createGame, netWorth, sameTeam, teamMembers, teamName, teamWorth } from '../src/engine';
import { board, cards } from '../src/data';
import { ctxWith, indexOf, own } from './helpers';

function squadre(names = ['Anna', 'Bruno', 'Carla', 'Dario']) {
  return createGame(
    names.map((name) => ({ name })),
    { board, cards, rng: () => 0.999 },
    { teams: true, seatBonus: 0 },
  );
}

describe('partite a squadre', () => {
  it('i posti si alternano fra le due squadre', () => {
    const s = squadre();
    expect(s.players.map((p) => p.team)).toEqual([0, 1, 0, 1]);
    expect(sameTeam(s, 0, 2)).toBe(true);
    expect(sameTeam(s, 0, 1)).toBe(false);
    // nessuno è compagno di sé stesso
    expect(sameTeam(s, 0, 0)).toBe(false);
    expect(teamMembers(s, 1)).toEqual([1, 3]);
    expect(teamName(s, 0)).toBe('Anna + Carla');
  });

  it('senza la regola non esistono squadre', () => {
    const s = createGame(['Anna', 'Bruno'], { board, cards, rng: () => 0.999 });
    expect(s.players[0].team).toBeUndefined();
    expect(sameTeam(s, 0, 1)).toBe(false);
    expect(teamMembers(s, 0)).toEqual([0]);
  });

  it('i compagni non si pagano l affitto, gli avversari sì', () => {
    const s = squadre();
    // Anna (posto 0) arriva sulla via di Carla, sua compagna
    own(s, 'periferia-2', 2);
    const soldi = s.players[0].money;
    const dopo = applyAction(s, { type: 'roll' }, ctxWith(1, 2));
    expect(dopo.players[0].position).toBe(indexOf('periferia-2'));
    expect(dopo.players[0].money).toBe(soldi);
    expect(dopo.log.some((l) => typeof l === 'object' && l.k === 'log.rent')).toBe(false);

    // la stessa via, ma di un avversario: l'affitto si paga
    const s2 = squadre();
    own(s2, 'periferia-2', 1);
    const dopo2 = applyAction(s2, { type: 'roll' }, ctxWith(1, 2));
    expect(dopo2.players[0].money).toBeLessThan(soldi);
  });

  it('la partita finisce quando una squadra intera è fallita', () => {
    const s = squadre();
    // restano in piedi Anna (0) e Carla (2): la squadra 0 ha vinto
    s.players[1].bankrupt = true;
    s.players[3].money = 10;
    own(s, 'centro-1', 0);
    const ctx = { board, cards };
    // Dario (3) fallisce: non resta nessuno della squadra 1
    s.current = 3;
    s.phase = 'endTurn';
    s.creditor = 0;
    s.players[3].money = -5000;
    const fine = applyAction(s, { type: 'bankrupt' }, ctx);
    expect(fine.phase).toBe('gameOver');
    expect(fine.players[fine.winner!].team).toBe(0);
    expect(fine.log.some((l) => typeof l === 'object' && l.k === 'log.teamWins')).toBe(true);
  });

  it('a tempo scaduto conta il patrimonio della squadra, non quello di uno solo', () => {
    const s = squadre();
    const ctx = { board, cards };
    // Bruno (squadra 1) è il più ricco da solo, ma la squadra 0 ha più soldi in due
    s.players[0].money = 1800;
    s.players[2].money = 1800;
    s.players[1].money = 2500;
    s.players[3].money = 100;
    expect(teamWorth(s, ctx, 0)).toBeGreaterThan(teamWorth(s, ctx, 1));
    expect(netWorth(s, ctx, 1)).toBeGreaterThan(netWorth(s, ctx, 0));
    const fine = { ...s, rules: { ...s.rules, maxRounds: 1 }, round: 1, current: 3, phase: 'endTurn' as const };
    const dopo = applyAction(fine, { type: 'endTurn' }, ctx);
    expect(dopo.phase).toBe('gameOver');
    expect(dopo.players[dopo.winner!].team).toBe(0);
    expect(dopo.log.some((l) => typeof l === 'object' && l.k === 'log.teamTimeUp')).toBe(true);
  });
});

// Riscatto dell'ipoteca all'acquisto (compito 9), regola facoltativa del motore.
import { describe, expect, it } from 'vitest';
import { board, cards } from '../src/data';
import {
  actingPlayer,
  applyAction,
  chooseBotAction,
  createGame,
  migrateState,
  RuleError,
  transferInterest,
  type GameContext,
  type GameRules,
  type GameState,
  type PropertySpace,
} from '../src/engine';
import { own } from './helpers';
import { setLang, text } from '../src/i18n';

const ctx: GameContext = { board, cards };
const props = board.spaces.filter((s): s is PropertySpace => s.type === 'property');
const P1 = props[0]; // mortgage 30
const P2 = props[1]; // mortgage 30
const P3 = props[props.length - 1]; // mortgage 200

function game(rules: Partial<GameRules> = { mortgageChoice: true }): GameState {
  return createGame(['Ada', 'Bea', 'Ciro'], ctx, { seatBonus: 0, ...rules }, 13);
}

const err = (fn: () => unknown) => {
  try {
    fn();
  } catch (e) {
    return e instanceof RuleError ? e.key : String(e);
  }
  return null;
};

describe("riscatto dell'ipoteca all'acquisto", () => {
  it('1. scambio: chi riceve una casella ipotecata sceglie se riscattarla subito o pagare il 10%', () => {
    let s = game();
    own(s, P1.id, 1, 0, true);
    s = applyAction(
      s,
      { type: 'proposeTrade', offer: { to: 1, give: { money: 50, spaces: [] }, get: { money: 0, spaces: [P1.id] } } },
      ctx,
    );
    const beforeAda = s.players[0].money;
    s = applyAction(s, { type: 'acceptTrade' }, ctx);
    expect(s.phase).toBe('mortgageChoice');
    expect(actingPlayer(s)).toBe(0);
    expect(s.pendingMortgages).toEqual([{ playerId: 0, spaceId: P1.id }]);

    // casella sbagliata rifiutata
    expect(err(() => applyAction(s, { type: 'chooseMortgage', spaceId: P2.id, redeem: true }, ctx))).toBe('err.badChoice');

    // caso A: riscatta subito pagando solo il valore dell'ipoteca
    const redeemed = applyAction(s, { type: 'chooseMortgage', spaceId: P1.id, redeem: true }, ctx);
    expect(redeemed.phase).toBe('roll');
    expect(redeemed.ownership[P1.id].mortgaged).toBe(false);
    expect(redeemed.players[0].money).toBe(beforeAda - 50 - P1.mortgage);
    setLang('it');
    expect(redeemed.log.map(text).some((l) => l.includes('riscatta subito'))).toBe(true);

    // caso B: tiene ipotecata pagando solo il 10% ora
    const kept = applyAction(s, { type: 'chooseMortgage', spaceId: P1.id, redeem: false }, ctx);
    expect(kept.phase).toBe('roll');
    expect(kept.ownership[P1.id].mortgaged).toBe(true);
    expect(kept.players[0].money).toBe(beforeAda - 50 - transferInterest(P1.mortgage));
    expect(kept.log.map(text).some((l) => l.includes('tiene ipotecata'))).toBe(true);
  });

  it('2. bancarotta verso un creditore: il creditore sceglie sulla casella ipotecata ricevuta', () => {
    let s = game();
    own(s, P1.id, 0, 0, true);
    s.current = 0;
    s.phase = 'endTurn';
    s.players[0].money = -100;
    s.creditor = 1;
    const beforeBea = s.players[1].money;

    s = applyAction(s, { type: 'bankrupt' }, ctx);
    expect(s.players[0].bankrupt).toBe(true);
    expect(s.phase).toBe('mortgageChoice');
    expect(actingPlayer(s)).toBe(1);
    expect(s.pendingMortgages).toEqual([{ playerId: 1, spaceId: P1.id }]);

    // Bea riscatta subito la casella ricevuta dal fallito
    s = applyAction(s, { type: 'chooseMortgage', spaceId: P1.id, redeem: true }, ctx);
    expect(s.ownership[P1.id]).toEqual({ owner: 1, houses: 0, mortgaged: false });
    expect(s.players[1].money).toBe(beforeBea - 100 - P1.mortgage);
    expect(s.phase).toBe('roll');
    expect(s.current).toBe(1);
  });

  it('3. più caselle ipotecate in uno scambio: si scelgono una alla volta per ciascun destinatario', () => {
    let s = game();
    own(s, P1.id, 0, 0, true);
    own(s, P2.id, 1, 0, true);
    own(s, P3.id, 1, 0, true);
    s.phase = 'endTurn';
    s = applyAction(
      s,
      {
        type: 'proposeTrade',
        offer: { to: 1, give: { money: 0, spaces: [P1.id] }, get: { money: 0, spaces: [P2.id, P3.id] } },
      },
      ctx,
    );
    s = applyAction(s, { type: 'acceptTrade' }, ctx);
    expect(s.phase).toBe('mortgageChoice');
    expect(s.pendingMortgages).toEqual([
      { playerId: 0, spaceId: P2.id },
      { playerId: 0, spaceId: P3.id },
      { playerId: 1, spaceId: P1.id },
    ]);

    // Ada riscatta P2 e tiene ipotecata P3
    expect(actingPlayer(s)).toBe(0);
    s = applyAction(s, { type: 'chooseMortgage', spaceId: P2.id, redeem: true }, ctx);
    expect(s.phase).toBe('mortgageChoice');
    expect(actingPlayer(s)).toBe(0);
    s = applyAction(s, { type: 'chooseMortgage', spaceId: P3.id, redeem: false }, ctx);

    // Poi tocca a Bea scegliere su P1
    expect(s.phase).toBe('mortgageChoice');
    expect(actingPlayer(s)).toBe(1);
    s = applyAction(s, { type: 'chooseMortgage', spaceId: P1.id, redeem: true }, ctx);

    // Finita la coda si torna alla fase precedente (endTurn)
    expect(s.phase).toBe('endTurn');
    expect(s.pendingMortgages).toBeUndefined();
    expect(s.ownership[P2.id].mortgaged).toBe(false);
    expect(s.ownership[P3.id].mortgaged).toBe(true);
    expect(s.ownership[P1.id].mortgaged).toBe(false);
  });

  it('4. computer: riscatta se dopo gli restano almeno 200, altrimenti tiene ipotecata', () => {
    const s = createGame(
      [
        { name: 'Bot1', isBot: true },
        { name: 'Bot2', isBot: true },
      ],
      ctx,
      { mortgageChoice: true, seatBonus: 0 },
      19,
    );
    own(s, P3.id, 0, 0, true); // mortgage = 200
    s.phase = 'mortgageChoice';
    s.resumePhase = 'endTurn';
    s.pendingMortgages = [{ playerId: 0, spaceId: P3.id }];

    // con 400 contanti: 400 - 200 = 200 >= 200 -> riscatta
    s.players[0].money = 400;
    expect(chooseBotAction(s, ctx)).toEqual({ type: 'chooseMortgage', spaceId: P3.id, redeem: true });

    // con 399 contanti: 399 - 200 = 199 < 200 -> tiene ipotecata
    s.players[0].money = 399;
    expect(chooseBotAction(s, ctx)).toEqual({ type: 'chooseMortgage', spaceId: P3.id, redeem: false });
  });

  it('5. regola spenta: comportamento identico a prima (paga subito il 10% senza fase mortgageChoice)', () => {
    let s = game({ mortgageChoice: false });
    own(s, P1.id, 1, 0, true);
    const beforeAda = s.players[0].money;
    s = applyAction(
      s,
      { type: 'proposeTrade', offer: { to: 1, give: { money: 50, spaces: [] }, get: { money: 0, spaces: [P1.id] } } },
      ctx,
    );
    s = applyAction(s, { type: 'acceptTrade' }, ctx);
    expect(s.phase).toBe('roll');
    expect(s.pendingMortgages).toBeUndefined();
    expect(s.ownership[P1.id].mortgaged).toBe(true);
    expect(s.players[0].money).toBe(beforeAda - 50 - transferInterest(P1.mortgage));
    expect(err(() => applyAction(s, { type: 'chooseMortgage', spaceId: P1.id, redeem: true }, ctx))).toBe('err.notNow');

    // migrateState su uno stato salvato
    const migrated = migrateState(s, ctx, 1);
    expect(migrated.phase).toBe('roll');
  });
});

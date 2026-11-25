import { describe, it, expect } from 'vitest';
import { board, cards } from '../src/data';
import { applyAction, chooseBotAction, createGame, seededRng, type GameContext } from '../src/engine';
import { ctxWith, newGame, own } from './helpers';

describe('giocatore computer', () => {
  it('i giocatori possono essere segnati come computer', () => {
    const s = createGame([{ name: 'Io' }, { name: 'Robot', isBot: true }], { board, cards, rng: () => 0.5 });
    expect(s.players.map((p) => p.isBot)).toEqual([false, true]);
  });

  it('compra una via se ha soldi in abbondanza', () => {
    const s = applyAction(newGame(), { type: 'roll' }, ctxWith(1, 2));
    expect(chooseBotAction(s, ctxWith())).toEqual({ type: 'buy' });
  });

  it('non compra se resterebbe senza riserva', () => {
    const s = applyAction(newGame(), { type: 'roll' }, ctxWith(1, 2));
    s.players[0].money = 100;
    expect(chooseBotAction(s, ctxWith())).toEqual({ type: 'decline' });
  });

  it('compra per completare un quartiere anche intaccando la riserva', () => {
    const s = applyAction(newGame(), { type: 'roll' }, ctxWith(1, 2));
    own(s, 'periferia-1', 0);
    s.players[0].money = 70;
    expect(chooseBotAction(s, ctxWith())).toEqual({ type: 'buy' });
  });

  it('con un debito vende case prima di ipotecare', () => {
    const s = applyAction(newGame(), { type: 'roll' }, ctxWith(1, 3));
    own(s, 'periferia-1', 0, 1);
    own(s, 'periferia-2', 0, 1);
    own(s, 'borgo-1', 0);
    s.players[0].money = -20;
    expect(chooseBotAction(s, ctxWith())).toMatchObject({ type: 'sell' });
  });

  it('senza niente da vendere dichiara bancarotta', () => {
    const s = applyAction(newGame(), { type: 'roll' }, ctxWith(1, 3));
    s.players[0].money = -20;
    expect(chooseBotAction(s, ctxWith())).toEqual({ type: 'bankrupt' });
  });

  it('costruisce sul quartiere completo quando ha soldi', () => {
    const s = applyAction(newGame(), { type: 'roll' }, ctxWith(1, 3));
    own(s, 'periferia-1', 0);
    own(s, 'periferia-2', 0);
    expect(chooseBotAction(s, ctxWith())).toMatchObject({ type: 'build' });
  });

  it('in Caserma usa la carta per uscire', () => {
    const s = newGame();
    s.players[0].inJail = true;
    s.players[0].jailCards = ['sorte-10'];
    expect(chooseBotAction(s, ctxWith())).toEqual({ type: 'useJailCard' });
  });

  it('partite intere tra computer: sempre azioni valide', () => {
    // la durata delle partite si studia con la simulazione di bilanciamento (scripts/simula.ts)
    for (let seed = 1; seed <= 12; seed++) {
      const ctx: GameContext = { board, cards, rng: seededRng(seed) };
      let s = createGame(['A', 'B', 'C'].map((name) => ({ name, isBot: true })), ctx);
      for (let i = 0; i < 4000 && s.phase !== 'gameOver'; i++) {
        s = applyAction(s, chooseBotAction(s, ctx), ctx);
      }
      // nessuno resta con soldi negativi fuori dal proprio turno
      expect(s.players.filter((p) => !p.bankrupt && p.money < 0 && p.id !== s.current)).toHaveLength(0);
    }
  });
});

describe('computer: aste e scambi', () => {
  it('in asta rilancia di poco finché la casella vale la spesa, poi passa', () => {
    let s = applyAction(newGame(), { type: 'roll' }, ctxWith(1, 2)); // Via del Cassonetto, 60
    s = applyAction(s, { type: 'decline' }, ctxWith());
    expect(chooseBotAction(s, ctxWith())).toEqual({ type: 'bid', amount: 10 });
    s.auction!.highestBid = 200;
    s.auction!.highestBidder = 1;
    expect(chooseBotAction(s, ctxWith())).toEqual({ type: 'pass' });
  });

  it('propone di comprare l\'ultima via che gli manca per completare un quartiere', () => {
    const s = applyAction(newGame(), { type: 'roll' }, ctxWith(1, 3));
    own(s, 'periferia-1', 0);
    own(s, 'periferia-2', 1);
    expect(chooseBotAction(s, ctxWith())).toMatchObject({ type: 'proposeTrade', offer: { to: 1, get: { spaces: ['periferia-2'] } } });
  });

  it('accetta uno scambio vantaggioso e rifiuta di regalare un quartiere', () => {
    let s = applyAction(newGame(), { type: 'roll' }, ctxWith(1, 3));
    own(s, 'borgo-1', 1);
    s = applyAction(s, { type: 'proposeTrade', offer: { to: 1, give: { money: 300, spaces: [] }, get: { money: 0, spaces: ['borgo-1'] } } }, ctxWith());
    expect(chooseBotAction(s, ctxWith())).toEqual({ type: 'acceptTrade' });

    let t = applyAction(newGame(), { type: 'roll' }, ctxWith(1, 3));
    own(t, 'periferia-1', 0);
    own(t, 'periferia-2', 1);
    t = applyAction(t, { type: 'proposeTrade', offer: { to: 1, give: { money: 80, spaces: [] }, get: { money: 0, spaces: ['periferia-2'] } } }, ctxWith());
    expect(chooseBotAction(t, ctxWith())).toEqual({ type: 'rejectTrade' });
  });
});

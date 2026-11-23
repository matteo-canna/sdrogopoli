// Giocatore controllato dal computer: sceglie sempre un'azione valida in base allo stato.
import { actingPlayer, ownsWholeGroup, unmortgageCost, HOTEL, MIN_BID, type Action } from './rules';
import type { GameContext, GameState, TradeSide } from './state';
import { JAIL_FINE } from './state';
import type { PropertySpace, Space } from './types';

// Soldi che il computer cerca di tenere da parte per pagare affitti e tasse.
const RESERVE = 150;
const BUILD_RESERVE = 250;

function spaceOf(ctx: GameContext, id: string): Space {
  return ctx.board.spaces.find((s) => s.id === id)!;
}

function myHoldings(state: GameState, ctx: GameContext) {
  return Object.entries(state.ownership)
    .filter(([, o]) => o.owner === state.current)
    .map(([id, own]) => ({ id, own, space: spaceOf(ctx, id) }));
}

// Quanto vale per il computer una casella libera: completare un quartiere conta molto.
function wantsToBuy(state: GameState, ctx: GameContext, space: Space): boolean {
  if (!('price' in space)) return false;
  const money = state.players[state.current].money;
  if (money < space.price) return false;
  if (space.type === 'property') {
    const group = ctx.board.spaces.filter((s): s is PropertySpace => s.type === 'property' && s.group === space.group);
    const ownedByMe = group.filter((g) => state.ownership[g.id]?.owner === state.current).length;
    const ownedByOthers = group.filter((g) => state.ownership[g.id] && state.ownership[g.id].owner !== state.current).length;
    // completa il quartiere: compra anche intaccando la riserva
    if (ownedByMe === group.length - 1) return true;
    // blocca un avversario che sta per completarlo
    if (ownedByOthers === group.length - 1) return money - space.price >= RESERVE / 2;
  }
  return money - space.price >= RESERVE;
}

// Cerca di coprire un debito: prima vende case, poi ipoteca ciò che rende meno.
function raiseMoney(state: GameState, ctx: GameContext): Action | null {
  const holdings = myHoldings(state, ctx);
  const withHouses = holdings
    .filter((h) => h.space.type === 'property' && h.own.houses > 0)
    .sort((a, b) => b.own.houses - a.own.houses);
  for (const h of withHouses) {
    const space = h.space as PropertySpace;
    const groupMax = Math.max(
      ...ctx.board.spaces
        .filter((s): s is PropertySpace => s.type === 'property' && s.group === space.group)
        .map((s) => state.ownership[s.id]?.houses ?? 0),
    );
    if (h.own.houses === groupMax) return { type: 'sell', spaceId: h.id };
  }
  const mortgageable = holdings
    .filter((h) => !h.own.mortgaged && 'mortgage' in h.space)
    .filter((h) => {
      if (h.space.type !== 'property') return true;
      const group = h.space.group;
      return ctx.board.spaces.every((s) => s.type !== 'property' || s.group !== group || (state.ownership[s.id]?.houses ?? 0) === 0);
    })
    // prima le caselle che non fanno parte di un quartiere completo
    .sort((a, b) => score(a) - score(b));
  if (mortgageable.length) return { type: 'mortgage', spaceId: mortgageable[0].id };
  return null;

  function score(h: { space: Space }): number {
    const complete = h.space.type === 'property' && ownsWholeGroup(state, ctx, state.current, h.space.group);
    return (complete ? 10000 : 0) + ('price' in h.space ? h.space.price : 0);
  }
}

// Costruisce in modo uniforme sul quartiere più redditizio che può permettersi.
function tryBuild(state: GameState, ctx: GameContext): Action | null {
  const money = state.players[state.current].money;
  const candidates = myHoldings(state, ctx)
    .filter((h): h is { id: string; own: typeof h.own; space: PropertySpace } => h.space.type === 'property')
    .filter((h) => ownsWholeGroup(state, ctx, state.current, h.space.group))
    .filter((h) => h.own.houses < HOTEL && money - h.space.housePrice >= BUILD_RESERVE)
    .filter((h) => {
      const group = ctx.board.spaces.filter((s): s is PropertySpace => s.type === 'property' && s.group === h.space.group);
      const owns = group.map((g) => state.ownership[g.id]);
      return owns.every((o) => !o.mortgaged) && h.own.houses <= Math.min(...owns.map((o) => o.houses));
    })
    .sort((a, b) => b.space.rent[a.own.houses + 1] - a.space.rent[a.own.houses] - (a.space.rent[b.own.houses + 1] - b.space.rent[b.own.houses]));
  return candidates.length ? { type: 'build', spaceId: candidates[0].id } : null;
}

function tryUnmortgage(state: GameState, ctx: GameContext): Action | null {
  const money = state.players[state.current].money;
  const h = myHoldings(state, ctx).find(
    (x) => x.own.mortgaged && 'mortgage' in x.space && money - unmortgageCost(x.space.mortgage) >= BUILD_RESERVE * 2,
  );
  return h ? { type: 'unmortgage', spaceId: h.id } : null;
}

// ---------- aste e scambi ----------

function groupOf(ctx: GameContext, group: string): PropertySpace[] {
  return ctx.board.spaces.filter((s): s is PropertySpace => s.type === 'property' && s.group === group);
}

// Vero se, ottenendo "spaceId", il giocatore completerebbe il quartiere.
function wouldComplete(state: GameState, ctx: GameContext, playerId: number, spaceId: string): boolean {
  const space = spaceOf(ctx, spaceId);
  if (space.type !== 'property') return false;
  return groupOf(ctx, space.group).every((g) => g.id === spaceId || state.ownership[g.id]?.owner === playerId);
}

// Quanto vale una casella per un giocatore che la riceve.
function valueFor(state: GameState, ctx: GameContext, playerId: number, spaceId: string): number {
  const space = spaceOf(ctx, spaceId);
  if (!('price' in space)) return 0;
  const base = state.ownership[spaceId]?.mortgaged ? space.price - space.mortgage : space.price;
  if (wouldComplete(state, ctx, playerId, spaceId)) return base * 2.5;
  if (space.type === 'station') {
    const owned = ctx.board.spaces.filter((s) => s.type === 'station' && state.ownership[s.id]?.owner === playerId).length;
    return base * (1 + 0.25 * owned);
  }
  return base;
}

function chooseAuctionAction(state: GameState, ctx: GameContext, me: number): Action {
  const a = state.auction!;
  const money = state.players[me].money;
  const completes = wouldComplete(state, ctx, me, a.spaceId);
  const blocks = state.players.some((p) => p.id !== me && !p.bankrupt && wouldComplete(state, ctx, p.id, a.spaceId));
  const space = spaceOf(ctx, a.spaceId);
  const price = 'price' in space ? space.price : 0;
  const worth = price * (completes ? 1.6 : blocks ? 1.2 : 0.9);
  const limit = Math.min(worth, money - (completes ? 20 : RESERVE / 2));
  const next = Math.max(MIN_BID, a.highestBid + 10);
  return next <= limit && a.highestBidder !== me ? { type: 'bid', amount: next } : { type: 'pass' };
}

function chooseTradeResponse(state: GameState, ctx: GameContext): Action {
  const t = state.trade!;
  const me = t.to;
  if (state.players[me].money < t.get.money) return { type: 'rejectTrade' };
  const received = t.give.money + t.give.spaces.reduce((sum, id) => sum + valueFor(state, ctx, me, id), 0);
  // cedere una casella che completa il quartiere dell'avversario costa molto di più
  const lost =
    t.get.money +
    t.get.spaces.reduce((sum, id) => {
      const space = spaceOf(ctx, id);
      const price = 'price' in space ? space.price : 0;
      return sum + (wouldComplete(state, ctx, t.from, id) ? price * 2.2 : price) + (wouldCompleteMine(id) ? price * 1.5 : 0);
    }, 0);
  return received >= lost * 1.2 && received > 0 ? { type: 'acceptTrade' } : { type: 'rejectTrade' };

  // vero se la casella fa parte di un quartiere che possiedo già tutto
  function wouldCompleteMine(id: string): boolean {
    const space = spaceOf(ctx, id);
    return space.type === 'property' && ownsWholeGroup(state, ctx, me, space.group);
  }
}

// Se manca una sola via per completare un quartiere, prova a comprarla da chi la possiede.
function tryProposeTrade(state: GameState, ctx: GameContext): Action | null {
  if (state.tradeProposedThisTurn) return null;
  const me = state.current;
  const money = state.players[me].money;
  for (const g of ctx.board.groups) {
    const group = groupOf(ctx, g.id);
    const missing = group.filter((s) => state.ownership[s.id]?.owner !== me);
    if (missing.length !== 1) continue;
    const target = missing[0];
    const own = state.ownership[target.id];
    if (!own || state.players[own.owner].bankrupt) continue;
    if (group.some((s) => (state.ownership[s.id]?.houses ?? 0) > 0)) continue;
    const offer = Math.min(Math.round(target.price * 2.4), money - RESERVE);
    if (offer < target.price * 1.3) continue;
    const give: TradeSide = { money: offer, spaces: [] };
    return { type: 'proposeTrade', offer: { to: own.owner, give, get: { money: 0, spaces: [target.id] } } };
  }
  return null;
}

export function chooseBotAction(state: GameState, ctx: GameContext): Action {
  if (state.trade) return chooseTradeResponse(state, ctx);
  const actor = actingPlayer(state);
  const me = state.players[actor];
  switch (state.phase) {
    case 'auction':
      return chooseAuctionAction(state, ctx, actor);
    case 'roll':
      if (me.inJail && me.jailCards.length) return { type: 'useJailCard' };
      // all'inizio conviene uscire subito per comprare; più avanti meglio restare dentro
      if (me.inJail && me.money >= JAIL_FINE + RESERVE * 2 && Object.keys(state.ownership).length < 20) return { type: 'payJailFine' };
      return { type: 'roll' };
    case 'buy': {
      const space = ctx.board.spaces[me.position];
      return wantsToBuy(state, ctx, space) ? { type: 'buy' } : { type: 'decline' };
    }
    case 'endTurn':
      if (me.money < 0) return raiseMoney(state, ctx) ?? { type: 'bankrupt' };
      return tryUnmortgage(state, ctx) ?? tryProposeTrade(state, ctx) ?? tryBuild(state, ctx) ?? { type: 'endTurn' };
    default:
      throw new Error('La partita è finita');
  }
}

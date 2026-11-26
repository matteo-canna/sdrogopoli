// Scambi tra giocatori: proposte, controproposte, accettazione e interessi sulle ipoteche.
import type { GameContext, GameState, TradeOffer, TradeSide } from './state';
import { current, log, MAX_COUNTERS, ownsWholeGroup, pay, requirePhase, RuleError, spaceById, stat } from './ruleHelpers';
import { groupHasBuildings } from './shares';

// Chi riceve una casella ipotecata (scambio o bancarotta) paga subito alla banca il 10%
// del valore d'ipoteca; per riscattarla poi paga comunque valore più 10%.
export function transferInterest(mortgage: number): number {
  return Math.ceil(mortgage * 0.1);
}

// Interessi dovuti per le caselle ipotecate di una lista.
export function interestOn(state: GameState, ctx: GameContext, spaceIds: string[]): number {
  return spaceIds.reduce((sum, id) => {
    const space = spaceById(ctx, id);
    return sum + (state.ownership[id]?.mortgaged && 'mortgage' in space ? transferInterest(space.mortgage) : 0);
  }, 0);
}

function validateSide(state: GameState, ctx: GameContext, owner: number, side: TradeSide): void {
  if (!Number.isInteger(side.money) || side.money < 0) throw new RuleError('err.badAmount');
  if (side.money > Math.max(state.players[owner].money, 0)) throw new RuleError('err.playerNoMoney', { name: state.players[owner].name });
  for (const id of side.spaces) {
    const space = spaceById(ctx, id);
    if (state.ownership[id]?.owner !== owner) throw new RuleError('err.notOwnedBy', { space: space.id, name: state.players[owner].name });
    if (space.type === 'property' && groupHasBuildings(state, ctx, space.group)) {
      throw new RuleError('err.sellGroupHousesOf', { space: space.id });
    }
  }
}

// Dopo lo scambio di denaro, ciascuno deve poter pagare gli interessi delle caselle ipotecate che riceve.
function validateInterest(state: GameState, ctx: GameContext, t: Omit<TradeOffer, 'from'> & { from: number }): void {
  const check = (who: number, receives: TradeSide, gives: TradeSide) => {
    const due = interestOn(state, ctx, receives.spaces);
    if (due > 0 && state.players[who].money - gives.money + receives.money < due) {
      throw new RuleError('err.cannotPayInterest', { name: state.players[who].name, amount: due });
    }
  };
  check(t.from, t.get, t.give);
  check(t.to, t.give, t.get);
}

function transfer(state: GameState, from: number, to: number, side: TradeSide): void {
  state.players[from].money -= side.money;
  state.players[to].money += side.money;
  for (const id of side.spaces) state.ownership[id].owner = to;
}

export function doProposeTrade(state: GameState, ctx: GameContext, offer: Omit<TradeOffer, 'from'>): void {
  requirePhase(state, 'roll', 'endTurn');
  const from = state.current;
  const to = state.players[offer.to];
  if (!to || to.bankrupt || to.id === from) throw new RuleError('err.otherPlayer');
  const empty = (x: TradeSide) => x.money === 0 && x.spaces.length === 0;
  if (empty(offer.give) && empty(offer.get)) throw new RuleError('err.emptyTrade');
  validateSide(state, ctx, from, offer.give);
  validateSide(state, ctx, offer.to, offer.get);
  validateInterest(state, ctx, { from, ...offer });
  state.trade = { from, ...offer, give: { ...offer.give, spaces: [...offer.give.spaces] }, get: { ...offer.get, spaces: [...offer.get.spaces] } };
  if (current(state).isBot) state.tradeProposedThisTurn = true;
  log(state, 'log.proposes', { name: current(state).name, to: to.name });
}

export function doAcceptTrade(state: GameState, ctx: GameContext): void {
  const t = state.trade;
  if (!t) throw new RuleError('err.noTrade');
  // le condizioni potrebbero essere cambiate: si ricontrolla tutto
  validateSide(state, ctx, t.from, t.give);
  validateSide(state, ctx, t.to, t.get);
  validateInterest(state, ctx, t);
  const dueFrom = interestOn(state, ctx, t.get.spaces);
  const dueTo = interestOn(state, ctx, t.give.spaces);
  transfer(state, t.from, t.to, t.give);
  transfer(state, t.to, t.from, t.get);
  if (dueFrom) {
    pay(state, t.from, dueFrom, null);
    log(state, 'log.interest', { name: state.players[t.from].name, amount: dueFrom });
  }
  if (dueTo) {
    pay(state, t.to, dueTo, null);
    log(state, 'log.interest', { name: state.players[t.to].name, amount: dueTo });
  }
  state.trade = null;
  stat(state, t.from).trades++;
  stat(state, t.to).trades++;
  log(state, 'log.accepts', { name: state.players[t.to].name });
}

export function doCounterTrade(state: GameState, ctx: GameContext, offer: { give: TradeSide; get: TradeSide }): void {
  const t = state.trade;
  if (!t) throw new RuleError('err.noTrade');
  const counters = t.counters ?? 0;
  if (counters >= MAX_COUNTERS) throw new RuleError('err.noMoreCounters');
  const counter = { from: t.to, to: t.from, give: offer.give, get: offer.get };
  const empty = (x: TradeSide) => x.money === 0 && x.spaces.length === 0;
  if (empty(offer.give) && empty(offer.get)) throw new RuleError('err.emptyTrade');
  validateSide(state, ctx, counter.from, counter.give);
  validateSide(state, ctx, counter.to, counter.get);
  validateInterest(state, ctx, counter);
  state.trade = { ...counter, give: { ...offer.give, spaces: [...offer.give.spaces] }, get: { ...offer.get, spaces: [...offer.get.spaces] }, counters: counters + 1 };
  log(state, 'log.counters', { name: state.players[counter.from].name });
}

// Quartieri che ciascuno completerebbe se lo scambio andasse in porto.
export function tradeCompletions(state: GameState, ctx: GameContext, t: { from: number; to: number; give: TradeSide; get: TradeSide }): { player: number; group: string }[] {
  const after: GameState = { ...state, ownership: { ...state.ownership } };
  for (const id of t.give.spaces) if (after.ownership[id]) after.ownership[id] = { ...after.ownership[id], owner: t.to };
  for (const id of t.get.spaces) if (after.ownership[id]) after.ownership[id] = { ...after.ownership[id], owner: t.from };
  const out: { player: number; group: string }[] = [];
  for (const g of ctx.board.groups) {
    for (const who of [t.from, t.to]) {
      if (ownsWholeGroup(after, ctx, who, g.id) && !ownsWholeGroup(state, ctx, who, g.id)) out.push({ player: who, group: g.id });
    }
  }
  return out;
}

export function doRejectTrade(state: GameState): void {
  const t = state.trade;
  if (!t) throw new RuleError('err.noTrade');
  state.trade = null;
  log(state, 'log.rejects', { name: state.players[t.to].name });
}

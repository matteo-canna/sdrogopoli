// Aste: apertura, rilanci, passo e assegnazione della casella.
import type { GameContext, GameState } from './state';
import { finishMove, log, MIN_BID, requirePhase, RuleError, spaceById, stat } from './ruleHelpers';

// Apre l'asta per una casella. Con "queue" l'asta fa parte di una serie (le proprietà di chi
// è fallito verso la banca): finita una si passa alla successiva, poi il turno riprende.
export function startAuction(state: GameState, ctx: GameContext, spaceId: string, queue?: string[]): void {
  const n = state.players.length;
  const bidders: number[] = [];
  for (let k = 0; k < n; k++) {
    const id = (state.current + k) % n;
    if (!state.players[id].bankrupt && state.players[id].money >= MIN_BID) bidders.push(id);
  }
  const space = spaceById(ctx, spaceId);
  if (bidders.length === 0) {
    if (queue) log(state, 'log.nobodyCanBid', { space: space.id });
    afterAuction(state, ctx, queue);
    return;
  }
  state.auction = { spaceId, highestBid: 0, highestBidder: null, bidders, turn: 0, ...(queue ? { queue } : {}) };
  state.phase = 'auction';
  log(state, 'log.auction', { space: space.id });
}

function afterAuction(state: GameState, ctx: GameContext, queue?: string[]): void {
  state.auction = null;
  if (!queue) {
    finishMove(state);
    return;
  }
  const next = queue.shift();
  if (next) startAuction(state, ctx, next, queue);
  else state.phase = 'roll';
}

export function doBid(state: GameState, ctx: GameContext, amount: number): void {
  requirePhase(state, 'auction');
  const a = state.auction!;
  const bidder = state.players[a.bidders[a.turn]];
  if (!Number.isInteger(amount) || amount < Math.max(MIN_BID, a.highestBid + 1)) throw new RuleError('err.bidTooLow');
  if (amount > bidder.money) throw new RuleError('err.noMoney');
  a.highestBid = amount;
  a.highestBidder = bidder.id;
  log(state, 'log.bids', { name: bidder.name, amount });
  a.turn = (a.turn + 1) % a.bidders.length;
  checkAuctionEnd(state, ctx);
}

export function doPass(state: GameState, ctx: GameContext): void {
  requirePhase(state, 'auction');
  const a = state.auction!;
  const id = a.bidders[a.turn];
  log(state, 'log.passes', { name: state.players[id].name });
  a.bidders.splice(a.turn, 1);
  if (a.turn >= a.bidders.length) a.turn = 0;
  checkAuctionEnd(state, ctx);
}

function checkAuctionEnd(state: GameState, ctx: GameContext): void {
  const a = state.auction!;
  const onlyWinnerLeft = a.bidders.length === 1 && a.bidders[0] === a.highestBidder;
  if (a.bidders.length > 0 && !onlyWinnerLeft) return;
  const space = spaceById(ctx, a.spaceId);
  if (a.highestBidder !== null) {
    const w = state.players[a.highestBidder];
    w.money -= a.highestBid;
    state.ownership[a.spaceId] = { owner: w.id, houses: 0, mortgaged: false };
    stat(state, w.id).bought++;
    log(state, 'log.auctionWon', { name: w.name, space: space.id, amount: a.highestBid });
  } else {
    log(state, 'log.noBids', { space: space.id });
  }
  afterAuction(state, ctx, a.queue);
}

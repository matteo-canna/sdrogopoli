// Costruzione e vendita di case, ipoteche, debiti, bancarotta e passaggio del turno.
import type { GameContext, GameState } from './state';
import type { Card } from './types';
import {
  type Action,
  current,
  groupProperties,
  HOTEL,
  log,
  ownsWholeGroup,
  pay,
  requireOwnedProperty,
  requirePhase,
  RuleError,
  spaceById,
  stat,
} from './ruleHelpers';
import { groupHasBuildings, landmarkPrice, sharePrice } from './shares';
import { endByNetWorth, netWorth, recordHistory, teamName } from './teams';
import { startRound } from './rent';
import { startAuction } from './auction';
import { interestOn } from './trade';

export function doBuild(state: GameState, ctx: GameContext, spaceId: string): void {
  requirePhase(state, 'roll', 'buy', 'endTurn');
  const { space, own } = requireOwnedProperty(state, ctx, spaceId);
  if (space.type !== 'property') throw new RuleError('err.buildOnlyStreets');
  if (!ownsWholeGroup(state, ctx, state.current, space.group)) throw new RuleError('err.needGroup');
  const group = groupProperties(ctx, space.group).map((g) => state.ownership[g.id]);
  if (group.some((g) => g.mortgaged)) throw new RuleError('err.groupMortgaged');
  if (own.houses >= HOTEL) throw new RuleError('err.hasHotel');
  // costruzione uniforme: non si può superare di più di una casa le altre vie del quartiere
  if (own.houses > Math.min(...group.map((g) => g.houses))) throw new RuleError('err.buildEvenly');
  const p = current(state);
  if (p.money < space.housePrice) throw new RuleError('err.noMoney');
  p.money -= space.housePrice;
  own.houses++;
  stat(state, p.id).built++;
  log(state, 'log.builds', { name: p.name, space: space.id });
}

export function doSell(state: GameState, ctx: GameContext, spaceId: string): void {
  requirePhase(state, 'roll', 'buy', 'endTurn');
  const { space, own } = requireOwnedProperty(state, ctx, spaceId);
  if (space.type !== 'property' || own.houses === 0) throw new RuleError('err.noHouses');
  const group = groupProperties(ctx, space.group).map((g) => state.ownership[g.id]);
  if (own.houses < Math.max(...group.map((g) => g.houses))) throw new RuleError('err.sellEvenly');
  own.houses--;
  current(state).money += space.housePrice / 2;
  log(state, 'log.sellsHouse', { name: current(state).name, space: space.id });
}

export function doMortgage(state: GameState, ctx: GameContext, spaceId: string): void {
  requirePhase(state, 'roll', 'buy', 'endTurn');
  const { space, own } = requireOwnedProperty(state, ctx, spaceId);
  if (own.mortgaged) throw new RuleError('err.alreadyMortgaged');
  if (space.type === 'property' && groupHasBuildings(state, ctx, space.group)) {
    throw new RuleError('err.sellGroupHouses');
  }
  if (!('mortgage' in space)) throw new RuleError('err.cannotMortgage');
  own.mortgaged = true;
  current(state).money += space.mortgage;
  log(state, 'log.mortgages', { name: current(state).name, space: space.id });
}

// Per togliere l'ipoteca si paga il valore più il 10% di interessi.
export function unmortgageCost(mortgage: number): number {
  return Math.ceil(mortgage * 1.1);
}

export function doUnmortgage(state: GameState, ctx: GameContext, spaceId: string): void {
  requirePhase(state, 'roll', 'buy', 'endTurn');
  const { space, own } = requireOwnedProperty(state, ctx, spaceId);
  if (!own.mortgaged || !('mortgage' in space)) throw new RuleError('err.notMortgaged');
  const cost = unmortgageCost(space.mortgage);
  const p = current(state);
  if (p.money < cost) throw new RuleError('err.noMoney');
  p.money -= cost;
  own.mortgaged = false;
  log(state, 'log.unmortgages', { name: p.name, space: space.id });
}

export function nextPlayer(state: GameState, ctx: GameContext): void {
  const n = state.players.length;
  let i = state.current;
  do i = (i + 1) % n;
  while (state.players[i].bankrupt);
  // il turno è tornato indietro nell'ordine: inizia un nuovo giro
  if (i <= state.current) {
    state.round = (state.round ?? 1) + 1;
    recordHistory(state, ctx);
    const max = state.rules?.maxRounds;
    if (max && state.round > max) {
      endByNetWorth(state, ctx);
      return;
    }
    state.event = null;
    startRound(state, ctx);
  }
  state.current = i;
  state.phase = 'roll';
  state.doublesInRow = 0;
  state.extraRoll = false;
  state.creditor = null;
  state.tradeProposedThisTurn = false;
  log(state, 'log.turn', { name: state.players[i].name });
}

export function doEndTurn(state: GameState, ctx: GameContext): void {
  requirePhase(state, 'endTurn');
  if (current(state).money < 0) throw new RuleError('err.payDebtFirst');
  nextPlayer(state, ctx);
}

// Quanto può ancora ricavare un giocatore vendendo tutte le case (a metà prezzo)
// e ipotecando tutte le caselle libere da ipoteca.
export function liquidationValue(state: GameState, ctx: GameContext, playerId: number): number {
  let total = 0;
  for (const [id, own] of Object.entries(state.ownership)) {
    if (own.owner !== playerId) continue;
    const space = spaceById(ctx, id);
    if (space.type === 'property') total += (own.houses * space.housePrice) / 2;
    if (!own.mortgaged && 'mortgage' in space) total += space.mortgage;
  }
  for (const [group, holders] of Object.entries(state.shares ?? {})) {
    total += (holders.filter((h) => h === playerId).length * sharePrice(ctx, group)) / 2;
  }
  for (const [group, lm] of Object.entries(state.landmarks ?? {})) if (lm.owner === playerId) total += landmarkPrice(ctx, group) / 2;
  return total;
}

// Mosse possibili adesso per fare cassa, con quanto rende ciascuna:
// vendere una casa (si parte dalle vie più costruite del quartiere) o ipotecare.
export function debtOptions(state: GameState, ctx: GameContext, playerId: number): { action: Action; gain: number }[] {
  const options: { action: Action; gain: number }[] = [];
  // prima le quote, poi gli edifici speciali: costano meno da perdere
  for (const [group, holders] of Object.entries(state.shares ?? {})) {
    if (holders.includes(playerId)) options.push({ action: { type: 'sellShare', group }, gain: sharePrice(ctx, group) / 2 });
  }
  for (const [group, lm] of Object.entries(state.landmarks ?? {})) {
    if (lm.owner === playerId) options.push({ action: { type: 'sellLandmark', group }, gain: landmarkPrice(ctx, group) / 2 });
  }
  for (const space of ctx.board.spaces) {
    const own = state.ownership[space.id];
    if (!own || own.owner !== playerId) continue;
    if (space.type === 'property' && own.houses > 0) {
      const max = Math.max(...groupProperties(ctx, space.group).map((g) => state.ownership[g.id]?.houses ?? 0));
      if (own.houses === max) options.push({ action: { type: 'sell', spaceId: space.id }, gain: space.housePrice / 2 });
      continue;
    }
    if (own.mortgaged || !('mortgage' in space)) continue;
    if (space.type === 'property' && groupHasBuildings(state, ctx, space.group)) continue;
    options.push({ action: { type: 'mortgage', spaceId: space.id }, gain: space.mortgage });
  }
  return options;
}

export function doBankrupt(state: GameState, ctx: GameContext): void {
  const p = current(state);
  if (p.money >= 0) throw new RuleError('err.notInDebt');
  if (p.money + liquidationValue(state, ctx, p.id) >= 0) {
    throw new RuleError('err.canStillPay');
  }
  const creditor = state.creditor;
  // le case si vendono alla banca a metà prezzo: il ricavato copre parte del debito
  for (const [id, own] of Object.entries(state.ownership)) {
    if (own.owner !== p.id || own.houses === 0) continue;
    const space = spaceById(ctx, id);
    if (space.type === 'property') p.money += (own.houses * space.housePrice) / 2;
    own.houses = 0;
  }
  // quote ed edifici speciali tornano alla banca a metà prezzo
  for (const [group, holders] of Object.entries(state.shares ?? {})) {
    const mine = holders.filter((h) => h === p.id).length;
    if (!mine) continue;
    p.money += (mine * sharePrice(ctx, group)) / 2;
    state.shares![group] = holders.filter((h) => h !== p.id);
  }
  for (const [group, lm] of Object.entries(state.landmarks ?? {})) {
    if (lm.owner !== p.id) continue;
    p.money += landmarkPrice(ctx, group) / 2;
    delete state.landmarks![group];
  }
  const toAuction: string[] = [];
  const mortgagedToCreditor: string[] = [];
  for (const space of ctx.board.spaces) {
    const own = state.ownership[space.id];
    if (!own || own.owner !== p.id) continue;
    if (creditor === null) {
      delete state.ownership[space.id]; // tornano alla banca, libere, e vanno all'asta
      toAuction.push(space.id);
    } else {
      state.ownership[space.id] = { owner: creditor, houses: 0, mortgaged: own.mortgaged };
      if (own.mortgaged) mortgagedToCreditor.push(space.id);
    }
  }
  if (creditor !== null) {
    // il creditore restituisce la parte di debito che il fallito non poteva coprire
    const c = state.players[creditor];
    c.money += p.money;
    // e paga gli interessi sulle caselle ipotecate ricevute, per quanto può
    const due = Math.min(interestOn(state, ctx, mortgagedToCreditor), Math.max(c.money, 0));
    if (due > 0) {
      pay(state, creditor, due, null);
      log(state, 'log.interestReceived', { name: c.name, amount: due });
    }
  } else if (state.rules?.parkPot) {
    // nella Panchina del Parco resta solo quello che il fallito ha davvero pagato
    state.pot = Math.max(0, (state.pot ?? 0) + p.money);
  }
  for (const cardId of p.jailCards) {
    const card = ctx.cards.cards.find((c) => c.id === cardId) as Card;
    state.decks[card.deck].push(card.id);
  }
  p.jailCards = [];
  p.money = 0;
  p.bankrupt = true;
  p.inJail = false;
  stat(state, p.id).bankruptRound = state.round;
  log(state, 'log.bankrupt', { name: p.name });

  const alive = state.players.filter((pl) => !pl.bankrupt);
  // con le squadre si va avanti finché resta in piedi più di una squadra
  const teamsAlive = new Set(alive.map((pl) => (state.rules?.teams ? pl.team : pl.id)));
  if (teamsAlive.size === 1) {
    // vince la squadra: il premio va a chi ha il patrimonio più alto tra i compagni rimasti
    const best = alive.reduce((a, b) => (netWorth(state, ctx, b.id) > netWorth(state, ctx, a.id) ? b : a));
    state.winner = best.id;
    state.phase = 'gameOver';
    recordHistory(state, ctx);
    log(state, state.rules?.teams ? 'log.teamWins' : 'log.wins', { name: state.rules?.teams ? teamName(state, best.id) : best.name });
    return;
  }
  nextPlayer(state, ctx);
  if (toAuction.length && state.phase !== 'gameOver') {
    log(state, 'log.toAuction', { name: p.name });
    const [first, ...rest] = toAuction;
    startAuction(state, ctx, first, rest);
  }
}

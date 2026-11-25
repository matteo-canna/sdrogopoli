// Regole di gioco: ogni azione produce un nuovo stato senza modificare quello precedente.
import { rollDice } from './dice';
import { defaultRules, emptyStats, withRng, JAIL_FINE, MAX_JAIL_ATTEMPTS, SPRINT_FACES, type GameContext, type SprintFace, type GameState, type Player, type PlayerStats, type TradeOffer, type TradeSide } from './state';
import type { Card, CardEffect, DeckId, PropertySpace, Space } from './types';
import { format, type MsgKey, type Params } from '../i18n';

export type Action =
  | { type: 'roll' }
  | { type: 'buy' }
  | { type: 'decline' }
  | { type: 'payJailFine' }
  | { type: 'useJailCard' }
  | { type: 'build'; spaceId: string }
  | { type: 'sell'; spaceId: string }
  | { type: 'mortgage'; spaceId: string }
  | { type: 'unmortgage'; spaceId: string }
  | { type: 'endTurn' }
  | { type: 'bankrupt' }
  | { type: 'bid'; amount: number }
  | { type: 'pass' }
  | { type: 'proposeTrade'; offer: Omit<TradeOffer, 'from'> }
  | { type: 'acceptTrade' }
  | { type: 'rejectTrade' }
  // chi riceve lo scambio risponde con condizioni diverse (dal suo punto di vista: cosa dà, cosa chiede)
  | { type: 'counterTrade'; offer: { give: TradeSide; get: TradeSide } }
  | { type: 'chooseCard'; option: number };

export const MIN_BID = 10;
// controproposte per trattativa: chi riceve ne fa una, chi ha proposto può rispondere con un'altra
export const MAX_COUNTERS = 2;

// Chi deve agire adesso: di solito il giocatore di turno, ma durante un'asta
// rilancia chi è di mano, e con uno scambio in sospeso risponde il destinatario.
export function actingPlayer(state: GameState): number {
  if (state.trade) return state.trade.to;
  if (state.phase === 'auction' && state.auction) return state.auction.bidders[state.auction.turn];
  return state.current;
}

// Errore per un'azione non permessa in questo momento: l'interfaccia può mostrarlo.
// Errore di regola: la chiave della frase e i suoi valori, così l'interfaccia lo mostra nella lingua scelta.
// Il messaggio (per i test e la console) è in italiano.
export class RuleError extends Error {
  constructor(
    readonly key: MsgKey,
    readonly params?: Params,
  ) {
    super(format('it', key, params));
  }
}

const BOARD_SIZE_FALLBACK = 40;
export const HOTEL = 5;
export const MAX_LOG = 50;

// ---------- funzioni di supporto ----------

function current(state: GameState): Player {
  return state.players[state.current];
}

function boardSize(ctx: GameContext): number {
  return ctx.board.spaces.length || BOARD_SIZE_FALLBACK;
}

function spaceById(ctx: GameContext, id: string): Space {
  const s = ctx.board.spaces.find((sp) => sp.id === id);
  if (!s) throw new RuleError('err.unknownSpace', { id });
  return s;
}

function isBuyable(s: Space): boolean {
  return s.type === 'property' || s.type === 'station' || s.type === 'utility';
}

function jailIndex(ctx: GameContext): number {
  return ctx.board.spaces.findIndex((s) => s.type === 'jail');
}

function groupProperties(ctx: GameContext, group: string): PropertySpace[] {
  return ctx.board.spaces.filter((s): s is PropertySpace => s.type === 'property' && s.group === group);
}

// Vero se il giocatore possiede tutte le proprietà del gruppo.
// Compagni di squadra: solo con la regola attiva, e mai sé stessi.
export function sameTeam(state: GameState, a: number, b: number): boolean {
  if (!state.rules?.teams || a === b) return false;
  const ta = state.players[a]?.team;
  return ta !== undefined && ta === state.players[b]?.team;
}

// I giocatori di una squadra (o il solo giocatore, senza squadre).
export function teamMembers(state: GameState, id: number): number[] {
  if (!state.rules?.teams) return [id];
  const t = state.players[id]?.team;
  return state.players.filter((p) => p.team === t).map((p) => p.id);
}

// Patrimonio della squadra: la somma di chi non è fallito.
export function teamWorth(state: GameState, ctx: GameContext, id: number): number {
  return teamMembers(state, id)
    .filter((m) => !state.players[m].bankrupt)
    .reduce((sum, m) => sum + netWorth(state, ctx, m), 0);
}

export function ownsWholeGroup(state: GameState, ctx: GameContext, playerId: number, group: string): boolean {
  return groupProperties(ctx, group).every((p) => state.ownership[p.id]?.owner === playerId);
}

// Statistiche di un giocatore (le partite salvate prima delle statistiche partono da zero).
function stat(state: GameState, playerId: number): PlayerStats {
  state.stats ??= [];
  return (state.stats[playerId] ??= emptyStats());
}

// Fotografia dei patrimoni, per il grafico di fine partita.
function recordHistory(state: GameState, ctx: GameContext): void {
  state.history ??= [];
  state.history.push(state.players.map((p) => (p.bankrupt ? 0 : netWorth(state, ctx, p.id))));
}

function log(state: GameState, k: MsgKey, p?: Params): void {
  state.log.push(p ? { k, p } : { k });
  state.eventCount = (state.eventCount ?? state.log.length - 1) + 1;
}

// Patrimonio: contanti più valore di proprietà (meno ipoteche) e case al prezzo di costruzione.
export function netWorth(state: GameState, ctx: GameContext, playerId: number): number {
  let total = state.players[playerId].money;
  for (const [id, own] of Object.entries(state.ownership)) {
    if (own.owner !== playerId) continue;
    const space = spaceById(ctx, id);
    if (!('price' in space)) continue;
    total += own.mortgaged ? space.price - space.mortgage : space.price;
    if (space.type === 'property') total += own.houses * space.housePrice;
  }
  return total;
}

// Trasferisce denaro. "to" null = banca. Il pagatore può finire in negativo (debito).
function pay(state: GameState, fromId: number, amount: number, toId: number | null): void {
  const from = state.players[fromId];
  from.money -= amount;
  if (toId !== null) state.players[toId].money += amount;
  else if (state.rules?.parkPot) state.pot = (state.pot ?? 0) + amount;
  if (from.money < 0) state.creditor = toId;
}

// ---------- affitti ----------

export function computeRent(state: GameState, ctx: GameContext, spaceId: string, diceTotal: number): number {
  const space = spaceById(ctx, spaceId);
  const own = state.ownership[spaceId];
  if (!own || own.mortgaged) return 0;
  const ownedOfType = (type: Space['type']) =>
    ctx.board.spaces.filter((s) => s.type === type && state.ownership[s.id]?.owner === own.owner).length;

  switch (space.type) {
    case 'property':
      if (own.houses > 0) return space.rent[own.houses];
      // terreno senza case: affitto doppio se il proprietario ha tutto il gruppo
      return ownsWholeGroup(state, ctx, own.owner, space.group) ? space.rent[0] * 2 : space.rent[0];
    case 'station':
      return space.rent[ownedOfType('station') - 1];
    case 'utility':
      return space.diceMultiplier[ownedOfType('utility') - 1] * diceTotal;
    default:
      return 0;
  }
}

// ---------- movimento ----------

// Sposta il giocatore in avanti di "steps" caselle (o indietro se negativo).
// Passando dalla Partenza in avanti si incassa lo stipendio.
function moveBy(state: GameState, ctx: GameContext, steps: number): void {
  const p = current(state);
  const size = boardSize(ctx);
  const raw = p.position + steps;
  if (steps > 0 && raw >= size) collectSalary(state, ctx);
  p.position = ((raw % size) + size) % size;
}

function moveForwardTo(state: GameState, ctx: GameContext, index: number): void {
  const p = current(state);
  const size = boardSize(ctx);
  const steps = (index - p.position + size) % size;
  moveBy(state, ctx, steps === 0 ? size : steps);
}

function collectSalary(state: GameState, ctx: GameContext): void {
  const start = ctx.board.spaces.find((s) => s.type === 'start');
  const salary = start && start.type === 'start' ? start.salary : 0;
  current(state).money += salary;
  log(state, 'log.passGo', { name: current(state).name, amount: salary });
}

function sendToJail(state: GameState, ctx: GameContext): void {
  const p = current(state);
  p.position = jailIndex(ctx);
  p.inJail = true;
  p.jailAttempts = 0;
  stat(state, p.id).jailVisits++;
  state.extraRoll = false;
  state.doublesInRow = 0;
  log(state, 'log.toJail', { name: p.name });
}

// ---------- risoluzione della casella di arrivo ----------

function diceTotal(state: GameState): number {
  return state.lastRoll ? state.lastRoll[0] + state.lastRoll[1] : 0;
}

function resolveLanding(state: GameState, ctx: GameContext): void {
  const p = current(state);
  const space = ctx.board.spaces[p.position];
  log(state, 'log.lands', { name: p.name, space: space.id });

  if (isBuyable(space)) {
    const own = state.ownership[space.id];
    if (!own) {
      state.phase = 'buy';
      return;
    }
    if (own.owner !== p.id && !sameTeam(state, p.id, own.owner)) {
      const base = computeRent(state, ctx, space.id, diceTotal(state));
      // Dado Sprint "Affitto pieno": vale solo per l'arrivo di questo lancio
      const rent = state.sprintRent ? base * 2 : base;
      if (rent > 0) {
        pay(state, p.id, rent, own.owner);
        stat(state, p.id).rentPaid += rent;
        stat(state, own.owner).rentReceived += rent;
        log(state, 'log.rent', { name: p.name, amount: rent, owner: state.players[own.owner].name });
      }
    }
  } else if (space.type === 'tax') {
    pay(state, p.id, space.amount, null);
    stat(state, p.id).taxesPaid += space.amount;
    log(state, 'log.tax', { name: p.name, amount: space.amount });
  } else if (space.type === 'card') {
    drawCard(state, ctx, space.deck);
    if (state.phase === 'buy' || state.phase === 'cardChoice') return;
  } else if (space.type === 'goToJail') {
    sendToJail(state, ctx);
  } else if (space.type === 'free' && state.rules?.parkPot && state.pot > 0) {
    log(state, 'log.pot', { name: p.name, space: space.id, amount: state.pot });
    p.money += state.pot;
    state.pot = 0;
  }
  finishMove(state);
}

// Dopo aver risolto la casella: rilancia se c'era un doppio, altrimenti fine turno.
// Chi è in debito non rilancia: deve prima saldare o dichiarare bancarotta.
function finishMove(state: GameState): void {
  const p = current(state);
  state.phase = state.extraRoll && !p.inJail && p.money >= 0 ? 'roll' : 'endTurn';
}

// ---------- carte ----------

function drawCard(state: GameState, ctx: GameContext, deck: DeckId): void {
  const id = state.decks[deck].shift();
  if (!id) return; // mazzo vuoto (tutte le carte "esci gratis" sono in mano)
  const card = ctx.cards.cards.find((c) => c.id === id) as Card;
  log(state, 'log.draws', { name: current(state).name, card: card.id });
  if (card.effect.kind === 'getOutOfJailFree') {
    current(state).jailCards.push(card.id);
  } else {
    state.decks[deck].push(card.id); // torna in fondo al mazzo
    if (card.effect.kind === 'choice') {
      state.pendingCard = card.id;
      state.phase = 'cardChoice';
      return;
    }
    applyCardEffect(state, ctx, card.effect);
  }
}

function doChooseCard(state: GameState, ctx: GameContext, option: number): void {
  requirePhase(state, 'cardChoice');
  const card = ctx.cards.cards.find((c) => c.id === state.pendingCard);
  if (!card || card.effect.kind !== 'choice') throw new RuleError('err.noCardChoice');
  const chosen = card.effect.options[option];
  if (!chosen) throw new RuleError('err.badChoice');
  state.pendingCard = null;
  log(state, 'log.chooses', { name: current(state).name, choice: `${card.id}#${option}` });
  applyCardEffect(state, ctx, chosen.effect);
  // effetti senza movimento: il turno prosegue come dopo una carta normale
  if (state.phase === 'cardChoice') finishMove(state);
}

function applyCardEffect(state: GameState, ctx: GameContext, effect: CardEffect): void {
  const p = current(state);
  const others = state.players.filter((o) => o.id !== p.id && !o.bankrupt);
  switch (effect.kind) {
    case 'gain':
      p.money += effect.amount;
      break;
    case 'pay':
      pay(state, p.id, effect.amount, null);
      break;
    case 'payEachPlayer':
      for (const o of others) pay(state, p.id, effect.amount, o.id);
      if (p.money < 0) state.creditor = null;
      break;
    case 'collectFromEachPlayer':
      // chi non è di turno paga solo quello che ha: non può gestire un debito fuori dal proprio turno
      for (const o of others) {
        const paid = Math.min(effect.amount, Math.max(o.money, 0));
        o.money -= paid;
        p.money += paid;
      }
      break;
    case 'repairs': {
      let total = 0;
      for (const own of Object.values(state.ownership)) {
        if (own.owner !== p.id) continue;
        total += own.houses === HOTEL ? effect.perHotel : own.houses * effect.perHouse;
      }
      if (total > 0) pay(state, p.id, total, null);
      break;
    }
    case 'goToJail':
      sendToJail(state, ctx);
      break;
    case 'moveTo': {
      const idx = ctx.board.spaces.findIndex((s) => s.id === effect.space);
      moveForwardTo(state, ctx, idx);
      resolveLanding(state, ctx);
      break;
    }
    case 'moveBy':
      moveBy(state, ctx, effect.steps);
      resolveLanding(state, ctx);
      break;
    case 'moveToNearest': {
      const size = boardSize(ctx);
      for (let i = 1; i <= size; i++) {
        const idx = (p.position + i) % size;
        if (ctx.board.spaces[idx].type === effect.spaceType) {
          moveForwardTo(state, ctx, idx);
          break;
        }
      }
      resolveLanding(state, ctx);
      break;
    }
    case 'getOutOfJailFree':
      // solo come carta a sé (si tiene in mano): nelle scelte non è ammessa
      break;
    case 'choice':
      break;
  }
}

// ---------- azioni ----------

function requirePhase(state: GameState, ...phases: GameState['phase'][]): void {
  if (!phases.includes(state.phase)) throw new RuleError('err.notNow');
}

function requireOwnedProperty(state: GameState, ctx: GameContext, spaceId: string) {
  const space = spaceById(ctx, spaceId);
  const own = state.ownership[spaceId];
  if (!own || own.owner !== state.current) throw new RuleError('err.notYours');
  return { space, own };
}

function doRoll(state: GameState, ctx: GameContext): void {
  requirePhase(state, 'roll');
  const p = current(state);
  const roll = rollDice(ctx.rng!); // applyAction garantisce sempre un generatore
  state.lastRoll = roll.dice;
  log(state, 'log.rolls', { name: p.name, a: roll.dice[0], b: roll.dice[1] });
  if (roll.isDouble) stat(state, p.id).doubles++;

  if (p.inJail) {
    if (roll.isDouble) {
      p.inJail = false;
      p.jailAttempts = 0;
      log(state, 'log.jailDouble', { name: p.name });
    } else {
      p.jailAttempts++;
      if (p.jailAttempts < MAX_JAIL_ATTEMPTS) {
        state.phase = 'endTurn';
        return;
      }
      // terzo tentativo fallito: paga la multa ed esce comunque
      pay(state, p.id, JAIL_FINE, null);
      p.inJail = false;
      p.jailAttempts = 0;
      log(state, 'log.jailFine', { name: p.name, amount: JAIL_FINE });
    }
    // uscendo dalla Caserma non si rilancia, nemmeno con un doppio
    state.extraRoll = false;
    moveBy(state, ctx, roll.total);
    resolveLanding(state, ctx);
    return;
  }

  if (roll.isDouble) {
    state.doublesInRow++;
    if (state.doublesInRow === 3) {
      log(state, 'log.threeDoubles', { name: p.name });
      sendToJail(state, ctx);
      state.phase = 'endTurn';
      return;
    }
  }
  state.extraRoll = roll.isDouble;
  const sprint = state.rules?.sprintDie ? SPRINT_FACES[Math.floor(ctx.rng!() * SPRINT_FACES.length)] : null;
  state.lastSprint = sprint;
  state.sprintRent = sprint === 'pieno';
  moveBy(state, ctx, roll.total + (typeof sprint === 'number' ? sprint : 0));
  if (sprint) sprintLog(state, p.name, sprint);
  // Occasione: se la casella non è in vendita si prosegue fino alla prossima proprietà libera
  if (sprint === 'occasione') {
    const here = ctx.board.spaces[p.position];
    if (!(isBuyable(here) && !state.ownership[here.id])) {
      const size = boardSize(ctx);
      for (let k = 1; k < size; k++) {
        const i = (p.position + k) % size;
        const sp = ctx.board.spaces[i];
        if (isBuyable(sp) && !state.ownership[sp.id]) {
          moveForwardTo(state, ctx, i);
          break;
        }
      }
    }
  }
  resolveLanding(state, ctx);
}

function sprintLog(state: GameState, name: string, face: SprintFace): void {
  if (typeof face === 'number') log(state, 'log.sprintSteps', { name, n: face });
  else log(state, face === 'occasione' ? 'log.sprintBargain' : 'log.sprintFull', { name });
}

function doBuy(state: GameState, ctx: GameContext): void {
  requirePhase(state, 'buy');
  const p = current(state);
  const space = ctx.board.spaces[p.position];
  if (!isBuyable(space) || !('price' in space)) throw new RuleError('err.notForSale');
  if (p.money < space.price) throw new RuleError('err.noMoney');
  p.money -= space.price;
  state.ownership[space.id] = { owner: p.id, houses: 0, mortgaged: false };
  stat(state, p.id).bought++;
  log(state, 'log.buys', { name: p.name, space: space.id, amount: space.price });
  finishMove(state);
}

function doDecline(state: GameState, ctx: GameContext): void {
  requirePhase(state, 'buy');
  const p = current(state);
  log(state, 'log.declines', { name: p.name });
  startAuction(state, ctx, ctx.board.spaces[p.position].id);
}

// ---------- aste ----------

// Apre l'asta per una casella. Con "queue" l'asta fa parte di una serie (le proprietà di chi
// è fallito verso la banca): finita una si passa alla successiva, poi il turno riprende.
function startAuction(state: GameState, ctx: GameContext, spaceId: string, queue?: string[]): void {
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

function doBid(state: GameState, ctx: GameContext, amount: number): void {
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

function doPass(state: GameState, ctx: GameContext): void {
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

// ---------- scambi ----------

function validateSide(state: GameState, ctx: GameContext, owner: number, side: TradeSide): void {
  if (!Number.isInteger(side.money) || side.money < 0) throw new RuleError('err.badAmount');
  if (side.money > Math.max(state.players[owner].money, 0)) throw new RuleError('err.playerNoMoney', { name: state.players[owner].name });
  for (const id of side.spaces) {
    const space = spaceById(ctx, id);
    if (state.ownership[id]?.owner !== owner) throw new RuleError('err.notOwnedBy', { space: space.id, name: state.players[owner].name });
    if (space.type === 'property' && groupProperties(ctx, space.group).some((g) => (state.ownership[g.id]?.houses ?? 0) > 0)) {
      throw new RuleError('err.sellGroupHousesOf', { space: space.id });
    }
  }
}

function doProposeTrade(state: GameState, ctx: GameContext, offer: Omit<TradeOffer, 'from'>): void {
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

function doAcceptTrade(state: GameState, ctx: GameContext): void {
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

function doCounterTrade(state: GameState, ctx: GameContext, offer: { give: TradeSide; get: TradeSide }): void {
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

function doRejectTrade(state: GameState): void {
  const t = state.trade;
  if (!t) throw new RuleError('err.noTrade');
  state.trade = null;
  log(state, 'log.rejects', { name: state.players[t.to].name });
}

function doPayJailFine(state: GameState): void {
  requirePhase(state, 'roll');
  const p = current(state);
  if (!p.inJail) throw new RuleError('err.notInJail');
  if (p.money < JAIL_FINE) throw new RuleError('err.noMoney');
  pay(state, p.id, JAIL_FINE, null);
  p.inJail = false;
  p.jailAttempts = 0;
  log(state, 'log.jailFine', { name: p.name, amount: JAIL_FINE });
}

function doUseJailCard(state: GameState, ctx: GameContext): void {
  requirePhase(state, 'roll');
  const p = current(state);
  if (!p.inJail) throw new RuleError('err.notInJail');
  const cardId = p.jailCards.pop();
  if (!cardId) throw new RuleError('err.noJailCard');
  const card = ctx.cards.cards.find((c) => c.id === cardId) as Card;
  state.decks[card.deck].push(card.id); // la carta torna in fondo al mazzo
  p.inJail = false;
  p.jailAttempts = 0;
  log(state, 'log.jailCard', { name: p.name });
}

function doBuild(state: GameState, ctx: GameContext, spaceId: string): void {
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

function doSell(state: GameState, ctx: GameContext, spaceId: string): void {
  requirePhase(state, 'roll', 'buy', 'endTurn');
  const { space, own } = requireOwnedProperty(state, ctx, spaceId);
  if (space.type !== 'property' || own.houses === 0) throw new RuleError('err.noHouses');
  const group = groupProperties(ctx, space.group).map((g) => state.ownership[g.id]);
  if (own.houses < Math.max(...group.map((g) => g.houses))) throw new RuleError('err.sellEvenly');
  own.houses--;
  current(state).money += space.housePrice / 2;
  log(state, 'log.sellsHouse', { name: current(state).name, space: space.id });
}

function doMortgage(state: GameState, ctx: GameContext, spaceId: string): void {
  requirePhase(state, 'roll', 'buy', 'endTurn');
  const { space, own } = requireOwnedProperty(state, ctx, spaceId);
  if (own.mortgaged) throw new RuleError('err.alreadyMortgaged');
  if (space.type === 'property' && groupProperties(ctx, space.group).some((g) => (state.ownership[g.id]?.houses ?? 0) > 0)) {
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

function doUnmortgage(state: GameState, ctx: GameContext, spaceId: string): void {
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

function nextPlayer(state: GameState, ctx: GameContext): void {
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
  }
  state.current = i;
  state.phase = 'roll';
  state.doublesInRow = 0;
  state.extraRoll = false;
  state.creditor = null;
  state.tradeProposedThisTurn = false;
  log(state, 'log.turn', { name: state.players[i].name });
}

function doEndTurn(state: GameState, ctx: GameContext): void {
  requirePhase(state, 'endTurn');
  if (current(state).money < 0) throw new RuleError('err.payDebtFirst');
  nextPlayer(state, ctx);
}

// Lati del tabellone: le caselle tra due angoli (per 40 caselle: 1-9, 11-19, 21-29, 31-39).
export function boardSides(ctx: GameContext): string[][] {
  const size = ctx.board.spaces.length;
  const side = size / 4;
  return [0, 1, 2, 3].map((k) =>
    ctx.board.spaces.slice(k * side + 1, (k + 1) * side).filter((sp) => isBuyable(sp)).map((sp) => sp.id),
  );
}

// Quartieri completi di un giocatore.
export function completeGroups(state: GameState, ctx: GameContext, playerId: number): number {
  return ctx.board.groups.filter((g) => ownsWholeGroup(state, ctx, playerId, g.id)).length;
}

// A che punto è ciascuno con gli obiettivi (per il pannello e per i test).
export function goalProgress(state: GameState, ctx: GameContext, playerId: number): { worth: number; groups: number; side: number } {
  const sides = boardSides(ctx);
  const side = Math.max(...sides.map((ids) => ids.filter((id) => state.ownership[id]?.owner === playerId).length / ids.length));
  return { worth: netWorth(state, ctx, playerId), groups: completeGroups(state, ctx, playerId), side };
}

// Vittorie alternative: il primo che raggiunge un obiettivo (a partire da chi è di turno) vince subito.
function checkGoals(state: GameState, ctx: GameContext): void {
  const r = state.rules;
  if (!r || (!r.goalWorth && !r.goalGroups && !r.goalSide)) return;
  const n = state.players.length;
  for (let k = 0; k < n; k++) {
    const p = state.players[(state.current + k) % n];
    if (p.bankrupt || p.money < 0) continue;
    const g = goalProgress(state, ctx, p.id);
    let reason: 'worth' | 'groups' | 'side' | '' = '';
    if (r.goalWorth && g.worth >= r.goalWorth) reason = 'worth';
    else if (r.goalGroups && g.groups >= r.goalGroups) reason = 'groups';
    else if (r.goalSide && g.side >= 1) reason = 'side';
    if (!reason) continue;
    state.winner = p.id;
    state.phase = 'gameOver';
    state.winReason = reason;
    state.auction = null;
    recordHistory(state, ctx);
    if (reason === 'worth') log(state, 'log.goalWorth', { name: p.name, amount: g.worth });
    else if (reason === 'groups') log(state, 'log.goalGroups', { name: p.name, n: g.groups });
    else log(state, 'log.goalSide', { name: p.name });
    return;
  }
}

// Fine della partita a tempo: vince chi ha il patrimonio più alto.
function endByNetWorth(state: GameState, ctx: GameContext): void {
  const alive = state.players.filter((p) => !p.bankrupt);
  // con le squadre contano i patrimoni sommati; dentro la squadra vince chi ha di più
  const score = (id: number) => (state.rules?.teams ? teamWorth(state, ctx, id) * 1e6 + netWorth(state, ctx, id) : netWorth(state, ctx, id));
  const best = alive.reduce((a, b) => (score(b.id) > score(a.id) ? b : a));
  state.winner = best.id;
  state.phase = 'gameOver';
  // il giro finale è già stato fotografato passando il turno
  state.round = state.rules.maxRounds ?? state.round;
  const n = state.rules.maxRounds ?? state.round;
  if (state.rules?.teams) log(state, 'log.teamTimeUp', { n, name: teamName(state, best.id), amount: teamWorth(state, ctx, best.id) });
  else log(state, 'log.timeUp', { n, name: best.name, amount: netWorth(state, ctx, best.id) });
}

// Nome della squadra: i nomi dei compagni, come "Anna e Carla".
export function teamName(state: GameState, id: number): string {
  return teamMembers(state, id)
    .map((m) => state.players[m].name)
    .join(' + ');
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
  return total;
}

// Mosse possibili adesso per fare cassa, con quanto rende ciascuna:
// vendere una casa (si parte dalle vie più costruite del quartiere) o ipotecare.
export function debtOptions(state: GameState, ctx: GameContext, playerId: number): { action: Action; gain: number }[] {
  const options: { action: Action; gain: number }[] = [];
  for (const space of ctx.board.spaces) {
    const own = state.ownership[space.id];
    if (!own || own.owner !== playerId) continue;
    if (space.type === 'property' && own.houses > 0) {
      const max = Math.max(...groupProperties(ctx, space.group).map((g) => state.ownership[g.id]?.houses ?? 0));
      if (own.houses === max) options.push({ action: { type: 'sell', spaceId: space.id }, gain: space.housePrice / 2 });
      continue;
    }
    if (own.mortgaged || !('mortgage' in space)) continue;
    if (space.type === 'property' && groupProperties(ctx, space.group).some((g) => (state.ownership[g.id]?.houses ?? 0) > 0)) continue;
    options.push({ action: { type: 'mortgage', spaceId: space.id }, gain: space.mortgage });
  }
  return options;
}

function doBankrupt(state: GameState, ctx: GameContext): void {
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

// Applica un'azione e restituisce il nuovo stato. Lancia RuleError se l'azione non è valida.
export function applyAction(state: GameState, action: Action, gameCtx: GameContext): GameState {
  if (state.phase === 'gameOver') throw new RuleError('err.gameOver');
  // con uno scambio in sospeso si può solo accettare o rifiutare
  if (state.trade && action.type !== 'acceptTrade' && action.type !== 'rejectTrade' && action.type !== 'counterTrade') {
    throw new RuleError('err.answerTradeFirst');
  }
  const next = structuredClone(state);
  // compatibilità con partite salvate prima di aste e scambi
  next.auction ??= null;
  next.trade ??= null;
  next.rules ??= defaultRules(gameCtx.board);
  next.round ??= 1;
  next.pot ??= 0;
  const ctx = withRng(gameCtx, next);
  // l'"Affitto pieno" vale solo per l'arrivo del lancio: dopo qualunque altra mossa non conta più
  if (action.type !== 'roll') next.sprintRent = false;
  switch (action.type) {
    case 'roll': doRoll(next, ctx); break;
    case 'buy': doBuy(next, ctx); break;
    case 'decline': doDecline(next, ctx); break;
    case 'payJailFine': doPayJailFine(next); break;
    case 'useJailCard': doUseJailCard(next, ctx); break;
    case 'build': doBuild(next, ctx, action.spaceId); break;
    case 'sell': doSell(next, ctx, action.spaceId); break;
    case 'mortgage': doMortgage(next, ctx, action.spaceId); break;
    case 'unmortgage': doUnmortgage(next, ctx, action.spaceId); break;
    case 'endTurn': doEndTurn(next, ctx); break;
    case 'bankrupt': doBankrupt(next, ctx); break;
    case 'bid': doBid(next, ctx, action.amount); break;
    case 'pass': doPass(next, ctx); break;
    case 'proposeTrade': doProposeTrade(next, ctx, action.offer); break;
    case 'acceptTrade': doAcceptTrade(next, ctx); break;
    case 'rejectTrade': doRejectTrade(next); break;
    case 'counterTrade': doCounterTrade(next, ctx, action.offer); break;
    case 'chooseCard': doChooseCard(next, ctx, action.option); break;
  }
  // obiettivi della partita: si controllano dopo ogni mossa, ma non a metà di un'asta o di uno scambio
  if (next.phase !== 'gameOver' && next.phase !== 'auction' && !next.trade) checkGoals(next, ctx);
  // si tengono solo gli ultimi eventi: lo stato resta piccolo da copiare e salvare
  if (next.log.length > MAX_LOG) next.log.splice(0, next.log.length - MAX_LOG);
  return next;
}

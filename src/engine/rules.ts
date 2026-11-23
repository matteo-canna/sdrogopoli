// Regole di gioco: ogni azione produce un nuovo stato senza modificare quello precedente.
import { rollDice } from './dice';
import { JAIL_FINE, MAX_JAIL_ATTEMPTS, type GameContext, type GameState, type Player } from './state';
import type { Card, CardEffect, DeckId, PropertySpace, Space } from './types';

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
  | { type: 'bankrupt' };

// Errore per un'azione non permessa in questo momento: l'interfaccia può mostrarlo.
export class RuleError extends Error {}

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
  if (!s) throw new RuleError(`Casella sconosciuta: ${id}`);
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
export function ownsWholeGroup(state: GameState, ctx: GameContext, playerId: number, group: string): boolean {
  return groupProperties(ctx, group).every((p) => state.ownership[p.id]?.owner === playerId);
}

function log(state: GameState, msg: string): void {
  state.log.push(msg);
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
  log(state, `${current(state).name} passa dalla Partenza e incassa ${salary}.`);
}

function sendToJail(state: GameState, ctx: GameContext): void {
  const p = current(state);
  p.position = jailIndex(ctx);
  p.inJail = true;
  p.jailAttempts = 0;
  state.extraRoll = false;
  state.doublesInRow = 0;
  log(state, `${p.name} va in Caserma!`);
}

// ---------- risoluzione della casella di arrivo ----------

function diceTotal(state: GameState): number {
  return state.lastRoll ? state.lastRoll[0] + state.lastRoll[1] : 0;
}

function resolveLanding(state: GameState, ctx: GameContext): void {
  const p = current(state);
  const space = ctx.board.spaces[p.position];
  log(state, `${p.name} arriva su ${space.name}.`);

  if (isBuyable(space)) {
    const own = state.ownership[space.id];
    if (!own) {
      state.phase = 'buy';
      return;
    }
    if (own.owner !== p.id) {
      const rent = computeRent(state, ctx, space.id, diceTotal(state));
      if (rent > 0) {
        pay(state, p.id, rent, own.owner);
        log(state, `${p.name} paga ${rent} di affitto a ${state.players[own.owner].name}.`);
      }
    }
  } else if (space.type === 'tax') {
    pay(state, p.id, space.amount, null);
    log(state, `${p.name} paga ${space.amount} di tasse.`);
  } else if (space.type === 'card') {
    drawCard(state, ctx, space.deck);
    if (state.phase === 'buy') return;
  } else if (space.type === 'goToJail') {
    sendToJail(state, ctx);
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
  log(state, `${current(state).name} pesca: "${card.text}"`);
  if (card.effect.kind === 'getOutOfJailFree') {
    current(state).jailCards.push(card.id);
  } else {
    state.decks[deck].push(card.id); // torna in fondo al mazzo
    applyCardEffect(state, ctx, card.effect);
  }
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
      break;
  }
}

// ---------- azioni ----------

function requirePhase(state: GameState, ...phases: GameState['phase'][]): void {
  if (!phases.includes(state.phase)) throw new RuleError('Azione non permessa in questo momento.');
}

function requireOwnedProperty(state: GameState, ctx: GameContext, spaceId: string) {
  const space = spaceById(ctx, spaceId);
  const own = state.ownership[spaceId];
  if (!own || own.owner !== state.current) throw new RuleError('Non possiedi questa casella.');
  return { space, own };
}

function doRoll(state: GameState, ctx: GameContext): void {
  requirePhase(state, 'roll');
  const p = current(state);
  const roll = rollDice(ctx.rng);
  state.lastRoll = roll.dice;
  log(state, `${p.name} lancia ${roll.dice[0]} e ${roll.dice[1]}.`);

  if (p.inJail) {
    if (roll.isDouble) {
      p.inJail = false;
      p.jailAttempts = 0;
      log(state, `${p.name} fa un doppio ed esce dalla Caserma.`);
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
      log(state, `${p.name} paga ${JAIL_FINE} ed esce dalla Caserma.`);
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
      log(state, `${p.name} fa tre doppi di fila!`);
      sendToJail(state, ctx);
      state.phase = 'endTurn';
      return;
    }
  }
  state.extraRoll = roll.isDouble;
  moveBy(state, ctx, roll.total);
  resolveLanding(state, ctx);
}

function doBuy(state: GameState, ctx: GameContext): void {
  requirePhase(state, 'buy');
  const p = current(state);
  const space = ctx.board.spaces[p.position];
  if (!isBuyable(space) || !('price' in space)) throw new RuleError('Questa casella non si compra.');
  if (p.money < space.price) throw new RuleError('Non hai abbastanza soldi.');
  p.money -= space.price;
  state.ownership[space.id] = { owner: p.id, houses: 0, mortgaged: false };
  log(state, `${p.name} compra ${space.name} per ${space.price}.`);
  finishMove(state);
}

function doDecline(state: GameState): void {
  requirePhase(state, 'buy');
  log(state, `${current(state).name} non compra.`);
  finishMove(state);
}

function doPayJailFine(state: GameState): void {
  requirePhase(state, 'roll');
  const p = current(state);
  if (!p.inJail) throw new RuleError('Non sei in Caserma.');
  if (p.money < JAIL_FINE) throw new RuleError('Non hai abbastanza soldi.');
  p.money -= JAIL_FINE;
  p.inJail = false;
  p.jailAttempts = 0;
  log(state, `${p.name} paga ${JAIL_FINE} ed esce dalla Caserma.`);
}

function doUseJailCard(state: GameState, ctx: GameContext): void {
  requirePhase(state, 'roll');
  const p = current(state);
  if (!p.inJail) throw new RuleError('Non sei in Caserma.');
  const cardId = p.jailCards.pop();
  if (!cardId) throw new RuleError('Non hai carte per uscire gratis.');
  const card = ctx.cards.cards.find((c) => c.id === cardId) as Card;
  state.decks[card.deck].push(card.id); // la carta torna in fondo al mazzo
  p.inJail = false;
  p.jailAttempts = 0;
  log(state, `${p.name} usa una carta ed esce dalla Caserma.`);
}

function doBuild(state: GameState, ctx: GameContext, spaceId: string): void {
  requirePhase(state, 'roll', 'buy', 'endTurn');
  const { space, own } = requireOwnedProperty(state, ctx, spaceId);
  if (space.type !== 'property') throw new RuleError('Si costruisce solo sulle vie.');
  if (!ownsWholeGroup(state, ctx, state.current, space.group)) throw new RuleError('Ti serve tutto il quartiere.');
  const group = groupProperties(ctx, space.group).map((g) => state.ownership[g.id]);
  if (group.some((g) => g.mortgaged)) throw new RuleError('Una via del quartiere è ipotecata.');
  if (own.houses >= HOTEL) throw new RuleError('C\'è già un palazzo.');
  // costruzione uniforme: non si può superare di più di una casa le altre vie del quartiere
  if (own.houses > Math.min(...group.map((g) => g.houses))) throw new RuleError('Costruisci prima sulle altre vie.');
  const p = current(state);
  if (p.money < space.housePrice) throw new RuleError('Non hai abbastanza soldi.');
  p.money -= space.housePrice;
  own.houses++;
  log(state, `${p.name} costruisce su ${space.name}.`);
}

function doSell(state: GameState, ctx: GameContext, spaceId: string): void {
  requirePhase(state, 'roll', 'buy', 'endTurn');
  const { space, own } = requireOwnedProperty(state, ctx, spaceId);
  if (space.type !== 'property' || own.houses === 0) throw new RuleError('Non ci sono case da vendere.');
  const group = groupProperties(ctx, space.group).map((g) => state.ownership[g.id]);
  if (own.houses < Math.max(...group.map((g) => g.houses))) throw new RuleError('Vendi prima dalle altre vie.');
  own.houses--;
  current(state).money += space.housePrice / 2;
  log(state, `${current(state).name} vende una casa su ${space.name}.`);
}

function doMortgage(state: GameState, ctx: GameContext, spaceId: string): void {
  requirePhase(state, 'roll', 'buy', 'endTurn');
  const { space, own } = requireOwnedProperty(state, ctx, spaceId);
  if (own.mortgaged) throw new RuleError('È già ipotecata.');
  if (space.type === 'property' && groupProperties(ctx, space.group).some((g) => (state.ownership[g.id]?.houses ?? 0) > 0)) {
    throw new RuleError('Vendi prima le case del quartiere.');
  }
  if (!('mortgage' in space)) throw new RuleError('Non si può ipotecare.');
  own.mortgaged = true;
  current(state).money += space.mortgage;
  log(state, `${current(state).name} ipoteca ${space.name}.`);
}

// Per togliere l'ipoteca si paga il valore più il 10% di interessi.
export function unmortgageCost(mortgage: number): number {
  return Math.ceil(mortgage * 1.1);
}

function doUnmortgage(state: GameState, ctx: GameContext, spaceId: string): void {
  requirePhase(state, 'roll', 'buy', 'endTurn');
  const { space, own } = requireOwnedProperty(state, ctx, spaceId);
  if (!own.mortgaged || !('mortgage' in space)) throw new RuleError('Non è ipotecata.');
  const cost = unmortgageCost(space.mortgage);
  const p = current(state);
  if (p.money < cost) throw new RuleError('Non hai abbastanza soldi.');
  p.money -= cost;
  own.mortgaged = false;
  log(state, `${p.name} toglie l'ipoteca da ${space.name}.`);
}

function nextPlayer(state: GameState): void {
  const n = state.players.length;
  let i = state.current;
  do i = (i + 1) % n;
  while (state.players[i].bankrupt);
  state.current = i;
  state.phase = 'roll';
  state.doublesInRow = 0;
  state.extraRoll = false;
  state.creditor = null;
  log(state, `Tocca a ${state.players[i].name}.`);
}

function doEndTurn(state: GameState): void {
  requirePhase(state, 'endTurn');
  if (current(state).money < 0) throw new RuleError('Devi saldare il debito prima di passare il turno.');
  nextPlayer(state);
}

function doBankrupt(state: GameState, ctx: GameContext): void {
  const p = current(state);
  if (p.money >= 0) throw new RuleError('Non sei in debito.');
  const creditor = state.creditor;
  for (const [id, own] of Object.entries(state.ownership)) {
    if (own.owner !== p.id) continue;
    if (creditor === null) {
      delete state.ownership[id]; // tornano alla banca, libere
    } else {
      state.ownership[id] = { owner: creditor, houses: 0, mortgaged: own.mortgaged };
    }
  }
  // il creditore restituisce la parte di debito che il fallito non poteva coprire
  if (creditor !== null) state.players[creditor].money += p.money;
  for (const cardId of p.jailCards) {
    const card = ctx.cards.cards.find((c) => c.id === cardId) as Card;
    state.decks[card.deck].push(card.id);
  }
  p.jailCards = [];
  p.money = 0;
  p.bankrupt = true;
  p.inJail = false;
  log(state, `${p.name} va in bancarotta.`);

  const alive = state.players.filter((pl) => !pl.bankrupt);
  if (alive.length === 1) {
    state.winner = alive[0].id;
    state.phase = 'gameOver';
    log(state, `${alive[0].name} vince la partita!`);
    return;
  }
  nextPlayer(state);
}

// Applica un'azione e restituisce il nuovo stato. Lancia RuleError se l'azione non è valida.
export function applyAction(state: GameState, action: Action, ctx: GameContext): GameState {
  if (state.phase === 'gameOver') throw new RuleError('La partita è finita.');
  const next = structuredClone(state);
  switch (action.type) {
    case 'roll': doRoll(next, ctx); break;
    case 'buy': doBuy(next, ctx); break;
    case 'decline': doDecline(next); break;
    case 'payJailFine': doPayJailFine(next); break;
    case 'useJailCard': doUseJailCard(next, ctx); break;
    case 'build': doBuild(next, ctx, action.spaceId); break;
    case 'sell': doSell(next, ctx, action.spaceId); break;
    case 'mortgage': doMortgage(next, ctx, action.spaceId); break;
    case 'unmortgage': doUnmortgage(next, ctx, action.spaceId); break;
    case 'endTurn': doEndTurn(next); break;
    case 'bankrupt': doBankrupt(next, ctx); break;
  }
  // si tengono solo gli ultimi eventi: lo stato resta piccolo da copiare e salvare
  if (next.log.length > MAX_LOG) next.log.splice(0, next.log.length - MAX_LOG);
  return next;
}

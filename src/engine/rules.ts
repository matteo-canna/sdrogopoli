// Regole di gioco: ogni azione produce un nuovo stato senza modificare quello precedente.
import { rollDice } from './dice';
import {
  defaultRules,
  withRng,
  JAIL_FINE,
  MARKET_HALL_PAY,
  MAX_JAIL_ATTEMPTS,
  SPRINT_FACES,
  type GameContext,
  type GameState,
  type SprintFace,
} from './state';
import type { Card, CardEffect, DeckId } from './types';
import {
  type Action,
  actingPlayer,
  boardSize,
  current,
  finishMove,
  groupProperties,
  HOTEL,
  isBuyable,
  jailIndex,
  log,
  MAX_COUNTERS,
  MAX_LOG,
  MIN_BID,
  ownsWholeGroup,
  pay,
  requirePhase,
  RuleError,
  stat,
  targetSpace,
} from './ruleHelpers';
import {
  doBuildLandmark,
  doBuyShare,
  doSellLandmark,
  doSellShare,
  groupHasBuildings,
  landmarkPrice,
  payDividends,
  sharePrice,
  sharesOf,
} from './shares';
import {
  boardSides,
  checkGoals,
  completeGroups,
  goalProgress,
  netWorth,
  sameTeam,
  teamMembers,
  teamName,
  teamWorth,
} from './teams';
import { applyGroupEvent, computeRent, openRound, rentFactor, salaryOf, startRound } from './rent';
import { doBid, doPass, startAuction } from './auction';
import {
  doAcceptTrade,
  doCounterTrade,
  doProposeTrade,
  doRejectTrade,
  interestOn,
  tradeCompletions,
  transferInterest,
} from './trade';
import {
  debtOptions,
  doBankrupt,
  doBuild,
  doEndTurn,
  doMortgage,
  doSell,
  doUnmortgage,
  liquidationValue,
  unmortgageCost,
} from './debt';

export {
  type Action,
  MIN_BID,
  MAX_COUNTERS,
  HOTEL,
  MAX_LOG,
  actingPlayer,
  RuleError,
  targetSpace,
  sameTeam,
  teamMembers,
  teamWorth,
  teamName,
  ownsWholeGroup,
  netWorth,
  sharePrice,
  landmarkPrice,
  sharesOf,
  groupHasBuildings,
  rentFactor,
  salaryOf,
  openRound,
  applyGroupEvent,
  computeRent,
  transferInterest,
  interestOn,
  tradeCompletions,
  unmortgageCost,
  boardSides,
  completeGroups,
  goalProgress,
  liquidationValue,
  debtOptions,
};

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
  const salary = salaryOf(state, ctx);
  current(state).money += salary;
  log(state, 'log.passGo', { name: current(state).name, amount: salary });
  // il mercato coperto rende a ogni passaggio dalla Partenza
  for (const [group, lm] of Object.entries(state.landmarks ?? {})) {
    if (lm.id !== 'mercato' || lm.owner !== state.current) continue;
    const amount = MARKET_HALL_PAY * groupProperties(ctx, group).length;
    current(state).money += amount;
    log(state, 'log.marketHall', { name: current(state).name, amount, group });
  }
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
        if (space.type === 'property') payDividends(state, space.group, rent, p.id, own.owner);
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
      const idx = ctx.board.spaces.findIndex((s) => s.id === targetSpace(ctx.board, effect.space));
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

// ---------- azioni di movimento e acquisto ----------

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
  // primo giro (o partita salvata prima di questa regola): l'evento si estrae alla prima mossa
  if ((next.roundStarted ?? 0) < next.round && (next.rules?.events || next.rules?.wheel)) startRound(next, ctx);
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
    case 'buyShare': doBuyShare(next, ctx, action.group); break;
    case 'sellShare': doSellShare(next, ctx, action.group); break;
    case 'buildLandmark': doBuildLandmark(next, ctx, action.group, action.landmark); break;
    case 'sellLandmark': doSellLandmark(next, ctx, action.group); break;
  }
  // obiettivi della partita: si controllano dopo ogni mossa, ma non a metà di un'asta o di uno scambio
  if (next.phase !== 'gameOver' && next.phase !== 'auction' && !next.trade) checkGoals(next, ctx);
  // si tengono solo gli ultimi eventi: lo stato resta piccolo da copiare e salvare
  if (next.log.length > MAX_LOG) next.log.splice(0, next.log.length - MAX_LOG);
  return next;
}

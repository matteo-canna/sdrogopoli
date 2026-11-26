// Affitti, eventi di quartiere e Ruota del Mercato (regole facoltative).
import {
  withRng,
  EVENT_IDS,
  FOUNTAIN_FACTOR,
  MARKET_IDS,
  MARKET_PAY,
  THEATRE_MIN_RENT,
  UPKEEP_PER_HOUSE,
  WHEEL_EVERY,
  type EventId,
  type GameContext,
  type GameState,
  type GroupEvent,
  type MarketId,
} from './state';
import type { Space } from './types';
import type { MsgKey } from '../i18n';
import { groupProperties, log, ownsWholeGroup, pay, spaceById } from './ruleHelpers';
import { landmarkOn } from './shares';

// Quanto cambia un affitto per via dell'evento del quartiere e dell'andamento del mercato.
// 1 = niente di speciale. Si moltiplica, quindi festa durante un rialzo vale 2 × 1,25.
export function rentFactor(state: GameState, ctx: GameContext, spaceId: string): number {
  let f = 1;
  const space = ctx.board.spaces.find((s) => s.id === spaceId);
  const ev = state.event;
  if (ev && space && space.type === 'property' && space.group === ev.group) {
    if (ev.id === 'festa') f *= 2;
    if (ev.id === 'lavori') f *= 0.5;
  }
  if (landmarkOn(state, ctx, spaceId) === 'fontana') f *= FOUNTAIN_FACTOR;
  if (state.market?.id === 'rialzo') f *= 1.25;
  if (state.market?.id === 'ribasso') f *= 0.75;
  return f;
}

// Lo stipendio della Partenza, con l'andamento del mercato.
export function salaryOf(state: GameState, ctx: GameContext): number {
  const start = ctx.board.spaces.find((s) => s.type === 'start');
  const salary = start && start.type === 'start' ? start.salary : 0;
  return state.market?.id === 'stipendio' ? Math.round(salary * 1.5) : salary;
}

// Inizio di un giro: si estrae l'evento del quartiere e, ogni WHEEL_EVERY giri, gira la ruota.
export function startRound(state: GameState, ctx: GameContext): void {
  state.roundStarted = state.round;
  if (state.rules?.wheel && (state.round - 1) % WHEEL_EVERY === 0) {
    const id = MARKET_IDS[Math.floor(ctx.rng!() * MARKET_IDS.length)] as MarketId;
    state.market = { id, from: state.round, until: state.round + WHEEL_EVERY - 1 };
    log(state, `log.market.${id}` as MsgKey, { until: state.market.until });
  }
  if (!state.rules?.events) return;
  const groups = ctx.board.groups;
  if (!groups.length) return;
  const id = EVENT_IDS[Math.floor(ctx.rng!() * EVENT_IDS.length)] as EventId;
  const group = groups[Math.floor(ctx.rng!() * groups.length)].id;
  applyGroupEvent(state, ctx, { id, group, round: state.round });
}

// Estrae l'evento (e la prima girata di ruota) del primo giro: si chiama appena creata la
// partita, così si vedono subito. Senza le regole facoltative non cambia niente.
export function openRound(state: GameState, ctx: GameContext): GameState {
  if (!state.rules?.events && !state.rules?.wheel) return state;
  const next = structuredClone(state);
  startRound(next, withRng(ctx, next));
  return next;
}

// Mette l'evento sul tavolo e, se è di quelli che si pagano subito (mercatino e manutenzione),
// paga o fa pagare chi ha vie in quel quartiere.
export function applyGroupEvent(state: GameState, ctx: GameContext, ev: GroupEvent): void {
  const { id, group } = ev;
  state.event = ev;
  log(state, `log.event.${id}` as MsgKey, { group });
  if (id !== 'mercatino' && id !== 'manutenzione') return;
  for (const space of groupProperties(ctx, group)) {
    const own = state.ownership[space.id];
    if (!own || state.players[own.owner].bankrupt) continue;
    if (id === 'mercatino') {
      state.players[own.owner].money += MARKET_PAY;
      log(state, 'log.eventGain', { name: state.players[own.owner].name, amount: MARKET_PAY, space: space.id });
    } else if (own.houses > 0) {
      // come la carta del compleanno: chi non ce li ha paga solo quello che ha, senza andare in debito
      // (il debito lo salda solo chi è di turno, e qui pagano tutti insieme)
      const cost = Math.min(own.houses * UPKEEP_PER_HOUSE, Math.max(0, state.players[own.owner].money));
      if (cost <= 0) continue;
      pay(state, own.owner, cost, null);
      log(state, 'log.eventPay', { name: state.players[own.owner].name, amount: cost, space: space.id });
    }
  }
}

export function computeRent(state: GameState, ctx: GameContext, spaceId: string, diceTotal: number): number {
  const space = spaceById(ctx, spaceId);
  const own = state.ownership[spaceId];
  if (!own || own.mortgaged) return 0;
  const ownedOfType = (type: Space['type']) =>
    ctx.board.spaces.filter((s) => s.type === type && state.ownership[s.id]?.owner === own.owner).length;

  const base = (): number => {
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
  };
  const rent = Math.round(base() * rentFactor(state, ctx, spaceId));
  // il teatro: chi si ferma nel quartiere paga almeno THEATRE_MIN_RENT
  return landmarkOn(state, ctx, spaceId) === 'teatro' ? Math.max(rent, THEATRE_MIN_RENT) : rent;
}

// Tipi di azione, costanti ed funzioni di supporto condivise tra i moduli delle regole.
import { emptyStats, type GameContext, type GameState, type LandmarkId, type Player, type PlayerStats, type TradeOffer, type TradeSide } from './state';
import type { BoardData, PropertySpace, Space } from './types';
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
  | { type: 'chooseCard'; option: number }
  // quote di quartiere ed edifici speciali (regole facoltative)
  | { type: 'buyShare'; group: string }
  | { type: 'sellShare'; group: string }
  | { type: 'buildLandmark'; group: string; landmark: LandmarkId }
  | { type: 'sellLandmark'; group: string };

export const MIN_BID = 10;
// controproposte per trattativa: chi riceve ne fa una, chi ha proposto può rispondere con un'altra
export const MAX_COUNTERS = 2;
export const HOTEL = 5;
export const MAX_LOG = 50;

const BOARD_SIZE_FALLBACK = 40;

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

// L'id vero della casella a cui punta una carta: le carte usano un ruolo ("lusso"),
// ogni tabellone dice qual è la sua casella (board.targets). Senza ruolo vale l'id così com'è.
export function targetSpace(board: BoardData, id: string): string {
  return board.targets?.[id] ?? id;
}

export function current(state: GameState): Player {
  return state.players[state.current];
}

export function boardSize(ctx: GameContext): number {
  return ctx.board.spaces.length || BOARD_SIZE_FALLBACK;
}

export function spaceById(ctx: GameContext, id: string): Space {
  const s = ctx.board.spaces.find((sp) => sp.id === id);
  if (!s) throw new RuleError('err.unknownSpace', { id });
  return s;
}

export function isBuyable(s: Space): boolean {
  return s.type === 'property' || s.type === 'station' || s.type === 'utility';
}

export function jailIndex(ctx: GameContext): number {
  return ctx.board.spaces.findIndex((s) => s.type === 'jail');
}

export function groupProperties(ctx: GameContext, group: string): PropertySpace[] {
  return ctx.board.spaces.filter((s): s is PropertySpace => s.type === 'property' && s.group === group);
}

// Vero se il giocatore possiede tutte le proprietà del gruppo.
export function ownsWholeGroup(state: GameState, ctx: GameContext, playerId: number, group: string): boolean {
  return groupProperties(ctx, group).every((p) => state.ownership[p.id]?.owner === playerId);
}

// Statistiche di un giocatore (le partite salvate prima delle statistiche partono da zero).
export function stat(state: GameState, playerId: number): PlayerStats {
  state.stats ??= [];
  return (state.stats[playerId] ??= emptyStats());
}

export function log(state: GameState, k: MsgKey, p?: Params): void {
  state.log.push(p ? { k, p } : { k });
  state.eventCount = (state.eventCount ?? state.log.length - 1) + 1;
}

// Trasferisce denaro. "to" null = banca. Il pagatore può finire in negativo (debito).
export function pay(state: GameState, fromId: number, amount: number, toId: number | null): void {
  const from = state.players[fromId];
  from.money -= amount;
  if (toId !== null) state.players[toId].money += amount;
  else if (state.rules?.parkPot) state.pot = (state.pot ?? 0) + amount;
  if (from.money < 0) state.creditor = toId;
}

// Dopo aver risolto la casella: rilancia se c'era un doppio, altrimenti fine turno.
// Chi è in debito non rilancia: deve prima saldare o dichiarare bancarotta.
export function finishMove(state: GameState): void {
  const p = current(state);
  state.phase = state.extraRoll && !p.inJail && p.money >= 0 ? 'roll' : 'endTurn';
}

export function requirePhase(state: GameState, ...phases: GameState['phase'][]): void {
  if (!phases.includes(state.phase)) throw new RuleError('err.notNow');
}

export function requireOwnedProperty(state: GameState, ctx: GameContext, spaceId: string) {
  const space = spaceById(ctx, spaceId);
  const own = state.ownership[spaceId];
  if (!own || own.owner !== state.current) throw new RuleError('err.notYours');
  return { space, own };
}

// Squadre, calcolo del patrimonio e obiettivi di vittoria alternativi.
import type { GameContext, GameState } from './state';
import { isBuyable, log, ownsWholeGroup, spaceById } from './ruleHelpers';
import { landmarkPrice, sharePrice } from './shares';

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

// Nome della squadra: i nomi dei compagni, come "Anna e Carla".
export function teamName(state: GameState, id: number): string {
  return teamMembers(state, id)
    .map((m) => state.players[m].name)
    .join(' + ');
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
  for (const [group, holders] of Object.entries(state.shares ?? {})) {
    total += holders.filter((h) => h === playerId).length * sharePrice(ctx, group);
  }
  for (const [group, lm] of Object.entries(state.landmarks ?? {})) if (lm.owner === playerId) total += landmarkPrice(ctx, group);
  return total;
}

// Patrimonio della squadra: la somma di chi non è fallito.
export function teamWorth(state: GameState, ctx: GameContext, id: number): number {
  return teamMembers(state, id)
    .filter((m) => !state.players[m].bankrupt)
    .reduce((sum, m) => sum + netWorth(state, ctx, m), 0);
}

// Fotografia dei patrimoni, per il grafico di fine partita.
export function recordHistory(state: GameState, ctx: GameContext): void {
  state.history ??= [];
  state.history.push(state.players.map((p) => (p.bankrupt ? 0 : netWorth(state, ctx, p.id))));
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
export function checkGoals(state: GameState, ctx: GameContext): void {
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
export function endByNetWorth(state: GameState, ctx: GameContext): void {
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

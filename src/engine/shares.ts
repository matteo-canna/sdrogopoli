// Quote di quartiere ed edifici speciali (regole facoltative).
import { LANDMARK_IDS, SHARE_CUT, SHARES_PER_GROUP, type GameContext, type GameState, type LandmarkId } from './state';
import { current, groupProperties, log, ownsWholeGroup, requirePhase, RuleError, stat } from './ruleHelpers';

// Una quota costa metà del prezzo medio delle vie del quartiere, arrotondato a 10.
export function sharePrice(ctx: GameContext, group: string): number {
  const streets = groupProperties(ctx, group);
  if (!streets.length) return 0;
  const avg = streets.reduce((a, s) => a + s.price, 0) / streets.length;
  return Math.max(10, Math.round(avg / 20) * 10);
}

// Un edificio speciale costa due case del quartiere.
export function landmarkPrice(ctx: GameContext, group: string): number {
  const first = groupProperties(ctx, group)[0];
  return first ? first.housePrice * 2 : 0;
}

export function sharesOf(state: GameState, group: string): number[] {
  return state.shares?.[group] ?? [];
}

// Il quartiere ha case, palazzi o un edificio speciale: le sue vie non si ipotecano e non si scambiano.
export function groupHasBuildings(state: GameState, ctx: GameContext, group: string): boolean {
  return !!state.landmarks?.[group] || groupProperties(ctx, group).some((g) => (state.ownership[g.id]?.houses ?? 0) > 0);
}

export function landmarkOn(state: GameState, ctx: GameContext, spaceId: string): LandmarkId | null {
  const space = ctx.board.spaces.find((s) => s.id === spaceId);
  if (!space || space.type !== 'property') return null;
  return state.landmarks?.[space.group]?.id ?? null;
}

// Chi ha quote del quartiere riceve dal proprietario una parte dell'affitto appena incassato.
// Chi paga l'affitto e il proprietario stesso non ricevono niente dalle loro quote.
export function payDividends(state: GameState, group: string, rent: number, payer: number, owner: number): void {
  if (!state.rules?.shares) return;
  const cut = Math.round(rent * SHARE_CUT);
  if (cut <= 0) return;
  for (const holder of sharesOf(state, group)) {
    if (holder === payer || holder === owner || state.players[holder].bankrupt) continue;
    state.players[owner].money -= cut;
    state.players[holder].money += cut;
    const st = stat(state, holder);
    st.dividends = (st.dividends ?? 0) + cut;
    log(state, 'log.dividend', { name: state.players[holder].name, amount: cut, group });
  }
}

export function doBuyShare(state: GameState, ctx: GameContext, group: string): void {
  requirePhase(state, 'roll', 'buy', 'endTurn');
  if (!state.rules?.shares) throw new RuleError('err.sharesOff');
  if (!groupProperties(ctx, group).length) throw new RuleError('err.notNow');
  const holders = sharesOf(state, group);
  if (holders.length >= SHARES_PER_GROUP) throw new RuleError('err.noSharesLeft');
  const price = sharePrice(ctx, group);
  const p = current(state);
  if (p.money < price) throw new RuleError('err.noMoney');
  p.money -= price;
  state.shares = { ...(state.shares ?? {}), [group]: [...holders, p.id] };
  log(state, 'log.buysShare', { name: p.name, group, amount: price });
}

export function doSellShare(state: GameState, ctx: GameContext, group: string): void {
  requirePhase(state, 'roll', 'buy', 'endTurn');
  const holders = sharesOf(state, group);
  const i = holders.indexOf(state.current);
  if (i < 0) throw new RuleError('err.noShare');
  const amount = sharePrice(ctx, group) / 2;
  state.shares = { ...(state.shares ?? {}), [group]: holders.filter((_h, j) => j !== i) };
  current(state).money += amount;
  log(state, 'log.sellsShare', { name: current(state).name, group, amount });
}

export function doBuildLandmark(state: GameState, ctx: GameContext, group: string, id: LandmarkId): void {
  requirePhase(state, 'roll', 'buy', 'endTurn');
  if (!state.rules?.landmarks) throw new RuleError('err.landmarksOff');
  if (!LANDMARK_IDS.includes(id)) throw new RuleError('err.notNow');
  if (!groupProperties(ctx, group).length || !ownsWholeGroup(state, ctx, state.current, group)) throw new RuleError('err.needGroup');
  if (groupProperties(ctx, group).some((g) => state.ownership[g.id].mortgaged)) throw new RuleError('err.groupMortgaged');
  if (state.landmarks?.[group]) throw new RuleError('err.hasLandmark');
  const cost = landmarkPrice(ctx, group);
  const p = current(state);
  if (p.money < cost) throw new RuleError('err.noMoney');
  p.money -= cost;
  state.landmarks = { ...(state.landmarks ?? {}), [group]: { id, owner: p.id } };
  stat(state, p.id).built++;
  log(state, 'log.buildsLandmark', { name: p.name, landmark: id, group });
}

export function doSellLandmark(state: GameState, ctx: GameContext, group: string): void {
  requirePhase(state, 'roll', 'buy', 'endTurn');
  const lm = state.landmarks?.[group];
  if (!lm || lm.owner !== state.current) throw new RuleError('err.noLandmark');
  const rest = { ...state.landmarks };
  delete rest[group];
  state.landmarks = rest;
  current(state).money += landmarkPrice(ctx, group) / 2;
  log(state, 'log.sellsLandmark', { name: current(state).name, landmark: lm.id, group });
}

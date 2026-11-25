// Quote di quartiere ed edifici speciali (B60), regole facoltative.
import { describe, expect, it } from 'vitest';
import { board, cards } from '../src/data';
import {
  applyAction,
  chooseBotAction,
  computeRent,
  createGame,
  debtOptions,
  landmarkPrice,
  liquidationValue,
  netWorth,
  raiseMoney,
  replay,
  RuleError,
  sharePrice,
  sharesOf,
  isUndoable,
  FOUNTAIN_FACTOR,
  MARKET_HALL_PAY,
  SHARE_CUT,
  SHARES_PER_GROUP,
  THEATRE_MIN_RENT,
  type Action,
  type GameContext,
  type GameRules,
  type GameState,
  type PropertySpace,
} from '../src/engine';
import { setLang, text } from '../src/i18n';

const ctx: GameContext = { board, cards };
const streets = (group: string) => board.spaces.filter((s): s is PropertySpace => s.type === 'property' && s.group === group);
const G = board.groups[0].id; // il quartiere più economico
const G2 = board.groups[board.groups.length - 1].id; // il più caro

function game(rules: Partial<GameRules> = { shares: true, landmarks: true }): GameState {
  return createGame(['Ada', 'Bea', 'Ciro'], ctx, rules, 5);
}

// Dà a un giocatore tutto un quartiere, con le case indicate.
function giveGroup(s: GameState, group: string, owner: number, houses = 0): void {
  for (const sp of streets(group)) s.ownership[sp.id] = { owner, houses, mortgaged: false };
}

// Mette un giocatore su una casella e fa risolvere l'arrivo con un lancio fisso.
function landOn(s: GameState, player: number, spaceId: string): GameState {
  const idx = board.spaces.findIndex((sp) => sp.id === spaceId);
  const steps = 4; // 1 + 3: niente doppio
  s.current = player;
  s.phase = 'roll';
  s.players[player].position = (idx - steps + board.spaces.length) % board.spaces.length;
  const fixed: GameContext = { ...ctx, rng: seq([0 / 6, 2 / 6]) };
  return applyAction(s, { type: 'roll' }, fixed);
}

function seq(values: number[]): () => number {
  let i = 0;
  return () => values[i++ % values.length];
}

const err = (fn: () => unknown) => {
  try {
    fn();
  } catch (e) {
    return e instanceof RuleError ? e.key : String(e);
  }
  return null;
};

describe('quote di quartiere', () => {
  it('costano metà del prezzo medio, arrotondato a 10', () => {
    for (const g of board.groups) {
      const avg = streets(g.id).reduce((a, s) => a + s.price, 0) / streets(g.id).length;
      expect(sharePrice(ctx, g.id)).toBe(Math.round(avg / 20) * 10);
      expect(sharePrice(ctx, g.id) % 10).toBe(0);
    }
  });

  it('si comprano fino a esaurimento, e si rivendono a metà prezzo', () => {
    let s = game();
    const price = sharePrice(ctx, G);
    const before = s.players[0].money;
    for (let i = 0; i < SHARES_PER_GROUP; i++) s = applyAction(s, { type: 'buyShare', group: G }, ctx);
    expect(sharesOf(s, G)).toEqual([0, 0, 0]);
    expect(s.players[0].money).toBe(before - price * SHARES_PER_GROUP);
    expect(err(() => applyAction(s, { type: 'buyShare', group: G }, ctx))).toBe('err.noSharesLeft');
    s = applyAction(s, { type: 'sellShare', group: G }, ctx);
    expect(sharesOf(s, G)).toHaveLength(2);
    expect(s.players[0].money).toBe(before - price * SHARES_PER_GROUP + price / 2);
    // chi non ne ha non ne vende
    s.current = 1;
    expect(err(() => applyAction(s, { type: 'sellShare', group: G }, ctx))).toBe('err.noShare');
  });

  it('senza la regola, con un quartiere inventato o senza soldi non si comprano', () => {
    const off = game({});
    expect(err(() => applyAction(off, { type: 'buyShare', group: G }, ctx))).toBe('err.sharesOff');
    const s = game();
    expect(err(() => applyAction(s, { type: 'buyShare', group: '__proto__' }, ctx))).toBe('err.notNow');
    s.players[0].money = 1;
    expect(err(() => applyAction(s, { type: 'buyShare', group: G }, ctx))).toBe('err.noMoney');
  });

  it('chi ha una quota incassa una parte dell\'affitto, pagata dal proprietario', () => {
    const s = game({ shares: true });
    giveGroup(s, G2, 0, 3);
    s.shares = { [G2]: [1, 2, 0] };
    const street = streets(G2)[0];
    const rent = computeRent(s, ctx, street.id, 4);
    const cut = Math.round(rent * SHARE_CUT);
    const money = s.players.map((p) => p.money);
    // Bea paga l'affitto: incassa Ciro dalla sua quota, non Bea (che paga) né Ada (che è il proprietario)
    const next = landOn(s, 1, street.id);
    expect(next.players[1].money).toBe(money[1] - rent);
    expect(next.players[2].money).toBe(money[2] + cut);
    expect(next.players[0].money).toBe(money[0] + rent - cut);
    expect(next.stats[2].dividends).toBe(cut);
    setLang('it');
    expect(next.log.map(text).some((l) => l.includes('dalla sua quota'))).toBe(true);
  });

  it('senza la regola le quote (anche se ci fossero) non rendono', () => {
    const s = game({});
    giveGroup(s, G2, 0, 3);
    s.shares = { [G2]: [2] };
    const before = s.players[2].money;
    const next = landOn(s, 1, streets(G2)[0].id);
    expect(next.players[2].money).toBe(before);
  });

  it('contano nel patrimonio, nella liquidazione e nella bancarotta', () => {
    const s = game();
    s.shares = { [G]: [1, 1], [G2]: [1] };
    const worth = s.players[1].money + 2 * sharePrice(ctx, G) + sharePrice(ctx, G2);
    expect(netWorth(s, ctx, 1)).toBe(worth);
    expect(liquidationValue(s, ctx, 1)).toBe((2 * sharePrice(ctx, G) + sharePrice(ctx, G2)) / 2);
    expect(debtOptions(s, ctx, 1).map((o) => o.action.type)).toEqual(['sellShare', 'sellShare']);
    // in debito, il computer rivende prima le quote
    s.current = 1;
    s.players[1].money = -10;
    expect(raiseMoney(s, ctx)).toEqual({ type: 'sellShare', group: G });
  });
});

describe('edifici speciali', () => {
  it('servono la regola e tutto il quartiere, libero da ipoteche', () => {
    const off = game({});
    giveGroup(off, G, 0);
    expect(err(() => applyAction(off, { type: 'buildLandmark', group: G, landmark: 'fontana' }, ctx))).toBe('err.landmarksOff');
    const s = game();
    expect(err(() => applyAction(s, { type: 'buildLandmark', group: G, landmark: 'fontana' }, ctx))).toBe('err.needGroup');
    giveGroup(s, G, 0);
    s.ownership[streets(G)[0].id].mortgaged = true;
    expect(err(() => applyAction(s, { type: 'buildLandmark', group: G, landmark: 'fontana' }, ctx))).toBe('err.groupMortgaged');
    s.ownership[streets(G)[0].id].mortgaged = false;
    expect(err(() => applyAction(s, { type: 'buildLandmark', group: G, landmark: 'piscina' as never }, ctx))).toBe('err.notNow');
    const built = applyAction(s, { type: 'buildLandmark', group: G, landmark: 'teatro' }, ctx);
    expect(built.landmarks?.[G]).toEqual({ id: 'teatro', owner: 0 });
    expect(built.players[0].money).toBe(s.players[0].money - landmarkPrice(ctx, G));
    expect(err(() => applyAction(built, { type: 'buildLandmark', group: G, landmark: 'fontana' }, ctx))).toBe('err.hasLandmark');
  });

  it('fontana: affitti del quartiere +25%', () => {
    const s = game();
    giveGroup(s, G2, 0, 2);
    const id = streets(G2)[0].id;
    const plain = computeRent(s, ctx, id, 7);
    s.landmarks = { [G2]: { id: 'fontana', owner: 0 } };
    expect(computeRent(s, ctx, id, 7)).toBe(Math.round(plain * FOUNTAIN_FACTOR));
  });

  it('teatro: almeno 60 di affitto, ma non sulle vie ipotecate', () => {
    const s = game();
    giveGroup(s, G, 0);
    const id = streets(G)[0].id;
    expect(computeRent(s, ctx, id, 7)).toBeLessThan(THEATRE_MIN_RENT);
    s.landmarks = { [G]: { id: 'teatro', owner: 0 } };
    expect(computeRent(s, ctx, id, 7)).toBe(THEATRE_MIN_RENT);
    s.ownership[id].mortgaged = true;
    expect(computeRent(s, ctx, id, 7)).toBe(0);
  });

  it('mercato coperto: passando dalla Partenza si incassa 20 per via', () => {
    const s = game();
    giveGroup(s, G, 0);
    s.landmarks = { [G]: { id: 'mercato', owner: 0 } };
    s.current = 0;
    s.phase = 'roll';
    s.players[0].position = board.spaces.length - 2;
    const before = s.players[0].money;
    const next = applyAction(s, { type: 'roll' }, { ...ctx, rng: seq([0 / 6, 2 / 6]) });
    const start = board.spaces[0] as { salary: number };
    const gained = next.players[0].money - before;
    // stipendio più il mercato (l'arrivo può costare qualcosa: si guarda solo il registro)
    expect(next.log.some((l) => typeof l === 'object' && l.k === 'log.marketHall' && l.p?.amount === MARKET_HALL_PAY * streets(G).length)).toBe(true);
    expect(gained).toBeGreaterThanOrEqual(start.salary + MARKET_HALL_PAY * streets(G).length - 400);
  });

  it('bloccano ipoteche e scambi del quartiere, e si vendono a metà prezzo', () => {
    let s = game();
    giveGroup(s, G, 0);
    s = applyAction(s, { type: 'buildLandmark', group: G, landmark: 'fontana' }, ctx);
    const id = streets(G)[0].id;
    expect(err(() => applyAction(s, { type: 'mortgage', spaceId: id }, ctx))).toBe('err.sellGroupHouses');
    expect(err(() => applyAction(s, { type: 'proposeTrade', offer: { to: 1, give: { money: 0, spaces: [id] }, get: { money: 10, spaces: [] } } }, ctx))).toBe('err.sellGroupHousesOf');
    const money = s.players[0].money;
    s.current = 1;
    expect(err(() => applyAction(s, { type: 'sellLandmark', group: G }, ctx))).toBe('err.noLandmark');
    s.current = 0;
    s = applyAction(s, { type: 'sellLandmark', group: G }, ctx);
    expect(s.landmarks?.[G]).toBeUndefined();
    expect(s.players[0].money).toBe(money + landmarkPrice(ctx, G) / 2);
    // ora l'ipoteca si può fare
    expect(applyAction(s, { type: 'mortgage', spaceId: id }, ctx).ownership[id].mortgaged).toBe(true);
  });

  it('chi fallisce le perde, e il ricavato va al creditore', () => {
    const s = game();
    giveGroup(s, G, 1);
    s.landmarks = { [G]: { id: 'teatro', owner: 1 } };
    s.shares = { [G2]: [1, 2] };
    s.current = 1;
    s.phase = 'endTurn';
    s.players[1].money = -5000;
    s.creditor = 0;
    const next = applyAction(s, { type: 'bankrupt' }, ctx);
    expect(next.players[1].bankrupt).toBe(true);
    expect(next.landmarks?.[G]).toBeUndefined();
    expect(sharesOf(next, G2)).toEqual([2]);
  });
});

describe('computer e partite intere', () => {
  it('con le due regole i computer comprano quote e costruiscono edifici, e la partita finisce', () => {
    let bought = 0;
    let built = 0;
    for (const seed of [1, 2, 3]) {
      const c: GameContext = { board, cards };
      let s = createGame(
        ['A', 'B', 'C', 'D'].map((name) => ({ name, isBot: true })),
        c,
        { shares: true, landmarks: true, maxRounds: 60 },
        seed,
      );
      const initial = structuredClone(s);
      const actions: Action[] = [];
      for (let i = 0; i < 20000 && s.phase !== 'gameOver'; i++) {
        const a = chooseBotAction(s, c);
        if (a.type === 'buyShare') bought++;
        if (a.type === 'buildLandmark') built++;
        actions.push(a);
        s = applyAction(s, a, c);
      }
      expect(s.phase).toBe('gameOver');
      // dallo stesso inizio e con le stesse azioni si arriva allo stesso stato (replay, online)
      expect(replay(initial, actions, c)).toEqual(s);
    }
    expect(bought).toBeGreaterThan(0);
    expect(built).toBeGreaterThan(0);
  });

  it('comprare, vendere, costruire e vendere edifici si annulla', () => {
    for (const type of ['buyShare', 'sellShare', 'buildLandmark', 'sellLandmark'] as const) {
      expect(isUndoable({ type, group: G, landmark: 'fontana' } as Action), type).toBe(true);
    }
  });
});

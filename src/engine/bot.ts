// Giocatore controllato dal computer: sceglie sempre un'azione valida in base allo stato.
// Il livello (facile, normale, difficile) e il carattere (costruttore, collezionista…) cambiano
// alcune manopole: riserva di soldi, voglia di comprare e costruire, offerte e scambi.
import { actingPlayer, computeRent, groupHasBuildings, interestOn, landmarkPrice, ownsWholeGroup, sameTeam, sharePrice, sharesOf, targetSpace, unmortgageCost, HOTEL, MAX_COUNTERS, MIN_BID, type Action } from './rules';
import type { BotLevel, BotProfile, BotStyle, GameContext, GameState, Player, TradeSide } from './state';
import { JAIL_FINE, SHARES_PER_GROUP, THEATRE_MIN_RENT, type LandmarkId } from './state';
import type { PropertySpace, Space } from './types';
import { cardValue } from './cards';

// Soldi che il computer normale cerca di tenere da parte per pagare affitti e tasse.
const RESERVE = 150;
const BUILD_RESERVE = 150;

export const BOT_LEVELS: { id: BotLevel; label: string }[] = [
  { id: 'facile', label: 'Facile' },
  { id: 'normale', label: 'Normale' },
  { id: 'difficile', label: 'Difficile' },
];

export const BOT_STYLES: { id: BotStyle; label: string; text: string }[] = [
  { id: 'equilibrato', label: 'Equilibrato', text: 'gioca senza manie' },
  { id: 'costruttore', label: 'Costruttore', text: 'punta tutto sulle case' },
  { id: 'collezionista', label: 'Collezionista', text: 'compra tutto quello che trova' },
  { id: 'prudente', label: 'Prudente', text: 'tiene i soldi da parte' },
  { id: 'mercante', label: 'Mercante', text: 'paga bene per gli scambi e li accetta volentieri' },
];

export const DEFAULT_BOT: BotProfile = { level: 'normale', style: 'equilibrato' };

interface Knobs {
  reserve: number;
  buildReserve: number;
  // probabilità di una scelta sbagliata (comprare, costruire)
  mistakes: number;
  // quanto offre all'asta, in proporzione al prezzo
  auction: { base: number; completes: number; blocks: number };
  // quanto deve guadagnare per accettare uno scambio
  acceptMargin: number;
  // quanto offre per la via che gli manca (volte il prezzo)
  offerMult: number;
  proposeTrades: boolean;
  // tiene una riserva pari agli affitti più alti degli avversari
  dangerAware: boolean;
  // ipoteca le vie sparse per costruire sul quartiere completo
  mortgageToBuild: boolean;
  // compra solo vie che servono a completare un quartiere (e poche fermate)
  buyOnlyUseful: boolean;
  // valore in più per fermate e servizi
  stationBonus: number;
  payJail: boolean;
  // risponde alle offerte troppo basse con una controproposta
  counters: boolean;
}

export function botKnobs(profile: BotProfile = DEFAULT_BOT): Knobs {
  const k: Knobs = {
    reserve: RESERVE,
    buildReserve: BUILD_RESERVE,
    mistakes: 0,
    auction: { base: 0.9, completes: 1.6, blocks: 1.2 },
    acceptMargin: 1.15,
    offerMult: 2.5,
    proposeTrades: true,
    dangerAware: false,
    mortgageToBuild: false,
    buyOnlyUseful: false,
    stationBonus: 0,
    payJail: true,
    counters: true,
  };
  if (profile.level === 'facile') {
    Object.assign(k, {
      reserve: 60,
      buildReserve: 60,
      mistakes: 0.35,
      auction: { base: 0.7, completes: 1, blocks: 0.7 },
      acceptMargin: 0.85,
      proposeTrades: false,
      payJail: false,
      counters: false,
    });
  } else if (profile.level === 'difficile') {
    Object.assign(k, {
      auction: { base: 1.05, completes: 1.9, blocks: 1.5 },
      acceptMargin: 1.3,
      offerMult: 2.8,
      dangerAware: true,
      mortgageToBuild: true,
    });
  }
  switch (profile.style) {
    case 'costruttore':
      // poche fermate e servizi, ogni soldo nelle case
      k.buildReserve = Math.round(k.buildReserve * 0.3);
      k.buyOnlyUseful = true;
      k.mortgageToBuild = true;
      break;
    case 'collezionista':
      k.reserve = Math.round(k.reserve * 0.4);
      k.stationBonus = 0.5;
      k.auction = { ...k.auction, base: k.auction.base + 0.3 };
      break;
    case 'prudente':
      k.reserve *= 2;
      k.buildReserve = Math.round(k.buildReserve * 1.5);
      k.payJail = false;
      k.acceptMargin += 0.25;
      k.auction = { ...k.auction, base: k.auction.base - 0.15 };
      break;
    case 'mercante':
      k.proposeTrades = true;
      k.offerMult = Math.max(k.offerMult, 2.8);
      k.acceptMargin = Math.max(1, k.acceptMargin - 0.1);
      break;
  }
  return k;
}

function knobsOf(p: Player): Knobs {
  return botKnobs(p.bot);
}

// Numero tra 0 e 1 che dipende solo dallo stato: lo stesso stato dà sempre la stessa scelta.
function chance(state: GameState, salt: number): number {
  let h = ((state.seed ?? 0) ^ Math.imul(state.eventCount ?? 0, 2654435761) ^ Math.imul(state.current + 1, 40503) ^ Math.imul(salt, 97)) >>> 0;
  h = Math.imul(h ^ (h >>> 16), 2246822507) >>> 0;
  h = Math.imul(h ^ (h >>> 13), 3266489909) >>> 0;
  return ((h ^ (h >>> 16)) >>> 0) / 2 ** 32;
}

function spaceOf(ctx: GameContext, id: string): Space {
  return ctx.board.spaces.find((s) => s.id === id)!;
}

function myHoldings(state: GameState, ctx: GameContext) {
  return Object.entries(state.ownership)
    .filter(([, o]) => o.owner === state.current)
    .map(([id, own]) => ({ id, own, space: spaceOf(ctx, id) }));
}

// Riserva da tenere: per il difficile cresce con gli affitti più cari degli avversari.
function reserveFor(state: GameState, ctx: GameContext, k: Knobs): number {
  if (!k.dangerAware) return k.reserve;
  let threat = 0;
  for (const [id, own] of Object.entries(state.ownership)) {
    if (own.owner === state.current || state.players[own.owner].bankrupt) continue;
    threat = Math.max(threat, computeRent(state, ctx, id, 7));
  }
  return Math.max(k.reserve, Math.round(threat * 0.6));
}

// Quanto vale per il computer una casella libera: completare un quartiere conta molto.
function wantsToBuy(state: GameState, ctx: GameContext, space: Space, k: Knobs): boolean {
  if (!('price' in space)) return false;
  const money = state.players[state.current].money;
  if (money < space.price) return false;
  // il facile ogni tanto lascia perdere una buona occasione
  if (k.mistakes && chance(state, 1) < k.mistakes) return false;
  let reserve = reserveFor(state, ctx, k);
  // a inizio partita il difficile compra quasi tutto: le vie libere finiscono presto
  if (k.dangerAware && Object.keys(state.ownership).length < 14) reserve = Math.min(reserve, k.reserve / 2);
  if (space.type === 'property') {
    const group = ctx.board.spaces.filter((s): s is PropertySpace => s.type === 'property' && s.group === space.group);
    const ownedByMe = group.filter((g) => state.ownership[g.id]?.owner === state.current).length;
    const ownedByOthers = group.filter((g) => state.ownership[g.id] && state.ownership[g.id].owner !== state.current).length;
    // completa il quartiere: compra anche intaccando la riserva
    if (ownedByMe === group.length - 1) return true;
    // blocca un avversario che sta per completarlo
    if (ownedByOthers === group.length - 1) return money - space.price >= reserve / 2;
  } else if (k.buyOnlyUseful) {
    return money - space.price >= reserve * 2;
  } else if (k.stationBonus) {
    return money - space.price >= reserve / (1 + k.stationBonus);
  }
  return money - space.price >= reserve;
}

// Cerca di coprire un debito: prima vende case, poi ipoteca ciò che rende meno.
// Serve anche al pulsante "Copri il debito automaticamente" delle persone.
export function raiseMoney(state: GameState, ctx: GameContext): Action | null {
  // prima le quote e gli edifici speciali, poi le case e le ipoteche
  const share = Object.entries(state.shares ?? {}).find(([, h]) => h.includes(state.current));
  if (share) return { type: 'sellShare', group: share[0] };
  const lm = Object.entries(state.landmarks ?? {}).find(([, l]) => l.owner === state.current);
  if (lm) return { type: 'sellLandmark', group: lm[0] };
  const holdings = myHoldings(state, ctx);
  const withHouses = holdings
    .filter((h) => h.space.type === 'property' && h.own.houses > 0)
    .sort((a, b) => b.own.houses - a.own.houses);
  for (const h of withHouses) {
    const space = h.space as PropertySpace;
    const groupMax = Math.max(
      ...ctx.board.spaces
        .filter((s): s is PropertySpace => s.type === 'property' && s.group === space.group)
        .map((s) => state.ownership[s.id]?.houses ?? 0),
    );
    if (h.own.houses === groupMax) return { type: 'sell', spaceId: h.id };
  }
  const mortgageable = mortgageCandidates(state, ctx);
  return mortgageable.length ? { type: 'mortgage', spaceId: mortgageable[0].id } : null;
}

// Caselle che si possono ipotecare, prima quelle che non fanno parte di un quartiere completo.
function mortgageCandidates(state: GameState, ctx: GameContext) {
  return myHoldings(state, ctx)
    .filter((h) => !h.own.mortgaged && 'mortgage' in h.space)
    .filter((h) => {
      if (h.space.type !== 'property') return true;
      return !groupHasBuildings(state, ctx, h.space.group);
    })
    .sort((a, b) => score(a) - score(b));

  function score(h: { space: Space }): number {
    const complete = h.space.type === 'property' && ownsWholeGroup(state, ctx, state.current, h.space.group);
    return (complete ? 10000 : 0) + ('price' in h.space ? h.space.price : 0);
  }
}

// Vie su cui si può costruire adesso (quartiere completo, nessuna ipoteca, costruzione uniforme).
function buildable(state: GameState, ctx: GameContext) {
  return myHoldings(state, ctx)
    .filter((h): h is { id: string; own: typeof h.own; space: PropertySpace } => h.space.type === 'property')
    .filter((h) => ownsWholeGroup(state, ctx, state.current, h.space.group))
    .filter((h) => h.own.houses < HOTEL)
    .filter((h) => {
      const owns = groupOf(ctx, h.space.group).map((g) => state.ownership[g.id]);
      return owns.every((o) => !o.mortgaged) && h.own.houses <= Math.min(...owns.map((o) => o.houses));
    });
}

// Costruisce in modo uniforme sul quartiere più redditizio che può permettersi.
function tryBuild(state: GameState, ctx: GameContext, k: Knobs): Action | null {
  const money = state.players[state.current].money;
  const reserve = Math.max(k.buildReserve, k.dangerAware ? reserveFor(state, ctx, k) / 2 : 0);
  const candidates = buildable(state, ctx)
    .filter((h) => money - h.space.housePrice >= reserve)
    .sort((a, b) => b.space.rent[a.own.houses + 1] - a.space.rent[a.own.houses] - (a.space.rent[b.own.houses + 1] - b.space.rent[b.own.houses]));
  if (!candidates.length) return null;
  // il facile non sceglie la via migliore, e a volte non costruisce affatto
  if (k.mistakes) {
    if (chance(state, 2) < k.mistakes) return null;
    return { type: 'build', spaceId: candidates[Math.floor(chance(state, 3) * candidates.length)].id };
  }
  return { type: 'build', spaceId: candidates[0].id };
}

// Edificio speciale: quando il quartiere ha già almeno 3 case per via (o quando le case sono
// finite), se i soldi bastano. Fontana dove gli affitti sono alti, teatro dove sono bassi,
// mercato coperto in mezzo.
function tryLandmark(state: GameState, ctx: GameContext, k: Knobs): Action | null {
  if (!state.rules?.landmarks) return null;
  const money = state.players[state.current].money;
  for (const g of ctx.board.groups) {
    if (state.landmarks?.[g.id] || !ownsWholeGroup(state, ctx, state.current, g.id)) continue;
    const streets = groupOf(ctx, g.id);
    const owns = streets.map((sp) => state.ownership[sp.id]);
    if (owns.some((o) => o.mortgaged) || owns.some((o) => o.houses < 3)) continue;
    if (money - landmarkPrice(ctx, g.id) < Math.max(k.buildReserve, reserveFor(state, ctx, k) / 2)) continue;
    if (k.mistakes && chance(state, 5) < k.mistakes) return null;
    const rent = streets.reduce((a, sp) => a + computeRent(state, ctx, sp.id, 7), 0) / streets.length;
    const landmark: LandmarkId = rent >= 240 ? 'fontana' : rent < THEATRE_MIN_RENT * 1.5 ? 'teatro' : 'mercato';
    return { type: 'buildLandmark', group: g.id, landmark };
  }
  return null;
}

// Quota di quartiere: dove gli avversari incassano di più, se avanzano soldi (il doppio della
// riserva) e se non ne ha già due di quel quartiere.
function tryBuyShare(state: GameState, ctx: GameContext, k: Knobs): Action | null {
  if (!state.rules?.shares) return null;
  const me = state.current;
  const money = state.players[me].money;
  let best: { group: string; value: number } | null = null;
  for (const g of ctx.board.groups) {
    const holders = sharesOf(state, g.id);
    if (holders.length >= SHARES_PER_GROUP || holders.filter((h) => h === me).length >= 2) continue;
    if (money - sharePrice(ctx, g.id) < reserveFor(state, ctx, k) * 2) continue;
    // affitto che gli altri incassano nel quartiere: lì le quote rendono
    let value = 0;
    for (const sp of groupOf(ctx, g.id)) {
      const own = state.ownership[sp.id];
      if (!own || own.owner === me || sameTeam(state, me, own.owner)) continue;
      value += computeRent(state, ctx, sp.id, 7);
    }
    if (value / sharePrice(ctx, g.id) < 0.5) continue;
    if (!best || value > best.value) best = { group: g.id, value };
  }
  return best ? { type: 'buyShare', group: best.group } : null;
}

// Ipoteca una via sparsa per avere i soldi di una casa sul quartiere completo (fino a 3 case).
function tryMortgageToBuild(state: GameState, ctx: GameContext, k: Knobs): Action | null {
  if (!k.mortgageToBuild) return null;
  const money = state.players[state.current].money;
  const target = buildable(state, ctx).filter((h) => h.own.houses < 3).sort((a, b) => b.space.rent[3] - a.space.rent[3])[0];
  if (!target || money - target.space.housePrice >= k.buildReserve) return null;
  const lone = mortgageCandidates(state, ctx).filter((h) => h.space.type !== 'property' || !ownsWholeGroup(state, ctx, state.current, h.space.group));
  const pick = lone.find((h) => 'mortgage' in h.space && money + h.space.mortgage - target.space.housePrice >= k.buildReserve);
  return pick ? { type: 'mortgage', spaceId: pick.id } : null;
}

function tryUnmortgage(state: GameState, ctx: GameContext, k: Knobs): Action | null {
  const money = state.players[state.current].money;
  // chi ipoteca per costruire riscatta solo quando è davvero ricco (altrimenti ipoteca e riscatta di continuo)
  const keep = k.mortgageToBuild ? Math.max(k.buildReserve, BUILD_RESERVE) * 4 : k.buildReserve * 2;
  const h = myHoldings(state, ctx).find((x) => x.own.mortgaged && 'mortgage' in x.space && money - unmortgageCost(x.space.mortgage) >= keep);
  return h ? { type: 'unmortgage', spaceId: h.id } : null;
}

// ---------- aste e scambi ----------

function groupOf(ctx: GameContext, group: string): PropertySpace[] {
  return ctx.board.spaces.filter((s): s is PropertySpace => s.type === 'property' && s.group === group);
}

// Vero se, ottenendo "spaceId", il giocatore completerebbe il quartiere.
function wouldComplete(state: GameState, ctx: GameContext, playerId: number, spaceId: string): boolean {
  const space = spaceOf(ctx, spaceId);
  if (space.type !== 'property') return false;
  return groupOf(ctx, space.group).every((g) => g.id === spaceId || state.ownership[g.id]?.owner === playerId);
}

// Quanto vale una casella per un giocatore che la riceve.
function valueFor(state: GameState, ctx: GameContext, playerId: number, spaceId: string, k: Knobs): number {
  const space = spaceOf(ctx, spaceId);
  if (!('price' in space)) return 0;
  const base = state.ownership[spaceId]?.mortgaged ? space.price - space.mortgage : space.price;
  if (wouldComplete(state, ctx, playerId, spaceId)) return base * 2.5;
  if (space.type === 'station') {
    const owned = ctx.board.spaces.filter((s) => s.type === 'station' && state.ownership[s.id]?.owner === playerId).length;
    return base * (1 + 0.25 * owned + k.stationBonus);
  }
  if (space.type === 'utility') return base * (1 + k.stationBonus);
  return base;
}

function chooseAuctionAction(state: GameState, ctx: GameContext, me: number): Action {
  const a = state.auction!;
  const k = knobsOf(state.players[me]);
  const money = state.players[me].money;
  const completes = wouldComplete(state, ctx, me, a.spaceId);
  const blocks = state.players.some((p) => p.id !== me && !p.bankrupt && wouldComplete(state, ctx, p.id, a.spaceId));
  const space = spaceOf(ctx, a.spaceId);
  const price = 'price' in space ? space.price : 0;
  const worth = price * (completes ? k.auction.completes : blocks ? k.auction.blocks : k.auction.base + (space.type !== 'property' ? k.stationBonus / 2 : 0));
  const limit = Math.min(worth, money - (completes ? 20 : k.reserve / 2));
  const next = Math.max(MIN_BID, a.highestBid + 10);
  return next <= limit && a.highestBidder !== me ? { type: 'bid', amount: next } : { type: 'pass' };
}

function chooseTradeResponse(state: GameState, ctx: GameContext): Action {
  const t = state.trade!;
  const me = t.to;
  const k = knobsOf(state.players[me]);
  const interest = interestOn(state, ctx, t.give.spaces);
  if (state.players[me].money - t.get.money + t.give.money < interest) return { type: 'rejectTrade' };
  const received = t.give.money - interest + t.give.spaces.reduce((sum, id) => sum + valueFor(state, ctx, me, id, k), 0);
  // cedere una casella che completa il quartiere dell'avversario costa molto di più
  const lost =
    t.get.money +
    t.get.spaces.reduce((sum, id) => {
      const space = spaceOf(ctx, id);
      const price = 'price' in space ? space.price : 0;
      return sum + (wouldComplete(state, ctx, t.from, id) ? price * 2 : price) + (wouldCompleteMine(id) ? price * 1.5 : 0);
    }, 0);
  // con un compagno di squadra si guarda il bene comune: basta che lo scambio non sia rovinoso
  const margin = sameTeam(state, me, t.from) ? k.acceptMargin * 0.6 : k.acceptMargin;
  if (received >= lost * margin && received > 0) return { type: 'acceptTrade' };
  // offerta di soldi per le mie vie, non troppo lontana: chiedo quanto mi serve per accettare
  if (k.counters && (t.counters ?? 0) < MAX_COUNTERS && !t.give.spaces.length && t.get.spaces.length && !t.get.money && received >= lost * 0.6) {
    const ask = Math.ceil((lost * k.acceptMargin + interest) / 10) * 10;
    if (ask <= Math.max(state.players[t.from].money, 0)) {
      return { type: 'counterTrade', offer: { give: { money: 0, spaces: [...t.get.spaces] }, get: { money: ask, spaces: [] } } };
    }
  }
  return { type: 'rejectTrade' };

  // vero se la casella fa parte di un quartiere che possiedo già tutto
  function wouldCompleteMine(id: string): boolean {
    const space = spaceOf(ctx, id);
    return space.type === 'property' && ownsWholeGroup(state, ctx, me, space.group);
  }
}

// Se manca una sola via per completare un quartiere, prova a comprarla da chi la possiede.
function tryProposeTrade(state: GameState, ctx: GameContext, k: Knobs): Action | null {
  if (!k.proposeTrades || state.tradeProposedThisTurn) return null;
  const me = state.current;
  const money = state.players[me].money;
  for (const g of ctx.board.groups) {
    const group = groupOf(ctx, g.id);
    const missing = group.filter((s) => state.ownership[s.id]?.owner !== me);
    if (missing.length !== 1) continue;
    const target = missing[0];
    const own = state.ownership[target.id];
    if (!own || state.players[own.owner].bankrupt) continue;
    if (group.some((s) => (state.ownership[s.id]?.houses ?? 0) > 0)) continue;
    const offer = Math.min(Math.round(target.price * k.offerMult), money - k.reserve);
    // sotto questa cifra l'altro computer rifiuterebbe comunque
    if (offer < target.price * 2.3) continue;
    const give: TradeSide = { money: offer, spaces: [] };
    return { type: 'proposeTrade', offer: { to: own.owner, give, get: { money: 0, spaces: [target.id] } } };
  }
  return null;
}

export function chooseBotAction(state: GameState, ctx: GameContext): Action {
  if (state.trade) return chooseTradeResponse(state, ctx);
  const actor = actingPlayer(state);
  const me = state.players[actor];
  const k = knobsOf(me);
  switch (state.phase) {
    case 'auction':
      return chooseAuctionAction(state, ctx, actor);
    case 'roll':
      if (me.inJail && me.jailCards.length) return { type: 'useJailCard' };
      // all'inizio conviene uscire subito per comprare; più avanti meglio restare dentro
      if (k.payJail && me.inJail && me.money >= JAIL_FINE + k.reserve * 2 && Object.keys(state.ownership).length < 20) return { type: 'payJailFine' };
      return { type: 'roll' };
    case 'cardChoice': {
      const card = ctx.cards.cards.find((c) => c.id === state.pendingCard);
      if (!card || card.effect.kind !== 'choice') return { type: 'chooseCard', option: 0 };
      // il facile prende la prima; gli altri quella che conviene di più
      if (k.mistakes) return { type: 'chooseCard', option: 0 };
      let houses = 0;
      let hotels = 0;
      for (const o of Object.values(state.ownership)) {
        if (o.owner !== actor) continue;
        if (o.houses === HOTEL) hotels++;
        else houses += o.houses;
      }
      const start = ctx.board.spaces.find((sp) => sp.type === 'start');
      const values = card.effect.options.map((o) =>
        cardValue(o.effect, {
          others: state.players.filter((p) => p.id !== actor && !p.bankrupt).length,
          houses,
          hotels,
          salary: start && 'salary' in start ? start.salary : 200,
          position: me.position,
          size: ctx.board.spaces.length,
          indexOf: (id) => ctx.board.spaces.findIndex((sp) => sp.id === targetSpace(ctx.board, id)),
          jailIsSafe: Object.keys(state.ownership).length >= 20,
        }),
      );
      return { type: 'chooseCard', option: values.indexOf(Math.max(...values)) };
    }
    case 'buy': {
      const space = ctx.board.spaces[me.position];
      return wantsToBuy(state, ctx, space, k) ? { type: 'buy' } : { type: 'decline' };
    }
    case 'endTurn':
      if (me.money < 0) return raiseMoney(state, ctx) ?? { type: 'bankrupt' };
      return (
        tryUnmortgage(state, ctx, k) ??
        tryProposeTrade(state, ctx, k) ??
        tryLandmark(state, ctx, k) ??
        tryBuild(state, ctx, k) ??
        tryMortgageToBuild(state, ctx, k) ??
        tryBuyShare(state, ctx, k) ??
        { type: 'endTurn' }
      );
    default:
      throw new Error('La partita è finita');
  }
}

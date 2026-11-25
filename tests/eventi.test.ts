import { describe, it, expect } from 'vitest';
import { board, cards } from '../src/data';
import {
  applyAction,
  applyGroupEvent,
  chooseBotAction,
  computeRent,
  createGame,
  EVENT_IDS,
  MARKET_IDS,
  MARKET_PAY,
  PRESETS,
  UPKEEP_PER_HOUSE,
  WHEEL_EVERY,
  rentFactor,
  salaryOf,
  type GameContext,
  type GameState,
} from '../src/engine';
import { renderEvents } from '../src/ui/view';
import { it as itMsgs } from '../src/i18n/it';

const ctx: GameContext = { board, cards };

function game(rules: Parameters<typeof createGame>[2] = {}, seed = 7): GameState {
  return createGame([
    { name: 'Anna' },
    { name: 'Bruno' },
  ], ctx, rules, seed);
}

// Le prove sugli effetti mettono l'evento a mano: così non dipendono dall'estrazione.
function withEvent(s: GameState, id: (typeof EVENT_IDS)[number], group: string): GameState {
  return { ...s, event: { id, group, round: s.round } };
}

describe('eventi di quartiere', () => {
  const street = board.spaces.find((sp) => sp.type === 'property')!;
  const group = street.type === 'property' ? street.group : '';

  it('la festa raddoppia gli affitti del quartiere e lascia stare gli altri', () => {
    let s = game();
    s.ownership[street.id] = { owner: 0, houses: 0, mortgaged: false };
    const base = computeRent(s, ctx, street.id, 7);
    s = withEvent(s, 'festa', group);
    expect(rentFactor(s, ctx, street.id)).toBe(2);
    expect(computeRent(s, ctx, street.id, 7)).toBe(base * 2);
    // una via di un altro quartiere non cambia
    const other = board.spaces.find((sp) => sp.type === 'property' && sp.group !== group)!;
    s.ownership[other.id] = { owner: 0, houses: 0, mortgaged: false };
    expect(rentFactor(s, ctx, other.id)).toBe(1);
  });

  it('i lavori dimezzano gli affitti del quartiere', () => {
    let s = game();
    s.ownership[street.id] = { owner: 0, houses: 0, mortgaged: false };
    const base = computeRent(s, ctx, street.id, 7);
    s = withEvent(s, 'lavori', group);
    expect(computeRent(s, ctx, street.id, 7)).toBe(Math.round(base * 0.5));
  });

  it('il mercatino paga chi ha vie nel quartiere', () => {
    const streets = board.spaces.filter((sp) => sp.type === 'property' && sp.group === group);
    const s = game();
    for (const sp of streets) s.ownership[sp.id] = { owner: 0, houses: 0, mortgaged: false };
    const before = s.players[0].money;
    applyGroupEvent(s, ctx, { id: 'mercatino', group, round: 1 });
    expect(s.players[0].money).toBe(before + MARKET_PAY * streets.length);
    expect(s.players[1].money).toBe(game().players[1].money);
  });

  it('la manutenzione fa pagare le case, e mai più di quello che si ha', () => {
    const streets = board.spaces.filter((sp) => sp.type === 'property' && sp.group === group);
    const s = game();
    for (const sp of streets) s.ownership[sp.id] = { owner: 0, houses: 3, mortgaged: false };
    const before = s.players[0].money;
    applyGroupEvent(s, ctx, { id: 'manutenzione', group, round: 1 });
    expect(s.players[0].money).toBe(before - 3 * UPKEEP_PER_HOUSE * streets.length);

    // chi è senza soldi non va in debito
    const povero = game();
    for (const sp of streets) povero.ownership[sp.id] = { owner: 1, houses: 4, mortgaged: false };
    povero.players[1].money = 10;
    applyGroupEvent(povero, ctx, { id: 'manutenzione', group, round: 1 });
    expect(povero.players[1].money).toBe(0);

    // le vie senza case non costano niente
    const vuoto = game();
    for (const sp of streets) vuoto.ownership[sp.id] = { owner: 0, houses: 0, mortgaged: false };
    const soldi = vuoto.players[0].money;
    applyGroupEvent(vuoto, ctx, { id: 'manutenzione', group, round: 1 });
    expect(vuoto.players[0].money).toBe(soldi);
  });

  it('con la regola attiva ogni giro ha il suo evento e il registro lo racconta', () => {
    let s = game({ events: true }, 11);
    s = applyAction(s, { type: 'roll' }, ctx);
    expect(s.event).not.toBeNull();
    expect(EVENT_IDS).toContain(s.event!.id);
    expect(board.groups.map((g) => g.id)).toContain(s.event!.group);
    expect(s.log.some((l) => typeof l === 'object' && l.k === `log.event.${s.event!.id}`)).toBe(true);

    // dopo un giro intero l'evento è un altro (o almeno è stato riestratto)
    const first = s.event!;
    let guard = 0;
    while (s.round === first.round && s.phase !== 'gameOver' && guard++ < 300) s = applyAction(s, chooseBotAction(s, ctx), ctx);
    expect(s.event!.round).toBe(s.round);
  });

  it('senza la regola non succede niente', () => {
    let s = game({}, 11);
    s = applyAction(s, { type: 'roll' }, ctx);
    expect(s.event ?? null).toBeNull();
    expect(s.market ?? null).toBeNull();
  });
});

describe('Ruota del Mercato', () => {
  it('gira al primo giro e dura WHEEL_EVERY giri', () => {
    let s = game({ wheel: true }, 5);
    s = applyAction(s, { type: 'roll' }, ctx);
    expect(s.market).not.toBeNull();
    expect(MARKET_IDS).toContain(s.market!.id);
    expect(s.market!.from).toBe(1);
    expect(s.market!.until).toBe(WHEEL_EVERY);
  });

  it('il rialzo e il ribasso cambiano tutti gli affitti', () => {
    const street = board.spaces.find((sp) => sp.type === 'property')!;
    const s = game();
    s.ownership[street.id] = { owner: 0, houses: 3, mortgaged: false };
    const base = computeRent(s, ctx, street.id, 7);
    const up = { ...s, market: { id: 'rialzo' as const, from: 1, until: 5 } };
    const down = { ...s, market: { id: 'ribasso' as const, from: 1, until: 5 } };
    expect(computeRent(up, ctx, street.id, 7)).toBe(Math.round(base * 1.25));
    expect(computeRent(down, ctx, street.id, 7)).toBe(Math.round(base * 0.75));
  });

  it('le buste pesanti valgono una volta e mezza lo stipendio', () => {
    const s = game();
    const normale = salaryOf(s, ctx);
    const ricco = salaryOf({ ...s, market: { id: 'stipendio', from: 1, until: 5 } }, ctx);
    expect(ricco).toBe(Math.round(normale * 1.5));
    expect(salaryOf({ ...s, market: { id: 'calma', from: 1, until: 5 } }, ctx)).toBe(normale);
  });

  it('festa e rialzo insieme si moltiplicano', () => {
    const street = board.spaces.find((sp) => sp.type === 'property')!;
    const group = street.type === 'property' ? street.group : '';
    const s = { ...game(), event: { id: 'festa' as const, group, round: 1 }, market: { id: 'rialzo' as const, from: 1, until: 5 } };
    expect(rentFactor(s, ctx, street.id)).toBe(2.5);
  });
});

describe('partita con le regole facoltative', () => {
  it('finisce e si rigioca uguale dallo stesso seme', () => {
    const play = () => {
      let s = game({ events: true, wheel: true, maxRounds: 20 }, 99);
      s.players.forEach((p) => (p.isBot = true));
      let guard = 0;
      while (s.phase !== 'gameOver' && guard++ < 4000) s = applyAction(s, chooseBotAction(s, ctx), ctx);
      return { round: s.round, money: s.players.map((p) => p.money), log: s.log.length };
    };
    const a = play();
    expect(a.round).toBeGreaterThan(1);
    expect(play()).toEqual(a);
  });

  it('nessuno finisce in debito per la manutenzione', () => {
    let s = game({ events: true }, 42);
    s.players.forEach((p) => (p.isBot = true));
    let guard = 0;
    while (s.phase !== 'gameOver' && s.round < 25 && guard++ < 4000) {
      s = applyAction(s, chooseBotAction(s, ctx), ctx);
      // chi va in rosso è sempre e solo chi sta giocando
      for (const p of s.players) if (p.money < 0) expect(p.id).toBe(s.current);
    }
  });
});

describe('come si vedono', () => {
  it('il centro del tavolo mostra evento e mercato', () => {
    const s = { ...game(), event: { id: 'festa' as const, group: board.groups[0].id, round: 1 }, market: { id: 'rialzo' as const, from: 1, until: 5 } };
    const html = renderEvents(s);
    expect(html).toContain('ev-festa');
    expect(html).toContain('ev-rialzo');
    expect(html).toContain(board.groups[0].name);
    expect(renderEvents(game())).toBe('');
  });

  it('ogni evento e ogni faccia della ruota ha le sue frasi', () => {
    for (const id of EVENT_IDS) {
      expect(itMsgs[`event.${id}`], id).toBeTruthy();
      expect(itMsgs[`log.event.${id}`], id).toBeTruthy();
    }
    for (const id of MARKET_IDS) {
      expect(itMsgs[`market.${id}`], id).toBeTruthy();
      expect(itMsgs[`log.market.${id}`], id).toBeTruthy();
    }
  });

  it('il tipo di partita "Festa" accende le due regole', () => {
    const festa = PRESETS.find((p) => p.id === 'festa');
    expect(festa).toBeTruthy();
    expect(festa!.rules.events).toBe(true);
    expect(festa!.rules.wheel).toBe(true);
  });
});

import { describe, it, expect } from 'vitest';
import { board, cards } from '../src/data';
import { typicalCardValue } from '../src/engine';

// Controlli di coerenza sui dati: evitano errori di battitura nei JSON.
describe('dati del tabellone', () => {
  it('ha 40 caselle con id unici', () => {
    expect(board.spaces).toHaveLength(40);
    const ids = board.spaces.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('inizia dalla Partenza e ha una sola Caserma', () => {
    expect(board.spaces[0].type).toBe('start');
    expect(board.spaces.filter((s) => s.type === 'jail')).toHaveLength(1);
  });

  it('ogni proprietà appartiene a un gruppo esistente con affitti crescenti', () => {
    const groupIds = new Set(board.groups.map((g) => g.id));
    for (const s of board.spaces) {
      if (s.type !== 'property') continue;
      expect(groupIds.has(s.group)).toBe(true);
      expect(s.rent).toHaveLength(6);
      for (let i = 1; i < s.rent.length; i++) expect(s.rent[i]).toBeGreaterThan(s.rent[i - 1]);
    }
  });

  it('ogni gruppo ha almeno due proprietà', () => {
    for (const g of board.groups) {
      const n = board.spaces.filter((s) => s.type === 'property' && s.group === g.id).length;
      expect(n).toBeGreaterThanOrEqual(2);
    }
  });
});

describe('dati delle carte', () => {
  it('le carte "vai a" puntano a caselle esistenti', () => {
    const ids = new Set(board.spaces.map((s) => s.id));
    for (const c of cards.cards) {
      if (c.effect.kind === 'moveTo') expect(ids.has(c.effect.space)).toBe(true);
    }
  });

  it('ogni casella carta usa un mazzo esistente con carte', () => {
    for (const s of board.spaces) {
      if (s.type !== 'card') continue;
      expect(cards.cards.some((c) => c.deck === s.deck)).toBe(true);
    }
  });
});

describe('identità propria', () => {
  // Effetti e importi delle carte del gioco classico (edizioni inglese e americana):
  // nessuna carta di Sdrogopoli deve avere lo stesso effetto con lo stesso importo.
  const CLASSIC: Record<string, number[]> = {
    gain: [10, 20, 25, 45, 50, 100, 150, 200],
    pay: [15, 50, 100, 150],
    payEachPlayer: [50],
    collectFromEachPlayer: [10, 50],
    moveBy: [-3],
  };
  const CLASSIC_REPAIRS = ['25/100', '40/115'];

  it('le carte non copiano gli importi del classico', () => {
    // anche le opzioni delle carte con scelta
    const effects: { id: string; effect: unknown }[] = cards.cards.flatMap((c) =>
      c.effect.kind === 'choice' ? c.effect.options.map((o) => ({ id: c.id, effect: o.effect as unknown })) : [{ id: c.id, effect: c.effect as unknown }],
    );
    for (const c of effects) {
      const e = c.effect as { kind: string; amount?: number; steps?: number; perHouse?: number; perHotel?: number };
      const value = e.amount ?? e.steps;
      if (value !== undefined) expect(CLASSIC[e.kind] ?? [], c.id).not.toContain(value);
      if (e.kind === 'repairs') expect(CLASSIC_REPAIRS, c.id).not.toContain(`${e.perHouse}/${e.perHotel}`);
    }
  });

  it('i colori dei quartieri non sono quelli del classico', () => {
    const classic = ['#955436', '#aae0fa', '#d93a96', '#f7941d', '#ed1b24', '#fef200', '#1fb25a', '#0072bb'];
    const hex = (h: string) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
    // distanza minima nello spazio RGB dal colore classico nella stessa posizione
    board.groups.forEach((g, i) => {
      const [a, b] = [hex(g.color.toLowerCase()), hex(classic[i])];
      expect(Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]), g.id).toBeGreaterThan(80);
    });
    expect(new Set(board.groups.map((g) => g.color)).size).toBe(board.groups.length);
  });
});

describe('mazzi di carte', () => {
  const indexOf = (id: string) => board.spaces.findIndex((sp) => sp.id === id);
  const salary = (board.spaces.find((sp) => sp.type === 'start') as { salary: number }).salary;

  it('16 carte per mazzo, da 6 a 8 con una scelta', () => {
    for (const deck of ['sorte', 'quartiere']) expect(cards.cards.filter((c) => c.deck === deck)).toHaveLength(16);
    const choices = cards.cards.filter((c) => c.effect.kind === 'choice');
    expect(choices.length).toBeGreaterThanOrEqual(6);
    expect(choices.length).toBeLessThanOrEqual(8);
    for (const c of choices) {
      if (c.effect.kind !== 'choice') continue;
      expect(c.effect.options.length, c.id).toBe(2);
      for (const o of c.effect.options) {
        expect(o.label.length, c.id).toBeGreaterThan(5);
        // la carta "esci gratis" si tiene in mano: non può essere un'opzione
        expect(['choice', 'getOutOfJailFree'], c.id).not.toContain(o.effect.kind);
        if (o.effect.kind === 'moveTo') expect(indexOf(o.effect.space), c.id).toBeGreaterThanOrEqual(0);
      }
    }
  });

  it('il valore medio di ogni mazzo è vicino a zero', () => {
    for (const deck of ['sorte', 'quartiere']) {
      const values = cards.cards.filter((c) => c.deck === deck).map((c) => typicalCardValue(c.effect, salary, indexOf));
      const mean = values.reduce((a, b) => a + b, 0) / values.length;
      expect(Math.abs(mean), `${deck}: ${mean.toFixed(1)}`).toBeLessThanOrEqual(12);
    }
  });
});

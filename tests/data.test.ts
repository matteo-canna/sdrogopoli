import { describe, it, expect } from 'vitest';
import { board, cards } from '../src/data';

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
    for (const c of cards.cards) {
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

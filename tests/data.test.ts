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

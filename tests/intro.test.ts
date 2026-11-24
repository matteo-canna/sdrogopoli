import { describe, it, expect } from 'vitest';
import { board } from '../src/data';
import { districts, gameFacts, renderIntro } from '../src/ui/intro';

describe('informazioni della schermata iniziale', () => {
  it('ha un quartiere per ogni gruppo, con le sue vie e i prezzi', () => {
    const d = districts();
    expect(d).toHaveLength(board.groups.length);
    for (const q of d) {
      expect(q.streets).toBeGreaterThan(0);
      expect(q.minPrice).toBeLessThanOrEqual(q.maxPrice);
    }
    // tutte le vie del tabellone sono contate una volta
    const streets = board.spaces.filter((s) => s.type === 'property').length;
    expect(d.reduce((n, q) => n + q.streets, 0)).toBe(streets);
  });

  it('mostra i numeri del tabellone presi dai dati', () => {
    const facts = gameFacts();
    expect(facts.find((f) => f.label === 'caselle')?.value).toBe(String(board.spaces.length));
    expect(facts.find((f) => f.label === 'per iniziare')?.value).toContain(String(board.startingMoney));
  });

  it('spiega come si gioca', () => {
    const html = renderIntro();
    expect(html).toContain('Come si gioca');
    expect(html).toContain('Regole in breve');
  });
});

import { describe, it, expect } from 'vitest';
import { BOARDS, board, cards } from '../src/data';
import { targetSpace, typicalCardValue } from '../src/engine';
import { gridPosition, perSide, side } from '../src/ui/view';

// Controlli di coerenza sui dati: evitano errori di battitura nei JSON.
// Valgono per ogni tabellone, così un tabellone nuovo non può essere sbagliato in silenzio.
describe.each(BOARDS.map((b) => [b.id, b] as const))('dati del tabellone %s', (_id, choice) => {
  const data = choice.data;

  it('ha un numero di caselle multiplo di 4, con id unici', () => {
    expect(data.spaces.length % 4).toBe(0);
    expect(data.spaces.length).toBeGreaterThanOrEqual(20);
    const ids = data.spaces.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('inizia dalla Partenza e ha una sola prigione, un solo "vai in prigione" e una sosta', () => {
    expect(data.spaces[0].type).toBe('start');
    for (const type of ['jail', 'goToJail', 'free', 'start']) {
      expect(data.spaces.filter((s) => s.type === type), type).toHaveLength(1);
    }
  });

  it('agli angoli ci sono le caselle senza prezzo', () => {
    const n = perSide(data.spaces.length);
    for (const i of [0, n, 2 * n, 3 * n]) {
      expect(side(i, data.spaces.length), String(i)).toBe('corner');
      expect('price' in data.spaces[i], data.spaces[i].id).toBe(false);
    }
  });

  it('ogni casella ha un posto suo nella griglia', () => {
    const seen = new Set(data.spaces.map((_s, i) => {
      const { row, col } = gridPosition(i, data.spaces.length);
      return `${row},${col}`;
    }));
    expect(seen.size).toBe(data.spaces.length);
  });

  it('ogni proprietà appartiene a un gruppo esistente con affitti crescenti', () => {
    const groupIds = new Set(data.groups.map((g) => g.id));
    for (const s of data.spaces) {
      if (s.type !== 'property') continue;
      expect(groupIds.has(s.group), s.id).toBe(true);
      expect(s.rent).toHaveLength(6);
      expect(s.mortgage, s.id).toBeLessThan(s.price);
      for (let i = 1; i < s.rent.length; i++) expect(s.rent[i], s.id).toBeGreaterThan(s.rent[i - 1]);
    }
  });

  it('ogni gruppo ha almeno due proprietà e un colore suo', () => {
    for (const g of data.groups) {
      const n = data.spaces.filter((s) => s.type === 'property' && s.group === g.id).length;
      expect(n, g.id).toBeGreaterThanOrEqual(2);
    }
    expect(new Set(data.groups.map((g) => g.color)).size).toBe(data.groups.length);
  });

  it('ha fermate, un servizio, tasse e caselle carta di entrambi i mazzi', () => {
    expect(data.spaces.filter((s) => s.type === 'station').length).toBeGreaterThanOrEqual(2);
    expect(data.spaces.filter((s) => s.type === 'utility').length).toBeGreaterThanOrEqual(1);
    expect(data.spaces.filter((s) => s.type === 'tax').length).toBeGreaterThanOrEqual(1);
    for (const deck of ['sorte', 'quartiere']) {
      expect(data.spaces.some((s) => s.type === 'card' && s.deck === deck), deck).toBe(true);
    }
  });

  it('le carte "vai a" puntano a caselle di questo tabellone', () => {
    const ids = new Set(data.spaces.map((s) => s.id));
    const targets = [
      ...cards.cards.flatMap((c) => (c.effect.kind === 'moveTo' ? [c.effect.space] : [])),
      ...cards.cards.flatMap((c) => (c.effect.kind === 'choice' ? c.effect.options.flatMap((o) => (o.effect.kind === 'moveTo' ? [o.effect.space] : [])) : [])),
    ];
    expect(targets.length).toBeGreaterThan(0);
    for (const role of targets) expect(ids.has(targetSpace(data, role)), role).toBe(true);
  });

  it('ogni nome tradotto corrisponde a una casella', () => {
    const ids = new Set(data.spaces.map((s) => s.id));
    for (const id of Object.keys(choice.names)) expect(ids.has(id), id).toBe(true);
    // le caselle che non sono vie hanno tutte il nome inglese
    for (const s of data.spaces) {
      if (s.type === 'property') continue;
      expect(choice.names[s.id], s.id).toBeTruthy();
    }
  });

  it('ogni casella carta usa un mazzo esistente con carte', () => {
    for (const s of data.spaces) {
      if (s.type !== 'card') continue;
      expect(cards.cards.some((c) => c.deck === s.deck)).toBe(true);
    }
  });
});

describe('tabelloni', () => {
  it('hanno id diversi e caselle con id diversi tra loro', () => {
    expect(new Set(BOARDS.map((b) => b.id)).size).toBe(BOARDS.length);
    const all = BOARDS.flatMap((b) => b.data.spaces.map((s) => s.id));
    expect(new Set(all).size, 'due tabelloni usano lo stesso id di casella').toBe(all.length);
  });
});

describe('identità propria', () => {
  // Effetti e importi delle carte del gioco classico (edizioni inglese e americana):
  // nessuna carta di Gioco Folle! deve avere lo stesso effetto con lo stesso importo.
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
    // distanza minima nello spazio RGB dal colore classico nella stessa posizione, su ogni tabellone
    for (const choice of BOARDS) {
      choice.data.groups.forEach((g, i) => {
        const [a, b] = [hex(g.color.toLowerCase()), hex(classic[i])];
        expect(Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]), `${choice.id}/${g.id}`).toBeGreaterThan(80);
      });
      // i quartieri di uno stesso tabellone si distinguono tra loro
      choice.data.groups.forEach((g, i) => {
        for (const other of choice.data.groups.slice(i + 1)) {
          const [a, b] = [hex(g.color.toLowerCase()), hex(other.color.toLowerCase())];
          expect(Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]), `${g.id}/${other.id}`).toBeGreaterThan(40);
        }
      });
    }
  });
});

describe('mazzi di carte', () => {
  const indexOf = (id: string) => board.spaces.findIndex((sp) => sp.id === targetSpace(board, id));
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

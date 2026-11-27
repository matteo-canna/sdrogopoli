import { describe, it, expect, beforeEach } from 'vitest';
import { BOARDS, DEFAULT_BOARD, board, boardChoice, cards, currentBoard, setBoard } from '../src/data';
import { applyAction, createGame, chooseBotAction, fileBoard, newSave, readSave, seededRng, targetSpace, type GameContext } from '../src/engine';
import { boardStyle, centerStyle, gridPosition, gridSide, perSide, side } from '../src/ui/view';
import { cardText, setLang } from '../src/i18n';

// Dopo ogni prova si torna al tabellone predefinito: "board" è condiviso da tutto il gioco.
beforeEach(() => {
  setBoard(DEFAULT_BOARD);
  setLang('it');
});

describe('scelta del tabellone', () => {
  it('ce n\'è più di uno e il predefinito è il primo', () => {
    expect(BOARDS.length).toBeGreaterThan(1);
    expect(DEFAULT_BOARD).toBe(BOARDS[0].id);
    expect(currentBoard()).toBe(DEFAULT_BOARD);
  });

  it('setBoard cambia il tabellone che vedono tutti', () => {
    const before = board.spaces.length;
    setBoard('valle');
    expect(currentBoard()).toBe('valle');
    expect(board.spaces.length).toBe(28);
    expect(board.spaces.length).not.toBe(before);
    setBoard('isola');
    expect(currentBoard()).toBe('isola');
    expect(board.spaces.length).toBe(32);
    expect(board.groups.length).toBe(7);
  });

  it('un id sconosciuto torna al predefinito', () => {
    setBoard('valle');
    setBoard('tabellone-che-non-esiste');
    expect(currentBoard()).toBe(DEFAULT_BOARD);
    expect(boardChoice(undefined).id).toBe(DEFAULT_BOARD);
    expect(boardChoice(null).id).toBe(DEFAULT_BOARD);
  });
});

describe('geometria del tabellone', () => {
  it('le caselle per lato e il lato della griglia vengono dalla lunghezza', () => {
    expect(perSide(40)).toBe(10);
    expect(gridSide(40)).toBe(11);
    expect(perSide(28)).toBe(7);
    expect(gridSide(28)).toBe(8);
  });

  it('la Partenza è in basso a destra e il giro è in senso orario', () => {
    for (const n of [40, 28]) {
      const g = gridSide(n);
      expect(gridPosition(0, n)).toEqual({ row: g, col: g });
      expect(gridPosition(1, n)).toEqual({ row: g, col: g - 1 });
      // i tre angoli dopo la Partenza
      expect(gridPosition(perSide(n), n)).toEqual({ row: g, col: 1 });
      expect(gridPosition(2 * perSide(n), n)).toEqual({ row: 1, col: 1 });
      expect(gridPosition(3 * perSide(n), n)).toEqual({ row: 1, col: g });
      // l'ultima casella è di nuovo accanto alla Partenza
      expect(gridPosition(n - 1, n)).toEqual({ row: g - 1, col: g });
    }
  });

  it('ogni casella ha una posizione diversa, su ogni lunghezza', () => {
    for (const n of [40, 28, 24]) {
      const seen = new Set(Array.from({ length: n }, (_, i) => JSON.stringify(gridPosition(i, n))));
      expect(seen.size, String(n)).toBe(n);
    }
  });

  it('i lati seguono il giro', () => {
    expect(side(0, 28)).toBe('corner');
    expect(side(3, 28)).toBe('bottom');
    expect(side(7, 28)).toBe('corner');
    expect(side(10, 28)).toBe('left');
    expect(side(17, 28)).toBe('top');
    expect(side(25, 28)).toBe('right');
  });

  it('la griglia del CSS e il centro si adattano alla lunghezza', () => {
    expect(boardStyle(40)).toContain('--cells:11');
    expect(boardStyle(40)).toContain('repeat(9, 1fr)');
    expect(boardStyle(28)).toContain('--cells:8');
    expect(boardStyle(28)).toContain('repeat(6, 1fr)');
    expect(centerStyle(40)).toBe('grid-row:2 / 11;grid-column:2 / 11');
    expect(centerStyle(28)).toBe('grid-row:2 / 8;grid-column:2 / 8');
  });
});

describe('carte su tabelloni diversi', () => {
  it('i ruoli delle carte diventano caselle del tabellone in uso', () => {
    for (const choice of BOARDS) {
      const ids = new Set(choice.data.spaces.map((s) => s.id));
      expect(ids.has(targetSpace(choice.data, 'partenza')), choice.id).toBe(true);
      expect(ids.has(targetSpace(choice.data, 'lusso')), choice.id).toBe(true);
    }
    // un id già vero resta com'è
    expect(targetSpace(BOARDS[0].data, 'periferia-1')).toBe('periferia-1');
  });

  it('il testo della carta nomina la casella del tabellone in uso', () => {
    const card = cards.cards.find((c) => c.id === 'sorte-02')!;
    expect(card.text).toContain('{space}');
    const citta = cardText('sorte-02');
    expect(citta).toContain('Riva dei Miliardari');
    expect(citta).not.toContain('{space}');
    setBoard('valle');
    const valle = cardText('sorte-02');
    expect(valle).toContain('Rifugio dei Miliardari');
    setBoard('isola');
    expect(cardText('sorte-02')).toContain('Villa dei Venti');
    setBoard('valle');
    setLang('en');
    expect(cardText('sorte-02')).toContain('Rifugio dei Miliardari');
  });
});

describe('partita sul tabellone corto', () => {
  const ctx = (): GameContext => ({ board, cards });

  it('una partita tra computer finisce e resta nei limiti del tabellone', () => {
    setBoard('valle');
    const c = ctx();
    expect(c.board.spaces.length).toBe(28);
    let s = createGame([
      { name: 'A', isBot: true },
      { name: 'B', isBot: true },
      { name: 'C', isBot: true },
    ], c, { maxRounds: 30 }, 12345);
    while (s.phase !== 'gameOver' && s.round <= 60) {
      s = applyAction(s, chooseBotAction(s, c), c);
      for (const p of s.players) expect(p.position).toBeLessThan(28);
    }
    expect(s.phase).toBe('gameOver');
  });

  it('il seme dà sempre la stessa partita', () => {
    setBoard('valle');
    const c = ctx();
    const play = () => {
      let s = createGame([{ name: 'A', isBot: true }, { name: 'B', isBot: true }], c, { maxRounds: 10 }, 777);
      while (s.phase !== 'gameOver' && s.round <= 20) s = applyAction(s, chooseBotAction(s, c), c);
      return s.players.map((p) => p.money);
    };
    expect(play()).toEqual(play());
    expect(seededRng(1)()).toBe(seededRng(1)());
  });
});

describe('salvataggio col tabellone', () => {
  it('il tabellone sta nel file e si rilegge', () => {
    setBoard('valle');
    const c: GameContext = { board, cards };
    const game = createGame([{ name: 'A' }, { name: 'B', isBot: true }], c, {}, 5);
    const file = newSave(game, currentBoard());
    expect(file.board).toBe('valle');
    const text = JSON.stringify(file);
    expect(fileBoard(JSON.parse(text))).toBe('valle');
    const read = readSave(JSON.parse(text), c, 1);
    expect(read?.board).toBe('valle');
  });

  it('un salvataggio vecchio senza tabellone vale su quello predefinito', () => {
    const c: GameContext = { board, cards };
    const game = createGame([{ name: 'A' }, { name: 'B', isBot: true }], c, {}, 5);
    const file = newSave(game);
    expect(file.board).toBeUndefined();
    expect(fileBoard(JSON.parse(JSON.stringify(file)))).toBeUndefined();
    expect(fileBoard(null)).toBeUndefined();
    expect(fileBoard({ board: 7 })).toBeUndefined();
  });
});

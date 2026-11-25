// Editor di tabelloni (B59): controllo dei dati, salvataggio nel browser, file e link.
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { BOARDS, DEFAULT_BOARD, board, boardChoice, cards, currentBoard, currentChoice, customBoards, removeCustomBoard, setBoard } from '../src/data';
import { applyAction, cardRoles, chooseBotAction, createGame, readSave, validateBoard, withPrice, type BoardData, type GameContext, type PropertySpace } from '../src/engine';
import { cardText, setLang, spaceName, t, type MsgKey } from '../src/i18n';
import { adoptBoard, boardFileText, boardId, decodeBoard, deleteCustomBoard, encodeBoard, linkCode, loadCustomBoards, readBoardText, saveCustomBoard, savedBoards, shareLink, BOARDS_KEY } from '../src/ui/boardStore';
import { issueText } from '../src/ui/boardEditor';
import { GameSession } from '../src/ui/session';

class MemoryStorage {
  data = new Map<string, string>();
  getItem(k: string) {
    return this.data.get(k) ?? null;
  }
  setItem(k: string, v: string) {
    this.data.set(k, v);
  }
  removeItem(k: string) {
    this.data.delete(k);
  }
}

const base = (): BoardData => structuredClone(boardChoice('valle').data);
const mine = (title = 'Il mio paese'): BoardData => ({ ...base(), title });
const codes = (raw: unknown) => {
  const r = validateBoard(raw, cards);
  return r.ok ? [] : r.errors.map((e) => e.code);
};

beforeEach(() => {
  (globalThis as { localStorage?: unknown }).localStorage = new MemoryStorage();
  setBoard(DEFAULT_BOARD);
  setLang('it');
});
afterEach(() => {
  for (const b of [...customBoards()]) removeCustomBoard(b.id);
  setBoard(DEFAULT_BOARD);
});

describe('controllo del tabellone', () => {
  it.each(BOARDS.map((b) => b.id))('i tabelloni del gioco passano (%s)', (id) => {
    const r = validateBoard(boardChoice(id).data, cards);
    expect(r.ok ? [] : r.errors).toEqual([]);
  });

  it('restituisce una copia pulita, senza campi sconosciuti', () => {
    const raw = { ...mine(), extra: '<script>', spaces: base().spaces.map((s) => ({ ...s, onclick: 'x' })) };
    const r = validateBoard(raw, cards);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect('extra' in r.data).toBe(false);
    expect(r.data.spaces.every((s) => !('onclick' in s))).toBe(true);
    expect(r.data.title).toBe('Il mio paese');
  });

  it('non è un tabellone', () => {
    expect(codes(null)).toEqual(['notBoard']);
    expect(codes({ spaces: [] })).toEqual(['notBoard']);
    expect(codes([1, 2])).toEqual(['notBoard']);
  });

  it('niente codice HTML nei nomi, negli id e nei colori', () => {
    const b = mine();
    b.spaces[1].name = '<img src=x onerror=alert(1)>';
    expect(codes(b)).toContain('spaceName');
    const c = mine('Un "titolo"');
    expect(codes(c)).toContain('title');
    const d = mine();
    d.groups[0].color = 'red;background:url(x)';
    expect(codes(d)).toContain('groupColor');
    const e = mine();
    (e.spaces[1] as { id: string }).id = 'a" onmouseover="x';
    expect(codes(e)).toContain('spaceId');
    // l'apostrofo resta permesso
    const f = mine("Viale dell'Arte");
    expect(codes(f)).toEqual([]);
  });

  it('nomi vuoti o troppo lunghi', () => {
    const b = mine();
    b.spaces[1].name = '   ';
    b.groups[0].name = 'x'.repeat(41);
    expect(codes(b)).toEqual(expect.arrayContaining(['spaceName', 'groupName']));
  });

  it('numero di caselle e angoli', () => {
    const b = mine();
    b.spaces.pop();
    expect(codes(b)).toEqual(['length']);
    const c = mine();
    // una via all'angolo della prigione
    const n = c.spaces.length / 4;
    [c.spaces[n], c.spaces[n + 1]] = [c.spaces[n + 1], c.spaces[n]];
    expect(codes(c)).toContain('corner');
  });

  it('caselle obbligatorie e uniche', () => {
    const b = mine();
    b.spaces[0] = { ...b.spaces[0], type: 'free' } as never;
    expect(codes(b)).toEqual(expect.arrayContaining(['firstStart', 'oneOf']));
    const c = mine();
    (c.spaces[3] as { id: string }).id = c.spaces[1].id;
    expect(codes(c)).toContain('spaceDup');
  });

  it('valori fuori misura, affitti non crescenti, ipoteca troppo alta', () => {
    const b = mine();
    const p = b.spaces.find((s) => s.type === 'property') as PropertySpace;
    p.rent = [5, 4, 30, 60, 90, 120];
    p.mortgage = p.price;
    b.startingMoney = 5;
    const out = codes(b);
    expect(out).toEqual(expect.arrayContaining(['rentOrder', 'mortgage', 'startingMoney']));
    const c = mine();
    (c.spaces.find((s) => s.type === 'property') as PropertySpace).price = 1e9;
    expect(codes(c)).toContain('spaceValue');
  });

  it('quartieri: esistenti, con almeno due vie, colori diversi', () => {
    const b = mine();
    b.groups[1].color = b.groups[0].color;
    expect(codes(b)).toContain('colorDup');
    const c = mine();
    (c.spaces.find((s) => s.type === 'property') as PropertySpace).group = 'nessuno';
    expect(codes(c)).toEqual(expect.arrayContaining(['spaceGroup', 'groupSmall']));
  });

  it('le carte "vai a" devono trovare la loro casella', () => {
    expect(cardRoles(cards).length).toBeGreaterThan(0);
    const b = mine();
    delete b.targets;
    expect(codes(b)).toContain('target');
  });

  it('ogni errore ha la sua frase nelle due lingue', () => {
    const all = ['notBoard', 'notJson', 'notLink', 'title', 'startingMoney', 'currency', 'groupId', 'groupName', 'groupColor', 'noGroups', 'groupDup', 'colorDup', 'length', 'spaceType', 'spaceId', 'spaceName', 'spaceValue', 'spaceDup', 'firstStart', 'oneOf', 'corner', 'mortgage', 'spaceGroup', 'rentOrder', 'groupSmall', 'stations', 'utilities', 'target'];
    for (const lang of ['it', 'en'] as const) {
      setLang(lang);
      for (const code of all) {
        const text = issueText({ code, id: 'x', n: 3 });
        expect(text, code).not.toBe(`boardErr.${code}`);
        expect(text).not.toContain('{');
      }
    }
    expect(t('boardErr.length' as MsgKey, { n: 7 })).toContain('7');
  });
});

describe('prezzi', () => {
  it('cambiando il prezzo affitti e ipoteca seguono, e restano crescenti', () => {
    const p = base().spaces.find((s) => s.type === 'property') as PropertySpace;
    const q = withPrice(p, p.price * 2);
    expect(q.price).toBe(p.price * 2);
    expect(q.mortgage).toBe(p.price);
    expect(q.housePrice).toBe(p.housePrice);
    expect(q.rent[5]).toBe(p.rent[5] * 2);
    const tiny = withPrice(p, 5);
    for (let i = 1; i < 6; i++) expect(tiny.rent[i]).toBeGreaterThan(tiny.rent[i - 1]);
    // l'originale non cambia
    expect(withPrice(p, p.price)).toBe(p);
    expect(p.price).not.toBe(q.price);
  });
});

describe('tabelloni salvati nel browser', () => {
  it('si salvano, si ritrovano dopo un riavvio e si eliminano', () => {
    const id = saveCustomBoard(validated(mine()));
    expect(id).toMatch(/^mio-/);
    expect(id).toBe(boardId(validated(mine())));
    expect(savedBoards().map((b) => b.id)).toEqual([id]);
    // "riavvio": la memoria del gioco si svuota e si rilegge il browser
    removeCustomBoard(id);
    expect(boardChoice(id).id).toBe(DEFAULT_BOARD);
    loadCustomBoards();
    expect(boardChoice(id).data.title).toBe('Il mio paese');
    deleteCustomBoard(id);
    expect(savedBoards()).toEqual([]);
    expect(boardChoice(id).id).toBe(DEFAULT_BOARD);
  });

  it('salvando una modifica il tabellone nuovo prende il posto del vecchio', () => {
    const a = saveCustomBoard(validated(mine('Primo')));
    const b = saveCustomBoard(validated(mine('Secondo')), a);
    expect(a).not.toBe(b);
    expect(savedBoards().map((x) => x.data.title)).toEqual(['Secondo']);
  });

  it('i dati rovinati nel browser si saltano', () => {
    localStorage.setItem(BOARDS_KEY, JSON.stringify([{ id: 'mio-x', data: { spaces: 3 } }, { id: 'citta', data: base() }, 'boh']));
    loadCustomBoards();
    expect(customBoards()).toEqual([]);
    localStorage.setItem(BOARDS_KEY, '{rotto');
    loadCustomBoards();
    expect(customBoards()).toEqual([]);
  });

  it('con un tabellone dell\'editor i nomi vengono dai suoi dati', () => {
    const data = validated(mine());
    data.spaces[1].name = 'Vicolo Nuovo';
    data.groups[0].name = 'Rione Alto';
    const id = saveCustomBoard(data);
    setBoard(id);
    expect(currentChoice().custom).toBe(true);
    expect(spaceName(data.spaces[1].id)).toBe('Vicolo Nuovo');
    setLang('en');
    expect(spaceName(data.spaces[1].id)).toBe('Vicolo Nuovo');
    // le carte che nominano una casella usano il nome nuovo
    const lusso = data.spaces.find((s) => s.id === data.targets!.lusso)!;
    lusso.name = 'Belvedere';
    setLang('it');
    expect(cardText('sorte-02')).toContain('Belvedere');
    // tornando al tabellone del gioco tornano i nomi di sempre
    setBoard('valle');
    expect(spaceName(data.spaces[1].id)).toBe(boardChoice('valle').data.spaces[1].name);
  });
});

describe('file e link', () => {
  it('il file esportato si reimporta uguale', () => {
    const data = validated(mine());
    const r = readBoardText(boardFileText(data));
    expect(r.ok && r.data).toEqual(data);
    // va bene anche il JSON del tabellone da solo
    expect(readBoardText(JSON.stringify(data)).ok).toBe(true);
    expect(readBoardText('non json')).toEqual({ ok: false, errors: [{ code: 'notJson' }] });
    expect(readBoardText('{"kind":"sdrogopoli-tabellone","board":{}}').ok).toBe(false);
  });

  it('il link porta il tabellone intero, compresso', async () => {
    const data = validated(mine());
    const code = await encodeBoard(data);
    expect(code[0]).toBe('z');
    expect(code).toMatch(/^[A-Za-z0-9_-]+$/);
    // molto più corto del JSON
    expect(code.length).toBeLessThan(JSON.stringify(data).length / 2);
    const back = await decodeBoard(code);
    expect(back.ok && back.data).toEqual(data);
    const link = await shareLink(data, 'https://esempio.it/sdrogopoli/');
    expect(link.startsWith('https://esempio.it/sdrogopoli/#tabellone=z')).toBe(true);
    expect(linkCode(link.slice(link.indexOf('#')))).toBe(code);
  });

  it('un link rovinato non rompe niente', async () => {
    const code = await encodeBoard(validated(mine()));
    for (const bad of [code.slice(0, 40), `x${code.slice(1)}`, 'z!!!', 'j' + btoa('{"spaces":1}')]) {
      const r = await decodeBoard(bad);
      expect(r.ok, bad.slice(0, 10)).toBe(false);
    }
    expect(linkCode('#tavolo=ABC234')).toBeNull();
    expect(linkCode('#tabellone=')).toBeNull();
  });
});

describe('partite su un tabellone dell\'editor', () => {
  it('si gioca fino alla fine, e il salvataggio si porta dietro il tabellone', () => {
    const data = validated(mine());
    data.startingMoney = 900;
    const id = saveCustomBoard(data);
    const ctx: GameContext = { board, cards };
    const session = new GameSession(ctx);
    setBoard(id);
    ctx.board = board;
    let s = createGame(['Ada', 'Bea', 'Ciro'], ctx, { maxRounds: 15 }, 11);
    expect(s.players[0].money).toBe(900);
    session.start(s);
    for (let i = 0; i < 4000 && s.phase !== 'gameOver'; i++) s = applyAction(s, chooseBotAction(s, ctx), ctx);
    expect(s.phase).toBe('gameOver');
    session.state = s;
    const file = session.toFile()!;
    expect(file.board).toBe(id);
    expect(file.boardData).toEqual(data);

    // su un altro dispositivo, senza il tabellone salvato: lo prende dal file
    deleteCustomBoard(id);
    setBoard(DEFAULT_BOARD);
    const other = new GameSession({ board, cards });
    const read = readSave(JSON.parse(JSON.stringify(file)), { board, cards }, 1)!;
    other.open(read);
    expect(currentBoard()).toBe(id);
    expect(board.startingMoney).toBe(900);
    // ma non finisce tra i tabelloni salvati di chi la riceve
    expect(savedBoards()).toEqual([]);
  });

  it('un tabellone non valido dentro una partita non si usa', () => {
    expect(adoptBoard('mio-falso', { spaces: 2 })).toBeUndefined();
    expect(adoptBoard('valle', { spaces: 2 })).toBe('valle');
    expect(adoptBoard(undefined, undefined)).toBeUndefined();
  });
});

function validated(data: BoardData): BoardData {
  const r = validateBoard(data, cards);
  if (!r.ok) throw new Error(JSON.stringify(r.errors));
  return r.data;
}

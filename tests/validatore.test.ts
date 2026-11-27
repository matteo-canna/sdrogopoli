// Controlli extra nel validatore dei tabelloni (compito 15): avvisi ed errori.
import { afterEach, describe, expect, it } from 'vitest';
import { BOARDS, boardChoice, cards } from '../src/data';
import { MAX_TAG_NAME, validateBoard, type BoardData, type PropertySpace, type StationSpace } from '../src/engine';
import { setLang } from '../src/i18n';
import { issueText } from '../src/ui/boardEditor';

// Tabellone di partenza pulito (con nomi entro 28 caratteri) per provare un avviso alla volta.
function cleanBoard(): BoardData {
  const b = structuredClone(boardChoice('valle').data);
  for (const s of b.spaces) {
    if (s.name.length > MAX_TAG_NAME) s.name = s.name.slice(0, MAX_TAG_NAME);
  }
  return b;
}

afterEach(() => setLang('it'));

describe('controlli extra del validatore dei tabelloni', () => {
  it('un tabellone pulito passa senza errori né avvisi', () => {
    const r = validateBoard(cleanBoard(), cards);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.warnings).toEqual([]);
  });

  it('segnala affitti non crescenti sulle vie (compreso palazzo minore di 4 case)', () => {
    const b = cleanBoard();
    const p = b.spaces.find((s) => s.type === 'property') as PropertySpace;
    p.rent = [10, 20, 40, 80, 120, 100];
    const r = validateBoard(b, cards);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors.map((e) => e.code)).toContain('rentOrder');
  });

  it('avvisa se gli affitti di una fermata non sono crescenti senza bloccare il tabellone', () => {
    const b = cleanBoard();
    const st = b.spaces.find((s) => s.type === 'station') as StationSpace;
    st.rent = [25, 50, 50, 100];
    const r = validateBoard(b, cards);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.warnings).toEqual([{ code: 'stationRentOrder', id: st.id }]);
  });

  it('avvisa se il costo di una casa supera la via più cara del quartiere', () => {
    const b = cleanBoard();
    const p = b.spaces.find((s) => s.type === 'property') as PropertySpace;
    const maxInGroup = Math.max(
      ...b.spaces.filter((s): s is PropertySpace => s.type === 'property' && s.group === p.group).map((s) => s.price),
    );
    p.housePrice = maxInGroup + 10;
    const r = validateBoard(b, cards);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.warnings).toEqual([{ code: 'houseCost', id: p.id, n: p.housePrice }]);
  });

  it('avvisa se due caselle (non carte) hanno lo stesso nome', () => {
    const b = cleanBoard();
    const props = b.spaces.filter((s) => s.type === 'property');
    props[1].name = props[0].name.toUpperCase();
    const r = validateBoard(b, cards);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.warnings).toEqual([{ code: 'nameDup', id: props[0].name, n: 2 }]);
  });

  it('segnala un quartiere con una sola via', () => {
    const b = cleanBoard();
    // il primo quartiere di Valle Stretta ha 2 vie: spostandone una nell'altro resta con 1 sola via
    const firstGroup = b.groups[0].id;
    const secondGroup = b.groups[1].id;
    const prop = b.spaces.find((s): s is PropertySpace => s.type === 'property' && s.group === firstGroup)!;
    prop.group = secondGroup;
    const r = validateBoard(b, cards);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors).toContainEqual({ code: 'groupSmall', id: firstGroup, n: 1 });
  });

  it('avvisa se il nome di una casella supera i 28 caratteri, ma non a 28 esatti', () => {
    const b = cleanBoard();
    b.spaces[1].name = 'a'.repeat(MAX_TAG_NAME);
    const exact = validateBoard(b, cards);
    expect(exact.ok && exact.warnings).toEqual([]);

    b.spaces[1].name = 'a'.repeat(MAX_TAG_NAME + 1);
    const tooLong = validateBoard(b, cards);
    expect(tooLong.ok).toBe(true);
    if (tooLong.ok) expect(tooLong.warnings).toEqual([{ code: 'longName', id: b.spaces[1].id, n: MAX_TAG_NAME + 1 }]);
  });

  it('ogni nuovo avviso ha la sua frase in italiano e in inglese', () => {
    const codes = ['stationRentOrder', 'houseCost', 'nameDup', 'longName'];
    for (const lang of ['it', 'en'] as const) {
      setLang(lang);
      for (const code of codes) {
        const text = issueText({ code, id: 'x', n: 30 });
        expect(text, `${lang}:${code}`).not.toBe(`boardErr.${code}`);
        expect(text).not.toContain('{');
      }
    }
  });

  it.each(BOARDS.map((b) => b.id))('i tabelloni di BOARDS passano senza errori né avvisi di struttura (%s)', (id) => {
    const r = validateBoard(boardChoice(id).data, cards);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    // Nessun avviso su costi case, nomi doppi o affitti fermate; eventuali longName noti sono segnalati a parte.
    const nonLength = r.warnings.filter((w) => w.code !== 'longName');
    expect(nonLength).toEqual([]);
  });
});

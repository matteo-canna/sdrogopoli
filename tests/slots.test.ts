import { beforeEach, describe, expect, it } from 'vitest';
import { board, cards } from '../src/data';
import { createGame, newSave } from '../src/engine';
import { deleteSlot, fileName, listSlots, MAX_SLOTS, parseSaveText, saveSlot } from '../src/ui/slots';

const ctx = { board, cards };

// memoria del browser finta, con un limite di spazio da provare
class MemoryStorage {
  data = new Map<string, string>();
  limit = Infinity;
  getItem(k: string) {
    return this.data.get(k) ?? null;
  }
  setItem(k: string, v: string) {
    if (v.length > this.limit) throw new Error('QuotaExceededError');
    this.data.set(k, v);
  }
  removeItem(k: string) {
    this.data.delete(k);
  }
}
let storage: MemoryStorage;
beforeEach(() => {
  storage = new MemoryStorage();
  (globalThis as { localStorage?: unknown }).localStorage = storage;
});

const file = () => newSave(createGame(['Ada', 'Bea'], ctx, {}, 7));

describe('partite salvate', () => {
  it('ne tiene fino a cinque, la più recente per prima', () => {
    for (let i = 0; i < MAX_SLOTS; i++) expect(saveSlot(`P${i}`, file(), 1000 + i).ok).toBe(true);
    expect(listSlots().map((s) => s.name)).toEqual(['P4', 'P3', 'P2', 'P1', 'P0']);
    const full = saveSlot('Sesta', file(), 2000);
    expect(full.ok).toBe(false);
    // con lo stesso nome (anche con maiuscole diverse) si sovrascrive
    expect(saveSlot('p2', file(), 3000).ok).toBe(true);
    expect(listSlots()).toHaveLength(MAX_SLOTS);
    expect(listSlots()[0].name).toBe('p2');
  });

  it('si eliminano e il riassunto dice giro e giocatori', () => {
    saveSlot('Una', file(), 1);
    expect(listSlots()[0].summary).toBe('Giro 1 · Ada, Bea');
    deleteSlot(listSlots()[0].id);
    expect(listSlots()).toEqual([]);
  });

  it('dice quando il browser è pieno', () => {
    storage.limit = 10;
    const r = saveSlot('Grande', file(), 1);
    expect(r.ok).toBe(false);
  });

  it('un file esportato si reimporta uguale; un file qualsiasi no', () => {
    const f = file();
    const back = parseSaveText(JSON.stringify(f), ctx, 1)!;
    expect(back.state.players.map((p) => p.name)).toEqual(['Ada', 'Bea']);
    expect(back.state.rngState).toBe(f.state.rngState);
    expect(parseSaveText('{"ciao":1}', ctx, 1)).toBeNull();
    expect(parseSaveText('non è json', ctx, 1)).toBeNull();
  });

  it('nome del file senza accenti né spazi', () => {
    expect(fileName('Partita di Natale à 3!')).toBe('partita-di-natale-a-3.folle');
    expect(fileName('  ')).toBe('partita.folle');
  });
});

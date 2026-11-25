// Partite salvate con un nome (fino a cinque) ed esportate in un file .sdrogo da reimportare.
// La partita in corso si salva comunque da sola: questi sono salvataggi in più, scelti da chi gioca.
import { readSave, type GameContext, type GameState, type SaveFile } from '../engine';
import { KEYS, readPref } from './prefs';
import { getLang, t } from '../i18n';

export const MAX_SLOTS = 5;
export const FILE_EXT = '.sdrogo';

export interface Slot {
  id: string;
  name: string;
  // millisecondi dal 1970, come Date.now()
  date: number;
  // una riga per riconoscerla: giro e giocatori
  summary: string;
  file: SaveFile;
}

export function listSlots(): Slot[] {
  try {
    const list = JSON.parse(readPref(KEYS.slots) ?? '[]');
    return Array.isArray(list) ? list.filter((s) => s && typeof s.id === 'string' && s.file) : [];
  } catch {
    return [];
  }
}

function store(list: Slot[]): boolean {
  try {
    localStorage.setItem(KEYS.slots, JSON.stringify(list));
    return true;
  } catch {
    // memoria del browser piena o non disponibile
    return false;
  }
}

export function slotSummary(state: GameState): string {
  const names = state.players.map((p) => p.name).join(', ');
  return state.phase === 'gameOver' ? `${t('game.over')} · ${names}` : `${t('round.n', { n: state.round })} · ${names}`;
}

export function defaultSlotName(now = new Date()): string {
  const locale = getLang() === 'it' ? 'it-IT' : 'en-GB';
  return t('slots.defaultName', { date: now.toLocaleDateString(locale, { day: 'numeric', month: 'long' }), time: now.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' }) });
}

// Salva una copia della partita. Con lo stesso nome sovrascrive; con cinque salvataggi pieni rifiuta.
export function saveSlot(name: string, file: SaveFile, now = Date.now()): { ok: true } | { ok: false; reason: string } {
  const list = listSlots();
  const clean = name.trim().slice(0, 60) || defaultSlotName(new Date(now));
  const same = list.findIndex((s) => s.name.toLowerCase() === clean.toLowerCase());
  if (same < 0 && list.length >= MAX_SLOTS) return { ok: false, reason: t('slots.full', { n: MAX_SLOTS }) };
  const slot: Slot = { id: same >= 0 ? list[same].id : `s${now.toString(36)}`, name: clean, date: now, summary: slotSummary(file.state), file };
  if (same >= 0) list.splice(same, 1);
  list.unshift(slot);
  return store(list) ? { ok: true } : { ok: false, reason: t('slots.noSpace') };
}

export function deleteSlot(id: string): void {
  store(listSlots().filter((s) => s.id !== id));
}

// Legge un file esportato (o un vecchio salvataggio): null se non è una partita di Sdrogopoli.
export function parseSaveText(text: string, ctx: GameContext, seed: number): SaveFile | null {
  try {
    return readSave(JSON.parse(text), ctx, seed);
  } catch {
    return null;
  }
}

export function fileName(name: string): string {
  const base = name.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-zA-Z0-9]+/g, '-').replace(/^-|-$/g, '').toLowerCase();
  return `${base || 'partita'}${FILE_EXT}`;
}

// Scarica la partita come file .sdrogo.
export function downloadSave(name: string, file: SaveFile): void {
  const blob = new Blob([JSON.stringify(file)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName(name);
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

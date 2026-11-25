// Tabelloni fatti con l'editor: si salvano nel browser, si esportano in un file, si condividono
// con un link. Niente server: il link porta il tabellone intero, compresso, dopo il "#".
// Ogni tabellone ha un id preso dal suo contenuto ("mio-…"): lo stesso tabellone arrivato due
// volte non si doppia, e una partita salvata trova sempre la versione su cui è stata giocata.
import { addCustomBoard, boardChoice, cards, customBoards, isBuiltinBoard, removeCustomBoard } from '../data';
import { validateBoard, type BoardCheck, type BoardData } from '../engine';
import { readPref, writePref } from './prefs';

export const BOARDS_KEY = 'sdrogopoli-tabelloni';
export const BOARD_FILE_EXT = '.sdrogo-tabellone';
export const LINK_PARAM = 'tabellone';
// quanti tabelloni si tengono nel browser
export const MAX_CUSTOM = 12;

interface Stored {
  id: string;
  data: BoardData;
}

// FNV-1a a 32 bit: corto, stabile, basta per distinguere due tabelloni.
function hash(text: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(36);
}

export function boardId(data: BoardData): string {
  return `mio-${hash(JSON.stringify(data))}`;
}

function stored(): Stored[] {
  try {
    const raw: unknown = JSON.parse(readPref(BOARDS_KEY) ?? '[]');
    return Array.isArray(raw) ? (raw as Stored[]) : [];
  } catch {
    return [];
  }
}

function store(list: Stored[]): void {
  writePref(BOARDS_KEY, JSON.stringify(list.slice(-MAX_CUSTOM)));
}

// All'avvio: i tabelloni salvati nel browser diventano sceglibili. Quelli rovinati si saltano.
export function loadCustomBoards(): void {
  for (const s of stored()) {
    const check = validateBoard(s.data, cards);
    if (check.ok && typeof s.id === 'string' && s.id.startsWith('mio-')) addCustomBoard(s.id, check.data);
  }
}

// I tabelloni salvati nel browser (non quelli arrivati solo con una partita).
export function savedBoards(): { id: string; data: BoardData }[] {
  const ids = new Set(stored().map((s) => s.id));
  return customBoards().filter((b) => ids.has(b.id)).map((b) => ({ id: b.id, data: b.data }));
}

// Salva un tabellone già controllato. "replaces" è quello che si stava modificando: lo prende
// il nuovo. Restituisce l'id del tabellone salvato.
export function saveCustomBoard(data: BoardData, replaces?: string): string {
  const id = boardId(data);
  const list = stored().filter((s) => s.id !== id && s.id !== replaces);
  list.push({ id, data });
  store(list);
  if (replaces && replaces !== id) removeCustomBoard(replaces);
  addCustomBoard(id, data);
  return id;
}

export function deleteCustomBoard(id: string): void {
  store(stored().filter((s) => s.id !== id));
  removeCustomBoard(id);
}

// Un tabellone che arriva dentro una partita salvata o importata: si rende sceglibile per quella
// partita (senza salvarlo tra i propri). Restituisce l'id da usare.
export function adoptBoard(id: string | undefined, data: unknown): string | undefined {
  if (!id || isBuiltinBoard(id) || data === undefined) return id;
  if (boardChoice(id).id === id) return id;
  const check = validateBoard(data, cards);
  if (!check.ok) return undefined;
  addCustomBoard(id, check.data);
  return id;
}

// File da scaricare: si riconosce dal campo "kind".
export function boardFileText(data: BoardData): string {
  return JSON.stringify({ kind: 'sdrogopoli-tabellone', version: 1, board: data }, null, 2);
}

// Legge un file di tabellone (o il JSON di un tabellone scritto a mano) e lo controlla.
export function readBoardText(text: string): BoardCheck {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return { ok: false, errors: [{ code: 'notJson' }] };
  }
  if (raw && typeof raw === 'object' && (raw as { kind?: unknown }).kind === 'sdrogopoli-tabellone') raw = (raw as { board?: unknown }).board;
  return validateBoard(raw, cards);
}

// ---- link ----
// "z" + base64url del JSON compresso (deflate-raw), oppure "j" + base64url del JSON dove il
// browser non sa comprimere.

function toBase64Url(bytes: Uint8Array): string {
  let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromBase64Url(text: string): Uint8Array {
  const bin = atob(text.replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from(bin, (c) => c.charCodeAt(0));
}

async function pipe(bytes: Uint8Array, stream: CompressionStream | DecompressionStream): Promise<Uint8Array> {
  const out = new Response(new Blob([bytes as Uint8Array<ArrayBuffer>]).stream().pipeThrough(stream));
  return new Uint8Array(await out.arrayBuffer());
}

const canCompress = () => typeof CompressionStream === 'function' && typeof DecompressionStream === 'function';

export async function encodeBoard(data: BoardData): Promise<string> {
  const bytes = new TextEncoder().encode(JSON.stringify(data));
  if (canCompress()) return `z${toBase64Url(await pipe(bytes, new CompressionStream('deflate-raw')))}`;
  return `j${toBase64Url(bytes)}`;
}

// Un link non valido (troncato, modificato) dà un errore "notLink" invece di lanciare.
export async function decodeBoard(code: string): Promise<BoardCheck> {
  try {
    const body = fromBase64Url(code.slice(1));
    let bytes: Uint8Array;
    if (code[0] === 'z' && canCompress()) bytes = await pipe(body, new DecompressionStream('deflate-raw'));
    else if (code[0] === 'j') bytes = body;
    else return { ok: false, errors: [{ code: 'notLink' }] };
    return readBoardText(new TextDecoder().decode(bytes));
  } catch {
    return { ok: false, errors: [{ code: 'notLink' }] };
  }
}

export async function shareLink(data: BoardData, base = `${location.origin}${location.pathname}`): Promise<string> {
  return `${base}#${LINK_PARAM}=${await encodeBoard(data)}`;
}

// Il codice del tabellone nell'indirizzo della pagina, se c'è.
export function linkCode(hash: string): string | null {
  const m = new RegExp(`^#${LINK_PARAM}=([A-Za-z0-9_-]+)$`).exec(hash);
  return m ? m[1] : null;
}

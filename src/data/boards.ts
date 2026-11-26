// I tabelloni disponibili. Ognuno ha i suoi dati e i nomi inglesi delle caselle che si traducono
// (le vie e i quartieri sono nomi propri e restano in italiano, come sul tabellone grande).
// Le carte sono le stesse per tutti: puntano alle caselle per "ruolo" (vedi "targets" nei JSON).
import type { BoardData } from '../engine/types';
import cittaJson from './board.json';
import cittaEn from './board.en.json';
import valleJson from './board.valle.json';
import valleEn from './board.valle.en.json';
import isolaJson from './board.isola.json';
import isolaEn from './board.isola.en.json';

export interface BoardChoice {
  id: string;
  data: BoardData;
  // nomi inglesi delle caselle, per id
  names: Record<string, string>;
  // fatto con l'editor: i nomi stanno nei dati (data.title, nomi di caselle e quartieri)
  custom?: boolean;
}

export const BOARDS: BoardChoice[] = [
  { id: 'citta', data: cittaJson as BoardData, names: cittaEn as Record<string, string> },
  { id: 'valle', data: valleJson as BoardData, names: valleEn as Record<string, string> },
  { id: 'isola', data: isolaJson as BoardData, names: isolaEn as Record<string, string> },
];

export const DEFAULT_BOARD = BOARDS[0].id;

// I tabelloni fatti con l'editor (salvati nel browser, arrivati da un link o dentro una partita).
let custom: BoardChoice[] = [];

export function customBoards(): BoardChoice[] {
  return custom;
}

// Aggiunge o sostituisce un tabellone fatto con l'editor. Chi lo chiama l'ha già controllato.
export function addCustomBoard(id: string, data: BoardData): BoardChoice {
  const choice: BoardChoice = { id, data, names: {}, custom: true };
  custom = [...custom.filter((b) => b.id !== id), choice];
  return choice;
}

export function removeCustomBoard(id: string): void {
  custom = custom.filter((b) => b.id !== id);
}

export function isBuiltinBoard(id: string | undefined | null): boolean {
  return BOARDS.some((b) => b.id === id);
}

// Il tabellone con questo id; se non esiste (salvataggio vecchio o rovinato) quello predefinito.
export function boardChoice(id: string | undefined | null): BoardChoice {
  return BOARDS.find((b) => b.id === id) ?? custom.find((b) => b.id === id) ?? BOARDS[0];
}

// I tabelloni disponibili. Ognuno ha i suoi dati e i nomi inglesi delle caselle che si traducono
// (le vie e i quartieri sono nomi propri e restano in italiano, come sul tabellone grande).
// Le carte sono le stesse per tutti: puntano alle caselle per "ruolo" (vedi "targets" nei JSON).
import type { BoardData } from '../engine/types';
import cittaJson from './board.json';
import cittaEn from './board.en.json';
import valleJson from './board.valle.json';
import valleEn from './board.valle.en.json';

export interface BoardChoice {
  id: string;
  data: BoardData;
  // nomi inglesi delle caselle, per id
  names: Record<string, string>;
}

export const BOARDS: BoardChoice[] = [
  { id: 'citta', data: cittaJson as BoardData, names: cittaEn as Record<string, string> },
  { id: 'valle', data: valleJson as BoardData, names: valleEn as Record<string, string> },
];

export const DEFAULT_BOARD = BOARDS[0].id;

// Il tabellone con questo id; se non esiste (salvataggio vecchio o rovinato) quello predefinito.
export function boardChoice(id: string | undefined | null): BoardChoice {
  return BOARDS.find((b) => b.id === id) ?? BOARDS[0];
}

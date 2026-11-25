// Carica i dati di gioco con i tipi corretti.
// "board" è il tabellone della partita in corso: si cambia con setBoard() prima di iniziare.
// È un collegamento vivo (export let), quindi chi fa `import { board }` vede sempre quello scelto:
// per questo non si copia il tabellone in una costante al caricamento del modulo.
import type { BoardData, CardsData } from '../engine/types';
import cardsJson from './cards.json';
import { boardChoice, DEFAULT_BOARD } from './boards';

export { BOARDS, DEFAULT_BOARD, boardChoice, type BoardChoice } from './boards';

export const cards = cardsJson as CardsData;

export let board: BoardData = boardChoice(DEFAULT_BOARD).data;
let current = DEFAULT_BOARD;

// Scegli il tabellone della prossima partita. Restituisce i suoi dati.
export function setBoard(id: string | undefined | null): BoardData {
  const choice = boardChoice(id);
  current = choice.id;
  board = choice.data;
  return board;
}

// L'id del tabellone in uso (va nel salvataggio, così la partita riprende su quello giusto).
export function currentBoard(): string {
  return current;
}

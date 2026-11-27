// Carica i dati di gioco con i tipi corretti.
// "board" è il tabellone della partita in corso: si cambia con setBoard() prima di iniziare.
// È un collegamento vivo (export let), quindi chi fa `import { board }` vede sempre quello scelto:
// per questo non si copia il tabellone in una costante al caricamento del modulo.
import type { BoardData, CardsData } from '../engine/types';
import cardsJson from './cards.json';
import cantiereJson from './cards.cantiere.json';
import cantiereEnJson from './cards.cantiere.en.json';
import { boardChoice, DEFAULT_BOARD, type BoardChoice } from './boards';

export { BOARDS, DEFAULT_BOARD, addCustomBoard, boardChoice, customBoards, isBuiltinBoard, removeCustomBoard, type BoardChoice } from './boards';

export const cards = cardsJson as CardsData;
export const cantiereCards = cantiereJson as CardsData;
export const cantiereCardsEn = cantiereEnJson as Record<string, { text: string; options?: string[] }>;

export let board: BoardData = boardChoice(DEFAULT_BOARD).data;
let current: BoardChoice = boardChoice(DEFAULT_BOARD);

// Scegli il tabellone della prossima partita. Restituisce i suoi dati.
export function setBoard(id: string | undefined | null): BoardData {
  const choice = boardChoice(id);
  current = choice;
  board = choice.data;
  return board;
}

// L'id del tabellone in uso (va nel salvataggio, così la partita riprende su quello giusto).
export function currentBoard(): string {
  return current.id;
}

// Il tabellone in uso con i suoi nomi (serve per sapere se è uno fatto con l'editor).
export function currentChoice(): BoardChoice {
  return current;
}

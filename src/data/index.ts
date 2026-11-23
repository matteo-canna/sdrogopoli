// Carica i dati di gioco con i tipi corretti.
import type { BoardData, CardsData } from '../engine/types';
import boardJson from './board.json';
import cardsJson from './cards.json';

export const board = boardJson as BoardData;
export const cards = cardsJson as CardsData;

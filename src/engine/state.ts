// Stato della partita e creazione di una nuova partita.
import type { BoardData, CardsData, DeckId } from './types';
import type { Rng } from './dice';

export interface Player {
  id: number;
  name: string;
  money: number;
  position: number;
  inJail: boolean;
  // tentativi falliti di uscire dalla Caserma con un doppio
  jailAttempts: number;
  // carte "esci gratis" possedute (id delle carte)
  jailCards: string[];
  bankrupt: boolean;
  // true se il giocatore è controllato dal computer
  isBot: boolean;
}

// Configurazione di un giocatore alla creazione della partita.
export interface PlayerSetup {
  name: string;
  isBot?: boolean;
}

export interface Ownership {
  owner: number;
  // 0-4 case, 5 = palazzo
  houses: number;
  mortgaged: boolean;
}

// Fase del turno del giocatore corrente.
//  - 'roll': deve lanciare i dadi
//  - 'buy': è finito su una proprietà libera e deve decidere se comprarla
//  - 'endTurn': ha finito di muoversi e può gestire le proprietà o passare il turno
export type Phase = 'roll' | 'buy' | 'endTurn' | 'gameOver';

export interface GameState {
  players: Player[];
  current: number;
  phase: Phase;
  ownership: Record<string, Ownership>;
  // numero di doppi consecutivi nel turno corrente
  doublesInRow: number;
  lastRoll: [number, number] | null;
  // true se il giocatore ha fatto un doppio e deve rilanciare dopo aver risolto la casella
  extraRoll: boolean;
  // mazzi: id delle carte in ordine di pesca
  decks: Record<DeckId, string[]>;
  // creditore del debito in corso (null = la banca), se il giocatore ha soldi negativi
  creditor: number | null;
  winner: number | null;
  log: string[];
}

// Contesto immutabile della partita: dati del tabellone, carte e generatore casuale.
export interface GameContext {
  board: BoardData;
  cards: CardsData;
  rng: Rng;
}

export const JAIL_FINE = 50;
export const MAX_JAIL_ATTEMPTS = 3;
export const MIN_PLAYERS = 2;
export const MAX_PLAYERS = 4;

// Mescola un array con l'algoritmo di Fisher-Yates usando l'RNG iniettato.
export function shuffle<T>(items: T[], rng: Rng): T[] {
  const a = [...items];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function createGame(players: (string | PlayerSetup)[], ctx: GameContext): GameState {
  const setups = players.map((p) => (typeof p === 'string' ? { name: p } : p));
  if (setups.length < MIN_PLAYERS || setups.length > MAX_PLAYERS) {
    throw new Error(`Servono da ${MIN_PLAYERS} a ${MAX_PLAYERS} giocatori`);
  }
  const deckIds = Object.keys(ctx.cards.decks) as DeckId[];
  const decks = {} as Record<DeckId, string[]>;
  for (const d of deckIds) {
    decks[d] = shuffle(
      ctx.cards.cards.filter((c) => c.deck === d).map((c) => c.id),
      ctx.rng,
    );
  }
  return {
    players: setups.map((setup, id) => ({
      id,
      name: setup.name,
      isBot: setup.isBot ?? false,
      money: ctx.board.startingMoney,
      position: 0,
      inJail: false,
      jailAttempts: 0,
      jailCards: [],
      bankrupt: false,
    })),
    current: 0,
    phase: 'roll',
    ownership: {},
    doublesInRow: 0,
    lastRoll: null,
    extraRoll: false,
    decks,
    creditor: null,
    winner: null,
    log: ['Inizia la partita!'],
  };
}

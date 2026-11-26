// Tipi dei dati di gioco (corrispondono ai file JSON in src/data).

export interface PropertySpace {
  type: 'property';
  id: string;
  name: string;
  group: string;
  price: number;
  housePrice: number;
  // affitto: [terreno, 1 casa, 2 case, 3 case, 4 case, palazzo]
  rent: [number, number, number, number, number, number];
  mortgage: number;
}

export interface StationSpace {
  type: 'station';
  id: string;
  name: string;
  price: number;
  mortgage: number;
  // affitto in base al numero di fermate possedute (1-4)
  rent: [number, number, number, number];
}

export interface UtilitySpace {
  type: 'utility';
  id: string;
  name: string;
  price: number;
  mortgage: number;
  // moltiplicatore del lancio di dadi con 1 o 2 servizi posseduti
  diceMultiplier: [number, number];
}

export type Space =
  | PropertySpace
  | StationSpace
  | UtilitySpace
  | { type: 'start'; id: string; name: string; salary: number }
  | { type: 'card'; id: string; name: string; deck: DeckId }
  | { type: 'tax'; id: string; name: string; amount: number }
  | { type: 'jail'; id: string; name: string }
  | { type: 'free'; id: string; name: string }
  | { type: 'goToJail'; id: string; name: string };

export interface Group {
  id: string;
  name: string;
  color: string;
}

export interface BoardData {
  // nome di un tabellone fatto con l'editor (quelli del gioco hanno il nome nelle traduzioni)
  title?: string;
  currency: { name: string; plural: string; symbol: string };
  startingMoney: number;
  // Caselle a cui puntano le carte, per ruolo ("lusso", "studio", "partenza"): così lo stesso
  // mazzo vale su ogni tabellone. Chi non li dichiara usa gli id delle caselle così come sono.
  targets?: Record<string, string>;
  groups: Group[];
  spaces: Space[];
}

export type DeckId = 'sorte' | 'quartiere' | 'cantiere';

export type CardEffect =
  | { kind: 'moveTo'; space: string }
  | { kind: 'moveBy'; steps: number }
  | { kind: 'moveToNearest'; spaceType: 'station' | 'utility' }
  | { kind: 'gain'; amount: number }
  | { kind: 'pay'; amount: number }
  | { kind: 'payEachPlayer'; amount: number }
  | { kind: 'collectFromEachPlayer'; amount: number }
  | { kind: 'goToJail' }
  | { kind: 'getOutOfJailFree' }
  | { kind: 'repairs'; perHouse: number; perHotel: number }
  // carta con scelta: chi la pesca sceglie una delle opzioni
  | { kind: 'choice'; options: CardOption[] };

export interface CardOption {
  label: string;
  effect: Exclude<CardEffect, { kind: 'choice' }>;
}

export interface Card {
  id: string;
  deck: DeckId;
  text: string;
  effect: CardEffect;
}

export interface CardsData {
  decks: Partial<Record<DeckId, { name: string }>>;
  cards: Card[];
}

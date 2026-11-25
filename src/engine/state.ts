// Stato della partita e creazione di una nuova partita.
import type { BoardData, CardsData, DeckId } from './types';
import { rngStep, type Rng } from './dice';

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
  // aspetto della pedina scelto all'inizio (solo grafica: il motore lo conserva e basta)
  appearance?: Appearance;
  // livello e carattere del computer (assente = normale ed equilibrato)
  bot?: BotProfile;
}

export type BotLevel = 'facile' | 'normale' | 'difficile';
export type BotStyle = 'equilibrato' | 'costruttore' | 'collezionista' | 'prudente' | 'mercante';
export interface BotProfile {
  level: BotLevel;
  style: BotStyle;
}

// Aspetto del personaggio-pedina. Il motore non lo usa nelle regole.
export interface Appearance {
  // personaggio (es. 'knight', 'mage')
  character: string;
  // colore del giocatore, in formato '#rrggbb'
  color: string;
  // copricapo (elmo, cappello…) visibile
  hat: boolean;
  // mantello visibile
  cape: boolean;
  // oggetto in mano ('' = niente)
  item: string;
}

// Regole della casa scelte all'inizio della partita.
export interface GameRules {
  // soldi di ogni giocatore all'inizio
  startingMoney: number;
  // numero massimo di giri (null = senza limite): alla fine vince il patrimonio più alto
  maxRounds: number | null;
  // tasse e multe finiscono sulla Panchina del Parco: chi ci si ferma le incassa
  parkPot: boolean;
  // soldi in più per ogni posto dopo il primo (compensa il vantaggio di chi inizia)
  seatBonus: number;
  // partita rapida: ogni giocatore riceve subito alcune proprietà a caso
  quickStart: boolean;
  // modalità demo sperimentale: si può giocare fino a DEMO_MAX_PLAYERS
  demo: boolean;
}

// Bonus consigliato per chi gioca dopo: con 4 giocatori il primo vince circa quanto gli altri.
export const SEAT_BONUS = 30;
// Proprietà regalate a ciascuno nella partita rapida.
export const QUICK_START_PROPERTIES = 3;
// In due la partita normale dura molto (mediana 68 giri su 1.000 simulazioni): la preparazione
// propone la partita rapida, con 4 proprietà a testa. Mediana 36 giri, vittorie 48% e 52%.
export const QUICK_START_TWO_PLAYERS = 4;

// Proprietà regalate a testa nella partita rapida: in tanti non bastano per tutti (22 proprietà, 8×3 = 24),
// quindi se serve se ne danno meno, sempre lo stesso numero a ognuno.
export function quickStartProperties(board: BoardData, playerCount: number): number {
  const wanted = playerCount === 2 ? QUICK_START_TWO_PLAYERS : QUICK_START_PROPERTIES;
  const total = board.spaces.filter((sp) => sp.type === 'property').length;
  return Math.min(wanted, Math.floor(total / Math.max(1, playerCount)));
}

export function defaultRules(board: BoardData): GameRules {
  return { startingMoney: board.startingMoney, maxRounds: null, parkPot: false, seatBonus: SEAT_BONUS, quickStart: false, demo: false };
}

// Configurazione di un giocatore alla creazione della partita.
export interface PlayerSetup {
  name: string;
  isBot?: boolean;
  appearance?: Appearance;
  bot?: BotProfile;
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
//  - 'auction': la casella rifiutata va all'asta tra tutti i giocatori
export type Phase = 'roll' | 'buy' | 'auction' | 'endTurn' | 'gameOver';

// Asta in corso: i giocatori rilanciano a turno, chi passa esce dall'asta.
export interface Auction {
  spaceId: string;
  highestBid: number;
  highestBidder: number | null;
  // giocatori ancora in gara, nell'ordine in cui rilanciano
  bidders: number[];
  // indice in "bidders" di chi deve rispondere ora
  turn: number;
  // aste in serie dopo una bancarotta verso la banca: caselle ancora da mettere all'asta
  queue?: string[];
}

// Parte di uno scambio: soldi e caselle che un giocatore cede.
export interface TradeSide {
  money: number;
  spaces: string[];
}

// Proposta di scambio del giocatore di turno ("from") a un altro giocatore ("to").
export interface TradeOffer {
  from: number;
  to: number;
  give: TradeSide;
  get: TradeSide;
  // controproposte già fatte in questa trattativa
  counters?: number;
}

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
  auction: Auction | null;
  trade: TradeOffer | null;
  // il computer propone al massimo uno scambio per turno
  tradeProposedThisTurn: boolean;
  rules: GameRules;
  // seme della partita e stato attuale del generatore casuale (assenti nei salvataggi più vecchi)
  seed?: number;
  rngState?: number;
  // giro attuale: aumenta ogni volta che il turno torna al primo giocatore
  round: number;
  // soldi accumulati sulla Panchina del Parco (regola della casa)
  pot: number;
  winner: number | null;
  log: string[];
  // numero totale di eventi registrati (il registro tiene solo gli ultimi)
  eventCount: number;
  // statistiche per giocatore, per il riepilogo di fine partita
  stats: PlayerStats[];
  // patrimonio di ogni giocatore all'inizio di ogni giro (history[giro][giocatore])
  history: number[][];
}

// Numeri raccolti durante la partita per il riepilogo finale.
export interface PlayerStats {
  rentPaid: number;
  rentReceived: number;
  taxesPaid: number;
  // proprietà comprate (anche all'asta)
  bought: number;
  // case e palazzi costruiti
  built: number;
  jailVisits: number;
  doubles: number;
  // scambi conclusi
  trades: number;
  // giro della bancarotta (null se non è fallito)
  bankruptRound: number | null;
}

export function emptyStats(): PlayerStats {
  return { rentPaid: 0, rentReceived: 0, taxesPaid: 0, bought: 0, built: 0, jailVisits: 0, doubles: 0, trades: 0, bankruptRound: null };
}

// Contesto immutabile della partita: dati del tabellone, carte e generatore casuale.
// Senza "rng" il motore usa il generatore della partita (seme in state.seed, stato in state.rngState):
// stesso seme e stesse azioni danno sempre la stessa partita. I test passano un rng per decidere i dadi.
export interface GameContext {
  board: BoardData;
  cards: CardsData;
  rng?: Rng;
}

// Generatore legato allo stato: ogni numero estratto aggiorna state.rngState.
export function stateRng(state: GameState): Rng {
  return () => {
    const [value, next] = rngStep(state.rngState ?? state.seed ?? 0);
    state.rngState = next;
    return value;
  };
}

// Contesto con il generatore sempre presente: quello passato dai test o quello della partita.
export function withRng(ctx: GameContext, state: GameState): GameContext & { rng: Rng } {
  return { ...ctx, rng: ctx.rng ?? stateRng(state) };
}

export const JAIL_FINE = 50;
export const MAX_JAIL_ATTEMPTS = 3;
export const MIN_PLAYERS = 2;
// Fino a 8 giocatori: ci sono 8 colori e le pedine stanno ancora in una casella.
export const MAX_PLAYERS = 8;
// Nella modalità demo (sperimentale) si arriva a 12.
export const DEMO_MAX_PLAYERS = 12;

// Regole proposte nella modalità demo. In 12 una partita senza limite dura circa 29 giri, cioè il doppio
// dei turni di una partita in 4: con 20 giri (vince il patrimonio più alto) si torna a una durata simile
// a quella in 8. Simulazione con 200 partite tra 12 computer: tutte finite, vittorie per posto tra 5% e 13%
// (atteso 8%), circa 2 quartieri completati al giro 10 grazie agli scambi.
export const DEMO_ROUNDS = 20;
export const DEMO_SEAT_BONUS = 20;
export function demoRules(): Partial<GameRules> {
  return { demo: true, maxRounds: DEMO_ROUNDS, seatBonus: DEMO_SEAT_BONUS };
}

// Numero massimo di giocatori con queste regole.
export function maxPlayers(rules: Pick<GameRules, 'demo'>): number {
  return rules.demo ? DEMO_MAX_PLAYERS : MAX_PLAYERS;
}

// Mescola un array con l'algoritmo di Fisher-Yates usando l'RNG iniettato.
export function shuffle<T>(items: T[], rng: Rng): T[] {
  const a = [...items];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// "seed" rende la partita ripetibile: con lo stesso seme mazzi, proprietà iniziali e dadi sono uguali.
export function createGame(players: (string | PlayerSetup)[], gameCtx: GameContext, rules: Partial<GameRules> = {}, seed = 0): GameState {
  const holder = { seed: seed >>> 0, rngState: seed >>> 0 } as GameState;
  const ctx = withRng(gameCtx, holder);
  const fullRules = { ...defaultRules(ctx.board), ...rules };
  const setups = players.map((p) => (typeof p === 'string' ? { name: p } : p));
  const max = maxPlayers(fullRules);
  if (setups.length < MIN_PLAYERS || setups.length > max) {
    throw new Error(`Servono da ${MIN_PLAYERS} a ${max} giocatori`);
  }
  const deckIds = Object.keys(ctx.cards.decks) as DeckId[];
  const decks = {} as Record<DeckId, string[]>;
  for (const d of deckIds) {
    decks[d] = shuffle(
      ctx.cards.cards.filter((c) => c.deck === d).map((c) => c.id),
      ctx.rng,
    );
  }
  const state: GameState = {
    players: setups.map((setup, id) => ({
      id,
      name: setup.name,
      isBot: setup.isBot ?? false,
      ...(setup.appearance ? { appearance: { ...setup.appearance } } : {}),
      ...(setup.isBot && setup.bot ? { bot: { ...setup.bot } } : {}),
      money: fullRules.startingMoney + id * fullRules.seatBonus,
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
    auction: null,
    trade: null,
    tradeProposedThisTurn: false,
    rules: fullRules,
    round: 1,
    pot: 0,
    winner: null,
    log: ['Inizia la partita!'],
    eventCount: 1,
    stats: setups.map(() => emptyStats()),
    history: [],
    seed: holder.seed,
    rngState: holder.rngState,
  };
  if (fullRules.quickStart) dealProperties(state, ctx);
  state.rngState = holder.rngState;
  state.history.push(state.players.map((p) => p.money + startingAssets(state, ctx, p.id)));
  return state;
}

// Valore delle proprietà regalate nella partita rapida (0 nelle partite normali).
function startingAssets(state: GameState, ctx: GameContext, playerId: number): number {
  return ctx.board.spaces.reduce((sum, sp) => (state.ownership[sp.id]?.owner === playerId && 'price' in sp ? sum + sp.price : sum), 0);
}

// Partita rapida: distribuisce a turno proprietà scelte a caso, senza costi.
function dealProperties(state: GameState, ctx: GameContext & { rng: Rng }): void {
  const ids = shuffle(
    ctx.board.spaces.filter((sp) => sp.type === 'property').map((sp) => sp.id),
    ctx.rng,
  );
  const each = quickStartProperties(ctx.board, state.players.length);
  let k = 0;
  for (let round = 0; round < each; round++) {
    for (const p of state.players) state.ownership[ids[k++]] = { owner: p.id, houses: 0, mortgaged: false };
  }
  state.log.push(`Partita rapida: ognuno riceve ${each} proprietà a caso.`);
  state.eventCount++;
}

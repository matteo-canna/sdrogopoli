// Salvataggio della partita: stato attuale, stato iniziale e registro di tutte le azioni.
// Con lo stato iniziale (che contiene il seme) e il registro si può rigiocare la partita
// passo per passo e arrivare allo stesso stato: serve per annullare, rivedere e controllare.
import { applyAction, type Action } from './rules';
import { defaultRules, type GameContext, type GameState } from './state';

// Versioni del salvataggio:
//  1: solo lo stato della partita, senza campo "version" (fino a novembre 2026)
//  2: { version, initial, actions, state }, con seme e stato del generatore nello stato
export const SAVE_VERSION = 2;

export interface SaveFile {
  version: number;
  // stato da cui ripartire per rigiocare il registro
  initial: GameState;
  actions: Action[];
  state: GameState;
}

// Completa uno stato salvato da una versione precedente del gioco con i campi aggiunti dopo.
// "seed" serve solo se lo stato non ha ancora un generatore proprio.
export function migrateState(raw: GameState, ctx: GameContext, seed: number): GameState {
  const s = structuredClone(raw);
  s.auction ??= null;
  s.trade ??= null;
  s.rules ??= defaultRules(ctx.board);
  s.round ??= 1;
  s.pot ??= 0;
  s.tradeProposedThisTurn ??= false;
  s.stats ??= [];
  s.history ??= [];
  s.eventCount ??= s.log?.length ?? 0;
  if (s.rngState === undefined) {
    s.seed ??= seed >>> 0;
    s.rngState = s.seed;
  }
  return s;
}

function looksLikeState(x: unknown): x is GameState {
  return !!x && typeof x === 'object' && Array.isArray((x as GameState).players) && typeof (x as GameState).phase === 'string';
}

// Legge un salvataggio di qualsiasi versione. Restituisce null se è rovinato o di una versione futura.
export function readSave(raw: unknown, ctx: GameContext, seed: number): SaveFile | null {
  if (!raw || typeof raw !== 'object') return null;
  const version = (raw as { version?: unknown }).version;
  if (version === undefined) {
    // versione 1: lo stato da solo. Il registro parte da qui.
    if (!looksLikeState(raw)) return null;
    const state = migrateState(raw, ctx, seed);
    return { version: SAVE_VERSION, initial: structuredClone(state), actions: [], state };
  }
  if (version !== 2) return null;
  const file = raw as SaveFile;
  if (!looksLikeState(file.state) || !looksLikeState(file.initial) || !Array.isArray(file.actions)) return null;
  return {
    version: SAVE_VERSION,
    initial: migrateState(file.initial, ctx, seed),
    actions: file.actions,
    state: migrateState(file.state, ctx, seed),
  };
}

export function newSave(initial: GameState): SaveFile {
  return { version: SAVE_VERSION, initial: structuredClone(initial), actions: [], state: initial };
}

// Rigioca il registro dallo stato iniziale. Il contesto non deve avere un "rng" proprio:
// i dadi vengono dal generatore salvato nello stato.
export function replay(initial: GameState, actions: Action[], ctx: GameContext): GameState {
  let s = initial;
  for (const a of actions) s = applyAction(s, a, ctx);
  return s;
}

// Azioni che una persona può annullare: non estraggono numeri a caso e non coinvolgono
// altri giocatori. Non si torna mai prima di un lancio dei dadi.
const UNDOABLE = new Set<Action['type']>(['buy', 'build', 'sell', 'mortgage', 'unmortgage', 'payJailFine', 'useJailCard']);
export function isUndoable(action: Action): boolean {
  return UNDOABLE.has(action.type);
}

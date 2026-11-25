// Messaggi tra i dispositivi di una partita online. Chi ha creato il tavolo (l'"oste") tiene la
// partita vera: gli altri mandano solo le loro mosse e ricevono lo stato aggiornato.
import type { Action, GameState } from '../engine';

export const PROTOCOL_VERSION = 1;

// Da un ospite all'oste.
export type ToHost =
  | { t: 'hello'; v: number; name: string }
  | { t: 'action'; action: Action; seq: number };

// Dall'oste agli ospiti.
export type ToGuest =
  // posto assegnato (null = tavolo pieno o partita già iniziata: si guarda soltanto)
  | { t: 'welcome'; seat: number | null }
  // stato completo dopo ogni mossa; "n" conta le mosse, così si scartano messaggi vecchi
  | { t: 'state'; state: GameState; n: number }
  // mossa rifiutata (non è il tuo turno, regola violata…)
  | { t: 'rejected'; seq: number; reason: string }
  | { t: 'bye'; reason: string };

export type NetMessage = ToHost | ToGuest;

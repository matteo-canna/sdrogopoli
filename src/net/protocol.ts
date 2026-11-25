// Messaggi tra i dispositivi di una partita online. Chi ha creato il tavolo (l'"oste") tiene la
// partita vera: gli altri mandano solo le loro mosse e ricevono lo stato aggiornato.
import type { Action, Appearance, GameState } from '../engine';

export const PROTOCOL_VERSION = 1;

// Chi siede al tavolo prima dell'inizio.
export interface Member {
  id: string;
  name: string;
  look: Appearance | null;
  ready: boolean;
  host: boolean;
}

// Da un ospite all'oste.
export type ToHost =
  // "key" resta uguale se la pagina si ricarica: serve a riprendere il proprio posto
  | { t: 'hello'; v: number; name: string; look: Appearance | null; key?: string }
  | { t: 'ready'; ready: boolean; name: string; look: Appearance | null }
  | { t: 'action'; action: Action; seq: number }
  // reazione o frase pronta (solo l'id, vedi chat.ts)
  | { t: 'say'; id: string };

// Dall'oste agli ospiti.
export type ToGuest =
  // chi c'è al tavolo prima dell'inizio
  | { t: 'lobby'; members: Member[]; computers: number; you?: string }
  // posto assegnato (null = si guarda soltanto)
  | { t: 'welcome'; seat: number | null }
  // stato completo dopo ogni mossa; "n" conta le mosse, così si scartano messaggi vecchi
  | { t: 'state'; state: GameState; n: number; action: Action | null }
  // mossa rifiutata (non è il tuo turno, regola violata…)
  | { t: 'rejected'; seq: number; reason: string }
  // posti scollegati, posti mossi dal computer perché il tempo è scaduto, tempo per ogni mossa
  | { t: 'presence'; offline: number[]; away: number[]; limitMs: number | null }
  | { t: 'said'; seat: number; id: string }
  | { t: 'bye'; reason: string };

export type NetMessage = ToHost | ToGuest;

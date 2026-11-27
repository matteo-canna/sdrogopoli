// Messaggi tra i dispositivi di una partita online. Chi ha creato il tavolo (l'"oste") tiene la
// partita vera: gli altri mandano solo le loro mosse e ricevono lo stato aggiornato.
import type { Action, Appearance, GameState } from '../engine';
import type { MsgKey, Params } from '../i18n';

// 2: registro e motivi dei rifiuti come frasi da tradurre (chiave e valori)
export const PROTOCOL_VERSION = 2;

// Tempo massimo per rispondere alla proposta di rivincita: chi non risponde passa al computer.
export const REMATCH_TIMEOUT_MS = 30_000;

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
  | { t: 'say'; id: string }
  // risposta di un ospite alla proposta di rivincita a fine partita
  | { t: 'rematchReply'; accept: boolean };

// Dall'oste agli ospiti.
export type ToGuest =
  // chi c'è al tavolo prima dell'inizio
  | { t: 'lobby'; members: Member[]; computers: number; you?: string }
  // posto assegnato (null = si guarda soltanto)
  | { t: 'welcome'; seat: number | null }
  // stato completo dopo ogni mossa; "n" conta le mosse, così si scartano messaggi vecchi
  | { t: 'state'; state: GameState; n: number; action: Action | null }
  // mossa rifiutata (non è il tuo turno, regola violata…)
  // reason è il testo in italiano; key e p la frase da mostrare nella lingua di chi la riceve
  | { t: 'rejected'; seq: number; reason: string; key?: MsgKey; p?: Params }
  // posti scollegati, posti mossi dal computer perché il tempo è scaduto, tempo per ogni mossa
  | { t: 'presence'; offline: number[]; away: number[]; limitMs: number | null }
  | { t: 'said'; seat: number; id: string }
  // proposta di rivincita a fine partita: chi ha accettato, chi ha rifiutato e chi deve ancora rispondere
  | { t: 'rematch'; accepted: number[]; declined: number[]; pending: number[]; timeoutMs: number }
  | { t: 'bye'; reason: string; key?: MsgKey; p?: Params };

export type NetMessage = ToHost | ToGuest;

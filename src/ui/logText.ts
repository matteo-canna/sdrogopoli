// Esportazione del registro della partita in testo semplice, nella lingua scelta.
import type { GameState } from '../engine';
import { format, type Lang, type MsgKey } from '../i18n';

// Trasforma una singola voce del registro nella lingua richiesta.
function formatEntry(line: GameState['log'][number], lang: Lang): string {
  if (line && typeof line === 'object') {
    return format(lang, line.k as MsgKey, line.p && typeof line.p === 'object' ? line.p : undefined);
  }
  return String(line ?? '');
}

// Restituisce il registro della partita come righe "Giro N · Giocatore · testo tradotto"
// (o "Round N · Player · translated text" in inglese). Funzione pura, senza DOM.
export function logToText(state: GameState, lang: Lang): string {
  if (!state.log.length) return '';

  // Conta i cambi di giro presenti nel registro per allinearsi a state.round anche su stati parziali.
  let totalWraps = 0;
  let scanIdx = -1;
  let scanSeen = false;
  for (const line of state.log) {
    if (line && typeof line === 'object' && line.k === 'log.turn' && line.p?.name !== undefined) {
      const idx = state.players.findIndex((p) => p.name === String(line.p!.name));
      if (idx >= 0) {
        if (scanSeen && idx <= scanIdx) totalWraps++;
        scanIdx = idx;
        scanSeen = true;
      }
    }
  }

  let round = Math.max(1, state.round - totalWraps);
  let lastIdx = -1;
  let seenTurn = false;
  let activePlayer = state.players[0]?.name ?? '';
  const out: string[] = [];

  for (const line of state.log) {
    let who = activePlayer;
    if (line && typeof line === 'object') {
      if (line.k === 'log.turn' && line.p?.name !== undefined) {
        const name = String(line.p.name);
        const idx = state.players.findIndex((p) => p.name === name);
        if (idx >= 0) {
          if (seenTurn && idx <= lastIdx) round++;
          lastIdx = idx;
          seenTurn = true;
        }
        activePlayer = name;
        who = name;
      } else if (line.p?.name !== undefined) {
        who = String(line.p.name);
      }
    }
    const text = formatEntry(line, lang);
    const roundLabel = format(lang, 'log.roundLabel', { n: round });
    out.push(who ? `${roundLabel} · ${who} · ${text}` : `${roundLabel} · ${text}`);
  }

  return out.join('\n');
}

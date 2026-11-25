// Sceglie il suono adatto confrontando lo stato prima e dopo un'azione.
import { actingPlayer, type Action, type GameState } from '../engine';
import type { Sfx } from './audio';

export function soundFor(prev: GameState, next: GameState, action: Action): Sfx | null {
  // le frasi nuove del registro (le partite vecchie hanno righe di testo, le nuove una chiave)
  const fresh = next.log.slice(-Math.max((next.eventCount ?? 0) - (prev.eventCount ?? 0), 0));
  const has = (key: string, old: string) => fresh.some((l) => (typeof l === 'string' ? l.includes(old) : l.k === key));
  const actor = prev.players[actingPlayer(prev)];
  const after = next.players[actor.id];
  if (next.phase === 'gameOver') return 'win';
  if (!actor.inJail && after.inJail) return 'jail';
  if (has('log.draws', 'pesca')) return 'card';
  if (action.type === 'bid' || has('log.auctionWon', "vince l'asta")) return 'gavel';
  if (action.type === 'buy' || action.type === 'build' || action.type === 'acceptTrade') return 'buy';
  if (action.type === 'roll') {
    if (after.money < actor.money) return 'pay';
    if (after.money > actor.money) return 'coin';
    return 'dice';
  }
  if (after.money > actor.money) return 'coin';
  if (after.money < actor.money) return 'pay';
  return null;
}

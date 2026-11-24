// Sceglie il suono adatto confrontando lo stato prima e dopo un'azione.
import { actingPlayer, type Action, type GameState } from '../engine';
import type { Sfx } from './audio';

export function soundFor(prev: GameState, next: GameState, action: Action): Sfx | null {
  const fresh = next.log.slice(-Math.max((next.eventCount ?? 0) - (prev.eventCount ?? 0), 0)).join(' ');
  const actor = prev.players[actingPlayer(prev)];
  const after = next.players[actor.id];
  if (next.phase === 'gameOver') return 'win';
  if (!actor.inJail && after.inJail) return 'jail';
  if (fresh.includes('pesca')) return 'card';
  if (action.type === 'bid' || fresh.includes("vince l'asta")) return 'gavel';
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

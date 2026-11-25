// Tutorial: consigli brevi che compaiono la prima volta che una persona incontra una situazione.
// Niente codice grafico: sceglie solo quale consiglio mostrare, così si può provare con i test.
import { actingPlayer, ownsWholeGroup, type GameContext, type GameState } from '../engine';
import { t, type MsgKey } from '../i18n';

export interface Tip {
  id: string;
  title: string;
  text: string;
}

// In ordine di importanza: se valgono più consigli insieme si mostra il primo.
const TIPS: { tip: { id: string }; when: (s: GameState, ctx: GameContext, me: number) => boolean }[] = [
  {
    tip: {
      id: 'debt',
    },
    when: (s, _c, me) => s.players[me].money < 0,
  },
  {
    tip: {
      id: 'jail',
    },
    when: (s, _c, me) => s.players[me].inJail && s.phase === 'roll',
  },
  {
    tip: {
      id: 'auction',
    },
    when: (s) => s.phase === 'auction',
  },
  {
    tip: {
      id: 'buy',
    },
    when: (s) => s.phase === 'buy',
  },
  {
    tip: {
      id: 'doubles',
    },
    when: (s) => s.phase === 'roll' && s.extraRoll && !!s.lastRoll && s.lastRoll[0] === s.lastRoll[1],
  },
  {
    tip: {
      id: 'group',
    },
    when: (s, ctx, me) =>
      s.phase === 'endTurn' &&
      ctx.board.groups.some((g) => ownsWholeGroup(s, ctx, me, g.id)),
  },
  {
    tip: {
      id: 'owned',
    },
    when: (s, _c, me) => s.phase === 'endTurn' && Object.values(s.ownership).some((o) => o.owner === me),
  },
  {
    tip: {
      id: 'trade',
    },
    when: (s) => s.phase === 'endTurn' && s.round >= 3,
  },
  {
    tip: {
      id: 'start',
    },
    when: (s) => s.phase === 'roll' && s.round === 1,
  },
];

export const TIP_IDS = TIPS.map((x) => x.tip.id);

// Consiglio da mostrare ora alla persona di turno (null se non ce n'è o tocca al computer).
export function tutorialTip(state: GameState, ctx: GameContext, seen: ReadonlySet<string>): Tip | null {
  if (state.phase === 'gameOver' || state.trade) return null;
  const me = actingPlayer(state);
  if (state.players[me].isBot) return null;
  const found = TIPS.find((x) => !seen.has(x.tip.id) && x.when(state, ctx, me))?.tip;
  return found ? { id: found.id, title: t(`tip.${found.id}.title` as MsgKey), text: t(`tip.${found.id}.text` as MsgKey) } : null;
}

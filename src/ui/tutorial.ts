// Tutorial: consigli brevi che compaiono la prima volta che una persona incontra una situazione.
// Niente codice grafico: sceglie solo quale consiglio mostrare, così si può provare con i test.
import { actingPlayer, ownsWholeGroup, type GameContext, type GameState } from '../engine';

export interface Tip {
  id: string;
  title: string;
  text: string;
}

// In ordine di importanza: se valgono più consigli insieme si mostra il primo.
const TIPS: { tip: Tip; when: (s: GameState, ctx: GameContext, me: number) => boolean }[] = [
  {
    tip: {
      id: 'debt',
      title: 'Sei in debito',
      text: 'Per pagare puoi vendere case o ipotecare proprietà: tocca una tua casella e usa i pulsanti nella scheda. Se non basta, devi dichiarare bancarotta.',
    },
    when: (s, _c, me) => s.players[me].money < 0,
  },
  {
    tip: {
      id: 'jail',
      title: 'Sei in Caserma',
      text: 'Puoi pagare 50 per uscire subito, usare una carta "esci gratis" se ce l\'hai, oppure provare a fare un doppio con i dadi. Dopo tre tentativi falliti paghi comunque.',
    },
    when: (s, _c, me) => s.players[me].inJail && s.phase === 'roll',
  },
  {
    tip: {
      id: 'auction',
      title: "All'asta!",
      text: 'Nessuno ha comprato la casella e ora tutti possono fare un\'offerta. A turno si rilancia o si passa: vince chi offre di più quando gli altri hanno passato.',
    },
    when: (s) => s.phase === 'auction',
  },
  {
    tip: {
      id: 'buy',
      title: 'Una proprietà libera',
      text: 'Puoi comprarla al prezzo indicato. Chi ci si ferma dopo ti pagherà l\'affitto. Se non la compri, va all\'asta tra tutti i giocatori.',
    },
    when: (s) => s.phase === 'buy',
  },
  {
    tip: {
      id: 'doubles',
      title: 'Doppio!',
      text: 'Con due dadi uguali tiri un\'altra volta. Attenzione: al terzo doppio di fila finisci in Caserma.',
    },
    when: (s) => s.phase === 'roll' && s.extraRoll && !!s.lastRoll && s.lastRoll[0] === s.lastRoll[1],
  },
  {
    tip: {
      id: 'group',
      title: 'Hai tutto il quartiere',
      text: 'Ora l\'affitto dei terreni è doppio e puoi costruire. Tocca una casella del quartiere e scegli "Costruisci": le case vanno messe in modo uniforme, una per via alla volta.',
    },
    when: (s, ctx, me) =>
      s.phase === 'endTurn' &&
      ctx.board.groups.some((g) => ownsWholeGroup(s, ctx, me, g.id)),
  },
  {
    tip: {
      id: 'owned',
      title: 'La tua prima proprietà',
      text: 'Le proprietà si vedono nel tuo riquadro e con un bordino del tuo colore sul tabellone. Completa un quartiere dello stesso colore per raddoppiare gli affitti e costruire case.',
    },
    when: (s, _c, me) => s.phase === 'endTurn' && Object.values(s.ownership).some((o) => o.owner === me),
  },
  {
    tip: {
      id: 'trade',
      title: 'Scambi',
      text: 'Con "Proponi scambio" puoi offrire soldi e proprietà agli altri giocatori, anche al computer. È il modo più rapido per completare un quartiere.',
    },
    when: (s) => s.phase === 'endTurn' && s.round >= 3,
  },
  {
    tip: {
      id: 'start',
      title: 'Benvenuto a Sdrogopoli!',
      text: 'Compra vie, costruisci case e fai pagare gli affitti: vince chi resta con dei soldi quando gli altri sono in bancarotta. Tocca "Lancia i dadi" per muovere il tuo personaggio.',
    },
    when: (s) => s.phase === 'roll' && s.round === 1,
  },
];

export const TIP_IDS = TIPS.map((t) => t.tip.id);

// Consiglio da mostrare ora alla persona di turno (null se non ce n'è o tocca al computer).
export function tutorialTip(state: GameState, ctx: GameContext, seen: ReadonlySet<string>): Tip | null {
  if (state.phase === 'gameOver' || state.trade) return null;
  const me = actingPlayer(state);
  if (state.players[me].isBot) return null;
  return TIPS.find((t) => !seen.has(t.tip.id) && t.when(state, ctx, me))?.tip ?? null;
}

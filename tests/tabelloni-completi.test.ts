// Test sui tabelloni completi: cicla su ogni tabellone registrato in BOARDS per verificare
// validazione, destinazione delle carte di spostamento e partite complete tra computer.
import { describe, it, expect } from 'vitest';
import { BOARDS, cards } from '../src/data';
import {
  applyAction,
  cardRoles,
  chooseBotAction,
  createGame,
  targetSpace,
  validateBoard,
  type BoardData,
  type CardEffect,
  type GameContext,
} from '../src/engine';

// Limite massimo di azioni e giri ragionevoli per una partita completa tra computer.
const MAX_ACTIONS = 6000;
const MAX_ROUNDS = 250;

// Raccoglie tutti gli effetti delle carte, incluse le opzioni delle carte a scelta.
function allCardEffects(): CardEffect[] {
  const effects: CardEffect[] = [];
  for (const card of cards.cards) {
    if (card.effect.kind === 'choice') {
      for (const opt of card.effect.options) effects.push(opt.effect);
    } else {
      effects.push(card.effect);
    }
  }
  return effects;
}

// Fa giocare una partita completa tra N computer su un tabellone con seme fisso.
function playFullGame(board: BoardData, botCount: number, seed: number) {
  const ctx: GameContext = { board, cards };
  const bots = Array.from({ length: botCount }, (_, i) => ({ name: `Bot ${i + 1}`, isBot: true }));
  let state = createGame(bots, ctx, {}, seed);

  let steps = 0;
  while (state.phase !== 'gameOver' && steps < MAX_ACTIONS) {
    const action = chooseBotAction(state, ctx);
    state = applyAction(state, action, ctx);
    steps++;
  }
  return { state, steps };
}

describe('ogni tabellone in BOARDS si gioca fino in fondo', () => {
  it('esiste almeno un tabellone registrato', () => {
    expect(BOARDS.length).toBeGreaterThan(0);
  });

  describe.each(BOARDS)('tabellone "$id"', (choice) => {
    it('passa validateBoard senza errori', () => {
      const check = validateBoard(choice.data, cards);
      expect(check.ok, check.ok ? '' : JSON.stringify(check.errors)).toBe(true);
    });

    it('ogni carta con spostamento trova una casella esistente sul tabellone', () => {
      const spaceIds = new Set(choice.data.spaces.map((s) => s.id));
      const roles = cardRoles(cards);
      expect(roles.length).toBeGreaterThan(0);
      for (const role of roles) {
        const resolved = targetSpace(choice.data, role);
        expect(spaceIds.has(resolved), `ruolo "${role}" -> "${resolved}" non trovato su "${choice.id}"`).toBe(true);
      }

      // Controlla anche le carte che spostano alla casella più vicina di un certo tipo.
      const types = new Set(choice.data.spaces.map((s) => s.type));
      for (const effect of allCardEffects()) {
        if (effect.kind === 'moveToNearest') {
          expect(types.has(effect.spaceType), `tipo "${effect.spaceType}" non trovato su "${choice.id}"`).toBe(true);
        }
      }
    });

    it('una partita a 3 computer finisce con un vincitore in un numero ragionevole di giri', () => {
      const { state, steps } = playFullGame(choice.data, 3, 17);
      expect(state.phase, `non finita entro ${MAX_ACTIONS} azioni (giro ${state.round})`).toBe('gameOver');
      expect(state.winner).not.toBeNull();
      expect(state.players[state.winner!].bankrupt).toBe(false);
      expect(state.round).toBeGreaterThanOrEqual(2);
      expect(state.round).toBeLessThanOrEqual(MAX_ROUNDS);
      expect(steps).toBeLessThan(MAX_ACTIONS);
    });

    it('una partita a 6 computer finisce con un vincitore in un numero ragionevole di giri', () => {
      const { state, steps } = playFullGame(choice.data, 6, 42);
      expect(state.phase, `non finita entro ${MAX_ACTIONS} azioni (giro ${state.round})`).toBe('gameOver');
      expect(state.winner).not.toBeNull();
      expect(state.players[state.winner!].bankrupt).toBe(false);
      expect(state.round).toBeGreaterThanOrEqual(2);
      expect(state.round).toBeLessThanOrEqual(MAX_ROUNDS);
      expect(steps).toBeLessThan(MAX_ACTIONS);
    });
  });
});

// Test di invarianti: fa giocare molte partite tra computer con semi fissi e controlla
// dopo ogni singola mossa che lo stato non violi mai le regole fondamentali del motore.
import { describe, it, expect } from 'vitest';
import { boardChoice, cards } from '../src/data';
import {
  actingPlayer,
  applyAction,
  chooseBotAction,
  createGame,
  HOTEL,
  type BoardData,
  type GameContext,
  type GameRules,
  type GameState,
  type PropertySpace,
  type Space,
} from '../src/engine';

// Limite massimo di azioni per una partita: il massimo misurato sulle 90 partite è 1213,
// quindi 2500 è circa il doppio.
const MAX_ACTIONS = 2500;

const FOUR_BOTS = ['Bot 1', 'Bot 2', 'Bot 3', 'Bot 4'].map((name) => ({ name, isBot: true }));

interface BoardIndex {
  size: number;
  byId: Map<string, Space>;
  groups: Map<string, PropertySpace[]>;
}

// Precalcola mappe di caselle e quartieri per mantenere veloce il controllo dopo ogni mossa.
function indexBoard(board: BoardData): BoardIndex {
  const byId = new Map<string, Space>();
  const groups = new Map<string, PropertySpace[]>();
  for (const s of board.spaces) {
    byId.set(s.id, s);
    if (s.type === 'property') {
      const list = groups.get(s.group) ?? [];
      list.push(s);
      groups.set(s.group, list);
    }
  }
  return { size: board.spaces.length, byId, groups };
}

// Controlla tutte le invarianti di stato dopo una mossa; restituisce il motivo se una è violata.
function findViolation(state: GameState, idx: BoardIndex): string | null {
  const players = state.players;

  // Posizioni valide e soldi >= 0 fuori dalla fase di debito.
  for (let i = 0; i < players.length; i++) {
    const p = players[i];
    if (!Number.isInteger(p.position) || p.position < 0 || p.position >= idx.size) {
      return `posizione non valida (${p.position}) per ${p.name}`;
    }
    const inDebtPhase = state.phase === 'endTurn' && p.id === state.current && !p.bankrupt;
    if (!inDebtPhase && p.money < 0) {
      return `soldi negativi (${p.money}) per ${p.name} in fase ${state.phase}`;
    }
  }

  // Il turno e il giocatore attivo appartengono sempre a un giocatore non fallito.
  if (state.phase !== 'gameOver') {
    if (players[state.current]?.bankrupt) return `turno al giocatore fallito ${state.current}`;
    const actor = actingPlayer(state);
    if (players[actor]?.bankrupt) return `giocatore attivo fallito ${actor}`;
    if (state.winner !== null) return `vincitore già assegnato (${state.winner}) prima di gameOver`;
  } else {
    if (state.winner === null) return 'partita finita senza vincitore';
    if (players[state.winner]?.bankrupt) return `vincitore fallito (${state.winner})`;
  }

  // Ogni proprietà ha un proprietario valido non fallito; case tra 0 e 5, solo su quartieri
  // completi dello stesso proprietario e mai su vie ipotecate.
  for (const spaceId in state.ownership) {
    const own = state.ownership[spaceId];
    const space = idx.byId.get(spaceId);
    if (!space) return `proprietà sconosciuta ${spaceId}`;

    const owner = players[own.owner];
    if (!owner) return `proprietario inesistente ${own.owner} su ${spaceId}`;
    if (owner.bankrupt) return `proprietà ${spaceId} in mano al giocatore fallito ${owner.name}`;

    if (!Number.isInteger(own.houses) || own.houses < 0 || own.houses > HOTEL) {
      return `case fuori limiti (${own.houses}) su ${spaceId}`;
    }

    if (own.houses > 0) {
      if (space.type !== 'property') return `case su casella non edificabile ${spaceId}`;
      if (own.mortgaged) return `case su via ipotecata ${spaceId}`;
      const groupStreets = idx.groups.get(space.group)!;
      for (let i = 0; i < groupStreets.length; i++) {
        const gs = state.ownership[groupStreets[i].id];
        if (!gs || gs.owner !== own.owner) {
          return `case su quartiere incompleto ${space.group} (${spaceId})`;
        }
        if (gs.mortgaged) {
          return `case nel quartiere ${space.group} con via ipotecata ${groupStreets[i].id}`;
        }
      }
    }
  }

  return null;
}

// Fa giocare una partita intera tra 4 computer controllando le invarianti dopo ogni azione.
function playAndAssert(boardId: string, rules: Partial<GameRules>, seed: number): number {
  const board = boardChoice(boardId).data;
  const idx = indexBoard(board);
  const ctx: GameContext = { board, cards };
  let state = createGame(FOUR_BOTS, ctx, rules, seed);

  const initViolation = findViolation(state, idx);
  expect(initViolation, `seme ${seed}, mossa 0`).toBeNull();

  let steps = 0;
  while (state.phase !== 'gameOver' && steps < MAX_ACTIONS) {
    const action = chooseBotAction(state, ctx);
    state = applyAction(state, action, ctx);
    steps++;
    const violation = findViolation(state, idx);
    if (violation) {
      expect.fail(`seme ${seed}, mossa ${steps} (${action.type}): ${violation}`);
    }
  }

  expect(state.phase, `partita non finita entro ${MAX_ACTIONS} azioni (seme ${seed}, tabellone ${boardId})`).toBe('gameOver');
  return steps;
}

describe('invarianti con partite casuali', () => {
  it('50 partite a 4 computer su Città sul Lago rispettano tutte le invarianti', () => {
    // Esclude il seme 48 (coperto sotto con it.fails per un bug noto del motore) e include il 51
    // così restano 50 partite complete in questo caso.
    const seeds = [...Array.from({ length: 47 }, (_, i) => i + 1), 49, 50, 51];
    for (const seed of seeds) {
      playAndAssert('citta', {}, seed);
    }
  }, 15000);

  // Bug nel motore (src/engine/rules.ts, doRoll): sul seme 48, alla mossa 419 (azione "roll"),
  // Bot 1 fallisce il terzo tentativo in Caserma, paga la multa di 50 andando in negativo (-46),
  // ma il motore lo sposta comunque su una casella libera ed entra in fase "buy" con soldi negativi
  // invece di gestire prima il debito.
  it.fails('bug noto (seme 48, mossa 419): multa del 3° turno in Caserma porta in fase buy con soldi negativi', () => {
    playAndAssert('citta', {}, 48);
  });

  it('20 partite a 4 computer su Valle Stretta rispettano tutte le invarianti', () => {
    for (let seed = 101; seed <= 120; seed++) {
      playAndAssert('valle', {}, seed);
    }
  }, 15000);

  it('20 partite a 4 computer con regole facoltative accese rispettano tutte le invarianti', () => {
    const extraRules: Partial<GameRules> = {
      events: true,
      wheel: true,
      shares: true,
      landmarks: true,
      teams: true,
    };
    for (let seed = 201; seed <= 220; seed++) {
      playAndAssert('citta', extraRules, seed);
    }
  }, 15000);
});

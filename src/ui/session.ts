// Partita in corso: stato attuale, stato iniziale con il registro delle azioni e "Annulla".
// Non tocca la pagina: l'interfaccia chiama questi metodi e poi ridisegna.
import { actingPlayer, applyAction, fileBoard, fileBoardData, isUndoable, newSave, raiseMoney, readSave, SAVE_VERSION, type Action, type GameRules, type PlayerSetup, type SaveFile, type GameContext, type GameState } from '../engine';
import { board, boardChoice, cards, currentBoard, currentChoice, setBoard } from '../data';
import { adoptBoard } from './boardStore';
import { KEYS, readPref, removePref, writePref } from './prefs';
import { standings } from './summary';

export function randomSeed(): number {
  return Math.floor(Math.random() * 2 ** 32);
}

export interface RematchOptions {
  players?: PlayerSetup[];
  rules?: Partial<GameRules>;
  tipsOn?: boolean;
  seed?: number;
  daily?: string;
  boardId?: string;
  ctx?: GameContext;
  nextSeed?: () => number;
}

export interface RematchSetup {
  players: PlayerSetup[];
  rules: GameRules;
  tipsOn: boolean;
  seed: number;
  boardId: string;
  // posto precedente di ogni nuovo posto (ordine inverso della classifica finale)
  seatOrder: number[];
}

// Prepara la rivincita: stessi giocatori, aspetto, livello e carattere dei computer, tabellone e regole;
// seme nuovo e posti nell'ordine inverso della classifica finale (chi era ultimo parte primo).
export function rematchSetup(
  finalState: GameState,
  previousSetup: RematchOptions = {},
  gameCtx?: GameContext,
  seedFn: () => number = previousSetup.nextSeed ?? randomSeed,
): RematchSetup {
  const boardId = previousSetup.boardId ?? currentBoard();
  const resolvedBoard = boardChoice(boardId).data;
  const ctx: GameContext = gameCtx ?? previousSetup.ctx ?? { board: resolvedBoard, cards };
  const seatOrder = standings(finalState, ctx).slice().reverse();
  const players: PlayerSetup[] = seatOrder.map((oldId) => {
    const p = finalState.players[oldId];
    const prev = previousSetup.players?.[oldId];
    const isBot = prev?.isBot ?? p.isBot;
    const appearance = prev?.appearance ?? p.appearance;
    const bot = isBot ? (prev?.bot ?? p.bot) : undefined;
    return {
      name: prev?.name ?? p.name,
      isBot,
      ...(appearance ? { appearance: { ...appearance } } : {}),
      ...(bot ? { bot: { ...bot } } : {}),
    };
  });
  const rules: GameRules = { ...finalState.rules, ...(previousSetup.rules ?? {}) };
  const prevSeed = (previousSetup.seed ?? finalState.seed ?? 0) >>> 0;
  let seed = seedFn() >>> 0;
  if (seed === prevSeed) seed = ((seed + 1) >>> 0) || 1;
  return {
    players,
    rules,
    tipsOn: previousSetup.tipsOn ?? true,
    seed,
    boardId,
    seatOrder,
  };
}

export class GameSession {
  state: GameState | null = null;
  // stato iniziale e registro delle azioni: rigiocandoli si ottiene lo stato attuale
  initial: GameState | null = null;
  actions: Action[] = [];
  // stati da ripristinare con "Annulla" (solo azioni della persona di turno dopo l'ultimo lancio)
  private undoStack: { state: GameState; actions: number }[] = [];

  constructor(private ctx: GameContext) {}

  // Il tabellone della partita: lo mette anche nel contesto, che è condiviso con l'interfaccia.
  // Un tabellone fatto con l'editor arriva coi suoi dati dentro il salvataggio.
  private useBoard(id?: string, data?: unknown): void {
    setBoard(adoptBoard(id, data));
    this.ctx.board = board;
  }

  // Riprende la partita salvata nel browser, se c'è.
  load(): void {
    try {
      const raw = readPref(KEYS.save);
      const parsed: unknown = raw ? JSON.parse(raw) : null;
      // il tabellone va scelto prima di leggere lo stato: i dati servono già per completarlo
      if (parsed) this.useBoard(fileBoard(parsed), fileBoardData(parsed));
      // le partite salvate senza seme ricevono un generatore nuovo
      const file = parsed ? readSave(parsed, this.ctx, randomSeed()) : null;
      if (file) this.open(file);
    } catch {
      /* salvataggio rovinato: si parte dalla schermata iniziale */
    }
  }

  // Apre una partita salvata con un nome o importata da un file.
  open(file: SaveFile): void {
    this.useBoard(file.board, file.boardData);
    this.state = file.state;
    this.initial = file.initial;
    this.actions = file.actions;
    this.undoStack = [];
  }

  // La partita in corso come file da salvare o esportare.
  toFile(): SaveFile | null {
    if (!this.state || !this.initial) return null;
    const custom = currentChoice().custom ? { boardData: board } : {};
    return { version: SAVE_VERSION, initial: this.initial, actions: this.actions, state: this.state, board: currentBoard(), ...custom };
  }

  save(): void {
    const file = this.toFile();
    if (file) writePref(KEYS.save, JSON.stringify(file));
    else removePref(KEYS.save);
  }

  start(state: GameState): void {
    ({ initial: this.initial, actions: this.actions } = newSave(state, currentBoard()));
    this.state = state;
    this.undoStack = [];
  }

  clear(): void {
    this.state = null;
    this.initial = null;
    this.actions = [];
    this.undoStack = [];
  }

  // Applica un'azione (lancia RuleError se non è valida) e restituisce lo stato precedente.
  apply(action: Action): GameState {
    const prev = this.state!;
    const actorBot = !!prev.players[actingPlayer(prev)].isBot;
    this.state = applyAction(prev, action, this.ctx);
    this.actions.push(action);
    // si può annullare solo quello che fa una persona dopo l'ultimo lancio dei dadi
    if (!actorBot && isUndoable(action)) this.undoStack.push({ state: prev, actions: this.actions.length - 1 });
    else this.undoStack = [];
    return prev;
  }

  // Vende case e ipoteca, come farebbe il computer, finché il debito è coperto. Si annulla in un colpo.
  coverDebt(): void {
    if (!this.state) return;
    this.undoStack.push({ state: this.state, actions: this.actions.length });
    let s = this.state;
    for (let i = 0; i < 200 && s.players[s.current].money < 0; i++) {
      const step = raiseMoney(s, this.ctx);
      if (!step) break;
      s = applyAction(s, step, this.ctx);
      this.actions.push(step);
    }
    this.state = s;
  }

  get canUndo(): boolean {
    const s = this.state;
    return !!s && this.undoStack.length > 0 && !s.players[actingPlayer(s)].isBot && s.phase !== 'gameOver';
  }

  // Torna allo stato prima dell'ultima azione annullabile.
  undo(): boolean {
    const last = this.undoStack.pop();
    if (!last) return false;
    this.state = last.state;
    this.actions.length = last.actions;
    return true;
  }
}

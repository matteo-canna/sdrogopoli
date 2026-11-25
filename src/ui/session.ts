// Partita in corso: stato attuale, stato iniziale con il registro delle azioni e "Annulla".
// Non tocca la pagina: l'interfaccia chiama questi metodi e poi ridisegna.
import { actingPlayer, applyAction, isUndoable, newSave, raiseMoney, readSave, SAVE_VERSION, type Action, type SaveFile, type GameContext, type GameState } from '../engine';
import { KEYS, readPref, removePref, writePref } from './prefs';

export function randomSeed(): number {
  return Math.floor(Math.random() * 2 ** 32);
}

export class GameSession {
  state: GameState | null = null;
  // stato iniziale e registro delle azioni: rigiocandoli si ottiene lo stato attuale
  initial: GameState | null = null;
  actions: Action[] = [];
  // stati da ripristinare con "Annulla" (solo azioni della persona di turno dopo l'ultimo lancio)
  private undoStack: { state: GameState; actions: number }[] = [];

  constructor(private ctx: GameContext) {}

  // Riprende la partita salvata nel browser, se c'è.
  load(): void {
    try {
      const raw = readPref(KEYS.save);
      // le partite salvate senza seme ricevono un generatore nuovo
      const file = raw ? readSave(JSON.parse(raw), this.ctx, randomSeed()) : null;
      if (file) this.open(file);
    } catch {
      /* salvataggio rovinato: si parte dalla schermata iniziale */
    }
  }

  // Apre una partita salvata con un nome o importata da un file.
  open(file: SaveFile): void {
    this.state = file.state;
    this.initial = file.initial;
    this.actions = file.actions;
    this.undoStack = [];
  }

  // La partita in corso come file da salvare o esportare.
  toFile(): SaveFile | null {
    if (!this.state || !this.initial) return null;
    return { version: SAVE_VERSION, initial: this.initial, actions: this.actions, state: this.state };
  }

  save(): void {
    const file = this.toFile();
    if (file) writePref(KEYS.save, JSON.stringify(file));
    else removePref(KEYS.save);
  }

  start(state: GameState): void {
    ({ initial: this.initial, actions: this.actions } = newSave(state));
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

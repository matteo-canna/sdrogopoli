// Rivedi la partita: si rigioca il registro delle azioni dallo stato iniziale, in fretta.
// Qui c'è solo la logica (quali stati, in che ordine, con che ritardo); la pagina la disegna main.ts.
import { applyAction, type Action, type GameContext, type GameState, type SaveFile } from '../engine';

export const REPLAY_SPEEDS = [1, 2, 4] as const;
export type ReplaySpeed = (typeof REPLAY_SPEEDS)[number];

// Ritardo tra un'azione e l'altra: i lanci e le carte durano un po' di più, il resto scorre.
export function stepDelay(action: Action, speed: ReplaySpeed): number {
  const base = action.type === 'roll' ? 700 : action.type === 'endTurn' ? 250 : 400;
  return Math.round(base / speed);
}

// Tutti gli stati della partita, dal primo all'ultimo. Se un'azione non è più valida
// (salvataggio di una versione vecchia) ci si ferma lì, con quello che si è ricostruito.
export function replayStates(file: SaveFile, ctx: GameContext): GameState[] {
  const states = [file.initial];
  let s = file.initial;
  for (const a of file.actions) {
    try {
      s = applyAction(s, a, ctx);
    } catch {
      break;
    }
    states.push(s);
  }
  return states;
}

export interface ReplayView {
  state: GameState;
  // da 0 a 1: quanto si è visto
  progress: number;
  done: boolean;
}

// Il replay: si va avanti un passo alla volta, si mette in pausa e si cambia velocità.
export class Replay {
  private i = 0;
  private timer: ReturnType<typeof setTimeout> | null = null;
  speed: ReplaySpeed = 2;

  constructor(
    private readonly states: GameState[],
    private readonly actions: Action[],
    private readonly onFrame: (v: ReplayView) => void,
  ) {}

  static from(file: SaveFile, ctx: GameContext, onFrame: (v: ReplayView) => void): Replay {
    return new Replay(replayStates(file, ctx), file.actions, onFrame);
  }

  get length(): number {
    return this.states.length;
  }

  get playing(): boolean {
    return this.timer !== null;
  }

  view(): ReplayView {
    return { state: this.states[this.i], progress: this.states.length > 1 ? this.i / (this.states.length - 1) : 1, done: this.i >= this.states.length - 1 };
  }

  play(): void {
    if (this.timer || this.view().done) return;
    const tick = () => {
      this.i++;
      this.onFrame(this.view());
      if (this.view().done) {
        this.timer = null;
        return;
      }
      this.timer = setTimeout(tick, stepDelay(this.actions[this.i] ?? { type: 'endTurn' }, this.speed));
    };
    this.timer = setTimeout(tick, stepDelay(this.actions[this.i] ?? { type: 'endTurn' }, this.speed));
  }

  pause(): void {
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
  }

  step(by: number): void {
    this.pause();
    this.i = Math.min(Math.max(this.i + by, 0), this.states.length - 1);
    this.onFrame(this.view());
  }

  seek(progress: number): void {
    this.pause();
    this.i = Math.round(Math.min(Math.max(progress, 0), 1) * (this.states.length - 1));
    this.onFrame(this.view());
  }

  stop(): void {
    this.pause();
    this.i = 0;
  }
}

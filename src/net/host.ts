// L'oste: tiene la partita, controlla che ogni mossa arrivi da chi deve giocare e manda lo stato a tutti.
import { actingPlayer, applyAction, chooseBotAction, RuleError, type Action, type GameContext, type GameState } from '../engine';
import { PROTOCOL_VERSION, type NetMessage } from './protocol';
import type { Transport } from './transport';

export class HostRoom {
  // posto di ogni ospite collegato (chiave: id del dispositivo)
  private seats = new Map<string, number>();
  state: GameState;
  moves = 0;
  onChange: ((state: GameState) => void) | null = null;

  constructor(
    private transport: Transport,
    private ctx: GameContext,
    state: GameState,
    // posti che spettano agli ospiti, nell'ordine in cui arrivano; gli altri sono dell'oste o del computer
    private openSeats: number[],
    // posto dell'oste (null se l'oste guarda soltanto)
    readonly hostSeat: number | null = 0,
  ) {
    this.state = state;
    transport.onMessage((msg, from) => this.receive(msg, from));
    transport.onPeerLeave((peer) => this.seats.delete(peer));
  }

  get guests(): ReadonlyMap<string, number> {
    return this.seats;
  }

  private receive(msg: NetMessage, from: string): void {
    if (msg.t === 'hello') {
      if (msg.v !== PROTOCOL_VERSION) {
        this.transport.send({ t: 'bye', reason: 'Versione del gioco diversa: ricarica la pagina.' }, from);
        return;
      }
      let seat = this.seats.get(from) ?? null;
      if (seat === null) {
        const taken = new Set(this.seats.values());
        seat = this.openSeats.find((s) => !taken.has(s)) ?? null;
        if (seat !== null) this.seats.set(from, seat);
      }
      this.transport.send({ t: 'welcome', seat }, from);
      this.transport.send({ t: 'state', state: this.state, n: this.moves }, from);
      return;
    }
    if (msg.t === 'action') {
      const seat = this.seats.get(from);
      const result = seat === undefined ? 'Stai solo guardando.' : this.tryApply(seat, msg.action);
      if (result) this.transport.send({ t: 'rejected', seq: msg.seq, reason: result }, from);
    }
  }

  // Mossa dell'oste stesso (dal suo schermo).
  act(action: Action): string | null {
    if (this.hostSeat === null) return 'Stai solo guardando.';
    return this.tryApply(this.hostSeat, action);
  }

  // Applica la mossa se tocca a quel posto. Restituisce il motivo del rifiuto, o null.
  private tryApply(seat: number, action: Action): string | null {
    if (this.state.phase === 'gameOver') return 'La partita è finita.';
    if (actingPlayer(this.state) !== seat) return 'Non è il tuo turno.';
    try {
      this.commit(applyAction(this.state, action, this.ctx));
      return null;
    } catch (e) {
      if (e instanceof RuleError) return e.message;
      throw e;
    }
  }

  // Posti che muove l'oste per conto del computer: quelli senza persona collegata.
  isComputerSeat(seat: number): boolean {
    if (seat === this.hostSeat) return false;
    if (this.state.players[seat].isBot) return true;
    return this.openSeats.includes(seat) && ![...this.seats.values()].includes(seat);
  }

  // Fa una mossa del computer se tocca a lui. Vero se ha mosso.
  stepComputer(): boolean {
    if (this.state.phase === 'gameOver') return false;
    const seat = actingPlayer(this.state);
    if (!this.isComputerSeat(seat)) return false;
    this.commit(applyAction(this.state, chooseBotAction(this.state, this.ctx), this.ctx));
    return true;
  }

  private commit(next: GameState): void {
    this.state = next;
    this.moves++;
    this.transport.send({ t: 'state', state: next, n: this.moves });
    this.onChange?.(next);
  }
}

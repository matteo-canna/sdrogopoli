// L'oste: raccoglie chi entra al tavolo, avvia la partita, controlla che ogni mossa arrivi da chi
// deve giocare e manda lo stato a tutti.
import { actingPlayer, applyAction, chooseBotAction, createGame, type Action, type Appearance, type GameContext, type GameRules, type GameState, type PlayerSetup } from '../engine';
import { PROTOCOL_VERSION, type Member, type NetMessage } from './protocol';
import { cleanLook, cleanName, uniqueColors } from './sanitize';
import type { Transport } from './transport';

export const MAX_SEATS = 8;

export class HostRoom {
  // prima dell'inizio: chi è al tavolo (l'oste è il primo)
  members: Member[];
  computers = 0;
  // durante la partita: posto di ogni ospite (chiave: id del dispositivo)
  private seats = new Map<string, number>();
  // posti lasciati liberi da chi è uscito: li riprende chi entra (intanto gioca il computer)
  private freeSeats: number[] = [];
  state: GameState | null = null;
  readonly hostSeat = 0;
  moves = 0;
  onChange: ((prev: GameState | null, next: GameState, action: Action | null) => void) | null = null;
  onLobby: ((members: Member[]) => void) | null = null;

  constructor(
    private transport: Transport,
    private ctx: GameContext,
    name: string,
    look: Appearance | null,
  ) {
    this.members = [{ id: 'oste', name: cleanName(name, 'Oste'), look, ready: true, host: true }];
    transport.onMessage((msg, from) => this.receive(msg, from));
    transport.onPeerLeave((peer) => this.left(peer));
  }

  get started(): boolean {
    return this.state !== null;
  }

  get guests(): ReadonlyMap<string, number> {
    return this.seats;
  }

  setComputers(n: number): void {
    this.computers = Math.max(0, Math.min(n, MAX_SEATS - this.members.length));
    this.publishLobby();
  }

  setHostProfile(name: string, look: Appearance | null): void {
    this.members[0] = { ...this.members[0], name: cleanName(name, 'Oste'), look };
    this.publishLobby();
  }

  private publishLobby(): void {
    if (this.started) return;
    // a ciascuno il suo: così ognuno sa quale riga dell'elenco è la sua
    for (const m of this.members) {
      if (!m.host) this.transport.send({ t: 'lobby', members: this.members, computers: this.computers, you: m.id }, m.id);
    }
    this.onLobby?.(this.members);
  }

  private left(peer: string): void {
    if (!this.started) {
      this.members = this.members.filter((m) => m.id !== peer);
      this.computers = Math.min(this.computers, MAX_SEATS - this.members.length);
      this.publishLobby();
      return;
    }
    const seat = this.seats.get(peer);
    if (seat === undefined) return;
    this.seats.delete(peer);
    // il posto resta libero per chi rientra; intanto lo muove il computer
    this.freeSeats.push(seat);
    this.onChange?.(this.state, this.state!, null);
  }

  private receive(msg: NetMessage, from: string): void {
    if (msg.t === 'hello') {
      if (msg.v !== PROTOCOL_VERSION) {
        this.transport.send({ t: 'bye', reason: 'Versione del gioco diversa: ricaricate la pagina tutti e due.' }, from);
        return;
      }
      if (!this.started) {
        const known = this.members.find((m) => m.id === from);
        if (!known) {
          if (this.members.length + this.computers >= MAX_SEATS) this.computers = Math.max(0, this.computers - 1);
          if (this.members.length >= MAX_SEATS) {
            this.transport.send({ t: 'bye', reason: 'Il tavolo è pieno.' }, from);
            return;
          }
          this.members.push({ id: from, name: cleanName(msg.name, `Ospite ${this.members.length}`), look: msg.look ? cleanLook(msg.look, this.members.length) : null, ready: false, host: false });
        }
        this.publishLobby();
        return;
      }
      // a partita iniziata: si riprende un posto lasciato libero, altrimenti si guarda
      let seat = this.seats.get(from) ?? null;
      if (seat === null && this.freeSeats.length) {
        seat = this.freeSeats.shift()!;
        this.seats.set(from, seat);
      }
      this.transport.send({ t: 'welcome', seat }, from);
      this.transport.send({ t: 'state', state: this.state!, n: this.moves, action: null }, from);
      if (seat !== null) this.onChange?.(this.state, this.state!, null);
      return;
    }
    if (msg.t === 'ready') {
      const m = this.members.find((x) => x.id === from);
      if (!m || this.started) return;
      const i = this.members.indexOf(m);
      Object.assign(m, { ready: !!msg.ready, name: cleanName(msg.name, m.name), look: msg.look ? cleanLook(msg.look, i) : m.look });
      this.publishLobby();
      return;
    }
    if (msg.t === 'action') {
      const seat = this.seats.get(from);
      const result = seat === undefined ? 'Stai solo guardando.' : this.tryApply(seat, msg.action);
      if (result) this.transport.send({ t: 'rejected', seq: msg.seq, reason: result }, from);
    }
  }

  // Avvia la partita con chi è al tavolo (nell'ordine di arrivo) e i posti del computer.
  start(rules: Partial<GameRules>, seed: number): GameState {
    const players: PlayerSetup[] = this.members.map((m, i) => ({ name: m.name, appearance: m.look ?? cleanLook(null, i) }));
    for (let c = 0; c < this.computers; c++) {
      const seat = players.length;
      players.push({ name: `Computer ${c + 1}`, isBot: true, appearance: cleanLook(null, seat) });
    }
    // due giocatori con lo stesso colore: il secondo prende il primo colore libero
    const looks = uniqueColors(players.map((p) => p.appearance!));
    players.forEach((p, i) => (p.appearance = looks[i]));
    const seats = new Map<string, number>();
    this.members.forEach((m, i) => {
      if (!m.host) seats.set(m.id, i);
    });
    const state = createGame(players, this.ctx, rules, seed);
    this.startWith(state, seats);
    return state;
  }

  // Avvia con uno stato già pronto (per i test o per riprendere una partita).
  startWith(state: GameState, seats: Map<string, number>): void {
    this.state = state;
    this.seats = new Map(seats);
    for (const [peer, seat] of this.seats) this.transport.send({ t: 'welcome', seat }, peer);
    this.transport.send({ t: 'state', state, n: this.moves, action: null });
    this.onChange?.(null, state, null);
  }

  // Mossa fatta su questo schermo: dell'oste, o del computer per i posti che muove lui.
  act(action: Action): string | null {
    if (!this.state) return 'La partita non è iniziata.';
    const seat = actingPlayer(this.state);
    if (seat !== this.hostSeat && !this.isComputerSeat(seat)) return 'Non è il tuo turno.';
    return this.tryApply(seat, action);
  }

  // Applica la mossa se tocca a quel posto. Restituisce il motivo del rifiuto, o null.
  private tryApply(seat: number, action: Action): string | null {
    const prev = this.state;
    if (!prev) return 'La partita non è iniziata.';
    if (prev.phase === 'gameOver') return 'La partita è finita.';
    if (actingPlayer(prev) !== seat) return 'Non è il tuo turno.';
    let next: GameState;
    try {
      next = applyAction(prev, action, this.ctx);
    } catch (e) {
      // anche una mossa malformata arrivata dalla rete finisce qui, senza fermare la partita
      return e instanceof Error ? e.message : 'Mossa non valida.';
    }
    this.state = next;
    this.moves++;
    this.transport.send({ t: 'state', state: next, n: this.moves, action });
    this.onChange?.(prev, next, action);
    return null;
  }

  // Posti che muove l'oste per conto del computer: i computer e i posti rimasti senza persona.
  isComputerSeat(seat: number): boolean {
    if (!this.state || seat === this.hostSeat) return false;
    if (this.state.players[seat].isBot) return true;
    return ![...this.seats.values()].includes(seat);
  }

  // Fa una mossa del computer se tocca a lui. Vero se ha mosso.
  stepComputer(): boolean {
    if (!this.state || this.state.phase === 'gameOver') return false;
    if (!this.isComputerSeat(actingPlayer(this.state))) return false;
    return this.act(chooseBotAction(this.state, this.ctx)) === null;
  }

  close(): void {
    this.transport.send({ t: 'bye', reason: "L'oste ha chiuso il tavolo." });
    this.transport.leave();
  }
}

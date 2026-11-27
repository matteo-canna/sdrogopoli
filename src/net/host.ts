// L'oste: raccoglie chi entra al tavolo, avvia la partita, controlla che ogni mossa arrivi da chi
// deve giocare e manda lo stato a tutti. Muove il computer per i posti dei computer, per chi si è
// scollegato e per chi ha lasciato scadere il tempo della mossa.
import { actingPlayer, applyAction, BOT_STYLES, chooseBotAction, createGame, openRound, RuleError, type Action, type Appearance, type GameContext, type GameRules, type GameState, type PlayerSetup } from '../engine';
import { PROTOCOL_VERSION, REMATCH_TIMEOUT_MS, type Member, type NetMessage } from './protocol';
import { cleanLook, cleanName, cleanRematchReply, uniqueColors } from './sanitize';
import { SAY_GAP_MS, sayText } from './chat';
import type { Transport } from './transport';
import { rematchSetup } from '../ui/session';
import { format, t, type Message } from '../i18n';

// Motivo di un rifiuto: testo italiano per chi ha una versione vecchia, chiave per tradurlo.
function why(m: Message): { reason: string; key: Message['k']; p?: Message['p'] } {
  return { reason: format('it', m.k, m.p), key: m.k, p: m.p };
}

export const MAX_SEATS = 8;

// Quello che serve per riprendere il tavolo dopo aver ricaricato la pagina.
export interface HostSnapshot {
  state: GameState;
  moves: number;
  keys: [string, number][];
  limitMs: number | null;
}

export class HostRoom {
  // prima dell'inizio: chi è al tavolo (l'oste è il primo)
  members: Member[];
  computers = 0;
  // durante la partita: posto di ogni dispositivo collegato (chiave: id del dispositivo)
  private seats = new Map<string, number>();
  // chiave di ogni dispositivo (resta uguale se ricarica la pagina) e posto di ogni chiave
  private keyOfPeer = new Map<string, string>();
  private seatOfKey = new Map<string, number>();
  // posti mossi dal computer perché il tempo è scaduto, finché la persona non torna a giocare
  readonly away = new Set<number>();
  // tempo per ogni mossa (null = senza limite)
  limitMs: number | null = null;
  private lastMoveAt = 0;
  state: GameState | null = null;
  hostSeat = 0;
  moves = 0;
  // proposta di rivincita in corso a fine partita (null se non c'è)
  rematch: { accepted: Set<number>; declined: Set<number>; pending: Set<number>; startedAt: number; seed: number } | null = null;
  onChange: ((prev: GameState | null, next: GameState, action: Action | null) => void) | null = null;
  onLobby: ((members: Member[]) => void) | null = null;
  onSaid: ((seat: number, id: string) => void) | null = null;
  onRematch: (() => void) | null = null;
  private lastSay = new Map<number, number>();

  constructor(
    private transport: Transport,
    private ctx: GameContext,
    name: string,
    look: Appearance | null,
    private now: () => number = () => Date.now(),
  ) {
    this.members = [{ id: 'oste', name: cleanName(name, t('online.hostName')), look, ready: true, host: true }];
    transport.onMessage((msg, from) => this.receive(msg, from));
    transport.onPeerLeave((peer) => this.left(peer));
  }

  get started(): boolean {
    return this.state !== null;
  }

  setComputers(n: number): void {
    this.computers = Math.max(0, Math.min(n, MAX_SEATS - this.members.length));
    this.publishLobby();
  }

  setHostProfile(name: string, look: Appearance | null): void {
    this.members[0] = { ...this.members[0], name: cleanName(name, t('online.hostName')), look };
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

  // Posti di persone senza nessun dispositivo collegato.
  offlineSeats(): number[] {
    if (!this.state) return [];
    const taken = new Set(this.seats.values());
    return this.state.players.filter((p) => p.id !== this.hostSeat && !p.isBot && !taken.has(p.id)).map((p) => p.id);
  }

  private publishPresence(to?: string): void {
    if (!this.started) return;
    this.transport.send({ t: 'presence', offline: this.offlineSeats(), away: [...this.away], limitMs: this.limitMs }, to);
  }

  private left(peer: string): void {
    if (!this.started) {
      this.members = this.members.filter((m) => m.id !== peer);
      this.computers = Math.min(this.computers, MAX_SEATS - this.members.length);
      this.publishLobby();
      return;
    }
    const oldSeat = this.seats.get(peer);
    if (!this.seats.delete(peer)) return;
    if (this.rematch && oldSeat !== undefined && this.rematch.pending.delete(oldSeat)) {
      this.rematch.declined.add(oldSeat);
      if (this.rematch.pending.size === 0) {
        this.launchRematch();
        return;
      }
      this.publishRematch();
    }
    // il posto resta a chi rientra con la stessa chiave; intanto lo muove il computer
    this.publishPresence();
    this.onChange?.(this.state, this.state!, null);
  }

  private receive(msg: NetMessage, from: string): void {
    if (msg.t === 'hello') {
      if (msg.v !== PROTOCOL_VERSION) {
        this.transport.send({ t: 'bye', ...why({ k: 'net.version' }) }, from);
        return;
      }
      if (typeof msg.key === 'string' && msg.key) this.keyOfPeer.set(from, msg.key.slice(0, 40));
      if (!this.started) {
        const known = this.members.find((m) => m.id === from);
        if (!known) {
          if (this.members.length + this.computers >= MAX_SEATS) this.computers = Math.max(0, this.computers - 1);
          if (this.members.length >= MAX_SEATS) {
            this.transport.send({ t: 'bye', ...why({ k: 'net.full' }) }, from);
            return;
          }
          this.members.push({ id: from, name: cleanName(msg.name, `${t('online.guestName')} ${this.members.length}`), look: msg.look ? cleanLook(msg.look, this.members.length) : null, ready: false, host: false });
        }
        this.publishLobby();
        return;
      }
      const seat = this.seatFor(from);
      this.transport.send({ t: 'welcome', seat }, from);
      this.transport.send({ t: 'state', state: this.state!, n: this.moves, action: null }, from);
      if (seat !== null) {
        this.publishPresence();
        this.onChange?.(this.state, this.state!, null);
      } else this.publishPresence(from);
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
    if (msg.t === 'say') {
      const seat = this.seats.get(from);
      if (seat !== undefined) this.say(seat, msg.id);
      return;
    }
    if (msg.t === 'rematchReply') {
      const clean = cleanRematchReply(msg);
      const seat = this.seats.get(from);
      if (!clean || !this.rematch || seat === undefined || !this.rematch.pending.delete(seat)) return;
      if (clean.accept) this.rematch.accepted.add(seat);
      else this.rematch.declined.add(seat);
      if (this.rematch.pending.size === 0) this.launchRematch();
      else this.publishRematch();
      return;
    }
    if (msg.t === 'action') {
      const seat = this.seats.get(from);
      const result: Message | null = seat === undefined ? { k: 'net.watching' } : this.tryApply(seat, msg.action, true);
      if (result) this.transport.send({ t: 'rejected', seq: msg.seq, ...why(result) }, from);
    }
  }

  // Posto per chi entra a partita iniziata: il suo (stessa chiave), altrimenti uno rimasto
  // senza nessuno, altrimenti si guarda soltanto.
  private seatFor(peer: string): number | null {
    const known = this.seats.get(peer);
    if (known !== undefined) return known;
    const offline = this.offlineSeats();
    const key = this.keyOfPeer.get(peer);
    const mine = key !== undefined ? this.seatOfKey.get(key) : undefined;
    let seat: number | null = null;
    if (mine !== undefined && offline.includes(mine)) seat = mine;
    else {
      // prima i posti di cui nessuno conosce la chiave, poi gli altri senza nessuno
      const claimed = new Set(this.seatOfKey.values());
      seat = offline.find((s) => !claimed.has(s)) ?? offline[0] ?? null;
    }
    if (seat === null) return null;
    this.seats.set(peer, seat);
    // chi rientra proprio nel suo turno ha tutto il tempo per la mossa
    if (actingPlayer(this.state!) === seat) this.lastMoveAt = this.now();
    if (key !== undefined) {
      for (const [k, s] of this.seatOfKey) if (s === seat) this.seatOfKey.delete(k);
      this.seatOfKey.set(key, seat);
    }
    return seat;
  }

  setTurnLimit(ms: number | null): void {
    this.limitMs = ms && ms > 0 ? ms : null;
    this.lastMoveAt = this.now();
    this.publishPresence();
  }

  // Avvia la partita con chi è al tavolo (nell'ordine di arrivo) e i posti del computer.
  start(rules: Partial<GameRules>, seed: number): GameState {
    const players: PlayerSetup[] = this.members.map((m, i) => ({ name: m.name, appearance: m.look ?? cleanLook(null, i) }));
    for (let c = 0; c < this.computers; c++) {
      const seat = players.length;
      players.push({ name: `Computer ${c + 1}`, isBot: true, appearance: cleanLook(null, seat), bot: { level: 'normale', style: BOT_STYLES[c % BOT_STYLES.length].id } });
    }
    // due giocatori con lo stesso colore: il secondo prende il primo colore libero
    const looks = uniqueColors(players.map((p) => p.appearance!));
    players.forEach((p, i) => (p.appearance = looks[i]));
    const seats = new Map<string, number>();
    this.members.forEach((m, i) => {
      if (!m.host) seats.set(m.id, i);
    });
    const state = openRound(createGame(players, this.ctx, rules, seed), this.ctx);
    this.startWith(state, seats);
    return state;
  }

  // Avvia con uno stato già pronto (per i test o per riprendere una partita).
  startWith(state: GameState, seats: Map<string, number>): void {
    this.state = state;
    this.seats = new Map(seats);
    for (const [peer, seat] of this.seats) {
      const key = this.keyOfPeer.get(peer);
      if (key !== undefined) this.seatOfKey.set(key, seat);
    }
    this.lastMoveAt = this.now();
    for (const [peer, seat] of this.seats) this.transport.send({ t: 'welcome', seat }, peer);
    this.transport.send({ t: 'state', state, n: this.moves, action: null });
    this.publishPresence();
    this.onChange?.(null, state, null);
  }

  // Riprende il tavolo dopo che la pagina dell'oste si è ricaricata: gli ospiti, ritrovato l'oste,
  // si ripresentano con la loro chiave e riprendono il posto. Intanto gioca il computer.
  restore(snap: HostSnapshot): void {
    this.moves = snap.moves;
    this.seatOfKey = new Map(snap.keys);
    this.limitMs = snap.limitMs;
    this.startWith(snap.state, new Map());
  }

  snapshot(): HostSnapshot | null {
    if (!this.state) return null;
    return { state: this.state, moves: this.moves, keys: [...this.seatOfKey], limitMs: this.limitMs };
  }

  // Mossa della persona che usa lo schermo dell'oste.
  act(action: Action): Message | null {
    if (!this.state) return { k: 'net.notStarted' };
    return this.tryApply(this.hostSeat, action, true);
  }

  // Applica la mossa se tocca a quel posto. Restituisce il motivo del rifiuto, o null.
  // "byPerson": la mossa l'ha fatta la persona del posto, che così torna a giocare da sé.
  private tryApply(seat: number, action: Action, byPerson: boolean): Message | null {
    const prev = this.state;
    if (!prev) return { k: 'net.notStarted' };
    if (prev.phase === 'gameOver') return { k: 'err.gameOver' };
    if (actingPlayer(prev) !== seat) return { k: 'net.notYourTurn' };
    let next: GameState;
    try {
      next = applyAction(prev, action, this.ctx);
    } catch (e) {
      // anche una mossa malformata arrivata dalla rete finisce qui, senza fermare la partita
      return e instanceof RuleError ? { k: e.key, p: e.params } : { k: 'net.badMove' };
    }
    this.state = next;
    this.moves++;
    this.lastMoveAt = this.now();
    const back = byPerson && this.away.delete(seat);
    this.transport.send({ t: 'state', state: next, n: this.moves, action });
    if (back) this.publishPresence();
    this.onChange?.(prev, next, action);
    return null;
  }

  // Posti che muove l'oste per conto del computer: i computer, i posti rimasti senza persona
  // e chi ha lasciato scadere il tempo.
  isComputerSeat(seat: number): boolean {
    if (!this.state) return false;
    if (this.away.has(seat)) return true;
    if (seat === this.hostSeat) return false;
    if (this.state.players[seat].isBot) return true;
    return ![...this.seats.values()].includes(seat);
  }

  // Fa una mossa del computer se tocca a lui. Vero se ha mosso.
  stepComputer(): boolean {
    if (!this.state || this.state.phase === 'gameOver') return false;
    const seat = actingPlayer(this.state);
    if (!this.isComputerSeat(seat)) return false;
    return this.tryApply(seat, chooseBotAction(this.state, this.ctx), false) === null;
  }

  // Millisecondi rimasti alla persona di turno (null: nessun limite o tocca al computer).
  timeLeft(): number | null {
    if (!this.state || this.limitMs === null || this.state.phase === 'gameOver') return null;
    if (this.isComputerSeat(actingPlayer(this.state))) return null;
    return Math.max(0, this.lastMoveAt + this.limitMs - this.now());
  }

  // Tempo scaduto: da qui in poi per quel posto gioca il computer, finché la persona non fa una mossa.
  // A fine partita controlla anche i 30 secondi della proposta di rivincita.
  checkTimer(): boolean {
    if (this.rematch && this.rematchTimeLeft() === 0) {
      this.launchRematch();
      return true;
    }
    if (this.timeLeft() !== 0) return false;
    this.away.add(actingPlayer(this.state!));
    this.publishPresence();
    this.onChange?.(this.state, this.state!, null);
    return true;
  }

  // Millisecondi rimasti agli ospiti per rispondere alla proposta di rivincita.
  rematchTimeLeft(): number | null {
    if (!this.rematch) return null;
    return Math.max(0, this.rematch.startedAt + REMATCH_TIMEOUT_MS - this.now());
  }

  // A fine partita l'oste propone la rivincita agli ospiti collegati.
  proposeRematch(seed = Math.floor(Math.random() * 2 ** 32)): boolean {
    if (!this.state || this.state.phase !== 'gameOver' || this.rematch) return false;
    const guests = [...new Set(this.seats.values())].filter((s) => s !== this.hostSeat && !this.state!.players[s]?.isBot);
    this.rematch = {
      accepted: new Set([this.hostSeat]),
      declined: new Set(),
      pending: new Set(guests),
      startedAt: this.now(),
      seed,
    };
    if (this.rematch.pending.size === 0) this.launchRematch();
    else this.publishRematch();
    return true;
  }

  private publishRematch(): void {
    if (!this.rematch) return;
    this.transport.send({
      t: 'rematch',
      accepted: [...this.rematch.accepted],
      declined: [...this.rematch.declined],
      pending: [...this.rematch.pending],
      timeoutMs: REMATCH_TIMEOUT_MS,
    });
    this.onRematch?.();
  }

  private launchRematch(): void {
    const finalState = this.state;
    const r = this.rematch;
    if (!finalState || !r) return;
    this.rematch = null;
    const oldHostSeat = this.hostSeat;
    const oldPeers = new Map<number, string>();
    for (const [peer, seat] of this.seats) oldPeers.set(seat, peer);
    const setup = rematchSetup(finalState, { rules: finalState.rules }, this.ctx, () => r.seed);
    const newSeats = new Map<string, number>();
    let nextHostSeat = 0;
    const players: PlayerSetup[] = setup.players.map((pl, newSeat) => {
      const oldSeat = setup.seatOrder[newSeat];
      if (oldSeat === oldHostSeat) {
        nextHostSeat = newSeat;
        return { ...pl, isBot: false };
      }
      const peer = oldPeers.get(oldSeat);
      if (r.accepted.has(oldSeat) && peer !== undefined) {
        newSeats.set(peer, newSeat);
        return { ...pl, isBot: false };
      }
      // chi ha rifiutato, non ha risposto in tempo o era già un computer passa al computer
      return {
        ...pl,
        isBot: true,
        bot: pl.bot ?? { level: 'normale', style: BOT_STYLES[newSeat % BOT_STYLES.length].id },
      };
    });
    // chi non ha accettato non ha più un posto in questa partita: guarda soltanto
    for (const [peer] of this.seats) {
      if (!newSeats.has(peer)) this.transport.send({ t: 'welcome', seat: null }, peer);
    }
    this.seatOfKey.clear();
    this.away.clear();
    this.hostSeat = nextHostSeat;
    this.moves++;
    const next = openRound(createGame(players, this.ctx, setup.rules, setup.seed), this.ctx);
    this.startWith(next, newSeats);
  }

  // Reazione o frase pronta di un posto: si manda a tutti (anche a chi l'ha scritta). Falso se scartata.
  say(seat: number, id: unknown): boolean {
    if (!this.state || typeof id !== 'string' || !sayText(id)) return false;
    const t = this.now();
    if (t - (this.lastSay.get(seat) ?? -Infinity) < SAY_GAP_MS) return false;
    this.lastSay.set(seat, t);
    this.transport.send({ t: 'said', seat, id });
    this.onSaid?.(seat, id);
    return true;
  }

  close(): void {
    this.transport.send({ t: 'bye', ...why({ k: 'net.closed' }) });
    this.transport.leave();
  }
}

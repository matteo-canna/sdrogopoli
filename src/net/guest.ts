// Un ospite: si presenta all'oste, aspetta l'inizio, manda le sue mosse e mostra lo stato che riceve.
import { actingPlayer, type Action, type Appearance, type GameState } from '../engine';
import { PROTOCOL_VERSION, type Member, type NetMessage } from './protocol';
import { cleanLook, cleanName } from './sanitize';
import type { Transport } from './transport';

export class GuestRoom {
  state: GameState | null = null;
  seat: number | null = null;
  members: Member[] = [];
  // come mi chiama l'oste (per riconoscermi nell'elenco)
  myId = '';
  computers = 0;
  ready = false;
  lastError = '';
  // chiuso dall'oste (tavolo pieno, versione diversa, tavolo chiuso)
  closed = '';
  // posti scollegati o mossi dal computer per il tempo scaduto, e tempo per ogni mossa
  offline: number[] = [];
  away: number[] = [];
  limitMs: number | null = null;
  // quando è arrivata l'ultima mossa (per il conto alla rovescia, con l'orologio di questo dispositivo)
  lastMoveAt = 0;
  private moves = -1;
  private seq = 0;
  private host: string | null = null;
  onChange: ((prev: GameState | null, next: GameState, action: Action | null) => void) | null = null;
  onLobby: ((members: Member[]) => void) | null = null;
  onError: ((reason: string) => void) | null = null;
  onHostLeft: (() => void) | null = null;
  onPresence: (() => void) | null = null;
  // l'oste è tornato dopo essere uscito
  onHostBack: (() => void) | null = null;
  private hadHost = false;

  constructor(
    private transport: Transport,
    public name: string,
    public look: Appearance | null = null,
    // resta uguale se la pagina si ricarica: con questa si riprende il proprio posto
    private key = '',
    private now: () => number = () => Date.now(),
  ) {
    transport.onPeerJoin((peer) => {
      // ci si presenta a chi entra: risponde solo l'oste
      if (!this.host) transport.send({ t: 'hello', v: PROTOCOL_VERSION, name: this.name, look: this.look, key: this.key || undefined }, peer);
    });
    transport.onPeerLeave((peer) => {
      if (peer !== this.host) return;
      // si resta collegati: se l'oste torna (ricaricando la pagina) ci si ripresenta
      this.host = null;
      this.moves = -1;
      this.onHostLeft?.();
    });
    transport.onMessage((msg, from) => this.receive(msg, from));
  }

  get connected(): boolean {
    return this.host !== null;
  }

  // Millisecondi rimasti a chi è di turno (null: nessun limite, o gioca il computer).
  timeLeft(): number | null {
    const s = this.state;
    if (!s || this.limitMs === null || s.phase === 'gameOver' || !this.host) return null;
    const who = actingPlayer(s);
    if (s.players[who].isBot || this.offline.includes(who) || this.away.includes(who)) return null;
    return Math.max(0, this.lastMoveAt + this.limitMs - this.now());
  }

  private receive(msg: NetMessage, from: string): void {
    // l'oste è chi manda la lista del tavolo o il posto
    if ((msg.t === 'lobby' || msg.t === 'welcome') && !this.host) {
      this.host = from;
      if (this.hadHost) this.onHostBack?.();
      this.hadHost = true;
    }
    if (from !== this.host) return;
    switch (msg.t) {
      case 'lobby':
        // anche quello che manda l'oste finisce nella pagina: nomi e colori si ripuliscono
        this.members = msg.members.map((m, i) => ({ ...m, name: cleanName(m.name, `Giocatore ${i + 1}`), look: m.look ? cleanLook(m.look, i) : null }));
        if (typeof msg.you === 'string') this.myId = msg.you;
        this.computers = msg.computers;
        this.onLobby?.(this.members);
        return;
      case 'welcome':
        this.seat = msg.seat;
        return;
      case 'presence':
        this.offline = Array.isArray(msg.offline) ? msg.offline.filter(Number.isInteger) : [];
        this.away = Array.isArray(msg.away) ? msg.away.filter(Number.isInteger) : [];
        this.limitMs = typeof msg.limitMs === 'number' && msg.limitMs > 0 ? msg.limitMs : null;
        this.onPresence?.();
        return;
      case 'state': {
        if (msg.n <= this.moves) return;
        const prev = this.state;
        msg.state.players.forEach((p, i) => {
          p.name = cleanName(p.name, `Giocatore ${i + 1}`);
          if (p.appearance) p.appearance = cleanLook(p.appearance, i);
        });
        this.moves = msg.n;
        if (msg.action || !prev) this.lastMoveAt = this.now();
        this.state = msg.state;
        this.onChange?.(prev, msg.state, msg.action);
        return;
      }
      case 'rejected':
        this.lastError = msg.reason;
        this.onError?.(msg.reason);
        return;
      case 'bye':
        this.closed = msg.reason;
        this.onError?.(msg.reason);
        return;
    }
  }

  setReady(ready: boolean): void {
    this.ready = ready;
    if (this.host) this.transport.send({ t: 'ready', ready, name: this.name, look: this.look }, this.host);
  }

  send(action: Action): void {
    if (!this.host) return;
    this.lastError = '';
    this.transport.send({ t: 'action', action, seq: ++this.seq }, this.host);
  }

  leave(): void {
    this.transport.leave();
  }
}

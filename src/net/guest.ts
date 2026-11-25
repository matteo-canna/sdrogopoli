// Un ospite: si presenta all'oste, aspetta l'inizio, manda le sue mosse e mostra lo stato che riceve.
import type { Action, Appearance, GameState } from '../engine';
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
  private moves = -1;
  private seq = 0;
  private host: string | null = null;
  onChange: ((prev: GameState | null, next: GameState, action: Action | null) => void) | null = null;
  onLobby: ((members: Member[]) => void) | null = null;
  onError: ((reason: string) => void) | null = null;
  onHostLeft: (() => void) | null = null;

  constructor(
    private transport: Transport,
    public name: string,
    public look: Appearance | null = null,
  ) {
    transport.onPeerJoin((peer) => {
      // ci si presenta a chi entra: risponde solo l'oste
      if (!this.host) transport.send({ t: 'hello', v: PROTOCOL_VERSION, name: this.name, look: this.look }, peer);
    });
    transport.onPeerLeave((peer) => {
      if (peer === this.host) this.onHostLeft?.();
    });
    transport.onMessage((msg, from) => this.receive(msg, from));
  }

  get connected(): boolean {
    return this.host !== null;
  }

  private receive(msg: NetMessage, from: string): void {
    // l'oste è chi manda la lista del tavolo o il posto
    if ((msg.t === 'lobby' || msg.t === 'welcome') && !this.host) this.host = from;
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
      case 'state': {
        if (msg.n <= this.moves) return;
        const prev = this.state;
        msg.state.players.forEach((p, i) => {
          p.name = cleanName(p.name, `Giocatore ${i + 1}`);
          if (p.appearance) p.appearance = cleanLook(p.appearance, i);
        });
        this.moves = msg.n;
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

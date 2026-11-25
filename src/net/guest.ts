// Un ospite: manda le sue mosse all'oste e mostra lo stato che riceve.
import type { Action, GameState } from '../engine';
import { PROTOCOL_VERSION, type NetMessage } from './protocol';
import type { Transport } from './transport';

export class GuestRoom {
  state: GameState | null = null;
  seat: number | null = null;
  // vero appena l'oste ha risposto
  joined = false;
  lastError = '';
  private moves = -1;
  private seq = 0;
  private host: string | null = null;
  onChange: ((state: GameState) => void) | null = null;
  onError: ((reason: string) => void) | null = null;

  constructor(
    private transport: Transport,
    private name: string,
  ) {
    transport.onPeerJoin((peer) => {
      // ci si presenta a chi entra: risponde solo l'oste
      if (!this.joined) transport.send({ t: 'hello', v: PROTOCOL_VERSION, name: this.name }, peer);
    });
    transport.onMessage((msg, from) => this.receive(msg, from));
  }

  private receive(msg: NetMessage, from: string): void {
    switch (msg.t) {
      case 'welcome':
        this.host = from;
        this.joined = true;
        this.seat = msg.seat;
        return;
      case 'state':
        if (from !== this.host || msg.n <= this.moves) return;
        this.moves = msg.n;
        this.state = msg.state;
        this.onChange?.(msg.state);
        return;
      case 'rejected':
        this.lastError = msg.reason;
        this.onError?.(msg.reason);
        return;
      case 'bye':
        this.lastError = msg.reason;
        this.onError?.(msg.reason);
        return;
    }
  }

  send(action: Action): void {
    if (!this.host) return;
    this.transport.send({ t: 'action', action, seq: ++this.seq }, this.host);
  }
}

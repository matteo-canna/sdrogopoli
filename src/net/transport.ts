// Il canale tra i dispositivi. Nel gioco sarà WebRTC (Trystero); nei test un finto canale in memoria.
import type { NetMessage } from './protocol';

export interface Transport {
  readonly selfId: string;
  // "to" assente = a tutti gli altri
  send(msg: NetMessage, to?: string): void;
  onMessage(cb: (msg: NetMessage, from: string) => void): void;
  onPeerJoin(cb: (peer: string) => void): void;
  onPeerLeave(cb: (peer: string) => void): void;
  leave(): void;
}

// Rete finta per i test: i messaggi arrivano in ordine ma non subito (come in rete),
// e passano per JSON, così niente oggetti condivisi per sbaglio tra i dispositivi.
export class FakeNetwork {
  private peers = new Map<string, FakeTransport>();
  private queue: (() => void)[] = [];
  delivered = 0;

  join(id: string): FakeTransport {
    const t = new FakeTransport(id, this);
    for (const other of this.peers.values()) {
      this.later(() => other.emitJoin(id));
      this.later(() => t.emitJoin(other.selfId));
    }
    this.peers.set(id, t);
    return t;
  }

  leave(id: string): void {
    if (!this.peers.delete(id)) return;
    for (const other of this.peers.values()) this.later(() => other.emitLeave(id));
  }

  deliver(from: string, msg: NetMessage, to?: string): void {
    const raw = JSON.stringify(msg);
    for (const [id, peer] of this.peers) {
      if (id === from || (to && id !== to)) continue;
      this.later(() => {
        // chi è uscito nel frattempo non riceve più nulla
        if (!this.peers.has(id) || !this.peers.has(from)) return;
        this.delivered++;
        peer.emitMessage(JSON.parse(raw), from);
      });
    }
  }

  private later(fn: () => void): void {
    this.queue.push(fn);
  }

  // Consegna tutto quello che è in viaggio (anche i messaggi generati consegnando). Restituisce i passi fatti.
  flush(max = 1_000_000): number {
    let steps = 0;
    while (this.queue.length && steps < max) {
      this.queue.shift()!();
      steps++;
    }
    return steps;
  }
}

export class FakeTransport implements Transport {
  private msgCbs: ((msg: NetMessage, from: string) => void)[] = [];
  private joinCbs: ((peer: string) => void)[] = [];
  private leaveCbs: ((peer: string) => void)[] = [];

  constructor(
    readonly selfId: string,
    private net: FakeNetwork,
  ) {}

  send(msg: NetMessage, to?: string): void {
    this.net.deliver(this.selfId, msg, to);
  }
  onMessage(cb: (msg: NetMessage, from: string) => void): void {
    this.msgCbs.push(cb);
  }
  onPeerJoin(cb: (peer: string) => void): void {
    this.joinCbs.push(cb);
  }
  onPeerLeave(cb: (peer: string) => void): void {
    this.leaveCbs.push(cb);
  }
  leave(): void {
    this.net.leave(this.selfId);
  }
  emitMessage(msg: NetMessage, from: string): void {
    this.msgCbs.forEach((cb) => cb(msg, from));
  }
  emitJoin(peer: string): void {
    this.joinCbs.forEach((cb) => cb(peer));
  }
  emitLeave(peer: string): void {
    this.leaveCbs.forEach((cb) => cb(peer));
  }
}

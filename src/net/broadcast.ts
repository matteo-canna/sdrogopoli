// Canale tra le schede dello stesso browser (BroadcastChannel). Serve per i test nel browser e
// per provare l'online su un solo dispositivo; tra dispositivi diversi si usa Trystero.
import type { NetMessage } from './protocol';
import type { Transport } from './transport';

type Envelope =
  | { k: 'hi'; from: string; to?: string }
  | { k: 'bye'; from: string }
  | { k: 'msg'; from: string; to?: string; msg: NetMessage };

export class BroadcastTransport implements Transport {
  readonly selfId = Math.random().toString(36).slice(2, 10);
  private channel: BroadcastChannel;
  private peers = new Set<string>();
  private msgCbs: ((msg: NetMessage, from: string) => void)[] = [];
  private joinCbs: ((peer: string) => void)[] = [];
  private leaveCbs: ((peer: string) => void)[] = [];

  constructor(room: string) {
    this.channel = new BroadcastChannel(`sdrogopoli-${room}`);
    this.channel.onmessage = (e: MessageEvent<Envelope>) => this.receive(e.data);
    this.post({ k: 'hi', from: this.selfId });
  }

  private post(env: Envelope): void {
    this.channel.postMessage(env);
  }

  private receive(env: Envelope): void {
    if (env.from === this.selfId || ('to' in env && env.to && env.to !== this.selfId)) return;
    if (env.k === 'hi') {
      if (this.peers.has(env.from)) return;
      this.peers.add(env.from);
      // si risponde a chi è appena arrivato, così si conoscono entrambi
      this.post({ k: 'hi', from: this.selfId, to: env.from });
      this.joinCbs.forEach((cb) => cb(env.from));
    } else if (env.k === 'bye') {
      if (this.peers.delete(env.from)) this.leaveCbs.forEach((cb) => cb(env.from));
    } else if (this.peers.has(env.from)) {
      this.msgCbs.forEach((cb) => cb(env.msg, env.from));
    }
  }

  send(msg: NetMessage, to?: string): void {
    this.post({ k: 'msg', from: this.selfId, to, msg });
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
    this.post({ k: 'bye', from: this.selfId });
    this.channel.close();
  }
}

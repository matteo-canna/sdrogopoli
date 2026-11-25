// Canale tra dispositivi diversi: WebRTC diretto tra i browser con Trystero. Per trovarsi usa
// relay Nostr pubblici e gratuiti; dopo, i messaggi della partita vanno da un browser all'altro.
import { joinRoom } from 'trystero';
import type { NetMessage } from './protocol';
import type { Transport } from './transport';

const APP_ID = 'matteo-canna.github.io/sdrogopoli';

export class TrysteroTransport implements Transport {
  readonly selfId = '';
  private room: ReturnType<typeof joinRoom>;
  private channel;

  constructor(code: string) {
    // identità usa e getta: due schede dello stesso browser sono due giocatori diversi
    this.room = joinRoom({ appId: APP_ID, identity: 'none' }, code);
    this.channel = this.room.makeAction<NetMessage>('sdrogo');
  }

  send(msg: NetMessage, to?: string): void {
    void this.channel.send(msg, to ? { target: to } : undefined).catch(() => {});
  }
  onMessage(cb: (msg: NetMessage, from: string) => void): void {
    this.channel.onMessage((data, ctx) => cb(data, ctx.peerId));
  }
  onPeerJoin(cb: (peer: string) => void): void {
    this.room.onPeerJoin((ctx) => cb(ctx.peerId));
  }
  onPeerLeave(cb: (peer: string) => void): void {
    this.room.onPeerLeave((ctx) => cb(ctx.peerId));
  }
  leave(): void {
    void this.room.leave().catch(() => {});
  }
}

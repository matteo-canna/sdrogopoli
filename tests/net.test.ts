import { describe, expect, it } from 'vitest';
import { board, cards } from '../src/data';
import { actingPlayer, chooseBotAction, type Action, type GameState } from '../src/engine';
import { GuestRoom } from '../src/net/guest';
import { HostRoom } from '../src/net/host';
import { FakeNetwork } from '../src/net/transport';

const ctx = { board, cards };

function table(guestNames = ['Bea', 'Ciro', 'Dora']) {
  const net = new FakeNetwork();
  const host = new HostRoom(net.join('oste'), ctx, 'Ada', null);
  const guests = guestNames.map((n, i) => new GuestRoom(net.join(`ospite${i}`), n));
  net.flush();
  return { net, host, guests };
}

function started(guestNames?: string[], maxRounds = 30) {
  const t = table(guestNames);
  t.guests.forEach((g) => g.setReady(true));
  t.net.flush();
  t.host.start({ maxRounds }, 42);
  t.net.flush();
  return t;
}

describe('tavolo online (rete finta)', () => {
  it('chi entra compare nella lista del tavolo, con il nome ripulito', () => {
    const { net, host, guests } = table(['Bea', '   ', 'Un nome davvero troppo lungo per il tavolo']);
    guests[0].setReady(true);
    net.flush();
    expect(host.members.map((m) => m.name)).toEqual(['Ada', 'Bea', 'Ospite 2', 'Un nome davvero trop']);
    expect(guests[2].members.map((m) => m.ready)).toEqual([true, true, false, false]);
  });

  it('quattro dispositivi finiscono una partita e vedono lo stesso stato', () => {
    const { net, host, guests } = started();
    expect(guests.map((g) => g.seat)).toEqual([1, 2, 3]);
    let turns = 0;
    while (host.state!.phase !== 'gameOver' && turns < 20_000) {
      turns++;
      const who = actingPlayer(host.state!);
      if (who === 0) {
        expect(host.act(chooseBotAction(host.state!, ctx))).toBeNull();
      } else {
        // ogni ospite decide sul proprio schermo, con lo stato che ha ricevuto
        const g = guests.find((x) => x.seat === who)!;
        g.send(chooseBotAction(g.state!, ctx));
      }
      net.flush();
      for (const g of guests) expect(g.lastError).toBe('');
    }
    expect(host.state!.phase).toBe('gameOver');
    for (const g of guests) expect(g.state).toEqual(host.state);
  });

  it('i posti del computer li muove l\'oste', () => {
    const { net, host, guests } = table(['Bea']);
    host.setComputers(2);
    net.flush();
    expect(guests[0].computers).toBe(2);
    host.start({ maxRounds: 5 }, 1);
    net.flush();
    expect(host.state!.players.map((p) => !!p.isBot)).toEqual([false, false, true, true]);
    expect(host.isComputerSeat(2)).toBe(true);
    expect(host.isComputerSeat(1)).toBe(false);
  });

  it('una mossa fuori turno o malformata viene rifiutata', () => {
    const { net, host, guests } = started();
    expect(actingPlayer(host.state!)).toBe(0);
    guests[1].send({ type: 'roll' });
    net.flush();
    expect(guests[1].lastError).toBe('Non è il tuo turno.');
    // l'oste fa il suo turno, poi tocca a Bea: una mossa senza senso non ferma la partita
    while (actingPlayer(host.state!) === 0) host.act(chooseBotAction(host.state!, ctx));
    net.flush();
    guests[0].send({ type: 'buy', nonEsiste: true } as unknown as Action);
    guests[0].send({ type: 'chissà' } as unknown as Action);
    net.flush();
    expect(guests[0].lastError).not.toBe('');
    expect(host.state!.phase).not.toBe('gameOver');
  });

  it('chi arriva a partita iniziata guarda soltanto', () => {
    const { net, host } = started(['Bea']);
    const late = new GuestRoom(net.join('ritardatario'), 'Eva');
    net.flush();
    expect(late.seat).toBeNull();
    expect(late.state).toEqual(host.state);
  });

  it('se un ospite esce gioca il computer, e chi rientra riprende il posto', () => {
    const { net, host } = started();
    net.leave('ospite1');
    net.flush();
    expect(host.isComputerSeat(2)).toBe(true);
    const back = new GuestRoom(net.join('ospite1-di-nuovo'), 'Ciro');
    net.flush();
    expect(back.seat).toBe(2);
    expect(host.isComputerSeat(2)).toBe(false);
  });

  it('l\'oste che chiude il tavolo avvisa tutti', () => {
    const { net, host, guests } = table(['Bea']);
    let state: GameState | null = null;
    guests[0].onChange = (_p, s) => (state = s);
    host.close();
    net.flush();
    expect(guests[0].closed).toContain('chiuso');
    expect(state).toBeNull();
  });
});

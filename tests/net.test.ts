import { describe, expect, it } from 'vitest';
import { board, cards } from '../src/data';
import { actingPlayer, chooseBotAction, createGame } from '../src/engine';
import { GuestRoom } from '../src/net/guest';
import { HostRoom } from '../src/net/host';
import { FakeNetwork } from '../src/net/transport';

const ctx = { board, cards };

function table(players = 4, maxRounds = 30) {
  const net = new FakeNetwork();
  const names = ['Ada', 'Bea', 'Ciro', 'Dora'].slice(0, players);
  const state = createGame(names, ctx, { maxRounds }, 42);
  const host = new HostRoom(net.join('oste'), ctx, state, [1, 2, 3].slice(0, players - 1), 0);
  const guests = names.slice(1).map((n, i) => new GuestRoom(net.join(`ospite${i}`), n));
  net.flush();
  return { net, host, guests };
}

describe('partita online (rete finta)', () => {
  it('quattro dispositivi finiscono una partita e vedono lo stesso stato', () => {
    const { net, host, guests } = table();
    expect(guests.map((g) => g.seat)).toEqual([1, 2, 3]);
    let turns = 0;
    while (host.state.phase !== 'gameOver' && turns < 20_000) {
      turns++;
      const who = actingPlayer(host.state);
      if (who === 0) {
        expect(host.act(chooseBotAction(host.state, ctx))).toBeNull();
      } else {
        // ogni ospite decide sul proprio schermo, con lo stato che ha ricevuto
        const g = guests.find((x) => x.seat === who)!;
        g.send(chooseBotAction(g.state!, ctx));
      }
      net.flush();
      for (const g of guests) expect(g.lastError).toBe('');
    }
    expect(host.state.phase).toBe('gameOver');
    for (const g of guests) expect(g.state).toEqual(host.state);
  });

  it('una mossa fuori turno viene rifiutata', () => {
    const { net, host, guests } = table();
    expect(actingPlayer(host.state)).toBe(0);
    guests[1].send({ type: 'roll' });
    net.flush();
    expect(guests[1].lastError).toBe('Non è il tuo turno.');
    expect(host.moves).toBe(0);
  });

  it('a tavolo pieno chi arriva guarda soltanto', () => {
    const { net, host } = table(2);
    const late = new GuestRoom(net.join('ritardatario'), 'Eva');
    const late2 = new GuestRoom(net.join('ritardatario2'), 'Fede');
    net.flush();
    // il posto libero (il 2° giocatore) l'ha già preso Bea
    expect([late.seat, late2.seat]).toEqual([null, null]);
    expect(late2.state).toEqual(host.state);
  });

  it('un posto senza nessuno collegato lo muove il computer', () => {
    const { net, host, guests } = table(3);
    expect(guests[1].seat).toBe(2);
    // l'ospite del posto 2 se ne va
    net.leave('ospite1');
    net.flush();
    expect(host.isComputerSeat(2)).toBe(true);
    expect(host.isComputerSeat(1)).toBe(false);
  });
});

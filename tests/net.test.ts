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

  it('chi ricarica la pagina riprende il suo posto, non quello di un altro', () => {
    const net = new FakeNetwork();
    const host = new HostRoom(net.join('oste'), ctx, 'Ada', null);
    const guests = ['Bea', 'Ciro'].map((n, i) => new GuestRoom(net.join(`ospite${i}`), n, null, `chiave-${n}`));
    net.flush();
    guests.forEach((g) => g.setReady(true));
    net.flush();
    host.start({ maxRounds: 5 }, 3);
    net.flush();
    // escono tutti e due; rientra prima Ciro, poi Bea
    net.leave('ospite0');
    net.leave('ospite1');
    net.flush();
    expect(host.offlineSeats()).toEqual([1, 2]);
    const ciro = new GuestRoom(net.join('ciro-2'), 'Ciro', null, 'chiave-Ciro');
    net.flush();
    const bea = new GuestRoom(net.join('bea-2'), 'Bea', null, 'chiave-Bea');
    net.flush();
    expect(ciro.seat).toBe(2);
    expect(bea.seat).toBe(1);
    expect(bea.offline).toEqual([]);
  });

  it('gli altri vedono chi è scollegato', () => {
    const { net, host, guests } = started();
    net.leave('ospite2');
    net.flush();
    expect(host.offlineSeats()).toEqual([3]);
    expect(guests[0].offline).toEqual([3]);
  });

  it('a tempo scaduto gioca il computer, finché la persona non torna a muovere', () => {
    let now = 0;
    const net = new FakeNetwork();
    const host = new HostRoom(net.join('oste'), ctx, 'Ada', null, () => now);
    const bea = new GuestRoom(net.join('bea'), 'Bea', null, 'k', () => now);
    net.flush();
    bea.setReady(true);
    net.flush();
    host.start({ maxRounds: 5 }, 9);
    host.setTurnLimit(60_000);
    net.flush();
    expect(host.timeLeft()).toBe(60_000);
    expect(bea.limitMs).toBe(60_000);
    now = 59_000;
    expect(host.checkTimer()).toBe(false);
    now = 60_000;
    // tocca ad Ada (l'oste): il tempo è scaduto
    expect(host.checkTimer()).toBe(true);
    net.flush();
    expect(host.isComputerSeat(0)).toBe(true);
    expect(bea.away).toEqual([0]);
    // il computer gioca per Ada finché non tocca a Bea
    while (actingPlayer(host.state!) === 0) expect(host.stepComputer()).toBe(true);
    net.flush();
    // Bea gioca da sé: Ada resta "via" finché non fa una mossa sua
    expect(host.isComputerSeat(1)).toBe(false);
    while (actingPlayer(host.state!) === 1) {
      bea.send(chooseBotAction(bea.state!, ctx));
      net.flush();
    }
    expect(host.isComputerSeat(0)).toBe(true);
    // Ada tocca un pulsante: torna a giocare lei
    expect(host.act(chooseBotAction(host.state!, ctx))).toBeNull();
    expect(host.away.size).toBe(0);
  });

  it("l'oste che ricarica la pagina riprende il tavolo e gli ospiti tornano ai loro posti", () => {
    const net = new FakeNetwork();
    const host = new HostRoom(net.join('oste'), ctx, 'Ada', null);
    const bea = new GuestRoom(net.join('bea'), 'Bea', null, 'chiave-bea');
    let left = 0;
    let back = 0;
    bea.onHostLeft = () => left++;
    bea.onHostBack = () => back++;
    net.flush();
    bea.setReady(true);
    net.flush();
    host.start({ maxRounds: 5 }, 4);
    net.flush();
    while (actingPlayer(host.state!) === 0) host.act(chooseBotAction(host.state!, ctx));
    net.flush();
    const snap = JSON.parse(JSON.stringify(host.snapshot()));
    net.leave('oste');
    net.flush();
    expect(left).toBe(1);
    const again = new HostRoom(net.join('oste-2'), ctx, 'Ada', null);
    again.restore(snap);
    net.flush();
    expect(back).toBe(1);
    expect(bea.seat).toBe(1);
    expect(again.isComputerSeat(1)).toBe(false);
    expect(bea.state).toEqual(again.state);
    // la partita va avanti
    bea.send(chooseBotAction(bea.state!, ctx));
    net.flush();
    expect(bea.lastError).toBe('');
    expect(again.moves).toBe(snap.moves + 1);
  });
});

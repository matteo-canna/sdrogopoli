import { describe, expect, it } from 'vitest';
import { board, cards } from '../src/data';
import { GuestRoom } from '../src/net/guest';
import { HostRoom } from '../src/net/host';
import { FakeNetwork } from '../src/net/transport';
import { turnServers } from '../src/net/turn';
import { QUICK_SAYS } from '../src/net/chat';

describe('reazioni al tavolo', () => {
  it('arrivano a tutti, solo quelle previste e non troppo spesso', () => {
    let now = 0;
    const net = new FakeNetwork();
    const host = new HostRoom(net.join('oste'), { board, cards }, 'Ada', null, () => now);
    const bea = new GuestRoom(net.join('bea'), 'Bea');
    const eva = new GuestRoom(net.join('eva'), 'Eva');
    const heard: string[] = [];
    host.onSaid = (seat, id) => heard.push(`oste:${seat}:${id}`);
    eva.onSaid = (seat, id) => heard.push(`eva:${seat}:${id}`);
    net.flush();
    bea.setReady(true);
    eva.setReady(true);
    net.flush();
    host.start({}, 1);
    net.flush();
    bea.say('applausi');
    net.flush();
    expect(heard).toEqual(['oste:1:applausi', 'eva:1:applausi']);
    // troppo presto, o una frase inventata: scartate
    bea.say('risata');
    bea.say('<img src=x>');
    net.flush();
    expect(heard).toHaveLength(2);
    now = 2000;
    expect(host.say(0, 'ciao')).toBe(true);
    net.flush();
    expect(heard.slice(2)).toEqual(['oste:0:ciao', 'eva:0:ciao']);
  });

  it('ogni reazione ha un id unico', () => {
    expect(new Set(QUICK_SAYS.map((q) => q.id)).size).toBe(QUICK_SAYS.length);
  });
});

describe('server TURN di riserva', () => {
  it('si usano solo se configurati, e solo indirizzi turn:', () => {
    expect(turnServers({})).toEqual([]);
    expect(turnServers({ VITE_TURN_URLS: 'http://x, turn:a.org:80 , turns:a.org:443', VITE_TURN_USER: 'u', VITE_TURN_PASS: 'p' })).toEqual([
      { urls: ['turn:a.org:80', 'turns:a.org:443'], username: 'u', credential: 'p' },
    ]);
  });
});

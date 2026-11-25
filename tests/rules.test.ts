import { describe, it, expect } from 'vitest';
import { board, cards } from '../src/data';
import { applyAction, createGame, computeRent, RuleError, JAIL_FINE, unmortgageCost, netWorth, MAX_LOG, actingPlayer, seededRng, QUICK_START_PROPERTIES, MAX_PLAYERS, quickStartProperties, demoRules, DEMO_ROUNDS, DEMO_SEAT_BONUS, DEMO_MAX_PLAYERS, maxPlayers, liquidationValue, debtOptions } from '../src/engine';
import { ctxWith, newGame, indexOf, own } from './helpers';

const salary = 200;

describe('inizio partita', () => {
  it('ogni giocatore parte con i soldi iniziali sulla Partenza', () => {
    const s = newGame(['A', 'B', 'C']);
    expect(s.players.map((p) => p.money)).toEqual([1500, 1500, 1500]);
    expect(s.players.every((p) => p.position === 0)).toBe(true);
    expect(s.phase).toBe('roll');
  });

  it('servono da 2 a 8 giocatori', () => {
    const ctx = { board, cards, rng: Math.random };
    const names = (n: number) => Array.from({ length: n }, (_, i) => `G${i + 1}`);
    expect(MAX_PLAYERS).toBe(8);
    expect(() => createGame(['Solo'], ctx)).toThrow();
    expect(createGame(names(5), ctx).players).toHaveLength(5);
    expect(createGame(names(8), ctx).players).toHaveLength(8);
    expect(() => createGame(names(9), ctx)).toThrow();
  });

  it('modalità demo: fino a 12 giocatori, con 20 giri e bonus del posto di 20', () => {
    const ctx = { board, cards, rng: Math.random };
    const names = (n: number) => Array.from({ length: n }, (_, i) => `G${i + 1}`);
    expect(() => createGame(names(9), ctx)).toThrow();
    const s = createGame(names(12), ctx, demoRules());
    expect(s.players).toHaveLength(12);
    expect(s.rules.demo).toBe(true);
    expect(s.rules.maxRounds).toBe(DEMO_ROUNDS);
    expect(s.players[11].money).toBe(1500 + 11 * DEMO_SEAT_BONUS);
    expect(() => createGame(names(DEMO_MAX_PLAYERS + 1), ctx, demoRules())).toThrow();
    expect(maxPlayers({ demo: false })).toBe(8);
    expect(maxPlayers({ demo: true })).toBe(12);
  });

  it('partita rapida in 12 (demo): 1 proprietà a testa', () => {
    const s = createGame(Array.from({ length: 12 }, (_, i) => `G${i + 1}`), { board, cards, rng: seededRng(5) }, { ...demoRules(), quickStart: true });
    const owned = Object.values(s.ownership);
    expect(owned).toHaveLength(12);
    for (const p of s.players) expect(owned.filter((o) => o.owner === p.id)).toHaveLength(1);
  });

  it('in 8 il bonus del posto arriva a 210 per l\'ultimo', () => {
    const s = createGame(Array.from({ length: 8 }, (_, i) => `G${i + 1}`), { board, cards, rng: Math.random });
    expect(s.players.map((p) => p.money)).toEqual([1500, 1530, 1560, 1590, 1620, 1650, 1680, 1710]);
  });

  it("l'aspetto della pedina scelto all'inizio resta nella partita", () => {
    const ctx = { board, cards, rng: Math.random };
    const look = { character: 'mage', color: '#123456', hat: false, cape: true, item: 'Spellbook' };
    const s = createGame([{ name: 'A', appearance: look }, 'B'], ctx);
    expect(s.players[0].appearance).toEqual(look);
    expect(s.players[0].appearance).not.toBe(look);
    expect(s.players[1].appearance).toBeUndefined();
  });

  it('i mazzi contengono tutte le carte', () => {
    const s = newGame();
    expect(s.decks.sorte.length + s.decks.quartiere.length).toBe(cards.cards.length);
  });
});

describe('movimento e acquisto', () => {
  it('lancio, movimento e proposta di acquisto su una via libera', () => {
    let s = applyAction(newGame(), { type: 'roll' }, ctxWith(1, 2)); // 3 -> Via del Cassonetto
    expect(s.players[0].position).toBe(3);
    expect(s.phase).toBe('buy');
    s = applyAction(s, { type: 'buy' }, ctxWith());
    expect(s.ownership['periferia-2'].owner).toBe(0);
    expect(s.players[0].money).toBe(1500 - 60);
    expect(s.phase).toBe('endTurn');
  });

  it('rinunciando all\'acquisto la casella va all\'asta', () => {
    let s = applyAction(newGame(), { type: 'roll' }, ctxWith(1, 2));
    s = applyAction(s, { type: 'decline' }, ctxWith());
    expect(s.ownership['periferia-2']).toBeUndefined();
    expect(s.phase).toBe('auction');
    expect(s.auction?.bidders).toEqual([0, 1]);
  });

  it('non si compra senza soldi a sufficienza', () => {
    let s = newGame();
    s.players[0].money = 10;
    s = applyAction(s, { type: 'roll' }, ctxWith(1, 2));
    expect(() => applyAction(s, { type: 'buy' }, ctxWith())).toThrow(RuleError);
  });

  it('passando dalla Partenza si incassa lo stipendio', () => {
    const s0 = newGame();
    s0.players[0].position = 38;
    const s = applyAction(s0, { type: 'roll' }, ctxWith(2, 3)); // 38 + 5 = 3
    expect(s.players[0].position).toBe(3);
    expect(s.players[0].money).toBe(1500 + salary);
  });

  it('i turni passano al giocatore successivo', () => {
    let s = applyAction(newGame(), { type: 'roll' }, ctxWith(1, 3)); // 4 = tassa
    s = applyAction(s, { type: 'endTurn' }, ctxWith());
    expect(s.current).toBe(1);
    expect(s.phase).toBe('roll');
  });

  it('non si può fare un\'azione nella fase sbagliata', () => {
    expect(() => applyAction(newGame(), { type: 'endTurn' }, ctxWith())).toThrow(RuleError);
    expect(() => applyAction(newGame(), { type: 'buy' }, ctxWith())).toThrow(RuleError);
  });

  it('lo stato precedente non viene modificato', () => {
    const s0 = newGame();
    applyAction(s0, { type: 'roll' }, ctxWith(1, 2));
    expect(s0.players[0].position).toBe(0);
  });
});

describe('affitti e tasse', () => {
  it('si paga l\'affitto al proprietario', () => {
    const s0 = newGame();
    own(s0, 'periferia-2', 1);
    const s = applyAction(s0, { type: 'roll' }, ctxWith(1, 2));
    expect(s.players[0].money).toBe(1500 - 4);
    expect(s.players[1].money).toBe(1500 + 4);
  });

  it('affitto doppio con tutto il quartiere e affitto pieno con le case', () => {
    const s = newGame();
    own(s, 'periferia-1', 1);
    own(s, 'periferia-2', 1);
    const ctx = ctxWith();
    expect(computeRent(s, ctx, 'periferia-2', 0)).toBe(8);
    s.ownership['periferia-2'].houses = 2;
    expect(computeRent(s, ctx, 'periferia-2', 0)).toBe(80);
  });

  it('nessun affitto su una casella ipotecata', () => {
    const s = newGame();
    own(s, 'periferia-2', 1, 0, true);
    expect(computeRent(s, ctxWith(), 'periferia-2', 0)).toBe(0);
  });

  it('l\'affitto delle fermate cresce con il numero di fermate', () => {
    const s = newGame();
    own(s, 'fermata-nord', 1);
    expect(computeRent(s, ctxWith(), 'fermata-nord', 0)).toBe(25);
    own(s, 'fermata-est', 1);
    own(s, 'fermata-sud', 1);
    expect(computeRent(s, ctxWith(), 'fermata-nord', 0)).toBe(100);
  });

  it('l\'affitto dei servizi dipende dal lancio dei dadi', () => {
    const s = newGame();
    own(s, 'acquedotto', 1);
    expect(computeRent(s, ctxWith(), 'acquedotto', 7)).toBe(28);
    own(s, 'centrale', 1);
    expect(computeRent(s, ctxWith(), 'acquedotto', 7)).toBe(70);
  });

  it('sulla casella tassa si paga alla banca', () => {
    const s = applyAction(newGame(), { type: 'roll' }, ctxWith(1, 3));
    expect(s.players[0].money).toBe(1500 - 200);
  });
});

describe('doppi e Caserma', () => {
  it('con un doppio si rilancia', () => {
    const s = applyAction(newGame(), { type: 'roll' }, ctxWith(1, 1)); // 2 = carta
    expect(s.phase).toBe('roll');
    expect(s.extraRoll).toBe(true);
  });

  it('tre doppi di fila mandano in Caserma', () => {
    const s0 = newGame();
    s0.doublesInRow = 2;
    const s = applyAction(s0, { type: 'roll' }, ctxWith(3, 3));
    expect(s.players[0].inJail).toBe(true);
    expect(s.players[0].position).toBe(indexOf('caserma'));
    expect(s.phase).toBe('endTurn');
  });

  it('la casella "Fermato dai Vigili" manda in Caserma senza stipendio', () => {
    const s0 = newGame();
    s0.players[0].position = 25;
    const s = applyAction(s0, { type: 'roll' }, ctxWith(2, 3));
    expect(s.players[0].inJail).toBe(true);
    expect(s.players[0].position).toBe(10);
    expect(s.players[0].money).toBe(1500);
  });

  function jailed() {
    const s = newGame();
    s.players[0].inJail = true;
    s.players[0].position = indexOf('caserma');
    return s;
  }

  it('in Caserma un doppio fa uscire e muovere, ma senza rilanciare', () => {
    const s = applyAction(jailed(), { type: 'roll' }, ctxWith(1, 1)); // 10 + 2 = 12 acquedotto
    expect(s.players[0].inJail).toBe(false);
    expect(s.players[0].position).toBe(12);
    expect(s.phase).toBe('buy');
    expect(s.extraRoll).toBe(false);
  });

  it('in Caserma senza doppio si resta dentro', () => {
    const s = applyAction(jailed(), { type: 'roll' }, ctxWith(1, 2));
    expect(s.players[0].inJail).toBe(true);
    expect(s.players[0].jailAttempts).toBe(1);
    expect(s.phase).toBe('endTurn');
  });

  it('al terzo tentativo fallito si paga la multa e si esce', () => {
    const s0 = jailed();
    s0.players[0].jailAttempts = 2;
    const s = applyAction(s0, { type: 'roll' }, ctxWith(1, 3)); // 10 + 4 = 14
    expect(s.players[0].inJail).toBe(false);
    expect(s.players[0].position).toBe(14);
    expect(s.players[0].money).toBe(1500 - JAIL_FINE);
  });

  it('si può pagare la multa prima di lanciare', () => {
    const s = applyAction(jailed(), { type: 'payJailFine' }, ctxWith());
    expect(s.players[0].inJail).toBe(false);
    expect(s.players[0].money).toBe(1500 - JAIL_FINE);
    expect(s.phase).toBe('roll');
  });

  it('la carta "esci gratis" fa uscire e torna nel mazzo', () => {
    const s0 = jailed();
    s0.decks.sorte = s0.decks.sorte.filter((id) => id !== 'sorte-10');
    s0.players[0].jailCards = ['sorte-10'];
    const s = applyAction(s0, { type: 'useJailCard' }, ctxWith());
    expect(s.players[0].inJail).toBe(false);
    expect(s.players[0].jailCards).toEqual([]);
    expect(s.decks.sorte.at(-1)).toBe('sorte-10');
  });
});

describe('carte', () => {
  // Mette la carta indicata in cima al mazzo e fa arrivare il giocatore su una casella carta.
  function drawing(cardId: string, deck: 'sorte' | 'quartiere') {
    const s = newGame();
    s.decks[deck] = [cardId, ...s.decks[deck].filter((id) => id !== cardId)];
    s.players[0].position = deck === 'quartiere' ? 0 : 5; // 0+2 = quartiere-1, 5+2 = sorte-1
    return s;
  }

  it('una carta di guadagno dà i soldi e torna in fondo al mazzo', () => {
    const s = applyAction(drawing('quartiere-01', 'quartiere'), { type: 'roll' }, ctxWith(1, 1));
    expect(s.players[0].money).toBe(1610);
    expect(s.decks.quartiere.at(-1)).toBe('quartiere-01');
  });

  it('"torna alla Partenza" sposta e paga lo stipendio', () => {
    const s = applyAction(drawing('sorte-01', 'sorte'), { type: 'roll' }, ctxWith(1, 1));
    expect(s.players[0].position).toBe(0);
    expect(s.players[0].money).toBe(1500 + salary);
  });

  it('"indietro di 2" porta su un\'altra casella e la risolve', () => {
    const s = applyAction(drawing('sorte-04', 'sorte'), { type: 'roll' }, ctxWith(1, 1)); // 7 - 2 = 5 fermata
    expect(s.players[0].position).toBe(5);
    expect(s.phase).toBe('buy');
  });

  it('"fermata più vicina" porta alla prossima fermata', () => {
    const s = applyAction(drawing('sorte-05', 'sorte'), { type: 'roll' }, ctxWith(1, 1));
    expect(s.players[0].position).toBe(indexOf('fermata-est'));
    expect(s.phase).toBe('buy');
  });

  it('"compleanno" fa pagare tutti gli altri giocatori', () => {
    const s = applyAction(drawing('quartiere-03', 'quartiere'), { type: 'roll' }, ctxWith(1, 1));
    expect(s.players[0].money).toBe(1515);
    expect(s.players[1].money).toBe(1485);
  });

  it('le riparazioni si pagano per casa e per palazzo', () => {
    const s0 = drawing('sorte-11', 'sorte');
    own(s0, 'borgo-1', 0, 2);
    own(s0, 'borgo-2', 0, 5);
    const s = applyAction(s0, { type: 'roll' }, ctxWith(1, 1));
    expect(s.players[0].money).toBe(1500 - (2 * 30 + 90));
  });

  it('la carta "esci gratis" resta al giocatore e lascia il mazzo', () => {
    const s = applyAction(drawing('sorte-10', 'sorte'), { type: 'roll' }, ctxWith(1, 1));
    expect(s.players[0].jailCards).toEqual(['sorte-10']);
    expect(s.decks.sorte).not.toContain('sorte-10');
  });
});

describe('case, ipoteche e bancarotta', () => {
  function withPeriferia() {
    const s = applyAction(newGame(), { type: 'roll' }, ctxWith(1, 3)); // fase endTurn
    own(s, 'periferia-1', 0);
    own(s, 'periferia-2', 0);
    return s;
  }

  it('si costruisce solo possedendo tutto il quartiere', () => {
    const s = withPeriferia();
    delete s.ownership['periferia-1'];
    expect(() => applyAction(s, { type: 'build', spaceId: 'periferia-2' }, ctxWith())).toThrow(RuleError);
  });

  it('si costruisce in modo uniforme e si paga la casa', () => {
    let s = withPeriferia();
    const money = s.players[0].money;
    s = applyAction(s, { type: 'build', spaceId: 'periferia-1' }, ctxWith());
    expect(s.ownership['periferia-1'].houses).toBe(1);
    expect(s.players[0].money).toBe(money - 50);
    expect(() => applyAction(s, { type: 'build', spaceId: 'periferia-1' }, ctxWith())).toThrow(RuleError);
    s = applyAction(s, { type: 'build', spaceId: 'periferia-2' }, ctxWith());
    expect(s.ownership['periferia-2'].houses).toBe(1);
  });

  it('vendere una casa restituisce metà del prezzo', () => {
    let s = withPeriferia();
    s.ownership['periferia-1'].houses = 1;
    const money = s.players[0].money;
    s = applyAction(s, { type: 'sell', spaceId: 'periferia-1' }, ctxWith());
    expect(s.ownership['periferia-1'].houses).toBe(0);
    expect(s.players[0].money).toBe(money + 25);
  });

  it('ipoteca e riscatto con il 10% di interessi', () => {
    let s = withPeriferia();
    const money = s.players[0].money;
    s = applyAction(s, { type: 'mortgage', spaceId: 'periferia-1' }, ctxWith());
    expect(s.players[0].money).toBe(money + 30);
    s = applyAction(s, { type: 'unmortgage', spaceId: 'periferia-1' }, ctxWith());
    expect(s.players[0].money).toBe(money + 30 - unmortgageCost(30));
    expect(unmortgageCost(30)).toBe(33);
  });

  it('non si ipoteca una via se il quartiere ha case', () => {
    const s = withPeriferia();
    s.ownership['periferia-2'].houses = 1;
    expect(() => applyAction(s, { type: 'mortgage', spaceId: 'periferia-1' }, ctxWith())).toThrow(RuleError);
  });

  it('con un debito non si passa il turno', () => {
    const s0 = newGame();
    s0.players[0].money = 100;
    const s = applyAction(s0, { type: 'roll' }, ctxWith(1, 3)); // tassa 200
    expect(s.players[0].money).toBe(-100);
    expect(() => applyAction(s, { type: 'endTurn' }, ctxWith())).toThrow(RuleError);
  });

  it('la bancarotta verso un giocatore gli cede le proprietà e chiude la partita', () => {
    const s0 = newGame();
    s0.players[0].money = 2;
    own(s0, 'periferia-1', 0, 0, true);
    own(s0, 'periferia-2', 1, 3);
    let s = applyAction(s0, { type: 'roll' }, ctxWith(1, 2)); // affitto 210 con 3 case
    expect(s.players[0].money).toBe(2 - 210);
    expect(s.creditor).toBe(1);
    s = applyAction(s, { type: 'bankrupt' }, ctxWith());
    expect(s.players[0].bankrupt).toBe(true);
    expect(s.ownership['periferia-1'].owner).toBe(1);
    // il creditore riceve solo quello che il fallito aveva, meno il 10% d'interessi sull'ipoteca (30)
    expect(s.players[1].money).toBe(1500 + 2 - 3);
    expect(s.winner).toBe(1);
    expect(s.phase).toBe('gameOver');
  });

  it('con 3 giocatori la bancarotta verso la banca libera le proprietà e la partita continua', () => {
    const s0 = createGame(['A', 'B', 'C'], { board, cards, rng: () => 0.999 });
    s0.players[0].money = 100;
    own(s0, 'periferia-1', 0);
    let s = applyAction(s0, { type: 'roll' }, ctxWith(1, 3));
    s.players[0].money = -100; // l'ipoteca (30) non basta
    s = applyAction(s, { type: 'bankrupt' }, ctxWith());
    expect(s.ownership['periferia-1']).toBeUndefined();
    // la proprietà liberata va all'asta, poi il turno riprende dal giocatore successivo
    expect(s.phase).toBe('auction');
    expect(s.auction!.spaceId).toBe('periferia-1');
    expect(s.current).toBe(1);
    s = applyAction(s, { type: 'bid', amount: 20 }, ctxWith());
    s = applyAction(s, { type: 'pass' }, ctxWith());
    expect(s.ownership['periferia-1'].owner).toBe(1);
    expect(s.phase).toBe('roll');
    expect(s.current).toBe(1);
  });

  it('non si dichiara bancarotta finché vendere o ipotecare basta', () => {
    const s0 = newGame();
    s0.players[0].money = 100;
    own(s0, 'borgo-1', 0);
    const s = applyAction(s0, { type: 'roll' }, ctxWith(1, 3)); // tassa 200: debito di 100
    expect(liquidationValue(s, ctxWith(), 0)).toBeGreaterThanOrEqual(50);
    s.players[0].money = -10;
    expect(() => applyAction(s, { type: 'bankrupt' }, ctxWith())).toThrow(/coprire/);
  });

  it('in bancarotta le case si vendono a metà prezzo e il ricavato va al creditore', () => {
    const s0 = newGame(['A', 'B', 'C']);
    own(s0, 'periferia-1', 0, 1);
    own(s0, 'periferia-2', 0, 1, false);
    own(s0, 'borgo-1', 1, 0);
    let s = applyAction(s0, { type: 'roll' }, ctxWith(1, 2));
    // debito impossibile da coprire verso B
    s.players[0].money = -1000;
    s.creditor = 1;
    const before = s.players[1].money;
    s = applyAction(s, { type: 'bankrupt' }, ctxWith());
    // 2 case da 50 → 50 di ricavato, che riduce quanto B deve restituire
    expect(s.players[1].money).toBe(before - 1000 + 50);
    expect(s.ownership['periferia-1']).toEqual({ owner: 1, houses: 0, mortgaged: false });
  });

  it('chi riceve una casella ipotecata in uno scambio paga il 10% d\'interessi', () => {
    const s0 = newGame();
    own(s0, 'periferia-1', 1, 0, true);
    let s = applyAction(s0, { type: 'proposeTrade', offer: { to: 1, give: { money: 100, spaces: [] }, get: { money: 0, spaces: ['periferia-1'] } } }, ctxWith());
    s = applyAction(s, { type: 'acceptTrade' }, ctxWith());
    expect(s.ownership['periferia-1'].owner).toBe(0);
    expect(s.players[0].money).toBe(1500 - 100 - 3);
    expect(s.players[1].money).toBe(1600);
  });

  it('lo scambio è rifiutato se chi riceve l\'ipoteca non può pagare gli interessi', () => {
    const s0 = newGame();
    own(s0, 'periferia-1', 1, 0, true);
    s0.players[0].money = 100;
    const offer = { to: 1, give: { money: 100, spaces: [] }, get: { money: 0, spaces: ['periferia-1'] } };
    expect(() => applyAction(s0, { type: 'proposeTrade', offer }, ctxWith())).toThrow(/interessi/);
  });

  it('debtOptions elenca prima le case più alte e le ipoteche possibili', () => {
    const s = newGame();
    own(s, 'periferia-1', 0, 2);
    own(s, 'periferia-2', 0, 1);
    own(s, 'borgo-1', 0);
    const opts = debtOptions(s, ctxWith(), 0).map((o) => `${o.action.type}:${'spaceId' in o.action ? o.action.spaceId : ''}`);
    expect(opts).toContain('sell:periferia-1');
    expect(opts).not.toContain('sell:periferia-2');
    expect(opts).not.toContain('mortgage:periferia-1');
    expect(opts).toContain('mortgage:borgo-1');
  });
});

describe('pagamenti fuori turno', () => {
  it('"compleanno": chi non ha soldi paga solo quello che ha', () => {
    const s0 = newGame();
    s0.decks.quartiere = ['quartiere-03', ...s0.decks.quartiere.filter((id) => id !== 'quartiere-03')];
    s0.players[1].money = 4;
    const s = applyAction(s0, { type: 'roll' }, ctxWith(1, 1));
    expect(s.players[1].money).toBe(0);
    expect(s.players[0].money).toBe(1504);
  });
});

describe('patrimonio e registro', () => {
  it('il patrimonio somma contanti, proprietà, case e toglie le ipoteche', () => {
    const s = newGame();
    own(s, 'periferia-1', 0, 2); // 60 + 2 case da 50
    own(s, 'fermata-nord', 0, 0, true); // 200 - 100 di ipoteca
    expect(netWorth(s, ctxWith(), 0)).toBe(1500 + 60 + 100 + 100);
  });

  it('il contatore degli eventi cresce anche quando il registro viene accorciato', () => {
    let s = newGame();
    s.log = Array.from({ length: MAX_LOG }, (_, i) => `evento ${i}`);
    const before = s.eventCount;
    s = applyAction(s, { type: 'roll' }, ctxWith(1, 3));
    expect(s.log.length).toBe(MAX_LOG);
    expect(s.eventCount).toBeGreaterThan(before);
  });
});

describe('aste', () => {
  function auctionOn(names = ['Anna', 'Bruno', 'Carla']) {
    let s = applyAction(newGame(names), { type: 'roll' }, ctxWith(1, 2)); // Via del Cassonetto, 60
    s = applyAction(s, { type: 'decline' }, ctxWith());
    return s;
  }

  it('si rilancia a turno e vince l\'offerta più alta quando gli altri passano', () => {
    let s = auctionOn();
    expect(actingPlayer(s)).toBe(0);
    s = applyAction(s, { type: 'bid', amount: 20 }, ctxWith());
    expect(actingPlayer(s)).toBe(1);
    s = applyAction(s, { type: 'bid', amount: 40 }, ctxWith());
    s = applyAction(s, { type: 'pass' }, ctxWith()); // Carla
    s = applyAction(s, { type: 'pass' }, ctxWith()); // Anna
    expect(s.phase).toBe('endTurn');
    expect(s.ownership['periferia-2'].owner).toBe(1);
    expect(s.players[1].money).toBe(1500 - 40);
    expect(s.auction).toBeNull();
  });

  it('se tutti passano la casella resta libera', () => {
    let s = auctionOn(['Anna', 'Bruno']);
    s = applyAction(s, { type: 'pass' }, ctxWith());
    s = applyAction(s, { type: 'pass' }, ctxWith());
    expect(s.ownership['periferia-2']).toBeUndefined();
    expect(s.phase).toBe('endTurn');
  });

  it('l\'offerta deve superare quella attuale e stare nei soldi disponibili', () => {
    let s = auctionOn();
    s = applyAction(s, { type: 'bid', amount: 30 }, ctxWith());
    expect(() => applyAction(s, { type: 'bid', amount: 30 }, ctxWith())).toThrow(RuleError);
    expect(() => applyAction(s, { type: 'bid', amount: 5000 }, ctxWith())).toThrow(RuleError);
  });

  it('dopo un\'asta con doppio si rilancia', () => {
    let s = newGame(['Anna', 'Bruno']);
    s.players[0].position = 1;
    s = applyAction(s, { type: 'roll' }, ctxWith(1, 1)); // 1 + 2 = 3, doppio
    s = applyAction(s, { type: 'decline' }, ctxWith());
    s = applyAction(s, { type: 'pass' }, ctxWith());
    s = applyAction(s, { type: 'pass' }, ctxWith());
    expect(s.phase).toBe('roll');
  });
});

describe('scambi', () => {
  function endTurnState() {
    const s = applyAction(newGame(['Anna', 'Bruno', 'Carla']), { type: 'roll' }, ctxWith(1, 3));
    own(s, 'periferia-1', 0);
    own(s, 'periferia-2', 1);
    return s;
  }

  it('uno scambio accettato sposta soldi e caselle', () => {
    let s = endTurnState();
    s = applyAction(s, { type: 'proposeTrade', offer: { to: 1, give: { money: 100, spaces: [] }, get: { money: 0, spaces: ['periferia-2'] } } }, ctxWith());
    expect(actingPlayer(s)).toBe(1);
    const moneyA = s.players[0].money;
    s = applyAction(s, { type: 'acceptTrade' }, ctxWith());
    expect(s.ownership['periferia-2'].owner).toBe(0);
    expect(s.players[0].money).toBe(moneyA - 100);
    expect(s.players[1].money).toBe(1600);
    expect(s.trade).toBeNull();
    expect(actingPlayer(s)).toBe(0);
  });

  it('uno scambio rifiutato non cambia nulla', () => {
    let s = endTurnState();
    s = applyAction(s, { type: 'proposeTrade', offer: { to: 1, give: { money: 10, spaces: [] }, get: { money: 0, spaces: ['periferia-2'] } } }, ctxWith());
    s = applyAction(s, { type: 'rejectTrade' }, ctxWith());
    expect(s.ownership['periferia-2'].owner).toBe(1);
    expect(s.trade).toBeNull();
  });

  it('con uno scambio in sospeso non si fanno altre azioni', () => {
    const s = applyAction(endTurnState(), { type: 'proposeTrade', offer: { to: 1, give: { money: 10, spaces: [] }, get: { money: 0, spaces: [] } } }, ctxWith());
    expect(() => applyAction(s, { type: 'endTurn' }, ctxWith())).toThrow(RuleError);
  });

  it('non si scambiano caselle altrui o di quartieri con case', () => {
    const s = endTurnState();
    expect(() => applyAction(s, { type: 'proposeTrade', offer: { to: 1, give: { money: 0, spaces: ['periferia-2'] }, get: { money: 0, spaces: [] } } }, ctxWith())).toThrow(RuleError);
    own(s, 'borgo-1', 1, 1);
    expect(() => applyAction(s, { type: 'proposeTrade', offer: { to: 1, give: { money: 0, spaces: [] }, get: { money: 0, spaces: ['borgo-1'] } } }, ctxWith())).toThrow(RuleError);
  });

  it('non si offrono più soldi di quelli che si hanno', () => {
    const s = endTurnState();
    expect(() => applyAction(s, { type: 'proposeTrade', offer: { to: 1, give: { money: 99999, spaces: [] }, get: { money: 0, spaces: ['periferia-2'] } } }, ctxWith())).toThrow(RuleError);
  });
});

describe('regole della casa', () => {
  const ctx0 = { board, cards, rng: () => 0.999 };

  it('i soldi iniziali si possono scegliere', () => {
    const s = createGame(['A', 'B'], ctx0, { startingMoney: 2000, seatBonus: 0 });
    expect(s.players.map((p) => p.money)).toEqual([2000, 2000]);
    expect(s.rules.maxRounds).toBeNull();
  });

  it('i giri aumentano quando il turno torna al primo giocatore', () => {
    let s = createGame(['A', 'B'], ctx0);
    s = applyAction(s, { type: 'roll' }, ctxWith(1, 3));
    s = applyAction(s, { type: 'endTurn' }, ctxWith());
    expect(s.round).toBe(1);
    s = applyAction(s, { type: 'roll' }, ctxWith(1, 3));
    s = applyAction(s, { type: 'endTurn' }, ctxWith());
    expect(s.round).toBe(2);
  });

  it('a fine giri vince il patrimonio più alto', () => {
    let s = createGame(['A', 'B'], ctx0, { maxRounds: 1 });
    own(s, 'lungolago-2', 1);
    s = applyAction(s, { type: 'roll' }, ctxWith(1, 3)); // A paga 200 di tasse
    s = applyAction(s, { type: 'endTurn' }, ctxWith());
    s = applyAction(s, { type: 'roll' }, ctxWith(1, 3));
    s = applyAction(s, { type: 'endTurn' }, ctxWith());
    expect(s.phase).toBe('gameOver');
    expect(s.winner).toBe(1);
  });

  it('montepremi: tasse e multe vanno sulla Panchina e chi ci arriva le incassa', () => {
    let s = createGame(['A', 'B'], ctx0, { parkPot: true, seatBonus: 0 });
    s = applyAction(s, { type: 'roll' }, ctxWith(1, 3)); // tassa 200
    expect(s.pot).toBe(200);
    s = applyAction(s, { type: 'endTurn' }, ctxWith());
    s.players[1].position = 15;
    s = applyAction(s, { type: 'roll' }, ctxWith(2, 3)); // 15 + 5 = 20 Panchina
    expect(s.players[1].money).toBe(1700);
    expect(s.pot).toBe(0);
  });

  it('chi gioca dopo parte con 30 in più per ogni posto', () => {
    const s = createGame(['A', 'B', 'C', 'D'], ctx0);
    expect(s.players.map((p) => p.money)).toEqual([1500, 1530, 1560, 1590]);
    const senza = createGame(['A', 'B'], ctx0, { seatBonus: 0 });
    expect(senza.players.map((p) => p.money)).toEqual([1500, 1500]);
  });

  it('partita rapida: ognuno riceve 3 proprietà diverse senza pagare', () => {
    const s = createGame(['A', 'B', 'C'], { board, cards, rng: seededRng(42) }, { quickStart: true, seatBonus: 0 });
    const owned = Object.entries(s.ownership);
    expect(owned).toHaveLength(9);
    for (const p of s.players) {
      expect(owned.filter(([, o]) => o.owner === p.id)).toHaveLength(QUICK_START_PROPERTIES);
      expect(p.money).toBe(1500);
    }
    for (const [id, o] of owned) {
      expect(board.spaces.find((sp) => sp.id === id)?.type).toBe('property');
      expect(o).toEqual({ owner: o.owner, houses: 0, mortgaged: false });
    }
    expect(Object.keys(createGame(['A', 'B'], ctx0).ownership)).toHaveLength(0);
  });

  it('partita rapida in 8: le proprietà bastano, 2 a testa tutte diverse', () => {
    const names = Array.from({ length: 8 }, (_, i) => `G${i + 1}`);
    expect(quickStartProperties(board, 4)).toBe(QUICK_START_PROPERTIES);
    expect(quickStartProperties(board, 8)).toBe(2);
    // in due se ne danno di più: la partita normale a due dura troppo
    expect(quickStartProperties(board, 2)).toBe(4);
    const s = createGame(names, { board, cards, rng: seededRng(7) }, { quickStart: true });
    const owned = Object.entries(s.ownership);
    expect(owned).toHaveLength(16);
    expect(owned.every(([id]) => board.spaces.some((sp) => sp.id === id && sp.type === 'property'))).toBe(true);
    for (const p of s.players) expect(owned.filter(([, o]) => o.owner === p.id)).toHaveLength(2);
    expect(s.log.at(-1)).toEqual({ k: 'log.quickStart', p: { n: 2 } });
  });

  it('senza la regola del montepremi le tasse vanno alla banca', () => {
    const s = applyAction(createGame(['A', 'B'], ctx0), { type: 'roll' }, ctxWith(1, 3));
    expect(s.pot).toBe(0);
  });
});

describe('statistiche di fine partita', () => {
  it('contano affitti pagati e incassati, acquisti e doppi', () => {
    let s = newGame();
    s = applyAction(s, { type: 'roll' }, ctxWith(1, 2)); // casella 3, libera
    s = applyAction(s, { type: 'buy' }, ctxWith());
    expect(s.stats[0].bought).toBe(1);
    s = applyAction(s, { type: 'endTurn' }, ctxWith());
    s = applyAction(s, { type: 'roll' }, ctxWith(1, 2)); // Bruno arriva sulla via di Anna
    const rent = s.stats[1].rentPaid;
    expect(rent).toBeGreaterThan(0);
    expect(s.stats[0].rentReceived).toBe(rent);
    s = applyAction(s, { type: 'endTurn' }, ctxWith());
    s = applyAction(s, { type: 'roll' }, ctxWith(3, 3));
    expect(s.stats[0].doubles).toBe(1);
  });

  it('a ogni giro si fotografano i patrimoni, anche alla fine', () => {
    let s = createGame(['A', 'B'], { board, cards, rng: () => 0.999 }, { maxRounds: 1, seatBonus: 0 });
    expect(s.history).toEqual([[1500, 1500]]);
    s = applyAction(s, { type: 'roll' }, ctxWith(1, 3)); // A paga 200 di tasse
    expect(s.stats[0].taxesPaid).toBe(200);
    s = applyAction(s, { type: 'endTurn' }, ctxWith());
    s = applyAction(s, { type: 'roll' }, ctxWith(1, 3));
    s = applyAction(s, { type: 'endTurn' }, ctxWith());
    expect(s.phase).toBe('gameOver');
    expect(s.history.at(-1)).toEqual([1300, 1300]);
    // una fotografia all'inizio e una alla fine dell'unico giro; il giro mostrato resta 1
    expect(s.history).toHaveLength(2);
    expect(s.round).toBe(1);
  });

  it('ricordano il giro della bancarotta e le visite in Caserma', () => {
    const s0 = newGame();
    s0.players[0].money = 2;
    own(s0, 'periferia-2', 1, 3);
    s0.players[0].position = 0;
    let s = applyAction(s0, { type: 'roll' }, ctxWith(1, 2));
    s = applyAction(s, { type: 'bankrupt' }, ctxWith());
    expect(s.stats[0].bankruptRound).toBe(1);
    const j = newGame();
    j.players[0].position = 25;
    const after = applyAction(j, { type: 'roll' }, ctxWith(2, 3)); // 30: vai in Caserma
    expect(after.stats[0].jailVisits).toBe(1);
  });

  it('le partite salvate senza statistiche continuano a funzionare', () => {
    const s = newGame() as Partial<ReturnType<typeof newGame>>;
    delete s.stats;
    delete s.history;
    const next = applyAction(s as ReturnType<typeof newGame>, { type: 'roll' }, ctxWith(3, 3));
    expect(next.stats[0].doubles).toBe(1);
  });
});

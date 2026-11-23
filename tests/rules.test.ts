import { describe, it, expect } from 'vitest';
import { board, cards } from '../src/data';
import { applyAction, createGame, computeRent, RuleError, JAIL_FINE, unmortgageCost } from '../src/engine';
import { ctxWith, newGame, indexOf, own } from './helpers';

const salary = 200;

describe('inizio partita', () => {
  it('ogni giocatore parte con i soldi iniziali sulla Partenza', () => {
    const s = newGame(['A', 'B', 'C']);
    expect(s.players.map((p) => p.money)).toEqual([1500, 1500, 1500]);
    expect(s.players.every((p) => p.position === 0)).toBe(true);
    expect(s.phase).toBe('roll');
  });

  it('servono da 2 a 4 giocatori', () => {
    const ctx = { board, cards, rng: Math.random };
    expect(() => createGame(['Solo'], ctx)).toThrow();
    expect(() => createGame(['A', 'B', 'C', 'D', 'E'], ctx)).toThrow();
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

  it('si può rinunciare all\'acquisto', () => {
    let s = applyAction(newGame(), { type: 'roll' }, ctxWith(1, 2));
    s = applyAction(s, { type: 'decline' }, ctxWith());
    expect(s.ownership['periferia-2']).toBeUndefined();
    expect(s.phase).toBe('endTurn');
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
    expect(computeRent(s, ctx, 'periferia-2', 0)).toBe(60);
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
    expect(s.players[0].money).toBe(1700);
    expect(s.decks.quartiere.at(-1)).toBe('quartiere-01');
  });

  it('"torna alla Partenza" sposta e paga lo stipendio', () => {
    const s = applyAction(drawing('sorte-01', 'sorte'), { type: 'roll' }, ctxWith(1, 1));
    expect(s.players[0].position).toBe(0);
    expect(s.players[0].money).toBe(1500 + salary);
  });

  it('"indietro di 3" porta su un\'altra casella e la risolve', () => {
    const s = applyAction(drawing('sorte-04', 'sorte'), { type: 'roll' }, ctxWith(1, 1)); // 7 - 3 = 4 tassa
    expect(s.players[0].position).toBe(4);
    expect(s.players[0].money).toBe(1500 - 200);
  });

  it('"fermata più vicina" porta alla prossima fermata', () => {
    const s = applyAction(drawing('sorte-05', 'sorte'), { type: 'roll' }, ctxWith(1, 1));
    expect(s.players[0].position).toBe(indexOf('fermata-est'));
    expect(s.phase).toBe('buy');
  });

  it('"compleanno" fa pagare tutti gli altri giocatori', () => {
    const s = applyAction(drawing('quartiere-03', 'quartiere'), { type: 'roll' }, ctxWith(1, 1));
    expect(s.players[0].money).toBe(1510);
    expect(s.players[1].money).toBe(1490);
  });

  it('le riparazioni si pagano per casa e per palazzo', () => {
    const s0 = drawing('sorte-11', 'sorte');
    own(s0, 'borgo-1', 0, 2);
    own(s0, 'borgo-2', 0, 5);
    const s = applyAction(s0, { type: 'roll' }, ctxWith(1, 1));
    expect(s.players[0].money).toBe(1500 - (2 * 25 + 100));
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
    let s = applyAction(s0, { type: 'roll' }, ctxWith(1, 2)); // affitto 160 con 3 case
    expect(s.players[0].money).toBe(2 - 160);
    expect(s.creditor).toBe(1);
    s = applyAction(s, { type: 'bankrupt' }, ctxWith());
    expect(s.players[0].bankrupt).toBe(true);
    expect(s.ownership['periferia-1'].owner).toBe(1);
    // il creditore riceve solo quello che il fallito aveva
    expect(s.players[1].money).toBe(1500 + 2);
    expect(s.winner).toBe(1);
    expect(s.phase).toBe('gameOver');
  });

  it('con 3 giocatori la bancarotta verso la banca libera le proprietà e la partita continua', () => {
    const s0 = createGame(['A', 'B', 'C'], { board, cards, rng: () => 0.999 });
    s0.players[0].money = 100;
    own(s0, 'periferia-1', 0);
    let s = applyAction(s0, { type: 'roll' }, ctxWith(1, 3));
    s = applyAction(s, { type: 'bankrupt' }, ctxWith());
    expect(s.ownership['periferia-1']).toBeUndefined();
    expect(s.phase).toBe('roll');
    expect(s.current).toBe(1);
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

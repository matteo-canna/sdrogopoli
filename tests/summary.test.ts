import { describe, it, expect } from 'vitest';
import { board, cards } from '../src/data';
import { addResult, awards, standings } from '../src/ui/summary';
import { newGame, own } from './helpers';

const ctx = { board, cards, rng: () => 0.999 };

function finished() {
  const s = newGame(['Anna', 'Bruno', 'Carla']);
  s.phase = 'gameOver';
  s.winner = 2;
  s.players[0].bankrupt = true;
  s.stats[0].bankruptRound = 7;
  s.players[1].money = 900;
  s.stats[1].rentReceived = 300;
  s.stats[2].built = 4;
  s.stats[2].rentReceived = 120;
  own(s, 'lungolago-2', 2);
  return s;
}

describe('riepilogo di fine partita', () => {
  it('ordina: vincitore, poi chi è in gioco, poi i falliti', () => {
    expect(standings(finished(), ctx)).toEqual([2, 1, 0]);
  });

  it('assegna i premi solo a chi ha fatto qualcosa', () => {
    const a = awards(finished());
    expect(a.find((x) => x.title === 'Re degli affitti')?.playerId).toBe(1);
    expect(a.find((x) => x.title === 'Costruttore')?.playerId).toBe(2);
    expect(a.find((x) => x.title === 'Cliente della Caserma')).toBeUndefined();
  });

  it('la classifica tra amici somma partite e vittorie per nome', () => {
    let lb = addResult([], finished(), ctx);
    lb = addResult(lb, finished(), ctx);
    expect(lb[0]).toMatchObject({ name: 'Carla', wins: 2, played: 2 });
    expect(lb.find((e) => e.name === 'Anna')).toMatchObject({ wins: 0, played: 2, best: 0 });
    expect(lb.find((e) => e.name === 'Bruno')?.best).toBe(900);
  });

  it('assegna i 5 premi nuovi da statistiche e storico', () => {
    const s = newGame(['Anna', 'Bruno', 'Carla']);
    s.phase = 'gameOver';
    s.winner = 0;
    s.round = 12;
    // Anna resta in gioco fino al giro 12, Bruno e Carla falliscono prima → Turista ad Anna
    s.players[1].bankrupt = true;
    s.stats[1].bankruptRound = 9;
    s.players[2].bankrupt = true;
    s.stats[2].bankruptRound = 6;
    // Re della rimonta: Anna è più bassa a metà partita (400 < 1800) e finisce a 2500 (+2100)
    // Ottovolante: Bruno sale e scende (1500 → 2600 → 700 → 1900 → 0, oscillazione 5100)
    s.history = [
      [1500, 1500, 1500],
      [900, 2600, 1200],
      [400, 700, 800],
      [1700, 1900, 0],
      [2500, 0, 0],
    ];
    // Mattone d'oro: case in piedi a fine partita
    s.ownership['periferia-1'] = { owner: 0, houses: 3, mortgaged: false };
    // Collezionista di multe: più tasse pagate (e rentPaid=0 così Benefattore ha lo stesso valore, ma Bruno ne ha di più)
    s.stats[2].taxesPaid = 450;

    const a = awards(s);
    expect(a.find((x) => x.title === 'Re della rimonta')?.playerId).toBe(0);
    expect(a.find((x) => x.title === 'Mattone d’oro')?.playerId).toBe(0);
    expect(a.find((x) => x.title === 'Turista')?.playerId).toBe(0);
    expect(a.find((x) => x.title === 'Collezionista di multe')?.playerId).toBe(2);
    expect(a.find((x) => x.title === 'Ottovolante')?.playerId).toBe(1);
  });

  it('non assegna un premio in caso di pari merito e mostra al massimo i 6 con lo scarto maggiore', () => {
    const s = newGame(['Anna', 'Bruno', 'Carla']);
    s.phase = 'gameOver';
    s.winner = 0;
    s.round = 15;
    // pari merito sui doppi: Mano fortunata non compare
    s.stats[0].doubles = 4;
    s.stats[1].doubles = 4;
    // più di 6 premi validi con scarti diversi
    s.stats[0].rentReceived = 2000; // scarto 2000
    s.stats[1].taxesPaid = 800; // scarto 800 (e Benefattore 800)
    s.stats[0].bought = 10; // scarto 10
    s.stats[2].built = 8; // scarto 8
    s.ownership['periferia-1'] = { owner: 2, houses: 5, mortgaged: false }; // scarto 5
    s.stats[1].trades = 3; // scarto 3
    s.stats[2].jailVisits = 1; // scarto 1 (escluso dai primi 6)

    const a = awards(s);
    expect(a.find((x) => x.title === 'Mano fortunata')).toBeUndefined();
    expect(a).toHaveLength(6);
    expect(a.find((x) => x.title === 'Cliente della Caserma')).toBeUndefined();
    expect(a[0].title).toBe('Re degli affitti');
  });
});

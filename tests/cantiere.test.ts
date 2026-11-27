// Test della regola facoltativa "Imprevisti del Cantiere" (rules.buildCards).
import { describe, it, expect } from 'vitest';
import { board, cards, cantiereCards, cantiereCardsEn } from '../src/data';
import {
  applyAction,
  chooseBotAction,
  createGame,
  migrateState,
  targetSpace,
  typicalCardValue,
  type GameContext,
} from '../src/engine';
import { ctxWith, newGame, own } from './helpers';

describe('mazzo Imprevisti del Cantiere (rules.buildCards)', () => {
  it('contiene 12 carte originali con traduzione inglese e valore medio equilibrato', () => {
    expect(cantiereCards.decks.cantiere?.name).toBe('Imprevisti del Cantiere');
    expect(cantiereCards.cards).toHaveLength(12);
    const ids = new Set(cantiereCards.cards.map((c) => c.id));
    expect(ids.size).toBe(12);

    for (const c of cantiereCards.cards) {
      expect(c.deck).toBe('cantiere');
      expect(c.text.length).toBeGreaterThan(10);
      expect(cantiereCardsEn[c.id]?.text, c.id).toBeTruthy();
      if (c.effect.kind === 'choice') {
        expect(c.effect.options).toHaveLength(2);
        expect(cantiereCardsEn[c.id]?.options).toHaveLength(2);
      }
    }

    const indexOf = (id: string) => board.spaces.findIndex((sp) => sp.id === targetSpace(board, id));
    const salary = (board.spaces.find((sp) => sp.type === 'start') as { salary: number }).salary;
    const values = cantiereCards.cards.map((c) => typicalCardValue(c.effect, salary, indexOf));
    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    expect(Math.abs(mean)).toBeLessThanOrEqual(12);
  });

  it('con la regola spenta non crea il mazzo Cantiere e costruire la terza casa non pesca carte', () => {
    let s = newGame(['Anna', 'Bruno']);
    expect(s.decks.cantiere).toBeUndefined();
    own(s, 'periferia-1', 0);
    own(s, 'periferia-2', 0);

    // 1ª, 2ª e 3ª casa sul quartiere Periferia (costo 50 ciascuna = 150)
    s = applyAction(s, { type: 'build', spaceId: 'periferia-1' }, ctxWith());
    s = applyAction(s, { type: 'build', spaceId: 'periferia-2' }, ctxWith());
    s = applyAction(s, { type: 'build', spaceId: 'periferia-1' }, ctxWith());

    expect(s.ownership['periferia-1'].houses + s.ownership['periferia-2'].houses).toBe(3);
    expect(s.players[0].money).toBe(1500 - 150);
    expect(s.log.some((l) => typeof l === 'object' && l.k === 'log.buildCard')).toBe(false);
  });

  it('con la regola accesa mescola il mazzo Cantiere col seme della partita', () => {
    const ctx: GameContext = { board, cards };
    const a1 = createGame(['Anna', 'Bruno'], ctx, { buildCards: true }, 42);
    const a2 = createGame(['Anna', 'Bruno'], ctx, { buildCards: true }, 42);
    const b = createGame(['Anna', 'Bruno'], ctx, { buildCards: true }, 99);

    expect(a1.decks.cantiere).toHaveLength(12);
    expect(a1.decks.cantiere).toEqual(a2.decks.cantiere);
    expect(a1.decks.cantiere).not.toEqual(b.decks.cantiere);
  });

  it('pesca una carta Cantiere solo quando il quartiere raggiunge esattamente 3 case totali', () => {
    const ctx: GameContext = { board, cards };
    let s = createGame(['Anna', 'Bruno'], ctx, { buildCards: true, seatBonus: 0 }, 10);
    own(s, 'borgo-1', 0);
    own(s, 'borgo-2', 0);
    own(s, 'borgo-3', 0);
    // Forziamo in cima al mazzo cantiere-01 (incassa 120)
    s.decks.cantiere = ['cantiere-01', ...s.decks.cantiere!.filter((id) => id !== 'cantiere-01')];

    // 1ª e 2ª casa: nessuna carta pescata (ogni casa di Borgo costa 50)
    s = applyAction(s, { type: 'build', spaceId: 'borgo-1' }, ctx);
    s = applyAction(s, { type: 'build', spaceId: 'borgo-2' }, ctx);
    expect(s.players[0].money).toBe(1500 - 100);
    expect(s.decks.cantiere![0]).toBe('cantiere-01');

    // 3ª casa nel quartiere: pesca cantiere-01 (+120) e la rimette in fondo al mazzo
    s = applyAction(s, { type: 'build', spaceId: 'borgo-3' }, ctx);
    expect(s.players[0].money).toBe(1500 - 150 + 120);
    expect(s.decks.cantiere![s.decks.cantiere!.length - 1]).toBe('cantiere-01');
    expect(s.log.some((l) => typeof l === 'object' && l.k === 'log.buildCard')).toBe(true);

    // 4ª casa nel quartiere: non pesca più
    const nextCard = s.decks.cantiere![0];
    s = applyAction(s, { type: 'build', spaceId: 'borgo-1' }, ctx);
    expect(s.decks.cantiere![0]).toBe(nextCard);
    expect(s.players[0].money).toBe(1500 - 200 + 120);
  });

  it('gestisce le carte a scelta del mazzo Cantiere (anche per il computer)', () => {
    const ctx: GameContext = { board, cards };
    let s = createGame(
      [{ name: 'Bot', isBot: true, bot: { level: 'normale', style: 'equilibrato' } }, { name: 'Bruno', isBot: true }],
      ctx,
      { buildCards: true, seatBonus: 0 },
      15,
    );
    s.phase = 'endTurn';
    own(s, 'periferia-1', 0, 1);
    own(s, 'periferia-2', 0, 1);
    // Mettiamo in cima al mazzo cantiere-12 (scelta: paga 75 oppure 25/casa -> con 3 case 75 pari, con cantiere-11 sceglie +60)
    s.decks.cantiere = ['cantiere-11', ...s.decks.cantiere!.filter((id) => id !== 'cantiere-11')];

    s = applyAction(s, { type: 'build', spaceId: 'periferia-1' }, ctx);
    expect(s.phase).toBe('cardChoice');
    expect(s.pendingCard).toBe('cantiere-11');

    const choice = chooseBotAction(s, ctx);
    expect(choice.type).toBe('chooseCard');
    s = applyAction(s, choice, ctx);
    expect(s.pendingCard).toBeNull();
  });

  it('migrateState inizializza il mazzo Cantiere se mancante in un salvataggio con buildCards attivo', () => {
    const s = newGame(['Anna', 'Bruno']);
    s.rules.buildCards = true;
    delete s.decks.cantiere;
    const migrated = migrateState(s, { board, cards }, 7);
    expect(migrated.decks.cantiere).toHaveLength(12);
  });
});

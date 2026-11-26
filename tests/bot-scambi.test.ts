// Test della valutazione e proposta di scambi del computer (livelli normale e difficile).
import { describe, it, expect } from 'vitest';
import { applyAction, chooseBotAction } from '../src/engine';
import { ctxWith, newGame, own } from './helpers';

function endTurnWithBots() {
  const s = applyAction(newGame(['Anna', 'Bruno', 'Carla']), { type: 'roll' }, ctxWith(1, 3));
  for (const p of s.players) {
    p.isBot = true;
    p.bot = { level: 'normale', style: 'equilibrato' };
  }
  return s;
}

describe('computer: valutazione e proposta degli scambi', () => {
  it('rifiuta uno scambio che fa completare un quartiere solo all\'avversario se riceve meno del 150% + 100', () => {
    let s = endTurnWithBots();
    // Anna (0) possiede borgo-1 (100) e borgo-2 (100); Bruno (1) possiede borgo-3 (120) e periferia-1 (60)
    own(s, 'borgo-1', 0);
    own(s, 'borgo-2', 0);
    own(s, 'borgo-3', 1);
    // 150% di 120 + 100 = 280. Anna offre una via da 140 (mercato-1) + 100 = 240 (< 280), senza far completare nulla a Bruno
    own(s, 'mercato-1', 0);
    s = applyAction(
      s,
      {
        type: 'proposeTrade',
        offer: {
          to: 1,
          give: { money: 100, spaces: ['mercato-1'] },
          get: { money: 0, spaces: ['borgo-3'] },
        },
      },
      ctxWith(),
    );
    expect(chooseBotAction(s, ctxWith())).toEqual({ type: 'rejectTrade' });
  });

  it('accetta di cedere la via che completa il quartiere avversario se riceve almeno il 150% del valore più 100', () => {
    let s = endTurnWithBots();
    // Anna (0) ha borgo-1 e borgo-2; Bruno (1) ha borgo-3 (prezzo 120, soglia: 120 * 1.5 + 100 = 280)
    own(s, 'borgo-1', 0);
    own(s, 'borgo-2', 0);
    own(s, 'borgo-3', 1);
    s = applyAction(
      s,
      {
        type: 'proposeTrade',
        offer: {
          to: 1,
          give: { money: 280, spaces: [] },
          get: { money: 0, spaces: ['borgo-3'] },
        },
      },
      ctxWith(),
    );
    expect(chooseBotAction(s, ctxWith())).toEqual({ type: 'acceptTrade' });
  });

  it('rifiuta anche quando l\'avversario chiede due vie per completare il quartiere senza compenso sufficiente', () => {
    let s = endTurnWithBots();
    // Anna (0) ha borgo-1 (100); Bruno (1) ha borgo-2 (100) e borgo-3 (120) -> valore vie date = 220, soglia = 220 * 1.5 + 100 = 430
    own(s, 'borgo-1', 0);
    own(s, 'borgo-2', 1);
    own(s, 'borgo-3', 1);
    own(s, 'porto-3', 0); // prezzo 200
    s = applyAction(
      s,
      {
        type: 'proposeTrade',
        offer: {
          to: 1,
          give: { money: 150, spaces: ['porto-3'] }, // 350 < 430
          get: { money: 0, spaces: ['borgo-2', 'borgo-3'] },
        },
      },
      ctxWith(),
    );
    expect(chooseBotAction(s, ctxWith())).toEqual({ type: 'rejectTrade' });
  });

  it('propone uno scambio reciproco 1 per 1 quando due giocatori si completano un quartiere a vicenda (al massimo una volta per turno)', () => {
    let s = endTurnWithBots();
    // Anna (0) ha periferia-1 e borgo-3; Bruno (1) ha periferia-2, borgo-1 e borgo-2
    own(s, 'periferia-1', 0);
    own(s, 'borgo-3', 0);
    own(s, 'periferia-2', 1);
    own(s, 'borgo-1', 1);
    own(s, 'borgo-2', 1);

    const action = chooseBotAction(s, ctxWith());
    expect(action).toEqual({
      type: 'proposeTrade',
      offer: {
        to: 1,
        give: { money: 0, spaces: ['borgo-3'] },
        get: { money: 0, spaces: ['periferia-2'] },
      },
    });

    // Bruno accetta lo scambio reciproco
    s = applyAction(s, action, ctxWith());
    expect(s.tradeProposedThisTurn).toBe(true);
    expect(chooseBotAction(s, ctxWith())).toEqual({ type: 'acceptTrade' });
  });

  it('propone e accetta uno scambio reciproco "due vie per una" quando entrambi completano un quartiere', () => {
    let s = endTurnWithBots();
    s.players[0].bot = { level: 'difficile', style: 'equilibrato' };
    s.players[1].bot = { level: 'difficile', style: 'equilibrato' };
    // Anna (0) ha borgo-1, borgo-2 (le manca borgo-3) e mercato-2, mercato-3;
    // Bruno (1) ha borgo-3 e mercato-1 (gli mancano mercato-2 e mercato-3).
    own(s, 'borgo-1', 0);
    own(s, 'borgo-2', 0);
    own(s, 'mercato-2', 0);
    own(s, 'mercato-3', 0);
    own(s, 'borgo-3', 1);
    own(s, 'mercato-1', 1);

    const proposal = chooseBotAction(s, ctxWith());
    expect(proposal).toEqual({
      type: 'proposeTrade',
      offer: {
        to: 1,
        give: { money: 0, spaces: ['mercato-2', 'mercato-3'] },
        get: { money: 0, spaces: ['borgo-3'] },
      },
    });

    s = applyAction(s, proposal, ctxWith());
    expect(chooseBotAction(s, ctxWith())).toEqual({ type: 'acceptTrade' });
  });

  it('il livello facile mantiene il comportamento invariato', () => {
    let s = endTurnWithBots();
    s.players[0].bot = { level: 'facile', style: 'equilibrato' };
    s.players[1].bot = { level: 'facile', style: 'equilibrato' };
    own(s, 'periferia-1', 0);
    own(s, 'borgo-3', 0);
    own(s, 'periferia-2', 1);
    own(s, 'borgo-1', 1);
    own(s, 'borgo-2', 1);

    // Il facile non propone mai scambi
    expect(chooseBotAction(s, ctxWith())).not.toMatchObject({ type: 'proposeTrade' });

    // Il facile accetta un'offerta con margine basso (0.85 * 120 = 102) anche sotto 150% + 100 (190)
    s = applyAction(
      s,
      {
        type: 'proposeTrade',
        offer: {
          to: 1,
          give: { money: 110, spaces: [] },
          get: { money: 0, spaces: ['periferia-2'] },
        },
      },
      ctxWith(),
    );
    expect(chooseBotAction(s, ctxWith())).toEqual({ type: 'acceptTrade' });
  });
});

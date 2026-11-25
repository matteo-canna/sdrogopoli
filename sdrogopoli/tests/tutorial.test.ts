import { describe, it, expect } from 'vitest';
import { board, cards } from '../src/data';
import { applyAction, createGame } from '../src/engine';
import { tutorialTip, TIP_IDS } from '../src/ui/tutorial';
import { ctxWith, newGame, own } from './helpers';

const ctx = { board, cards, rng: () => 0.999 };

describe('tutorial', () => {
  it('alla prima mossa dà il benvenuto, poi non lo ripete', () => {
    const s = newGame();
    expect(tutorialTip(s, ctx, new Set())?.id).toBe('start');
    expect(tutorialTip(s, ctx, new Set(['start']))).toBeNull();
  });

  it('non mostra consigli quando tocca al computer', () => {
    const s = createGame([{ name: 'Bot', isBot: true }, 'Anna'], ctx, { seatBonus: 0 });
    expect(tutorialTip(s, ctx, new Set())).toBeNull();
  });

  it('spiega l\'acquisto e poi l\'asta', () => {
    let s = applyAction(newGame(), { type: 'roll' }, ctxWith(1, 2)); // casella 3: proprietà libera
    expect(s.phase).toBe('buy');
    expect(tutorialTip(s, ctx, new Set())?.id).toBe('buy');
    s = applyAction(s, { type: 'decline' }, ctxWith());
    expect(tutorialTip(s, ctx, new Set())?.id).toBe('auction');
  });

  it('il debito ha la precedenza su tutto', () => {
    const s = newGame();
    s.players[0].money = -10;
    s.phase = 'endTurn';
    own(s, 'periferia-1', 0);
    expect(tutorialTip(s, ctx, new Set())?.id).toBe('debt');
  });

  it('con tutto il quartiere suggerisce di costruire', () => {
    const s = newGame();
    s.phase = 'endTurn';
    own(s, 'periferia-1', 0);
    own(s, 'periferia-2', 0);
    expect(tutorialTip(s, ctx, new Set())?.id).toBe('group');
    expect(tutorialTip(s, ctx, new Set(['group']))?.id).toBe('owned');
  });

  it('quando sono stati visti tutti non resta niente', () => {
    const s = newGame();
    expect(tutorialTip(s, ctx, new Set(TIP_IDS))).toBeNull();
  });
});

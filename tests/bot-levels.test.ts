import { describe, expect, it } from 'vitest';
import { board, cards } from '../src/data';
import { applyAction, botKnobs, BOT_LEVELS, BOT_STYLES, chooseBotAction, createGame, seededRng, type BotLevel, type GameContext } from '../src/engine';

describe('livelli del computer', () => {
  it('il difficile vince più del normale, che vince più del facile', () => {
    const levels: BotLevel[] = ['facile', 'normale', 'difficile'];
    const wins: Record<string, number> = { facile: 0, normale: 0, difficile: 0 };
    for (let g = 0; g < 90; g++) {
      // l'ordine al tavolo cambia a ogni partita, così il posto non conta
      const order = levels.map((_, i) => levels[(i + g) % 3]);
      if (g % 2) order.reverse();
      const ctx: GameContext = { board, cards, rng: seededRng(g * 7919 + 13) };
      let s = createGame(order.map((level, i) => ({ name: `P${i}`, isBot: true, bot: { level, style: 'equilibrato' } })), ctx, { maxRounds: 40 }, g + 1);
      while (s.phase !== 'gameOver') s = applyAction(s, chooseBotAction(s, ctx), ctx);
      if (s.winner !== null) wins[order[s.winner]]++;
    }
    expect(wins.difficile).toBeGreaterThan(wins.normale);
    expect(wins.normale).toBeGreaterThan(wins.facile);
  }, 60_000);

  it('il normale equilibrato è il computer di sempre', () => {
    expect(botKnobs()).toEqual(botKnobs({ level: 'normale', style: 'equilibrato' }));
    expect(botKnobs().reserve).toBe(150);
  });

  it('ogni carattere cambia qualcosa', () => {
    const base = JSON.stringify(botKnobs());
    for (const st of BOT_STYLES.filter((x) => x.id !== 'equilibrato')) expect(JSON.stringify(botKnobs({ level: 'normale', style: st.id }))).not.toBe(base);
    expect(BOT_LEVELS).toHaveLength(3);
  });

  it('una scelta del computer dipende solo dallo stato', () => {
    const ctx: GameContext = { board, cards };
    let s = createGame([{ name: 'A', isBot: true, bot: { level: 'facile', style: 'equilibrato' } }, { name: 'B', isBot: true }], ctx, {}, 5);
    for (let i = 0; i < 200 && s.phase !== 'gameOver'; i++) {
      const a = chooseBotAction(s, ctx);
      expect(chooseBotAction(s, ctx)).toEqual(a);
      s = applyAction(s, a, ctx);
    }
  });
});

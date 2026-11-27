import { describe, expect, it } from 'vitest';
import { cleanCode, codeFromHash, renderOnlineRematch, tableCode, tableLink, CODE_LENGTH } from '../src/ui/online';
import { cleanRematchProposal, cleanRematchReply, uniqueColors } from '../src/net/sanitize';
import { defaultAppearance } from '../src/ui/characters';
import { newGame } from './helpers';

describe('codice del tavolo', () => {
  it('ha 6 caratteri facili da dettare', () => {
    for (let i = 0; i < 50; i++) {
      const code = tableCode();
      expect(code).toHaveLength(CODE_LENGTH);
      expect(code).not.toMatch(/[01OIL]/);
      expect(cleanCode(code)).toBe(code);
    }
  });
  it('accetta minuscole, spazi e trattini e rifiuta il resto', () => {
    expect(cleanCode(' abc-234 ')).toBe('ABC234');
    expect(cleanCode('abc')).toBeNull();
    expect(cleanCode('ABC10O')).toBeNull();
    expect(cleanCode('<b>xx</b>')).toBeNull();
  });
  it('si legge dal link', () => {
    expect(codeFromHash('#tavolo=QZU4SP')).toBe('QZU4SP');
    expect(codeFromHash('#tavolo=bad')).toBeNull();
    expect(codeFromHash('')).toBeNull();
    const link = tableLink('QZU4SP', { origin: 'https://x.github.io', pathname: '/sdrogopoli/', search: '' });
    expect(link).toBe('https://x.github.io/sdrogopoli/#tavolo=QZU4SP');
    expect(codeFromHash(new URL(link).hash)).toBe('QZU4SP');
  });
});

describe('colori al tavolo', () => {
  it('due giocatori con lo stesso colore ne ricevono due diversi', () => {
    const a = defaultAppearance(0);
    const looks = uniqueColors([a, { ...a }, { ...a }, defaultAppearance(1)]);
    expect(new Set(looks.map((l) => l.color)).size).toBe(4);
    expect(looks[0]).toBe(a);
  });
});

describe('rivincita online: validazione e interfaccia', () => {
  it('valida i messaggi rematch e rematchReply in sanitize.ts', () => {
    expect(cleanRematchReply({ t: 'rematchReply', accept: true })).toEqual({ t: 'rematchReply', accept: true });
    expect(cleanRematchReply({ t: 'rematchReply', accept: 'yes' })).toBeNull();
    expect(cleanRematchReply(null)).toBeNull();

    expect(cleanRematchProposal({ t: 'rematch', accepted: [0, 0], declined: [1], pending: [2], timeoutMs: 30_000 }, 4)).toEqual({
      t: 'rematch',
      accepted: [0],
      declined: [1],
      pending: [2],
      timeoutMs: 30_000,
    });
    expect(cleanRematchProposal({ t: 'rematch', accepted: [9], declined: [], pending: [], timeoutMs: 30_000 }, 4)).toBeNull();
    expect(cleanRematchProposal({ t: 'altro' }, 4)).toBeNull();
  });

  it('mostra "Proponi la rivincita" all\'oste e "Ci sto" / "No, grazie" agli ospiti', () => {
    const s = newGame(['Ada', 'Bea']);
    s.phase = 'gameOver';
    s.winner = 0;
    expect(renderOnlineRematch(s, 'host', 0, null)).toContain('Proponi la rivincita');
    const guestHtml = renderOnlineRematch(s, 'guest', 1, { accepted: [0], declined: [], pending: [1] });
    expect(guestHtml).toContain('Ci sto');
    expect(guestHtml).toContain('No, grazie');
  });
});

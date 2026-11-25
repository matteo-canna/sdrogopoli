import { describe, expect, it } from 'vitest';
import { cleanCode, codeFromHash, tableCode, tableLink, CODE_LENGTH } from '../src/ui/online';
import { uniqueColors } from '../src/net/sanitize';
import { defaultAppearance } from '../src/ui/characters';

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

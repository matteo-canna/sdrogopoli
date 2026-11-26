import { describe, expect, it } from 'vitest';
import { DESKTOP, isExternalLink } from '../src/ui/platform';

describe('versione per Mac', () => {
  it('nei test e nel sito non è la versione desktop', () => {
    expect(DESKTOP).toBe(false);
  });

  it('riconosce i link da aprire nel browser di sistema', () => {
    expect(isExternalLink('https://github.com/matteo-canna/sdrogopoli/issues/new')).toBe(true);
    expect(isExternalLink('http://example.com')).toBe(true);
    expect(isExternalLink('tauri://localhost/licenze.txt')).toBe(false);
    expect(isExternalLink('#tavolo=ABC234')).toBe(false);
    expect(isExternalLink('./licenze.txt')).toBe(false);
  });
});

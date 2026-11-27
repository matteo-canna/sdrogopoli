import { describe, expect, it } from 'vitest';
import { board, cards } from '../src/data';
import { createGame } from '../src/engine';
import { reportUrl } from '../src/ui/report';

describe('Segnala un problema', () => {
  it('compila versione, browser e ultime righe del registro', () => {
    (globalThis as { window?: unknown }).window = { innerWidth: 390, innerHeight: 844 };
    const state = createGame([{ name: 'Ada' }, { name: 'Bea' }], { board, cards });
    state.log.push('Ada compra Vicolo dei Gatti Neri.');
    const url = new URL(reportUrl(state, '2d', 'TestBrowser/1.0'));
    expect(url.origin + url.pathname).toBe('https://github.com/matteo-canna/sdrogopoli/issues/new');
    const body = url.searchParams.get('body')!;
    expect(body).toContain('TestBrowser/1.0');
    expect(body).toContain('390×844, vista 2d');
    expect(body).toContain('> Giro 1 · Ada · Ada compra Vicolo dei Gatti Neri.');
  });
});

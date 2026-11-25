import { describe, it, expect } from 'vitest';
import { applyAction } from '../src/engine';
import { moveAnnouncement } from '../src/ui/announce';
import { DEFAULT_SETTINGS, parseSettings } from '../src/ui/settings';
import { spaceLabel } from '../src/ui/view';
import { ctxWith, indexOf, newGame, own } from './helpers';

describe('annunci per il lettore di schermo', () => {
  it('dopo il lancio si sentono i dadi e la casella', () => {
    const s = newGame();
    const next = applyAction(s, { type: 'roll' }, ctxWith(1, 2));
    const lines = moveAnnouncement(s, next, 0);
    expect(lines[0]).toBe('Anna lancia 1 e 2.');
    expect(lines.some((l) => l.includes('arriva su'))).toBe(true);
    // tocca ancora ad Anna: nessun cambio di turno da annunciare
    expect(lines.some((l) => l.startsWith('Tocca'))).toBe(false);
  });

  it('pagamenti e cambio di turno, con "tocca a te" per chi usa il dispositivo', () => {
    let s = newGame();
    own(s, 'periferia-2', 1);
    s = applyAction(s, { type: 'roll' }, ctxWith(1, 2));
    const lines = moveAnnouncement(newGame(), s, 0);
    expect(lines.some((l) => /paga \d+ di affitto a Bruno/.test(l))).toBe(true);
    const after = applyAction(s, { type: 'endTurn' }, ctxWith());
    expect(moveAnnouncement(s, after, 1)).toContain('Tocca a te, Bruno.');
    expect(moveAnnouncement(s, after, 0)).toContain('Tocca a Bruno.');
  });

  it('descrive una casella: prezzo, proprietario, case, pedine', () => {
    const s = newGame();
    expect(spaceLabel(s, indexOf('periferia-1'))).toMatch(/in vendita a \d+/);
    own(s, 'periferia-1', 1, 2);
    expect(spaceLabel(s, indexOf('periferia-1'))).toMatch(/di Bruno, 2 case/);
    expect(spaceLabel(s, 0)).toMatch(/qui: Anna, Bruno/);
  });
});

describe('impostazioni', () => {
  it('valori mancanti o strani tornano a quelli di partenza', () => {
    expect(parseSettings(null)).toEqual(DEFAULT_SETTINGS);
    expect(parseSettings('non json')).toEqual(DEFAULT_SETTINGS);
    expect(parseSettings('{"lang":"fr","text":"gigante","motion":"ridotto","sfxVolume":"140","musicVolume":-3}')).toEqual({
      lang: 'auto',
      text: 'normale',
      motion: 'ridotto',
      sfxVolume: 100,
      musicVolume: 0,
    });
  });
});

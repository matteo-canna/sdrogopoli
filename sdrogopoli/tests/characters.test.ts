import { describe, it, expect } from 'vitest';
import { CATEGORIES, CHARACTERS, COLOR_CHOICES, FINISH_OPTIONS, BASE_OPTIONS, characterDef, defaultAppearance, normalizeAppearance } from '../src/ui/characters';

describe('catalogo delle 30 pedine 3D realistiche', () => {
  it('contiene 30 pedine con id unici e categorie valide', () => {
    expect(CHARACTERS).toHaveLength(30);
    const ids = CHARACTERS.map((c) => c.id);
    expect(new Set(ids).size).toBe(30);
    for (const c of CHARACTERS) {
      expect(c.category in CATEGORIES).toBe(true);
      expect(c.label.length).toBeGreaterThan(0);
    }
  });

  it('assegna pedine e colori distinti ai primi 8 posti', () => {
    const looks = Array.from({ length: 8 }, (_, i) => defaultAppearance(i));
    expect(new Set(looks.map((l) => l.character)).size).toBe(8);
    expect(new Set(looks.map((l) => l.color)).size).toBe(8);
    for (const l of looks) {
      expect(COLOR_CHOICES).toContain(l.color);
      expect(l.finish! in FINISH_OPTIONS).toBe(true);
      expect(l.baseStyle! in BASE_OPTIONS).toBe(true);
    }
  });

  it('migra automaticamente gli ID delle vecchie pedine salvate', () => {
    expect(characterDef('knight').id).toBe('char_knight');
    expect(characterDef('mage').id).toBe('char_wizard');
    expect(characterDef('barbarian').id).toBe('char_samurai');
    expect(characterDef('rogue').id).toBe('char_steampunk');
    expect(characterDef('hooded').id).toBe('char_venetian');
    const migrated = normalizeAppearance({ character: 'mage', color: '#123456', hat: true, cape: true, item: 'Spellbook' }, 0);
    expect(migrated.character).toBe('char_wizard');
    expect(migrated.color).toBe('#123456');
    expect(migrated.finish).toBe('real');
    expect(migrated.baseStyle).toBe('minimal');
  });
});

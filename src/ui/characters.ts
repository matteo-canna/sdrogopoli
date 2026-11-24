// Catalogo dei personaggi-pedina (modelli KayKit di Kay Lousberg, licenza CC0) e scelte di aspetto.
import type { Appearance, Player } from '../engine';

export interface CharacterDef {
  id: string;
  label: string;
  emoji: string;
  // file in public/characters
  file: string;
  // nome della mesh del copricapo (null se non ne ha)
  hat: string | null;
  cape: string;
  // oggetti che può tenere in mano: nome mesh → etichetta
  items: Record<string, string>;
  // oggetto in mano proposto all'inizio
  defaultItem: string;
}

export const CHARACTERS: CharacterDef[] = [
  {
    id: 'knight',
    label: 'Cavaliere',
    emoji: '🛡️',
    file: 'Knight.glb',
    hat: 'Knight_Helmet',
    cape: 'Knight_Cape',
    items: { Round_Shield: 'Scudo tondo', Badge_Shield: 'Scudo con stemma', Rectangle_Shield: 'Scudo grande', '1H_Sword': 'Spada' },
    defaultItem: 'Badge_Shield',
  },
  {
    id: 'barbarian',
    label: 'Barbaro',
    emoji: '🍺',
    file: 'Barbarian.glb',
    hat: 'Barbarian_Hat',
    cape: 'Barbarian_Cape',
    items: { Mug: 'Boccale', Barbarian_Round_Shield: 'Scudo di legno', '1H_Axe': 'Ascia' },
    defaultItem: 'Mug',
  },
  {
    id: 'mage',
    label: 'Mago',
    emoji: '🪄',
    file: 'Mage.glb',
    hat: 'Mage_Hat',
    cape: 'Mage_Cape',
    items: { Spellbook: 'Libro', Spellbook_open: 'Libro aperto', '1H_Wand': 'Bacchetta', '2H_Staff': 'Bastone' },
    defaultItem: 'Spellbook',
  },
  {
    id: 'rogue',
    label: 'Furfante',
    emoji: '🗡️',
    file: 'Rogue.glb',
    hat: null,
    cape: 'Rogue_Cape',
    items: { Throwable: 'Bomba', Knife: 'Pugnale', '1H_Crossbow': 'Balestra' },
    defaultItem: '',
  },
  {
    id: 'hooded',
    label: 'Incappucciato',
    emoji: '🥷',
    file: 'Rogue_Hooded.glb',
    hat: null,
    cape: 'Rogue_Cape',
    items: { Throwable: 'Bomba', Knife: 'Pugnale', '1H_Crossbow': 'Balestra' },
    defaultItem: '',
  },
];

// Colori tra cui scegliere (i primi quattro sono quelli proposti ai posti 1-4).
export const COLOR_CHOICES = ['#e4572e', '#2e86de', '#f4b400', '#8e44ad', '#27ae60', '#e84393', '#00b8b8', '#5d4037'];
export const COLOR_NAMES: Record<string, string> = {
  '#e4572e': 'Rosso',
  '#2e86de': 'Blu',
  '#f4b400': 'Giallo',
  '#8e44ad': 'Viola',
  '#27ae60': 'Verde',
  '#e84393': 'Rosa',
  '#00b8b8': 'Turchese',
  '#5d4037': 'Marrone',
};

export function characterDef(id: string): CharacterDef {
  return CHARACTERS.find((c) => c.id === id) ?? CHARACTERS[0];
}

// Aspetto proposto per il posto i (personaggi e colori diversi).
export function defaultAppearance(seat: number): Appearance {
  const def = CHARACTERS[[0, 2, 1, 4][seat % 4]];
  return { character: def.id, color: COLOR_CHOICES[seat % COLOR_CHOICES.length], hat: true, cape: true, item: def.defaultItem };
}

// Aspetto di un giocatore; le partite salvate prima dei personaggi usano quello predefinito.
export function appearanceOf(p: Pick<Player, 'id' | 'appearance'>): Appearance {
  return p.appearance ?? defaultAppearance(p.id);
}

export function playerColor(p: Pick<Player, 'id' | 'appearance'>): string {
  return appearanceOf(p).color;
}

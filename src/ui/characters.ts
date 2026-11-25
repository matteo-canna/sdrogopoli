// Catalogo dei personaggi-pedina e scelte di aspetto.
// Due famiglie: i modelli scaricati (KayKit di Kay Lousberg, licenza CC0, in public/characters)
// e le "figure", costruite con forme semplici dentro src/ui/three/figures.ts (niente file, niente
// licenze di terzi). Di tutti e due si carica solo quello scelto.
import type { Appearance, Player } from '../engine';
import { t, type MsgKey } from '../i18n';
import { EXTRA_COLORS } from './achievements';

export interface CharacterDef {
  id: string;
  label: string;
  emoji: string;
  // true: pedina costruita con forme semplici (niente file da scaricare)
  figure?: boolean;
  // file in public/characters (vuoto per le figure)
  file: string;
  // nome della mesh del copricapo (null se non ne ha)
  hat: string | null;
  // nome della mesh del mantello (null se non ne ha)
  cape: string | null;
  // oggetti che può tenere in mano: nome mesh → etichetta in italiano (in pagina si usa itemName)
  items: Record<string, string>;
  // oggetto in mano proposto all'inizio
  defaultItem: string;
}

export const CHARACTERS: CharacterDef[] = [
  {
    id: 'knight',
    get label() {
      return t('char.knight');
    },
    emoji: '🛡️',
    file: 'Knight.glb',
    hat: 'Knight_Helmet',
    cape: 'Knight_Cape',
    items: { Round_Shield: 'Scudo tondo', Badge_Shield: 'Scudo con stemma', Rectangle_Shield: 'Scudo grande', '1H_Sword': 'Spada' },
    defaultItem: 'Badge_Shield',
  },
  {
    id: 'barbarian',
    get label() {
      return t('char.barbarian');
    },
    emoji: '🍺',
    file: 'Barbarian.glb',
    hat: 'Barbarian_Hat',
    cape: 'Barbarian_Cape',
    items: { Mug: 'Boccale', Barbarian_Round_Shield: 'Scudo di legno', '1H_Axe': 'Ascia' },
    defaultItem: 'Mug',
  },
  {
    id: 'mage',
    get label() {
      return t('char.mage');
    },
    emoji: '🪄',
    file: 'Mage.glb',
    hat: 'Mage_Hat',
    cape: 'Mage_Cape',
    items: { Spellbook: 'Libro', Spellbook_open: 'Libro aperto', '1H_Wand': 'Bacchetta', '2H_Staff': 'Bastone' },
    defaultItem: 'Spellbook',
  },
  {
    id: 'rogue',
    get label() {
      return t('char.rogue');
    },
    emoji: '🗡️',
    file: 'Rogue.glb',
    hat: null,
    cape: 'Rogue_Cape',
    items: { Throwable: 'Bomba', Knife: 'Pugnale', '1H_Crossbow': 'Balestra' },
    defaultItem: '',
  },
  {
    id: 'hooded',
    get label() {
      return t('char.hooded');
    },
    emoji: '🥷',
    file: 'Rogue_Hooded.glb',
    hat: null,
    cape: 'Rogue_Cape',
    items: { Throwable: 'Bomba', Knife: 'Pugnale', '1H_Crossbow': 'Balestra' },
    defaultItem: '',
  },
  // Figure: costruite con forme semplici, senza niente da scaricare.
  {
    id: 'robot',
    get label() {
      return t('char.robot');
    },
    emoji: '🤖',
    figure: true,
    file: '',
    hat: null,
    cape: null,
    items: {},
    defaultItem: '',
  },
  {
    id: 'gatto',
    get label() {
      return t('char.gatto');
    },
    emoji: '🐈',
    figure: true,
    file: '',
    hat: null,
    cape: null,
    items: {},
    defaultItem: '',
  },
  {
    id: 'astronauta',
    get label() {
      return t('char.astronauta');
    },
    emoji: '🧑‍🚀',
    figure: true,
    file: '',
    hat: null,
    cape: null,
    items: {},
    defaultItem: '',
  },
];

// Colori tra cui scegliere: uno diverso per ciascun posto, nello stesso ordine (gli ultimi 4 servono alla modalità demo).
export const COLOR_CHOICES = ['#e4572e', '#2e86de', '#f4b400', '#8e44ad', '#27ae60', '#e84393', '#00b8b8', '#5d4037', '#ff8f00', '#9ccc00', '#90a4ae', '#263238'];
// Nome del colore nella lingua scelta (per chi non distingue i colori e per i lettori di schermo).
export function colorName(hex: string): string {
  const i = COLOR_CHOICES.indexOf(hex);
  if (i >= 0) return t(`color.${i}` as MsgKey);
  // colori sbloccati con i traguardi
  const extra = Object.entries(EXTRA_COLORS).find(([, h]) => h === hex);
  return extra ? t(`color.${extra[0]}` as MsgKey) : hex;
}

// Nome dell'oggetto in mano nella lingua scelta.
export function itemName(mesh: string): string {
  return t(`item.${mesh}` as MsgKey);
}

export function characterDef(id: string): CharacterDef {
  return CHARACTERS.find((c) => c.id === id) ?? CHARACTERS[0];
}

// Personaggio proposto a ciascun posto: i primi cinque tutti diversi, poi si ricomincia.
const SEAT_CHARACTERS = [0, 2, 1, 4, 3, 1, 0, 2, 3, 4, 2, 0];

// Aspetto proposto per il posto i (personaggi e colori diversi).
export function defaultAppearance(seat: number): Appearance {
  const def = CHARACTERS[SEAT_CHARACTERS[seat % SEAT_CHARACTERS.length]];
  return { character: def.id, color: COLOR_CHOICES[seat % COLOR_CHOICES.length], hat: true, cape: true, item: def.defaultItem };
}

// Aspetto di un giocatore; le partite salvate prima dei personaggi usano quello predefinito.
export function appearanceOf(p: Pick<Player, 'id' | 'appearance'>): Appearance {
  return p.appearance ?? defaultAppearance(p.id);
}

export function playerColor(p: Pick<Player, 'id' | 'appearance'>): string {
  return appearanceOf(p).color;
}

// Sigla di ogni giocatore: l'iniziale del nome, o le prime due lettere se due nomi iniziano
// con la stessa lettera (e il numero del posto se non basta). Serve a riconoscere i giocatori
// anche senza distinguere i colori.
export function playerMarks(players: Pick<Player, 'name'>[]): string[] {
  const clean = players.map((p) => [...p.name.trim().toUpperCase()].filter((c) => /\p{L}|\p{N}/u.test(c)));
  const one = clean.map((c) => c[0] ?? '?');
  return clean.map((c, i) => {
    if (one.filter((x) => x === one[i]).length === 1) return one[i];
    const two = c.slice(0, 2).join('') || '?';
    const twos = clean.map((d) => d.slice(0, 2).join(''));
    return twos.filter((x) => x === two).length === 1 ? two : String(i + 1);
  });
}

// Colore del testo leggibile sopra un colore di sfondo (nero o bianco).
export function inkOn(hex: string): string {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex);
  if (!m) return '#fff';
  const n = parseInt(m[1], 16);
  const lin = (c: number) => {
    const v = c / 255;
    return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  };
  const l = 0.2126 * lin((n >> 16) & 255) + 0.7152 * lin((n >> 8) & 255) + 0.0722 * lin(n & 255);
  return l > 0.22 ? '#1f2421' : '#ffffff';
}

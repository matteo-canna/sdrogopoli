// Lingue del gioco. Tutte le frasi stanno in un file per lingua (it.ts, en.ts); qui si sceglie
// la lingua e si compongono le frasi con i loro valori ({name}, {amount}, ...).
// I nomi delle vie e dei quartieri sono nomi propri della città e restano in italiano; le altre
// caselle (Partenza, Caserma, fermate...) e le carte hanno la traduzione in src/data/*.en.json.
import { board, cards } from '../data';
import cardsEn from '../data/cards.en.json';
import boardEn from '../data/board.en.json';
import { it, type MsgKey } from './it';
import { en } from './en';

export type { MsgKey } from './it';
export type Lang = 'it' | 'en';
export const LANGS: { id: Lang; label: string }[] = [
  { id: 'it', label: 'Italiano' },
  { id: 'en', label: 'English' },
];

export type Params = Record<string, string | number>;
// Una frase da comporre al momento, nella lingua di chi la legge (registro, errori).
export interface Message {
  k: MsgKey;
  p?: Params;
}

const CATALOGS: Record<Lang, Record<MsgKey, string>> = { it, en };
const CARD_TEXT: Record<Lang, Record<string, { text: string; options?: string[] }>> = {
  it: Object.fromEntries(cards.cards.map((c) => [c.id, { text: c.text, options: c.effect.kind === 'choice' ? c.effect.options.map((o) => o.label) : undefined }])),
  en: cardsEn as Record<string, { text: string; options?: string[] }>,
};

let current: Lang = 'it';

export function getLang(): Lang {
  return current;
}

export function setLang(lang: Lang): void {
  current = lang;
  if (typeof document !== 'undefined') document.documentElement.lang = lang;
}

// Lingua del browser: italiano per chi ha l'italiano tra le lingue preferite, altrimenti inglese.
export function detectLang(languages: readonly string[]): Lang {
  for (const l of languages) {
    const base = l.toLowerCase().slice(0, 2);
    if (base === 'it' || base === 'en') return base;
  }
  return 'en';
}

const SPACE_NAMES: Record<Lang, Record<string, string>> = {
  it: Object.fromEntries(board.spaces.map((sp) => [sp.id, sp.name])),
  en: boardEn as Record<string, string>,
};

export function spaceName(spaceId: string, lang: Lang = current): string {
  return SPACE_NAMES[lang][spaceId] ?? SPACE_NAMES.it[spaceId] ?? spaceId;
}

export function deckName(deck: string, lang: Lang = current): string {
  return format(lang, deck === 'sorte' ? 'deck.sorte' : 'deck.quartiere');
}

export function cardText(cardId: string, lang: Lang = current): string {
  return CARD_TEXT[lang][cardId]?.text ?? CARD_TEXT.it[cardId]?.text ?? cardId;
}

export function cardOption(cardId: string, option: number, lang: Lang = current): string {
  return CARD_TEXT[lang][cardId]?.options?.[option] ?? CARD_TEXT.it[cardId]?.options?.[option] ?? String(option + 1);
}

// Valori con un significato: {space} è l'id di una casella, {group} di un quartiere,
// {card} di una carta, {choice} è "idCarta#numeroOpzione". Gli altri si scrivono così come sono.
function value(name: string, v: string | number | undefined, lang: Lang): string {
  if (v === undefined) return `{${name}}`;
  const s = String(v);
  if (name === 'space') return spaceName(s, lang);
  if (name === 'group') return board.groups.find((g) => g.id === s)?.name ?? s;
  if (name === 'card') return cardText(s, lang);
  if (name === 'choice') {
    const [id, i] = s.split('#');
    return cardOption(id, Number(i), lang);
  }
  return s;
}

export function format(lang: Lang, key: MsgKey, params?: Params): string {
  // la chiave può arrivare dalla rete o da un salvataggio: se non è nota si mostra così com'è
  const template = String((Object.hasOwn(it, key) ? CATALOGS[lang][key] ?? it[key] : null) ?? key);
  return template.replace(/\{(\w+)\}/g, (_, name: string) => value(name, params?.[name], lang));
}

// La frase nella lingua scelta.
export function t(key: MsgKey, params?: Params): string {
  return format(current, key, params);
}

// Singolare e plurale: usa la chiave "….one" quando n è 1, altrimenti "….other".
export function tn(key: string, n: number, params?: Params): string {
  return t(`${key}.${n === 1 ? 'one' : 'other'}` as MsgKey, { n, ...params });
}

// Una riga del registro: le partite vecchie hanno righe già scritte in italiano.
export function text(line: string | Message): string {
  if (line && typeof line === 'object') return format(current, line.k, line.p && typeof line.p === 'object' ? line.p : undefined);
  return String(line ?? '');
}

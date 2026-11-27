// Lingue del gioco. Tutte le frasi stanno in un file per lingua (it.ts, en.ts, es.ts); qui si sceglie
// la lingua e si compongono le frasi con i loro valori ({name}, {amount}, ...).
// I nomi delle vie e dei quartieri sono nomi propri della città e restano in italiano; le altre
// caselle (Partenza, Caserma, fermate...) e le carte hanno la traduzione in src/data/*.en.json e *.es.json.
import { BOARDS, board, cards, currentChoice } from '../data';
import cardsEn from '../data/cards.en.json';
import cardsEs from '../data/cards.es.json';
import { it, type MsgKey } from './it';
import { en } from './en';
import { es } from './es';

export type { MsgKey } from './it';
export type Lang = 'it' | 'en' | 'es';
export const LANGS: { id: Lang; label: string }[] = [
  { id: 'it', label: 'Italiano' },
  { id: 'en', label: 'English' },
  { id: 'es', label: 'Español' },
];

export type Params = Record<string, string | number>;
// Una frase da comporre al momento, nella lingua di chi la legge (registro, errori).
export interface Message {
  k: MsgKey;
  p?: Params;
}

const CATALOGS: Record<Lang, Record<MsgKey, string>> = { it, en, es };
const CARD_TEXT: Record<Lang, Record<string, { text: string; options?: string[] }>> = {
  it: Object.fromEntries(cards.cards.map((c) => [c.id, { text: c.text, options: c.effect.kind === 'choice' ? c.effect.options.map((o) => o.label) : undefined }])),
  en: cardsEn as Record<string, { text: string; options?: string[] }>,
  es: cardsEs as Record<string, { text: string; options?: string[] }>,
};

let current: Lang = 'it';

export function getLang(): Lang {
  return current;
}

export function setLang(lang: Lang): void {
  current = lang;
  if (typeof document !== 'undefined') document.documentElement.lang = lang;
}

// Lingua del browser: la prima lingua supportata tra quelle preferite, altrimenti inglese.
export function detectLang(languages: readonly string[]): Lang {
  for (const l of languages) {
    const base = l.toLowerCase().slice(0, 2);
    if (base === 'it' || base === 'en' || base === 'es') return base;
  }
  return 'en';
}

// I nomi delle caselle di tutti i tabelloni insieme: gli id sono diversi da un tabellone all'altro,
// così una riga del registro si legge anche se riguarda una partita su un altro tabellone.
const SPACE_NAMES: Record<Lang, Record<string, string>> = {
  it: Object.fromEntries(BOARDS.flatMap((b) => b.data.spaces.map((sp) => [sp.id, sp.name]))),
  en: Object.assign({}, ...BOARDS.map((b) => b.names)) as Record<string, string>,
  es: Object.assign({}, ...BOARDS.map((b) => b.namesEs ?? {})) as Record<string, string>,
};

// Nomi dei quartieri di tutti i tabelloni (restano in italiano: sono nomi propri).
const GROUP_NAMES: Record<string, string> = Object.fromEntries(BOARDS.flatMap((b) => b.data.groups.map((g) => [g.id, g.name])));

// Il ruolo a cui punta una carta ("lusso") diventa la casella del tabellone in uso.
const CARD_TARGET: Record<string, string> = Object.fromEntries(
  cards.cards.flatMap((c) => (c.effect.kind === 'moveTo' ? [[c.id, c.effect.space]] : [])),
);

export function spaceName(spaceId: string, lang: Lang = current): string {
  // un tabellone fatto con l'editor ha i nomi suoi, in una lingua sola, anche se riusa gli id
  if (currentChoice().custom) {
    const own = board.spaces.find((sp) => sp.id === spaceId)?.name;
    if (own) return own;
  }
  return SPACE_NAMES[lang][spaceId] ?? SPACE_NAMES.it[spaceId] ?? spaceId;
}

export function groupName(groupId: string): string {
  if (currentChoice().custom) {
    const own = board.groups.find((g) => g.id === groupId)?.name;
    if (own) return own;
  }
  return GROUP_NAMES[groupId] ?? groupId;
}

// Il nome di un tabellone: quelli del gioco nelle traduzioni, quelli dell'editor nei loro dati.
export function boardTitle(id: string, data?: { title?: string }, lang: Lang = current): string {
  if (data?.title) return data.title;
  return format(lang, `board.${id}` as MsgKey);
}

export function deckName(deck: string, lang: Lang = current): string {
  return format(lang, deck === 'sorte' ? 'deck.sorte' : 'deck.quartiere');
}

export function cardText(cardId: string, lang: Lang = current): string {
  const raw = CARD_TEXT[lang][cardId]?.text ?? CARD_TEXT.it[cardId]?.text ?? cardId;
  // alcune carte nominano la casella dove mandano: cambia col tabellone, quindi si scrive al momento
  if (!raw.includes('{space}')) return raw;
  const role = CARD_TARGET[cardId];
  return raw.replace('{space}', spaceName(board.targets?.[role] ?? role, lang));
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
  if (name === 'group') return groupName(s);
  if (name === 'landmark') return format(lang, `landmark.${s}` as MsgKey);
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

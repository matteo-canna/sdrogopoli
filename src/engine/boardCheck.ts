// Controllo di un tabellone fatto da qualcuno (con l'editor o a mano, importato da un file o da
// un link). Un tabellone che passa questo controllo si gioca senza sorprese: il motore trova le
// caselle che gli servono, la griglia si disegna e niente di quello che c'è dentro può finire
// nella pagina come codice (id, colori e nomi hanno caratteri ammessi e lunghezze massime).
// Gli errori sono codici con qualche valore: l'interfaccia li traduce (chiavi "boardErr.<code>").
import type { BoardData, CardsData, PropertySpace, Space } from './types';
import { targetSpace } from './rules';

export interface BoardIssue {
  code: string;
  // casella, quartiere o campo coinvolto, e un numero se serve
  id?: string;
  n?: number;
}

export type BoardCheck =
  | { ok: true; data: BoardData; warnings: BoardIssue[] }
  | { ok: false; errors: BoardIssue[]; warnings?: BoardIssue[] };

export const MIN_SPACES = 20;
export const MAX_SPACES = 48;
export const MAX_NAME = 40;
export const MAX_TITLE = 40;
// oltre questa lunghezza il nome rischia di stringersi troppo sul cartellino della casella
export const MAX_TAG_NAME = 28;

const ID = /^[a-z0-9][a-z0-9-]{0,39}$/;
const COLOR = /^#[0-9a-f]{6}$/i;
// nessun carattere che possa diventare codice HTML; l'apostrofo resta ("Viale dell'Arte")
const UNSAFE = /[<>&"`\u0000-\u001f\u007f]/;

const TYPES = ['start', 'property', 'station', 'utility', 'card', 'tax', 'jail', 'free', 'goToJail'] as const;
const DECKS = ['sorte', 'quartiere'];

function isObj(x: unknown): x is Record<string, unknown> {
  return !!x && typeof x === 'object' && !Array.isArray(x);
}

function isInt(x: unknown, min: number, max: number): x is number {
  return typeof x === 'number' && Number.isInteger(x) && x >= min && x <= max;
}

function isName(x: unknown, max = MAX_NAME): x is string {
  return typeof x === 'string' && x.trim().length > 0 && x.length <= max && !UNSAFE.test(x);
}

function intList(x: unknown, len: number, min: number, max: number): x is number[] {
  return Array.isArray(x) && x.length === len && x.every((v) => isInt(v, min, max));
}

// Una casella letta dal file, con solo i campi che il gioco conosce (gli altri si lasciano fuori).
function readSpace(raw: unknown, errors: BoardIssue[], index: number): Space | null {
  const where = String(index + 1);
  if (!isObj(raw) || !TYPES.includes(raw.type as (typeof TYPES)[number])) {
    errors.push({ code: 'spaceType', id: where });
    return null;
  }
  if (typeof raw.id !== 'string' || !ID.test(raw.id)) {
    errors.push({ code: 'spaceId', id: where });
    return null;
  }
  const id = raw.id;
  if (!isName(raw.name)) errors.push({ code: 'spaceName', id });
  const name = String(raw.name ?? '').trim();
  const bad = (field: string) => errors.push({ code: 'spaceValue', id: `${id} (${field})` });
  switch (raw.type) {
    case 'start':
      if (!isInt(raw.salary, 0, 1000)) bad('salary');
      return { type: 'start', id, name, salary: Number(raw.salary) };
    case 'tax':
      if (!isInt(raw.amount, 0, 1000)) bad('amount');
      return { type: 'tax', id, name, amount: Number(raw.amount) };
    case 'card':
      if (!DECKS.includes(raw.deck as string)) bad('deck');
      return { type: 'card', id, name, deck: raw.deck as 'sorte' | 'quartiere' };
    case 'jail':
    case 'free':
    case 'goToJail':
      return { type: raw.type, id, name };
    case 'station':
      if (!isInt(raw.price, 1, 2000)) bad('price');
      if (!isInt(raw.mortgage, 0, 2000)) bad('mortgage');
      if (!intList(raw.rent, 4, 0, 5000)) bad('rent');
      return { type: 'station', id, name, price: Number(raw.price), mortgage: Number(raw.mortgage), rent: raw.rent as [number, number, number, number] };
    case 'utility':
      if (!isInt(raw.price, 1, 2000)) bad('price');
      if (!isInt(raw.mortgage, 0, 2000)) bad('mortgage');
      if (!intList(raw.diceMultiplier, 2, 1, 50)) bad('diceMultiplier');
      return { type: 'utility', id, name, price: Number(raw.price), mortgage: Number(raw.mortgage), diceMultiplier: raw.diceMultiplier as [number, number] };
    default: {
      // proprietà
      if (typeof raw.group !== 'string') bad('group');
      if (!isInt(raw.price, 1, 2000)) bad('price');
      if (!isInt(raw.housePrice, 1, 1000)) bad('housePrice');
      if (!isInt(raw.mortgage, 0, 2000)) bad('mortgage');
      if (!intList(raw.rent, 6, 0, 5000)) bad('rent');
      return {
        type: 'property',
        id,
        name,
        group: String(raw.group),
        price: Number(raw.price),
        housePrice: Number(raw.housePrice),
        rent: raw.rent as PropertySpace['rent'],
        mortgage: Number(raw.mortgage),
      };
    }
  }
}

// Controlla un tabellone e ne restituisce una copia pulita. "cards" serve per sapere a quali
// caselle mandano le carte: ogni ruolo ("lusso", "studio"...) deve trovare la sua casella.
export function validateBoard(raw: unknown, cards: CardsData): BoardCheck {
  const errors: BoardIssue[] = [];
  if (!isObj(raw) || !Array.isArray(raw.spaces) || !Array.isArray(raw.groups)) return { ok: false, errors: [{ code: 'notBoard' }] };

  if (raw.title !== undefined && !isName(raw.title, MAX_TITLE)) errors.push({ code: 'title' });
  if (!isInt(raw.startingMoney, 100, 10000)) errors.push({ code: 'startingMoney' });
  const cur = isObj(raw.currency) ? raw.currency : {};
  if (!isName(cur.name, 20) || !isName(cur.plural, 20) || !isName(cur.symbol, 3)) errors.push({ code: 'currency' });

  // quartieri
  const groups = (raw.groups as unknown[]).flatMap((g) => {
    if (!isObj(g) || typeof g.id !== 'string' || !ID.test(g.id)) {
      errors.push({ code: 'groupId' });
      return [];
    }
    if (!isName(g.name)) errors.push({ code: 'groupName', id: g.id });
    if (typeof g.color !== 'string' || !COLOR.test(g.color)) errors.push({ code: 'groupColor', id: g.id });
    return [{ id: g.id, name: String(g.name ?? '').trim(), color: String(g.color ?? '').toLowerCase() }];
  });
  if (!groups.length) errors.push({ code: 'noGroups' });
  if (new Set(groups.map((g) => g.id)).size !== groups.length) errors.push({ code: 'groupDup' });
  if (new Set(groups.map((g) => g.color)).size !== groups.length) errors.push({ code: 'colorDup' });

  // caselle
  const list = raw.spaces as unknown[];
  if (list.length < MIN_SPACES || list.length > MAX_SPACES || list.length % 4 !== 0) {
    errors.push({ code: 'length', n: list.length });
    return { ok: false, errors };
  }
  const spaces = list.map((s, i) => readSpace(s, errors, i));
  if (spaces.some((s) => !s)) return { ok: false, errors };
  const all = spaces as Space[];
  const ids = all.map((s) => s.id);
  for (const id of new Set(ids.filter((id, i) => ids.indexOf(id) !== i))) errors.push({ code: 'spaceDup', id });

  if (all[0].type !== 'start') errors.push({ code: 'firstStart' });
  for (const type of ['start', 'jail', 'free', 'goToJail'] as const) {
    const n = all.filter((s) => s.type === type).length;
    if (n !== 1) errors.push({ code: 'oneOf', id: type, n });
  }
  // agli angoli solo caselle senza prezzo
  const side = all.length / 4;
  for (const i of [0, side, 2 * side, 3 * side]) if ('price' in all[i]) errors.push({ code: 'corner', id: all[i].id });

  const groupIds = new Set(groups.map((g) => g.id));
  const warnings: BoardIssue[] = [];
  // prezzo massimo per quartiere, per controllare se le case costano più della via più cara
  const maxPriceByGroup = new Map<string, number>();
  for (const s of all) {
    if (s.type === 'property') {
      maxPriceByGroup.set(s.group, Math.max(maxPriceByGroup.get(s.group) ?? 0, s.price));
    }
  }
  const seenNames = new Map<string, { name: string; count: number }>();
  for (const s of all) {
    if (s.name.length > MAX_TAG_NAME) warnings.push({ code: 'longName', id: s.id, n: s.name.length });
    if (s.type !== 'card' && s.name) {
      const key = s.name.toLowerCase();
      const prev = seenNames.get(key);
      if (prev) prev.count += 1;
      else seenNames.set(key, { name: s.name, count: 1 });
    }
    if (s.type === 'property' || s.type === 'station' || s.type === 'utility') {
      if (s.mortgage >= s.price) errors.push({ code: 'mortgage', id: s.id });
    }
    if (s.type === 'station' && Array.isArray(s.rent) && s.rent.some((r, i) => i > 0 && r <= s.rent[i - 1])) {
      warnings.push({ code: 'stationRentOrder', id: s.id });
    }
    if (s.type !== 'property') continue;
    if (!groupIds.has(s.group)) errors.push({ code: 'spaceGroup', id: s.id });
    else {
      if (Array.isArray(s.rent) && s.rent.some((r, i) => i > 0 && r <= s.rent[i - 1])) errors.push({ code: 'rentOrder', id: s.id });
      const maxPrice = maxPriceByGroup.get(s.group) ?? 0;
      if (maxPrice > 0 && s.housePrice > maxPrice) warnings.push({ code: 'houseCost', id: s.id, n: s.housePrice });
    }
  }
  for (const { name, count } of seenNames.values()) {
    if (count > 1) warnings.push({ code: 'nameDup', id: name, n: count });
  }
  for (const g of groups) {
    const n = all.filter((s) => s.type === 'property' && s.group === g.id).length;
    if (n < 2) errors.push({ code: 'groupSmall', id: g.id, n });
  }
  // il conto degli affitti di fermate e servizi va fino a 4 fermate e 2 servizi
  const stations = all.filter((s) => s.type === 'station').length;
  const utilities = all.filter((s) => s.type === 'utility').length;
  if (stations > 4) errors.push({ code: 'stations', n: stations });
  if (utilities > 2) errors.push({ code: 'utilities', n: utilities });

  // le carte "vai a" devono trovare la loro casella
  const targets: Record<string, string> = {};
  if (isObj(raw.targets)) {
    for (const [k, v] of Object.entries(raw.targets)) if (ID.test(k) && typeof v === 'string' && ID.test(v)) targets[k] = v;
  }
  const data: BoardData = {
    ...(typeof raw.title === 'string' ? { title: raw.title.trim() } : {}),
    currency: { name: String(cur.name ?? ''), plural: String(cur.plural ?? ''), symbol: String(cur.symbol ?? '') },
    startingMoney: Number(raw.startingMoney),
    ...(Object.keys(targets).length ? { targets } : {}),
    groups,
    spaces: all,
  };
  const idSet = new Set(ids);
  for (const role of cardRoles(cards)) {
    if (!idSet.has(targetSpace(data, role))) errors.push({ code: 'target', id: role });
  }
  return errors.length ? { ok: false, errors, ...(warnings.length ? { warnings } : {}) } : { ok: true, data, warnings };
}

// I ruoli (o gli id) delle caselle dove mandano le carte "vai a", anche dentro le carte con scelta.
export function cardRoles(cards: CardsData): string[] {
  const out = new Set<string>();
  for (const c of cards.cards) {
    const effects = c.effect.kind === 'choice' ? c.effect.options.map((o) => o.effect) : [c.effect];
    for (const e of effects) if (e.kind === 'moveTo') out.add(e.space);
  }
  return [...out];
}

// Cambia il prezzo di una via tenendo le proporzioni: affitti e ipoteca seguono il prezzo, gli
// affitti restano crescenti e il prezzo delle case non cambia.
export function withPrice<T extends Space>(space: T, price: number): T {
  if (!('price' in space) || price === space.price || price <= 0) return space;
  const k = price / space.price;
  const out = structuredClone(space) as T & { price: number; mortgage: number };
  out.price = price;
  out.mortgage = Math.floor(price / 2);
  if (out.type === 'property' || out.type === 'station') {
    const rent = out.rent.map((r) => Math.max(1, Math.round(r * k)));
    if (out.type === 'property') for (let i = 1; i < rent.length; i++) rent[i] = Math.max(rent[i], rent[i - 1] + 1);
    (out as { rent: number[] }).rent = rent;
  }
  return out;
}

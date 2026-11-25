// Preferenze ricordate nel browser. Se l'archiviazione non funziona (navigazione privata,
// spazio pieno) si gioca lo stesso: le funzioni non lanciano mai errori.
import type { SkyMode } from './three/city';
import type { MsgKey } from '../i18n';
import { sortLeaderboard, type LeaderEntry } from './summary';
import { ACHIEVEMENTS, emptyProfile, unlockedTitles, type Profile } from './achievements';

// Le chiavi tengono il prefisso del vecchio nome ("sdrogopoli-"): cambiarle farebbe perdere
// partite e preferenze già salvate.
export const KEYS = {
  save: 'sdrogopoli-partita',
  view: 'sdrogopoli-vista',
  looks: 'sdrogopoli-aspetto',
  tutorial: 'sdrogopoli-tutorial',
  leaderboard: 'sdrogopoli-classifica',
  sky: 'sdrogopoli-cielo',
  speed: 'sdrogopoli-velocita',
  slots: 'sdrogopoli-salvataggi',
  onlineName: 'sdrogopoli-nome-online',
  settings: 'sdrogopoli-impostazioni',
  profile: 'sdrogopoli-profilo',
  preset: 'sdrogopoli-tipo-partita',
  daily: 'sdrogopoli-partita-del-giorno',
  board: 'sdrogopoli-tabellone',
} as const;

export function readPref(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

export function writePref(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {
    /* ignora */
  }
}

export function removePref(key: string): void {
  try {
    localStorage.removeItem(key);
  } catch {
    /* ignora */
  }
}

// velocità di gioco: moltiplica animazioni e pause del computer
export const SPEEDS = [
  { id: 'lenta', icon: '🐢', label: 'Lenta', factor: 0.6 },
  { id: 'normale', icon: '▶️', label: 'Normale', factor: 1 },
  { id: 'veloce', icon: '⏩', label: 'Veloce', factor: 2 },
  { id: 'istantanea', icon: '⚡', label: 'Istantanea', factor: Infinity },
] as const;
export type Speed = (typeof SPEEDS)[number];

export function loadSpeed(): Speed {
  return SPEEDS.find((v) => v.id === readPref(KEYS.speed)) ?? SPEEDS[1];
}

export const SKY_LABELS: Record<SkyMode, [string, MsgKey]> = {
  cycle: ['🌗', 'sky.cycle'],
  day: ['☀️', 'sky.day'],
  night: ['🌙', 'sky.night'],
};

export function loadSky(): SkyMode {
  return (['cycle', 'day', 'night'] as const).find((m) => m === readPref(KEYS.sky)) ?? 'cycle';
}

export function loadLeaderboard(): LeaderEntry[] {
  try {
    const raw = JSON.parse(readPref(KEYS.leaderboard) ?? '[]');
    return Array.isArray(raw) ? sortLeaderboard(raw.filter((e) => e && typeof e.name === 'string')) : [];
  } catch {
    return [];
  }
}

export function saveLeaderboard(entries: LeaderEntry[]): void {
  writePref(KEYS.leaderboard, JSON.stringify(entries));
}

// Consigli del tutorial: interruttore generale e consigli già letti.
export interface TutorialPrefs {
  on: boolean;
  seen: Set<string>;
}

export function loadTutorial(): TutorialPrefs {
  try {
    const raw = JSON.parse(readPref(KEYS.tutorial) ?? '{}');
    return { on: raw.on !== false, seen: new Set(Array.isArray(raw.seen) ? raw.seen : []) };
  } catch {
    return { on: true, seen: new Set() };
  }
}

export function saveTutorial(t: TutorialPrefs): void {
  writePref(KEYS.tutorial, JSON.stringify({ on: t.on, seen: [...t.seen] }));
}

// ---------- traguardi e profilo ----------

export interface Progress {
  profile: Profile;
  // id dei traguardi raggiunti, nell'ordine in cui sono arrivati
  unlocked: string[];
  // titolo scelto da mettere accanto al proprio nome ('' = nessuno)
  title: string;
}

export function emptyProgress(): Progress {
  return { profile: emptyProfile(), unlocked: [], title: '' };
}

// Legge i traguardi scartando quello che non si riconosce (file vecchi o modificati a mano).
export function parseProgress(raw: string | null): Progress {
  const base = emptyProgress();
  try {
    const o = JSON.parse(raw ?? '{}') ?? {};
    const ids = new Set(ACHIEVEMENTS.map((a) => a.id));
    const unlocked = Array.isArray(o.unlocked) ? [...new Set(o.unlocked.filter((x: unknown) => typeof x === 'string' && ids.has(x)))] : [];
    const p = o.profile ?? {};
    const num = (v: unknown) => (Number.isFinite(Number(v)) && Number(v) >= 0 ? Math.floor(Number(v)) : 0);
    const profile: Profile = {
      games: num(p.games),
      wins: num(p.wins),
      bestWorth: num(p.bestWorth),
      rentReceived: num(p.rentReceived),
      built: num(p.built),
      trades: num(p.trades),
      cleanGames: num(p.cleanGames),
      winsByPreset: Object.fromEntries(Object.entries(p.winsByPreset ?? {}).map(([k, v]) => [String(k), num(v)])),
      onlineWins: num(p.onlineWins),
    };
    const titles = unlockedTitles(unlocked as string[]);
    return { profile, unlocked: unlocked as string[], title: titles.includes(o.title) ? o.title : base.title };
  } catch {
    return base;
  }
}

export function loadProgress(): Progress {
  return parseProgress(readPref(KEYS.profile));
}

export function saveProgress(p: Progress): void {
  writePref(KEYS.profile, JSON.stringify(p));
}

// Tipo di partita scelto l'ultima volta (serve ai traguardi).
export function loadPreset(): string {
  return readPref(KEYS.preset) ?? 'classica';
}

export function savePreset(id: string): void {
  writePref(KEYS.preset, id);
}

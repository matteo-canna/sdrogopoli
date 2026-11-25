// Preferenze ricordate nel browser. Se l'archiviazione non funziona (navigazione privata,
// spazio pieno) si gioca lo stesso: le funzioni non lanciano mai errori.
import type { SkyMode } from './three/city';
import type { MsgKey } from '../i18n';
import { sortLeaderboard, type LeaderEntry } from './summary';

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

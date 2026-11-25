// Traguardi: 30 obiettivi controllati a fine partita per chi gioca su questo dispositivo.
// Ognuno sblocca qualcosa: un titolo da mettere accanto al proprio nome o un colore in più per la pedina.
// Tutto puro: il salvataggio lo fa prefs.ts, le prove stanno in tests/traguardi.test.ts.
import { completeGroups, netWorth, type GameContext, type GameState, type PlayerStats } from '../engine';
import { t, type MsgKey } from '../i18n';

// Quello che si tiene da parte di partita in partita (il profilo, B51).
export interface Profile {
  games: number;
  wins: number;
  // il patrimonio più alto raggiunto a fine partita
  bestWorth: number;
  rentReceived: number;
  built: number;
  trades: number;
  // partite finite senza mai andare in Caserma
  cleanGames: number;
  // vittorie per tipo di partita (id del preset)
  winsByPreset: Record<string, number>;
  // vittorie online
  onlineWins: number;
}

export function emptyProfile(): Profile {
  return { games: 0, wins: 0, bestWorth: 0, rentReceived: 0, built: 0, trades: 0, cleanGames: 0, winsByPreset: {}, onlineWins: 0 };
}

// Colori in più per la pedina, che si sbloccano con i traguardi.
export const EXTRA_COLORS: Record<string, string> = {
  oro: '#d4a017',
  argento: '#9fb0bd',
  rame: '#b06a3b',
  ametista: '#8d63c9',
  smeraldo: '#1f8f6a',
  corallo: '#ef6f5c',
};

export type Unlock = { kind: 'title'; id: string } | { kind: 'color'; id: string };

export interface AchievementCtx {
  state: GameState;
  ctx: GameContext;
  seat: number;
  stats: PlayerStats;
  profile: Profile;
  // vero se la partita era online
  online: boolean;
}

export interface Achievement {
  id: string;
  icon: string;
  unlock: Unlock;
  done: (a: AchievementCtx) => boolean;
}

const won = (a: AchievementCtx) => a.state.winner === a.seat;
const worth = (a: AchievementCtx) => netWorth(a.state, a.ctx, a.seat);

export const ACHIEVEMENTS: Achievement[] = [
  { id: 'prima-partita', icon: '🎲', unlock: { kind: 'title', id: 'prima-partita' }, done: (a) => a.profile.games >= 1 },
  { id: 'prima-vittoria', icon: '🏆', unlock: { kind: 'title', id: 'prima-vittoria' }, done: won },
  { id: 'cinque-vittorie', icon: '🖐️', unlock: { kind: 'title', id: 'cinque-vittorie' }, done: (a) => a.profile.wins >= 5 },
  { id: 'venti-vittorie', icon: '👑', unlock: { kind: 'color', id: 'oro' }, done: (a) => a.profile.wins >= 20 },
  { id: 'dieci-partite', icon: '📅', unlock: { kind: 'title', id: 'dieci-partite' }, done: (a) => a.profile.games >= 10 },
  { id: 'cinquanta-partite', icon: '🗓️', unlock: { kind: 'color', id: 'argento' }, done: (a) => a.profile.games >= 50 },
  { id: 'milionario', icon: '💰', unlock: { kind: 'title', id: 'milionario' }, done: (a) => worth(a) >= 5000 },
  { id: 'patrimonio-10k', icon: '🏦', unlock: { kind: 'color', id: 'rame' }, done: (a) => worth(a) >= 10000 },
  { id: 'un-quartiere', icon: '🏘️', unlock: { kind: 'title', id: 'un-quartiere' }, done: (a) => completeGroups(a.state, a.ctx, a.seat) >= 1 },
  { id: 'tre-quartieri', icon: '🏙️', unlock: { kind: 'title', id: 'tre-quartieri' }, done: (a) => completeGroups(a.state, a.ctx, a.seat) >= 3 },
  { id: 'cinque-quartieri', icon: '🌆', unlock: { kind: 'color', id: 'smeraldo' }, done: (a) => completeGroups(a.state, a.ctx, a.seat) >= 5 },
  { id: 'primo-palazzo', icon: '🏢', unlock: { kind: 'title', id: 'primo-palazzo' }, done: (a) => hotels(a) >= 1 },
  { id: 'tre-palazzi', icon: '🏗️', unlock: { kind: 'title', id: 'tre-palazzi' }, done: (a) => hotels(a) >= 3 },
  { id: 'venti-case', icon: '🏠', unlock: { kind: 'title', id: 'venti-case' }, done: (a) => a.stats.built >= 20 },
  { id: 'cento-case', icon: '🧱', unlock: { kind: 'color', id: 'ametista' }, done: (a) => a.profile.built >= 100 },
  { id: 'primo-scambio', icon: '🤝', unlock: { kind: 'title', id: 'primo-scambio' }, done: (a) => a.stats.trades >= 1 },
  { id: 'dieci-scambi', icon: '📜', unlock: { kind: 'title', id: 'dieci-scambi' }, done: (a) => a.profile.trades >= 10 },
  { id: 'affitti-2000', icon: '💵', unlock: { kind: 'title', id: 'affitti-2000' }, done: (a) => a.stats.rentReceived >= 2000 },
  { id: 'affitti-20000', icon: '🤑', unlock: { kind: 'color', id: 'corallo' }, done: (a) => a.profile.rentReceived >= 20000 },
  { id: 'senza-caserma', icon: '😇', unlock: { kind: 'title', id: 'senza-caserma' }, done: (a) => a.stats.jailVisits === 0 && a.state.round >= 10 },
  { id: 'tre-volte-caserma', icon: '🚓', unlock: { kind: 'title', id: 'tre-volte-caserma' }, done: (a) => a.stats.jailVisits >= 3 },
  { id: 'cinque-doppi', icon: '🎰', unlock: { kind: 'title', id: 'cinque-doppi' }, done: (a) => a.stats.doubles >= 5 },
  { id: 'vittoria-veloce', icon: '⚡', unlock: { kind: 'title', id: 'vittoria-veloce' }, done: (a) => won(a) && a.state.round <= 15 },
  { id: 'vittoria-lunga', icon: '🐢', unlock: { kind: 'title', id: 'vittoria-lunga' }, done: (a) => won(a) && a.state.round >= 40 },
  { id: 'ultimo-in-piedi', icon: '🧍', unlock: { kind: 'title', id: 'ultimo-in-piedi' }, done: (a) => won(a) && a.state.players.filter((p) => p.bankrupt).length >= 3 },
  { id: 'vittoria-obiettivo', icon: '🎯', unlock: { kind: 'title', id: 'vittoria-obiettivo' }, done: (a) => won(a) && !!a.state.winReason && a.state.winReason !== 'worth' },
  { id: 'vittoria-online', icon: '🌐', unlock: { kind: 'title', id: 'vittoria-online' }, done: (a) => won(a) && a.online },
  { id: 'vittoria-difficile', icon: '🤖', unlock: { kind: 'title', id: 'vittoria-difficile' }, done: (a) => won(a) && a.state.players.some((p) => p.bot?.level === 'difficile') },
  { id: 'tavolo-pieno', icon: '👥', unlock: { kind: 'title', id: 'tavolo-pieno' }, done: (a) => won(a) && a.state.players.length >= 6 },
  { id: 'tre-tipi', icon: '🎁', unlock: { kind: 'title', id: 'tre-tipi' }, done: (a) => Object.values(a.profile.winsByPreset).filter((n) => n > 0).length >= 3 },
];

function hotels(a: AchievementCtx): number {
  return Object.values(a.state.ownership).filter((o) => o.owner === a.seat && o.houses === 5).length;
}

export function achievementTitle(id: string): string {
  return t(`goal.${id}` as MsgKey);
}

export function achievementText(id: string): string {
  return t(`goalText.${id}` as MsgKey);
}

// Il nome del titolo da mettere accanto al proprio nome (gli id dei titoli sono quelli dei traguardi).
export function titleLabel(id: string): string {
  return t(`title.${id}` as MsgKey);
}

// I traguardi raggiunti adesso e non prima.
export function newlyUnlocked(a: AchievementCtx, already: readonly string[]): Achievement[] {
  const have = new Set(already);
  return ACHIEVEMENTS.filter((x) => !have.has(x.id) && x.done(a));
}

// Il profilo dopo una partita finita.
export function updateProfile(profile: Profile, a: Omit<AchievementCtx, 'profile'>, presetId: string): Profile {
  const next: Profile = { ...profile, winsByPreset: { ...profile.winsByPreset } };
  next.games++;
  next.bestWorth = Math.max(next.bestWorth, netWorth(a.state, a.ctx, a.seat));
  next.rentReceived += a.stats.rentReceived;
  next.built += a.stats.built;
  next.trades += a.stats.trades;
  if (a.stats.jailVisits === 0) next.cleanGames++;
  if (a.state.winner === a.seat) {
    next.wins++;
    next.winsByPreset[presetId] = (next.winsByPreset[presetId] ?? 0) + 1;
    if (a.online) next.onlineWins++;
  }
  return next;
}

// I colori sbloccati dai traguardi raggiunti.
export function unlockedColors(unlocked: readonly string[]): { id: string; hex: string }[] {
  const have = new Set(unlocked);
  return ACHIEVEMENTS.filter((x) => x.unlock.kind === 'color' && have.has(x.id)).map((x) => ({ id: x.unlock.id, hex: EXTRA_COLORS[x.unlock.id] }));
}

// I titoli sbloccati, nell'ordine dei traguardi.
export function unlockedTitles(unlocked: readonly string[]): string[] {
  const have = new Set(unlocked);
  return ACHIEVEMENTS.filter((x) => x.unlock.kind === 'title' && have.has(x.id)).map((x) => x.unlock.id);
}

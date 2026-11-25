// Profilo: le statistiche di tutte le partite e i traguardi, in un file da portare su un altro dispositivo.
// Le funzioni che contano e che leggono il file sono pure: le prove stanno in tests/profilo.test.ts.
import { ACHIEVEMENTS, type Profile } from './achievements';
import { emptyProgress, type Progress } from './prefs';
import { t } from '../i18n';

export const PROFILE_EXT = '.sdrogo-profilo';
export const PROFILE_VERSION = 1;

export interface ProfileFile {
  kind: 'sdrogopoli-profilo';
  version: number;
  progress: Progress;
  // quando è stato esportato, solo per chi guarda il file
  exported?: string;
}

export function profileFile(p: Progress, now = new Date()): ProfileFile {
  return { kind: 'sdrogopoli-profilo', version: PROFILE_VERSION, progress: p, exported: now.toISOString() };
}

// Legge un file esportato: null se non è un profilo di questo gioco.
export function parseProfileFile(text: string, parse: (raw: string) => Progress): Progress | null {
  try {
    const o = JSON.parse(text);
    if (!o || o.kind !== 'sdrogopoli-profilo' || !o.progress) return null;
    return parse(JSON.stringify(o.progress));
  } catch {
    return null;
  }
}

// Unisce due profili tenendo il meglio dei due: i traguardi si sommano, i conteggi anche.
// Così importare su un dispositivo dove si è già giocato non cancella niente.
export function mergeProgress(mine: Progress, other: Progress): Progress {
  const known = new Set(ACHIEVEMENTS.map((a) => a.id));
  const unlocked = [...new Set([...mine.unlocked, ...other.unlocked])].filter((id) => known.has(id));
  const a = mine.profile;
  const b = other.profile;
  const presets: Record<string, number> = { ...a.winsByPreset };
  for (const [k, v] of Object.entries(b.winsByPreset)) presets[k] = (presets[k] ?? 0) + v;
  const profile: Profile = {
    games: a.games + b.games,
    wins: a.wins + b.wins,
    bestWorth: Math.max(a.bestWorth, b.bestWorth),
    rentReceived: a.rentReceived + b.rentReceived,
    built: a.built + b.built,
    trades: a.trades + b.trades,
    cleanGames: a.cleanGames + b.cleanGames,
    winsByPreset: presets,
    onlineWins: a.onlineWins + b.onlineWins,
  };
  return { profile, unlocked, title: mine.title || other.title };
}

export function emptyProfileProgress(): Progress {
  return emptyProgress();
}

// Le righe di statistiche da mostrare (etichetta già tradotta e valore già scritto).
export function profileRows(p: Profile, money: (n: number) => string): { label: string; value: string }[] {
  const rate = p.games ? Math.round((p.wins / p.games) * 100) : 0;
  return [
    { label: t('profile.games'), value: String(p.games) },
    { label: t('profile.wins'), value: `${p.wins} (${rate}%)` },
    { label: t('profile.bestWorth'), value: money(p.bestWorth) },
    { label: t('profile.rent'), value: money(p.rentReceived) },
    { label: t('profile.built'), value: String(p.built) },
    { label: t('profile.trades'), value: String(p.trades) },
    { label: t('profile.clean'), value: String(p.cleanGames) },
    { label: t('profile.online'), value: String(p.onlineWins) },
  ];
}

// Scarica il profilo come file.
export function downloadProfile(p: Progress): void {
  const blob = new Blob([JSON.stringify(profileFile(p), null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `profilo${PROFILE_EXT}`;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

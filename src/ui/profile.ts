// Profilo: le statistiche di tutte le partite e i traguardi, in un file da portare su un altro dispositivo.
// Le funzioni che contano e che leggono il file sono pure: le prove stanno in tests/profilo.test.ts.
import { ACHIEVEMENTS, MAX_PROFILE_HISTORY, type Profile, type ProfileHistoryEntry } from './achievements';
import { emptyProgress, type Progress } from './prefs';
import { escapeHtml } from './view';
import { getLang, t, tn, type MsgKey } from '../i18n';

export const PROFILE_EXT = '.folle-profilo';
export const OLD_PROFILE_EXT = '.sdrogo-profilo';
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

// Ripulisce lo storico delle partite letto da un file (i profili vecchi non hanno il campo).
export function cleanProfileHistory(raw: unknown): ProfileHistoryEntry[] | undefined {
  if (!Array.isArray(raw)) return undefined;
  const entries: ProfileHistoryEntry[] = [];
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue;
    const e = item as Record<string, unknown>;
    const players = Array.isArray(e.players)
      ? e.players
          .filter((p): p is Record<string, unknown> => !!p && typeof p === 'object' && typeof (p as Record<string, unknown>).name === 'string')
          .map((p) => ({ name: String(p.name), bot: !!p.bot }))
      : [];
    const rounds = Number(e.rounds);
    entries.push({
      date: typeof e.date === 'string' ? e.date : '',
      board: typeof e.board === 'string' ? e.board : 'citta',
      preset: typeof e.preset === 'string' ? e.preset : 'classica',
      players,
      winner: typeof e.winner === 'string' ? e.winner : '',
      rounds: Number.isFinite(rounds) && rounds >= 0 ? Math.floor(rounds) : 0,
    });
    if (entries.length >= MAX_PROFILE_HISTORY) break;
  }
  return entries;
}

// Legge un file esportato: null se non è un profilo di questo gioco.
export function parseProfileFile(text: string, parse: (raw: string) => Progress): Progress | null {
  try {
    const o = JSON.parse(text);
    if (!o || o.kind !== 'sdrogopoli-profilo' || !o.progress) return null;
    const res = parse(JSON.stringify(o.progress));
    const history = cleanProfileHistory(o.progress?.profile?.history);
    if (history !== undefined) res.profile = { ...res.profile, history };
    return res;
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
  const hasHistory = a.history !== undefined || b.history !== undefined;
  const history = hasHistory ? [...(a.history ?? []), ...(b.history ?? [])].sort((x, y) => y.date.localeCompare(x.date)).slice(0, MAX_PROFILE_HISTORY) : undefined;
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
    ...(history !== undefined ? { history } : {}),
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

// Disegna l'elenco delle ultime partite nel profilo (più recente in alto) con lo stile esistente.
export function renderProfileHistory(p: Profile): string {
  const list = p.history ?? [];
  if (!list.length) return `<h4>${escapeHtml(t('profile.historyTitle'))}</h4><p class="hint">${escapeHtml(t('profile.historyEmpty'))}</p>`;
  const locale = getLang() === 'it' ? 'it-IT' : 'en-GB';
  const items = list
    .map((e) => {
      const boardName = t(`board.${e.board}` as MsgKey);
      const presetName = t(`preset.${e.preset}` as MsgKey);
      const who = e.players.map((pl) => `${pl.bot ? '🤖 ' : ''}${escapeHtml(pl.name)}`).join(', ');
      const parsed = Date.parse(e.date);
      const when = Number.isFinite(parsed) ? new Date(parsed).toLocaleDateString(locale, { day: 'numeric', month: 'short' }) : escapeHtml(e.date);
      const winner = e.winner ? `🏆 ${escapeHtml(t('profile.historyWinner', { name: e.winner }))}` : '';
      return `<li class="slot"><div class="slot-info"><strong>${escapeHtml(boardName)} · ${escapeHtml(presetName)}</strong>
        <small>${when} · ${escapeHtml(tn('summary.rounds', e.rounds))}${winner ? ` · ${winner}` : ''} · ${who}</small></div></li>`;
    })
    .join('');
  return `<h4>${escapeHtml(t('profile.historyTitle'))}</h4><ul class="slot-list profile-history">${items}</ul>`;
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

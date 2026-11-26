import { describe, it, expect } from 'vitest';
import { emptyProfile, MAX_PROFILE_HISTORY, updateProfile } from '../src/ui/achievements';
import { emptyProgress, parseProgress, type Progress } from '../src/ui/prefs';
import { mergeProgress, parseProfileFile, profileFile, profileRows, renderProfileHistory } from '../src/ui/profile';
import { emptyStats } from '../src/engine';
import { ctxWith, newGame } from './helpers';

const money = (n: number) => `Ş ${n}`;

function progress(p: Partial<Progress['profile']>, unlocked: string[] = [], title = ''): Progress {
  return { profile: { ...emptyProfile(), ...p }, unlocked, title };
}

describe('profilo', () => {
  it('il file esportato si rilegge', () => {
    const mine = progress({ games: 4, wins: 2, winsByPreset: { rapida: 2 } }, ['prima-vittoria'], 'prima-vittoria');
    const text = JSON.stringify(profileFile(mine));
    expect(parseProfileFile(text, parseProgress)).toEqual(mine);
  });

  it('un file che non è un profilo non si importa', () => {
    expect(parseProfileFile('non json', parseProgress)).toBe(null);
    expect(parseProfileFile('{"kind":"altro"}', parseProgress)).toBe(null);
    // una partita salvata non è un profilo
    expect(parseProfileFile('{"version":2,"initial":{},"actions":[]}', parseProgress)).toBe(null);
  });

  it('importare somma, non cancella', () => {
    const mine = progress({ games: 3, wins: 1, bestWorth: 2000, built: 10, winsByPreset: { classica: 1 } }, ['prima-partita'], 'prima-partita');
    const other = progress({ games: 7, wins: 5, bestWorth: 9000, built: 4, winsByPreset: { classica: 2, sprint: 3 } }, ['prima-partita', 'prima-vittoria']);
    const m = mergeProgress(mine, other);
    expect(m.profile).toMatchObject({ games: 10, wins: 6, bestWorth: 9000, built: 14, winsByPreset: { classica: 3, sprint: 3 } });
    expect(m.unlocked.sort()).toEqual(['prima-partita', 'prima-vittoria']);
    // il titolo che si indossa resta il proprio
    expect(m.title).toBe('prima-partita');
  });

  it('un profilo vuoto più uno pieno dà quello pieno', () => {
    const other = progress({ games: 2, wins: 1 }, ['prima-vittoria'], 'prima-vittoria');
    expect(mergeProgress(emptyProgress(), other)).toEqual(other);
  });

  it('le righe di statistiche dicono anche la percentuale di vittorie', () => {
    const rows = profileRows({ ...emptyProfile(), games: 4, wins: 1, bestWorth: 3000 }, money);
    expect(rows.find((r) => r.value.includes('%'))!.value).toBe('1 (25%)');
    expect(rows.some((r) => r.value === 'Ş 3000')).toBe(true);
    // nessuna partita: niente divisione per zero
    expect(profileRows(emptyProfile(), money).find((r) => r.value.includes('%'))!.value).toBe('0 (0%)');
  });

  it('aggiunge una voce allo storico a fine partita e la mostra in cima', () => {
    const s = newGame(['Anna', 'Computer']);
    s.players[1].isBot = true;
    s.winner = 0;
    s.round = 18;
    const p = updateProfile(emptyProfile(), { state: s, ctx: ctxWith(), seat: 0, stats: emptyStats(), online: false }, 'rapida', '2026-11-26T10:00:00.000Z');
    expect(p.history).toEqual([
      {
        date: '2026-11-26T10:00:00.000Z',
        board: 'citta',
        preset: 'rapida',
        players: [
          { name: 'Anna', bot: false },
          { name: 'Computer', bot: true },
        ],
        winner: 'Anna',
        rounds: 18,
      },
    ]);
    const html = renderProfileHistory(p);
    expect(html).toContain('Città sul Lago');
    expect(html).toContain('Rapida');
    expect(html).toContain('Anna');
    expect(html).toContain('18 giri');
  });

  it('tiene al massimo 20 partite nello storico, con la più recente in alto', () => {
    const s = newGame(['Anna', 'Bruno']);
    s.winner = 0;
    let p = emptyProfile();
    for (let i = 1; i <= 25; i++) {
      s.round = i;
      p = updateProfile(p, { state: s, ctx: ctxWith(), seat: 0, stats: emptyStats(), online: false }, 'classica', `2026-11-${String(i).padStart(2, '0')}T12:00:00.000Z`);
    }
    expect(p.history).toHaveLength(MAX_PROFILE_HISTORY);
    expect(p.history![0].rounds).toBe(25);
    expect(p.history![MAX_PROFILE_HISTORY - 1].rounds).toBe(6);
  });

  it('importa senza errori un profilo vecchio senza history e conserva history quando presente', () => {
    const oldRaw = JSON.stringify({
      kind: 'sdrogopoli-profilo',
      version: 1,
      progress: {
        profile: { games: 5, wins: 2, bestWorth: 4200, rentReceived: 800, built: 12, trades: 3, cleanGames: 2, winsByPreset: { classica: 2 }, onlineWins: 0 },
        unlocked: ['prima-partita', 'prima-vittoria'],
        title: 'prima-vittoria',
      },
    });
    const importedOld = parseProfileFile(oldRaw, parseProgress);
    expect(importedOld).not.toBeNull();
    expect(importedOld!.profile.games).toBe(5);
    expect(importedOld!.profile.history).toBeUndefined();
    expect(renderProfileHistory(importedOld!.profile)).toContain('Nessuna partita');

    const withHistory = progress({
      games: 1,
      wins: 1,
      history: [{ date: '2026-11-26T10:00:00.000Z', board: 'valle', preset: 'sprint', players: [{ name: 'Anna', bot: false }], winner: 'Anna', rounds: 14 }],
    });
    const parsedWithHistory = parseProfileFile(JSON.stringify(profileFile(withHistory)), parseProgress);
    expect(parsedWithHistory).toEqual(withHistory);
  });
});

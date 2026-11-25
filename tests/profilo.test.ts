import { describe, it, expect } from 'vitest';
import { emptyProfile } from '../src/ui/achievements';
import { emptyProgress, parseProgress, type Progress } from '../src/ui/prefs';
import { mergeProgress, parseProfileFile, profileFile, profileRows } from '../src/ui/profile';

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
});

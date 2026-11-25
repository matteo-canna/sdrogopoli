import { describe, it, expect } from 'vitest';
import { ACHIEVEMENTS, emptyProfile, EXTRA_COLORS, newlyUnlocked, unlockedColors, unlockedTitles, updateProfile, type AchievementCtx } from '../src/ui/achievements';
import { parseProgress } from '../src/ui/prefs';
import { it as itMsgs } from '../src/i18n/it';
import { emptyStats, netWorth, type GameState } from '../src/engine';
import { ctxWith, newGame, own } from './helpers';

function base(state: GameState, seat = 0): Omit<AchievementCtx, 'profile'> {
  return { state, ctx: ctxWith(), seat, stats: state.stats?.[seat] ?? emptyStats(), online: false };
}

describe('traguardi', () => {
  it('sono 30, con id diversi e tutte le frasi nelle due lingue', () => {
    expect(ACHIEVEMENTS).toHaveLength(30);
    expect(new Set(ACHIEVEMENTS.map((a) => a.id)).size).toBe(30);
    for (const a of ACHIEVEMENTS) {
      expect(Object.hasOwn(itMsgs, `goal.${a.id}`), a.id).toBe(true);
      expect(Object.hasOwn(itMsgs, `goalText.${a.id}`), a.id).toBe(true);
      if (a.unlock.kind === 'title') expect(Object.hasOwn(itMsgs, `title.${a.unlock.id}`), a.id).toBe(true);
      else expect(EXTRA_COLORS[a.unlock.id], a.id).toMatch(/^#[0-9a-f]{6}$/);
    }
  });

  it('a fine partita si raggiungono solo quelli nuovi', () => {
    const s = newGame();
    s.winner = 0;
    s.round = 12;
    own(s, 'periferia-1', 0);
    own(s, 'periferia-2', 0);
    const fresh = newlyUnlocked({ ...base(s), profile: { ...emptyProfile(), games: 1, wins: 1 } }, []);
    const ids = fresh.map((a) => a.id);
    expect(ids).toContain('prima-partita');
    expect(ids).toContain('prima-vittoria');
    expect(ids).toContain('un-quartiere');
    expect(ids).toContain('vittoria-veloce');
    expect(ids).not.toContain('cinque-vittorie');
    // già raggiunti: non tornano
    expect(newlyUnlocked({ ...base(s), profile: { ...emptyProfile(), games: 1, wins: 1 } }, ids).map((a) => a.id)).toEqual([]);
  });

  it('il profilo tiene il conto di partita in partita', () => {
    const s = newGame();
    s.winner = 0;
    s.stats = [{ ...emptyStats(), built: 4, trades: 2, rentReceived: 300 }, emptyStats()];
    const p1 = updateProfile(emptyProfile(), base(s), 'rapida');
    expect(p1).toMatchObject({ games: 1, wins: 1, built: 4, trades: 2, rentReceived: 300, winsByPreset: { rapida: 1 }, cleanGames: 1 });
    expect(p1.bestWorth).toBe(netWorth(s, ctxWith(), 0));
    const p2 = updateProfile(p1, base(s), 'sprint');
    expect(p2).toMatchObject({ games: 2, wins: 2, built: 8, winsByPreset: { rapida: 1, sprint: 1 } });
    // tre tipi diversi: il traguardo arriva alla terza
    expect(newlyUnlocked({ ...base(s), profile: p2 }, []).map((a) => a.id)).not.toContain('tre-tipi');
    const p3 = updateProfile(p2, base(s), 'obiettivo');
    expect(newlyUnlocked({ ...base(s), profile: p3 }, []).map((a) => a.id)).toContain('tre-tipi');
  });

  it('i premi sbloccati seguono i traguardi raggiunti', () => {
    expect(unlockedColors([])).toEqual([]);
    expect(unlockedColors(['venti-vittorie'])).toEqual([{ id: 'oro', hex: EXTRA_COLORS.oro }]);
    expect(unlockedTitles(['prima-vittoria', 'venti-vittorie'])).toEqual(['prima-vittoria']);
  });

  it('un file di traguardi rovinato non rompe niente', () => {
    expect(parseProgress(null)).toEqual({ profile: emptyProfile(), unlocked: [], title: '' });
    expect(parseProgress('non json').unlocked).toEqual([]);
    const p = parseProgress('{"unlocked":["prima-vittoria","inventato","prima-vittoria"],"title":"inventato","profile":{"games":-3,"wins":"due","built":7}}');
    expect(p.unlocked).toEqual(['prima-vittoria']);
    // un titolo non sbloccato non si indossa
    expect(p.title).toBe('');
    expect(p.profile).toMatchObject({ games: 0, wins: 0, built: 7 });
    expect(parseProgress('{"unlocked":["prima-vittoria"],"title":"prima-vittoria"}').title).toBe('prima-vittoria');
  });
});

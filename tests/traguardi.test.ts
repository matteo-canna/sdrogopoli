import { describe, it, expect } from 'vitest';
import { ACHIEVEMENTS, emptyProfile, EXTRA_COLORS, newlyUnlocked, unlockedColors, unlockedTitles, updateProfile, type AchievementCtx } from '../src/ui/achievements';
import { parseProgress } from '../src/ui/prefs';
import { it as itMsgs } from '../src/i18n/it';
import { BOARDS, board, cards } from '../src/data';
import { createGame, emptyStats, netWorth, type GameState } from '../src/engine';
import { ctxWith, newGame, own } from './helpers';

const ctx = { board, cards };

function base(state: GameState, seat = 0): Omit<AchievementCtx, 'profile'> {
  return { state, ctx: ctxWith(), seat, stats: state.stats?.[seat] ?? emptyStats(), online: false };
}

function hasGoal(ctx: Omit<AchievementCtx, 'profile'>, id: string): boolean {
  return newlyUnlocked({ ...ctx, profile: emptyProfile() }, []).some((a) => a.id === id);
}

describe('traguardi', () => {
  it('sono 40, con id diversi e tutte le frasi nelle due lingue', () => {
    expect(ACHIEVEMENTS).toHaveLength(40);
    expect(new Set(ACHIEVEMENTS.map((a) => a.id)).size).toBe(40);
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

  describe('i 10 traguardi nuovi', () => {
    it('vittoria-squadra: si sblocca vincendo in squadra (anche per il compagno)', () => {
      const s = createGame(['A', 'B', 'C', 'D'], ctx, { teams: true });
      s.winner = 0;
      expect(hasGoal(base(s, 2), 'vittoria-squadra')).toBe(true);
    });

    it('vittoria-squadra: non si sblocca per la squadra perdente o senza squadre', () => {
      const s = createGame(['A', 'B', 'C', 'D'], ctx, { teams: true });
      s.winner = 0;
      expect(hasGoal(base(s, 1), 'vittoria-squadra')).toBe(false);
      const noTeams = newGame();
      noTeams.winner = 0;
      expect(hasGoal(base(noTeams, 0), 'vittoria-squadra')).toBe(false);
    });

    it('vittoria-valle: si sblocca vincendo su Valle Stretta', () => {
      const valle = BOARDS.find((b) => b.id === 'valle')!.data;
      const valleCtx = { board: valle, cards };
      const s = createGame(['A', 'B'], valleCtx);
      s.winner = 0;
      expect(hasGoal({ ...base(s, 0), ctx: valleCtx }, 'vittoria-valle')).toBe(true);
    });

    it('vittoria-valle: non si sblocca su Città sul Lago o perdendo', () => {
      const s = newGame();
      s.winner = 0;
      expect(hasGoal(base(s, 0), 'vittoria-valle')).toBe(false);
    });

    it('tre-quote: si sblocca con tutte e 3 le quote di un quartiere', () => {
      const s = newGame();
      s.shares = { periferia: [0, 0, 0] };
      expect(hasGoal(base(s, 0), 'tre-quote')).toBe(true);
    });

    it('tre-quote: non si sblocca con meno di 3 quote dello stesso quartiere', () => {
      const s = newGame();
      s.shares = { periferia: [0, 0, 1], porto: [0] };
      expect(hasGoal(base(s, 0), 'tre-quote')).toBe(false);
    });

    it('dividendi-500: si sblocca incassando almeno 500 dalle quote', () => {
      const s = newGame();
      s.stats[0].dividends = 500;
      expect(hasGoal(base(s, 0), 'dividendi-500')).toBe(true);
    });

    it('dividendi-500: non si sblocca sotto 500 di dividendi', () => {
      const s = newGame();
      s.stats[0].dividends = 490;
      expect(hasGoal(base(s, 0), 'dividendi-500')).toBe(false);
    });

    it('tre-edifici: si sblocca avendo fontana, mercato e teatro nella stessa partita', () => {
      const s = newGame();
      s.landmarks = {
        periferia: { id: 'fontana', owner: 0 },
        porto: { id: 'mercato', owner: 0 },
        centro: { id: 'teatro', owner: 0 },
      };
      expect(hasGoal(base(s, 0), 'tre-edifici')).toBe(true);
    });

    it('tre-edifici: non si sblocca se manca un tipo o è di un altro giocatore', () => {
      const s = newGame();
      s.landmarks = {
        periferia: { id: 'fontana', owner: 0 },
        porto: { id: 'mercato', owner: 0 },
        centro: { id: 'teatro', owner: 1 },
      };
      expect(hasGoal(base(s, 0), 'tre-edifici')).toBe(false);
    });

    it('vittoria-festa: si sblocca vincendo con eventi e Ruota del Mercato attivi', () => {
      const s = createGame(['A', 'B'], ctx, { events: true, wheel: true });
      s.winner = 0;
      expect(hasGoal(base(s, 0), 'vittoria-festa')).toBe(true);
    });

    it('vittoria-festa: non si sblocca se manca una delle due regole o non si vince', () => {
      const s = createGame(['A', 'B'], ctx, { events: true, wheel: false });
      s.winner = 0;
      expect(hasGoal(base(s, 0), 'vittoria-festa')).toBe(false);
    });

    it('partita-online: si sblocca finendo una partita online anche senza vincere', () => {
      const s = newGame();
      s.winner = 1;
      expect(hasGoal({ ...base(s, 0), online: true }, 'partita-online')).toBe(true);
    });

    it('partita-online: non si sblocca in una partita locale', () => {
      const s = newGame();
      s.winner = 0;
      expect(hasGoal(base(s, 0), 'partita-online')).toBe(false);
    });

    it('senza-case: si sblocca vincendo con 0 case costruite', () => {
      const s = newGame();
      s.winner = 0;
      s.stats[0].built = 0;
      expect(hasGoal(base(s, 0), 'senza-case')).toBe(true);
    });

    it('senza-case: non si sblocca se si è costruita almeno una casa', () => {
      const s = newGame();
      s.winner = 0;
      s.stats[0].built = 1;
      expect(hasGoal(base(s, 0), 'senza-case')).toBe(false);
    });

    it('poche-vie: si sblocca vincendo con meno di 3 proprietà', () => {
      const s = newGame();
      s.winner = 0;
      own(s, 'periferia-1', 0);
      own(s, 'periferia-2', 0);
      expect(hasGoal(base(s, 0), 'poche-vie')).toBe(true);
    });

    it('poche-vie: non si sblocca vincendo con 3 o più proprietà', () => {
      const s = newGame();
      s.winner = 0;
      own(s, 'periferia-1', 0);
      own(s, 'periferia-2', 0);
      own(s, 'porto-1', 0);
      expect(hasGoal(base(s, 0), 'poche-vie')).toBe(false);
    });

    it('grande-rimonta: si sblocca vincendo dopo essere scesi a 500 o meno di patrimonio', () => {
      const s = newGame();
      s.winner = 0;
      s.history = [[1500, 1500], [480, 2100], [2400, 0]];
      expect(hasGoal(base(s, 0), 'grande-rimonta')).toBe(true);
    });

    it('grande-rimonta: non si sblocca se il patrimonio è sempre rimasto sopra 500', () => {
      const s = newGame();
      s.winner = 0;
      s.history = [[1500, 1500], [600, 1900], [2400, 0]];
      expect(hasGoal(base(s, 0), 'grande-rimonta')).toBe(false);
    });
  });
});

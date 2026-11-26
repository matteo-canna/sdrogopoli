// Controller dell'interfaccia: collega i clic alle azioni del motore e ridisegna la pagina.
// Le parti più grandi stanno in moduli separati: schermata iniziale (setup.ts), partita salvata
// e "Annulla" (session.ts), turni del computer (bots.ts), suoni (sounds.ts), preferenze (prefs.ts),
// pannelli del turno e cassetto giocatori (gamePanel.ts), eventi e clic (gameEvents.ts),
// tastiera (keyboard.ts), tavolo online (onlineTable.ts), scambi (tradeModal.ts) e replay (replayModal.ts).
import './style.css';
import { board, cards, currentBoard, setBoard } from '../data';
import { actingPlayer, chooseBotAction, createGame, emptyStats, openRound, RuleError, type Action, type GameContext, type GameState, type SaveFile } from '../engine';
import { money, renderBoardBox, spaceLabel, type TradeDraft } from './view';
import type { Board3D } from './three/board3d';
import type { CameraMode } from './three/camera';
import type { SkyMode } from './three/city';
import { webglAvailable } from './webgl';
import { load3d } from './lazy3d';
import { runLoading, translateSplash } from './loading';
import { addResult } from './summary';
import { achievementTitle, EXTRA_COLORS, newlyUnlocked, titleLabel, updateProfile } from './achievements';
import { characterDef, colorName, playerColor } from './characters';
import { audio } from './audio';
import { KEYS, loadLeaderboard, loadPreset, loadProgress, loadSky, loadSpeed, loadTutorial, readPref, saveLeaderboard, saveProgress, saveTutorial, writePref, type Speed } from './prefs';
import { GameSession, randomSeed } from './session';
import { BotScheduler } from './bots';
import { soundFor } from './sounds';
import { refreshBoards, renderSetup, setupLooks, SEATS_SHOWN, type SetupChoice } from './setup';
import { decodeBoard, linkCode as linkBoardCode, loadCustomBoards, saveCustomBoard } from './boardStore';
import { setupOffline } from './pwa';
import { deleteSlot, downloadSave, listSlots, parseSaveText } from './slots';
import { announce, moveAnnouncement } from './announce';
import { animateMoney, bigMoments, momentText, moneyChanges, moneyNotices, showMoment, showNotices } from './moments';
import { dailyResult } from './daily';
import { t, type MsgKey } from '../i18n';
import { applySettings, LANG_EVENT, loadSettings } from './settings';
import { fillPanels, gameShell, resumeSummary, type PanelOptions, type ViewMode } from './gamePanel';
import { bindGameEvents } from './gameEvents';
import { bindKeyboard, focusKey, restoreFocus } from './keyboard';
import { OnlineTable } from './onlineTable';

const ctx: GameContext = { board, cards };
const useBoard = (id: string | undefined | null): void => {
  ctx.board = setBoard(id);
};
const app = document.querySelector<HTMLDivElement>('#app')!;

const session = new GameSession(ctx);
const startSettings = loadSettings();
applySettings(startSettings);
audio.setVolumes(startSettings.sfxVolume, startSettings.musicVolume);
translateSplash();
loadCustomBoards();
useBoard(readPref(KEYS.board));
session.load();

let selected: string | null = null;
let error = '';
let viewMode: ViewMode = webglAvailable() && readPref(KEYS.view) !== '2d' ? '3d' : '2d';
let cameraMode: CameraMode = 'follow';
let skyMode: SkyMode = loadSky();
let board3d: Board3D | null = null;
let speed: Speed = loadSpeed();
let animating = false;
let newsFrom = session.state?.eventCount ?? 0;
let lastActorBot = false;
let tradeDraft: TradeDraft | null = null;
const tutorial = loadTutorial();
const phoneQuery = window.matchMedia('(max-width: 900px)');
let drawerOpen = false;
let resumeOffered = !!session.state;
let dailyDay: string | null = null;
let newGoals: { icon: string; title: string; prize: string }[] = [];

phoneQuery.addEventListener('change', () => {
  drawerOpen = false;
  destroy3d();
  if (session.state && !resumeOffered) render();
});

const table = new OnlineTable({
  app,
  ctx,
  getState: () => session.state,
  setState: (s) => (session.state = s),
  clearSession: () => session.clear(),
  loadSession: () => session.load(),
  useBoard,
  cancelBots: () => bots.cancel(),
  destroy3d,
  onResetUi: (opts) => {
    resumeOffered = opts.resumeOffered;
    selected = null;
    tradeDraft = null;
    newsFrom = opts.newsFrom;
    if (opts.lastActorBot !== undefined) lastActorBot = opts.lastActorBot;
    if (opts.clearError) error = '';
  },
  setError: (msg) => (error = msg),
  onMoveReceived: (prev, next, action, mine) => {
    if (mine || !lastActorBot) newsFrom = prev.eventCount ?? 0;
    lastActorBot = !mine;
    if (mine) error = '';
    afterMove(prev, next, action, mine);
  },
  render,
});

function persist(): void {
  if (!table.online) session.save();
}

const bots = new BotScheduler(
  () => !animating && botToPlay(),
  () => (session.state!.phase === 'roll' ? 900 : 650) / speed.factor,
  () => {
    if (table.online?.role === 'host') table.stepComputer();
    else act(chooseBotAction(session.state!, ctx));
  },
);

function botToPlay(): boolean {
  const s = session.state;
  if (!s || s.phase === 'gameOver') return false;
  if (table.online) return table.isComputerSeat(actingPlayer(s));
  return !!s.players[actingPlayer(s)].isBot;
}

// ---------- schermata iniziale ----------

function showSetup(): void {
  destroy3d();
  const s = session.state;
  const resume = s && resumeOffered ? { summary: resumeSummary(s), onContinue: () => ((resumeOffered = false), render()) } : undefined;
  renderSetup(
    app,
    tutorial.on,
    startGame,
    resume,
    {
      list: listSlots(),
      onLoad: (id) => {
        const slot = listSlots().find((x) => x.id === id);
        const file = slot && parseSaveText(JSON.stringify(slot.file), ctx, randomSeed());
        if (file) openFile(file);
      },
      onExport: (id) => {
        const slot = listSlots().find((x) => x.id === id);
        if (slot) downloadSave(slot.name, slot.file);
      },
      onDelete: (id) => deleteSlot(id),
      onImport: async (f) => {
        const file = parseSaveText(await f.text(), ctx, randomSeed());
        if (!file) return false;
        openFile(file);
        return true;
      },
    },
    table.setupHandlers(),
  );
}

function openFile(file: SaveFile): void {
  bots.cancel();
  session.open(file);
  resumeOffered = false;
  selected = null;
  error = '';
  newsFrom = file.state.eventCount ?? 0;
  session.save();
  render();
}

function startGame(choice: SetupChoice): void {
  resumeOffered = false;
  dailyDay = choice.daily ?? null;
  useBoard(choice.boardId);
  writePref(KEYS.board, currentBoard());
  session.start(openRound(createGame(choice.players, ctx, choice.rules, choice.seed ?? randomSeed()), ctx));
  if (choice.tipsOn && !tutorial.on) tutorial.seen.clear();
  tutorial.on = choice.tipsOn;
  saveTutorial(tutorial);
  selected = null;
  newsFrom = 0;
  lastActorBot = false;
  session.save();
  render();
}

// ---------- partita ----------

function panelOptions(s: GameState): PanelOptions {
  return {
    state: s,
    ctx,
    viewMode,
    cameraMode,
    skyMode,
    speed,
    phone: phoneQuery.matches,
    drawerOpen,
    animating,
    selected,
    error,
    newsFrom,
    tradeDraft,
    tutorial,
    canUndo: session.canUndo,
    canReplay: !!session.toFile(),
    titles: myTitles(s),
    unlocked: newGoals,
    onlineCode: table.online?.code ?? null,
    mySeat: table.mySeat(),
    myTurn: table.myTurn(s),
    iAmAway: table.iAmAway(),
    timeLeft: table.timeLeft(),
    seatNote: table.seatNote(actingPlayer(s)),
    saysHtml: table.saysHtml(),
  };
}

function render(): void {
  const s = session.state;
  if (table.online && !s) return table.showLobby();
  if (!s || resumeOffered) return showSetup();
  const focus = focusKey(app);
  if (viewMode === '3d') render3d(s);
  else {
    animating = false;
    render2d(s);
  }
  restoreFocus(app, focus);
  bots.schedule();
}

function selectSpace(spaceId: string | null): void {
  selected = selected === spaceId ? null : spaceId;
  error = '';
  if (selected && session.state) {
    announce(`${spaceLabel(session.state, board.spaces.findIndex((sp) => sp.id === selected))}. ${t('announce.cardOpen')}`);
  }
  render();
}

function render2d(s: GameState): void {
  destroy3d();
  app.innerHTML = gameShell(renderBoardBox(s, selected), '2d', drawerOpen, table.online?.code ?? null);
  fillPanels(app, panelOptions(s));
}

let loading3d = false;
function render3d(s: GameState): void {
  if (!board3d) {
    if (!app.querySelector('.game3d .board3d')) {
      app.innerHTML = gameShell(
        `<div class="board3d" tabindex="0" role="region" aria-label="${t('board3d.label')}"><p class="loading-3d">${t('board3d.loading')}</p></div>`,
        '3d',
        drawerOpen,
        table.online?.code ?? null,
      );
    }
    fillPanels(app, panelOptions(s));
    if (loading3d) return;
    loading3d = true;
    load3d()
      .then(({ Board3D }) => {
        loading3d = false;
        if (!session.state || viewMode !== '3d' || board3d) return;
        create3d(Board3D);
        render();
      })
      .catch(() => {
        loading3d = false;
        viewMode = '2d';
        render();
      });
    return;
  }
  fillPanels(app, panelOptions(s));
  board3d.update(s, selected);
}

function create3d(Board3DClass: typeof Board3D): void {
  const box = app.querySelector<HTMLDivElement>('.board3d')!;
  box.innerHTML = '';
  board3d = new Board3DClass(
    box,
    (spaceId) => selectSpace(spaceId),
    (busy) => {
      animating = busy;
      app.querySelector('.game')?.classList.toggle('busy', busy);
      if (!busy) bots.schedule();
    },
    () => {
      destroy3d();
      setTimeout(() => {
        if (session.state && viewMode === '3d' && !board3d) render();
      }, 300);
    },
  );
  board3d.quality = loadSettings().quality;
  board3d.onQualityChange = (level, lowered) => {
    if (lowered) showNotices([{ k: 'settings.qualityLowered', p: { level: t(`settings.quality.${level}` as MsgKey) } }]);
  };
  board3d.cameraMode = cameraMode;
  board3d.skyMode = skyMode;
  board3d.speed = speed.factor;
  board3d.onHop = () => audio.play('hop');
}

function destroy3d(): void {
  animating = false;
  board3d?.dispose();
  board3d = null;
}

function act(action: Action): void {
  const before = session.state;
  if (!before) return;
  if (table.online) {
    if (!table.myTurn(before) && !botToPlay()) return;
    if (table.online.role === 'guest') table.online.room.send(action);
    else {
      const reason = table.online.room.act(action);
      if (reason) {
        error = t(reason.k, reason.p);
        audio.play('error');
        render();
      }
    }
    return;
  }
  const actorBot = !!before.players[actingPlayer(before)].isBot;
  if (!actorBot || !lastActorBot) newsFrom = before.eventCount ?? 0;
  lastActorBot = actorBot;
  try {
    const prev = session.apply(action);
    error = '';
    afterMove(prev, session.state!, action, !actorBot);
  } catch (e) {
    if (e instanceof RuleError) {
      error = t(e.key, e.params);
      audio.play('error');
    } else throw e;
  }
  persist();
  render();
}

function soleHuman(s: GameState): number | null {
  const people = s.players.filter((p) => !p.isBot);
  return people.length === 1 ? people[0].id : null;
}

function mySeats(s: GameState): number[] {
  if (table.online) {
    const seat = table.mySeat();
    return seat === null ? [] : [seat];
  }
  return s.players.filter((p) => !p.isBot).map((p) => p.id);
}

function checkGoals(state: GameState): void {
  newGoals = [];
  const presetId = loadPreset();
  for (const seat of mySeats(state)) {
    const progress = loadProgress();
    const base = { state, ctx, seat, stats: state.stats?.[seat] ?? emptyStats(), online: !!table.online };
    const profile = updateProfile(progress.profile, base, presetId);
    const fresh = newlyUnlocked({ ...base, profile }, progress.unlocked);
    saveProgress({ ...progress, profile, unlocked: [...progress.unlocked, ...fresh.map((a) => a.id)] });
    for (const a of fresh) {
      const prize = a.unlock.kind === 'color' ? t('goals.prizeColor', { name: colorName(EXTRA_COLORS[a.unlock.id]) }) : t('goals.prizeTitle', { name: titleLabel(a.unlock.id) });
      newGoals.push({ icon: a.icon, title: achievementTitle(a.id), prize });
    }
  }
  if (newGoals.length) audio.play('win');
}

function myTitles(s: GameState): Record<number, string> {
  const title = loadProgress().title;
  if (!title) return {};
  return Object.fromEntries(mySeats(s).map((seat) => [seat, titleLabel(title)]));
}

function afterMove(prev: GameState, state: GameState, action: Action, mine: boolean): void {
  announce(...moveAnnouncement(prev, state, table.online ? table.mySeat() : soleHuman(state)));
  const changes = moneyChanges(prev, state);
  const notices = moneyNotices(prev, state);
  const moments = bigMoments(prev, state, ctx);
  announce(...moments.filter((m) => m.msg.k !== 'moment.bankrupt').map(momentText));
  setTimeout(() => {
    animateMoney(app, changes, money, (seat) => session.state?.players[seat]?.money ?? 0);
    showNotices(notices, speed.factor);
    const m = moments.at(-1);
    if (m && state.phase !== 'gameOver') showMoment(m, playerColor(state.players[m.seat]));
  }, 0);
  if (action.type === 'roll') {
    audio.play('dice');
    if (state.lastRoll) board3d?.showDice(state.lastRoll, prev.current);
  }
  if (prev.phase !== 'gameOver' && state.phase === 'gameOver') {
    saveLeaderboard(addResult(loadLeaderboard(), state, ctx));
    checkGoals(state);
    const seat = mySeats(state)[0];
    if (dailyDay !== null && seat !== undefined) writePref(KEYS.daily, JSON.stringify(dailyResult(state, ctx, seat, dailyDay)));
  }
  const sfx = soundFor(prev, state, action);
  if (sfx && sfx !== 'dice') setTimeout(() => audio.play(sfx), action.type === 'roll' ? 450 / speed.factor : 0);
  if (action.type === 'roll' && (mine || !table.online)) {
    selected = state.phase === 'buy' ? board.spaces[state.players[state.current].position]?.id ?? null : null;
  }
  if (action.type === 'buy' || action.type === 'decline') selected = null;
  if (action.type === 'endTurn' || action.type === 'bankrupt') {
    selected = null;
    tradeDraft = null;
  }
}

// ---------- eventi ----------

bindKeyboard(app, {
  getState: () => session.state,
  getSelected: () => selected,
  getBoard3d: () => board3d,
  selectSpace,
  canEscape: () => !!session.state && !resumeOffered && !(table.online && table.lobbyShown),
  onEscape: () => {
    if (selected) selected = null;
    else if (drawerOpen) drawerOpen = false;
    else return false;
    render();
    return true;
  },
});

bindGameEvents({
  app,
  ctx,
  session,
  table,
  tutorial,
  getBoard3d: () => board3d,
  getViewMode: () => viewMode,
  setViewMode: (m) => (viewMode = m),
  getSkyMode: () => skyMode,
  setSkyMode: (m) => (skyMode = m),
  getCameraMode: () => cameraMode,
  setCameraMode: (m) => (cameraMode = m),
  getSpeed: () => speed,
  setSpeed: (s) => (speed = s),
  getSelected: () => selected,
  setSelected: (id) => (selected = id),
  selectSpace,
  toggleDrawer: () => (drawerOpen = !drawerOpen),
  getTradeDraft: () => tradeDraft,
  setTradeDraft: (d) => (tradeDraft = d),
  getError: () => error,
  setError: (e) => (error = e),
  resetNews: (state) => {
    newsFrom = state.eventCount ?? 0;
    lastActorBot = false;
  },
  botToPlay,
  cancelBots: () => bots.cancel(),
  act,
  persist,
  render,
});

setupOffline();

window.addEventListener(LANG_EVENT, () => {
  if (board3d) destroy3d();
  render();
});

const boardLink = linkBoardCode(location.hash);
if (boardLink) {
  history.replaceState(null, '', location.pathname + location.search);
  void decodeBoard(boardLink).then((result) => {
    if (!result.ok) return showNotices([{ k: 'editor.linkBad' }], 1.5);
    const id = saveCustomBoard(result.data);
    writePref(KEYS.board, id);
    if (!session.state) useBoard(id);
    refreshBoards(id);
    showNotices([{ k: 'editor.fromLink', p: { name: result.data.title ?? '' } }], 1.5);
  });
}

table.initFromLocation();

render();
const neededCharacters = webglAvailable() && viewMode === '3d'
  ? [...new Set((session.state ? session.state.players.map((p) => p.appearance?.character) : setupLooks.slice(0, SEATS_SHOWN).map((l) => l.character)).filter((c): c is string => !!c))]
  : [];
void runLoading(
  neededCharacters.map((id) => ({
    label: `${characterDef(id).emoji} ${t('loading.characterReady', { name: characterDef(id).label })}`,
    run: () => load3d().then((m) => m.loadModel(id)),
  })),
);

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
import { KEYS, SKY_LABELS, SPEEDS, loadLeaderboard, loadPreset, loadProgress, loadSky, loadSpeed, loadTutorial, readPref, saveLeaderboard, saveProgress, saveTutorial, writePref, type Speed } from './prefs';
import { GameSession, randomSeed, rematchSetup } from './session';
import { BotScheduler } from './bots';
import { soundFor } from './sounds';
import { refreshBoards, renderSetup, setupLooks, SEATS_SHOWN, type SetupChoice } from './setup';
import { decodeBoard, linkCode as linkBoardCode, loadCustomBoards, saveCustomBoard } from './boardStore';
import { setupOffline } from './pwa';
import { deleteSlot, downloadSave, listSlots, parseSaveText } from './slots';
import { DESKTOP, setupDesktopLinks } from './platform';
import { reportUrl } from './report';
import { logToText } from './logText';
import { defaultSlotName, deleteSlot, downloadSave, FILE_EXT, listSlots, parseSaveText, saveSlot } from './slots';
import { cleanCode, codeFromHash, openTransport, renderLobby, tableCode, updateLobby, type LobbyView } from './online';
import { HostRoom, type HostSnapshot } from '../net/host';
import { QUICK_SAYS, sayText } from '../net/chat';
import { turnServers } from '../net/turn';
import { GuestRoom } from '../net/guest';
import { announce, moveAnnouncement } from './announce';
import { animateMoney, bigMoments, momentText, moneyChanges, moneyNotices, showMoment, showNotices } from './moments';
import { dailyResult } from './daily';
import { t, type MsgKey } from '../i18n';
import { applySettings, LANG_EVENT, loadSettings } from './settings';
import { fillPanels, gameShell, resumeSummary, type PanelOptions, type ViewMode } from './gamePanel';
import { bindGameEvents } from './gameEvents';
import { bindKeyboard, focusKey, restoreFocus } from './keyboard';
import { OnlineTable } from './onlineTable';
import { Replay, REPLAY_SPEEDS, type ReplaySpeed } from './replay';
import { getLang, t, text, type MsgKey } from '../i18n';
import { applySettings, LANG_EVENT, loadSettings, openSettings } from './settings';

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
  }, DESKTOP ? undefined : {
    // nella versione per Mac non c'è il gioco online
    onCreate: () => void enterTable('host', tableCode()),
    onJoin: (raw) => {
      const code = cleanCode(raw);
      if (code) void enterTable('guest', code);
      return !!code;
    },
  });
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

// Due righe sulla partita salvata: chi gioca, a che punto è e chi è in testa.
function resumeSummary(s: GameState): string {
  const alive = s.players.filter((p) => !p.bankrupt);
  const who = s.players.map((p) => `${playerBadge(s, p.id, 'token')} ${escapeHtml(p.name)}`).join(' ');
  const round = s.rules?.maxRounds ? t('round.ofMax', { n: s.round, max: s.rules.maxRounds }) : t('round.n', { n: s.round });
  const turn = s.phase === 'gameOver' ? t('game.over') : `${round} · ${t('turn.of', { name: escapeHtml(s.players[actingPlayer(s)].name) })}`;
  return `<p class="resume-players">${who}</p><p class="resume-meta">${turn} · ${alive.length} in gioco</p>`;
}

let lastSetup: SetupChoice | null = null;

function startGame(choice: SetupChoice): void {
  bots.cancel();
  destroy3d();
  lastSetup = choice;
  resumeOffered = false;
  dailyDay = choice.daily ?? null;
  useBoard(choice.boardId);
  writePref(KEYS.board, currentBoard());
  session.start(openRound(createGame(choice.players, ctx, choice.rules, choice.seed ?? randomSeed()), ctx));
  if (choice.tipsOn && !tutorial.on) tutorial.seen.clear();
  tutorial.on = choice.tipsOn;
  saveTutorial(tutorial);
  selected = null;
  tradeDraft = null;
  error = '';
  newGoals = [];
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
function tipHtml(s: GameState): string {
  if (!tutorial.on || tradeDraft) return '';
  const tip = tutorialTip(s, ctx, tutorial.seen);
  if (!tip) return '';
  return `<div class="tip" role="note">
      <h4>💡 ${escapeHtml(tip.title)}</h4>
      <p>${escapeHtml(tip.text)}</p>
      <div class="tip-buttons">
        <button data-action="tipOk" data-tip="${tip.id}">${t('tip.ok')}</button>
        <button class="link" data-action="tipOff">${t('tip.off')}</button>
      </div>
    </div>`;
}

// Obiettivo della partita, se c'è: quanto manca a chi gioca su questo schermo (o a chi è di turno).
function goalPill(s: GameState): string {
  const r = s.rules;
  if (!r || (!r.goalWorth && !r.goalGroups && !r.goalSide)) return '';
  const parts = [r.goalGroups ? t('goal.groups', { n: r.goalGroups }) : '', r.goalWorth ? `${board.currency.symbol} ${r.goalWorth}` : '', r.goalSide ? t('goal.side') : ''].filter(Boolean);
  return `<span class="pill" title="${t('goal.title')}">🎯 ${parts.join(` ${t('goal.or')} `)}</span>`;
}

function sprintLabel(face: SprintFace): string {
  return typeof face === 'number' ? `+${face}` : face === 'occasione' ? '🛒' : '💥';
}

// Riga del turno: chi gioca, giro, montepremi e ultimo lancio.
function turnHtml(s: GameState): string {
  const id = s.phase === 'gameOver' && s.winner !== null ? s.winner : actingPlayer(s);
  const p = s.players[id];
  const total = s.lastRoll ? s.lastRoll[0] + s.lastRoll[1] : 0;
  return `
    <div class="turn" style="--c:${playerColor(p)}">
      ${playerBadge(s, id)}
      <span>${s.phase === 'gameOver' ? `<strong>${t('game.over')}</strong>` : t('turn.of', { name: `<strong>${p.isBot ? '🤖 ' : ''}${escapeHtml(p.name)}</strong>` })}</span>
      ${s.rules?.demo ? `<span class="pill demo" title="${t('game.demoTitle')}">🧪 Demo</span>` : ''}
      ${s.rules?.maxRounds ? `<span class="pill">${t('round.ofMax', { n: s.round, max: s.rules.maxRounds })}</span>` : ''}
      ${online ? `<span class="pill clock" data-clock aria-label="${t('online.clock')}" ${timeLeft() === null ? 'hidden' : ''}>⏱ ${clockText(timeLeft() ?? 0)}</span>` : ''}
      ${s.rules?.parkPot ? `<span class="pill" title="${t('game.potTitle')}">🪑 ${board.currency.symbol} ${s.pot}</span>` : ''}
      ${goalPill(s)}
      ${s.lastRoll ? `<span class="roll">${renderDice(s)}${s.lastSprint ? `<span class="sprint-die" title="${t('game.sprintDie')}">${sprintLabel(s.lastSprint)}</span>` : ''}<span class="roll-total">${total + (typeof s.lastSprint === 'number' ? s.lastSprint : 0)}</span></span>` : ''}
    </div>`;
}

// Pulsanti del turno (o modulo dello scambio), consiglio ed errore: la parte da tenere sempre a portata di dito.
function controlsHtml(s: GameState): string {
  // online, quando tocca a un altro, al posto dei pulsanti si dice chi sta giocando
  const waiting = s.phase !== 'gameOver' && !myTurn(s);
  const actions = waiting
    ? `<div class="actions waiting"><p class="wait">${mySeat() === null ? `👀 ${t('online.watching')}` : `⏳ ${t('online.waitTurn', { name: `<strong>${escapeHtml(s.players[actingPlayer(s)].name)}</strong>` })}`}${seatNote(actingPlayer(s))}</p></div>`
    : `${iAmAway() ? `<p class="away-note" role="status">🤖 ${t('online.awayNote')}</p>` : ''}<div class="actions">${renderTurnActions(s)}${undoButton()}</div>`;
  return `
    ${tradeDraft && !waiting ? renderTradeEditor(s, tradeDraft) : actions}
    ${saysHtml()}
    ${error ? `<p class="error" role="alert">${escapeHtml(error)}</p>` : ''}
    ${tipHtml(s)}`;
}

// Notizie, fine partita e registro: si leggono con calma.
// Nel 2D l'evento del quartiere sta al centro del tabellone; nel 3D lì non c'è posto, quindi
// compare nel pannello di fianco.
function infoHtml(s: GameState): string {
  const fresh = Math.min(Math.max((s.eventCount ?? 0) - newsFrom, 0), s.log.length, 8);
  const news = fresh ? s.log.slice(-fresh) : [];
  return `
    ${s.phase === 'gameOver' ? renderSummary(s, ctx, { titles: myTitles(s), unlocked: newGoals, canReplay: !!session.toFile(), canRematch: !online }) : viewMode === '3d' ? renderEvents(s) : ''}
    ${news.length ? `<div class="news"><h4>${t('news.title')}</h4><ul>${news.map((l) => `<li>${escapeHtml(text(l))}</li>`).join('')}</ul></div>` : ''}
    ${selected ? '' : `<p class="hint">${t('hint.tapSpace')}</p>`}
    <details class="log-box"><summary>${t('log.title')}</summary>
      <div class="log-tools"><button type="button" data-action="copyLog">📋 ${t('log.copy')}</button></div>
      <ol class="log">${s.log.slice().reverse().map((l) => `<li>${escapeHtml(text(l))}</li>`).join('')}</ol>
    </details>`;
}

function soundButtons(): string {
  return `<button data-action="toggleSfx" aria-pressed="${audio.sfxOn}" aria-label="${t('tools.sfx')}" title="${t('tools.sfx')}">${audio.sfxOn ? '🔊' : '🔇'}<span class="lbl"> ${t('tools.sfxShort')}</span></button>
    <button data-action="toggleMusic" aria-pressed="${audio.musicOn}" aria-label="${t('tools.music')}" title="${t('tools.music')}">${audio.musicOn ? '🎵' : '🚫'}<span class="lbl"> ${t('tools.music')}</span></button>`;
}

function settingsButton(): string {
  return `<button data-action="settings" aria-label="${t('settings.title')}" title="${t('settings.hint')}">⚙️<span class="lbl"> ${t('settings.title')}</span></button>`;
}

function viewButtons(): string {
  const cam = viewMode === '3d'
    ? `<button data-action="camera" aria-label="${cameraMode === 'follow' ? t('tools.overview') : t('tools.follow')}">${cameraMode === 'follow' ? `🗺️<span class="lbl"> ${t('tools.overview')}</span>` : `🎥<span class="lbl"> ${t('tools.follow')}</span>`}</button>`
    : '';
  const toggle = webglAvailable()
    ? `<button data-action="toggleView" aria-label="${viewMode === '3d' ? t('tools.view2d') : t('tools.view3d')}">${viewMode === '3d' ? `🔲<span class="lbl"> ${t('tools.view2d')}</span>` : `🧊<span class="lbl"> ${t('tools.view3d')}</span>`}</button>`
    : '';
  const [icon, skyKey] = SKY_LABELS[skyMode];
  const label = t(skyKey);
  const sky = viewMode === '3d'
    ? `<button data-action="sky" aria-label="${t('tools.sky', { label })}" title="${t('tools.sky', { label })}">${icon}<span class="lbl"> ${label}</span></button>`
    : '';
  const speedLabel = t(`speed.${speed.id}` as MsgKey);
  const speedBtn = `<button data-action="speed" aria-label="${t('tools.speed', { label: speedLabel })}" title="${t('tools.speed', { label: speedLabel })}">${speed.icon}<span class="lbl"> ${speedLabel}</span></button>`;
  return cam + sky + toggle + speedBtn + soundButtons() + settingsButton();
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
// Un solo gestore di clic per tutta la pagina.
app.addEventListener('click', (e) => {
  // l'audio si può attivare solo dopo un gesto dell'utente
  audio.unlock();
  // la segnalazione si compila al momento del clic, con le ultime mosse
  const report = (e.target as HTMLElement).closest<HTMLAnchorElement>('[data-report]');
  if (report) {
    report.href = reportUrl(session.state, viewMode);
    return;
  }
  const target = (e.target as HTMLElement).closest<HTMLElement>('[data-action], [data-space]');
  const state = session.state;
  if (!target || !state) return;
  // mentre la pedina si muove le azioni del turno aspettano
  if (target.closest('.game.busy .actions')) return;
  // durante il turno del computer i pulsanti del turno non rispondono
  if (botToPlay() && target.closest('.actions')) return;
  const action = target.dataset.action;
  const spaceId = target.dataset.space;
  if (!action && spaceId) return selectSpace(spaceId);
  switch (action) {
    case 'closeCard':
      selected = null;
      return render();
    case 'drawer':
      drawerOpen = !drawerOpen;
      return render();
    case 'tipOk':
      tutorial.seen.add(target.dataset.tip ?? '');
      saveTutorial(tutorial);
      return render();
    case 'tipOff':
      tutorial.on = false;
      saveTutorial(tutorial);
      return render();
    case 'toggleSfx':
      audio.setSfx(!audio.sfxOn);
      return render();
    case 'share':
      void shareResult(state, ctx).then((how) => {
        if (how === 'downloaded') showNotices([{ k: 'share.done' }]);
      });
      return;
    case 'replay':
      openReplay();
      return;
    case 'rematch':
      if (online) return;
      startGame(rematchSetup(state, lastSetup ?? { boardId: currentBoard(), rules: state.rules, tipsOn: tutorial.on }, ctx));
      return;
    case 'copyLog': {
      const content = logToText(state, getLang());
      const download = () => {
        const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = 'registro.txt';
        a.click();
        setTimeout(() => URL.revokeObjectURL(a.href), 1000);
        showNotices([{ k: 'log.downloaded' }]);
      };
      if (navigator.clipboard?.writeText) {
        void navigator.clipboard.writeText(content).then(
          () => showNotices([{ k: 'log.copied' }]),
          () => download(),
        );
      } else {
        download();
      }
      return;
    }
    case 'settings':
      openSettings((next) => {
        audio.setVolumes(next.sfxVolume, next.musicVolume);
        if (board3d) board3d.quality = next.quality;
      });
      return;
    case 'toggleMusic':
      audio.setMusic(!audio.musicOn);
      return render();
    case 'openTrade': {
      const to = state.players.find((o) => o.id !== state.current && !o.bankrupt)!.id;
      tradeDraft = { to, give: { money: 0, spaces: [] }, get: { money: 0, spaces: [] } };
      error = '';
      return render();
    }
    case 'toggleSays':
      saysOpen = !saysOpen;
      return render();
    case 'say':
      if (!online) return;
      if (online.role === 'host') online.room.say(online.room.hostSeat, target.dataset.say);
      else online.room.say(target.dataset.say ?? '');
      saysOpen = false;
      return render();
    case 'counterTrade': {
      const t = state.trade;
      if (!t) return;
      // si parte dallo scambio ricevuto, girato dal proprio punto di vista
      tradeDraft = { to: t.from, give: { money: t.get.money, spaces: [...t.get.spaces] }, get: { money: t.give.money, spaces: [...t.give.spaces] }, counter: true };
      error = '';
      return render();
    }
    case 'closeTrade':
      tradeDraft = null;
      return render();
    case 'bid':
      return act({ type: 'bid', amount: Number(target.dataset.amount) });
    case 'chooseCard':
      return act({ type: 'chooseCard', option: Number(target.dataset.option) });
    case 'pass':
    case 'acceptTrade':
    case 'rejectTrade':
      return act({ type: action });
    case 'toggleView':
      viewMode = viewMode === '3d' ? '2d' : '3d';
      writePref(KEYS.view, viewMode);
      return render();
    case 'sky':
      skyMode = skyMode === 'cycle' ? 'day' : skyMode === 'day' ? 'night' : 'cycle';
      writePref(KEYS.sky, skyMode);
      if (board3d) board3d.skyMode = skyMode;
      return render();
    case 'speed':
      speed = SPEEDS[(SPEEDS.indexOf(speed) + 1) % SPEEDS.length];
      writePref(KEYS.speed, speed.id);
      if (board3d) board3d.speed = speed.factor;
      return render();
    case 'camera':
      cameraMode = cameraMode === 'follow' ? 'overview' : 'follow';
      if (board3d) board3d.cameraMode = cameraMode;
      return render();
    case 'newGame':
    case 'quit':
      if (action === 'quit' && !confirmTwice(target)) return;
      if (online) return leaveTable();
      bots.cancel();
      session.clear();
      selected = null;
      error = '';
      persist();
      return render();
    case 'exportGame': {
      const file = session.toFile();
      const input = app.querySelector<HTMLInputElement>('#slot-name');
      if (file) downloadSave(input?.value.trim() || input?.placeholder || 'partita', file);
      return;
    }
    case 'coverDebt':
      if (online) {
        // online si mandano una dopo l'altra le stesse mosse che farebbe il computer
        let s = state;
        const steps: Action[] = [];
        for (let i = 0; i < 200 && s.players[s.current].money < 0; i++) {
          const step = raiseMoney(s, ctx);
          if (!step) break;
          s = applyAction(s, step, ctx);
          steps.push(step);
        }
        steps.forEach(act);
        return;
      }
      newsFrom = state.eventCount ?? 0;
      lastActorBot = false;
      session.coverDebt();
      error = '';
      audio.play('coin');
      persist();
      return render();
    case 'undo':
      if (online || !session.undo()) return;
      error = '';
      selected = null;
      persist();
      return render();
    case 'build':
    case 'sell':
    case 'mortgage':
    case 'unmortgage':
      return act({ type: action, spaceId: spaceId! });
    case 'buyShare':
    case 'sellShare':
    case 'sellLandmark':
      return act({ type: action, group: target.dataset.group ?? '' });
    case 'buildLandmark':
      return act({ type: action, group: target.dataset.group ?? '', landmark: (target.dataset.landmark ?? 'fontana') as LandmarkId });
    case 'roll':
    case 'buy':
    case 'decline':
    case 'payJailFine':
    case 'useJailCard':
    case 'endTurn':
      return act({ type: action });
    case 'bankrupt':
      // la bancarotta non si annulla: serve un secondo tocco
      if (!confirmTwice(target)) return;
      return act({ type: action });
  }
});

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

// nella versione per Mac i file sono già sul computer: niente service worker
if (!DESKTOP) setupOffline();
setupDesktopLinks();

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
// link di un tavolo (#tavolo=CODICE): si entra subito
// (nella versione per Mac non c'è il gioco online)
const linkCode = DESKTOP ? null : codeFromHash(location.hash);
const savedTable = DESKTOP ? null : readSession(HOST_TABLE);
if (linkCode) void enterTable('guest', linkCode);
else if (savedTable) {
  // la pagina di chi ha creato il tavolo si è ricaricata: si riapre lo stesso tavolo
  try {
    const { code, snap } = JSON.parse(savedTable) as { code: string; snap: HostSnapshot };
    if (cleanCode(code) && snap?.state) void enterTable('host', code, snap);
  } catch {
    writeSession(HOST_TABLE, null);
  }
}
window.addEventListener('hashchange', () => {
  const code = DESKTOP ? null : codeFromHash(location.hash);
  if (code && code !== online?.code) {
    if (online) leaveTable();
    void enterTable('guest', code);
  }
});

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

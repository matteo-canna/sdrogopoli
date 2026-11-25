// Controller dell'interfaccia: collega i clic alle azioni del motore e ridisegna la pagina.
// Le parti più grandi stanno in moduli separati: schermata iniziale (setup.ts), partita salvata
// e "Annulla" (session.ts), turni del computer (bots.ts), suoni (sounds.ts), preferenze (prefs.ts).
import './style.css';
import { DEFAULT_BOARD, board, cards, currentBoard, setBoard } from '../data';
import { actingPlayer, applyAction, chooseBotAction, createGame, emptyStats, openRound, raiseMoney, RuleError, SEAT_BONUS, type SprintFace, type Action, type Appearance, type GameContext, type GameState, type SaveFile } from '../engine';
import { escapeHtml, money, playerBadge, renderBoardBox, renderEvents, spaceLabel, renderDice, renderPlayers, renderSpaceCard, renderTradeEditor, renderTurnActions, tradeSummaryHtml, type TradeDraft } from './view';
import type { Board3D } from './three/board3d';
import type { CameraMode } from './three/camera';
import type { SkyMode } from './three/city';
import { webglAvailable } from './webgl';
import { load3d } from './lazy3d';
import { runLoading, translateSplash } from './loading';
import { tutorialTip } from './tutorial';
import { addResult, renderSummary } from './summary';
import { achievementTitle, EXTRA_COLORS, newlyUnlocked, titleLabel, updateProfile } from './achievements';
import { characterDef, colorName, playerColor } from './characters';
import { audio } from './audio';
import { KEYS, SKY_LABELS, SPEEDS, loadLeaderboard, loadPreset, loadProgress, loadSky, loadSpeed, loadTutorial, readPref, saveLeaderboard, saveProgress, saveTutorial, writePref, type Speed } from './prefs';
import { GameSession, randomSeed } from './session';
import { BotScheduler } from './bots';
import { soundFor } from './sounds';
import { refreshBoards, renderSetup, setupLooks, SEATS_SHOWN, type SetupChoice } from './setup';
import { decodeBoard, linkCode as linkBoardCode, loadCustomBoards, saveCustomBoard } from './boardStore';
import { setupOffline } from './pwa';
import { reportUrl } from './report';
import { defaultSlotName, deleteSlot, downloadSave, FILE_EXT, listSlots, parseSaveText, saveSlot } from './slots';
import { cleanCode, codeFromHash, openTransport, renderLobby, tableCode, updateLobby, type LobbyView } from './online';
import { HostRoom, type HostSnapshot } from '../net/host';
import { QUICK_SAYS, sayText } from '../net/chat';
import { turnServers } from '../net/turn';
import { GuestRoom } from '../net/guest';
import { announce, moveAnnouncement } from './announce';
import { animateMoney, bigMoments, momentText, moneyChanges, moneyNotices, showMoment, showNotices } from './moments';
import { shareResult } from './share';
import { dailyResult } from './daily';
import { Replay, REPLAY_SPEEDS, type ReplaySpeed } from './replay';
import { t, text, type MsgKey } from '../i18n';
import { applySettings, LANG_EVENT, loadSettings, openSettings } from './settings';

// senza "rng": i dadi vengono dal generatore della partita, che parte da un seme casuale.
// "board" cambia col tabellone scelto, quindi il contesto si aggiorna con useBoard().
const ctx: GameContext = { board, cards };

// Sceglie il tabellone (della partita salvata, di quella nuova o l'ultimo usato).
function useBoard(id: string | undefined | null): void {
  ctx.board = setBoard(id);
}
const app = document.querySelector<HTMLDivElement>('#app')!;

type ViewMode = '3d' | '2d';

const session = new GameSession(ctx);
// impostazioni di comodità (testo, movimento, volumi): valgono da subito
const startSettings = loadSettings();
applySettings(startSettings);
audio.setVolumes(startSettings.sfxVolume, startSettings.musicVolume);
translateSplash();
// i tabelloni fatti con l'editor, poi l'ultimo tabellone usato; una partita salvata ha il suo,
// e session.load() lo sceglie
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
// true mentre la pedina si muove nel 3D: il computer aspetta che finisca
let animating = false;
// eventi da mostrare in evidenza: da quando ha agito l'ultima persona
let newsFrom = session.state?.eventCount ?? 0;
let lastActorBot = false;
// scambio che la persona di turno sta preparando
let tradeDraft: TradeDraft | null = null;
const tutorial = loadTutorial();
// sul telefono il pannello laterale diventa un cassetto che si apre dalla barra in basso
const phoneQuery = window.matchMedia('(max-width: 900px)');
let drawerOpen = false;
phoneQuery.addEventListener('change', () => {
  drawerOpen = false;
  // il 3D va ricostruito: cambia dove stanno i comandi
  destroy3d();
  if (session.state && !resumeOffered) render();
});
// con una partita salvata, all'avvio si sceglie tra "Continua" e "Nuova partita"
let resumeOffered = !!session.state;

// ---------- tavolo online ----------
// Durante una partita online session.state è lo stato mandato da chi ha creato il tavolo:
// niente salvataggio automatico (resta quello della partita sul dispositivo) e niente "Annulla".
type Online = { role: 'host'; room: HostRoom; code: string } | { role: 'guest'; room: GuestRoom; code: string };
let online: Online | null = null;
let lobbyShown = false;
let lobbyStatus = '';
let onlineName = readPref(KEYS.onlineName) ?? '';
let onlineLook: Appearance = setupLooks[0];

// posto di chi usa questo schermo (null: guarda soltanto)
function mySeat(): number | null {
  if (!online) return null;
  return online.role === 'host' ? online.room.hostSeat : online.room.seat;
}

// salva la partita in corso, tranne quelle online
function persist(): void {
  if (!online) session.save();
}

function lobbyView(): LobbyView {
  const o = online!;
  return {
    role: o.role,
    code: o.code,
    meId: o.role === 'host' ? 'oste' : o.room.myId,
    name: onlineName,
    look: onlineLook,
    members: o.room.members,
    computers: o.room.computers,
    connected: o.role === 'host' || o.room.connected,
    ready: o.role === 'guest' && o.room.ready,
    status: lobbyStatus,
  };
}

function showLobby(): void {
  destroy3d();
  if (lobbyShown && app.querySelector('.lobby')) {
    updateLobby(app, lobbyView());
    return;
  }
  lobbyShown = true;
  renderLobby(app, lobbyView(), {
    onProfile: (name, look) => {
      onlineName = name;
      onlineLook = look;
      writePref(KEYS.onlineName, name);
      if (online?.role === 'host') online.room.setHostProfile(name, look);
      else if (online) {
        online.room.name = name;
        online.room.look = look;
        online.room.setReady(online.room.ready);
      }
    },
    onComputers: (n) => online?.role === 'host' && online.room.setComputers(n),
    onReady: (ready) => {
      if (online?.role !== 'guest') return;
      online.room.setReady(ready);
      render();
    },
    onStart: (maxRounds, limitSeconds) => {
      if (online?.role !== 'host') return;
      online.room.setTurnLimit(limitSeconds ? limitSeconds * 1000 : null);
      online.room.start({ maxRounds, seatBonus: SEAT_BONUS }, randomSeed());
    },
    onLeave: leaveTable,
  });
  app.querySelector<HTMLInputElement>('[data-lobby-name]')?.focus();
}

// Stato nuovo arrivato dal tavolo (o calcolato qui, se il tavolo è nostro).
function onTableChange(prev: GameState | null, next: GameState, action: Action | null): void {
  session.state = next;
  // chi ha creato il tavolo tiene una copia nella scheda: ricaricando la pagina il tavolo riprende
  if (online?.role === 'host') {
    const snap = online.room.snapshot();
    if (snap) writeSession(HOST_TABLE, JSON.stringify({ code: online.code, snap }));
  }
  // partita appena iniziata (o appena raggiunta): si lascia la sala d'attesa
  if (lobbyShown) {
    lobbyShown = false;
    selected = null;
    error = '';
    newsFrom = next.eventCount ?? 0;
    lastActorBot = false;
  }
  if (prev && action) {
    const mine = actingPlayer(prev) === mySeat();
    // le mie mosse azzerano le notizie; quelle degli altri si accumulano
    if (mine || !lastActorBot) newsFrom = prev.eventCount ?? 0;
    lastActorBot = !mine;
    if (mine) error = '';
    afterMove(prev, next, action, mine);
  }
  render();
}

const HOST_TABLE = 'sdrogopoli-tavolo-oste';
const GUEST_KEY = 'sdrogopoli-chiave-tavolo';

// sessionStorage: vale solo per questa scheda (due schede sono due giocatori diversi)
function readSession(key: string): string | null {
  try {
    return sessionStorage.getItem(key);
  } catch {
    return null;
  }
}
function writeSession(key: string, value: string | null): void {
  try {
    if (value === null) sessionStorage.removeItem(key);
    else sessionStorage.setItem(key, value);
  } catch {
    /* senza memoria della scheda: ricaricando si perde il posto */
  }
}

// chiave di questa scheda per riprendere il posto al tavolo dopo una ricarica
function guestKey(): string {
  let key = readSession(GUEST_KEY);
  if (!key) {
    key = Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2);
    writeSession(GUEST_KEY, key);
  }
  return key;
}

// Testo per chi sta giocando quando non è il mio turno: scollegato o fuori tempo.
function seatNote(seat: number): string {
  if (!online) return '';
  const offline = online.role === 'host' ? online.room.offlineSeats() : online.room.offline;
  const away = online.role === 'host' ? [...online.room.away] : online.room.away;
  if (offline.includes(seat)) return ` · 📴 ${t('online.seatOffline')}`;
  if (away.includes(seat)) return ` · 🤖 ${t('online.seatAway')}`;
  return '';
}

// Reazioni e frasi pronte: pulsanti sotto quelli del turno e fumetti in alto, per tutti al tavolo.
let saysOpen = false;
function saysHtml(): string {
  if (!online || mySeat() === null) return '';
  return `<div class="quick-says">
    <button class="says-toggle" data-action="toggleSays" aria-expanded="${saysOpen}">💬 ${t('says.toggle')}</button>
    ${saysOpen ? `<div class="says-list">${QUICK_SAYS.map((q) => `<button data-action="say" data-say="${q.id}">${escapeHtml(sayText(q.id) ?? '')}</button>`).join('')}</div>` : ''}
  </div>`;
}

function showSaid(seat: number, id: string): void {
  const s = session.state;
  const text = sayText(id);
  if (!s || !text || !s.players[seat]) return;
  let box = document.querySelector<HTMLElement>('#says');
  if (!box) {
    box = document.createElement('div');
    box.id = 'says';
    box.setAttribute('aria-live', 'polite');
    document.body.append(box);
  }
  const p = s.players[seat];
  const el = document.createElement('div');
  el.className = 'said';
  el.style.setProperty('--c', playerColor(p));
  el.innerHTML = `${playerBadge(s, seat, 'token')} <strong>${escapeHtml(p.name)}</strong> <span>${escapeHtml(text)}</span>`;
  box.append(el);
  // al massimo quattro fumetti insieme
  while (box.children.length > 4) box.firstElementChild!.remove();
  setTimeout(() => el.remove(), 4000);
}

function iAmAway(): boolean {
  const seat = mySeat();
  if (!online || seat === null) return false;
  return online.role === 'host' ? online.room.away.has(seat) : online.room.away.includes(seat);
}

function timeLeft(): number | null {
  return online ? online.room.timeLeft() : null;
}

function clockText(ms: number): string {
  const sec = Math.ceil(ms / 1000);
  return sec >= 60 ? `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}` : `${sec} s`;
}

// Ogni secondo: conto alla rovescia e, per chi ha creato il tavolo, controllo del tempo scaduto.
setInterval(() => {
  if (!online || !session.state) return;
  if (online.role === 'host' && online.room.checkTimer()) return;
  const clock = app.querySelectorAll<HTMLElement>('[data-clock]');
  const left = timeLeft();
  clock.forEach((el) => {
    el.hidden = left === null;
    if (left === null) return;
    el.textContent = `⏱ ${clockText(left)}`;
    el.classList.toggle('late', left <= 10_000);
  });
}, 1000);

async function enterTable(role: 'host' | 'guest', code: string, restore?: HostSnapshot): Promise<void> {
  bots.cancel();
  destroy3d();
  // online si gioca sempre sul tabellone predefinito: così oste e ospiti vedono le stesse caselle
  useBoard(DEFAULT_BOARD);
  // la partita su questo dispositivo resta salvata: si riprende uscendo dal tavolo
  session.clear();
  resumeOffered = false;
  lobbyStatus = '';
  lobbyShown = false;
  selected = null;
  tradeDraft = null;
  error = '';
  const name = onlineName || (role === 'host' ? t('online.hostName') : t('online.guestName'));
  let transport;
  try {
    transport = await openTransport(code);
  } catch {
    lobbyStatus = t('online.cannotOpen');
    online = null;
    session.load();
    resumeOffered = !!session.state;
    render();
    return;
  }
  if (role === 'host') {
    const room = new HostRoom(transport, ctx, name, onlineLook);
    online = { role, room, code };
    room.onLobby = () => render();
    room.onChange = onTableChange;
    room.onSaid = showSaid;
    if (restore) {
      room.restore(restore);
      return;
    }
  } else {
    const room = new GuestRoom(transport, name, onlineLook, guestKey());
    online = { role, room, code };
    room.onLobby = () => render();
    room.onChange = onTableChange;
    room.onError = (reason) => {
      if (room.closed) lobbyStatus = room.closed;
      if (session.state) error = reason;
      else lobbyStatus = reason;
      audio.play('error');
      render();
    };
    room.onHostLeft = () => {
      // può tornare ricaricando la pagina: si resta al tavolo ad aspettare
      const msg = room.closed || t('online.hostLeft');
      lobbyStatus = msg;
      error = msg;
      render();
    };
    room.onHostBack = () => {
      lobbyStatus = '';
      error = '';
      render();
    };
    room.onPresence = () => render();
    room.onSaid = showSaid;
    // se dopo un po' nessuno risponde, lo si dice
    setTimeout(() => {
      if (online?.room === room && !room.connected && !room.closed) {
        lobbyStatus = t('online.noAnswer') + (turnServers(import.meta.env).length ? '' : ` ${t('online.sameWifi')}`);
        render();
      }
    }, 15000);
    history.replaceState(null, '', `#tavolo=${code}`);
  }
  render();
}

function leaveTable(): void {
  if (!online) return;
  bots.cancel();
  if (online.role === 'host') online.room.close();
  else online.room.leave();
  online = null;
  writeSession(HOST_TABLE, null);
  lobbyShown = false;
  lobbyStatus = '';
  error = '';
  selected = null;
  tradeDraft = null;
  destroy3d();
  history.replaceState(null, '', location.pathname + location.search);
  session.clear();
  session.load();
  resumeOffered = !!session.state;
  newsFrom = session.state?.eventCount ?? 0;
  render();
}

window.addEventListener('pagehide', () => {
  if (online?.role === 'host') online.room.close();
  else online?.room.leave();
});

const bots = new BotScheduler(
  () => !animating && botToPlay(),
  // con la velocità istantanea il computer gioca senza pause
  () => (session.state!.phase === 'roll' ? 900 : 650) / speed.factor,
  () => {
    // online il computer muove tramite il tavolo (anche per chi è scollegato o fuori tempo)
    if (online?.role === 'host') online.room.stepComputer();
    else act(chooseBotAction(session.state!, ctx));
  },
);

function botToPlay(): boolean {
  const s = session.state;
  if (!s || s.phase === 'gameOver') return false;
  // online il computer lo muove solo chi ha creato il tavolo, anche per chi si è scollegato
  if (online) return online.role === 'host' && online.room.isComputerSeat(actingPlayer(s));
  return !!s.players[actingPlayer(s)].isBot;
}

// Online, tocca a chi sta su questo schermo?
function myTurn(s: GameState): boolean {
  return !online || actingPlayer(s) === mySeat();
}

// ---------- schermata iniziale ----------

function showSetup(): void {
  destroy3d();
  const s = session.state;
  const resume = s && resumeOffered
    ? {
        summary: resumeSummary(s),
        onContinue: () => {
          resumeOffered = false;
          render();
        },
      }
    : undefined;
  renderSetup(app, tutorial.on, startGame, resume, {
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
  }, {
    onCreate: () => void enterTable('host', tableCode()),
    onJoin: (raw) => {
      const code = cleanCode(raw);
      if (code) void enterTable('guest', code);
      return !!code;
    },
  });
}

// Apre una partita salvata con un nome o importata: prende il posto di quella in corso.
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

function startGame(choice: SetupChoice): void {
  resumeOffered = false;
  // la partita del giorno parte dal seme del giorno: stessi dadi e stesse carte per tutti
  dailyDay = choice.daily ?? null;
  useBoard(choice.boardId);
  writePref(KEYS.board, currentBoard());
  session.start(openRound(createGame(choice.players, ctx, choice.rules, choice.seed ?? randomSeed()), ctx));
  // riattivando i consigli si ricomincia da capo
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
    ${s.phase === 'gameOver' ? renderSummary(s, ctx, { titles: myTitles(s), unlocked: newGoals, canReplay: !!session.toFile() }) : viewMode === '3d' ? renderEvents(s) : ''}
    ${news.length ? `<div class="news"><h4>${t('news.title')}</h4><ul>${news.map((l) => `<li>${escapeHtml(text(l))}</li>`).join('')}</ul></div>` : ''}
    ${selected ? '' : `<p class="hint">${t('hint.tapSpace')}</p>`}
    <details class="log-box"><summary>${t('log.title')}</summary>
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
  if (online && !s) return showLobby();
  if (!s || resumeOffered) return showSetup();
  const focus = focusKey();
  if (viewMode === '3d') render3d(s);
  else {
    animating = false;
    render2d(s);
  }
  restoreFocus(focus);
  bots.schedule();
}

// ---------- tastiera (B43): il focus non si perde quando la pagina si ridisegna ----------

// Ultimo modo usato per giocare: con la tastiera il focus segue il pulsante principale.
let usingKeyboard = false;
document.addEventListener('keydown', (e) => {
  if (['Tab', 'Enter', ' ', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End', 'Escape'].includes(e.key)) usingKeyboard = true;
}, true);
document.addEventListener('pointerdown', () => (usingKeyboard = false), true);

const FOCUS_ATTRS = ['data-action', 'data-space', 'data-option', 'data-amount', 'data-say', 'data-tip', 'name', 'id'];

// Un selettore che ritrova "lo stesso" elemento dopo il ridisegno.
function focusKey(): string | null {
  const el = document.activeElement;
  if (!el || el === document.body || !app.contains(el)) return usingKeyboard && el === document.body ? '' : null;
  const parts = FOCUS_ATTRS.filter((a) => el.hasAttribute(a)).map((a) => `[${a}="${CSS.escape(el.getAttribute(a)!)}"]`);
  if (el.matches('.board3d')) return '.board3d';
  return parts.length ? el.tagName.toLowerCase() + parts.join('') : '';
}

function visible(el: Element): el is HTMLElement {
  return el instanceof HTMLElement && el.getClientRects().length > 0 && !(el as HTMLButtonElement).disabled;
}

// key null: il focus era fuori dalla partita e non si tocca. Altrimenti si torna allo stesso elemento
// o, se è sparito (un pulsante del turno appena usato), al pulsante principale del turno.
function restoreFocus(key: string | null): void {
  if (key === null || !usingKeyboard && key === '') return;
  if (document.activeElement && document.activeElement !== document.body && app.contains(document.activeElement)) return;
  const same = key ? [...app.querySelectorAll(key)].find(visible) : undefined;
  const next = same
    ?? [...app.querySelectorAll('.actions .primary, .actions button, .trade-editor input, .trade-editor button')].find(visible);
  // se non c'è niente da usare (gioca il computer) il focus resta sulla pagina e torna al primo pulsante che compare
  next?.focus({ preventScroll: true });
}

// Frecce sul tabellone: nel 2D si sposta il focus tra le caselle, nel 3D si sceglie la casella.
function moveOnBoard(from: number, key: string): number | null {
  const n = board.spaces.length;
  if (key === 'ArrowRight' || key === 'ArrowDown') return (from + 1) % n;
  if (key === 'ArrowLeft' || key === 'ArrowUp') return (from - 1 + n) % n;
  if (key === 'Home') return 0;
  if (key === 'End') return n - 1;
  return null;
}

app.addEventListener('keydown', (e) => {
  const s = session.state;
  const el = e.target as HTMLElement;
  if (!s || e.altKey || e.ctrlKey || e.metaKey) return;
  const space = el.closest<HTMLElement>('.board [data-space]');
  if (space) {
    const i = moveOnBoard(board.spaces.findIndex((sp) => sp.id === space.dataset.space), e.key);
    if (i === null) return;
    e.preventDefault();
    const nextBtn = app.querySelector<HTMLElement>(`.board [data-space="${board.spaces[i].id}"]`);
    if (!nextBtn) return;
    space.tabIndex = -1;
    nextBtn.tabIndex = 0;
    nextBtn.focus();
    return;
  }
  if (el.matches('.board3d')) {
    // + e − per avvicinarsi, Maiusc con le frecce per girare, 0 per tornare alla vista proposta
    const view = { '+': () => board3d?.zoomBy(0.85), '=': () => board3d?.zoomBy(0.85), '-': () => board3d?.zoomBy(1 / 0.85), '0': () => board3d?.resetView() }[e.key];
    const turn = e.shiftKey && (e.key === 'ArrowLeft' || e.key === 'ArrowRight');
    if (view || turn) {
      e.preventDefault();
      if (view) view();
      else board3d?.rotateBy(e.key === 'ArrowLeft' ? 0.26 : -0.26);
      return;
    }
    const from = selected ? board.spaces.findIndex((sp) => sp.id === selected) : s.players[s.current].position;
    const i = moveOnBoard(from, e.key);
    if (i === null) return;
    e.preventDefault();
    selectSpace(board.spaces[i].id);
  }
});

// Seleziona una casella (o la deseleziona) e la descrive a voce.
function selectSpace(spaceId: string | null): void {
  selected = selected === spaceId ? null : spaceId;
  error = '';
  if (selected && session.state) announce(`${spaceLabel(session.state, board.spaces.findIndex((sp) => sp.id === selected))}. ${t('announce.cardOpen')}`);
  render();
}

function undoButton(): string {
  if (online || !session.canUndo) return '';
  return `<button class="undo" data-action="undo" title="${t('undo.title')}">↩ ${t('btn.cancel')}</button>`;
}

// Struttura della partita, uguale nel 2D e nel 3D: tabellone, pannello laterale e,
// sul telefono, barra delle azioni in basso con il pannello laterale come cassetto.
function gameShell(stage: string, mode: ViewMode): string {
  return `
    <div class="game game${mode} ${drawerOpen ? 'drawer-open' : ''}">
      <div class="stage">
        ${stage}
        <div class="view-buttons overlay"></div>
        <div class="card-slot"></div>
      </div>
      <aside class="side" aria-label="${t('side.label')}">
        <button class="drawer-close" data-action="drawer">✕ ${t('btn.close')}</button>
        <div class="view-buttons in-drawer"></div>
        <div class="hud"></div>
        <div class="players-list"></div>
        ${online ? `<p class="saved">🌐 ${t('online.savedNote', { code: `<strong>${online.code}</strong>` })}</p>` : `<p class="saved">💾 ${t('save.auto')}</p>
        <details class="slots-box">
          <summary>${t('save.copyOrExport')}</summary>
          <form class="slot-form" data-slot-form>
            <label for="slot-name">${t('save.name')}</label>
            <div class="slot-row">
              <input id="slot-name" name="slotName" maxlength="60" placeholder="${escapeHtml(defaultSlotName())}" autocomplete="off">
              <button type="submit">${t('save.copy')}</button>
            </div>
          </form>
          <button data-action="exportGame">⬇️ ${t('save.export', { ext: FILE_EXT })}</button>
          <p class="slot-msg" role="status" aria-live="polite"></p>
        </details>`}
        <button class="link" data-action="quit">${online ? t('online.leave') : t('game.quit')}</button>
        <a class="report-link" data-report href="#" target="_blank" rel="noopener">🐞 ${t('report.link')}</a>
      </aside>
      <div class="action-bar"></div>
    </div>`;
}

// Riempie i pannelli: sul telefono i comandi vanno nella barra in basso, altrove in cima al pannello laterale.
function fillPanels(s: GameState): void {
  const phone = phoneQuery.matches;
  const game = app.querySelector<HTMLElement>('.game')!;
  game.classList.toggle('drawer-open', phone && drawerOpen);
  game.classList.toggle('busy', animating);
  app.querySelector('.hud')!.innerHTML = phone ? infoHtml(s) : turnHtml(s) + controlsHtml(s) + infoHtml(s);
  app.querySelector('.action-bar')!.innerHTML = phone
    ? `<div class="bar-head">${turnHtml(s)}<button class="drawer-btn" data-action="drawer" aria-expanded="${drawerOpen}">👥 ${t('side.players')}</button></div>${controlsHtml(s)}`
    : '';
  app.querySelector('.players-list')!.innerHTML = renderPlayers(s);
  // sul telefono, nel 2D, i comandi della vista stanno nel cassetto
  const toolsInDrawer = phone && viewMode === '2d';
  app.querySelector('.view-buttons.overlay')!.innerHTML = toolsInDrawer ? '' : viewButtons();
  app.querySelector('.view-buttons.in-drawer')!.innerHTML = toolsInDrawer ? viewButtons() : '';
  app.querySelector('.card-slot')!.innerHTML = selected ? renderSpaceCard(s, selected) : '';
}

function render2d(s: GameState): void {
  destroy3d();
  app.innerHTML = gameShell(
    renderBoardBox(s, selected),
    '2d',
  );
  fillPanels(s);
}

let loading3d = false;
function render3d(s: GameState): void {
  // la scena 3D si crea una sola volta: ridisegniamo solo i pannelli HTML
  if (!board3d) {
    if (!app.querySelector('.game3d .board3d')) app.innerHTML = gameShell(`<div class="board3d" tabindex="0" role="region" aria-label="${t('board3d.label')}"><p class="loading-3d">${t('board3d.loading')}</p></div>`, '3d');
    fillPanels(s);
    if (loading3d) return;
    loading3d = true;
    // three.js si scarica solo la prima volta che serve
    load3d()
      .then(({ Board3D }) => {
        loading3d = false;
        if (!session.state || viewMode !== '3d' || board3d) return;
        create3d(Board3D);
        render();
      })
      .catch(() => {
        // senza rete e senza copia salvata del 3D: si gioca in 2D
        loading3d = false;
        viewMode = '2d';
        render();
      });
    return;
  }
  fillPanels(s);
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
      // grafica 3D persa: si ricrea la scena con lo stato attuale (la partita non si ferma)
      destroy3d();
      setTimeout(() => {
        if (session.state && viewMode === '3d' && !board3d) render();
      }, 300);
    },
  );
  board3d.quality = loadSettings().quality;
  board3d.onQualityChange = (level, lowered) => {
    // "automatica" è scesa da sola: lo si dice una volta, dove compaiono gli avvisi
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
  if (online) {
    // quando tocca a un altro non si manda niente (il computer lo muove solo chi ha creato il tavolo)
    if (!myTurn(before) && !botToPlay()) return;
    // online la mossa la controlla e la applica chi ha creato il tavolo; lo stato nuovo arriva in onTableChange
    if (online.role === 'guest') online.room.send(action);
    else {
      const reason = online.room.act(action);
      if (reason) {
        error = t(reason.k, reason.p);
        audio.play('error');
        render();
      }
    }
    return;
  }
  const actorBot = !!before.players[actingPlayer(before)].isBot;
  // le azioni di una persona azzerano le notizie; quelle del computer si accumulano
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

// Il posto di chi gioca su questo dispositivo, se c'è una sola persona al tavolo.
function soleHuman(s: GameState): number | null {
  const people = s.players.filter((p) => !p.isBot);
  return people.length === 1 ? people[0].id : null;
}

// giorno della partita del giorno in corso (null se è una partita normale)
let dailyDay: string | null = null;

// I posti giocati da una persona su questo dispositivo (online è solo il proprio).
function mySeats(s: GameState): number[] {
  if (online) {
    const seat = mySeat();
    return seat === null ? [] : [seat];
  }
  return s.players.filter((p) => !p.isBot).map((p) => p.id);
}

// Traguardi appena raggiunti (si mostrano nel riepilogo) e profilo aggiornato.
let newGoals: { icon: string; title: string; prize: string }[] = [];
function checkGoals(state: GameState): void {
  newGoals = [];
  const presetId = loadPreset();
  for (const seat of mySeats(state)) {
    const progress = loadProgress();
    const base = { state, ctx, seat, stats: state.stats?.[seat] ?? emptyStats(), online: !!online };
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

// Il titolo scelto, accanto al proprio nome nel riepilogo.
function myTitles(s: GameState): Record<number, string> {
  const title = loadProgress().title;
  if (!title) return {};
  return Object.fromEntries(mySeats(s).map((seat) => [seat, titleLabel(title)]));
}


// ---------- rivedi la partita ----------

let replay: Replay | null = null;

// Finestra con il tabellone 2D che rigioca la partita dal primo lancio.
function openReplay(): void {
  const file = session.toFile();
  if (!file) return;
  document.querySelector('.replay-dialog')?.remove();
  const dialog = document.createElement('dialog');
  dialog.className = 'replay-dialog';
  dialog.setAttribute('aria-label', t('replay.title'));
  dialog.innerHTML = `
    <div class="replay-board"></div>
    <div class="replay-bar">
      <button type="button" data-replay="back" aria-label="${t('replay.back')}">⏪</button>
      <button type="button" class="primary" data-replay="toggle">⏸ ${t('replay.pause')}</button>
      <button type="button" data-replay="forward" aria-label="${t('replay.forward')}">⏩</button>
      <input type="range" min="0" max="1000" value="0" data-replay="seek" aria-label="${t('replay.title')}">
      <span class="replay-step" data-replay="step"></span>
      <label class="replay-speed">${t('replay.speed')}
        <select data-replay="speed">${REPLAY_SPEEDS.map((v) => `<option value="${v}" ${v === 2 ? 'selected' : ''}>${v}×</option>`).join('')}</select>
      </label>
      <button type="button" data-replay="close">${t('replay.close')}</button>
    </div>`;
  document.body.append(dialog);
  const boardBox = dialog.querySelector<HTMLElement>('.replay-board')!;
  const seek = dialog.querySelector<HTMLInputElement>('[data-replay=seek]')!;
  const toggle = dialog.querySelector<HTMLButtonElement>('[data-replay=toggle]')!;
  const stepLabel = dialog.querySelector<HTMLElement>('[data-replay=step]')!;
  const draw = (v: { state: GameState; progress: number; done: boolean }) => {
    boardBox.innerHTML = renderBoardBox(v.state, null);
    seek.value = String(Math.round(v.progress * 1000));
    stepLabel.textContent = t('replay.step', { n: Math.round(v.progress * (replay!.length - 1)) + 1, all: replay!.length });
    toggle.textContent = replay!.playing ? `⏸ ${t('replay.pause')}` : `▶ ${t('replay.play')}`;
  };
  replay = Replay.from(file, ctx, (v) => draw(v));
  draw(replay.view());
  dialog.addEventListener('click', (e) => {
    const what = (e.target as HTMLElement).closest<HTMLElement>('[data-replay]')?.dataset.replay;
    if (!replay) return;
    if (what === 'toggle') replay.playing ? replay.pause() : replay.play();
    else if (what === 'back') replay.step(-1);
    else if (what === 'forward') replay.step(1);
    else if (what === 'close') dialog.close();
    else return;
    draw(replay.view());
  });
  dialog.addEventListener('input', (e) => {
    const el = e.target as HTMLInputElement;
    if (!replay) return;
    if (el.dataset.replay === 'seek') replay.seek(Number(el.value) / 1000);
    if (el.dataset.replay === 'speed') replay.speed = Number(el.value) as ReplaySpeed;
  });
  dialog.addEventListener('close', () => {
    replay?.stop();
    replay = null;
    dialog.remove();
  });
  dialog.showModal();
  replay.play();
  draw(replay.view());
}

// Suoni, dadi, classifica e carta della casella dopo una mossa (fatta qui o arrivata dal tavolo).
function afterMove(prev: GameState, state: GameState, action: Action, mine: boolean): void {
  announce(...moveAnnouncement(prev, state, online ? mySeat() : soleHuman(state)));
  // soldi, avvisi e momenti forti si mostrano subito dopo il disegno della pagina
  const changes = moneyChanges(prev, state);
  const notices = moneyNotices(prev, state);
  const moments = bigMoments(prev, state, ctx);
  // la bancarotta è già nel registro; quartieri e palazzi si dicono a parte
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
  // partita appena finita: il risultato entra nella classifica tra amici
  if (prev.phase !== 'gameOver' && state.phase === 'gameOver') {
    saveLeaderboard(addResult(loadLeaderboard(), state, ctx));
    checkGoals(state);
    // partita del giorno: si ricorda come è andata, per confrontarla con gli amici
    const seat = mySeats(state)[0];
    if (dailyDay !== null && seat !== undefined) writePref(KEYS.daily, JSON.stringify(dailyResult(state, ctx, seat, dailyDay)));
  }
  const sfx = soundFor(prev, state, action);
  // il suono del lancio c'è già: dopo un attimo quello del risultato
  if (sfx && sfx !== 'dice') setTimeout(() => audio.play(sfx), action.type === 'roll' ? 450 / speed.factor : 0);
  // dopo il lancio, se la casella di arrivo si può comprare, compare la sua carta
  if (action.type === 'roll' && (mine || !online)) selected = state.phase === 'buy' ? board.spaces[state.players[state.current].position]?.id ?? null : null;
  if (action.type === 'buy' || action.type === 'decline') selected = null;
  if (action.type === 'endTurn' || action.type === 'bankrupt') {
    selected = null;
    tradeDraft = null;
  }
}

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

// Modifiche al modulo dello scambio.
app.addEventListener('change', (e) => {
  const el = e.target as HTMLInputElement | HTMLSelectElement;
  const field = el.dataset.trade;
  if (!field || !tradeDraft || !session.state) return;
  if (field === 'to') {
    tradeDraft = { to: Number(el.value), give: tradeDraft.give, get: { money: 0, spaces: [] } };
    return render();
  }
  if (field === 'give-money' || field === 'get-money') {
    const side = field === 'give-money' ? tradeDraft.give : tradeDraft.get;
    side.money = Math.max(0, Math.floor(Number(el.value) || 0));
    return;
  }
  const side = field === 'give-space' ? tradeDraft.give : tradeDraft.get;
  const id = el.value;
  side.spaces = (el as HTMLInputElement).checked ? [...side.spaces, id] : side.spaces.filter((x) => x !== id);
  refreshTradeSummary();
});

app.addEventListener('submit', (e) => {
  const slotForm = (e.target as HTMLElement).closest<HTMLFormElement>('[data-slot-form]');
  if (slotForm) {
    e.preventDefault();
    const file = session.toFile();
    if (!file) return;
    const input = slotForm.querySelector<HTMLInputElement>('input')!;
    const result = saveSlot(input.value, file);
    const msg = app.querySelector('.slot-msg')!;
    msg.textContent = result.ok ? `✅ ${t('save.done', { name: input.value.trim() || input.placeholder })}` : result.reason;
    if (result.ok) {
      input.value = '';
      input.placeholder = defaultSlotName();
    }
    return;
  }
  if ((e.target as HTMLElement).id !== 'trade-form' || !tradeDraft) return;
  e.preventDefault();
  // legge anche i campi soldi non ancora confermati
  const form = e.target as HTMLFormElement;
  for (const input of form.querySelectorAll<HTMLInputElement>('input[type=number]')) {
    const side = input.dataset.trade === 'give-money' ? tradeDraft.give : tradeDraft.get;
    side.money = Math.max(0, Math.floor(Number(input.value) || 0));
  }
  const draft = tradeDraft;
  if (draft.counter) act({ type: 'counterTrade', offer: { give: draft.give, get: draft.get } });
  else act({ type: 'proposeTrade', offer: { to: draft.to, give: draft.give, get: draft.get } });
  if (!error) tradeDraft = null;
  render();
});

// Aggiorna "chi completa quale quartiere" mentre si prepara lo scambio, senza ridisegnare il modulo.
function refreshTradeSummary(): void {
  const s = session.state;
  if (!s || !tradeDraft) return;
  const me = tradeDraft.counter && s.trade ? s.trade.to : s.current;
  const html = tradeSummaryHtml(s, { from: me, to: tradeDraft.to, give: tradeDraft.give, get: tradeDraft.get });
  app.querySelectorAll('[data-trade-summary]').forEach((el) => (el.innerHTML = html));
}

// Azioni che non si annullano: il primo tocco chiede conferma, il secondo esegue.
function confirmTwice(button: HTMLElement): boolean {
  if (button.dataset.confirm === 'yes') return true;
  button.dataset.confirm = 'yes';
  button.textContent = t('confirm.again');
  return false;
}

// Esc chiude la carta della casella o il cassetto.
document.addEventListener('keydown', (e) => {
  if (e.key !== 'Escape' || !session.state || resumeOffered || (online && lobbyShown)) return;
  if (selected) selected = null;
  else if (drawerOpen) drawerOpen = false;
  else return;
  render();
});

setupOffline();

// lingua cambiata nelle impostazioni: si ridisegna tutto (il 3D rifà le scritte delle caselle)
window.addEventListener(LANG_EVENT, () => {
  if (board3d) destroy3d();
  render();
});

// link di un tabellone (#tabellone=…): si aggiunge ai propri e si sceglie per la prossima partita
const boardLink = linkBoardCode(location.hash);
if (boardLink) {
  history.replaceState(null, '', location.pathname + location.search);
  void decodeBoard(boardLink).then((result) => {
    if (!result.ok) return showNotices([{ k: 'editor.linkBad' }], 1.5);
    const id = saveCustomBoard(result.data);
    writePref(KEYS.board, id);
    // una partita salvata resta sul suo tabellone: quello nuovo è scelto per la prossima
    if (!session.state) useBoard(id);
    refreshBoards(id);
    showNotices([{ k: 'editor.fromLink', p: { name: result.data.title ?? '' } }], 1.5);
  });
}

// link di un tavolo (#tavolo=CODICE): si entra subito
const linkCode = codeFromHash(location.hash);
const savedTable = readSession(HOST_TABLE);
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
  const code = codeFromHash(location.hash);
  if (code && code !== online?.code) {
    if (online) leaveTable();
    void enterTable('guest', code);
  }
});

// Prima partenza: si disegna la pagina sotto la schermata di caricamento, poi si caricano
// in anticipo i personaggi 3D che serviranno (quelli della partita salvata o della schermata iniziale).
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

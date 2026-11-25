// Controller dell'interfaccia: collega i clic alle azioni del motore e ridisegna la pagina.
// Le parti più grandi stanno in moduli separati: schermata iniziale (setup.ts), partita salvata
// e "Annulla" (session.ts), turni del computer (bots.ts), suoni (sounds.ts), preferenze (prefs.ts).
import './style.css';
import { board, cards } from '../data';
import { actingPlayer, chooseBotAction, createGame, RuleError, type Action, type GameContext, type GameState } from '../engine';
import { escapeHtml, playerBadge, renderBoard, renderDice, renderPlayers, renderSpaceCard, renderTable, renderTradeEditor, renderTurnActions, type TradeDraft } from './view';
import type { Board3D } from './three/board3d';
import type { CameraMode } from './three/camera';
import type { SkyMode } from './three/city';
import { webglAvailable } from './webgl';
import { load3d } from './lazy3d';
import { runLoading } from './loading';
import { tutorialTip } from './tutorial';
import { addResult, renderSummary } from './summary';
import { characterDef, playerColor } from './characters';
import { audio } from './audio';
import { KEYS, SKY_LABELS, SPEEDS, loadLeaderboard, loadSky, loadSpeed, loadTutorial, readPref, saveLeaderboard, saveTutorial, writePref, type Speed } from './prefs';
import { GameSession, randomSeed } from './session';
import { BotScheduler } from './bots';
import { soundFor } from './sounds';
import { renderSetup, setupLooks, SEATS_SHOWN, type SetupChoice } from './setup';
import { setupOffline } from './pwa';
import { reportUrl } from './report';

// senza "rng": i dadi vengono dal generatore della partita, che parte da un seme casuale
const ctx: GameContext = { board, cards };
const app = document.querySelector<HTMLDivElement>('#app')!;

type ViewMode = '3d' | '2d';

const session = new GameSession(ctx);
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

const bots = new BotScheduler(
  () => !animating && botToPlay(),
  // con la velocità istantanea il computer gioca senza pause
  () => (session.state!.phase === 'roll' ? 900 : 650) / speed.factor,
  () => act(chooseBotAction(session.state!, ctx)),
);

function botToPlay(): boolean {
  const s = session.state;
  return !!s && s.phase !== 'gameOver' && !!s.players[actingPlayer(s)].isBot;
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
  renderSetup(app, tutorial.on, startGame, resume);
}

// Due righe sulla partita salvata: chi gioca, a che punto è e chi è in testa.
function resumeSummary(s: GameState): string {
  const alive = s.players.filter((p) => !p.bankrupt);
  const who = s.players.map((p) => `${playerBadge(s, p.id, 'token')} ${escapeHtml(p.name)}`).join(' ');
  const turn = s.phase === 'gameOver' ? 'Partita finita' : `Giro ${s.round}${s.rules?.maxRounds ? ` di ${s.rules.maxRounds}` : ''} · tocca a ${escapeHtml(s.players[actingPlayer(s)].name)}`;
  return `<p class="resume-players">${who}</p><p class="resume-meta">${turn} · ${alive.length} in gioco</p>`;
}

function startGame(choice: SetupChoice): void {
  resumeOffered = false;
  session.start(createGame(choice.players, ctx, choice.rules, randomSeed()));
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
        <button data-action="tipOk" data-tip="${tip.id}">Ho capito</button>
        <button class="link" data-action="tipOff">Basta consigli</button>
      </div>
    </div>`;
}

// Riga del turno: chi gioca, giro, montepremi e ultimo lancio.
function turnHtml(s: GameState): string {
  const id = s.phase === 'gameOver' && s.winner !== null ? s.winner : actingPlayer(s);
  const p = s.players[id];
  const total = s.lastRoll ? s.lastRoll[0] + s.lastRoll[1] : 0;
  return `
    <div class="turn" style="--c:${playerColor(p)}">
      ${playerBadge(s, id)}
      <span>${s.phase === 'gameOver' ? '<strong>Partita finita</strong>' : `Tocca a <strong>${p.isBot ? '🤖 ' : ''}${escapeHtml(p.name)}</strong>`}</span>
      ${s.rules?.demo ? `<span class="pill demo" title="Modalità demo sperimentale">🧪 Demo</span>` : ''}
      ${s.rules?.maxRounds ? `<span class="pill">Giro ${s.round} di ${s.rules.maxRounds}</span>` : ''}
      ${s.rules?.parkPot ? `<span class="pill" title="Montepremi della Panchina del Parco">🪑 ${board.currency.symbol} ${s.pot}</span>` : ''}
      ${s.lastRoll ? `<span class="roll">${renderDice(s)}<span class="roll-total">${total}</span></span>` : ''}
    </div>`;
}

// Pulsanti del turno (o modulo dello scambio), consiglio ed errore: la parte da tenere sempre a portata di dito.
function controlsHtml(s: GameState): string {
  return `
    ${tradeDraft ? renderTradeEditor(s, tradeDraft) : `<div class="actions">${renderTurnActions(s)}${undoButton()}</div>`}
    ${error ? `<p class="error" role="alert">${escapeHtml(error)}</p>` : ''}
    ${tipHtml(s)}`;
}

// Notizie, fine partita e registro: si leggono con calma.
function infoHtml(s: GameState): string {
  const fresh = Math.min(Math.max((s.eventCount ?? 0) - newsFrom, 0), s.log.length, 8);
  const news = fresh ? s.log.slice(-fresh) : [];
  return `
    ${s.phase === 'gameOver' ? renderSummary(s, ctx) : ''}
    ${news.length ? `<div class="news" aria-live="polite"><h4>Cosa è successo</h4><ul>${news.map((l) => `<li>${escapeHtml(l)}</li>`).join('')}</ul></div>` : ''}
    ${selected ? '' : '<p class="hint">Tocca una casella per vedere i dettagli.</p>'}
    <details class="log-box"><summary>Registro della partita</summary>
      <ol class="log">${s.log.slice().reverse().map((l) => `<li>${escapeHtml(l)}</li>`).join('')}</ol>
    </details>`;
}

function soundButtons(): string {
  return `<button data-action="toggleSfx" aria-pressed="${audio.sfxOn}" aria-label="Effetti sonori" title="Effetti sonori">${audio.sfxOn ? '🔊' : '🔇'}<span class="lbl"> Effetti</span></button>
    <button data-action="toggleMusic" aria-pressed="${audio.musicOn}" aria-label="Musica" title="Musica">${audio.musicOn ? '🎵' : '🚫'}<span class="lbl"> Musica</span></button>`;
}

function viewButtons(): string {
  const cam = viewMode === '3d'
    ? `<button data-action="camera" aria-label="${cameraMode === 'follow' ? 'Vista d\'insieme' : 'Segui la pedina'}">${cameraMode === 'follow' ? '🗺️<span class="lbl"> Vista d\'insieme</span>' : '🎥<span class="lbl"> Segui la pedina</span>'}</button>`
    : '';
  const toggle = webglAvailable()
    ? `<button data-action="toggleView" aria-label="${viewMode === '3d' ? 'Vista 2D' : 'Vista 3D'}">${viewMode === '3d' ? '🔲<span class="lbl"> Vista 2D</span>' : '🧊<span class="lbl"> Vista 3D</span>'}</button>`
    : '';
  const [icon, label] = SKY_LABELS[skyMode];
  const sky = viewMode === '3d'
    ? `<button data-action="sky" aria-label="Cielo: ${label}" title="Cielo: ${label}">${icon}<span class="lbl"> ${label}</span></button>`
    : '';
  const speedBtn = `<button data-action="speed" aria-label="Velocità: ${speed.label}" title="Velocità di gioco: ${speed.label}">${speed.icon}<span class="lbl"> ${speed.label}</span></button>`;
  return cam + sky + toggle + speedBtn + soundButtons();
}

function render(): void {
  const s = session.state;
  if (!s || resumeOffered) return showSetup();
  if (viewMode === '3d') render3d(s);
  else {
    animating = false;
    render2d(s);
  }
  bots.schedule();
}

function undoButton(): string {
  if (!session.canUndo) return '';
  return `<button class="undo" data-action="undo" title="Annulla l'ultima mossa (non i dadi)">↩ Annulla</button>`;
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
      <aside class="side" aria-label="Giocatori e registro">
        <button class="drawer-close" data-action="drawer">✕ Chiudi</button>
        <div class="view-buttons in-drawer"></div>
        <div class="hud"></div>
        <div class="players-list"></div>
        <p class="saved">💾 La partita si salva da sola su questo dispositivo.</p>
        <button class="link" data-action="quit">Abbandona la partita</button>
        <a class="report-link" data-report href="#" target="_blank" rel="noopener">🐞 Segnala un problema</a>
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
    ? `<div class="bar-head">${turnHtml(s)}<button class="drawer-btn" data-action="drawer" aria-expanded="${drawerOpen}">👥 Giocatori</button></div>${controlsHtml(s)}`
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
    `<div class="board">
      ${renderBoard(s, selected)}
      <div class="center">${renderTable(s)}</div>
    </div>`,
    '2d',
  );
  fillPanels(s);
}

let loading3d = false;
function render3d(s: GameState): void {
  // la scena 3D si crea una sola volta: ridisegniamo solo i pannelli HTML
  if (!board3d) {
    if (!app.querySelector('.game3d .board3d')) app.innerHTML = gameShell('<div class="board3d"><p class="loading-3d">Preparo il tabellone 3D…</p></div>', '3d');
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
    (spaceId) => {
      selected = selected === spaceId ? null : spaceId;
      error = '';
      render();
    },
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
  const actorBot = !!before.players[actingPlayer(before)].isBot;
  // le azioni di una persona azzerano le notizie; quelle del computer si accumulano
  if (!actorBot || !lastActorBot) newsFrom = before.eventCount ?? 0;
  lastActorBot = actorBot;
  try {
    const prev = session.apply(action);
    const state = session.state!;
    error = '';
    if (action.type === 'roll') {
      audio.play('dice');
      if (state.lastRoll) board3d?.showDice(state.lastRoll, prev.current);
    }
    // partita appena finita: il risultato entra nella classifica tra amici
    if (prev.phase !== 'gameOver' && state.phase === 'gameOver') saveLeaderboard(addResult(loadLeaderboard(), state, ctx));
    const sfx = soundFor(prev, state, action);
    // il suono del lancio c'è già: dopo un attimo quello del risultato
    if (sfx && sfx !== 'dice') setTimeout(() => audio.play(sfx), action.type === 'roll' ? 450 / speed.factor : 0);
    // dopo il lancio, se la casella di arrivo si può comprare, compare la sua carta
    if (action.type === 'roll') selected = state.phase === 'buy' ? board.spaces[state.players[state.current].position]?.id ?? null : null;
    if (action.type === 'buy' || action.type === 'decline') selected = null;
    if (action.type === 'endTurn' || action.type === 'bankrupt') {
      selected = null;
      tradeDraft = null;
    }
  } catch (e) {
    if (e instanceof RuleError) {
      error = e.message;
      audio.play('error');
    } else throw e;
  }
  session.save();
  render();
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
  if (!action && spaceId) {
    selected = selected === spaceId ? null : spaceId;
    error = '';
    return render();
  }
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
    case 'toggleMusic':
      audio.setMusic(!audio.musicOn);
      return render();
    case 'openTrade': {
      const to = state.players.find((o) => o.id !== state.current && !o.bankrupt)!.id;
      tradeDraft = { to, give: { money: 0, spaces: [] }, get: { money: 0, spaces: [] } };
      error = '';
      return render();
    }
    case 'closeTrade':
      tradeDraft = null;
      return render();
    case 'bid':
      return act({ type: 'bid', amount: Number(target.dataset.amount) });
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
      bots.cancel();
      session.clear();
      selected = null;
      error = '';
      session.save();
      return render();
    case 'coverDebt':
      newsFrom = state.eventCount ?? 0;
      lastActorBot = false;
      session.coverDebt();
      error = '';
      audio.play('coin');
      session.save();
      return render();
    case 'undo':
      if (!session.undo()) return;
      error = '';
      selected = null;
      session.save();
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
});

app.addEventListener('submit', (e) => {
  if ((e.target as HTMLElement).id !== 'trade-form' || !tradeDraft) return;
  e.preventDefault();
  // legge anche i campi soldi non ancora confermati
  const form = e.target as HTMLFormElement;
  for (const input of form.querySelectorAll<HTMLInputElement>('input[type=number]')) {
    const side = input.dataset.trade === 'give-money' ? tradeDraft.give : tradeDraft.get;
    side.money = Math.max(0, Math.floor(Number(input.value) || 0));
  }
  const draft = tradeDraft;
  act({ type: 'proposeTrade', offer: { to: draft.to, give: draft.give, get: draft.get } });
  if (!error) tradeDraft = null;
  render();
});

// Azioni che non si annullano: il primo tocco chiede conferma, il secondo esegue.
function confirmTwice(button: HTMLElement): boolean {
  if (button.dataset.confirm === 'yes') return true;
  button.dataset.confirm = 'yes';
  button.textContent = 'Tocca di nuovo per confermare';
  return false;
}

// Esc chiude la carta della casella o il cassetto.
document.addEventListener('keydown', (e) => {
  if (e.key !== 'Escape' || !session.state || resumeOffered) return;
  if (selected) selected = null;
  else if (drawerOpen) drawerOpen = false;
  else return;
  render();
});

setupOffline();

// Prima partenza: si disegna la pagina sotto la schermata di caricamento, poi si caricano
// in anticipo i personaggi 3D che serviranno (quelli della partita salvata o della schermata iniziale).
render();
const neededCharacters = webglAvailable() && viewMode === '3d'
  ? [...new Set((session.state ? session.state.players.map((p) => p.appearance?.character) : setupLooks.slice(0, SEATS_SHOWN).map((l) => l.character)).filter((c): c is string => !!c))]
  : [];
void runLoading(
  neededCharacters.map((id) => ({
    label: `${characterDef(id).emoji} ${characterDef(id).label} pronto`,
    run: () => load3d().then((m) => m.loadModel(id)),
  })),
);

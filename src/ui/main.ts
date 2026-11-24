// Controller dell'interfaccia: collega i clic alle azioni del motore e ridisegna la pagina.
// Le parti più grandi stanno in moduli separati: schermata iniziale (setup.ts), partita salvata
// e "Annulla" (session.ts), turni del computer (bots.ts), suoni (sounds.ts), preferenze (prefs.ts).
import './style.css';
import { board, cards } from '../data';
import { actingPlayer, chooseBotAction, createGame, RuleError, type Action, type GameContext, type GameState } from '../engine';
import { escapeHtml, renderBoard, renderDice, renderPlayers, renderSpaceDetails, renderTradeEditor, renderTurnActions, type TradeDraft } from './view';
import { Board3D, webglAvailable, type CameraMode } from './three/board3d';
import type { SkyMode } from './three/city';
import { loadModel } from './three/characters3d';
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
  renderSetup(app, tutorial.on, startGame);
}

function startGame(choice: SetupChoice): void {
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

// Parte centrale: turno, azioni, cosa è appena successo, scheda della casella e registro.
function hudHtml(s: GameState): string {
  const p = s.players[s.phase === 'gameOver' && s.winner !== null ? s.winner : actingPlayer(s)];
  const fresh = Math.min(Math.max((s.eventCount ?? 0) - newsFrom, 0), s.log.length, 8);
  const news = fresh ? s.log.slice(-fresh) : [];
  const total = s.lastRoll ? s.lastRoll[0] + s.lastRoll[1] : 0;
  return `
    <div class="turn" style="--c:${playerColor(p)}">
      <span class="token big" style="background:${playerColor(p)}"></span>
      <span>${s.phase === 'gameOver' ? '<strong>Partita finita</strong>' : `Tocca a <strong>${p.isBot ? '🤖 ' : ''}${escapeHtml(p.name)}</strong>`}</span>
      ${s.rules?.demo ? `<span class="pill demo" title="Modalità demo sperimentale">🧪 Demo</span>` : ''}
      ${s.rules?.maxRounds ? `<span class="pill">Giro ${s.round} di ${s.rules.maxRounds}</span>` : ''}
      ${s.rules?.parkPot ? `<span class="pill" title="Montepremi della Panchina del Parco">🪑 ${board.currency.symbol} ${s.pot}</span>` : ''}
      ${s.lastRoll ? `<span class="roll">${renderDice(s)}<span class="roll-total">${total}</span></span>` : ''}
    </div>
    ${tradeDraft ? renderTradeEditor(s, tradeDraft) : `<div class="actions">${renderTurnActions(s)}${undoButton()}</div>`}
    ${tipHtml(s)}
    ${s.phase === 'gameOver' ? renderSummary(s, ctx) : ''}
    ${error ? `<p class="error" role="alert">${escapeHtml(error)}</p>` : ''}
    ${news.length ? `<div class="news" aria-live="polite"><h4>Cosa è successo</h4><ul>${news.map((l) => `<li>${escapeHtml(l)}</li>`).join('')}</ul></div>` : ''}
    ${selected ? renderSpaceDetails(s, selected) : '<p class="hint">Tocca una casella per vedere i dettagli.</p>'}
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
  if (!s) return showSetup();
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

function render2d(s: GameState): void {
  destroy3d();
  app.innerHTML = `
    <div class="game">
      <div class="board">
        ${renderBoard(s, selected)}
        <div class="center">
          <h1 class="title">Sdrogopoli</h1>
          ${hudHtml(s)}
        </div>
      </div>
      <aside class="players">
        <div class="view-buttons">${viewButtons()}</div>
        ${renderPlayers(s)}
        <p class="saved">💾 La partita si salva da sola su questo dispositivo.</p>
        <button class="link" data-action="quit">Abbandona la partita</button>
      </aside>
    </div>`;
}

function render3d(s: GameState): void {
  // la scena 3D si crea una sola volta: ridisegniamo solo i pannelli HTML
  if (!board3d) {
    app.innerHTML = `
      <div class="game game3d">
        <div class="stage">
          <div class="board3d"></div>
          <div class="view-buttons overlay"></div>
        </div>
        <aside class="side">
          <div class="hud"></div>
          <div class="players-list"></div>
          <p class="saved">💾 La partita si salva da sola su questo dispositivo.</p>
          <button class="link" data-action="quit">Abbandona la partita</button>
        </aside>
      </div>`;
    board3d = new Board3D(
      app.querySelector<HTMLDivElement>('.board3d')!,
      (spaceId) => {
        selected = selected === spaceId ? null : spaceId;
        error = '';
        render();
      },
      (busy) => {
        animating = busy;
        app.querySelector('.hud')?.classList.toggle('busy', busy);
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
  app.querySelector('.hud')!.innerHTML = hudHtml(s);
  app.querySelector('.players-list')!.innerHTML = renderPlayers(s);
  app.querySelector('.view-buttons')!.innerHTML = viewButtons();
  board3d.update(s, selected);
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
    // dopo il lancio mostra la casella di arrivo
    if (action.type === 'roll') selected = board.spaces[state.players[state.current].position]?.id ?? null;
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
  const target = (e.target as HTMLElement).closest<HTMLElement>('[data-action], [data-space]');
  const state = session.state;
  if (!target || !state) return;
  // mentre la pedina si muove le azioni del turno aspettano
  if (target.closest('.hud.busy .actions')) return;
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

// Prima partenza: si disegna la pagina sotto la schermata di caricamento, poi si caricano
// in anticipo i personaggi 3D che serviranno (quelli della partita salvata o della schermata iniziale).
render();
const neededCharacters = webglAvailable()
  ? [...new Set((session.state ? session.state.players.map((p) => p.appearance?.character) : setupLooks.slice(0, SEATS_SHOWN).map((l) => l.character)).filter((c): c is string => !!c))]
  : [];
void runLoading(
  neededCharacters.map((id) => ({
    label: `${characterDef(id).emoji} ${characterDef(id).label} pronto`,
    run: () => loadModel(id),
  })),
);

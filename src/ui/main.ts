// Controller dell'interfaccia: collega i clic alle azioni del motore e ridisegna la pagina.
import './style.css';
import { board, cards } from '../data';
import { applyAction, chooseBotAction, createGame, RuleError, type Action, type GameContext, type GameState } from '../engine';
import { PLAYER_COLORS, escapeHtml, renderBoard, renderDice, renderPlayers, renderSpaceDetails, renderTurnActions } from './view';
import { Board3D, webglAvailable, type CameraMode } from './three/board3d';

const SAVE_KEY = 'sdrogopoli-partita';
const VIEW_KEY = 'sdrogopoli-vista';
const ctx: GameContext = { board, cards, rng: Math.random };
const app = document.querySelector<HTMLDivElement>('#app')!;

type ViewMode = '3d' | '2d';

let state: GameState | null = load();
let selected: string | null = null;
let error = '';
let viewMode: ViewMode = webglAvailable() && readPref(VIEW_KEY) !== '2d' ? '3d' : '2d';
let cameraMode: CameraMode = 'follow';
let board3d: Board3D | null = null;
// true mentre la pedina si muove nel 3D: il computer aspetta che finisca
let animating = false;
let botTimer: ReturnType<typeof setTimeout> | null = null;

// ---------- salvataggio nel browser (facoltativo: se non funziona si gioca lo stesso) ----------

function save(): void {
  try {
    if (state) localStorage.setItem(SAVE_KEY, JSON.stringify(state));
    else localStorage.removeItem(SAVE_KEY);
  } catch {
    /* archiviazione non disponibile */
  }
}

function load(): GameState | null {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    return raw ? (JSON.parse(raw) as GameState) : null;
  } catch {
    return null;
  }
}

function readPref(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writePref(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {
    /* ignora */
  }
}

// ---------- schermata iniziale ----------

function renderSetup(): void {
  destroy3d();
  app.innerHTML = `
    <main class="setup">
      <h1>Sdrogopoli</h1>
      <p>Compra le vie della città, costruisci case e manda in rovina gli amici. Da 2 a 4 giocatori sullo stesso dispositivo.</p>
      <form id="setup-form">
        ${[0, 1, 2, 3]
          .map(
            (i) => `<div class="setup-row"><span class="token big" style="background:${PLAYER_COLORS[i]}"></span>
              <input name="p${i}" maxlength="16" aria-label="Nome giocatore ${i + 1}" placeholder="Giocatore ${i + 1}${i >= 2 ? ' (facoltativo)' : ''}" ${i < 2 ? `value="${i === 0 ? 'Giocatore 1' : 'Computer'}"` : ''}>
              <select name="t${i}" aria-label="Chi controlla il giocatore ${i + 1}">
                <option value="human" ${i === 0 ? 'selected' : ''}>👤 Persona</option>
                <option value="bot" ${i > 0 ? 'selected' : ''}>🤖 Computer</option>
              </select></div>`,
          )
          .join('')}
        <button class="primary" type="submit">Inizia la partita</button>
      </form>
    </main>`;
  document.querySelector<HTMLFormElement>('#setup-form')!.addEventListener('submit', (e) => {
    e.preventDefault();
    const data = new FormData(e.target as HTMLFormElement);
    const players = [0, 1, 2, 3]
      .map((i) => ({ name: String(data.get(`p${i}`) ?? '').trim(), isBot: data.get(`t${i}`) === 'bot' }))
      .filter((p) => p.name);
    if (players.length < 2) {
      const form = e.target as HTMLFormElement;
      form.querySelector('.error')?.remove();
      form.insertAdjacentHTML('beforeend', `<p class="error">Servono almeno 2 giocatori.</p>`);
      return;
    }
    state = createGame(players, ctx);
    selected = null;
    save();
    render();
  });
}

// ---------- partita ----------

// Parte centrale: turno, azioni, scheda della casella e ultimi eventi.
function hudHtml(s: GameState): string {
  const p = s.players[s.current];
  return `
    <div class="turn">
      <span class="token big" style="background:${PLAYER_COLORS[p.id]}"></span>
      Tocca a <strong>${escapeHtml(p.name)}</strong> ${renderDice(s)}
    </div>
    <div class="actions">${renderTurnActions(s)}</div>
    ${error ? `<p class="error">${escapeHtml(error)}</p>` : ''}
    ${selected ? renderSpaceDetails(s, selected) : '<p class="hint">Tocca una casella per vedere i dettagli.</p>'}
    <ol class="log">${s.log.slice(-6).reverse().map((l) => `<li>${escapeHtml(l)}</li>`).join('')}</ol>`;
}

function viewButtons(): string {
  const cam = viewMode === '3d'
    ? `<button data-action="camera">${cameraMode === 'follow' ? '🗺️ Vista d\'insieme' : '🎥 Segui la pedina'}</button>`
    : '';
  const toggle = webglAvailable()
    ? `<button data-action="toggleView">${viewMode === '3d' ? 'Vista 2D' : 'Vista 3D'}</button>`
    : '';
  return cam + toggle;
}

function render(): void {
  if (!state) return renderSetup();
  if (viewMode === '3d') render3d(state);
  else {
    animating = false;
    render2d(state);
  }
  scheduleBot();
}

// ---------- giocatori controllati dal computer ----------

function botToPlay(): boolean {
  return !!state && state.phase !== 'gameOver' && !!state.players[state.current].isBot;
}

// Fa giocare il computer con una piccola pausa, così si capisce cosa succede.
function scheduleBot(): void {
  if (botTimer || animating || !botToPlay()) return;
  const delay = state!.phase === 'roll' ? 900 : 650;
  botTimer = setTimeout(() => {
    botTimer = null;
    if (animating || !botToPlay()) return;
    act(chooseBotAction(state!, ctx));
  }, delay);
}

function cancelBot(): void {
  if (botTimer) clearTimeout(botTimer);
  botTimer = null;
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
        if (!busy) scheduleBot();
      },
    );
    board3d.cameraMode = cameraMode;
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
  if (!state) return;
  try {
    state = applyAction(state, action, ctx);
    error = '';
    // dopo il lancio mostra la casella di arrivo
    if (action.type === 'roll') selected = board.spaces[state.players[state.current].position]?.id ?? null;
    if (action.type === 'endTurn' || action.type === 'bankrupt') selected = null;
  } catch (e) {
    if (e instanceof RuleError) error = e.message;
    else throw e;
  }
  save();
  render();
}

// Un solo gestore di clic per tutta la pagina.
app.addEventListener('click', (e) => {
  const target = (e.target as HTMLElement).closest<HTMLElement>('[data-action], [data-space]');
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
    case 'toggleView':
      viewMode = viewMode === '3d' ? '2d' : '3d';
      writePref(VIEW_KEY, viewMode);
      return render();
    case 'camera':
      cameraMode = cameraMode === 'follow' ? 'overview' : 'follow';
      if (board3d) board3d.cameraMode = cameraMode;
      return render();
    case 'newGame':
    case 'quit':
      if (action === 'quit' && !confirmQuit(target)) return;
      cancelBot();
      state = null;
      selected = null;
      error = '';
      save();
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
    case 'bankrupt':
      return act({ type: action });
  }
});

// Chiede conferma con un secondo tocco, senza finestre di dialogo del browser.
function confirmQuit(button: HTMLElement): boolean {
  if (button.dataset.confirm === 'yes') return true;
  button.dataset.confirm = 'yes';
  button.textContent = 'Tocca di nuovo per confermare';
  return false;
}

render();

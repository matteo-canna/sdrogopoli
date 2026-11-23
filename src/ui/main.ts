// Controller dell'interfaccia: collega i clic alle azioni del motore e ridisegna la pagina.
import './style.css';
import { board, cards } from '../data';
import { actingPlayer, applyAction, chooseBotAction, createGame, RuleError, type Action, type GameContext, type GameState } from '../engine';
import { PLAYER_COLORS, escapeHtml, renderBoard, renderDice, renderPlayers, renderSpaceDetails, renderTradeEditor, renderTurnActions, type TradeDraft } from './view';
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
// eventi da mostrare in evidenza: da quando ha agito l'ultima persona
let newsFrom = state?.eventCount ?? 0;
let lastActorBot = false;
// scambio che la persona di turno sta preparando
let tradeDraft: TradeDraft | null = null;

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
        <details class="house-rules">
          <summary>⚙️ Regole della casa</summary>
          <label>Soldi iniziali
            <select name="money">${[1000, 1500, 2000, 2500].map((m) => `<option value="${m}" ${m === board.startingMoney ? 'selected' : ''}>${board.currency.symbol} ${m}</option>`).join('')}</select>
          </label>
          <label>Durata
            <select name="rounds">
              <option value="">Fino all'ultimo rimasto</option>
              <option value="15">15 giri (partita breve)</option>
              <option value="25">25 giri</option>
              <option value="40">40 giri</option>
            </select>
          </label>
          <label class="check"><input type="checkbox" name="pot"> Montepremi: tasse e multe vanno sulla Panchina del Parco e chi ci arriva le incassa</label>
        </details>
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
    const rounds = Number(data.get('rounds')) || null;
    state = createGame(players, ctx, {
      startingMoney: Number(data.get('money')) || board.startingMoney,
      maxRounds: rounds,
      parkPot: data.get('pot') === 'on',
    });
    selected = null;
    newsFrom = 0;
    lastActorBot = false;
    save();
    render();
  });
}

// ---------- partita ----------

// Parte centrale: turno, azioni, cosa è appena successo, scheda della casella e registro.
function hudHtml(s: GameState): string {
  const p = s.players[actingPlayer(s)];
  const fresh = Math.min(Math.max((s.eventCount ?? 0) - newsFrom, 0), s.log.length, 8);
  const news = fresh ? s.log.slice(-fresh) : [];
  const total = s.lastRoll ? s.lastRoll[0] + s.lastRoll[1] : 0;
  return `
    <div class="turn">
      <span class="token big" style="background:${PLAYER_COLORS[p.id]}"></span>
      <span>Tocca a <strong>${p.isBot ? '🤖 ' : ''}${escapeHtml(p.name)}</strong></span>
      ${s.rules?.maxRounds ? `<span class="pill">Giro ${s.round} di ${s.rules.maxRounds}</span>` : ''}
      ${s.rules?.parkPot ? `<span class="pill" title="Montepremi della Panchina del Parco">🪑 ${board.currency.symbol} ${s.pot}</span>` : ''}
      ${s.lastRoll ? `<span class="roll">${renderDice(s)}<span class="roll-total">${total}</span></span>` : ''}
    </div>
    ${tradeDraft ? renderTradeEditor(s, tradeDraft) : `<div class="actions">${renderTurnActions(s)}</div>`}
    ${error ? `<p class="error" role="alert">${escapeHtml(error)}</p>` : ''}
    ${news.length ? `<div class="news" aria-live="polite"><h4>Cosa è successo</h4><ul>${news.map((l) => `<li>${escapeHtml(l)}</li>`).join('')}</ul></div>` : ''}
    ${selected ? renderSpaceDetails(s, selected) : '<p class="hint">Tocca una casella per vedere i dettagli.</p>'}
    <details class="log-box"><summary>Registro della partita</summary>
      <ol class="log">${s.log.slice().reverse().map((l) => `<li>${escapeHtml(l)}</li>`).join('')}</ol>
    </details>`;
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
  return !!state && state.phase !== 'gameOver' && !!state.players[actingPlayer(state)].isBot;
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
  const actorBot = !!state.players[actingPlayer(state)].isBot;
  // le azioni di una persona azzerano le notizie; quelle del computer si accumulano
  if (!actorBot || !lastActorBot) newsFrom = state.eventCount ?? 0;
  lastActorBot = actorBot;
  try {
    state = applyAction(state, action, ctx);
    error = '';
    // dopo il lancio mostra la casella di arrivo
    if (action.type === 'roll') selected = board.spaces[state.players[state.current].position]?.id ?? null;
    if (action.type === 'endTurn' || action.type === 'bankrupt') {
      selected = null;
      tradeDraft = null;
    }
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
    case 'openTrade': {
      const to = state.players.find((o) => o.id !== state!.current && !o.bankrupt)!.id;
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

// Modifiche al modulo dello scambio.
app.addEventListener('change', (e) => {
  const el = e.target as HTMLInputElement | HTMLSelectElement;
  const field = el.dataset.trade;
  if (!field || !tradeDraft || !state) return;
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

// Chiede conferma con un secondo tocco, senza finestre di dialogo del browser.
function confirmQuit(button: HTMLElement): boolean {
  if (button.dataset.confirm === 'yes') return true;
  button.dataset.confirm = 'yes';
  button.textContent = 'Tocca di nuovo per confermare';
  return false;
}

render();

// Controller dell'interfaccia: collega i clic alle azioni del motore e ridisegna la pagina.
import './style.css';
import { board, cards } from '../data';
import { applyAction, createGame, RuleError, type Action, type GameContext, type GameState } from '../engine';
import { PLAYER_COLORS, escapeHtml, renderBoard, renderDice, renderPlayers, renderSpaceDetails, renderTurnActions } from './view';

const SAVE_KEY = 'sdrogopoli-partita';
const ctx: GameContext = { board, cards, rng: Math.random };
const app = document.querySelector<HTMLDivElement>('#app')!;

let state: GameState | null = load();
let selected: string | null = null;
let error = '';

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

// ---------- schermata iniziale ----------

function renderSetup(): void {
  app.innerHTML = `
    <main class="setup">
      <h1>Sdrogopoli</h1>
      <p>Compra le vie della città, costruisci case e manda in rovina gli amici. Da 2 a 4 giocatori sullo stesso dispositivo.</p>
      <form id="setup-form">
        ${[0, 1, 2, 3]
          .map(
            (i) => `<label><span class="token big" style="background:${PLAYER_COLORS[i]}"></span>
              <input name="p${i}" maxlength="16" placeholder="Giocatore ${i + 1}${i >= 2 ? ' (facoltativo)' : ''}" ${i < 2 ? `value="Giocatore ${i + 1}"` : ''}></label>`,
          )
          .join('')}
        <button class="primary" type="submit">Inizia la partita</button>
      </form>
    </main>`;
  document.querySelector<HTMLFormElement>('#setup-form')!.addEventListener('submit', (e) => {
    e.preventDefault();
    const data = new FormData(e.target as HTMLFormElement);
    const names = [0, 1, 2, 3].map((i) => String(data.get(`p${i}`) ?? '').trim()).filter(Boolean);
    if (names.length < 2) {
      alertInline('Servono almeno 2 giocatori.');
      return;
    }
    state = createGame(names, ctx);
    selected = null;
    save();
    render();
  });
}

function alertInline(msg: string): void {
  const form = document.querySelector('#setup-form')!;
  form.querySelector('.error')?.remove();
  form.insertAdjacentHTML('beforeend', `<p class="error">${escapeHtml(msg)}</p>`);
}

// ---------- partita ----------

function render(): void {
  if (!state) return renderSetup();
  const p = state.players[state.current];
  app.innerHTML = `
    <div class="game">
      <div class="board">
        ${renderBoard(state, selected)}
        <div class="center">
          <h1 class="title">Sdrogopoli</h1>
          <div class="turn">
            <span class="token big" style="background:${PLAYER_COLORS[p.id]}"></span>
            Tocca a <strong>${escapeHtml(p.name)}</strong> ${renderDice(state)}
          </div>
          <div class="actions">${renderTurnActions(state)}</div>
          ${error ? `<p class="error">${escapeHtml(error)}</p>` : ''}
          ${selected ? renderSpaceDetails(state, selected) : '<p class="hint">Tocca una casella per vedere i dettagli.</p>'}
          <ol class="log">${state.log.slice(-6).reverse().map((l) => `<li>${escapeHtml(l)}</li>`).join('')}</ol>
        </div>
      </div>
      <aside class="players">
        ${renderPlayers(state)}
        <button class="link" data-action="quit">Abbandona la partita</button>
      </aside>
    </div>`;
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
  const action = target.dataset.action;
  const spaceId = target.dataset.space;
  if (!action && spaceId) {
    selected = selected === spaceId ? null : spaceId;
    error = '';
    return render();
  }
  switch (action) {
    case 'newGame':
    case 'quit':
      if (action === 'quit' && !confirmQuit(target)) return;
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

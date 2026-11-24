// Controller dell'interfaccia: collega i clic alle azioni del motore e ridisegna la pagina.
import './style.css';
import { board, cards } from '../data';
import { QUICK_START_PROPERTIES, SEAT_BONUS, actingPlayer, applyAction, chooseBotAction, createGame, RuleError, type Action, type Appearance, type GameContext, type GameState } from '../engine';
import { escapeHtml, renderBoard, renderDice, renderPlayers, renderSpaceDetails, renderTradeEditor, renderTurnActions, type TradeDraft } from './view';
import { Board3D, webglAvailable, type CameraMode } from './three/board3d';
import { CharacterPreview } from './three/characters3d';
import { CHARACTERS, COLOR_CHOICES, COLOR_NAMES, characterDef, defaultAppearance, playerColor } from './characters';
import { audio, type Sfx } from './audio';

const SAVE_KEY = 'sdrogopoli-partita';
const VIEW_KEY = 'sdrogopoli-vista';
const LOOKS_KEY = 'sdrogopoli-aspetto';
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
// aspetto scelto per ciascuno dei 4 posti nella schermata iniziale (ricordato per la prossima partita)
let setupLooks: Appearance[] = loadLooks();
// posto di cui si sta modificando l'aspetto (null = editor chiuso)
let editingSeat: number | null = null;
let preview: CharacterPreview | null = null;

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

function loadLooks(): Appearance[] {
  let saved: Partial<Appearance>[] = [];
  try {
    saved = JSON.parse(readPref(LOOKS_KEY) ?? '[]');
  } catch {
    /* preferenza rovinata: si riparte da quelle predefinite */
  }
  return [0, 1, 2, 3].map((i) => {
    const look = { ...defaultAppearance(i), ...(Array.isArray(saved) ? saved[i] : {}) };
    // un personaggio sconosciuto torna a quello predefinito
    if (!CHARACTERS.some((c) => c.id === look.character)) return defaultAppearance(i);
    if (look.item && !(look.item in characterDef(look.character).items)) look.item = '';
    return look;
  });
}

// ---------- schermata iniziale ----------

function lookButton(i: number): string {
  const look = setupLooks[i];
  const def = characterDef(look.character);
  return `<button type="button" class="look-btn" data-look="${i}" style="--c:${look.color}" aria-expanded="${editingSeat === i}"
    title="Scegli il personaggio" aria-label="Personaggio del giocatore ${i + 1}: ${def.label}">${def.emoji}</button>`;
}

// Editor dell'aspetto: personaggio, colore, copricapo, mantello e oggetto in mano.
function lookEditorHtml(i: number): string {
  const look = setupLooks[i];
  const def = characterDef(look.character);
  return `
    <div class="look-editor" style="--c:${look.color}">
      <div class="look-preview" id="look-preview">${webglAvailable() ? '' : `<span class="look-emoji">${def.emoji}</span>`}</div>
      <div class="look-controls">
        <div class="look-group" role="radiogroup" aria-label="Personaggio">
          ${CHARACTERS.map((c) => `<button type="button" class="chip-btn" role="radio" aria-checked="${c.id === look.character}" data-character="${c.id}">${c.emoji} ${c.label}</button>`).join('')}
        </div>
        <div class="look-group swatches" role="radiogroup" aria-label="Colore">
          ${COLOR_CHOICES.map((col) => `<button type="button" class="swatch" role="radio" aria-checked="${col === look.color}" data-color="${col}" style="background:${col}" title="${COLOR_NAMES[col]}" aria-label="${COLOR_NAMES[col]}"></button>`).join('')}
        </div>
        ${def.hat ? `<label class="check"><input type="checkbox" data-hat ${look.hat ? 'checked' : ''}> Copricapo</label>` : ''}
        <label class="check"><input type="checkbox" data-cape ${look.cape ? 'checked' : ''}> Mantello del mio colore</label>
        <label class="hold">In mano
          <select data-item>
            <option value="">Niente</option>
            ${Object.entries(def.items).map(([id, label]) => `<option value="${id}" ${id === look.item ? 'selected' : ''}>${label}</option>`).join('')}
          </select>
        </label>
        <button type="button" class="primary" data-look-done>Fatto</button>
      </div>
    </div>`;
}

function destroyPreview(): void {
  preview?.dispose();
  preview = null;
}

// Ridisegna solo i pulsanti dei personaggi e l'editor, senza toccare i nomi già scritti.
function refreshLooks(): void {
  writePref(LOOKS_KEY, JSON.stringify(setupLooks));
  document.querySelectorAll<HTMLElement>('.setup-row').forEach((row, i) => {
    row.querySelector('.look-btn')!.outerHTML = lookButton(i);
  });
  const slot = document.querySelector<HTMLElement>('#look-slot');
  if (!slot) return;
  if (editingSeat === null) {
    destroyPreview();
    slot.innerHTML = '';
    return;
  }
  slot.innerHTML = lookEditorHtml(editingSeat);
  const box = slot.querySelector<HTMLElement>('#look-preview')!;
  if (webglAvailable()) {
    // l'anteprima 3D resta la stessa: si sposta nel nuovo editor
    if (preview) preview.moveTo(box);
    else preview = new CharacterPreview(box);
    void preview.show(setupLooks[editingSeat]);
  }
}

function setLook(change: Partial<Appearance>): void {
  if (editingSeat === null) return;
  const look = { ...setupLooks[editingSeat], ...change };
  if (change.character) {
    look.item = characterDef(change.character).defaultItem;
  }
  // colore già usato da un altro: i due giocatori se lo scambiano
  if (change.color) {
    const other = setupLooks.findIndex((l, j) => j !== editingSeat && l.color === change.color);
    if (other >= 0) setupLooks[other] = { ...setupLooks[other], color: setupLooks[editingSeat].color };
  }
  setupLooks[editingSeat] = look;
  refreshLooks();
}

function renderSetup(): void {
  destroy3d();
  destroyPreview();
  editingSeat = null;
  app.innerHTML = `
    <main class="setup">
      <h1>Sdrogopoli</h1>
      <p>Compra le vie della città, costruisci case e manda in rovina gli amici. Da 2 a 4 giocatori sullo stesso dispositivo.</p>
      <form id="setup-form">
        ${[0, 1, 2, 3]
          .map(
            (i) => `<div class="setup-row">${lookButton(i)}
              <input name="p${i}" maxlength="16" aria-label="Nome giocatore ${i + 1}" placeholder="Giocatore ${i + 1}${i >= 2 ? ' (facoltativo)' : ''}" ${i < 2 ? `value="${i === 0 ? 'Giocatore 1' : 'Computer'}"` : ''}>
              <select name="t${i}" aria-label="Chi controlla il giocatore ${i + 1}">
                <option value="human" ${i === 0 ? 'selected' : ''}>👤 Persona</option>
                <option value="bot" ${i > 0 ? 'selected' : ''}>🤖 Computer</option>
              </select></div>`,
          )
          .join('')}
        <div id="look-slot"></div>
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
          <label class="check"><input type="checkbox" name="quick"> Partita rapida: ognuno parte con ${QUICK_START_PROPERTIES} proprietà a caso</label>
          <label class="check"><input type="checkbox" name="bonus" checked> Chi gioca dopo parte con ${board.currency.symbol} ${SEAT_BONUS} in più per ogni posto (compensa il vantaggio di chi inizia)</label>
          <label class="check"><input type="checkbox" name="pot"> Montepremi: tasse e multe vanno sulla Panchina del Parco e chi ci arriva le incassa</label>
        </details>
        <button class="primary" type="submit">Inizia la partita</button>
      </form>
      <p class="credits">Personaggi 3D: <a href="https://kaylousberg.com" target="_blank" rel="noopener">KayKit di Kay Lousberg</a> (CC0)</p>
    </main>`;
  const form = document.querySelector<HTMLFormElement>('#setup-form')!;
  form.addEventListener('click', (e) => {
    const t = (e.target as HTMLElement).closest<HTMLElement>('button');
    if (!t) return;
    if (t.dataset.look !== undefined) {
      const seat = Number(t.dataset.look);
      editingSeat = editingSeat === seat ? null : seat;
      refreshLooks();
    } else if (t.dataset.character) setLook({ character: t.dataset.character });
    else if (t.dataset.color) setLook({ color: t.dataset.color });
    else if (t.hasAttribute('data-look-done')) {
      editingSeat = null;
      refreshLooks();
    }
  });
  form.addEventListener('change', (e) => {
    const t = e.target as HTMLInputElement | HTMLSelectElement;
    if (t.hasAttribute('data-hat')) setLook({ hat: (t as HTMLInputElement).checked });
    else if (t.hasAttribute('data-cape')) setLook({ cape: (t as HTMLInputElement).checked });
    else if (t.hasAttribute('data-item')) setLook({ item: t.value });
  });
  document.querySelector<HTMLFormElement>('#setup-form')!.addEventListener('submit', (e) => {
    e.preventDefault();
    const data = new FormData(e.target as HTMLFormElement);
    const players = [0, 1, 2, 3]
      .map((i) => ({ name: String(data.get(`p${i}`) ?? '').trim(), isBot: data.get(`t${i}`) === 'bot', appearance: setupLooks[i] }))
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
      quickStart: data.get('quick') === 'on',
      seatBonus: data.get('bonus') === 'on' ? SEAT_BONUS : 0,
    });
    destroyPreview();
    editingSeat = null;
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
      <span class="token big" style="background:${playerColor(p)}"></span>
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

function soundButtons(): string {
  return `<button data-action="toggleSfx" aria-pressed="${audio.sfxOn}" aria-label="Effetti sonori" title="Effetti sonori">${audio.sfxOn ? '🔊' : '🔇'}<span class="lbl"> Effetti</span></button>
    <button data-action="toggleMusic" aria-pressed="${audio.musicOn}" aria-label="Musica" title="Musica">${audio.musicOn ? '🎵' : '🚫'}<span class="lbl"> Musica</span></button>`;
}

// Sceglie il suono adatto confrontando lo stato prima e dopo un'azione.
function soundFor(prev: GameState, next: GameState, action: Action): Sfx | null {
  const fresh = next.log.slice(-Math.max((next.eventCount ?? 0) - (prev.eventCount ?? 0), 0)).join(' ');
  const actor = prev.players[actingPlayer(prev)];
  const after = next.players[actor.id];
  if (next.phase === 'gameOver') return 'win';
  if (!actor.inJail && after.inJail) return 'jail';
  if (fresh.includes('pesca')) return 'card';
  if (action.type === 'bid' || fresh.includes("vince l'asta")) return 'gavel';
  if (action.type === 'buy' || action.type === 'build' || action.type === 'acceptTrade') return 'buy';
  if (action.type === 'roll') {
    if (after.money < actor.money) return 'pay';
    if (after.money > actor.money) return 'coin';
    return 'dice';
  }
  if (after.money > actor.money) return 'coin';
  if (after.money < actor.money) return 'pay';
  return null;
}

function viewButtons(): string {
  const cam = viewMode === '3d'
    ? `<button data-action="camera" aria-label="${cameraMode === 'follow' ? 'Vista d\'insieme' : 'Segui la pedina'}">${cameraMode === 'follow' ? '🗺️<span class="lbl"> Vista d\'insieme</span>' : '🎥<span class="lbl"> Segui la pedina</span>'}</button>`
    : '';
  const toggle = webglAvailable()
    ? `<button data-action="toggleView" aria-label="${viewMode === '3d' ? 'Vista 2D' : 'Vista 3D'}">${viewMode === '3d' ? '🔲<span class="lbl"> Vista 2D</span>' : '🧊<span class="lbl"> Vista 3D</span>'}</button>`
    : '';
  return cam + toggle + soundButtons();
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
  if (!state) return;
  const actorBot = !!state.players[actingPlayer(state)].isBot;
  // le azioni di una persona azzerano le notizie; quelle del computer si accumulano
  if (!actorBot || !lastActorBot) newsFrom = state.eventCount ?? 0;
  lastActorBot = actorBot;
  const prev = state;
  try {
    state = applyAction(state, action, ctx);
    error = '';
    if (action.type === 'roll') {
      audio.play('dice');
      if (state.lastRoll) board3d?.showDice(state.lastRoll, prev.current);
    }
    const sfx = soundFor(prev, state, action);
    // il suono del lancio c'è già: dopo un attimo quello del risultato
    if (sfx && sfx !== 'dice') setTimeout(() => audio.play(sfx), action.type === 'roll' ? 450 : 0);
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
  save();
  render();
}

// Un solo gestore di clic per tutta la pagina.
app.addEventListener('click', (e) => {
  // l'audio si può attivare solo dopo un gesto dell'utente
  audio.unlock();
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
    case 'toggleSfx':
      audio.setSfx(!audio.sfxOn);
      return render();
    case 'toggleMusic':
      audio.setMusic(!audio.musicOn);
      return render();
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

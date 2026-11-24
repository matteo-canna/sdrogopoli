// Controller dell'interfaccia: collega i clic alle azioni del motore e ridisegna la pagina.
import './style.css';
import { board, cards } from '../data';
import { DEMO_MAX_PLAYERS, DEMO_ROUNDS, DEMO_SEAT_BONUS, MAX_PLAYERS, MIN_PLAYERS, QUICK_START_PROPERTIES, SEAT_BONUS, demoRules, actingPlayer, applyAction, chooseBotAction, createGame, raiseMoney, RuleError, type Action, type Appearance, type GameContext, type GameState } from '../engine';
import { escapeHtml, renderBoard, renderDice, renderPlayers, renderSpaceDetails, renderTradeEditor, renderTurnActions, type TradeDraft } from './view';
import { Board3D, webglAvailable, type CameraMode } from './three/board3d';
import type { SkyMode } from './three/city';
import { CharacterPreview, loadModel } from './three/characters3d';
import { renderIntro } from './intro';
import { runLoading } from './loading';
import { version } from '../../package.json';
import { tutorialTip } from './tutorial';
import { addResult, renderLeaderboard, renderSummary, sortLeaderboard, type LeaderEntry } from './summary';
import { CHARACTERS, COLOR_CHOICES, COLOR_NAMES, characterDef, defaultAppearance, playerColor } from './characters';
import { audio, type Sfx } from './audio';

const SAVE_KEY = 'sdrogopoli-partita';
const VIEW_KEY = 'sdrogopoli-vista';
const LOOKS_KEY = 'sdrogopoli-aspetto';
const TUTORIAL_KEY = 'sdrogopoli-tutorial';
const LEADERBOARD_KEY = 'sdrogopoli-classifica';
const SKY_KEY = 'sdrogopoli-cielo';
const SKY_LABELS: Record<SkyMode, [string, string]> = {
  cycle: ['🌗', 'Giorno e notte'],
  day: ['☀️', 'Sempre giorno'],
  night: ['🌙', 'Sempre notte'],
};
const ctx: GameContext = { board, cards, rng: Math.random };
// posti nella schermata iniziale: i primi 4 si vedono subito, gli altri con "Aggiungi giocatore"
// (oltre l'8° solo nella modalità demo)
const SEATS = Array.from({ length: DEMO_MAX_PLAYERS }, (_, i) => i);
const SEATS_SHOWN = 4;
const app = document.querySelector<HTMLDivElement>('#app')!;

type ViewMode = '3d' | '2d';

let state: GameState | null = load();
let selected: string | null = null;
let error = '';
let viewMode: ViewMode = webglAvailable() && readPref(VIEW_KEY) !== '2d' ? '3d' : '2d';
let cameraMode: CameraMode = 'follow';
let skyMode: SkyMode = (['cycle', 'day', 'night'] as const).find((m) => m === readPref(SKY_KEY)) ?? 'cycle';
let board3d: Board3D | null = null;
// true mentre la pedina si muove nel 3D: il computer aspetta che finisca
let animating = false;
let botTimer: ReturnType<typeof setTimeout> | null = null;
// eventi da mostrare in evidenza: da quando ha agito l'ultima persona
let newsFrom = state?.eventCount ?? 0;
let lastActorBot = false;
// scambio che la persona di turno sta preparando
let tradeDraft: TradeDraft | null = null;
// aspetto scelto per ciascuno dei posti nella schermata iniziale (ricordato per la prossima partita)
let setupLooks: Appearance[] = loadLooks();
// posto di cui si sta modificando l'aspetto (null = editor chiuso)
let editingSeat: number | null = null;
let preview: CharacterPreview | null = null;
// tutorial: consigli già letti e interruttore generale
let tutorial = loadTutorial();

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

function loadLeaderboard(): LeaderEntry[] {
  try {
    const raw = JSON.parse(readPref(LEADERBOARD_KEY) ?? '[]');
    return Array.isArray(raw) ? sortLeaderboard(raw.filter((e) => e && typeof e.name === 'string')) : [];
  } catch {
    return [];
  }
}

function loadTutorial(): { on: boolean; seen: Set<string> } {
  try {
    const raw = JSON.parse(readPref(TUTORIAL_KEY) ?? '{}');
    return { on: raw.on !== false, seen: new Set(Array.isArray(raw.seen) ? raw.seen : []) };
  } catch {
    return { on: true, seen: new Set() };
  }
}

function saveTutorial(): void {
  writePref(TUTORIAL_KEY, JSON.stringify({ on: tutorial.on, seen: [...tutorial.seen] }));
}

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

function loadLooks(): Appearance[] {
  let saved: Partial<Appearance>[] = [];
  try {
    saved = JSON.parse(readPref(LOOKS_KEY) ?? '[]');
  } catch {
    /* preferenza rovinata: si riparte da quelle predefinite */
  }
  return SEATS.map((i) => {
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
      <header class="brand">
        <div class="brand-strip" aria-hidden="true">${board.groups.map((g) => `<span style="background:${g.color}"></span>`).join('')}</div>
        <h1>Sdrogopoli</h1>
        <p>Compra le vie della città, costruisci case e manda in rovina gli amici. Da ${MIN_PLAYERS} a ${MAX_PLAYERS} giocatori sullo stesso dispositivo (fino a ${DEMO_MAX_PLAYERS} nella modalità demo).</p>
      </header>
      <div class="setup-grid">
      <div class="setup-main">
      <form id="setup-form" class="card">
        <div class="form-head">
          <h2>Chi gioca?</h2>
          <p>Tocca il cerchio colorato per scegliere personaggio e colore. Lascia vuoto un nome per giocare in meno.</p>
        </div>
        ${SEATS
          .map(
            (i) => `<div class="setup-row" ${i >= SEATS_SHOWN ? 'hidden' : ''}>${lookButton(i)}
              <input name="p${i}" maxlength="16" aria-label="Nome giocatore ${i + 1}" placeholder="Giocatore ${i + 1}${i >= 2 ? ' (facoltativo)' : ''}" ${i < 2 ? `value="${i === 0 ? 'Giocatore 1' : 'Computer'}"` : ''}>
              <select name="t${i}" aria-label="Chi controlla il giocatore ${i + 1}">
                <option value="human" ${i === 0 ? 'selected' : ''}>👤 Persona</option>
                <option value="bot" ${i > 0 ? 'selected' : ''}>🤖 Computer</option>
              </select></div>`,
          )
          .join('')}
        <button type="button" class="add-seat" data-add-seat>➕ Aggiungi giocatore <small>(fino a <span data-seat-max>${MAX_PLAYERS}</span>)</small></button>
        <label class="check demo-toggle"><input type="checkbox" name="demo">
          <span><strong>🧪 Modalità demo</strong> <span class="badge-demo">sperimentale</span><br>
          <small>Fino a ${DEMO_MAX_PLAYERS} giocatori. Per non aspettare troppo il proprio turno la partita dura ${DEMO_ROUNDS} giri (vince il patrimonio più alto) e il bonus del posto scende a ${board.currency.symbol} ${DEMO_SEAT_BONUS}.</small></span></label>
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
              <option value="${DEMO_ROUNDS}">${DEMO_ROUNDS} giri</option>
              <option value="25">25 giri</option>
              <option value="40">40 giri</option>
            </select>
          </label>
          <label class="check"><input type="checkbox" name="tips" ${tutorial.on ? 'checked' : ''}> Consigli durante la partita (utile la prima volta)</label>
          <label class="check"><input type="checkbox" name="quick"> Partita rapida: ognuno parte con ${QUICK_START_PROPERTIES} proprietà a caso (meno se si è in tanti: le proprietà sono ${board.spaces.filter((sp) => sp.type === 'property').length})</label>
          <label class="check"><input type="checkbox" name="bonus" checked> Chi gioca dopo parte con ${board.currency.symbol} <span data-bonus-amount>${SEAT_BONUS}</span> in più per ogni posto (compensa il vantaggio di chi inizia)</label>
          <label class="check"><input type="checkbox" name="pot"> Montepremi: tasse e multe vanno sulla Panchina del Parco e chi ci arriva le incassa</label>
        </details>
        <button class="primary" type="submit">Inizia la partita</button>
      </form>
      <div id="leaderboard-slot">${renderLeaderboard(loadLeaderboard())}</div>
      </div>
      <aside class="setup-info">${renderIntro()}</aside>
      </div>
      <footer class="credits">
        <p>🆓 Gratis, senza pubblicità e senza account. Le partite restano su questo dispositivo.</p>
        <p>Personaggi 3D: <a href="https://kaylousberg.com" target="_blank" rel="noopener">KayKit di Kay Lousberg</a> (CC0) · Versione ${version}</p>
      </footer>
    </main>`;
  document.querySelector('#leaderboard-slot')!.addEventListener('click', (e) => {
    if (!(e.target as HTMLElement).closest('[data-reset-leaderboard]')) return;
    writePref(LEADERBOARD_KEY, '[]');
    document.querySelector('#leaderboard-slot')!.innerHTML = '';
  });
  const form = document.querySelector<HTMLFormElement>('#setup-form')!;
  const isDemo = () => form.querySelector<HTMLInputElement>('input[name=demo]')!.checked;
  // posti visibili e pulsante "Aggiungi giocatore" in base al limite (8, o 12 in demo)
  const syncSeats = () => {
    const max = isDemo() ? DEMO_MAX_PLAYERS : MAX_PLAYERS;
    const rows = [...form.querySelectorAll<HTMLElement>('.setup-row')];
    rows.forEach((row, i) => {
      if (i >= max) row.hidden = true;
    });
    form.querySelector<HTMLElement>('[data-add-seat]')!.hidden = !rows.some((row, i) => i < max && row.hidden);
    form.querySelector('[data-seat-max]')!.textContent = String(max);
    form.querySelector('[data-bonus-amount]')!.textContent = String(isDemo() ? DEMO_SEAT_BONUS : SEAT_BONUS);
  };
  form.addEventListener('click', (e) => {
    const t = (e.target as HTMLElement).closest<HTMLElement>('button');
    if (!t) return;
    if (t.hasAttribute('data-add-seat')) {
      // mostra il prossimo posto nascosto e porta lì il cursore
      const row = form.querySelector<HTMLElement>('.setup-row[hidden]');
      if (row) {
        row.hidden = false;
        row.querySelector('input')?.focus();
      }
      syncSeats();
    } else if (t.dataset.look !== undefined) {
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
    else if (t.name === 'demo') {
      // la modalità demo propone la sua durata; togliendola si torna a "fino all'ultimo"
      const rounds = form.querySelector<HTMLSelectElement>('select[name=rounds]')!;
      if ((t as HTMLInputElement).checked) rounds.value = String(DEMO_ROUNDS);
      else if (rounds.value === String(DEMO_ROUNDS)) rounds.value = '';
      syncSeats();
    }
  });
  document.querySelector<HTMLFormElement>('#setup-form')!.addEventListener('submit', (e) => {
    e.preventDefault();
    const data = new FormData(e.target as HTMLFormElement);
    const demo = data.get('demo') === 'on';
    const players = SEATS.filter((i) => i < (demo ? DEMO_MAX_PLAYERS : MAX_PLAYERS))
      .map((i) => ({ name: String(data.get(`p${i}`) ?? '').trim(), isBot: data.get(`t${i}`) === 'bot', appearance: setupLooks[i] }))
      .filter((p) => p.name);
    if (players.length < MIN_PLAYERS) {
      const form = e.target as HTMLFormElement;
      form.querySelector('.error')?.remove();
      form.insertAdjacentHTML('beforeend', `<p class="error">Servono almeno ${MIN_PLAYERS} giocatori.</p>`);
      return;
    }
    const rounds = Number(data.get('rounds')) || null;
    state = createGame(players, ctx, {
      ...(demo ? demoRules() : {}),
      startingMoney: Number(data.get('money')) || board.startingMoney,
      maxRounds: rounds,
      parkPot: data.get('pot') === 'on',
      quickStart: data.get('quick') === 'on',
      seatBonus: data.get('bonus') === 'on' ? (demo ? DEMO_SEAT_BONUS : SEAT_BONUS) : 0,
    });
    const tipsOn = data.get('tips') === 'on';
    // riattivando i consigli si ricomincia da capo
    if (tipsOn && !tutorial.on) tutorial.seen.clear();
    tutorial.on = tipsOn;
    saveTutorial();
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
    ${tradeDraft ? renderTradeEditor(s, tradeDraft) : `<div class="actions">${renderTurnActions(s)}</div>`}
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
  const [icon, label] = SKY_LABELS[skyMode];
  const sky = viewMode === '3d'
    ? `<button data-action="sky" aria-label="Cielo: ${label}" title="Cielo: ${label}">${icon}<span class="lbl"> ${label}</span></button>`
    : '';
  return cam + sky + toggle + soundButtons();
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
      () => {
        // grafica 3D persa: si ricrea la scena con lo stato attuale (la partita non si ferma)
        destroy3d();
        setTimeout(() => {
          if (state && viewMode === '3d' && !board3d) render();
        }, 300);
      },
    );
    board3d.cameraMode = cameraMode;
    board3d.skyMode = skyMode;
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
    // partita appena finita: il risultato entra nella classifica tra amici
    if (prev.phase !== 'gameOver' && state.phase === 'gameOver') {
      writePref(LEADERBOARD_KEY, JSON.stringify(addResult(loadLeaderboard(), state, ctx)));
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
    case 'tipOk':
      tutorial.seen.add(target.dataset.tip ?? '');
      saveTutorial();
      return render();
    case 'tipOff':
      tutorial.on = false;
      saveTutorial();
      return render();
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
    case 'sky':
      skyMode = skyMode === 'cycle' ? 'day' : skyMode === 'day' ? 'night' : 'cycle';
      writePref(SKY_KEY, skyMode);
      if (board3d) board3d.skyMode = skyMode;
      return render();
    case 'camera':
      cameraMode = cameraMode === 'follow' ? 'overview' : 'follow';
      if (board3d) board3d.cameraMode = cameraMode;
      return render();
    case 'newGame':
    case 'quit':
      if (action === 'quit' && !confirmTwice(target)) return;
      cancelBot();
      state = null;
      selected = null;
      error = '';
      save();
      return render();
    case 'coverDebt':
      return coverDebt();
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
// Vende case e ipoteca, come farebbe il computer, finché il debito è coperto.
function coverDebt(): void {
  if (!state) return;
  newsFrom = state.eventCount ?? 0;
  lastActorBot = false;
  let s = state;
  for (let i = 0; i < 200 && s.players[s.current].money < 0; i++) {
    const step = raiseMoney(s, ctx);
    if (!step) break;
    s = applyAction(s, step, ctx);
  }
  state = s;
  error = '';
  audio.play('coin');
  save();
  render();
}

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
  ? [...new Set((state ? state.players.map((p) => p.appearance?.character) : setupLooks.slice(0, SEATS_SHOWN).map((l) => l.character)).filter((c): c is string => !!c))]
  : [];
void runLoading(
  neededCharacters.map((id) => ({
    label: `${characterDef(id).emoji} ${characterDef(id).label} pronto`,
    run: () => loadModel(id),
  })),
);

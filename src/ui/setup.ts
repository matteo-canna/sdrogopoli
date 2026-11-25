// Schermata iniziale: chi gioca, personaggi, regole della casa e classifica tra amici.
import { board } from '../data';
import { DEMO_MAX_PLAYERS, DEMO_ROUNDS, DEMO_SEAT_BONUS, MAX_PLAYERS, MIN_PLAYERS, QUICK_START_PROPERTIES, QUICK_START_TWO_PLAYERS, SEAT_BONUS, demoRules, type Appearance, type GameRules, type PlayerSetup } from '../engine';
import { webglAvailable } from './three/board3d';
import { CharacterPreview } from './three/characters3d';
import { renderIntro } from './intro';
import { version } from '../../package.json';
import { renderLeaderboard } from './summary';
import { CHARACTERS, COLOR_CHOICES, COLOR_NAMES, characterDef, defaultAppearance } from './characters';
import { KEYS, loadLeaderboard, readPref, saveLeaderboard, writePref } from './prefs';

// posti nella schermata iniziale: i primi 4 si vedono subito, gli altri con "Aggiungi giocatore"
// (oltre l'8° solo nella modalità demo)
const SEATS = Array.from({ length: DEMO_MAX_PLAYERS }, (_, i) => i);
export const SEATS_SHOWN = 4;

// Cosa ha scelto chi prepara la partita.
export interface SetupChoice {
  players: PlayerSetup[];
  rules: Partial<GameRules>;
  tipsOn: boolean;
}

// aspetto scelto per ciascuno dei posti nella schermata iniziale (ricordato per la prossima partita)
export const setupLooks: Appearance[] = loadLooks();
// posto di cui si sta modificando l'aspetto (null = editor chiuso)
let editingSeat: number | null = null;
let preview: CharacterPreview | null = null;

function loadLooks(): Appearance[] {
  let saved: Partial<Appearance>[] = [];
  try {
    saved = JSON.parse(readPref(KEYS.looks) ?? '[]');
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

export function destroyPreview(): void {
  preview?.dispose();
  preview = null;
}

// Ridisegna solo i pulsanti dei personaggi e l'editor, senza toccare i nomi già scritti.
function refreshLooks(): void {
  writePref(KEYS.looks, JSON.stringify(setupLooks));
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

// Partita salvata da proporre in cima alla schermata.
export interface ResumeOffer {
  summary: string;
  onContinue: () => void;
}

export function renderSetup(app: HTMLElement, tipsOn: boolean, onStart: (choice: SetupChoice) => void, resume?: ResumeOffer): void {
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
      ${resume ? `<section class="card resume" aria-labelledby="resume-title">
        <h2 id="resume-title">Partita in corso</h2>
        ${resume.summary}
        <div class="resume-buttons">
          <button type="button" class="primary" data-resume>▶ Continua la partita</button>
          <button type="button" data-new-game>Nuova partita</button>
        </div>
      </section>` : ''}
      <form id="setup-form" class="card" ${resume ? 'hidden' : ''}>
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
          <label class="check"><input type="checkbox" name="tips" ${tipsOn ? 'checked' : ''}> Consigli durante la partita (utile la prima volta)</label>
          <label class="check"><input type="checkbox" name="quick"> Partita rapida: ognuno parte con ${QUICK_START_PROPERTIES} proprietà a caso (${QUICK_START_TWO_PLAYERS} se si è in due, meno se si è in tanti: le proprietà sono ${board.spaces.filter((sp) => sp.type === 'property').length})</label>
          <label class="check"><input type="checkbox" name="bonus" checked> Chi gioca dopo parte con ${board.currency.symbol} <span data-bonus-amount>${SEAT_BONUS}</span> in più per ogni posto (compensa il vantaggio di chi inizia)</label>
          <label class="check"><input type="checkbox" name="pot"> Montepremi: tasse e multe vanno sulla Panchina del Parco e chi ci arriva le incassa</label>
        </details>
        <p class="hint" data-quick-note hidden>⚡ In due è attiva la partita rapida (${QUICK_START_TWO_PLAYERS} proprietà a testa): dura circa la metà. Si cambia nelle regole della casa.</p>
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
    saveLeaderboard([]);
    document.querySelector('#leaderboard-slot')!.innerHTML = '';
  });
  const form = document.querySelector<HTMLFormElement>('#setup-form')!;
  if (resume) {
    const box = document.querySelector<HTMLElement>('.resume')!;
    box.querySelector('[data-resume]')!.addEventListener('click', resume.onContinue);
    box.querySelector('[data-new-game]')!.addEventListener('click', () => {
      // la partita salvata resta finché non se ne inizia un'altra
      box.querySelector('h2')!.textContent = 'Partita salvata';
      box.querySelector('[data-new-game]')!.remove();
      box.querySelector<HTMLElement>('[data-resume]')!.classList.remove('primary');
      form.hidden = false;
      form.querySelector<HTMLInputElement>('input[name=p0]')?.focus();
    });
    (box.querySelector('[data-resume]') as HTMLElement).focus();
  }
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
    syncQuick();
  };
  // In due si propone la partita rapida (finché la persona non sceglie da sé)
  const quick = form.querySelector<HTMLInputElement>('input[name=quick]')!;
  let quickTouched = false;
  quick.addEventListener('change', () => (quickTouched = true));
  const syncQuick = () => {
    if (quickTouched) return;
    const named = [...form.querySelectorAll<HTMLInputElement>('.setup-row:not([hidden]) input[name^=p]')].filter((i) => i.value.trim()).length;
    quick.checked = named === 2;
    form.querySelector<HTMLElement>('[data-quick-note]')!.hidden = named !== 2;
  };
  form.addEventListener('input', (e) => {
    if ((e.target as HTMLElement).matches('input[name^=p]')) syncQuick();
  });
  syncQuick();
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
    destroyPreview();
    editingSeat = null;
    onStart({
      players,
      rules: {
        ...(demo ? demoRules() : {}),
        startingMoney: Number(data.get('money')) || board.startingMoney,
        maxRounds: rounds,
        parkPot: data.get('pot') === 'on',
        quickStart: data.get('quick') === 'on',
        seatBonus: data.get('bonus') === 'on' ? (demo ? DEMO_SEAT_BONUS : SEAT_BONUS) : 0,
      },
      tipsOn: data.get('tips') === 'on',
    });
  });
}

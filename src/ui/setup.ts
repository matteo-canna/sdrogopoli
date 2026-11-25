// Schermata iniziale: chi gioca, personaggi, regole della casa e classifica tra amici.
import { board } from '../data';
import { BOT_LEVELS, BOT_STYLES, PRESETS, estimatedMinutes, type BotStyle, DEMO_MAX_PLAYERS, DEMO_ROUNDS, DEMO_SEAT_BONUS, MAX_PLAYERS, MIN_PLAYERS, QUICK_START_PROPERTIES, QUICK_START_TWO_PLAYERS, SEAT_BONUS, demoRules, type Appearance, type GameRules, type PlayerSetup } from '../engine';
import { webglAvailable } from './webgl';
import { load3d } from './lazy3d';
import { reportUrl } from './report';
import { FILE_EXT, MAX_SLOTS, type Slot } from './slots';
import { escapeHtml } from './view';
import type { CharacterPreview } from './three/characters3d';
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
    const seat = editingSeat;
    // three.js si scarica la prima volta che si apre l'anteprima
    void load3d()
      .then((m) => {
        // nel frattempo l'editor potrebbe essere stato chiuso o cambiato
        if (editingSeat !== seat || !box.isConnected) return;
        // l'anteprima 3D resta la stessa: si sposta nel nuovo editor
        if (preview) preview.moveTo(box);
        else preview = new m.CharacterPreview(box);
        void preview.show(setupLooks[seat]);
      })
      .catch(() => {
        box.innerHTML = `<span class="look-emoji">${characterDef(setupLooks[seat].character).emoji}</span>`;
      });
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

// Partite salvate con un nome e file da importare.
export interface SlotsOffer {
  list: Slot[];
  onLoad: (id: string) => void;
  onExport: (id: string) => void;
  onDelete: (id: string) => void;
  // false se il file non è una partita di Sdrogopoli
  onImport: (file: File) => Promise<boolean>;
}

function slotsHtml(list: Slot[]): string {
  const items = list
    .map(
      (sl) => `<li class="slot">
        <div class="slot-info"><strong>${escapeHtml(sl.name)}</strong>
          <small>${escapeHtml(sl.summary)} · ${new Date(sl.date).toLocaleString('it-IT', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</small></div>
        <div class="slot-buttons">
          <button type="button" data-slot-load="${sl.id}">▶ Gioca</button>
          <button type="button" data-slot-export="${sl.id}" aria-label="Esporta ${escapeHtml(sl.name)}">⬇️</button>
          <button type="button" data-slot-delete="${sl.id}" aria-label="Elimina ${escapeHtml(sl.name)}">🗑️</button>
        </div>
      </li>`,
    )
    .join('');
  return `${list.length ? `<h2 id="slots-title">Partite salvate <small>(${list.length} di ${MAX_SLOTS})</small></h2><ul class="slot-list">${items}</ul>` : '<h2 id="slots-title" class="visually-hidden">Partite salvate</h2>'}
    <label class="import-file">📂 Apri una partita da un file ${FILE_EXT}<input type="file" accept="${FILE_EXT},.json,application/json" data-import></label>
    <p class="slot-msg" role="status" aria-live="polite"></p>`;
}

// Partita salvata da proporre in cima alla schermata.
export interface ResumeOffer {
  summary: string;
  onContinue: () => void;
}

// Gioco online: creare un tavolo o entrare con un codice.
export interface OnlineOffer {
  onCreate: () => void;
  // false se il codice non è valido
  onJoin: (code: string) => boolean;
}

function onlineHtml(): string {
  return `<section class="card online-card" aria-labelledby="online-title">
        <h2 id="online-title">🌐 Gioca online con gli amici</h2>
        <p>Ognuno dal suo telefono o computer, gratis e senza account. Chi crea il tavolo manda il link agli altri.</p>
        <div class="online-buttons">
          <button type="button" class="primary" data-online-create>Crea un tavolo</button>
          <form class="online-join" data-online-join>
            <label for="online-code">Hai un codice?</label>
            <div class="slot-row">
              <input id="online-code" name="code" maxlength="9" autocomplete="off" autocapitalize="characters" spellcheck="false" placeholder="ABC234">
              <button type="submit">Entra</button>
            </div>
          </form>
        </div>
        <p class="error" role="alert" data-online-error hidden>Il codice ha 6 caratteri, lettere e numeri. Controllalo e riprova.</p>
      </section>`;
}

// Obiettivo scelto nel menu → regole.
function goalRules(goal: string): Partial<GameRules> {
  const worth = /worth(\d+)/.exec(goal)?.[1];
  const groups = /groups(\d)/.exec(goal)?.[1];
  return { goalWorth: worth ? Number(worth) : null, goalGroups: groups ? Number(groups) : null, goalSide: goal === 'side' };
}

function goalValue(r: Partial<GameRules>): string {
  if (r.goalSide) return 'side';
  return `${r.goalGroups ? `groups${r.goalGroups}` : ''}${r.goalWorth ? `worth${r.goalWorth}` : ''}`;
}

export function renderSetup(app: HTMLElement, tipsOn: boolean, onStart: (choice: SetupChoice) => void, resume?: ResumeOffer, slots?: SlotsOffer, online?: OnlineOffer): void {
  destroyPreview();
  editingSeat = null;
  app.innerHTML = `
    <main class="setup">
      <header class="brand">
        <div class="brand-strip" aria-hidden="true">${board.groups.map((g) => `<span style="background:${g.color}"></span>`).join('')}</div>
        <h1>Sdrogopoli</h1>
        <p>Compra le vie della città, costruisci case e manda in rovina gli amici. Da ${MIN_PLAYERS} a ${MAX_PLAYERS} giocatori sullo stesso dispositivo (fino a ${DEMO_MAX_PLAYERS} nella modalità demo) oppure online, ognuno dal suo.</p>
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
      ${slots ? `<section class="card saved-games" aria-labelledby="slots-title">${slotsHtml(slots.list)}</section>` : ''}
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
                ${BOT_LEVELS.map((l) => `<option value="${l.id}" ${i > 0 && l.id === 'normale' ? 'selected' : ''}>🤖 Computer ${l.label.toLowerCase()}</option>`).join('')}
              </select></div>`,
          )
          .join('')}
        <button type="button" class="add-seat" data-add-seat>➕ Aggiungi giocatore <small>(fino a <span data-seat-max>${MAX_PLAYERS}</span>)</small></button>
        <label class="check demo-toggle"><input type="checkbox" name="demo">
          <span><strong>🧪 Modalità demo</strong> <span class="badge-demo">sperimentale</span><br>
          <small>Fino a ${DEMO_MAX_PLAYERS} giocatori. Per non aspettare troppo il proprio turno la partita dura ${DEMO_ROUNDS} giri (vince il patrimonio più alto) e il bonus del posto scende a ${board.currency.symbol} ${DEMO_SEAT_BONUS}.</small></span></label>
        <fieldset class="presets">
          <legend>Tipo di partita</legend>
          <div class="preset-list" role="radiogroup">
            ${PRESETS.map((p, i) => `<label class="preset"><input type="radio" name="preset" value="${p.id}" ${i === 0 ? 'checked' : ''}><span><strong>${p.label}</strong><small>${p.text}</small></span></label>`).join('')}
            <label class="preset"><input type="radio" name="preset" value="custom"><span><strong>Personalizzata</strong><small>Scegli tu nelle regole della casa.</small></span></label>
          </div>
          <p class="hint" data-duration aria-live="polite"></p>
        </fieldset>
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
          <label>Carattere dei computer
            <select name="styles">
              <option value="mix">A sorpresa: ognuno il suo</option>
              ${BOT_STYLES.map((x) => `<option value="${x.id}">Tutti ${x.label.toLowerCase()} (${x.text})</option>`).join('')}
            </select>
          </label>
          <label class="check"><input type="checkbox" name="tips" ${tipsOn ? 'checked' : ''}> Consigli durante la partita (utile la prima volta)</label>
          <label class="check"><input type="checkbox" name="quick"> Partita rapida: ognuno parte con ${QUICK_START_PROPERTIES} proprietà a caso (${QUICK_START_TWO_PLAYERS} se si è in due, meno se si è in tanti: le proprietà sono ${board.spaces.filter((sp) => sp.type === 'property').length})</label>
          <label class="check"><input type="checkbox" name="bonus" checked> Chi gioca dopo parte con ${board.currency.symbol} <span data-bonus-amount>${SEAT_BONUS}</span> in più per ogni posto (compensa il vantaggio di chi inizia)</label>
          <label class="check"><input type="checkbox" name="sprint"> 🎲 Dado Sprint: un terzo dado con passi in più, "Occasione" (si prosegue fino alla prossima proprietà in vendita) e "Affitto pieno" (+50%)</label>
          <label>Obiettivo per vincere prima
            <select name="goal">
              <option value="">Nessuno</option>
              <option value="worth3000">Patrimonio di ${board.currency.symbol} 3000</option>
              <option value="worth4000">Patrimonio di ${board.currency.symbol} 4000</option>
              <option value="groups2">2 quartieri completi</option>
              <option value="groups3">3 quartieri completi</option>
              <option value="groups2worth4000">2 quartieri o ${board.currency.symbol} 4000</option>
              <option value="side">Un lato intero del tabellone</option>
            </select>
          </label>
          <label class="check"><input type="checkbox" name="pot"> Montepremi: tasse e multe vanno sulla Panchina del Parco e chi ci arriva le incassa</label>
        </details>
        <p class="hint" data-quick-note hidden>⚡ In due è attiva la partita rapida (${QUICK_START_TWO_PLAYERS} proprietà a testa): dura circa la metà. Si cambia nelle regole della casa.</p>
        <button class="primary" type="submit">Inizia la partita</button>
      </form>
      ${online ? onlineHtml() : ''}
      <div id="leaderboard-slot">${renderLeaderboard(loadLeaderboard())}</div>
      </div>
      <aside class="setup-info">${renderIntro()}</aside>
      </div>
      <footer class="credits">
        <p>🆓 Gratis, senza pubblicità e senza account. Le partite restano su questo dispositivo.</p>
        <p>Personaggi 3D: <a href="https://kaylousberg.com" target="_blank" rel="noopener">KayKit di Kay Lousberg</a> (CC0) · Versione ${version} · <button type="button" class="link" data-credits>Crediti e licenze</button> · <a href="${reportUrl(null, 'iniziale')}" target="_blank" rel="noopener">Segnala un problema</a></p>
      </footer>
      <dialog class="credits-dialog" aria-labelledby="credits-title">
        <h2 id="credits-title">Crediti e licenze</h2>
        <p>Sdrogopoli è un gioco originale e gratuito: niente pubblicità, niente acquisti, niente account. Le partite e le preferenze restano solo su questo dispositivo; online, la partita passa direttamente tra i dispositivi al tavolo.</p>
        <h3>Cosa c'è dentro</h3>
        <ul>
          <li><strong>Tabellone, nomi, carte, icone, suoni e musica</strong>: originali di Sdrogopoli. I suoni e la musica si generano al momento nel browser.</li>
          <li><strong>Personaggi 3D</strong>: <a href="https://kaylousberg.com" target="_blank" rel="noopener">KayKit Adventurers di Kay Lousberg</a>, licenza CC0 (pubblico dominio).</li>
          <li><strong>Grafica 3D</strong>: <a href="https://threejs.org" target="_blank" rel="noopener">three.js</a>, licenza MIT.</li>
          <li><strong>Gioco online</strong>: <a href="https://github.com/dmotz/trystero" target="_blank" rel="noopener">Trystero</a>, licenza MIT. I dispositivi si collegano direttamente tra loro; per trovarsi usano relay Nostr pubblici e gratuiti.</li>
        </ul>
        <p><a href="${import.meta.env.BASE_URL}licenze.txt" target="_blank" rel="noopener">Testo completo delle licenze</a> · <a href="https://github.com/matteo-canna/sdrogopoli" target="_blank" rel="noopener">Codice sorgente</a></p>
        <form method="dialog"><button class="primary">Chiudi</button></form>
      </dialog>
    </main>`;
  document.querySelector('#leaderboard-slot')!.addEventListener('click', (e) => {
    if (!(e.target as HTMLElement).closest('[data-reset-leaderboard]')) return;
    saveLeaderboard([]);
    document.querySelector('#leaderboard-slot')!.innerHTML = '';
  });
  document.querySelector('[data-credits]')!.addEventListener('click', () => document.querySelector<HTMLDialogElement>('.credits-dialog')!.showModal());
  const form = document.querySelector<HTMLFormElement>('#setup-form')!;
  const onlineBox = document.querySelector<HTMLElement>('.online-card');
  if (online && onlineBox) {
    onlineBox.querySelector('[data-online-create]')!.addEventListener('click', () => {
      destroyPreview();
      online.onCreate();
    });
    onlineBox.querySelector('[data-online-join]')!.addEventListener('submit', (e) => {
      e.preventDefault();
      const code = String(new FormData(e.target as HTMLFormElement).get('code') ?? '');
      destroyPreview();
      onlineBox.querySelector<HTMLElement>('[data-online-error]')!.hidden = online.onJoin(code);
    });
  }
  const savedBox = document.querySelector<HTMLElement>('.saved-games');
  if (slots && savedBox) {
    let list = slots.list;
    savedBox.addEventListener('click', (e) => {
      const b = (e.target as HTMLElement).closest<HTMLButtonElement>('button');
      if (!b) return;
      if (b.dataset.slotLoad) slots.onLoad(b.dataset.slotLoad);
      else if (b.dataset.slotExport) slots.onExport(b.dataset.slotExport);
      else if (b.dataset.slotDelete) {
        // eliminare non si annulla: il primo tocco chiede conferma
        if (b.dataset.confirm !== 'yes') {
          b.dataset.confirm = 'yes';
          b.textContent = 'Elimina?';
          return;
        }
        slots.onDelete(b.dataset.slotDelete);
        list = list.filter((x) => x.id !== b.dataset.slotDelete);
        savedBox.innerHTML = slotsHtml(list);
      }
    });
    savedBox.addEventListener('change', async (e) => {
      const input = e.target as HTMLInputElement;
      if (!input.matches('[data-import]') || !input.files?.[0]) return;
      const ok = await slots.onImport(input.files[0]);
      if (!ok) savedBox.querySelector('.slot-msg')!.textContent = `Questo file non è una partita di Sdrogopoli (o è di una versione più nuova).`;
      input.value = '';
    });
  }
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
    // in due si propone la partita rapida anche tra i tipi di partita
    const preset = form.querySelector<HTMLInputElement>('input[name=preset]:checked')?.value;
    if (preset === 'classica' || preset === 'rapida') form.querySelector<HTMLInputElement>(`input[name=preset][value=${named === 2 ? 'rapida' : 'classica'}]`)!.checked = true;
  };
  form.addEventListener('input', (e) => {
    if ((e.target as HTMLElement).matches('input[name^=p]')) syncQuick();
  });
  syncQuick();
  // Tipo di partita: imposta le regole della casa; cambiandole a mano diventa "Personalizzata"
  const field = <T extends HTMLElement>(name: string) => form.querySelector<T>(`[name=${name}]`)!;
  const applyPreset = (id: string) => {
    const p = PRESETS.find((x) => x.id === id);
    if (!p) return;
    const r = p.rules;
    field<HTMLSelectElement>('rounds').value = r.maxRounds ? String(r.maxRounds) : '';
    field<HTMLInputElement>('quick').checked = !!r.quickStart;
    quickTouched = true;
    field<HTMLInputElement>('sprint').checked = !!r.sprintDie;
    field<HTMLSelectElement>('goal').value = goalValue(r);
    field<HTMLInputElement>('pot').checked = false;
    showDuration();
  };
  const showDuration = () => {
    const id = form.querySelector<HTMLInputElement>('input[name=preset]:checked')?.value;
    const p = PRESETS.find((x) => x.id === id);
    const out = form.querySelector<HTMLElement>('[data-duration]')!;
    if (!p) {
      out.textContent = 'Durata: dipende dalle regole scelte.';
      return;
    }
    const rows = [...form.querySelectorAll<HTMLElement>('.setup-row:not([hidden])')];
    const named = rows.filter((r) => r.querySelector<HTMLInputElement>('input[name^=p]')!.value.trim());
    const bots = named.filter((r) => r.querySelector<HTMLSelectElement>('select')!.value !== 'human').length;
    const people = Math.max(1, named.length - bots);
    out.textContent = `⏱ Circa ${p.rounds} giri: con ${people} ${people === 1 ? 'persona' : 'persone'}${bots ? ` e ${bots} ${bots === 1 ? 'computer' : 'computer'}` : ''} circa ${estimatedMinutes(p, people, bots)} minuti.`;
  };
  form.addEventListener('change', (e) => {
    const t = e.target as HTMLInputElement;
    if (t.name === 'preset') applyPreset(t.value);
    else if (['rounds', 'quick', 'sprint', 'goal', 'pot', 'money'].includes(t.name)) {
      form.querySelector<HTMLInputElement>('input[name=preset][value=custom]')!.checked = true;
      showDuration();
    } else if (t.matches('select[name^=t]')) showDuration();
  });
  form.addEventListener('input', (e) => {
    if ((e.target as HTMLElement).matches('input[name^=p]')) showDuration();
  });
  showDuration();
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
      .map((i) => {
        const kind = String(data.get(`t${i}`) ?? 'human');
        const level = BOT_LEVELS.find((l) => l.id === kind)?.id;
        return { name: String(data.get(`p${i}`) ?? '').trim(), isBot: !!level, appearance: setupLooks[i], ...(level ? { bot: { level, style: 'equilibrato' as BotStyle } } : {}) };
      })
      .filter((p) => p.name);
    // carattere dei computer: uguale per tutti, o diverso per ciascuno (in ordine sparso)
    const styleChoice = String(data.get('styles') ?? 'mix');
    const mixed = [...BOT_STYLES.map((x) => x.id)].sort(() => Math.random() - 0.5);
    players.filter((p) => p.bot).forEach((p, n) => (p.bot!.style = styleChoice === 'mix' ? mixed[n % mixed.length] : (styleChoice as BotStyle)));
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
        sprintDie: data.get('sprint') === 'on',
        ...goalRules(String(data.get('goal') ?? '')),
        seatBonus: data.get('bonus') === 'on' ? (demo ? DEMO_SEAT_BONUS : SEAT_BONUS) : 0,
      },
      tipsOn: data.get('tips') === 'on',
    });
  });
}

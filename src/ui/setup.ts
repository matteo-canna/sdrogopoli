// Schermata iniziale: chi gioca, personaggi, regole della casa e classifica tra amici.
import { BOARDS, DEFAULT_BOARD, board, currentBoard, setBoard } from '../data';
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
import { CHARACTERS, COLOR_CHOICES, colorName, itemName, characterDef, defaultAppearance } from './characters';
import { getLang, t, tn, type MsgKey } from '../i18n';
import { KEYS, loadLeaderboard, loadProgress, parseProgress, readPref, saveLeaderboard, savePreset, saveProgress, writePref } from './prefs';
import { ACHIEVEMENTS, achievementText, achievementTitle, EXTRA_COLORS, titleLabel, unlockedColors, unlockedTitles } from './achievements';
import { downloadProfile, parseProfileFile, mergeProgress, profileRows, PROFILE_EXT } from './profile';
import { DAILY_ROUNDS, dailyPlayers, dailySeed, dailyText, dayId, parseDaily } from './daily';
import { openSettings } from './settings';
import { audio } from './audio';

// posti nella schermata iniziale: i primi 4 si vedono subito, gli altri con "Aggiungi giocatore"
// (oltre l'8° solo nella modalità demo)
const SEATS = Array.from({ length: DEMO_MAX_PLAYERS }, (_, i) => i);
export const SEATS_SHOWN = 4;

// Cosa ha scelto chi prepara la partita.
export interface SetupChoice {
  players: PlayerSetup[];
  rules: Partial<GameRules>;
  tipsOn: boolean;
  // seme fissato (partita del giorno) e giorno a cui appartiene
  seed?: number;
  daily?: string;
  // tabellone scelto (id in src/data/boards.ts)
  boardId?: string;
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

function propertyCount(): number {
  return board.spaces.filter((sp) => sp.type === 'property').length;
}

// ---------- schermata iniziale ----------

function lookButton(i: number): string {
  const look = setupLooks[i];
  const def = characterDef(look.character);
  return `<button type="button" class="look-btn" data-look="${i}" style="--c:${look.color}" aria-expanded="${editingSeat === i}"
    title="${t('look.choose')}" aria-label="${t('look.seatLabel', { n: i + 1, name: def.label })}">${def.emoji}</button>`;
}

// Editor dell'aspetto: personaggio, colore, copricapo, mantello e oggetto in mano.
function lookEditorHtml(i: number): string {
  const look = setupLooks[i];
  const def = characterDef(look.character);
  return `
    <div class="look-editor" style="--c:${look.color}">
      <div class="look-preview" id="look-preview">${webglAvailable() ? '' : `<span class="look-emoji">${def.emoji}</span>`}</div>
      <div class="look-controls">
        <div class="look-group" role="radiogroup" aria-label="${t('look.character')}">
          ${CHARACTERS.map((c) => `<button type="button" class="chip-btn" role="radio" aria-checked="${c.id === look.character}" data-character="${c.id}">${c.emoji} ${c.label}</button>`).join('')}
        </div>
        <div class="look-group swatches" role="radiogroup" aria-label="${t('look.color')}">
          ${[...COLOR_CHOICES, ...unlockedColors(loadProgress().unlocked).map((c) => c.hex)]
            .map((col) => `<button type="button" class="swatch" role="radio" aria-checked="${col === look.color}" data-color="${col}" style="background:${col}" title="${colorName(col)}" aria-label="${colorName(col)}"></button>`)
            .join('')}
        </div>
        ${def.hat ? `<label class="check"><input type="checkbox" data-hat ${look.hat ? 'checked' : ''}> ${t('look.hat')}</label>` : ''}
        <label class="check"><input type="checkbox" data-cape ${look.cape ? 'checked' : ''}> ${t('look.cape')}</label>
        <label class="hold">${t('look.inHand')}
          <select data-item>
            <option value="">${t('look.nothing')}</option>
            ${Object.keys(def.items).map((id) => `<option value="${id}" ${id === look.item ? 'selected' : ''}>${itemName(id)}</option>`).join('')}
          </select>
        </label>
        <button type="button" class="primary" data-look-done>${t('btn.done')}</button>
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
          <small>${escapeHtml(sl.summary)} · ${new Date(sl.date).toLocaleString(getLang() === 'it' ? 'it-IT' : 'en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</small></div>
        <div class="slot-buttons">
          <button type="button" data-slot-load="${sl.id}">▶ ${t('slots.play')}</button>
          <button type="button" data-slot-export="${sl.id}" aria-label="${t('slots.export', { name: escapeHtml(sl.name) })}">⬇️</button>
          <button type="button" data-slot-delete="${sl.id}" aria-label="${t('slots.delete', { name: escapeHtml(sl.name) })}">🗑️</button>
        </div>
      </li>`,
    )
    .join('');
  return `${list.length ? `<h2 id="slots-title">${t('slots.title')} <small>(${t('slots.count', { n: list.length, max: MAX_SLOTS })})</small></h2><ul class="slot-list">${items}</ul>` : `<h2 id="slots-title" class="visually-hidden">${t('slots.title')}</h2>`}
    <label class="import-file">📂 ${t('slots.import', { ext: FILE_EXT })}<input type="file" accept="${FILE_EXT},.json,application/json" data-import></label>
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
        <h2 id="online-title">🌐 ${t('setup.onlineTitle')}</h2>
        <p>${t('setup.onlineText')}</p>
        <div class="online-buttons">
          <button type="button" class="primary" data-online-create>${t('setup.createTable')}</button>
          <form class="online-join" data-online-join>
            <label for="online-code">${t('setup.haveCode')}</label>
            <div class="slot-row">
              <input id="online-code" name="code" maxlength="9" autocomplete="off" autocapitalize="characters" spellcheck="false" placeholder="ABC234">
              <button type="submit">${t('setup.join')}</button>
            </div>
          </form>
        </div>
        <p class="error" role="alert" data-online-error hidden>${t('setup.badCode')}</p>
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

// Riquadro della partita del giorno: stessa partita per tutti, con il risultato di oggi se c'è già.
export function renderDaily(): string {
  const day = dayId();
  const done = parseDaily(readPref(KEYS.daily));
  const mine = done && done.day === day ? done : null;
  return `<section class="daily-card">
      <h2>📅 ${t('daily.title')} · ${day}</h2>
      <p>${t('daily.text')}</p>
      ${mine ? `<p class="daily-result">${t('daily.yours', { place: mine.place, players: mine.players, amount: `${board.currency.symbol} ${mine.worth}` })}</p>` : ''}
      <div class="daily-buttons">
        <button type="button" class="primary" data-daily-play>${mine ? t('daily.again') : t('daily.play')}</button>
        ${mine ? `<button type="button" data-daily-copy>${t('daily.copy')}</button>` : ''}
      </div>
      <p class="hint" data-daily-msg hidden></p>
    </section>`;
}

// Pannello dei traguardi: quelli raggiunti, quelli da raggiungere e il titolo da indossare.
export function renderGoals(): string {
  const p = loadProgress();
  const have = new Set(p.unlocked);
  const rows = ACHIEVEMENTS.map((a) => {
    const done = have.has(a.id);
    const prize = a.unlock.kind === 'color' ? t('goals.prizeColor', { name: colorName(EXTRA_COLORS[a.unlock.id]) }) : t('goals.prizeTitle', { name: titleLabel(a.unlock.id) });
    return `<li class="goal ${done ? 'done' : ''}"><span class="goal-icon">${done ? a.icon : '🔒'}</span>
      <div><strong>${escapeHtml(achievementTitle(a.id))}</strong><br><small>${escapeHtml(achievementText(a.id))} · ${escapeHtml(prize)}</small></div></li>`;
  }).join('');
  const titles = unlockedTitles(p.unlocked);
  const chooser = titles.length
    ? `<label class="hold">${t('goals.title')}
        <select data-title>
          <option value="">${t('goals.noTitle')}</option>
          ${titles.map((id) => `<option value="${id}" ${id === p.title ? 'selected' : ''}>${escapeHtml(titleLabel(id))}</option>`).join('')}
        </select>
      </label>`
    : `<p class="hint">${t('goals.none')}</p>`;
  const stats = profileRows(p.profile, (n) => `${board.currency.symbol} ${n}`)
    .map((r) => `<li><span>${escapeHtml(r.label)}</span><strong>${escapeHtml(r.value)}</strong></li>`)
    .join('');
  return `<details class="goals">
      <summary>🎖️ ${t('goals.title2', { done: have.size, all: ACHIEVEMENTS.length })}</summary>
      <h4>${t('profile.title')}</h4>
      <ul class="profile-stats">${stats}</ul>
      <div class="profile-buttons">
        <button type="button" data-profile-export>${t('profile.export')}</button>
        <label class="file-label">${t('profile.import')}<input type="file" accept="${PROFILE_EXT},application/json" data-profile-import hidden></label>
      </div>
      <p class="hint">${t('profile.hint')}</p>
      <p class="profile-msg" data-profile-msg hidden></p>
      ${chooser}
      <ul class="goal-list">${rows}</ul>
    </details>`;
}

export function renderSetup(app: HTMLElement, tipsOn: boolean, onStart: (choice: SetupChoice) => void, resume?: ResumeOffer, slots?: SlotsOffer, online?: OnlineOffer): void {
  destroyPreview();
  editingSeat = null;
  app.innerHTML = `
    <main class="setup">
      <header class="brand">
        <div class="brand-strip" aria-hidden="true">${board.groups.map((g) => `<span style="background:${g.color}"></span>`).join('')}</div>
        <h1>Sdrogopoli</h1>
        <p>${t('setup.tagline', { min: MIN_PLAYERS, max: MAX_PLAYERS, demo: DEMO_MAX_PLAYERS })}</p>
      </header>
      <div class="setup-grid">
      <div class="setup-main">
      ${resume ? `<section class="card resume" aria-labelledby="resume-title">
        <h2 id="resume-title">${t('setup.resumeTitle')}</h2>
        ${resume.summary}
        <div class="resume-buttons">
          <button type="button" class="primary" data-resume>▶ ${t('setup.continue')}</button>
          <button type="button" data-new-game>${t('btn.newGame')}</button>
        </div>
      </section>` : ''}
      ${slots ? `<section class="card saved-games" aria-labelledby="slots-title">${slotsHtml(slots.list)}</section>` : ''}
      <form id="setup-form" class="card" ${resume ? 'hidden' : ''}>
        <div class="form-head">
          <h2>${t('setup.whoPlays')}</h2>
          <p>${t('setup.whoPlaysHint')}</p>
        </div>
        ${SEATS
          .map(
            (i) => `<div class="setup-row" ${i >= SEATS_SHOWN ? 'hidden' : ''}>${lookButton(i)}
              <input name="p${i}" maxlength="16" aria-label="${t('setup.nameLabel', { n: i + 1 })}" placeholder="${t('setup.playerN', { n: i + 1 })}${i >= 2 ? ` ${t('setup.optional')}` : ''}" ${i < 2 ? `value="${i === 0 ? t('setup.playerN', { n: 1 }) : 'Computer'}"` : ''}>
              <select name="t${i}" aria-label="${t('setup.controlLabel', { n: i + 1 })}">
                <option value="human" ${i === 0 ? 'selected' : ''}>👤 ${t('setup.person')}</option>
                ${BOT_LEVELS.map((l) => `<option value="${l.id}" ${i > 0 && l.id === 'normale' ? 'selected' : ''}>🤖 ${t(`setup.computer.${l.id}` as MsgKey)}</option>`).join('')}
              </select></div>`,
          )
          .join('')}
        <button type="button" class="add-seat" data-add-seat>➕ ${t('setup.addSeat')} <small>(${t('setup.upTo', { n: `<span data-seat-max>${MAX_PLAYERS}</span>` })})</small></button>
        <label class="check demo-toggle"><input type="checkbox" name="demo">
          <span><strong>🧪 ${t('setup.demo')}</strong> <span class="badge-demo">${t('setup.experimental')}</span><br>
          <small>${t('setup.demoText', { n: DEMO_MAX_PLAYERS, rounds: DEMO_ROUNDS, bonus: `${board.currency.symbol} ${DEMO_SEAT_BONUS}` })}</small></span></label>
        ${BOARDS.length > 1 ? `
        <fieldset class="presets boards">
          <legend>${t('setup.board')}</legend>
          <div class="preset-list" role="radiogroup">
            ${BOARDS.map((b) => `<label class="preset"><input type="radio" name="board" value="${b.id}" ${b.id === currentBoard() ? 'checked' : ''}><span><strong>${t(`board.${b.id}` as MsgKey)}</strong><small>${t(`boardText.${b.id}` as MsgKey)}</small></span></label>`).join('')}
          </div>
        </fieldset>` : ''}
        <fieldset class="presets">
          <legend>${t('setup.gameType')}</legend>
          <div class="preset-list" role="radiogroup">
            ${PRESETS.map((p, i) => `<label class="preset"><input type="radio" name="preset" value="${p.id}" ${i === 0 ? 'checked' : ''}><span><strong>${t(`preset.${p.id}` as MsgKey)}</strong><small>${t(`presetText.${p.id}` as MsgKey)}</small></span></label>`).join('')}
            <label class="preset"><input type="radio" name="preset" value="custom"><span><strong>${t('preset.custom')}</strong><small>${t('presetText.custom')}</small></span></label>
          </div>
          <p class="hint" data-duration aria-live="polite"></p>
        </fieldset>
        <div id="look-slot"></div>
        <details class="house-rules">
          <summary>⚙️ ${t('rules.title')}</summary>
          <label>${t('rules.money')}
            <select name="money">${[1000, 1500, 2000, 2500].map((m) => `<option value="${m}" ${m === board.startingMoney ? 'selected' : ''}>${board.currency.symbol} ${m}</option>`).join('')}</select>
          </label>
          <label>Durata
            <select name="rounds">
              <option value="">${t('rules.untilLast')}</option>
              <option value="15">${t('rules.roundsShort', { n: 15 })}</option>
              <option value="${DEMO_ROUNDS}">${t('rules.rounds', { n: DEMO_ROUNDS })}</option>
              <option value="25">${t('rules.rounds', { n: 25 })}</option>
              <option value="40">${t('rules.rounds', { n: 40 })}</option>
            </select>
          </label>
          <label>${t('rules.styles')}
            <select name="styles">
              <option value="mix">${t('rules.stylesMix')}</option>
              ${BOT_STYLES.map((x) => `<option value="${x.id}">${t('rules.stylesAll', { style: t(`bot.style.${x.id}` as MsgKey).toLowerCase(), text: t(`bot.styleText.${x.id}` as MsgKey) })}</option>`).join('')}
            </select>
          </label>
          <label class="check"><input type="checkbox" name="tips" ${tipsOn ? 'checked' : ''}> ${t('rules.tips')}</label>
          <label class="check"><input type="checkbox" name="quick"> ${t('rules.quick', { n: QUICK_START_PROPERTIES, two: QUICK_START_TWO_PLAYERS, total: `<span data-board-props>${propertyCount()}</span>` })}</label>
          <label class="check"><input type="checkbox" name="bonus" checked> ${t('rules.bonus', { amount: `${board.currency.symbol} <span data-bonus-amount>${SEAT_BONUS}</span>` })}</label>
          <label class="check"><input type="checkbox" name="sprint"> 🎲 ${t('rules.sprint')}</label>
          <label>${t('rules.goal')}
            <select name="goal">
              <option value="">${t('rules.goalNone')}</option>
              <option value="worth3000">${t('rules.goalWorth', { amount: `${board.currency.symbol} 3000` })}</option>
              <option value="worth4000">${t('rules.goalWorth', { amount: `${board.currency.symbol} 4000` })}</option>
              <option value="groups2">${t('rules.goalGroups', { n: 2 })}</option>
              <option value="groups3">${t('rules.goalGroups', { n: 3 })}</option>
              <option value="groups2worth4000">${t('rules.goalBoth', { n: 2, amount: `${board.currency.symbol} 4000` })}</option>
              <option value="side">${t('rules.goalSide')}</option>
            </select>
          </label>
          <label class="check"><input type="checkbox" name="pot"> ${t('rules.pot')}</label>
          <label class="check"><input type="checkbox" name="teams"> ${t('rules.teams')}</label>
          <p class="hint">${t('rules.teamsHint')}</p>
        </details>
        <p class="hint" data-quick-note hidden>⚡ ${t('setup.quickNote', { n: QUICK_START_TWO_PLAYERS })}</p>
        <button class="primary" type="submit">${t('setup.start')}</button>
      </form>
      ${online ? onlineHtml() : ''}
      <div id="leaderboard-slot">${renderLeaderboard(loadLeaderboard())}</div>
      <div id="daily-slot">${renderDaily()}</div>
      <div id="goals-slot">${renderGoals()}</div>
      </div>
      <aside class="setup-info">${renderIntro()}</aside>
      </div>
      <footer class="credits">
        <p>🆓 ${t('footer.free')}</p>
        <p>${t('footer.characters')} <a href="https://kaylousberg.com" target="_blank" rel="noopener">KayKit ${t('credits.by')} Kay Lousberg</a> (CC0) · ${t('footer.version', { v: version })} · <button type="button" class="link" data-credits>${t('footer.credits')}</button> · <button type="button" class="link" data-settings>⚙️ ${t('settings.title')}</button> · <a href="${reportUrl(null, 'iniziale')}" target="_blank" rel="noopener">${t('report.link')}</a></p>
      </footer>
      <dialog class="credits-dialog" aria-labelledby="credits-title">
        <h2 id="credits-title">${t('footer.credits')}</h2>
        <p>${t('credits.intro')}</p>
        <h3>${t('credits.inside')}</h3>
        <ul>
          <li><strong>${t('credits.originalTitle')}</strong>: ${t('credits.original')}</li>
          <li><strong>${t('credits.charactersTitle')}</strong>: <a href="https://kaylousberg.com" target="_blank" rel="noopener">KayKit Adventurers ${t('credits.by')} Kay Lousberg</a>, ${t('credits.cc0')}</li>
          <li><strong>${t('credits.graphicsTitle')}</strong>: <a href="https://threejs.org" target="_blank" rel="noopener">three.js</a>, ${t('credits.mit')}</li>
          <li><strong>${t('credits.onlineTitle')}</strong>: <a href="https://github.com/dmotz/trystero" target="_blank" rel="noopener">Trystero</a>, ${t('credits.mit')} ${t('credits.online')}</li>
        </ul>
        <p><a href="${import.meta.env.BASE_URL}licenze.txt" target="_blank" rel="noopener">${t('credits.licenses')}</a> · <a href="https://github.com/matteo-canna/sdrogopoli" target="_blank" rel="noopener">${t('credits.source')}</a></p>
        <form method="dialog"><button class="primary">${t('btn.close')}</button></form>
      </dialog>
    </main>`;
  document.querySelector('#leaderboard-slot')!.addEventListener('click', (e) => {
    if (!(e.target as HTMLElement).closest('[data-reset-leaderboard]')) return;
    saveLeaderboard([]);
    document.querySelector('#leaderboard-slot')!.innerHTML = '';
  });
  document.querySelector('#daily-slot')!.addEventListener('click', async (e) => {
    const el = e.target as HTMLElement;
    const msg = document.querySelector<HTMLElement>('[data-daily-msg]')!;
    if (el.closest('[data-daily-play]')) {
      const name = form.querySelector<HTMLInputElement>('input[name=p0]')?.value.trim() || t('setup.playerN', { n: 1 });
      const day = dayId();
      destroyPreview();
      onStart({ players: dailyPlayers(name), rules: { maxRounds: DAILY_ROUNDS }, tipsOn: form.querySelector<HTMLInputElement>('input[name=tips]')?.checked ?? tipsOn, seed: dailySeed(day), daily: day, boardId: DEFAULT_BOARD });
      return;
    }
    if (el.closest('[data-daily-copy]')) {
      const done = parseDaily(readPref(KEYS.daily));
      if (!done) return;
      try {
        await navigator.clipboard.writeText(dailyText(done));
        msg.textContent = t('daily.copied');
      } catch {
        // senza permesso di copiare si mostra il testo, da copiare a mano
        msg.textContent = dailyText(done);
      }
      msg.hidden = false;
    }
  });
  const goalsBox = document.querySelector<HTMLElement>('#goals-slot')!;
  goalsBox.addEventListener('change', async (e) => {
    const target = e.target as HTMLElement;
    const sel = target.closest<HTMLSelectElement>('[data-title]');
    if (sel) {
      const p = loadProgress();
      saveProgress({ ...p, title: unlockedTitles(p.unlocked).includes(sel.value) ? sel.value : '' });
      return;
    }
    const file = target.closest<HTMLInputElement>('[data-profile-import]')?.files?.[0];
    if (!file) return;
    const other = parseProfileFile(await file.text(), parseProgress);
    const msg = goalsBox.querySelector<HTMLElement>('[data-profile-msg]')!;
    if (!other) {
      msg.textContent = t('profile.badFile');
      msg.hidden = false;
      return;
    }
    const merged = mergeProgress(loadProgress(), other);
    saveProgress(merged);
    // il pannello si riscrive con i numeri nuovi, e si lascia aperto
    goalsBox.innerHTML = renderGoals();
    const box = goalsBox.querySelector<HTMLDetailsElement>('.goals')!;
    box.open = true;
    const after = box.querySelector<HTMLElement>('[data-profile-msg]')!;
    after.textContent = t('profile.imported', { done: merged.unlocked.length, all: ACHIEVEMENTS.length });
    after.hidden = false;
  });
  goalsBox.addEventListener('click', (e) => {
    if ((e.target as HTMLElement).closest('[data-profile-export]')) downloadProfile(loadProgress());
  });
  document.querySelector('[data-credits]')!.addEventListener('click', () => document.querySelector<HTMLDialogElement>('.credits-dialog')!.showModal());
  document.querySelector('[data-settings]')!.addEventListener('click', () => openSettings((next) => audio.setVolumes(next.sfxVolume, next.musicVolume)));
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
          b.textContent = t('slots.confirmDelete');
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
      if (!ok) savedBox.querySelector('.slot-msg')!.textContent = t('slots.badFile');
      input.value = '';
    });
  }
  if (resume) {
    const box = document.querySelector<HTMLElement>('.resume')!;
    box.querySelector('[data-resume]')!.addEventListener('click', resume.onContinue);
    box.querySelector('[data-new-game]')!.addEventListener('click', () => {
      // la partita salvata resta finché non se ne inizia un'altra
      box.querySelector('h2')!.textContent = t('setup.savedGame');
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
      out.textContent = t('setup.durationCustom');
      return;
    }
    const rows = [...form.querySelectorAll<HTMLElement>('.setup-row:not([hidden])')];
    const named = rows.filter((r) => r.querySelector<HTMLInputElement>('input[name^=p]')!.value.trim());
    const bots = named.filter((r) => r.querySelector<HTMLSelectElement>('select')!.value !== 'human').length;
    const people = Math.max(1, named.length - bots);
    const who = tn('setup.people', people) + (bots ? ` ${t('setup.and')} ${tn('setup.computers', bots)}` : '');
    out.textContent = `⏱ ${t('setup.duration', { rounds: p.rounds, who, minutes: estimatedMinutes(p, people, bots) })}`;
  };
  form.addEventListener('change', (e) => {
    const t = e.target as HTMLInputElement;
    if (t.name === 'board') {
      setBoard(t.value);
      writePref(KEYS.board, t.value);
      const props = form.querySelector<HTMLElement>('[data-board-props]');
      if (props) props.textContent = String(propertyCount());
    }
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
      form.insertAdjacentHTML('beforeend', `<p class="error">${t('setup.minPlayers', { n: MIN_PLAYERS })}</p>`);
      return;
    }
    if (data.get('teams') === 'on' && (players.length < 4 || players.length % 2 !== 0)) {
      form.querySelector('.error')?.remove();
      form.insertAdjacentHTML('beforeend', `<p class="error">${t('rules.teamsHint')}</p>`);
      return;
    }
    const rounds = Number(data.get('rounds')) || null;
    // il tipo di partita serve ai traguardi ("vinci con tre tipi diversi")
    savePreset(String(data.get('preset') ?? 'custom'));
    destroyPreview();
    editingSeat = null;
    onStart({
      players,
      rules: {
        ...(demo ? demoRules() : {}),
        startingMoney: Number(data.get('money')) || board.startingMoney,
        maxRounds: rounds,
        parkPot: data.get('pot') === 'on',
        // le squadre vogliono un numero pari di giocatori, almeno quattro
        teams: data.get('teams') === 'on' && players.length >= 4 && players.length % 2 === 0,
        quickStart: data.get('quick') === 'on',
        sprintDie: data.get('sprint') === 'on',
        ...goalRules(String(data.get('goal') ?? '')),
        seatBonus: data.get('bonus') === 'on' ? (demo ? DEMO_SEAT_BONUS : SEAT_BONUS) : 0,
      },
      tipsOn: data.get('tips') === 'on',
      boardId: String(data.get('board') ?? currentBoard()),
    });
  });
}

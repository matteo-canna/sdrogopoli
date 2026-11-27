// Schermata iniziale: chi gioca, personaggi, regole della casa e classifica tra amici.
import { BOARDS, DEFAULT_BOARD, board, currentBoard, setBoard } from '../data';
import { savedBoards } from './boardStore';
import { BOT_LEVELS, BOT_STYLES, PRESETS, SHARE_CUT, SHARES_PER_GROUP, WHEEL_EVERY, estimatedMinutes, type BotStyle, DEMO_MAX_PLAYERS, DEMO_ROUNDS, DEMO_SEAT_BONUS, MAX_PLAYERS, MIN_PLAYERS, QUICK_START_PROPERTIES, QUICK_START_TWO_PLAYERS, SEAT_BONUS, demoRules, type GameRules, type PlayerSetup } from '../engine';
import { reportUrl } from './report';
import { DESKTOP } from './platform';
import { FILE_EXT, MAX_SLOTS, OLD_FILE_EXT, type Slot } from './slots';
import { escapeHtml } from './view';
import { renderIntro } from './intro';
import { buildLabel } from './build';
import { renderLeaderboard } from './summary';
import { colorName, characterDef } from './characters';
import { boardTitle, getLang, t, tn, type MsgKey } from '../i18n';
import { KEYS, loadLeaderboard, loadProgress, parseProgress, readPref, saveLeaderboard, savePreset, saveProgress, writePref } from './prefs';
import { ACHIEVEMENTS, achievementText, achievementTitle, EXTRA_COLORS, titleLabel, unlockedTitles } from './achievements';
import { downloadProfile, parseProfileFile, mergeProgress, profileRows, OLD_PROFILE_EXT, PROFILE_EXT } from './profile';
import { DAILY_ROUNDS, dailyPlayers, dailySeed, dailyText, dayId, parseDaily } from './daily';
import { loadSettings, openSettings } from './settings';
import { backgroundHtml } from './setupBackground';
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

import { avatarHtml, closePicker, destroyPreview, initPicker, openPicker, pickerDialogHtml, setupLooks } from './lookPicker';
export { setupLooks, destroyPreview };

// I tabelloni da scegliere: quelli del gioco e quelli fatti con l'editor in questo browser.
function boardListHtml(checked = currentBoard()): string {
  const builtin = BOARDS.map((b) => ({ id: b.id, title: t(`board.${b.id}` as MsgKey), text: t(`boardText.${b.id}` as MsgKey) }));
  const mine = savedBoards().map((b) => ({
    id: b.id,
    title: escapeHtml(boardTitle(b.id, b.data)),
    text: t('boardText.custom', { spaces: b.data.spaces.length, groups: b.data.groups.length }),
  }));
  return [...builtin, ...mine]
    .map((b) => `<label class="preset"><input type="radio" name="board" value="${b.id}" ${b.id === checked ? 'checked' : ''}><span><strong>${b.title}</strong><small>${b.text}</small></span></label>`)
    .join('');
}

// Dopo l'editor (o un link): l'elenco dei tabelloni si riscrive, il resto della schermata resta.
export function refreshBoards(checked = currentBoard()): void {
  const list = document.querySelector<HTMLElement>('#setup-form .boards .preset-list');
  if (list) list.innerHTML = boardListHtml(checked);
  const props = document.querySelector<HTMLElement>('#setup-form [data-board-props]');
  if (props) props.textContent = String(propertyCount());
}

function chooseBoard(id: string): void {
  setBoard(id);
  writePref(KEYS.board, currentBoard());
  refreshBoards();
}

function propertyCount(): number {
  return board.spaces.filter((sp) => sp.type === 'property').length;
}


// Titolo su una targa come quella dei giochi da tavolo: le lettere entrano una alla volta
// (solo decorazione: il testo vero è nascosto per i lettori di schermo).
function titlePlate(text: string): string {
  let k = 0;
  return `<span class="title-plate" aria-hidden="true">${[...text]
    .map((ch) => (ch === ' ' ? '<span class="gap"> </span>' : `<span style="--i:${k++}">${escapeHtml(ch)}</span>`))
    .join('')}</span>`;
}

// Fila dei colori dei quartieri, usata in alto nella finestra della pedina.
function groupsStrip(): string {
  const n = board.groups.length;
  return `linear-gradient(90deg, ${board.groups.map((g, i) => `${g.color} ${((i * 100) / n).toFixed(2)}% ${(((i + 1) * 100) / n).toFixed(2)}%`).join(', ')})`;
}

// Pedina del posto i: tocco grande e rotondo (con la matita) che apre la finestra di scelta.
function lookButton(i: number, name: string): string {
  const look = setupLooks[i];
  const def = characterDef(look.character);
  return `<button type="button" class="look-btn" data-look="${i}" style="--c:${look.color}" aria-haspopup="dialog"
    title="${t('look.choose')}" aria-label="${escapeHtml(t('look.seatLabel', { player: name, name: def.label, color: colorName(look.color) }))}"><span class="look-btn-emoji" aria-hidden="true">${def.emoji}</span><span class="look-btn-edit" aria-hidden="true">✏️</span></button>`;
}

// Nome mostrato del posto i: quello scritto o quello proposto.
function seatName(i: number): string {
  const input = document.querySelector<HTMLInputElement>(`#setup-form input[name=p${i}]`);
  return input?.value.trim() || t('setup.playerN', { n: i + 1 });
}

// Aggiorna pedina e colore di un posto senza ridisegnare la riga (il focus resta dov'è).
function refreshSeat(i: number): void {
  const row = document.querySelectorAll<HTMLElement>('#setup-form .setup-row')[i];
  if (!row) return;
  const look = setupLooks[i];
  const def = characterDef(look.character);
  row.style.setProperty('--c', look.color);
  const btn = row.querySelector<HTMLElement>('.look-btn')!;
  btn.style.setProperty('--c', look.color);
  btn.setAttribute('aria-label', t('look.seatLabel', { player: seatName(i), name: def.label, color: colorName(look.color) }));
  const emoji = btn.querySelector('.look-btn-emoji')!;
  if (emoji.textContent !== def.emoji) {
    emoji.textContent = def.emoji;
    // saltello della pedina appena cambiata (la classe si toglie e si rimette per ripartire)
    btn.classList.remove('bump');
    void btn.offsetWidth;
    btn.classList.add('bump');
  }
}

// Partite salvate con un nome e file da importare.
export interface SlotsOffer {
  list: Slot[];
  onLoad: (id: string) => void;
  onExport: (id: string) => void;
  onDelete: (id: string) => void;
  // false se il file non è una partita di Gioco Folle!
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
  return `<h2 id="slots-title">💾 ${t('slots.title')}${list.length ? ` <small>(${t('slots.count', { n: list.length, max: MAX_SLOTS })})</small>` : ''}</h2>
    ${list.length ? `<ul class="slot-list">${items}</ul>` : `<p class="hint">${t('slots.empty')}</p>`}
    <label class="import-file">📂 ${t('slots.import', { ext: FILE_EXT })}<input type="file" accept="${FILE_EXT},${OLD_FILE_EXT},.json,application/json" data-import></label>
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
        <label class="file-label">${t('profile.import')}<input type="file" accept="${PROFILE_EXT},${OLD_PROFILE_EXT},application/json" data-profile-import hidden></label>
      </div>
      <p class="hint">${t('profile.hint')}</p>
      <p class="profile-msg" data-profile-msg hidden></p>
      ${chooser}
      <ul class="goal-list">${rows}</ul>
    </details>`;
}

export function renderSetup(app: HTMLElement, tipsOn: boolean, onStart: (choice: SetupChoice) => void, resume?: ResumeOffer, slots?: SlotsOffer, online?: OnlineOffer): void {
  closePicker();
  const money = board.currency.symbol;
  // Ordine della pagina: 1) la partita da preparare (con il riepilogo e il pulsante sempre a portata),
  // 2) gli altri modi di giocare, 3) le informazioni sul gioco e i traguardi.
  app.innerHTML = `
    ${backgroundHtml(loadSettings().background)}
    <main class="setup" style="--groups-strip:${groupsStrip()}">
      <header class="brand">
        <div class="brand-strip" aria-hidden="true">${board.groups.map((g, i) => `<span style="--c:${g.color};--i:${i}"></span>`).join('')}</div>
        <h1><span class="visually-hidden">Gioco Folle!</span>${titlePlate('Gioco Folle!')}</h1>
        <p class="tagline">${t(DESKTOP ? 'setup.taglineDesktop' : 'setup.tagline', { min: MIN_PLAYERS, max: MAX_PLAYERS })}</p>
      </header>
      ${resume ? `<section class="card resume" aria-labelledby="resume-title">
        <h2 id="resume-title">${t('setup.resumeTitle')}</h2>
        ${resume.summary}
        <div class="resume-buttons">
          <button type="button" class="primary" data-resume>▶ ${t('setup.continue')}</button>
          <button type="button" data-new-game>${t('btn.newGame')}</button>
        </div>
      </section>` : ''}
      <form id="setup-form" class="setup-form" ${resume ? 'hidden' : ''}>
        <div class="setup-steps">
          <section class="card step" aria-labelledby="who-title">
            <div class="form-head">
              <h2 id="who-title"><span class="step-n" aria-hidden="true">1</span>${t('setup.whoPlays')}</h2>
              <p>${t('setup.whoPlaysHint')}</p>
            </div>
            <div class="seat-list">
            ${SEATS.map((i) => {
              const name = i === 0 ? t('setup.playerN', { n: 1 }) : i === 1 ? 'Computer' : t('setup.playerN', { n: i + 1 });
              return `<div class="setup-row" style="--c:${setupLooks[i].color}" ${i >= SEATS_SHOWN ? 'hidden' : ''}>${lookButton(i, name)}
                <div class="seat-fields">
                  <input name="p${i}" maxlength="16" aria-label="${t('setup.nameLabel', { n: i + 1 })}" placeholder="${t('setup.playerN', { n: i + 1 })}${i >= 2 ? ` ${t('setup.optional')}` : ''}" ${i < 2 ? `value="${name}"` : ''}>
                  <div class="seat-meta">
                    <select name="t${i}" aria-label="${t('setup.controlLabel', { n: i + 1 })}">
                      <option value="human" ${i === 0 ? 'selected' : ''}>👤 ${t('setup.person')}</option>
                      ${BOT_LEVELS.map((l) => `<option value="${l.id}" ${i > 0 && l.id === 'normale' ? 'selected' : ''}>🤖 ${t(`setup.computer.${l.id}` as MsgKey)}</option>`).join('')}
                    </select>
                  </div>
                </div></div>`;
            }).join('')}
            </div>
            <button type="button" class="add-seat" data-add-seat>➕ ${t('setup.addSeat')} <small>(${t('setup.upTo', { n: `<span data-seat-max>${MAX_PLAYERS}</span>` })})</small></button>
            <p class="hint" data-demo-hint hidden>🧪 ${t('setup.demoMax', { n: MAX_PLAYERS })}</p>
          </section>
          <section class="card step" aria-labelledby="board-title">
            <h2 id="board-title"><span class="step-n" aria-hidden="true">2</span>${t('setup.board')}</h2>
            <fieldset class="presets boards">
              <legend class="visually-hidden">${t('setup.board')}</legend>
              <div class="preset-list" role="radiogroup">${boardListHtml()}</div>
            </fieldset>
            <button type="button" class="link" data-board-editor>✏️ ${t('editor.open')}</button>
          </section>
          <section class="card step" aria-labelledby="type-title">
            <h2 id="type-title"><span class="step-n" aria-hidden="true">3</span>${t('setup.gameType')}</h2>
            <fieldset class="presets types">
              <legend class="visually-hidden">${t('setup.gameType')}</legend>
              <div class="preset-list" role="radiogroup">
                ${PRESETS.map((p, i) => `<label class="preset"><input type="radio" name="preset" value="${p.id}" ${i === 0 ? 'checked' : ''}><span><strong>${t(`preset.${p.id}` as MsgKey)}</strong></span></label>`).join('')}
                <label class="preset"><input type="radio" name="preset" value="custom"><span><strong>${t('preset.custom')}</strong></span></label>
              </div>
              <p class="preset-text" data-preset-text aria-live="polite"></p>
            </fieldset>
            <details class="house-rules">
              <summary>⚙️ ${t('rules.title')}</summary>
              <div class="rules-grid">
              <label class="check demo-toggle"><input type="checkbox" name="demo">
                <span><strong>🧪 ${t('setup.demo')}</strong> <span class="badge-demo">${t('setup.experimental')}</span><br>
                <small>${t('setup.demoText', { n: DEMO_MAX_PLAYERS, rounds: DEMO_ROUNDS, bonus: `${money} ${DEMO_SEAT_BONUS}` })}</small></span></label>
              <label>${t('rules.money')}
                <select name="money">${[1000, 1500, 2000, 2500].map((m) => `<option value="${m}" ${m === board.startingMoney ? 'selected' : ''}>${money} ${m}</option>`).join('')}</select>
              </label>
              <label>${t('lobby.duration')}
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
              <label>${t('rules.goal')}
                <select name="goal">
                  <option value="">${t('rules.goalNone')}</option>
                  <option value="worth3000">${t('rules.goalWorth', { amount: `${money} 3000` })}</option>
                  <option value="worth4000">${t('rules.goalWorth', { amount: `${money} 4000` })}</option>
                  <option value="groups2">${t('rules.goalGroups', { n: 2 })}</option>
                  <option value="groups3">${t('rules.goalGroups', { n: 3 })}</option>
                  <option value="groups2worth4000">${t('rules.goalBoth', { n: 2, amount: `${money} 4000` })}</option>
                  <option value="side">${t('rules.goalSide')}</option>
                </select>
              </label>
              <label class="check"><input type="checkbox" name="tips" ${tipsOn ? 'checked' : ''}> ${t('rules.tips')}</label>
              <label class="check"><input type="checkbox" name="quick"> ${t('rules.quick', { n: QUICK_START_PROPERTIES, two: QUICK_START_TWO_PLAYERS, total: `<span data-board-props>${propertyCount()}</span>` })}</label>
              <label class="check"><input type="checkbox" name="bonus" checked> ${t('rules.bonus', { amount: `${money} <span data-bonus-amount>${SEAT_BONUS}</span>` })}</label>
              <label class="check"><input type="checkbox" name="sprint"> 🎲 ${t('rules.sprint')}</label>
              <label class="check"><input type="checkbox" name="pot"> ${t('rules.pot')}</label>
              <label class="check"><input type="checkbox" name="events"> 🎪 ${t('rules.events')}</label>
              <label class="check"><input type="checkbox" name="wheel"> 🎡 ${t('rules.wheel', { n: WHEEL_EVERY })}</label>
              <label class="check"><input type="checkbox" name="shares"> 📈 ${t('rules.shares', { n: SHARES_PER_GROUP, pct: Math.round(SHARE_CUT * 100) })}</label>
              <label class="check"><input type="checkbox" name="landmarks"> 🏛️ ${t('rules.landmarks')}</label>
              <label class="check"><input type="checkbox" name="teams"> ${t('rules.teams')}</label>
              <p class="hint">${t('rules.teamsHint')}</p>
              </div>
            </details>
          </section>
        </div>
        <aside class="setup-summary card" aria-labelledby="summary-title">
          <h2 id="summary-title">${t('setup.summary')}</h2>
          <ul class="summary-seats" data-summary-seats></ul>
          <dl class="summary-lines">
            <div><dt>${t('setup.board')}</dt><dd data-summary-board></dd></div>
            <div><dt>${t('setup.gameType')}</dt><dd data-summary-preset></dd></div>
          </dl>
          <p class="summary-duration" data-duration aria-live="polite"></p>
          <p class="hint" data-quick-note hidden>⚡ ${t('setup.quickNote', { n: QUICK_START_TWO_PLAYERS })}</p>
          <div data-setup-error role="alert"></div>
          <button class="primary" type="submit">${t('setup.start')}</button>
        </aside>
      </form>
      <section class="more-modes" aria-labelledby="modes-title">
        <h2 id="modes-title" class="section-title">${t('setup.moreModes')}</h2>
        <div class="modes-grid">
          ${online ? onlineHtml() : ''}
          <div id="daily-slot">${renderDaily()}</div>
          ${slots ? `<section class="card saved-games" aria-labelledby="slots-title">${slotsHtml(slots.list)}</section>` : ''}
        </div>
      </section>
      <section class="about" aria-labelledby="about-title">
        <h2 id="about-title" class="section-title">${t('setup.aboutGame')}</h2>
        <div class="about-grid">
          <div class="setup-info">${renderIntro()}</div>
          <div class="about-side">
            <div id="leaderboard-slot">${renderLeaderboard(loadLeaderboard())}</div>
            <div id="goals-slot">${renderGoals()}</div>
          </div>
        </div>
      </section>
      <footer class="credits">
        <p>🆓 ${t('footer.free')}</p>
        <p>${t('footer.characters')} <a href="https://kaylousberg.com" target="_blank" rel="noopener">KayKit ${t('credits.by')} Kay Lousberg</a> (CC0) · ${t('footer.version', { v: buildLabel() })} · <button type="button" class="link" data-credits>${t('footer.credits')}</button> · <button type="button" class="link" data-settings>⚙️ ${t('settings.title')}</button> · <a href="${reportUrl(null, 'iniziale')}" target="_blank" rel="noopener">${t('report.link')}</a></p>
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
      ${pickerDialogHtml()}
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
      closePicker();
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
  document.querySelector('[data-settings]')!.addEventListener('click', () =>
    openSettings((next) => {
      audio.setVolumes(next.sfxVolume, next.musicVolume);
      // lo sfondo cambia subito, senza ridisegnare il resto
      const bg = document.querySelector('.setup-bg');
      if (bg && !bg.classList.contains(`bg-${next.background}`)) bg.outerHTML = backgroundHtml(next.background);
    }),
  );
  const form = document.querySelector<HTMLFormElement>('#setup-form')!;
  const onlineBox = document.querySelector<HTMLElement>('.online-card');
  if (online && onlineBox) {
    onlineBox.querySelector('[data-online-create]')!.addEventListener('click', () => {
      closePicker();
      online.onCreate();
    });
    onlineBox.querySelector('[data-online-join]')!.addEventListener('submit', (e) => {
      e.preventDefault();
      const code = String(new FormData(e.target as HTMLFormElement).get('code') ?? '');
      closePicker();
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
  const visibleSeats = () => [...form.querySelectorAll<HTMLElement>('.setup-row')].flatMap((row, i) => (row.hidden ? [] : [i]));
  // Riepilogo a fianco (in basso sul telefono): chi gioca, tabellone e tipo di partita.
  const syncSummary = () => {
    const seats = visibleSeats().filter((i) => form.querySelector<HTMLInputElement>(`input[name=p${i}]`)!.value.trim());
    const box = form.querySelector<HTMLElement>('[data-summary-seats]')!;
    box.innerHTML = seats
      .map((i) => {
        const bot = form.querySelector<HTMLSelectElement>(`select[name=t${i}]`)!.value !== 'human';
        // toccando un giocatore del riepilogo si sceglie la sua pedina
        return `<li><button type="button" class="summary-seat" data-summary-look="${i}" aria-haspopup="dialog" aria-label="${escapeHtml(t('look.seatLabel', { player: seatName(i), name: characterDef(setupLooks[i].character).label, color: colorName(setupLooks[i].color) }))}">${avatarHtml(setupLooks[i])}<span>${bot ? '🤖 ' : ''}${escapeHtml(seatName(i))}</span></button></li>`;
      })
      .join('');
    box.setAttribute('aria-label', tn('setup.seats', seats.length));
    const boardInput = form.querySelector<HTMLInputElement>('input[name=board]:checked');
    form.querySelector('[data-summary-board]')!.textContent = boardInput?.closest('label')?.querySelector('strong')?.textContent ?? '';
    const preset = form.querySelector<HTMLInputElement>('input[name=preset]:checked');
    form.querySelector('[data-summary-preset]')!.textContent = preset?.closest('label')?.querySelector('strong')?.textContent ?? '';
    const text = preset ? (preset.value === 'custom' ? t('presetText.custom') : t(`presetText.${preset.value}` as MsgKey)) : '';
    form.querySelector('[data-preset-text]')!.textContent = text;
  };
  initPicker({
    seats: visibleSeats,
    nameOf: seatName,
    onChange: (i) => {
      refreshSeat(i);
      syncSummary();
    },
  });
  // posti visibili e pulsante "Aggiungi giocatore" in base al limite (8, o 12 in demo)
  const syncSeats = () => {
    const max = isDemo() ? DEMO_MAX_PLAYERS : MAX_PLAYERS;
    const rows = [...form.querySelectorAll<HTMLElement>('.setup-row')];
    rows.forEach((row, i) => {
      if (i >= max) row.hidden = true;
    });
    const full = !rows.some((row, i) => i < max && row.hidden);
    form.querySelector<HTMLElement>('[data-add-seat]')!.hidden = full;
    // tutti gli 8 posti in uso: si ricorda che la modalità demo ne aggiunge altri
    form.querySelector<HTMLElement>('[data-demo-hint]')!.hidden = !full || isDemo();
    form.querySelector('[data-seat-max]')!.textContent = String(max);
    form.querySelector('[data-bonus-amount]')!.textContent = String(isDemo() ? DEMO_SEAT_BONUS : SEAT_BONUS);
    syncQuick();
    syncSummary();
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
    field<HTMLInputElement>('events').checked = !!r.events;
    field<HTMLInputElement>('wheel').checked = !!r.wheel;
    field<HTMLInputElement>('shares').checked = !!r.shares;
    field<HTMLInputElement>('landmarks').checked = !!r.landmarks;
    showDuration();
  };
  const showDuration = () => {
    syncSummary();
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
  form.addEventListener('input', (e) => {
    const el = e.target as HTMLInputElement;
    if (!el.matches('input[name^=p]')) return;
    syncQuick();
    showDuration();
    // il nome compare anche nell'etichetta della pedina
    refreshSeat(Number(el.name.slice(1)));
  });
  form.addEventListener('change', (e) => {
    const el = e.target as HTMLInputElement;
    if (el.name === 'board') {
      chooseBoard(el.value);
      syncSummary();
    } else if (el.name === 'preset') applyPreset(el.value);
    else if (['rounds', 'quick', 'sprint', 'goal', 'pot', 'money'].includes(el.name)) {
      form.querySelector<HTMLInputElement>('input[name=preset][value=custom]')!.checked = true;
      showDuration();
    } else if (el.matches('select[name^=t]')) showDuration();
    else if (el.name === 'demo') {
      // la modalità demo propone la sua durata; togliendola si torna a "fino all'ultimo"
      const rounds = form.querySelector<HTMLSelectElement>('select[name=rounds]')!;
      if (el.checked) rounds.value = String(DEMO_ROUNDS);
      else if (rounds.value === String(DEMO_ROUNDS)) rounds.value = '';
      syncSeats();
    }
  });
  showDuration();
  syncSeats();
  form.addEventListener('click', (e) => {
    const b = (e.target as HTMLElement).closest<HTMLElement>('button');
    if (!b) return;
    if (b.hasAttribute('data-board-editor')) {
      // l'editor arriva in un pezzo di codice a parte, solo quando serve
      void import('./boardEditor').then((m) => m.openBoardEditor(currentBoard(), (id) => chooseBoard(id ?? currentBoard())));
    } else if (b.hasAttribute('data-add-seat')) {
      // mostra il prossimo posto nascosto e porta lì il cursore
      const row = form.querySelector<HTMLElement>('.setup-row[hidden]');
      if (row) {
        row.hidden = false;
        row.querySelector('input')?.focus();
      }
      syncSeats();
      showDuration();
    } else if (b.dataset.look !== undefined) openPicker(Number(b.dataset.look));
    else if (b.dataset.summaryLook !== undefined) openPicker(Number(b.dataset.summaryLook));
  });
  const showError = (text: string) => {
    form.querySelector('[data-setup-error]')!.innerHTML = `<p class="error">${text}</p>`;
  };
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const data = new FormData(form);
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
      showError(t('setup.minPlayers', { n: MIN_PLAYERS }));
      return;
    }
    if (data.get('teams') === 'on' && (players.length < 4 || players.length % 2 !== 0)) {
      showError(t('rules.teamsHint'));
      return;
    }
    const rounds = Number(data.get('rounds')) || null;
    // il tipo di partita serve ai traguardi ("vinci con tre tipi diversi")
    savePreset(String(data.get('preset') ?? 'custom'));
    closePicker();
    onStart({
      players,
      rules: {
        ...(demo ? demoRules() : {}),
        startingMoney: Number(data.get('money')) || board.startingMoney,
        maxRounds: rounds,
        parkPot: data.get('pot') === 'on',
        events: data.get('events') === 'on',
        wheel: data.get('wheel') === 'on',
        shares: data.get('shares') === 'on',
        landmarks: data.get('landmarks') === 'on',
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

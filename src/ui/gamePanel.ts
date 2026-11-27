// Pannello del turno, barra dei comandi, cassetto dei giocatori e informazioni della partita.
import { board } from '../data';
import { actingPlayer, type GameContext, type GameState, type SprintFace } from '../engine';
import { t, text, type MsgKey } from '../i18n';
import { audio } from './audio';
import { playerColor } from './characters';
import { clockText } from './onlineTable';
import { SKY_LABELS, type Speed } from './prefs';
import { defaultSlotName, FILE_EXT } from './slots';
import { renderSummary } from './summary';
import type { CameraMode } from './three/camera';
import type { SkyMode } from './three/city';
import { tutorialTip } from './tutorial';
import {
  escapeHtml,
  playerBadge,
  renderDice,
  renderEvents,
  renderPlayers,
  renderSpaceCard,
  renderTradeEditor,
  renderTurnActions,
  type TradeDraft,
} from './view';
import { webglAvailable } from './webgl';

export type ViewMode = '3d' | '2d';

export interface PanelOptions {
  state: GameState;
  ctx: GameContext;
  viewMode: ViewMode;
  cameraMode: CameraMode;
  skyMode: SkyMode;
  speed: Speed;
  phone: boolean;
  drawerOpen: boolean;
  animating: boolean;
  selected: string | null;
  error: string;
  newsFrom: number;
  tradeDraft: TradeDraft | null;
  tutorial: { on: boolean; seen: Set<string> };
  canUndo: boolean;
  canReplay: boolean;
  titles: Record<number, string>;
  unlocked: { icon: string; title: string; prize: string }[];
  onlineCode: string | null;
  mySeat: number | null;
  myTurn: boolean;
  iAmAway: boolean;
  timeLeft: number | null;
  seatNote: string;
  saysHtml: string;
}

// Due righe sulla partita salvata: chi gioca, a che punto è e chi è in testa.
export function resumeSummary(s: GameState): string {
  const alive = s.players.filter((p) => !p.bankrupt);
  const who = s.players.map((p) => `${playerBadge(s, p.id, 'token')} ${escapeHtml(p.name)}`).join(' ');
  const round = s.rules?.maxRounds ? t('round.ofMax', { n: s.round, max: s.rules.maxRounds }) : t('round.n', { n: s.round });
  const turn = s.phase === 'gameOver' ? t('game.over') : `${round} · ${t('turn.of', { name: escapeHtml(s.players[actingPlayer(s)].name) })}`;
  return `<p class="resume-players">${who}</p><p class="resume-meta">${turn} · ${alive.length} in gioco</p>`;
}

function tipHtml(s: GameState, ctx: GameContext, tutorial: { on: boolean; seen: Set<string> }, tradeDraft: TradeDraft | null): string {
  if (!tutorial.on || tradeDraft) return '';
  const tip = tutorialTip(s, ctx, tutorial.seen);
  if (!tip) return '';
  return `<div class="tip" role="note">
      <h4>💡 ${escapeHtml(tip.title)}</h4>
      <p>${escapeHtml(tip.text)}</p>
      <div class="tip-buttons">
        <button data-action="tipOk" data-tip="${tip.id}">${t('tip.ok')}</button>
        <button class="link" data-action="tipOff">${t('tip.off')}</button>
      </div>
    </div>`;
}

// Obiettivo della partita, se c'è: quanto manca a chi gioca su questo schermo (o a chi è di turno).
function goalPill(s: GameState): string {
  const r = s.rules;
  if (!r || (!r.goalWorth && !r.goalGroups && !r.goalSide)) return '';
  const parts = [
    r.goalGroups ? t('goal.groups', { n: r.goalGroups }) : '',
    r.goalWorth ? `${board.currency.symbol} ${r.goalWorth}` : '',
    r.goalSide ? t('goal.side') : '',
  ].filter(Boolean);
  return `<span class="pill" title="${t('goal.title')}">🎯 ${parts.join(` ${t('goal.or')} `)}</span>`;
}

function sprintLabel(face: SprintFace): string {
  return typeof face === 'number' ? `+${face}` : face === 'occasione' ? '🛒' : '💥';
}

// Riga del turno: chi gioca, giro, montepremi e ultimo lancio.
export function turnHtml(s: GameState, online: boolean, timeLeft: number | null): string {
  const id = s.phase === 'gameOver' && s.winner !== null ? s.winner : actingPlayer(s);
  const p = s.players[id];
  const total = s.lastRoll ? s.lastRoll[0] + s.lastRoll[1] : 0;
  return `
    <div class="turn" style="--c:${playerColor(p)}">
      ${playerBadge(s, id)}
      <span>${s.phase === 'gameOver' ? `<strong>${t('game.over')}</strong>` : t('turn.of', { name: `<strong>${p.isBot ? '🤖 ' : ''}${escapeHtml(p.name)}</strong>` })}</span>
      ${s.rules?.demo ? `<span class="pill demo" title="${t('game.demoTitle')}">🧪 Demo</span>` : ''}
      ${s.rules?.maxRounds ? `<span class="pill">${t('round.ofMax', { n: s.round, max: s.rules.maxRounds })}</span>` : ''}
      ${online ? `<span class="pill clock" data-clock aria-label="${t('online.clock')}" ${timeLeft === null ? 'hidden' : ''}>⏱ ${clockText(timeLeft ?? 0)}</span>` : ''}
      ${s.rules?.parkPot ? `<span class="pill" title="${t('game.potTitle')}">🪑 ${board.currency.symbol} ${s.pot}</span>` : ''}
      ${goalPill(s)}
      ${s.lastRoll ? `<span class="roll">${renderDice(s)}${s.lastSprint ? `<span class="sprint-die" title="${t('game.sprintDie')}">${sprintLabel(s.lastSprint)}</span>` : ''}<span class="roll-total">${total + (typeof s.lastSprint === 'number' ? s.lastSprint : 0)}</span></span>` : ''}
    </div>`;
}

function undoButton(online: boolean, canUndo: boolean): string {
  if (online || !canUndo) return '';
  return `<button class="undo" data-action="undo" title="${t('undo.title')}">↩ ${t('btn.cancel')}</button>`;
}

// Pulsanti del turno (o modulo dello scambio), consiglio ed errore: la parte da tenere sempre a portata di dito.
export function controlsHtml(opts: PanelOptions): string {
  const { state: s, ctx, tradeDraft, tutorial, error } = opts;
  const waiting = s.phase !== 'gameOver' && !opts.myTurn;
  const actions = waiting
    ? `<div class="actions waiting"><p class="wait">${opts.mySeat === null ? `👀 ${t('online.watching')}` : `⏳ ${t('online.waitTurn', { name: `<strong>${escapeHtml(s.players[actingPlayer(s)].name)}</strong>` })}`}${opts.seatNote}</p></div>`
    : `${opts.iAmAway ? `<p class="away-note" role="status">🤖 ${t('online.awayNote')}</p>` : ''}<div class="actions">${renderTurnActions(s)}${undoButton(!!opts.onlineCode, opts.canUndo)}</div>`;
  return `
    ${tradeDraft && !waiting ? renderTradeEditor(s, tradeDraft) : actions}
    ${opts.saysHtml}
    ${error ? `<p class="error" role="alert">${escapeHtml(error)}</p>` : ''}
    ${tipHtml(s, ctx, tutorial, tradeDraft)}`;
}

// Notizie, fine partita e registro: si leggono con calma.
// Nel 2D l'evento del quartiere sta al centro del tabellone; nel 3D lì non c'è posto, quindi
// compare nel pannello di fianco.
export function infoHtml(opts: PanelOptions): string {
  const { state: s, ctx, newsFrom, viewMode, selected, titles, unlocked, canReplay } = opts;
  const fresh = Math.min(Math.max((s.eventCount ?? 0) - newsFrom, 0), s.log.length, 8);
  const news = fresh ? s.log.slice(-fresh) : [];
  return `
    ${s.phase === 'gameOver' ? renderSummary(s, ctx, { titles, unlocked, canReplay }) : viewMode === '3d' ? renderEvents(s) : ''}
    ${news.length ? `<div class="news"><h4>${t('news.title')}</h4><ul>${news.map((l) => `<li>${escapeHtml(text(l))}</li>`).join('')}</ul></div>` : ''}
    ${selected ? '' : `<p class="hint">${t('hint.tapSpace')}</p>`}
    <details class="log-box"><summary>${t('log.title')}</summary>
      <ol class="log">${s.log.slice().reverse().map((l) => `<li>${escapeHtml(text(l))}</li>`).join('')}</ol>
    </details>`;
}

function soundButtons(): string {
  return `<button data-action="toggleSfx" aria-pressed="${audio.sfxOn}" aria-label="${t('tools.sfx')}" title="${t('tools.sfx')}">${audio.sfxOn ? '🔊' : '🔇'}<span class="lbl"> ${t('tools.sfxShort')}</span></button>
    <button data-action="toggleMusic" aria-pressed="${audio.musicOn}" aria-label="${t('tools.music')}" title="${t('tools.music')}">${audio.musicOn ? '🎵' : '🚫'}<span class="lbl"> ${t('tools.music')}</span></button>`;
}

function settingsButton(): string {
  return `<button data-action="settings" aria-label="${t('settings.title')}" title="${t('settings.hint')}">⚙️<span class="lbl"> ${t('settings.title')}</span></button>`;
}

export function viewButtons(viewMode: ViewMode, cameraMode: CameraMode, skyMode: SkyMode, speed: Speed): string {
  const cam =
    viewMode === '3d'
      ? `<button data-action="camera" aria-label="${cameraMode === 'follow' ? t('tools.overview') : t('tools.follow')}">${cameraMode === 'follow' ? `🗺️<span class="lbl"> ${t('tools.overview')}</span>` : `🎥<span class="lbl"> ${t('tools.follow')}</span>`}</button>`
      : '';
  const toggle = webglAvailable()
    ? `<button data-action="toggleView" aria-label="${viewMode === '3d' ? t('tools.view2d') : t('tools.view3d')}">${viewMode === '3d' ? `🔲<span class="lbl"> ${t('tools.view2d')}</span>` : `🧊<span class="lbl"> ${t('tools.view3d')}</span>`}</button>`
    : '';
  const [icon, skyKey] = SKY_LABELS[skyMode];
  const label = t(skyKey);
  const sky =
    viewMode === '3d'
      ? `<button data-action="sky" aria-label="${t('tools.sky', { label })}" title="${t('tools.sky', { label })}">${icon}<span class="lbl"> ${label}</span></button>`
      : '';
  const speedLabel = t(`speed.${speed.id}` as MsgKey);
  const speedBtn = `<button data-action="speed" aria-label="${t('tools.speed', { label: speedLabel })}" title="${t('tools.speed', { label: speedLabel })}">${speed.icon}<span class="lbl"> ${speedLabel}</span></button>`;
  return cam + sky + toggle + speedBtn + soundButtons() + settingsButton();
}

// Struttura della partita, uguale nel 2D e nel 3D: tabellone, pannello laterale e,
// sul telefono, barra delle azioni in basso con il pannello laterale come cassetto.
export function gameShell(stage: string, mode: ViewMode, drawerOpen: boolean, onlineCode: string | null): string {
  return `
    <div class="game game${mode} ${drawerOpen ? 'drawer-open' : ''}">
      <div class="stage">
        ${stage}
        <div class="view-buttons overlay"></div>
        <div class="card-slot"></div>
      </div>
      <aside class="side" aria-label="${t('side.label')}">
        <button class="drawer-close" data-action="drawer">✕ ${t('btn.close')}</button>
        <div class="view-buttons in-drawer"></div>
        <div class="hud"></div>
        <div class="players-list"></div>
        ${onlineCode ? `<p class="saved">🌐 ${t('online.savedNote', { code: `<strong>${onlineCode}</strong>` })}</p>` : `<p class="saved">💾 ${t('save.auto')}</p>
        <details class="slots-box">
          <summary>${t('save.copyOrExport')}</summary>
          <form class="slot-form" data-slot-form>
            <label for="slot-name">${t('save.name')}</label>
            <div class="slot-row">
              <input id="slot-name" name="slotName" maxlength="60" placeholder="${escapeHtml(defaultSlotName())}" autocomplete="off">
              <button type="submit">${t('save.copy')}</button>
            </div>
          </form>
          <button data-action="exportGame">⬇️ ${t('save.export', { ext: FILE_EXT })}</button>
          <p class="slot-msg" role="status" aria-live="polite"></p>
        </details>`}
        <button class="link" data-action="quit">${onlineCode ? t('online.leave') : t('game.quit')}</button>
        <a class="report-link" data-report href="#" target="_blank" rel="noopener">🐞 ${t('report.link')}</a>
      </aside>
      <div class="action-bar"></div>
    </div>`;
}

// Riempie i pannelli: sul telefono i comandi vanno nella barra in basso, altrove in cima al pannello laterale.
export function fillPanels(app: HTMLElement, opts: PanelOptions): void {
  const { state: s, phone, drawerOpen, animating, viewMode, cameraMode, skyMode, speed, selected } = opts;
  const game = app.querySelector<HTMLElement>('.game')!;
  game.classList.toggle('drawer-open', phone && drawerOpen);
  game.classList.toggle('busy', animating);
  const turn = turnHtml(s, !!opts.onlineCode, opts.timeLeft);
  const controls = controlsHtml(opts);
  const info = infoHtml(opts);
  app.querySelector('.hud')!.innerHTML = phone ? info : turn + controls + info;
  app.querySelector('.action-bar')!.innerHTML = phone
    ? `<div class="bar-head">${turn}<button class="drawer-btn" data-action="drawer" aria-expanded="${drawerOpen}">👥 ${t('side.players')}</button></div>${controls}`
    : '';
  app.querySelector('.players-list')!.innerHTML = renderPlayers(s);
  // sul telefono, nel 2D, i comandi della vista stanno nel cassetto
  const toolsInDrawer = phone && viewMode === '2d';
  const buttons = viewButtons(viewMode, cameraMode, skyMode, speed);
  app.querySelector('.view-buttons.overlay')!.innerHTML = toolsInDrawer ? '' : buttons;
  app.querySelector('.view-buttons.in-drawer')!.innerHTML = toolsInDrawer ? buttons : '';
  app.querySelector('.card-slot')!.innerHTML = selected ? renderSpaceCard(s, selected) : '';
}

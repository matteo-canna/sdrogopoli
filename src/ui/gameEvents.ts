// Gestione dei clic, invio dei moduli e cambio dei campi nell'interfaccia della partita.
import { applyAction, raiseMoney, type Action, type GameContext, type GameState, type LandmarkId, type SaveFile } from '../engine';
import { t } from '../i18n';
import { audio } from './audio';
import { showNotices } from './moments';
import type { OnlineTable } from './onlineTable';
import { KEYS, SPEEDS, saveTutorial, writePref, type Speed } from './prefs';
import { openReplayDialog } from './replayModal';
import { reportUrl } from './report';
import type { GameSession } from './session';
import { openSettings } from './settings';
import { shareResult } from './share';
import { defaultSlotName, downloadSave, saveSlot } from './slots';
import type { Board3D } from './three/board3d';
import type { CameraMode } from './three/camera';
import type { SkyMode } from './three/city';
import { createCounterDraft, createTradeDraft, handleTradeChange, submitTradeForm } from './tradeModal';
import type { ViewMode } from './gamePanel';
import type { TradeDraft } from './view';

export interface GameEventDeps {
  app: HTMLElement;
  ctx: GameContext;
  session: GameSession;
  table: OnlineTable;
  tutorial: { on: boolean; seen: Set<string> };
  getBoard3d: () => Board3D | null;
  getViewMode: () => ViewMode;
  setViewMode: (m: ViewMode) => void;
  getSkyMode: () => SkyMode;
  setSkyMode: (m: SkyMode) => void;
  getCameraMode: () => CameraMode;
  setCameraMode: (m: CameraMode) => void;
  getSpeed: () => Speed;
  setSpeed: (s: Speed) => void;
  getSelected: () => string | null;
  setSelected: (id: string | null) => void;
  selectSpace: (id: string | null) => void;
  toggleDrawer: () => void;
  getTradeDraft: () => TradeDraft | null;
  setTradeDraft: (d: TradeDraft | null) => void;
  getError: () => string;
  setError: (e: string) => void;
  resetNews: (state: GameState) => void;
  botToPlay: () => boolean;
  cancelBots: () => void;
  act: (action: Action) => void;
  persist: () => void;
  render: () => void;
}

// Azioni che non si annullano: il primo tocco chiede conferma, il secondo esegue.
function confirmTwice(button: HTMLElement): boolean {
  if (button.dataset.confirm === 'yes') return true;
  button.dataset.confirm = 'yes';
  button.textContent = t('confirm.again');
  return false;
}

export function bindGameEvents(d: GameEventDeps): void {
  const { app, ctx, session, table, tutorial } = d;

  // Un solo gestore di clic per tutta la pagina.
  app.addEventListener('click', (e) => {
    audio.unlock();
    const report = (e.target as HTMLElement).closest<HTMLAnchorElement>('[data-report]');
    if (report) {
      report.href = reportUrl(session.state, d.getViewMode());
      return;
    }
    const target = (e.target as HTMLElement).closest<HTMLElement>('[data-action], [data-space]');
    const state = session.state;
    if (!target || !state) return;
    if (target.closest('.game.busy .actions')) return;
    if (d.botToPlay() && target.closest('.actions')) return;
    const action = target.dataset.action;
    const spaceId = target.dataset.space;
    if (!action && spaceId) return d.selectSpace(spaceId);
    const board3d = d.getBoard3d();
    switch (action) {
      case 'closeCard':
        d.setSelected(null);
        return d.render();
      case 'drawer':
        d.toggleDrawer();
        return d.render();
      case 'tipOk':
        tutorial.seen.add(target.dataset.tip ?? '');
        saveTutorial(tutorial);
        return d.render();
      case 'tipOff':
        tutorial.on = false;
        saveTutorial(tutorial);
        return d.render();
      case 'toggleSfx':
        audio.setSfx(!audio.sfxOn);
        return d.render();
      case 'share':
        void shareResult(state, ctx).then((how) => {
          if (how === 'downloaded') showNotices([{ k: 'share.done' }]);
        });
        return;
      case 'replay':
        openReplayDialog(session.toFile() as SaveFile | null, ctx);
        return;
      case 'settings':
        openSettings((next) => {
          audio.setVolumes(next.sfxVolume, next.musicVolume);
          const b3d = d.getBoard3d();
          if (b3d) b3d.quality = next.quality;
        });
        return;
      case 'toggleMusic':
        audio.setMusic(!audio.musicOn);
        return d.render();
      case 'openTrade':
        d.setTradeDraft(createTradeDraft(state));
        d.setError('');
        return d.render();
      case 'toggleSays':
        table.saysOpen = !table.saysOpen;
        return d.render();
      case 'say':
        table.say(target.dataset.say);
        return d.render();
      case 'counterTrade': {
        const draft = createCounterDraft(state);
        if (!draft) return;
        d.setTradeDraft(draft);
        d.setError('');
        return d.render();
      }
      case 'closeTrade':
        d.setTradeDraft(null);
        return d.render();
      case 'bid':
        return d.act({ type: 'bid', amount: Number(target.dataset.amount) });
      case 'chooseCard':
        return d.act({ type: 'chooseCard', option: Number(target.dataset.option) });
      case 'pass':
      case 'acceptTrade':
      case 'rejectTrade':
        return d.act({ type: action });
      case 'toggleView': {
        const nextView = d.getViewMode() === '3d' ? '2d' : '3d';
        d.setViewMode(nextView);
        writePref(KEYS.view, nextView);
        return d.render();
      }
      case 'sky': {
        const cur = d.getSkyMode();
        const nextSky = cur === 'cycle' ? 'day' : cur === 'day' ? 'night' : 'cycle';
        d.setSkyMode(nextSky);
        writePref(KEYS.sky, nextSky);
        if (board3d) board3d.skyMode = nextSky;
        return d.render();
      }
      case 'speed': {
        const cur = d.getSpeed();
        const nextSpeed = SPEEDS[(SPEEDS.indexOf(cur) + 1) % SPEEDS.length];
        d.setSpeed(nextSpeed);
        writePref(KEYS.speed, nextSpeed.id);
        if (board3d) board3d.speed = nextSpeed.factor;
        return d.render();
      }
      case 'camera': {
        const nextCam = d.getCameraMode() === 'follow' ? 'overview' : 'follow';
        d.setCameraMode(nextCam);
        if (board3d) board3d.cameraMode = nextCam;
        return d.render();
      }
      case 'newGame':
      case 'quit':
        if (action === 'quit' && !confirmTwice(target)) return;
        if (table.online) return table.leave();
        d.cancelBots();
        session.clear();
        d.setSelected(null);
        d.setError('');
        d.persist();
        return d.render();
      case 'exportGame': {
        const file = session.toFile();
        const input = app.querySelector<HTMLInputElement>('#slot-name');
        if (file) downloadSave(input?.value.trim() || input?.placeholder || 'partita', file);
        return;
      }
      case 'coverDebt':
        if (table.online) {
          let s = state;
          const steps: Action[] = [];
          for (let i = 0; i < 200 && s.players[s.current].money < 0; i++) {
            const step = raiseMoney(s, ctx);
            if (!step) break;
            s = applyAction(s, step, ctx);
            steps.push(step);
          }
          steps.forEach(d.act);
          return;
        }
        d.resetNews(state);
        session.coverDebt();
        d.setError('');
        audio.play('coin');
        d.persist();
        return d.render();
      case 'undo':
        if (table.online || !session.undo()) return;
        d.setError('');
        d.setSelected(null);
        d.persist();
        return d.render();
      case 'build':
      case 'sell':
      case 'mortgage':
      case 'unmortgage':
        return d.act({ type: action, spaceId: spaceId! });
      case 'buyShare':
      case 'sellShare':
      case 'sellLandmark':
        return d.act({ type: action, group: target.dataset.group ?? '' });
      case 'buildLandmark':
        return d.act({
          type: action,
          group: target.dataset.group ?? '',
          landmark: (target.dataset.landmark ?? 'fontana') as LandmarkId,
        });
      case 'roll':
      case 'buy':
      case 'decline':
      case 'payJailFine':
      case 'useJailCard':
      case 'endTurn':
        return d.act({ type: action });
      case 'bankrupt':
        if (!confirmTwice(target)) return;
        return d.act({ type: action });
    }
  });

  app.addEventListener('change', (e) => {
    handleTradeChange(
      app,
      e.target as HTMLInputElement | HTMLSelectElement,
      session.state,
      d.getTradeDraft(),
      (draft) => d.setTradeDraft(draft),
      d.render,
    );
  });

  app.addEventListener('submit', (e) => {
    const slotForm = (e.target as HTMLElement).closest<HTMLFormElement>('[data-slot-form]');
    if (slotForm) {
      e.preventDefault();
      const file = session.toFile();
      if (!file) return;
      const input = slotForm.querySelector<HTMLInputElement>('input')!;
      const result = saveSlot(input.value, file);
      const msg = app.querySelector('.slot-msg')!;
      msg.textContent = result.ok ? `✅ ${t('save.done', { name: input.value.trim() || input.placeholder })}` : result.reason;
      if (result.ok) {
        input.value = '';
        input.placeholder = defaultSlotName();
      }
      return;
    }
    const draft = d.getTradeDraft();
    if ((e.target as HTMLElement).id !== 'trade-form' || !draft) return;
    e.preventDefault();
    submitTradeForm(
      e.target as HTMLFormElement,
      draft,
      d.act,
      () => !!d.getError(),
      () => d.setTradeDraft(null),
      d.render,
    );
  });
}

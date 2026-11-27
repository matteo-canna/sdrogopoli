// Finestra di replay: rigioca la partita sul tabellone 2D dal primo lancio.
import type { GameContext, GameState, SaveFile } from '../engine';
import { t } from '../i18n';
import { Replay, REPLAY_SPEEDS, type ReplaySpeed } from './replay';
import { renderBoardBox } from './view';

let replay: Replay | null = null;

export function openReplayDialog(file: SaveFile | null, ctx: GameContext): void {
  if (!file) return;
  document.querySelector('.replay-dialog')?.remove();
  const dialog = document.createElement('dialog');
  dialog.className = 'replay-dialog';
  dialog.setAttribute('aria-label', t('replay.title'));
  dialog.innerHTML = `
    <div class="replay-board"></div>
    <div class="replay-bar">
      <button type="button" data-replay="back" aria-label="${t('replay.back')}">⏪</button>
      <button type="button" class="primary" data-replay="toggle">⏸ ${t('replay.pause')}</button>
      <button type="button" data-replay="forward" aria-label="${t('replay.forward')}">⏩</button>
      <input type="range" min="0" max="1000" value="0" data-replay="seek" aria-label="${t('replay.title')}">
      <span class="replay-step" data-replay="step"></span>
      <label class="replay-speed">${t('replay.speed')}
        <select data-replay="speed">${REPLAY_SPEEDS.map((v) => `<option value="${v}" ${v === 2 ? 'selected' : ''}>${v}×</option>`).join('')}</select>
      </label>
      <button type="button" data-replay="close">${t('replay.close')}</button>
    </div>`;
  document.body.append(dialog);
  const boardBox = dialog.querySelector<HTMLElement>('.replay-board')!;
  const seek = dialog.querySelector<HTMLInputElement>('[data-replay=seek]')!;
  const toggle = dialog.querySelector<HTMLButtonElement>('[data-replay=toggle]')!;
  const stepLabel = dialog.querySelector<HTMLElement>('[data-replay=step]')!;
  const draw = (v: { state: GameState; progress: number; done: boolean }) => {
    boardBox.innerHTML = renderBoardBox(v.state, null);
    seek.value = String(Math.round(v.progress * 1000));
    stepLabel.textContent = t('replay.step', { n: Math.round(v.progress * (replay!.length - 1)) + 1, all: replay!.length });
    toggle.textContent = replay!.playing ? `⏸ ${t('replay.pause')}` : `▶ ${t('replay.play')}`;
  };
  replay = Replay.from(file, ctx, (v) => draw(v));
  draw(replay.view());
  dialog.addEventListener('click', (e) => {
    const what = (e.target as HTMLElement).closest<HTMLElement>('[data-replay]')?.dataset.replay;
    if (!replay) return;
    if (what === 'toggle') replay.playing ? replay.pause() : replay.play();
    else if (what === 'back') replay.step(-1);
    else if (what === 'forward') replay.step(1);
    else if (what === 'close') dialog.close();
    else return;
    draw(replay.view());
  });
  dialog.addEventListener('input', (e) => {
    const el = e.target as HTMLInputElement;
    if (!replay) return;
    if (el.dataset.replay === 'seek') replay.seek(Number(el.value) / 1000);
    if (el.dataset.replay === 'speed') replay.speed = Number(el.value) as ReplaySpeed;
  });
  dialog.addEventListener('close', () => {
    replay?.stop();
    replay = null;
    dialog.remove();
  });
  dialog.showModal();
  replay.play();
  draw(replay.view());
}

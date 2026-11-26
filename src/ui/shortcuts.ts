// Finestra "Scorciatoie da tastiera", aperta premendo "?" durante la partita.
import { t, type MsgKey } from '../i18n';
import { escapeHtml } from './view';

export interface ShortcutDef {
  keys: string;
  i18nKey: MsgKey;
}

export const SHORTCUTS: readonly ShortcutDef[] = [
  { keys: 'Tab / Enter', i18nKey: 'shortcuts.turn' },
  { keys: '← → ↑ ↓', i18nKey: 'shortcuts.arrows' },
  { keys: 'Home / End', i18nKey: 'shortcuts.homeEnd' },
  { keys: '+ / −', i18nKey: 'shortcuts.zoom' },
  { keys: 'Shift + ← →', i18nKey: 'shortcuts.rotate' },
  { keys: '0', i18nKey: 'shortcuts.resetView' },
  { keys: 'Esc', i18nKey: 'shortcuts.escape' },
  { keys: '?', i18nKey: 'shortcuts.help' },
];

export function openShortcuts(): HTMLDialogElement {
  const existing = document.querySelector<HTMLDialogElement>('.shortcuts-dialog');
  if (existing?.open) return existing;
  existing?.remove();
  const back = document.activeElement as HTMLElement | null;
  const dialog = document.createElement('dialog');
  dialog.className = 'shortcuts-dialog credits-dialog';
  dialog.setAttribute('aria-labelledby', 'shortcuts-title');
  dialog.innerHTML = `
    <h2 id="shortcuts-title">⌨️ ${escapeHtml(t('shortcuts.title'))}</h2>
    <ul class="shortcuts-list">
      ${SHORTCUTS.map((s) => `<li><kbd>${escapeHtml(s.keys)}</kbd> — <span>${escapeHtml(t(s.i18nKey))}</span></li>`).join('')}
    </ul>
    <form method="dialog"><button type="submit" class="primary" data-shortcuts-close>${escapeHtml(t('btn.close'))}</button></form>`;
  document.body.append(dialog);
  dialog.addEventListener('click', (e) => {
    if (e.target === dialog) dialog.close();
  });
  dialog.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') e.stopPropagation();
  });
  dialog.addEventListener('close', () => {
    dialog.remove();
    if (back?.isConnected) back.focus();
  });
  dialog.showModal();
  dialog.querySelector<HTMLElement>('[data-shortcuts-close]')?.focus();
  return dialog;
}

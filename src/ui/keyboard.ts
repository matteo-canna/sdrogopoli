// Gestione della tastiera e conservazione del focus durante il ridisegno della pagina (B43).
import { board } from '../data';
import type { GameState } from '../engine';
import type { Board3D } from './three/board3d';

// Ultimo modo usato per giocare: con la tastiera il focus segue il pulsante principale.
let usingKeyboard = false;
document.addEventListener(
  'keydown',
  (e) => {
    if (['Tab', 'Enter', ' ', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End', 'Escape'].includes(e.key)) {
      usingKeyboard = true;
    }
  },
  true,
);
document.addEventListener('pointerdown', () => (usingKeyboard = false), true);

const FOCUS_ATTRS = [
  'data-action',
  'data-space',
  'data-group',
  'data-landmark',
  'data-option',
  'data-amount',
  'data-say',
  'data-tip',
  'name',
  'id',
];

// Un selettore che ritrova "lo stesso" elemento dopo il ridisegno.
export function focusKey(app: HTMLElement): string | null {
  const el = document.activeElement;
  if (!el || el === document.body || !app.contains(el)) return usingKeyboard && el === document.body ? '' : null;
  const parts = FOCUS_ATTRS.filter((a) => el.hasAttribute(a)).map((a) => `[${a}="${CSS.escape(el.getAttribute(a)!)}"]`);
  if (el.matches('.board3d')) return '.board3d';
  return parts.length ? el.tagName.toLowerCase() + parts.join('') : '';
}

function visible(el: Element): el is HTMLElement {
  return el instanceof HTMLElement && el.getClientRects().length > 0 && !(el as HTMLButtonElement).disabled;
}

// key null: il focus era fuori dalla partita e non si tocca. Altrimenti si torna allo stesso elemento
// o, se è sparito (un pulsante del turno appena usato), al pulsante principale del turno.
export function restoreFocus(app: HTMLElement, key: string | null): void {
  if (key === null || (!usingKeyboard && key === '')) return;
  if (document.activeElement && document.activeElement !== document.body && app.contains(document.activeElement)) return;
  const same = key ? [...app.querySelectorAll(key)].find(visible) : undefined;
  const next =
    same ??
    [...app.querySelectorAll('.actions .primary, .actions button, .trade-editor input, .trade-editor button')].find(visible);
  // se non c'è niente da usare (gioca il computer) il focus resta sulla pagina e torna al primo pulsante che compare
  next?.focus({ preventScroll: true });
}

// Frecce sul tabellone: nel 2D si sposta il focus tra le caselle, nel 3D si sceglie la casella.
export function moveOnBoard(from: number, key: string): number | null {
  const n = board.spaces.length;
  if (key === 'ArrowRight' || key === 'ArrowDown') return (from + 1) % n;
  if (key === 'ArrowLeft' || key === 'ArrowUp') return (from - 1 + n) % n;
  if (key === 'Home') return 0;
  if (key === 'End') return n - 1;
  return null;
}

export interface BoardKeyDeps {
  getState: () => GameState | null;
  getSelected: () => string | null;
  getBoard3d: () => Board3D | null;
  selectSpace: (spaceId: string | null) => void;
  canEscape: () => boolean;
  onEscape: () => boolean;
}

export function bindKeyboard(app: HTMLElement, deps: BoardKeyDeps): void {
  app.addEventListener('keydown', (e) => {
    const s = deps.getState();
    const el = e.target as HTMLElement;
    if (!s || e.altKey || e.ctrlKey || e.metaKey) return;
    const space = el.closest<HTMLElement>('.board [data-space]');
    if (space) {
      const i = moveOnBoard(board.spaces.findIndex((sp) => sp.id === space.dataset.space), e.key);
      if (i === null) return;
      e.preventDefault();
      const nextBtn = app.querySelector<HTMLElement>(`.board [data-space="${board.spaces[i].id}"]`);
      if (!nextBtn) return;
      space.tabIndex = -1;
      nextBtn.tabIndex = 0;
      nextBtn.focus();
      return;
    }
    if (el.matches('.board3d')) {
      const board3d = deps.getBoard3d();
      // + e − per avvicinarsi, Maiusc con le frecce per girare, 0 per tornare alla vista proposta
      const view = {
        '+': () => board3d?.zoomBy(0.85),
        '=': () => board3d?.zoomBy(0.85),
        '-': () => board3d?.zoomBy(1 / 0.85),
        '0': () => board3d?.resetView(),
      }[e.key];
      const turn = e.shiftKey && (e.key === 'ArrowLeft' || e.key === 'ArrowRight');
      if (view || turn) {
        e.preventDefault();
        if (view) view();
        else board3d?.rotateBy(e.key === 'ArrowLeft' ? 0.26 : -0.26);
        return;
      }
      const selected = deps.getSelected();
      const from = selected ? board.spaces.findIndex((sp) => sp.id === selected) : s.players[s.current].position;
      const i = moveOnBoard(from, e.key);
      if (i === null) return;
      e.preventDefault();
      deps.selectSpace(board.spaces[i].id);
    }
  });

  // Esc chiude la carta della casella o il cassetto.
  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape' || !deps.canEscape()) return;
    deps.onEscape();
  });
}

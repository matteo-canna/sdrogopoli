// Editor di tabelloni: si parte da un tabellone (del gioco o fatto prima) e se ne cambiano nome,
// soldi iniziali, nomi e colori dei quartieri, nomi delle caselle, prezzi e tasse. La forma (quante
// caselle e di che tipo) resta quella del tabellone di partenza; chi vuole cambiarla scrive il
// file a mano e lo importa, e il controllo è lo stesso.
// Si carica solo quando qualcuno apre l'editor.
import { BOARDS, boardChoice, cards, customBoards } from '../data';
import { validateBoard, withPrice, type BoardData, type BoardIssue, type Space } from '../engine';
import { boardTitle, spaceName, t, type MsgKey } from '../i18n';
import { escapeHtml } from './view';
import { BOARD_FILE_EXT, boardFileText, deleteCustomBoard, readBoardText, saveCustomBoard, savedBoards, shareLink } from './boardStore';
import { MAX_NAME, MAX_TITLE } from '../engine';

const ICON: Record<Space['type'], string> = {
  start: '🏁',
  property: '🏠',
  station: '🚏',
  utility: '💡',
  card: '🃏',
  tax: '💸',
  jail: '🚓',
  free: '🪑',
  goToJail: '👮',
};

export function issueText(e: BoardIssue): string {
  return t(`boardErr.${e.code}` as MsgKey, { id: e.id ?? '', n: e.n ?? 0 });
}

// Un tabellone del gioco ha i nomi delle caselle nelle traduzioni; nell'editor si parte da quelli
// della lingua in uso, perché il tabellone fatto avrà i nomi in una lingua sola.
function draftFrom(id: string): { data: BoardData; editing?: string } {
  const choice = boardChoice(id);
  const data = structuredClone(choice.data);
  if (choice.custom) return { data, editing: choice.id };
  data.title = t('editor.copyOf', { name: boardTitle(choice.id) }).slice(0, MAX_TITLE);
  for (const s of data.spaces) s.name = spaceName(s.id);
  return { data };
}

function slug(name: string): string {
  return `${name.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-zA-Z0-9]+/g, '-').replace(/^-|-$/g, '').toLowerCase() || 'tabellone'}${BOARD_FILE_EXT}`;
}

function spaceRow(s: Space, i: number): string {
  const value =
    'price' in s
      ? `<label class="be-num"><span>${t('editor.price')}</span><input type="number" min="1" max="2000" step="5" data-space-price="${s.id}" value="${s.price}"></label>`
      : s.type === 'tax'
        ? `<label class="be-num"><span>${t('editor.amount')}</span><input type="number" min="0" max="1000" step="5" data-space-amount="${s.id}" value="${s.amount}"></label>`
        : '<span></span>';
  return `<li class="be-space" data-type="${s.type}">
    <span class="be-icon" aria-hidden="true">${ICON[s.type]}</span>
    <input data-space-name="${s.id}" maxlength="${MAX_NAME}" value="${escapeHtml(s.name)}" aria-label="${t('editor.spaceN', { n: i + 1 })}">
    ${value}
  </li>`;
}

function formHtml(data: BoardData): string {
  return `
    <label class="be-field"><span>${t('editor.name')}</span><input name="title" maxlength="${MAX_TITLE}" value="${escapeHtml(data.title ?? '')}"></label>
    <label class="be-field"><span>${t('editor.money')}</span><input name="money" type="number" min="100" max="10000" step="50" value="${data.startingMoney}"></label>
    <fieldset><legend>${t('editor.groups')}</legend><ul class="be-groups">
      ${data.groups.map((g) => `<li><input type="color" data-group-color="${g.id}" value="${g.color}" aria-label="${escapeHtml(t('editor.groupColor', { name: g.name }))}"><input data-group-name="${g.id}" maxlength="${MAX_NAME}" value="${escapeHtml(g.name)}" aria-label="${t('editor.groups')}: ${escapeHtml(g.name)}"></li>`).join('')}
    </ul></fieldset>
    <fieldset><legend>${t('editor.spaces')}</legend><ol class="be-spaces">${data.spaces.map(spaceRow).join('')}</ol></fieldset>`;
}

function baseOptions(selected: string): string {
  const all = [...BOARDS, ...customBoards().filter((b) => savedBoards().some((s) => s.id === b.id))];
  return all.map((b) => `<option value="${b.id}" ${b.id === selected ? 'selected' : ''}>${escapeHtml(boardTitle(b.id, b.data))}</option>`).join('');
}

// Apre l'editor partendo dal tabellone "startId". onChange avvisa la schermata iniziale quando
// un tabellone è stato salvato (id) o eliminato (null), così l'elenco si aggiorna.
export function openBoardEditor(startId: string, onChange: (chosen: string | null) => void): void {
  document.querySelector('.board-editor')?.remove();
  const back = document.activeElement as HTMLElement | null;
  let { data, editing } = draftFrom(startId);
  let base = startId;

  const dialog = document.createElement('dialog');
  dialog.className = 'board-editor';
  dialog.setAttribute('aria-labelledby', 'be-title');
  document.body.append(dialog);

  const render = () => {
    dialog.innerHTML = `
      <h2 id="be-title">✏️ ${t('editor.title')}</h2>
      <p class="hint">${t('editor.intro')}</p>
      <label class="be-field"><span>${t('editor.base')}</span><select data-be-base>${baseOptions(base)}</select></label>
      <form data-be-form>${formHtml(data)}</form>
      <div class="be-check" aria-live="polite"></div>
      <p class="be-status" role="status"></p>
      <div class="be-link" hidden><label>${t('editor.linkLabel')} <input readonly data-be-link></label></div>
      <div class="be-actions">
        <button type="button" class="primary" data-be-save>💾 ${t('editor.save')}</button>
        <button type="button" data-be-export>⬇️ ${t('editor.export')}</button>
        <button type="button" data-be-share>🔗 ${t('editor.link')}</button>
        <label class="import-file">📂 ${t('editor.import')}<input type="file" accept="${BOARD_FILE_EXT},.json,application/json" data-be-import></label>
        ${editing ? `<button type="button" class="danger" data-be-delete>🗑️ ${t('editor.delete')}</button>` : ''}
      </div>
      <form method="dialog" class="be-close"><button>${t('btn.close')}</button></form>`;
    check();
  };

  const status = (msg: string) => {
    dialog.querySelector('.be-status')!.textContent = msg;
  };

  // controlla il tabellone a ogni modifica e segna i campi da sistemare
  let valid: BoardData | null = null;
  const check = () => {
    const result = validateBoard(data, cards);
    valid = result.ok ? result.data : null;
    const box = dialog.querySelector('.be-check')!;
    dialog.querySelectorAll('[aria-invalid]').forEach((el) => el.removeAttribute('aria-invalid'));
    if (result.ok) box.innerHTML = `<p class="be-ok">${t('editor.ok')}</p>`;
    else {
      // nell'editor le caselle si riconoscono dalla posizione e i quartieri dal nome, non dall'id
      const readable = (e: BoardIssue): BoardIssue => {
        const i = data.spaces.findIndex((sp) => sp.id === e.id);
        if (i >= 0) return { ...e, id: String(i + 1) };
        const g = data.groups.find((x) => x.id === e.id);
        return g?.name.trim() ? { ...e, id: g.name } : e;
      };
      box.innerHTML = `<p>${t('editor.errors')}</p><ul class="be-errors">${result.errors.slice(0, 8).map((e) => `<li>${escapeHtml(issueText(readable(e)))}</li>`).join('')}</ul>`;
      for (const e of result.errors) {
        if (!e.id) continue;
        const sel = { spaceName: 'data-space-name', groupName: 'data-group-name', groupColor: 'data-group-color' }[e.code];
        if (sel) dialog.querySelector(`[${sel}="${CSS.escape(e.id)}"]`)?.setAttribute('aria-invalid', 'true');
      }
      if (result.errors.some((e) => e.code === 'title')) dialog.querySelector('input[name=title]')?.setAttribute('aria-invalid', 'true');
    }
    for (const b of dialog.querySelectorAll<HTMLButtonElement>('[data-be-save], [data-be-export], [data-be-share]')) b.disabled = !valid;
  };

  dialog.addEventListener('input', (e) => {
    const el = e.target as HTMLInputElement;
    const d = el.dataset;
    if (el.name === 'title') data.title = el.value;
    else if (el.name === 'money') data.startingMoney = Number(el.value);
    else if (d.groupName) data.groups.find((g) => g.id === d.groupName)!.name = el.value;
    else if (d.groupColor) data.groups.find((g) => g.id === d.groupColor)!.color = el.value;
    else if (d.spaceName) data.spaces.find((s) => s.id === d.spaceName)!.name = el.value;
    else if (d.spaceAmount) {
      const s = data.spaces.find((x) => x.id === d.spaceAmount);
      if (s?.type === 'tax') s.amount = Number(el.value);
    } else if (d.spacePrice) {
      const i = data.spaces.findIndex((x) => x.id === d.spacePrice);
      const price = Number(el.value);
      if (i >= 0 && Number.isInteger(price) && price > 0) data.spaces[i] = withPrice(data.spaces[i], price);
      else if (i >= 0 && 'price' in data.spaces[i]) (data.spaces[i] as { price: number }).price = price;
    } else return;
    status('');
    check();
  });

  dialog.addEventListener('change', async (e) => {
    const el = e.target as HTMLInputElement;
    if (el.matches('[data-be-base]')) {
      base = el.value;
      ({ data, editing } = draftFrom(base));
      render();
      dialog.querySelector<HTMLElement>('[data-be-base]')?.focus();
    } else if (el.matches('[data-be-import]') && el.files?.[0]) {
      const result = readBoardText(await el.files[0].text());
      if (!result.ok) {
        status(`${t('editor.importBad')} ${result.errors.slice(0, 3).map(issueText).join(' ')}`);
        return;
      }
      data = result.data;
      data.title ??= el.files[0].name.replace(/\.[^.]+$/, '').slice(0, MAX_TITLE);
      editing = undefined;
      render();
      status(t('editor.imported'));
    }
  });

  dialog.addEventListener('click', async (e) => {
    const el = (e.target as HTMLElement).closest('button');
    if (!el) return;
    if (el.matches('[data-be-save]') && valid) {
      const id = saveCustomBoard(valid, editing);
      editing = id;
      base = id;
      data = structuredClone(valid);
      onChange(id);
      render();
      status(t('editor.saved', { name: valid.title ?? '' }));
    } else if (el.matches('[data-be-export]') && valid) {
      const blob = new Blob([boardFileText(valid)], { type: 'application/json' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = slug(valid.title ?? '');
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    } else if (el.matches('[data-be-share]') && valid) {
      const link = await shareLink(valid);
      const box = dialog.querySelector<HTMLElement>('.be-link')!;
      box.hidden = false;
      const input = box.querySelector<HTMLInputElement>('[data-be-link]')!;
      input.value = link;
      try {
        await navigator.clipboard.writeText(link);
        status(t('editor.linkCopied'));
      } catch {
        input.select();
      }
    } else if (el.matches('[data-be-delete]') && editing) {
      deleteCustomBoard(editing);
      onChange(null);
      base = BOARDS[0].id;
      ({ data, editing } = draftFrom(base));
      render();
      status(t('editor.deleted'));
    }
  });

  dialog.addEventListener('close', () => {
    dialog.remove();
    back?.focus();
  });
  render();
  dialog.showModal();
}

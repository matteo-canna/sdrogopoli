// Scelta della pedina nella schermata iniziale: una finestra (dialog) che si apre sopra la pagina,
// con l'anteprima 3D, i reparti di pedine come schede, le pedine come tessere grandi da toccare,
// il colore e i dettagli. In alto si passa da un giocatore all'altro senza chiudere.
import type { Appearance, BaseStyleId, FinishId } from '../engine';
import { DEMO_MAX_PLAYERS } from '../engine';
import { t, type MsgKey } from '../i18n';
import { loadProgress, KEYS, readPref, writePref } from './prefs';
import { unlockedColors } from './achievements';
import { ACCENT_CHOICES, BASE_STYLES, CHARACTERS, COLLECTION_GROUPS, COLOR_CHOICES, FINISHES, characterDef, collectionLook, colorName, defaultAppearance, inkOn, itemName, type CollectionGroup } from './characters';
import { escapeHtml } from './view';
import { webglAvailable } from './webgl';
import { load3d } from './lazy3d';
import type { CharacterPreview } from './three/characters3d';

// reparto di pedine mostrato: quelle classiche o un reparto delle pedine da collezione
type LookFamily = 'classic' | CollectionGroup;
const FAMILIES: LookFamily[] = ['classic', ...COLLECTION_GROUPS];
function familyOf(characterId: string): LookFamily {
  return characterDef(characterId).collection ?? 'classic';
}

// aspetto scelto per ciascuno dei posti (ricordato per la prossima partita)
export const setupLooks: Appearance[] = loadLooks();

function loadLooks(): Appearance[] {
  let saved: Partial<Appearance>[] = [];
  try {
    saved = JSON.parse(readPref(KEYS.looks) ?? '[]');
  } catch {
    /* preferenza rovinata: si riparte da quelle predefinite */
  }
  return Array.from({ length: DEMO_MAX_PLAYERS }, (_, i) => {
    const look = { ...defaultAppearance(i), ...(Array.isArray(saved) ? saved[i] : {}) };
    // un personaggio sconosciuto torna a quello predefinito
    if (!CHARACTERS.some((c) => c.id === look.character)) return defaultAppearance(i);
    if (look.item && !(look.item in characterDef(look.character).items)) look.item = '';
    return look;
  });
}

// Come la finestra chiede alla schermata i posti in gioco e i loro nomi.
export interface PickerHost {
  // posti visibili, nell'ordine
  seats: () => number[];
  // nome scritto (o quello proposto) del posto i
  nameOf: (i: number) => string;
  // l'aspetto del posto i è cambiato: la schermata ridisegna quel che mostra
  onChange: (i: number) => void;
}

let host: PickerHost | null = null;
let editingSeat: number | null = null;
let family: LookFamily = 'classic';
let preview: CharacterPreview | null = null;

export function destroyPreview(): void {
  preview?.dispose();
  preview = null;
}

function dialogEl(): HTMLDialogElement | null {
  return document.querySelector<HTMLDialogElement>('.look-dialog');
}

// Pulsante rotondo con la pedina, usato nei posti e nella finestra.
export function avatarHtml(look: Appearance): string {
  return `<span class="avatar" style="--c:${look.color}" aria-hidden="true">${characterDef(look.character).emoji}</span>`;
}

// Scheletro della finestra: si mette una volta nella pagina, il contenuto si riempie all'apertura.
export function pickerDialogHtml(): string {
  return `<dialog class="look-dialog" aria-labelledby="look-title">
      <div class="look-editor">
        <header class="look-head">
          <h2 id="look-title">${t('look.title')}</h2>
          <button type="button" class="look-close" data-look-close aria-label="${t('look.close')}">✕</button>
          <div class="look-seats" role="group" aria-label="${t('look.seats')}"></div>
        </header>
        <div class="look-body">
          <div class="look-stage">
            <div class="look-preview" id="look-preview"></div>
            <p class="look-caption" aria-live="polite"></p>
          </div>
          <div class="look-controls"></div>
        </div>
        <footer class="look-foot">
          <button type="button" data-look-random aria-label="${t('look.randomLabel')}">🎲 ${t('look.random')}</button>
          <button type="button" class="primary" data-look-done>${t('btn.done')}</button>
        </footer>
      </div>
    </dialog>`;
}

function seatsHtml(): string {
  if (!host) return '';
  return host
    .seats()
    .map((i) => `<button type="button" class="look-seat" data-look-seat="${i}" aria-pressed="${i === editingSeat}">${avatarHtml(setupLooks[i])}<span>${escapeHtml(host!.nameOf(i))}</span></button>`)
    .join('');
}

// Colori disponibili e, per ciascuno, chi lo sta già usando (tra i posti in gioco).
function colorsHtml(look: Appearance): string {
  const seats = host?.seats() ?? [];
  const all = [...COLOR_CHOICES, ...unlockedColors(loadProgress().unlocked).map((c) => c.hex)];
  return all
    .map((col) => {
      const owner = seats.find((j) => j !== editingSeat && setupLooks[j].color === col);
      const label = owner === undefined ? colorName(col) : t('look.takenBy', { color: colorName(col), name: host!.nameOf(owner) });
      const mark = owner === undefined ? '' : `<span class="swatch-owner" style="color:${inkOn(col)}" aria-hidden="true">${characterDef(setupLooks[owner].character).emoji}</span>`;
      return `<button type="button" class="swatch" role="radio" aria-checked="${col === look.color}" data-color="${col}" style="background:${col}" title="${escapeHtml(label)}" aria-label="${escapeHtml(label)}">${mark}</button>`;
    })
    .join('');
}

// Scelta tra poche opzioni fisse, mostrate tutte come pastiglie.
function chips(attr: string, label: string, options: { value: string; text: string }[], current: string): string {
  return `<div class="look-field"><span class="look-label" id="lbl-${attr}">${label}</span>
    <div class="look-group" role="radiogroup" aria-labelledby="lbl-${attr}">
      ${options.map((o) => `<button type="button" class="chip-btn" role="radio" aria-checked="${o.value === current}" data-${attr}="${o.value}">${o.text}</button>`).join('')}
    </div></div>`;
}

function detailsHtml(look: Appearance): string {
  const def = characterDef(look.character);
  if (def.collection) {
    const extra = collectionLook(look);
    return `<section class="look-section"><h3>${t('look.details')}</h3>
      ${chips('finish', t('look.finish'), FINISHES.map((f) => ({ value: f, text: t(`finish.${f}` as MsgKey) })), extra.finish)}
      ${chips('base-style', t('look.base'), BASE_STYLES.map((b) => ({ value: b, text: t(`base.${b}` as MsgKey) })), extra.baseStyle)}
      <div class="look-field"><span class="look-label" id="lbl-accent">${t('look.accent')}</span>
        <div class="look-group swatches" role="radiogroup" aria-labelledby="lbl-accent">
          ${ACCENT_CHOICES.map((col, k) => `<button type="button" class="swatch" role="radio" aria-checked="${col === extra.accentColor}" data-accent="${col}" style="background:${col}" title="${t(`accent.${k}` as MsgKey)}" aria-label="${t(`accent.${k}` as MsgKey)}"></button>`).join('')}
        </div></div>
    </section>`;
  }
  const items = Object.keys(def.items);
  if (!def.hat && !def.cape && !items.length) return '';
  return `<section class="look-section"><h3>${t('look.details')}</h3>
    <div class="look-toggles">
      ${def.hat ? `<label class="check"><input type="checkbox" data-hat ${look.hat ? 'checked' : ''}> ${t('look.hat')}</label>` : ''}
      ${def.cape ? `<label class="check"><input type="checkbox" data-cape ${look.cape ? 'checked' : ''}> ${t('look.cape')}</label>` : ''}
    </div>
    ${items.length ? chips('item', t('look.inHand'), [{ value: '', text: t('look.nothing') }, ...items.map((id) => ({ value: id, text: itemName(id) }))], look.item ?? '') : ''}
  </section>`;
}

function controlsHtml(look: Appearance): string {
  const shown = CHARACTERS.filter((c) => familyOf(c.id) === family);
  return `
    <section class="look-section">
      <h3 id="lbl-piece">${t('look.piece')}</h3>
      <div class="look-families" role="group" aria-label="${t('look.piece')}">
        ${FAMILIES.map((f) => {
          const n = CHARACTERS.filter((c) => familyOf(c.id) === f).length;
          const mine = familyOf(look.character) === f;
          return `<button type="button" class="family-btn${mine ? ' has-choice' : ''}" aria-pressed="${f === family}" data-look-family="${f}">${t(`look.family.${f}` as MsgKey)} <small>${n}</small></button>`;
        }).join('')}
      </div>
      <div class="look-grid" role="radiogroup" aria-labelledby="lbl-piece">
        ${shown.map((c) => `<button type="button" class="look-tile" role="radio" aria-checked="${c.id === look.character}" data-character="${c.id}"><span class="tile-emoji" aria-hidden="true">${c.emoji}</span><span class="tile-name">${c.label}</span></button>`).join('')}
      </div>
    </section>
    <section class="look-section">
      <h3 id="lbl-color">${t('look.color')}</h3>
      <div class="look-group swatches" role="radiogroup" aria-labelledby="lbl-color">${colorsHtml(look)}</div>
      <p class="hint">${t('look.swapHint')}</p>
    </section>
    ${detailsHtml(look)}`;
}

// Chiave per ritrovare, dopo aver ridisegnato, il controllo che aveva il focus.
const KEY_ATTRS = ['data-character', 'data-color', 'data-accent', 'data-finish', 'data-base-style', 'data-item', 'data-look-family', 'data-hat', 'data-cape', 'data-look-seat'];
function focusKey(el: Element | null): string | null {
  if (!el) return null;
  const attr = KEY_ATTRS.find((a) => el.hasAttribute(a));
  return attr ? `[${attr}="${el.getAttribute(attr)}"]` : null;
}

// Ridisegna la finestra (scelte e posti) tenendo il punto in cui si era e il focus.
function render(): void {
  const dlg = dialogEl();
  if (!dlg || editingSeat === null) return;
  const look = setupLooks[editingSeat];
  const def = characterDef(look.character);
  const body = dlg.querySelector<HTMLElement>('.look-body')!;
  const controls = dlg.querySelector<HTMLElement>('.look-controls')!;
  const top = body.scrollTop;
  const innerTop = controls.scrollTop;
  const key = focusKey(dlg.contains(document.activeElement) ? document.activeElement : null);
  dlg.style.setProperty('--c', look.color);
  dlg.querySelector('#look-title')!.textContent = host ? `${t('look.title')} · ${host.nameOf(editingSeat)}` : t('look.title');
  dlg.querySelector('.look-seats')!.innerHTML = seatsHtml();
  dlg.querySelector('.look-caption')!.innerHTML = `<strong>${escapeHtml(def.label)}</strong> · ${escapeHtml(colorName(look.color))}`;
  controls.innerHTML = controlsHtml(look);
  body.scrollTop = top;
  controls.scrollTop = innerTop;
  if (key) dlg.querySelector<HTMLElement>(key)?.focus();
  showPreview();
}

// Anteprima: 3D se si può (three.js si scarica la prima volta), altrimenti l'emoji grande.
function showPreview(): void {
  const dlg = dialogEl();
  if (!dlg || editingSeat === null) return;
  const box = dlg.querySelector<HTMLElement>('#look-preview')!;
  const seat = editingSeat;
  const emoji = () => {
    box.innerHTML = `<span class="look-emoji">${characterDef(setupLooks[seat].character).emoji}</span>`;
  };
  if (!webglAvailable()) {
    emoji();
    return;
  }
  if (!preview && !box.querySelector('canvas')) box.innerHTML = `<span class="look-loading">${t('look.loading')}</span>`;
  void load3d()
    .then((m) => {
      // nel frattempo la finestra potrebbe essere stata chiusa o passata a un altro posto
      if (editingSeat !== seat || !dlg.open) return;
      if (!preview) {
        box.innerHTML = '';
        preview = new m.CharacterPreview(box);
      }
      void preview.show(setupLooks[seat]);
    })
    .catch(emoji);
}

function save(): void {
  writePref(KEYS.looks, JSON.stringify(setupLooks));
}

function setLook(change: Partial<Appearance>): void {
  if (editingSeat === null) return;
  const seat = editingSeat;
  const look = { ...setupLooks[seat], ...change };
  if (change.character) {
    const def = characterDef(change.character);
    look.item = def.defaultItem;
    // pedina da collezione: si parte dai suoi dettagli proposti
    if (def.collection) Object.assign(look, collectionLook({ ...look, accentColor: def.defaultAccent }));
  }
  // colore già usato da un altro: i due giocatori se lo scambiano
  if (change.color) {
    const other = setupLooks.findIndex((l, j) => j !== seat && l.color === change.color);
    if (other >= 0) {
      setupLooks[other] = { ...setupLooks[other], color: setupLooks[seat].color };
      host?.onChange(other);
    }
  }
  setupLooks[seat] = look;
  save();
  host?.onChange(seat);
  render();
}

// Una pedina a caso, con dettagli a caso se è da collezione (il colore resta).
function randomLook(): void {
  const pick = <T>(list: readonly T[]): T => list[Math.floor(Math.random() * list.length)];
  const current = editingSeat === null ? '' : setupLooks[editingSeat].character;
  const def = pick(CHARACTERS.filter((c) => c.id !== current));
  family = familyOf(def.id);
  setLook({ character: def.id });
  if (def.collection) setLook({ finish: pick(FINISHES), baseStyle: pick(BASE_STYLES), accentColor: pick(ACCENT_CHOICES) });
}

function switchSeat(seat: number): void {
  editingSeat = seat;
  family = familyOf(setupLooks[seat].character);
  render();
}

// Collega la finestra alla schermata: va chiamata dopo aver messo pickerDialogHtml() nella pagina.
export function initPicker(h: PickerHost): void {
  host = h;
  editingSeat = null;
  destroyPreview();
  const dlg = dialogEl();
  if (!dlg) return;
  dlg.addEventListener('click', (e) => {
    // tocco sullo sfondo scuro fuori dalla finestra: si chiude
    if (e.target === dlg) {
      dlg.close();
      return;
    }
    const b = (e.target as HTMLElement).closest<HTMLElement>('button');
    if (!b) return;
    if (b.hasAttribute('data-look-done') || b.hasAttribute('data-look-close')) dlg.close();
    else if (b.hasAttribute('data-look-random')) randomLook();
    else if (b.dataset.lookSeat) switchSeat(Number(b.dataset.lookSeat));
    else if (b.dataset.lookFamily) {
      family = b.dataset.lookFamily as LookFamily;
      render();
    } else if (b.dataset.character) setLook({ character: b.dataset.character });
    else if (b.dataset.color) setLook({ color: b.dataset.color });
    else if (b.dataset.accent) setLook({ accentColor: b.dataset.accent });
    else if (b.dataset.finish) setLook({ finish: b.dataset.finish as FinishId });
    else if (b.dataset.baseStyle) setLook({ baseStyle: b.dataset.baseStyle as BaseStyleId });
    else if (b.dataset.item !== undefined) setLook({ item: b.dataset.item });
  });
  // nei gruppi di scelte (pedine, colori, finiture…) le frecce passano all'opzione vicina e la scelgono
  dlg.addEventListener('keydown', (e) => {
    const el = e.target as HTMLElement;
    const step = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[e.key];
    const group = el.closest('[role=radiogroup]');
    if (!step || el.getAttribute('role') !== 'radio' || !group) return;
    e.preventDefault();
    const options = [...group.querySelectorAll<HTMLElement>('[role=radio]')];
    const next = options[(options.indexOf(el) + step + options.length) % options.length];
    next.focus();
    next.click();
  });
  dlg.addEventListener('change', (e) => {
    const el = e.target as HTMLInputElement;
    if (el.hasAttribute('data-hat')) setLook({ hat: el.checked });
    else if (el.hasAttribute('data-cape')) setLook({ cape: el.checked });
  });
  dlg.addEventListener('close', () => {
    const seat = editingSeat;
    editingSeat = null;
    destroyPreview();
    dlg.querySelector('#look-preview')!.innerHTML = '';
    // il focus torna sulla pedina del posto che si stava modificando
    if (seat !== null) document.querySelector<HTMLElement>(`[data-look="${seat}"]`)?.focus();
  });
}

export function openPicker(seat: number): void {
  const dlg = dialogEl();
  if (!dlg) return;
  editingSeat = seat;
  family = familyOf(setupLooks[seat].character);
  if (!dlg.open) dlg.showModal();
  dlg.querySelector<HTMLElement>('.look-body')!.scrollTop = 0;
  render();
  // il focus va sulla pedina scelta, così con la tastiera si parte da lì
  dlg.querySelector<HTMLElement>('.look-tile[aria-checked=true]')?.focus({ preventScroll: true });
}

export function closePicker(): void {
  const dlg = dialogEl();
  if (dlg?.open) dlg.close();
  else destroyPreview();
}

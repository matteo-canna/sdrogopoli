// Impostazioni di comodità: lingua, dimensione del testo, movimento e volumi. Si salvano nel browser
// e si applicano subito, sia nella schermata iniziale sia in partita.
import { KEYS, readPref, writePref } from './prefs';
import { detectLang, getLang, LANGS, setLang, t, type Lang, type MsgKey } from '../i18n';
import { QUALITIES, type Quality } from './quality';
import { BACKGROUNDS, DEFAULT_BACKGROUND, type BackgroundId } from './setupBackground';
export { motionReduced } from './motion';

export const TEXT_SIZES = [
  { id: 'normale', scale: 1 },
  { id: 'grande', scale: 1.125 },
  { id: 'enorme', scale: 1.25 },
] as const;
export type TextSize = (typeof TEXT_SIZES)[number]['id'];

export const MOTIONS = [{ id: 'sistema' }, { id: 'ridotto' }, { id: 'pieno' }] as const;
export type Motion = (typeof MOTIONS)[number]['id'];

// 'auto': la lingua del browser
export type LangChoice = 'auto' | Lang;

export interface Settings {
  lang: LangChoice;
  quality: Quality;
  text: TextSize;
  motion: Motion;
  // da 0 a 100
  sfxVolume: number;
  musicVolume: number;
  // sfondo animato della schermata iniziale
  background: BackgroundId;
}

export const DEFAULT_SETTINGS: Settings = { lang: 'auto', quality: 'auto', text: 'normale', motion: 'sistema', sfxVolume: 100, musicVolume: 100, background: DEFAULT_BACKGROUND };

function volume(v: unknown, fallback: number): number {
  const n = Math.round(Number(v));
  return Number.isFinite(n) ? Math.min(100, Math.max(0, n)) : fallback;
}

// Legge le impostazioni, scartando i valori sconosciuti.
export function parseSettings(raw: string | null): Settings {
  try {
    const o = JSON.parse(raw ?? '{}') ?? {};
    return {
      lang: LANGS.find((l) => l.id === o.lang)?.id ?? 'auto',
      quality: QUALITIES.find((q) => q.id === o.quality)?.id ?? DEFAULT_SETTINGS.quality,
      text: TEXT_SIZES.find((x) => x.id === o.text)?.id ?? DEFAULT_SETTINGS.text,
      motion: MOTIONS.find((m) => m.id === o.motion)?.id ?? DEFAULT_SETTINGS.motion,
      sfxVolume: volume(o.sfxVolume, DEFAULT_SETTINGS.sfxVolume),
      musicVolume: volume(o.musicVolume, DEFAULT_SETTINGS.musicVolume),
      background: BACKGROUNDS.find((b) => b === o.background) ?? DEFAULT_BACKGROUND,
    };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

export function loadSettings(): Settings {
  return parseSettings(readPref(KEYS.settings));
}

export function saveSettings(s: Settings): void {
  writePref(KEYS.settings, JSON.stringify(s));
}

export function resolveLang(choice: LangChoice, languages: readonly string[] = navigator.languages ?? [navigator.language]): Lang {
  return choice === 'auto' ? detectLang(languages) : choice;
}

// Lingua, testo e movimento passano per attributi della pagina (li legge il CSS); i volumi li applica chi chiama.
export function applySettings(s: Settings): void {
  const root = document.documentElement;
  root.dataset.text = s.text;
  root.dataset.motion = s.motion;
  setLang(resolveLang(s.lang));
}

function radios(name: string, items: readonly { id: string; label: string }[], value: string): string {
  return items
    .map((i) => `<label class="check"><input type="radio" name="${name}" value="${i.id}" ${i.id === value ? 'checked' : ''}> ${i.label}</label>`)
    .join('');
}

function dialogHtml(s: Settings): string {
  const langs = [{ id: 'auto', label: t('settings.langAuto') }, ...LANGS];
  return `
    <h2 id="settings-title">⚙️ ${t('settings.title')}</h2>
    <form data-settings>
      <fieldset><legend>${t('settings.lang')}</legend>${radios('lang', langs, s.lang)}</fieldset>
      <fieldset><legend>${t('settings.text')}</legend>${radios('text', TEXT_SIZES.map((x) => ({ id: x.id, label: t(`settings.text.${x.id}` as MsgKey) })), s.text)}</fieldset>
      <fieldset><legend>${t('settings.motion')}</legend>${radios('motion', MOTIONS.map((x) => ({ id: x.id, label: t(`settings.motion.${x.id}` as MsgKey) })), s.motion)}
        <p class="hint">${t('settings.motionHint')}</p></fieldset>
      <fieldset><legend>${t('settings.background')}</legend>${radios('background', BACKGROUNDS.map((b) => ({ id: b, label: t(`settings.background.${b}` as MsgKey) })), s.background)}</fieldset>
      <fieldset><legend>${t('settings.quality')}</legend>${radios(
        'quality',
        QUALITIES.map((q) => ({ id: q.id, label: t(`settings.quality.${q.id}` as MsgKey) })),
        s.quality,
      )}
        <p class="hint" data-quality-hint>${t('settings.qualityHint')}</p></fieldset>
      <fieldset><legend>${t('settings.volumes')}</legend>
        <label class="range">🔊 ${t('tools.sfxShort')} <input type="range" name="sfxVolume" min="0" max="100" step="5" value="${s.sfxVolume}"><output>${s.sfxVolume}%</output></label>
        <label class="range">🎵 ${t('tools.music')} <input type="range" name="musicVolume" min="0" max="100" step="5" value="${s.musicVolume}"><output>${s.musicVolume}%</output></label>
      </fieldset>
    </form>
    <form method="dialog"><button class="primary">${t('btn.done')}</button></form>`;
}

// Chi vuole sapere che la lingua è cambiata (per ridisegnare la pagina) ascolta questo evento.
export const LANG_EVENT = 'sdrogopoli-lingua';

// Finestra delle impostazioni. Ogni modifica si salva e si applica subito (onChange).
export function openSettings(onChange: (s: Settings) => void): void {
  document.querySelector('.settings-dialog')?.remove();
  const back = document.activeElement as HTMLElement | null;
  const dialog = document.createElement('dialog');
  dialog.className = 'settings-dialog';
  dialog.setAttribute('aria-labelledby', 'settings-title');
  dialog.innerHTML = dialogHtml(loadSettings());
  document.body.append(dialog);
  dialog.addEventListener('input', (e) => {
    const form = dialog.querySelector<HTMLFormElement>('[data-settings]')!;
    const next = parseSettings(JSON.stringify(Object.fromEntries(new FormData(form))));
    const input = e.target as HTMLInputElement;
    if (input.type === 'range') input.nextElementSibling!.textContent = `${input.value}%`;
    const before = getLang();
    saveSettings(next);
    applySettings(next);
    onChange(next);
    if (getLang() !== before) {
      // la finestra si riscrive nella lingua nuova, con il focus sulla stessa scelta
      dialog.innerHTML = dialogHtml(next);
      dialog.querySelector<HTMLInputElement>(`input[name="lang"][value="${next.lang}"]`)?.focus();
      window.dispatchEvent(new Event(LANG_EVENT));
    }
  });
  dialog.addEventListener('close', () => {
    dialog.remove();
    // dopo un cambio di lingua la pagina è stata ridisegnata: il focus va al pulsante delle impostazioni
    (back?.isConnected ? back : document.querySelector<HTMLElement>('[data-settings], [data-action="settings"]'))?.focus();
  });
  dialog.showModal();
}

// Impostazioni di comodità: dimensione del testo, movimento e volumi. Si salvano nel browser
// e si applicano subito, sia nella schermata iniziale sia in partita.
import { KEYS, readPref, writePref } from './prefs';
export { motionReduced } from './motion';

export const TEXT_SIZES = [
  { id: 'normale', label: 'Normale', scale: 1 },
  { id: 'grande', label: 'Grande', scale: 1.125 },
  { id: 'enorme', label: 'Molto grande', scale: 1.25 },
] as const;
export type TextSize = (typeof TEXT_SIZES)[number]['id'];

export const MOTIONS = [
  { id: 'sistema', label: 'Come il dispositivo' },
  { id: 'ridotto', label: 'Ridotto' },
  { id: 'pieno', label: 'Completo' },
] as const;
export type Motion = (typeof MOTIONS)[number]['id'];

export interface Settings {
  text: TextSize;
  motion: Motion;
  // da 0 a 100
  sfxVolume: number;
  musicVolume: number;
}

export const DEFAULT_SETTINGS: Settings = { text: 'normale', motion: 'sistema', sfxVolume: 100, musicVolume: 100 };

function volume(v: unknown, fallback: number): number {
  const n = Math.round(Number(v));
  return Number.isFinite(n) ? Math.min(100, Math.max(0, n)) : fallback;
}

// Legge le impostazioni, scartando i valori sconosciuti.
export function parseSettings(raw: string | null): Settings {
  try {
    const o = JSON.parse(raw ?? '{}') ?? {};
    return {
      text: TEXT_SIZES.find((t) => t.id === o.text)?.id ?? DEFAULT_SETTINGS.text,
      motion: MOTIONS.find((m) => m.id === o.motion)?.id ?? DEFAULT_SETTINGS.motion,
      sfxVolume: volume(o.sfxVolume, DEFAULT_SETTINGS.sfxVolume),
      musicVolume: volume(o.musicVolume, DEFAULT_SETTINGS.musicVolume),
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

// Testo e movimento passano per attributi della pagina (li legge il CSS); i volumi li applica chi chiama.
export function applySettings(s: Settings): void {
  const root = document.documentElement;
  root.dataset.text = s.text;
  root.dataset.motion = s.motion;
}

function radios(name: string, items: readonly { id: string; label: string }[], value: string): string {
  return items
    .map((i) => `<label class="check"><input type="radio" name="${name}" value="${i.id}" ${i.id === value ? 'checked' : ''}> ${i.label}</label>`)
    .join('');
}

// Finestra delle impostazioni. Ogni modifica si salva e si applica subito (onChange).
export function openSettings(onChange: (s: Settings) => void): void {
  document.querySelector('.settings-dialog')?.remove();
  const s = loadSettings();
  const back = document.activeElement as HTMLElement | null;
  const dialog = document.createElement('dialog');
  dialog.className = 'settings-dialog';
  dialog.setAttribute('aria-labelledby', 'settings-title');
  dialog.innerHTML = `
    <h2 id="settings-title">⚙️ Impostazioni</h2>
    <form data-settings>
      <fieldset><legend>Dimensione del testo</legend>${radios('text', TEXT_SIZES, s.text)}</fieldset>
      <fieldset><legend>Movimento</legend>${radios('motion', MOTIONS, s.motion)}
        <p class="hint">Ridotto: niente animazioni lunghe, la pedina salta subito alla casella.</p></fieldset>
      <fieldset><legend>Volumi</legend>
        <label class="range">🔊 Effetti <input type="range" name="sfxVolume" min="0" max="100" step="5" value="${s.sfxVolume}"><output>${s.sfxVolume}%</output></label>
        <label class="range">🎵 Musica <input type="range" name="musicVolume" min="0" max="100" step="5" value="${s.musicVolume}"><output>${s.musicVolume}%</output></label>
      </fieldset>
    </form>
    <form method="dialog"><button class="primary">Fatto</button></form>`;
  document.body.append(dialog);
  const form = dialog.querySelector<HTMLFormElement>('[data-settings]')!;
  form.addEventListener('input', (e) => {
    const data = new FormData(form);
    const next = parseSettings(JSON.stringify(Object.fromEntries(data)));
    const range = e.target as HTMLInputElement;
    if (range.type === 'range') range.nextElementSibling!.textContent = `${range.value}%`;
    saveSettings(next);
    applySettings(next);
    onChange(next);
  });
  dialog.addEventListener('close', () => {
    dialog.remove();
    if (back?.isConnected) back.focus();
  });
  dialog.showModal();
}

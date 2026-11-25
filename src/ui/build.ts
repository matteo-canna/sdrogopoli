// Versione del gioco e momento della build (scritto da vite.config.ts): cambia a ogni pubblicazione,
// così chi gioca vede subito se ha la versione nuova.
import { version } from '../../package.json';
import { getLang } from '../i18n';

declare const __BUILD_TIME__: string;

export function buildLabel(): string {
  const at = typeof __BUILD_TIME__ === 'string' ? new Date(__BUILD_TIME__) : null;
  if (!at || Number.isNaN(at.getTime())) return version;
  const when = at.toLocaleString(getLang() === 'it' ? 'it-IT' : 'en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
  return `${version} (${when})`;
}

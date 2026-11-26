// "Segnala un problema": apre una segnalazione su GitHub già compilata con versione, browser e ultime mosse.
import { buildLabel } from './build';
import { logToText } from './logText';
import type { GameState } from '../engine';
import { getLang, t } from '../i18n';

const ISSUES = 'https://github.com/matteo-canna/sdrogopoli/issues/new';
const REPORT_LOG_LINES = 30;

export function reportUrl(state: GameState | null, view: string, ua = navigator.userAgent): string {
  const lines = [
    `**${t('report.what')}**`,
    '',
    t('report.writeHere'),
    '',
    `**${t('report.details')}**`,
    '',
    `- Versione: ${buildLabel()}`,
    `- Browser: ${ua}`,
    `- Schermo: ${window.innerWidth}×${window.innerHeight}, vista ${view}, lingua ${getLang()}`,
  ];
  if (state) {
    lines.push(`- Giro ${state.round}, ${state.players.length} giocatori, fase ${state.phase}`);
    const recent = logToText(state, 'it').split('\n').filter(Boolean).slice(-REPORT_LOG_LINES);
    lines.push('', 'Ultime righe del registro:', '', ...recent.map((l) => `> ${l}`));
  }
  const params = new URLSearchParams({ title: t('report.titlePrefix'), body: lines.join('\n'), labels: 'segnalazione' });
  return `${ISSUES}?${params}`;
}

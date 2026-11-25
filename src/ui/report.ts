// "Segnala un problema": apre una segnalazione su GitHub già compilata con versione, browser e ultime mosse.
import { buildLabel } from './build';
import type { GameState } from '../engine';
import { format, getLang, t } from '../i18n';

const ISSUES = 'https://github.com/matteo-canna/sdrogopoli/issues/new';

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
    lines.push('', 'Ultime righe del registro:', '', ...state.log.slice(-8).map((l) => `> ${typeof l === 'string' ? l : format('it', l.k, l.p)}`));
  }
  const params = new URLSearchParams({ title: t('report.titlePrefix'), body: lines.join('\n'), labels: 'segnalazione' });
  return `${ISSUES}?${params}`;
}

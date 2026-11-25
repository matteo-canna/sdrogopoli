// "Segnala un problema": apre una segnalazione su GitHub già compilata con versione, browser e ultime mosse.
import { version } from '../../package.json';
import type { GameState } from '../engine';

const ISSUES = 'https://github.com/matteo-canna/sdrogopoli/issues/new';

export function reportUrl(state: GameState | null, view: string, ua = navigator.userAgent): string {
  const lines = [
    '**Cosa è successo?**',
    '',
    '(scrivi qui cosa stavi facendo e cosa non ha funzionato)',
    '',
    '**Dettagli tecnici** (compilati dal gioco)',
    '',
    `- Versione: ${version}`,
    `- Browser: ${ua}`,
    `- Schermo: ${window.innerWidth}×${window.innerHeight}, vista ${view}`,
  ];
  if (state) {
    lines.push(`- Giro ${state.round}, ${state.players.length} giocatori, fase ${state.phase}`);
    lines.push('', 'Ultime righe del registro:', '', ...state.log.slice(-8).map((l) => `> ${l}`));
  }
  const params = new URLSearchParams({ title: 'Problema: ', body: lines.join('\n'), labels: 'segnalazione' });
  return `${ISSUES}?${params}`;
}

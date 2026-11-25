// Tipi di partita pronti: regole della casa già scelte, con la durata misurata dalla simulazione
// (`npm run preset`, 4 computer normali, 300 partite: giri della mediana).
import type { GameRules } from './state';

export interface Preset {
  id: string;
  label: string;
  text: string;
  rules: Partial<GameRules>;
  // giri della mediana in 4 giocatori (misurati)
  rounds: number;
}

// secondi di un turno di una persona, per stimare i minuti (un turno del computer dura molto meno)
export const SECONDS_PER_TURN = 25;

export const PRESETS: Preset[] = [
  { id: 'classica', label: 'Classica', text: 'Si gioca finché resta uno solo.', rules: {}, rounds: 46 },
  { id: 'rapida', label: 'Rapida', text: 'Ognuno parte con qualche proprietà a caso.', rules: { quickStart: true }, rounds: 28 },
  { id: 'sprint', label: 'Sprint', text: 'Partita rapida con il Dado Sprint: occasioni e affitti pieni.', rules: { quickStart: true, sprintDie: true }, rounds: 26 },
  { id: 'obiettivo', label: 'Obiettivo', text: 'Vince chi per primo completa 2 quartieri o arriva a 4000 di patrimonio.', rules: { goalGroups: 2, goalWorth: 4000 }, rounds: 21 },
  { id: 'breve', label: 'Breve', text: '15 giri, poi vince il patrimonio più alto.', rules: { quickStart: true, maxRounds: 15 }, rounds: 15 },
];

// Minuti stimati per una partita con queste persone (i computer giocano in pochi secondi).
export function estimatedMinutes(preset: Pick<Preset, 'rounds'>, people: number, bots: number): number {
  const perRound = people * SECONDS_PER_TURN + bots * 4;
  return Math.max(5, Math.round((preset.rounds * perRound) / 60 / 5) * 5);
}

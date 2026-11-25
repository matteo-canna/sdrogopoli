// Reazioni e frasi pronte da mandare al tavolo. Niente testo libero: niente da moderare.
import { t, type MsgKey } from '../i18n';
export interface QuickSay {
  id: string;
  text: string;
}

export const QUICK_SAYS: QuickSay[] = [
  { id: 'applausi', text: '👏' },
  { id: 'risata', text: '😂' },
  { id: 'paura', text: '😱' },
  { id: 'rabbia', text: '😤' },
  { id: 'festa', text: '🎉' },
  { id: 'ok', text: '👍' },
  { id: 'ciao', text: 'Ciao a tutti! 👋' },
  { id: 'bella', text: 'Bella mossa!' },
  { id: 'fortuna', text: 'Che fortuna!' },
  { id: 'sfortuna', text: 'Che sfortuna…' },
  { id: 'pensa', text: 'Ci sto pensando…' },
  { id: 'scambio', text: 'Facciamo uno scambio?' },
  { id: 'veloce', text: 'Dai, tocca a te!' },
  { id: 'gg', text: 'Bella partita!' },
];

// Il testo nella lingua scelta (le faccine restano uguali). null se l'id non è tra quelli previsti.
export function sayText(id: unknown): string | null {
  const q = QUICK_SAYS.find((x) => x.id === id);
  if (!q) return null;
  return /\p{L}/u.test(q.text) ? t(`say.${q.id}` as MsgKey) : q.text;
}

// al massimo un messaggio ogni tanto per posto
export const SAY_GAP_MS = 1500;

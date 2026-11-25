// Reazioni e frasi pronte da mandare al tavolo. Niente testo libero: niente da moderare.
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

export function sayText(id: unknown): string | null {
  return QUICK_SAYS.find((q) => q.id === id)?.text ?? null;
}

// al massimo un messaggio ogni tanto per posto
export const SAY_GAP_MS = 1500;

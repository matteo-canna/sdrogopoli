// Annunci per i lettori di schermo (VoiceOver, TalkBack, NVDA): una regione "live" fuori dal
// tabellone, che non si ridisegna mai, così ogni frase si sente una volta sola.
import { actingPlayer, type GameState } from '../engine';
import { t, text } from '../i18n';

// Le frasi da leggere dopo una mossa: le righe nuove del registro (dadi, pagamenti, carte)
// e, se cambia chi deve giocare, di chi è il turno. `me` è il posto di chi usa questo dispositivo.
export function moveAnnouncement(prev: GameState, next: GameState, me: number | null): string[] {
  const fresh = Math.min(Math.max((next.eventCount ?? 0) - (prev.eventCount ?? 0), 0), next.log.length, 8);
  const lines = fresh ? next.log.slice(-fresh).map(text) : [];
  if (next.phase === 'gameOver') return lines;
  const who = actingPlayer(next);
  if (who !== actingPlayer(prev) || next.current !== prev.current) {
    const p = next.players[who];
    // il motore scrive già "Tocca a …" a fine turno: non si ripete, al più si dice "a te"
    const plain = t('log.turn', { name: p.name });
    const said = lines.indexOf(plain);
    const line = who === me && !p.isBot ? t('announce.yourTurn', { name: p.name }) : plain;
    if (said >= 0) lines[said] = line;
    else lines.push(line);
  }
  return lines;
}

let region: HTMLElement | null = null;
let queue: string[] = [];
let timer: ReturnType<typeof setTimeout> | null = null;

function liveRegion(): HTMLElement {
  if (region?.isConnected) return region;
  region = document.createElement('div');
  region.id = 'annunci';
  region.className = 'sr-only';
  region.setAttribute('role', 'status');
  region.setAttribute('aria-live', 'polite');
  region.setAttribute('aria-atomic', 'true');
  document.body.append(region);
  return region;
}

// Le frasi che arrivano insieme (per esempio le mosse veloci del computer) si leggono in un colpo solo.
export function announce(...lines: string[]): void {
  const text = lines.filter(Boolean);
  if (!text.length) return;
  const el = liveRegion();
  queue.push(...text);
  if (timer) return;
  timer = setTimeout(() => {
    timer = null;
    el.textContent = queue.slice(-10).join(' ');
    queue = [];
  }, 120);
}

// Testo dell'ultimo annuncio (per le prove).
export function lastAnnouncement(): string {
  return region?.textContent ?? '';
}

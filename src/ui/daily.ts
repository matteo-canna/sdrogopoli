// Partita del giorno: ogni giorno lo stesso seme per tutti, così si confrontano i risultati.
// Niente server e niente classifica online: il risultato si condivide a parole, come si vuole.
import { netWorth, type GameContext, type GameState } from '../engine';
import { board } from '../data';
import { standings } from './summary';
import { t } from '../i18n';

// Il giorno come "2026-11-25" nel fuso di chi gioca.
export function dayId(now = new Date()): string {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

// Seme del giorno: dalla data, uguale per tutti e diverso ogni giorno (hash FNV-1a a 32 bit).
export function dailySeed(day = dayId()): number {
  let h = 0x811c9dc5;
  for (const ch of `sdrogopoli-${day}`) {
    h ^= ch.charCodeAt(0);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h >>> 0;
}

// Le regole della partita del giorno: uguali per tutti, corte, con i computer sempre uguali.
export const DAILY_ROUNDS = 15;
export const DAILY_BOTS = 3;

export function dailyPlayers(name: string): { name: string; isBot?: boolean; bot?: { level: 'normale'; style: 'equilibrato' | 'costruttore' | 'collezionista' } }[] {
  const styles = ['equilibrato', 'costruttore', 'collezionista'] as const;
  return [
    { name },
    ...Array.from({ length: DAILY_BOTS }, (_, i) => ({ name: t('daily.bot', { n: i + 1 }), isBot: true, bot: { level: 'normale' as const, style: styles[i] } })),
  ];
}

// Risultato del giorno già giocato, ricordato nel browser.
export interface DailyResult {
  day: string;
  worth: number;
  place: number;
  players: number;
}

export function parseDaily(raw: string | null): DailyResult | null {
  try {
    const o = JSON.parse(raw ?? 'null');
    if (!o || typeof o.day !== 'string' || !Number.isFinite(o.worth) || !Number.isFinite(o.place)) return null;
    return { day: o.day, worth: Math.round(o.worth), place: Math.round(o.place), players: Math.round(o.players) || 0 };
  } catch {
    return null;
  }
}

// Il risultato della partita del giorno appena finita, per chi la stava giocando.
export function dailyResult(state: GameState, ctx: GameContext, seat: number, day = dayId()): DailyResult {
  const order = standings(state, ctx);
  return { day, worth: netWorth(state, ctx, seat), place: order.indexOf(seat) + 1, players: state.players.length };
}

// Il riassunto da copiare e mandare agli amici (niente link, niente immagini: solo testo).
export function dailyText(r: DailyResult): string {
  const medal = ['🥇', '🥈', '🥉'][r.place - 1] ?? `${r.place}°`;
  return `${t('daily.title')} ${r.day}\n${medal} ${t('daily.placeOf', { place: r.place, players: r.players })} · ${t('summary.worth', { amount: `${board.currency.symbol} ${r.worth}` })}`;
}

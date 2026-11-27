// Quello che arriva dagli altri dispositivi non è affidabile: nomi e aspetto si ripuliscono.
import { DEMO_MAX_PLAYERS, type Appearance } from '../engine';
import { REMATCH_TIMEOUT_MS } from './protocol';
import { CHARACTERS, COLOR_CHOICES, collectionLook, defaultAppearance } from '../ui/characters';

export const MAX_NAME = 20;

export function cleanName(raw: unknown, fallback: string): string {
  const s = typeof raw === 'string' ? raw.replace(/[\u0000-\u001f\u007f]/g, '').trim().slice(0, MAX_NAME) : '';
  return s || fallback;
}

export function cleanLook(raw: unknown, seat: number): Appearance {
  const base = defaultAppearance(seat);
  if (!raw || typeof raw !== 'object') return base;
  const r = raw as Partial<Appearance>;
  const def = CHARACTERS.find((c) => c.id === r.character);
  if (!def) return base;
  return {
    character: def.id,
    color: typeof r.color === 'string' && /^#[0-9a-f]{6}$/i.test(r.color) ? r.color : base.color,
    hat: r.hat !== false,
    cape: r.cape !== false,
    item: typeof r.item === 'string' && (r.item === '' || r.item in def.items) ? r.item : def.defaultItem,
    // pedine da collezione: finitura, dettagli e basetta (valori sconosciuti tornano a quelli proposti)
    ...(def.collection ? collectionLook({ ...r, character: def.id } as Appearance) : {}),
  };
}

export function uniqueColors(looks: Appearance[]): Appearance[] {
  const used = new Set<string>();
  return looks.map((l) => {
    const color = used.has(l.color) ? COLOR_CHOICES.find((c) => !used.has(c)) ?? l.color : l.color;
    used.add(color);
    return color === l.color ? l : { ...l, color };
  });
}

function cleanSeats(raw: unknown, maxSeats: number): number[] | null {
  if (!Array.isArray(raw)) return null;
  const out: number[] = [];
  for (const x of raw) {
    if (!Number.isInteger(x) || (x as number) < 0 || (x as number) >= maxSeats) return null;
    if (!out.includes(x as number)) out.push(x as number);
  }
  return out;
}

// Valida la risposta di un ospite alla proposta di rivincita.
export function cleanRematchReply(raw: unknown): { t: 'rematchReply'; accept: boolean } | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as { t?: unknown; accept?: unknown };
  if (r.t !== 'rematchReply' || typeof r.accept !== 'boolean') return null;
  return { t: 'rematchReply', accept: r.accept };
}

// Valida lo stato della proposta di rivincita mandato dall'oste agli ospiti.
export function cleanRematchProposal(
  raw: unknown,
  maxSeats = DEMO_MAX_PLAYERS,
): { t: 'rematch'; accepted: number[]; declined: number[]; pending: number[]; timeoutMs: number } | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as { t?: unknown; accepted?: unknown; declined?: unknown; pending?: unknown; timeoutMs?: unknown };
  if (r.t !== 'rematch') return null;
  const limit = Number.isInteger(maxSeats) && maxSeats > 0 ? maxSeats : DEMO_MAX_PLAYERS;
  const accepted = cleanSeats(r.accepted, limit);
  const declined = cleanSeats(r.declined, limit);
  const pending = cleanSeats(r.pending, limit);
  if (!accepted || !declined || !pending) return null;
  const timeoutMs = typeof r.timeoutMs === 'number' && Number.isFinite(r.timeoutMs) && r.timeoutMs > 0 ? Math.floor(r.timeoutMs) : REMATCH_TIMEOUT_MS;
  return { t: 'rematch', accepted, declined, pending, timeoutMs };
}

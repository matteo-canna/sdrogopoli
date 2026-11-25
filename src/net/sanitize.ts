// Quello che arriva dagli altri dispositivi non è affidabile: nomi e aspetto si ripuliscono.
import type { Appearance } from '../engine';
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

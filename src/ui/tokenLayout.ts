// Dove stanno le pedine dentro una casella (in unità del tabellone 3D: la casella è larga 1).
// Funzione pura, senza Three.js, così si può provare nei test.

export interface Slot {
  x: number;
  z: number;
}

// Fino a 4 giocatori: i quattro angoli, come sempre.
const FOUR: Slot[] = [
  { x: -0.2, z: -0.2 },
  { x: 0.2, z: -0.2 },
  { x: -0.2, z: 0.2 },
  { x: 0.2, z: 0.2 },
];

// Da 5 a 8: una griglia 3×3 senza il centro (prima gli angoli, poi i lati).
const STEP = 0.28;
const EIGHT: Slot[] = [
  { x: -STEP, z: -STEP },
  { x: STEP, z: -STEP },
  { x: -STEP, z: STEP },
  { x: STEP, z: STEP },
  { x: 0, z: -STEP },
  { x: STEP, z: 0 },
  { x: 0, z: STEP },
  { x: -STEP, z: 0 },
];

// Da 9 a 12 (modalità demo): griglia di 4 colonne per 3 file.
const COL = 0.22;
const ROW = 0.27;
const TWELVE: Slot[] = [];
for (let r = 0; r < 3; r++) {
  for (let c = 0; c < 4; c++) TWELVE.push({ x: (c - 1.5) * COL, z: (r - 1) * ROW });
}

function slotsFor(playerCount: number): Slot[] {
  if (playerCount > EIGHT.length) return TWELVE;
  return playerCount > FOUR.length ? EIGHT : FOUR;
}

// Posto della pedina di un giocatore dentro la casella.
export function tokenSlot(playerId: number, playerCount: number): Slot {
  const slots = slotsFor(playerCount);
  return slots[playerId % slots.length];
}

// In tanti le pedine si rimpiccioliscono per non toccarsi.
export function tokenScale(playerCount: number): number {
  if (playerCount > EIGHT.length) return 0.62;
  return playerCount > FOUR.length ? 0.8 : 1;
}

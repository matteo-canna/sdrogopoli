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

// Posto della pedina di un giocatore dentro la casella.
export function tokenSlot(playerId: number, playerCount: number): Slot {
  const slots = playerCount > FOUR.length ? EIGHT : FOUR;
  return slots[playerId % slots.length];
}

// In tanti le pedine si rimpiccioliscono un po' per non toccarsi.
export function tokenScale(playerCount: number): number {
  return playerCount > FOUR.length ? 0.8 : 1;
}

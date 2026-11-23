// Generatore di numeri casuali iniettabile: restituisce un valore in [0, 1).
// Il motore non usa mai Math.random direttamente, così i test sono deterministici.
export type Rng = () => number;

export interface DiceRoll {
  dice: [number, number];
  total: number;
  isDouble: boolean;
}

// Lancia un singolo dado a 6 facce.
export function rollDie(rng: Rng): number {
  return Math.floor(rng() * 6) + 1;
}

// Lancia due dadi e indica se il risultato è un doppio.
export function rollDice(rng: Rng): DiceRoll {
  const a = rollDie(rng);
  const b = rollDie(rng);
  return { dice: [a, b], total: a + b, isDouble: a === b };
}

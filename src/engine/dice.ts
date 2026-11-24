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

// Generatore casuale ripetibile (mulberry32): stessa partita con lo stesso seme.
// Serve per i test e per le simulazioni di bilanciamento.
export function seededRng(seed: number): Rng {
  let a = seed >>> 0;
  return () => {
    const [value, next] = rngStep(a);
    a = next;
    return value;
  };
}

// Un passo del generatore: dal suo stato (un intero a 32 bit) restituisce il valore e lo stato successivo.
// Lo stato sta nella partita salvata, così i dadi continuano uguali anche dopo averla ricaricata.
export function rngStep(state: number): [number, number] {
  const a = (state + 0x6d2b79f5) >>> 0;
  let t = a;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return [((t ^ (t >>> 14)) >>> 0) / 4294967296, a];
}

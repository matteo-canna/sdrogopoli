import { describe, it, expect } from 'vitest';
import { rollDie, rollDice } from '../src/engine';

// Crea un RNG che restituisce in sequenza i valori indicati.
function fixedRng(values: number[]) {
  let i = 0;
  return () => values[i++ % values.length];
}

describe('dadi', () => {
  it('un dado restituisce valori da 1 a 6', () => {
    expect(rollDie(() => 0)).toBe(1);
    expect(rollDie(() => 0.999)).toBe(6);
  });

  it('due dadi: somma e doppio', () => {
    const roll = rollDice(fixedRng([0.5, 0.5]));
    expect(roll.dice).toEqual([4, 4]);
    expect(roll.total).toBe(8);
    expect(roll.isDouble).toBe(true);
  });

  it('due dadi diversi non sono un doppio', () => {
    const roll = rollDice(fixedRng([0, 0.99]));
    expect(roll.total).toBe(7);
    expect(roll.isDouble).toBe(false);
  });
});

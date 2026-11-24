import { describe, it, expect } from 'vitest';
import { tokenScale, tokenSlot } from '../src/ui/tokenLayout';
import { MAX_PLAYERS } from '../src/engine';

// raggio della base della pedina semplice nel 3D (vedi makeToken in board3d.ts)
const TOKEN_RADIUS = 0.17;

describe('pedine nella stessa casella', () => {
  for (let n = 2; n <= MAX_PLAYERS; n++) {
    it(`con ${n} giocatori non si sovrappongono e restano nella casella`, () => {
      const r = TOKEN_RADIUS * tokenScale(n);
      const slots = Array.from({ length: n }, (_, id) => tokenSlot(id, n));
      for (const s of slots) {
        expect(Math.abs(s.x) + r).toBeLessThanOrEqual(0.48);
        expect(Math.abs(s.z) + r).toBeLessThanOrEqual(0.48);
      }
      for (let a = 0; a < n; a++) {
        for (let b = a + 1; b < n; b++) {
          const d = Math.hypot(slots[a].x - slots[b].x, slots[a].z - slots[b].z);
          expect(d).toBeGreaterThanOrEqual(2 * r - 0.01);
        }
      }
    });
  }

  it('fino a 4 giocatori le pedine restano dove erano', () => {
    expect(tokenSlot(3, 4)).toEqual({ x: 0.2, z: 0.2 });
    expect(tokenScale(4)).toBe(1);
  });
});

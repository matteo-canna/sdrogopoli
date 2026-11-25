// Misure e posizioni del tabellone 3D (una unità per casella, centrato nell'origine:
// un tabellone da 40 caselle occupa 11×11 unità, uno da 28 ne occupa 8×8).
import * as THREE from 'three';
import { board } from '../../data';
import { gridPosition, gridSide, perSide } from '../view';

// Quante caselle ha il tabellone in uso, e quanto è larga la sua griglia in unità.
export function boardSize(): number {
  return board.spaces.length;
}

export function boardSide(): number {
  return gridSide();
}

export const TILE = 0.96;
export const HOP_SECONDS = 0.22;
// Grandezza dei personaggi-pedina (la testa grande li rende un po' più alti di così).
export const CHARACTER_HEIGHT = 0.5;

// Posizione nel mondo 3D del centro di una casella.
export function spaceCenter(index: number): THREE.Vector3 {
  const { row, col } = gridPosition(index);
  const mid = (gridSide() + 1) / 2;
  return new THREE.Vector3(col - mid, 0, row - mid);
}

// Rotazione del testo: si legge guardando la casella dall'esterno del tabellone.
export function textRotation(index: number): number {
  const n = perSide();
  if (index < n) return 0;
  if (index < 2 * n) return -Math.PI / 2;
  if (index < 3 * n) return Math.PI;
  return Math.PI / 2;
}

// Verso cui guarda un personaggio fermo: fuori dal tabellone, cioè verso chi guarda.
export function restYaw(pos: THREE.Vector3): number {
  if (Math.abs(pos.x) > Math.abs(pos.z)) return pos.x > 0 ? Math.PI / 2 : -Math.PI / 2;
  return pos.z > 0 ? 0 : Math.PI;
}

// Rotazione più breve da un angolo all'altro.
export function turnTowards(from: number, to: number, k: number): number {
  let d = (to - from) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d < -Math.PI) d += Math.PI * 2;
  return from + d * k;
}

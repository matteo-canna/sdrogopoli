// Misure e posizioni del tabellone 3D (11×11 unità centrato nell'origine).
import * as THREE from 'three';
import { board } from '../../data';
import { gridPosition } from '../view';

export const SIZE = board.spaces.length;
export const TILE = 0.96;
export const HOP_SECONDS = 0.22;
// Grandezza dei personaggi-pedina (la testa grande li rende un po' più alti di così).
export const CHARACTER_HEIGHT = 0.5;

// Posizione nel mondo 3D del centro di una casella.
export function spaceCenter(index: number): THREE.Vector3 {
  const { row, col } = gridPosition(index);
  return new THREE.Vector3(col - 6, 0, row - 6);
}

// Rotazione del testo: si legge guardando la casella dall'esterno del tabellone.
export function textRotation(index: number): number {
  if (index < 10) return 0;
  if (index < 20) return -Math.PI / 2;
  if (index < 30) return Math.PI;
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

// 20 modelli 3D realistici ad alto dettaglio per le pedine di Sdrogopoli.
// Ogni modello usa geometrie scolpite (LatheGeometry, ExtrudeGeometry smussate, TubeGeometry) e materiali PBR.
import * as THREE from 'three';
import type { BaseStyleId } from '../../engine';
import {
  arcadeMarqueeTex,
  arcadeScreenTex,
  arcadeSideArtTex,
  cameraBadgeTex,
  cameraDialTex,
  cameraLcdTex,
  carbonTex,
  globeMapTex,
  horizonRingTex,
  lensScaleTex,
  licensePlateTex,
  marbleTex,
  skyscraperTex,
  speedometerTex,
  vinylTex,
  watchDialTex,
  woodTex,
  type Palette,
} from './materials';
import { FIGURINE_BUILDERS, type CharacterRig } from './figurines';

export interface AnimParts {
  wheels?: THREE.Object3D[];
  spinY?: THREE.Object3D[];
  spinZ?: THREE.Object3D[];
  gears?: { obj: THREE.Object3D; speed: number }[];
  beacon?: THREE.Object3D;
  secondHand?: THREE.Object3D;
  minuteHand?: THREE.Object3D;
  pulse?: THREE.Mesh[];
  charRig?: CharacterRig;
}

export interface BuiltModel {
  group: THREE.Group;
  anim: AnimParts;
}

// Helper compatti per posizionamento e creazione mesh con ombre
export function add(
  parent: THREE.Object3D,
  geo: THREE.BufferGeometry,
  mat: THREE.Material,
  x = 0, y = 0, z = 0,
  rx = 0, ry = 0, rz = 0,
): THREE.Mesh {
  const m = new THREE.Mesh(geo, mat);
  m.position.set(x, y, z);
  m.rotation.set(rx, ry, rz);
  m.castShadow = true;
  m.receiveShadow = true;
  parent.add(m);
  return m;
}

export function tube(
  parent: THREE.Object3D,
  pts: [number, number, number][],
  radius: number,
  mat: THREE.Material,
  tubularSegments = 24,
  radialSegments = 10,
  closed = false,
): THREE.Mesh {
  const curve = new THREE.CatmullRomCurve3(pts.map((p) => new THREE.Vector3(...p)));
  return add(parent, new THREE.TubeGeometry(curve, tubularSegments, radius, radialSegments, closed), mat);
}

export function lathe(
  parent: THREE.Object3D,
  pts: [number, number][],
  mat: THREE.Material,
  segments = 36,
  y = 0,
): THREE.Mesh {
  const v = pts.map(([r, h]) => new THREE.Vector2(r, h));
  return add(parent, new THREE.LatheGeometry(v, segments), mat, 0, y, 0);
}

export function extrude(
  parent: THREE.Object3D,
  pts: [number, number][],
  depth: number,
  bevel: number,
  mat: THREE.Material,
  x = 0, y = 0, z = 0,
  rx = 0, ry = 0, rz = 0,
): THREE.Mesh {
  const sh = new THREE.Shape();
  pts.forEach(([px, py], i) => (i === 0 ? sh.moveTo(px, py) : sh.lineTo(px, py)));
  sh.closePath();
  const geo = new THREE.ExtrudeGeometry(sh, {
    depth,
    bevelEnabled: bevel > 0,
    bevelThickness: bevel,
    bevelSize: bevel,
    bevelSegments: 3,
  });
  geo.translate(0, 0, -depth / 2);
  return add(parent, geo, mat, x, y, z, rx, ry, rz);
}

function makeDetailedWheel(
  radius: number,
  width: number,
  p: Palette,
  opts: { whitewall?: boolean; spokes?: number; stripeMat?: THREE.Material } = {},
): THREE.Group {
  const g = new THREE.Group();
  // Pneumatico smussato con profilo toroidale + cilindro interno
  add(g, new THREE.CylinderGeometry(radius, radius, width * 0.72, 28), p.rubber, 0, 0, 0, 0, 0, Math.PI / 2);
  add(g, new THREE.TorusGeometry(radius - width * 0.14, width * 0.15, 10, 28), p.rubber, -width * 0.34, 0, 0, 0, Math.PI / 2);
  add(g, new THREE.TorusGeometry(radius - width * 0.14, width * 0.15, 10, 28), p.rubber, width * 0.34, 0, 0, 0, Math.PI / 2);

  if (opts.whitewall) {
    add(g, new THREE.TorusGeometry(radius * 0.72, radius * 0.12, 8, 28), p.white, width * 0.45, 0, 0, 0, Math.PI / 2);
    add(g, new THREE.TorusGeometry(radius * 0.72, radius * 0.12, 8, 28), p.white, -width * 0.45, 0, 0, 0, Math.PI / 2);
  }
  if (opts.stripeMat) {
    add(g, new THREE.TorusGeometry(radius * 0.82, radius * 0.045, 8, 28), opts.stripeMat, width * 0.48, 0, 0, 0, Math.PI / 2);
    add(g, new THREE.TorusGeometry(radius * 0.82, radius * 0.045, 8, 28), opts.stripeMat, -width * 0.48, 0, 0, 0, Math.PI / 2);
  }

  // Cerchio e mozzo
  const rimR = radius * 0.56;
  add(g, new THREE.CylinderGeometry(rimR, rimR, width * 0.85, 22), p.darkMetal, 0, 0, 0, 0, 0, Math.PI / 2);
  add(g, new THREE.TorusGeometry(rimR, radius * 0.055, 8, 24), p.chrome, width * 0.43, 0, 0, 0, Math.PI / 2);
  add(g, new THREE.TorusGeometry(rimR, radius * 0.055, 8, 24), p.chrome, -width * 0.43, 0, 0, 0, Math.PI / 2);

  const spokes = opts.spokes ?? 6;
  for (let i = 0; i < spokes; i++) {
    const a = (i / spokes) * Math.PI * 2;
    add(g, new THREE.BoxGeometry(width * 0.88, radius * 0.06, rimR * 1.85), p.chrome, 0, 0, 0, a, 0, 0);
  }
  add(g, new THREE.CylinderGeometry(radius * 0.16, radius * 0.16, width * 0.96, 14), p.brass, 0, 0, 0, 0, 0, Math.PI / 2);
  return g;
}


export function makeCogwheel(outerR: number, teeth: number, thickness: number, mat: THREE.Material, hubMat?: THREE.Material): THREE.Group {
  const g = new THREE.Group();
  const innerR = outerR * 0.78;
  // Anello esterno + mozzo centrale + 4 razze
  add(g, new THREE.TorusGeometry(innerR * 0.78, outerR * 0.14, 8, 20), mat);
  add(g, new THREE.CylinderGeometry(outerR * 0.24, outerR * 0.24, thickness * 1.4, 14), hubMat ?? mat, 0, 0, 0, Math.PI / 2);
  for (let s = 0; s < 4; s++) {
    const a = (s / 4) * Math.PI * 2;
    add(g, new THREE.BoxGeometry(innerR * 1.45, outerR * 0.1, thickness * 0.85), mat, 0, 0, 0, 0, 0, a);
  }
  const toothW = (Math.PI * 2 * innerR) / (teeth * 2.15);
  const toothH = outerR - innerR;
  for (let i = 0; i < teeth; i++) {
    const a = (i / teeth) * Math.PI * 2;
    add(g, new THREE.BoxGeometry(toothW, toothH * 1.35, thickness), mat, Math.cos(a) * (innerR + toothH * 0.35), Math.sin(a) * (innerR + toothH * 0.35), 0, 0, 0, a - Math.PI / 2);
  }
  return g;
}

// ---------- Basette / Piedistalli realistici ----------
export function buildPedestal(style: BaseStyleId, primaryHex: string, accentHex: string): { group: THREE.Group; topY: number } {
  const g = new THREE.Group();
  if (style === 'none') return { group: g, topY: 0 };

  const primary = new THREE.Color(primaryHex);
  const accent = new THREE.Color(accentHex);

  if (style === 'marble') {
    const marbleMat = new THREE.MeshPhysicalMaterial({ map: marbleTex(), roughness: 0.14, metalness: 0.04, clearcoat: 0.85 });
    const rimMat = new THREE.MeshStandardMaterial({ color: primary, roughness: 0.25, metalness: 0.5 });
    const brass = new THREE.MeshStandardMaterial({ color: 0xd9a74a, roughness: 0.2, metalness: 0.92 });
    add(g, new THREE.CylinderGeometry(0.46, 0.52, 0.1, 32), marbleMat, 0, 0.05, 0);
    add(g, new THREE.TorusGeometry(0.48, 0.018, 10, 36), brass, 0, 0.098, 0, Math.PI / 2);
    add(g, new THREE.TorusGeometry(0.515, 0.018, 10, 36), rimMat, 0, 0.018, 0, Math.PI / 2);
    return { group: g, topY: 0.105 };
  }

  if (style === 'walnut') {
    const wood = new THREE.MeshStandardMaterial({ map: woodTex('walnut'), roughness: 0.42, metalness: 0.05 });
    const felt = new THREE.MeshStandardMaterial({ color: primary, roughness: 0.85, metalness: 0.02 });
    const brass = new THREE.MeshStandardMaterial({ color: 0xd9a74a, roughness: 0.22, metalness: 0.92 });
    lathe(g, [[0.52, 0], [0.52, 0.03], [0.47, 0.06], [0.49, 0.09], [0.45, 0.12], [0, 0.12]], wood, 36);
    add(g, new THREE.CylinderGeometry(0.42, 0.42, 0.012, 32), felt, 0, 0.122, 0);
    // Targhetta frontale in ottone
    add(g, new THREE.BoxGeometry(0.22, 0.055, 0.025), brass, 0, 0.06, 0.49);
    return { group: g, topY: 0.128 };
  }

  if (style === 'coin') {
    const gold = new THREE.MeshStandardMaterial({ color: 0xf4c442, roughness: 0.18, metalness: 0.95 });
    const ring = new THREE.MeshStandardMaterial({ color: primary, roughness: 0.28, metalness: 0.5 });
    add(g, new THREE.CylinderGeometry(0.47, 0.47, 0.075, 40), gold, 0, 0.0375, 0);
    add(g, new THREE.TorusGeometry(0.43, 0.026, 10, 36), ring, 0, 0.074, 0, Math.PI / 2);
    // Zigrinatura bordo moneta
    for (let i = 0; i < 24; i++) {
      const a = (i / 24) * Math.PI * 2;
      add(g, new THREE.BoxGeometry(0.015, 0.072, 0.025), gold, Math.cos(a) * 0.472, 0.037, Math.sin(a) * 0.472, 0, -a, 0);
    }
    return { group: g, topY: 0.08 };
  }

  if (style === 'carbon') {
    const carb = new THREE.MeshPhysicalMaterial({ map: carbonTex(), roughness: 0.26, metalness: 0.25, clearcoat: 0.85 });
    const neon = new THREE.MeshStandardMaterial({ color: primary, emissive: primary, emissiveIntensity: 1.5, roughness: 0.15 });
    const acc = new THREE.MeshStandardMaterial({ color: accent, roughness: 0.2, metalness: 0.8 });
    add(g, new THREE.CylinderGeometry(0.46, 0.5, 0.08, 16), carb, 0, 0.04, 0);
    add(g, new THREE.TorusGeometry(0.48, 0.022, 12, 36), neon, 0, 0.042, 0, Math.PI / 2);
    add(g, new THREE.TorusGeometry(0.42, 0.01, 8, 32), acc, 0, 0.082, 0, Math.PI / 2);
    return { group: g, topY: 0.086 };
  }

  // minimal: disco sottile satinato + anello nel colore giocatore
  const disc = new THREE.MeshPhysicalMaterial({ color: 0x222730, roughness: 0.35, metalness: 0.7, clearcoat: 0.4 });
  const ring = new THREE.MeshPhysicalMaterial({ color: primary, roughness: 0.2, metalness: 0.4, clearcoat: 1.0 });
  add(g, new THREE.CylinderGeometry(0.44, 0.46, 0.045, 36), disc, 0, 0.0225, 0);
  add(g, new THREE.TorusGeometry(0.45, 0.022, 12, 36), ring, 0, 0.028, 0, Math.PI / 2);
  return { group: g, topY: 0.048 };
}

// ============================================================================
// I 20 MODELLI 3D AD ALTO DETTAGLIO
// ============================================================================

// 1. MONOPOSTO F1 (VERSIONE ULTRA-DETTAGLIATA)
function buildF1(p: Palette): BuiltModel {
  const g = new THREE.Group();
  const wheels: THREE.Object3D[] = [];
  const pulse: THREE.Mesh[] = [];

  // Fondo piatto aerodinamico in carbonio con wing-edge laterali e diffusore a 5 paratie
  add(g, new THREE.BoxGeometry(0.6, 0.032, 1.42), p.carbon, 0, 0.115, -0.02);
  for (const s of [-1, 1]) {
    // Floor edge wing + strakes laterali
    add(g, new THREE.BoxGeometry(0.032, 0.038, 0.76), p.carbon, s * 0.31, 0.132, -0.06);
    add(g, new THREE.BoxGeometry(0.014, 0.055, 0.18), p.accent, s * 0.315, 0.14, 0.24, 0, s * 0.12, 0);
  }
  for (const dx of [-0.21, -0.105, 0, 0.105, 0.21]) {
    add(g, new THREE.BoxGeometry(0.015, 0.095, 0.24), p.carbon, dx, 0.135, -0.67, -0.24);
  }
  // Struttura anti-crash posteriore + luce pioggia LED lampeggiante + scarico centrale & twin wastegate
  add(g, new THREE.BoxGeometry(0.11, 0.11, 0.16), p.carbon, 0, 0.2, -0.74);
  const rainLight = add(g, new THREE.BoxGeometry(0.036, 0.075, 0.025), p.redGlow, 0, 0.2, -0.825);
  pulse.push(rainLight);
  add(g, new THREE.CylinderGeometry(0.032, 0.036, 0.12, 14), p.chrome, 0, 0.27, -0.74, Math.PI / 2);
  for (const s of [-1, 1]) {
    add(g, new THREE.CylinderGeometry(0.014, 0.015, 0.11, 10), p.brass, s * 0.044, 0.25, -0.74, Math.PI / 2);
  }

  // Monoscocca e muso affusolato scolpito + shark fin sul cofano motore
  extrude(g, [
    [-0.74, 0.14], [0.22, 0.14], [0.92, 0.115], [0.95, 0.145],
    [0.64, 0.22], [0.28, 0.31], [-0.04, 0.35], [-0.24, 0.48],
    [-0.58, 0.39], [-0.74, 0.24],
  ], 0.21, 0.032, p.paint, 0, 0, 0, 0, -Math.PI / 2, 0);
  // Pinna dorsale (Shark Fin) in carbonio con bordo colorato
  extrude(g, [
    [-0.64, 0.34], [-0.26, 0.47], [-0.26, 0.38], [-0.62, 0.26],
  ], 0.014, 0.004, p.carbon, 0, 0, 0, 0, -Math.PI / 2, 0);
  add(g, new THREE.BoxGeometry(0.02, 0.014, 0.38), p.accent, 0, 0.415, -0.45, 0.32);

  // Livrea dorsale sul muso + sensore tubo di Pitot + telecamere anteriori laterali
  add(g, new THREE.BoxGeometry(0.068, 0.02, 0.74), p.accent, 0, 0.235, 0.47, 0.155);
  add(g, new THREE.BoxGeometry(0.018, 0.022, 0.72), p.white, 0, 0.238, 0.47, 0.155);
  add(g, new THREE.CylinderGeometry(0.005, 0.005, 0.06, 6), p.chrome, 0, 0.31, 0.36);
  add(g, new THREE.CylinderGeometry(0.004, 0.004, 0.075, 6), p.chrome, 0, 0.34, 0.39, Math.PI / 2);
  for (const s of [-1, 1]) {
    add(g, new THREE.BoxGeometry(0.055, 0.024, 0.042), p.darkMetal, s * 0.125, 0.23, 0.56);
  }

  // Pance laterali (sidepods) scavate undercut + 6 branchie di raffreddamento + specchietti aerodinamici
  for (const s of [-1, 1]) {
    extrude(g, [
      [-0.6, 0.15], [0.22, 0.15], [0.24, 0.31], [-0.14, 0.33], [-0.57, 0.22],
    ], 0.18, 0.028, p.paint, s * 0.21, 0, 0, 0, -Math.PI / 2, 0);
    // Bocca radiatore profonda + labbro carbonio
    add(g, new THREE.BoxGeometry(0.15, 0.11, 0.045), p.darkMetal, s * 0.215, 0.235, 0.225);
    add(g, new THREE.BoxGeometry(0.17, 0.018, 0.06), p.carbon, s * 0.215, 0.295, 0.235);
    // 6 feritoie (louvers) di raffreddamento motore
    for (let k = 0; k < 6; k++) {
      add(g, new THREE.BoxGeometry(0.095, 0.012, 0.018), p.darkMetal, s * 0.19, 0.335 - k * 0.011, 0.02 - k * 0.062, 0.18);
    }
    // Bargeboard multi-elemento
    add(g, new THREE.BoxGeometry(0.016, 0.11, 0.2), p.carbon, s * 0.295, 0.185, 0.29, 0, s * 0.16, 0);
    add(g, new THREE.BoxGeometry(0.014, 0.08, 0.14), p.accent, s * 0.265, 0.17, 0.34, 0, s * 0.22, 0);
    // Specchietto retrovisore con doppio supporto
    add(g, new THREE.BoxGeometry(0.082, 0.036, 0.046), p.accent, s * 0.235, 0.37, 0.14);
    add(g, new THREE.BoxGeometry(0.068, 0.026, 0.01), p.chrome, s * 0.235, 0.37, 0.116);
    add(g, new THREE.CylinderGeometry(0.007, 0.007, 0.095, 6), p.carbon, s * 0.19, 0.34, 0.14, 0, 0, -s * 0.45);
  }

  // Airbox + T-Cam bicolore con doppia ottica
  add(g, new THREE.CylinderGeometry(0.072, 0.098, 0.2, 16), p.paint, 0, 0.44, -0.18, Math.PI / 2.25);
  add(g, new THREE.CylinderGeometry(0.056, 0.056, 0.045, 14), p.darkMetal, 0, 0.46, -0.09, Math.PI / 2);
  add(g, new THREE.BoxGeometry(0.022, 0.085, 0.026), p.carbon, 0, 0.51, -0.16);
  add(g, new THREE.BoxGeometry(0.18, 0.024, 0.034), p.accent, 0, 0.555, -0.16);
  for (const s of [-1, 1]) {
    add(g, new THREE.CylinderGeometry(0.011, 0.011, 0.02, 10), p.lensGlass, s * 0.085, 0.555, -0.14, Math.PI / 2);
  }

  // Abitacolo, poggiatesta, volante F1 con LED cambio marcia, casco pilota e HALO scolpito
  add(g, new THREE.BoxGeometry(0.18, 0.08, 0.34), p.darkMetal, 0, 0.31, 0.03);
  add(g, new THREE.BoxGeometry(0.17, 0.04, 0.1), p.rubber, 0, 0.36, -0.1); // headrest
  // Volante farfalla + 5 micro-LED shift light
  add(g, new THREE.BoxGeometry(0.11, 0.065, 0.018), p.carbon, 0, 0.345, 0.15, -0.25);
  for (let i = -2; i <= 2; i++) {
    const col = i < 0 ? p.custom(0x22c55e, 0.2, 0) : i === 0 ? p.glow : p.redGlow;
    add(g, new THREE.BoxGeometry(0.012, 0.01, 0.022), col, i * 0.018, 0.372, 0.145, -0.25);
  }
  // Casco pilota dettagliato con visiera e prese d'aria
  add(g, new THREE.SphereGeometry(0.08, 20, 16), p.white, 0, 0.365, -0.02);
  add(g, new THREE.BoxGeometry(0.032, 0.016, 0.09), p.accent, 0, 0.44, -0.02);
  add(g, new THREE.CylinderGeometry(0.081, 0.081, 0.042, 16, 1, false, -0.85, 1.7), p.lensGlass, 0, 0.372, -0.01);
  // Halo con carenatura centrale aerodinamica
  tube(g, [[-0.105, 0.345, -0.075], [-0.095, 0.425, 0.08], [0, 0.44, 0.215], [0.095, 0.425, 0.08], [0.105, 0.345, -0.075]], 0.018, p.carbon, 24, 10);
  add(g, new THREE.CylinderGeometry(0.015, 0.019, 0.135, 10), p.carbon, 0, 0.365, 0.215, -0.35);

  // Ala anteriore a 4 elementi sovrapposti + piloni + paratie curve con diveplanes
  add(g, new THREE.BoxGeometry(0.78, 0.02, 0.16), p.carbon, 0, 0.105, 0.9);
  add(g, new THREE.BoxGeometry(0.76, 0.016, 0.095), p.paint, 0, 0.135, 0.85, -0.18);
  add(g, new THREE.BoxGeometry(0.74, 0.014, 0.075), p.paint, 0, 0.165, 0.81, -0.28);
  add(g, new THREE.BoxGeometry(0.72, 0.012, 0.055), p.accent, 0, 0.19, 0.775, -0.36);
  for (const s of [-1, 1]) {
    add(g, new THREE.BoxGeometry(0.014, 0.07, 0.06), p.carbon, s * 0.055, 0.135, 0.88);
    extrude(g, [[-0.13, 0], [0.12, 0], [0.07, 0.125], [-0.13, 0.145]], 0.018, 0.005, p.paint, s * 0.39, 0.095, 0.86, 0, -Math.PI / 2, 0);
    // Diveplane esterno sulla paratia
    add(g, new THREE.BoxGeometry(0.04, 0.012, 0.14), p.carbon, s * 0.415, 0.16, 0.85, -0.18, 0, -s * 0.15);
  }

  // Alettone posteriore: beam wing inferiore + doppio pilone a collo di cigno + DRS actuator pod + flap DRS
  add(g, new THREE.BoxGeometry(0.46, 0.016, 0.09), p.carbon, 0, 0.27, -0.73, -0.25); // beam wing
  add(g, new THREE.BoxGeometry(0.58, 0.022, 0.15), p.carbon, 0, 0.445, -0.75, -0.14); // main plane
  add(g, new THREE.BoxGeometry(0.58, 0.018, 0.12), p.paint, 0, 0.535, -0.775, -0.32); // DRS flap
  add(g, new THREE.BoxGeometry(0.036, 0.075, 0.12), p.carbon, 0, 0.505, -0.74); // DRS actuator pod
  for (const s of [-1, 1]) {
    add(g, new THREE.BoxGeometry(0.015, 0.27, 0.05), p.carbon, s * 0.052, 0.325, -0.715, -0.14);
    extrude(g, [[-0.15, 0], [0.11, 0], [0.11, 0.34], [-0.15, 0.36]], 0.018, 0.005, p.paint, s * 0.295, 0.245, -0.75, 0, -Math.PI / 2, 0);
    // Striscia accento sulla paratia posteriore
    add(g, new THREE.BoxGeometry(0.024, 0.04, 0.2), p.accent, s * 0.298, 0.49, -0.75);
  }

  // 4 ruote da 18" a 10 razze + dischi freno carbon-ceramici + pinze freno verniciate + doppi triangoli + pushrod!
  const wheelDefs: [number, number, number, number][] = [
    [-0.37, 0.185, 0.57, 0.145], [0.37, 0.185, 0.57, 0.145],
    [-0.39, 0.205, -0.51, 0.19], [0.39, 0.205, -0.51, 0.19],
  ];
  for (const [wx, wy, wz, ww] of wheelDefs) {
    const r = wz < 0 ? 0.205 : 0.185;
    const side = Math.sign(wx);
    const w = makeDetailedWheel(r, ww, p, { spokes: 10, stripeMat: p.accent });
    w.position.set(wx, wy, wz);
    g.add(w);
    wheels.push(w);

    // Disco freno + pinza freno colorata + presa d'aria freno (fermi, non ruotano!)
    const brakeX = wx - side * (ww * 0.32);
    add(g, new THREE.CylinderGeometry(r * 0.44, r * 0.44, 0.024, 20), p.darkMetal, brakeX, wy, wz, 0, 0, Math.PI / 2);
    add(g, new THREE.BoxGeometry(0.048, r * 0.38, r * 0.24), p.accent, brakeX, wy + 0.01, wz - 0.04); // pinza freno!
    add(g, new THREE.BoxGeometry(0.036, 0.075, 0.08), p.carbon, brakeX - side * 0.035, wy + 0.02, wz + 0.03); // brake duct

    // Doppi triangoli (upper & lower wishbones) + puntone pushrod diagonale
    const innerX = side * 0.12;
    const outerX = brakeX - side * 0.02;
    tube(g, [[innerX, wy + 0.055, wz + 0.08], [outerX, wy + 0.04, wz]], 0.009, p.carbon, 6, 6);
    tube(g, [[innerX, wy + 0.055, wz - 0.08], [outerX, wy + 0.04, wz]], 0.009, p.carbon, 6, 6);
    tube(g, [[innerX, wy - 0.045, wz + 0.07], [outerX, wy - 0.04, wz]], 0.009, p.carbon, 6, 6);
    tube(g, [[innerX, wy - 0.045, wz - 0.07], [outerX, wy - 0.04, wz]], 0.009, p.carbon, 6, 6);
    // Pushrod diagonale
    tube(g, [[innerX, wy + 0.09, wz + (wz > 0 ? -0.02 : 0.05)], [outerX, wy - 0.03, wz]], 0.008, p.chrome, 6, 6);
  }

  return { group: g, anim: { wheels, pulse } };
}

// 2. SCOOTER VINTAGE (VESPA — VERSIONE ULTRA-DETTAGLIATA HD+)
function buildVespa(p: Palette): BuiltModel {
  const g = new THREE.Group();
  const wheels: THREE.Object3D[] = [];

  // Ruote con fascia bianca + tamburo freno cromato
  const wFront = makeDetailedWheel(0.22, 0.1, p, { whitewall: true, spokes: 5 });
  wFront.position.set(0, 0.22, 0.54);
  const wRear = makeDetailedWheel(0.22, 0.115, p, { whitewall: true, spokes: 5 });
  wRear.position.set(0, 0.22, -0.45);
  g.add(wFront, wRear);
  wheels.push(wFront, wRear);

  // Forcella anteriore monobraccio + molla ammortizzatore cromata (6 spire) + braccio oscillante
  add(g, new THREE.CylinderGeometry(0.024, 0.028, 0.42, 12), p.chrome, 0.08, 0.41, 0.49, -0.22);
  add(g, new THREE.CylinderGeometry(0.015, 0.015, 0.19, 10), p.darkMetal, 0.09, 0.34, 0.57, -0.18);
  for (let i = 0; i < 6; i++) {
    add(g, new THREE.TorusGeometry(0.026, 0.006, 6, 14), p.chrome, 0.09, 0.28 + i * 0.022, 0.56 + i * 0.003, Math.PI / 2 - 0.18);
  }
  add(g, new THREE.BoxGeometry(0.035, 0.04, 0.11), p.brushed, 0.075, 0.22, 0.54);

  // Parafango anteriore bombato + cresta cromata scolpita + bordino
  add(g, new THREE.CylinderGeometry(0.258, 0.258, 0.155, 24, 1, false, -0.12, Math.PI * 0.8), p.paint, 0, 0.24, 0.54, 0, 0, Math.PI / 2);
  extrude(g, [[0, 0], [0.16, 0], [0.12, 0.045], [0.02, 0.03]], 0.02, 0.005, p.chrome, 0, 0.49, 0.52, 0, -Math.PI / 2, 0);

  // Scudo anteriore sinuoso + bordoscudo cromato + pedana + tunnel centrale
  extrude(g, [
    [-0.55, 0.19], [0.22, 0.19], [0.43, 0.46], [0.4, 0.85],
    [0.33, 0.86], [0.34, 0.49], [0.18, 0.26], [-0.45, 0.26],
  ], 0.34, 0.036, p.paint, 0, 0, 0, 0, -Math.PI / 2, 0);
  // Bordoscudo cromato sui due fianchi dello scudo
  for (const s of [-1, 1]) {
    tube(g, [[s * 0.19, 0.21, 0.22], [s * 0.195, 0.47, 0.44], [s * 0.185, 0.85, 0.41]], 0.012, p.chrome, 16, 8);
  }
  // Bauletto retroscudo con serratura cromata + pedale freno posteriore + cavalletto centrale
  add(g, new THREE.BoxGeometry(0.26, 0.24, 0.12), p.paint, 0, 0.56, 0.29, -0.2);
  add(g, new THREE.CylinderGeometry(0.014, 0.014, 0.025, 12), p.chrome, 0, 0.63, 0.225, Math.PI / 2);
  add(g, new THREE.BoxGeometry(0.045, 0.025, 0.08), p.rubber, -0.1, 0.275, 0.14, -0.3);
  tube(g, [[-0.14, 0.04, -0.12], [-0.1, 0.19, -0.06], [0.1, 0.19, -0.06], [0.14, 0.04, -0.12]], 0.012, p.chrome, 14, 6);

  // Nasello frontale con stemma smaltato e griglia clacson a 4 lamelle
  add(g, new THREE.BoxGeometry(0.11, 0.38, 0.075), p.paint, 0, 0.59, 0.43, -0.14);
  add(g, new THREE.BoxGeometry(0.05, 0.065, 0.018), p.accent, 0, 0.72, 0.452, -0.14);
  add(g, new THREE.CylinderGeometry(0.044, 0.044, 0.028, 18), p.chrome, 0, 0.48, 0.472, Math.PI / 2);
  for (let k = -1; k <= 1; k++) {
    add(g, new THREE.BoxGeometry(0.065, 0.008, 0.012), p.darkMetal, 0, 0.48 + k * 0.018, 0.485);
  }
  // 5 listelli pedana cromati con gommino nero centrale
  for (const dx of [-0.13, -0.065, 0, 0.065, 0.13]) {
    add(g, new THREE.BoxGeometry(0.022, 0.012, 0.44), p.chrome, dx, 0.262, 0.03);
    add(g, new THREE.BoxGeometry(0.011, 0.016, 0.42), p.rubber, dx, 0.264, 0.03);
  }

  // Scocche posteriori bombate con modanatura cromata + 5 feritoie motore + scritta
  for (const s of [-1, 1]) {
    const cowl = add(g, new THREE.SphereGeometry(0.265, 24, 18), p.paint, s * 0.14, 0.39, -0.36);
    cowl.scale.set(0.56, 0.85, 1.48);
    tube(g, [[s * 0.26, 0.45, -0.12], [s * 0.29, 0.43, -0.36], [s * 0.24, 0.39, -0.62]], 0.01, p.chrome, 16, 8);
    for (let k = 0; k < 5; k++) {
      add(g, new THREE.BoxGeometry(0.014, 0.012, 0.14), p.darkMetal, s * 0.278, 0.31 + k * 0.026, -0.34);
    }
  }
  add(g, new THREE.BoxGeometry(0.28, 0.3, 0.46), p.paint, 0, 0.42, -0.32);

  // Sella biposto ergonomica in pelle con cinghia passeggero, rivetti e bordino chiaro
  extrude(g, [
    [-0.56, 0.56], [-0.04, 0.58], [0.04, 0.68], [-0.22, 0.73], [-0.59, 0.7],
  ], 0.24, 0.036, p.leather, 0, 0, 0, 0, -Math.PI / 2, 0);
  add(g, new THREE.BoxGeometry(0.31, 0.022, 0.055), p.leather, 0, 0.745, -0.28); // cinghia passeggero
  for (const s of [-1, 1]) {
    for (const rz of [-0.14, -0.28, -0.44]) {
      add(g, new THREE.SphereGeometry(0.012, 8, 8), p.chrome, s * 0.15, 0.64, rz);
    }
  }

  // Portapacchi posteriore cromato con ruota di scorta agganciata + cinghia in pelle + targa IT HD!
  tube(g, [[-0.11, 0.56, -0.58], [-0.11, 0.58, -0.82], [0.11, 0.58, -0.82], [0.11, 0.56, -0.58]], 0.014, p.chrome, 16, 8);
  tube(g, [[-0.11, 0.58, -0.78], [-0.11, 0.76, -0.76], [0.11, 0.76, -0.76], [0.11, 0.58, -0.78]], 0.012, p.chrome, 16, 8);
  const spare = makeDetailedWheel(0.175, 0.08, p, { whitewall: true, spokes: 5 });
  spare.position.set(0, 0.66, -0.82);
  spare.rotation.set(0, Math.PI / 2, 0.18);
  g.add(spare);
  // Fanale posteriore scolpito con palpebra cromata + targa HD "SD 64"
  add(g, new THREE.BoxGeometry(0.085, 0.11, 0.06), p.chrome, 0, 0.47, -0.68);
  add(g, new THREE.BoxGeometry(0.068, 0.075, 0.04), p.redGlow, 0, 0.46, -0.705);
  const plateMat = new THREE.MeshStandardMaterial({ map: licensePlateTex('SD 64'), roughness: 0.35, metalness: 0.2 });
  add(g, new THREE.BoxGeometry(0.14, 0.095, 0.016), plateMat, 0, 0.33, -0.7, 0.22);

  // Manubrio scolpito con tachimetro HD incassato, faro con parabola & palpebra, leve freno e specchietti
  add(g, new THREE.CylinderGeometry(0.036, 0.044, 0.62, 16), p.chrome, 0, 0.56, 0.43, -0.22);
  add(g, new THREE.BoxGeometry(0.24, 0.12, 0.17), p.paint, 0, 0.9, 0.35);
  // Tachimetro tondo vintage con vetro
  const speedoMat = new THREE.MeshStandardMaterial({ map: speedometerTex(), roughness: 0.3, metalness: 0.1 });
  add(g, new THREE.CylinderGeometry(0.058, 0.062, 0.02, 20), p.chrome, 0, 0.965, 0.33, -0.25);
  add(g, new THREE.CircleGeometry(0.052, 20), speedoMat, 0, 0.976, 0.33, -Math.PI / 2 - 0.25);
  // Faro anteriore con ghiera cromata, parabola, palpebra superiore e lente
  add(g, new THREE.CylinderGeometry(0.092, 0.08, 0.095, 24), p.chrome, 0, 0.9, 0.44, Math.PI / 2);
  add(g, new THREE.SphereGeometry(0.078, 18, 14), p.glow, 0, 0.9, 0.465);
  add(g, new THREE.CylinderGeometry(0.096, 0.096, 0.05, 18, 1, true, -Math.PI * 0.42, Math.PI * 0.84), p.chrome, 0, 0.9, 0.495, Math.PI / 2);
  // Manubrio, manopole scanalate, leve freno/frizione e doppi specchietti
  tube(g, [[-0.37, 0.89, 0.3], [-0.14, 0.9, 0.35], [0.14, 0.9, 0.35], [0.37, 0.89, 0.3]], 0.022, p.chrome);
  for (const s of [-1, 1]) {
    add(g, new THREE.CylinderGeometry(0.032, 0.032, 0.14, 14), p.rubber, s * 0.33, 0.89, 0.305, 0, 0, Math.PI / 2);
    // Leva freno/frizione cromata
    tube(g, [[s * 0.23, 0.88, 0.35], [s * 0.35, 0.87, 0.375]], 0.008, p.chrome, 8, 6);
    add(g, new THREE.SphereGeometry(0.015, 8, 8), p.chrome, s * 0.355, 0.87, 0.375);
    // Specchietto tondo con bordo cromato e vetro
    tube(g, [[s * 0.17, 0.94, 0.35], [s * 0.25, 1.07, 0.35], [s * 0.3, 1.11, 0.35]], 0.009, p.chrome, 12, 6);
    add(g, new THREE.CylinderGeometry(0.058, 0.058, 0.022, 18), p.chrome, s * 0.31, 1.12, 0.35, Math.PI / 2);
    add(g, new THREE.CircleGeometry(0.048, 16), p.glass, s * 0.31, 1.12, 0.337, 0, Math.PI, 0);
  }
  // Marmitta cromata con silenziatore e paracalore forato
  tube(g, [[0.14, 0.22, -0.2], [0.22, 0.18, -0.45], [0.22, 0.21, -0.68]], 0.03, p.chrome, 18, 10);
  add(g, new THREE.CylinderGeometry(0.042, 0.036, 0.24, 14), p.brushed, 0.225, 0.195, -0.52, Math.PI / 2);

  return { group: g, anim: { wheels } };
}

// 3. AUTO D'EPOCA (ROADSTER ANNI '30 — VERSIONE ULTRA-DETTAGLIATA HD+)
function buildVintageCar(p: Palette): BuiltModel {
  const g = new THREE.Group();
  const wheels: THREE.Object3D[] = [];

  // Telaio a longheroni e pedane laterali rivestite con listelli in gomma
  add(g, new THREE.BoxGeometry(0.64, 0.058, 1.28), p.darkMetal, 0, 0.175, 0);
  for (const s of [-1, 1]) {
    for (let k = 0; k < 4; k++) {
      add(g, new THREE.BoxGeometry(0.014, 0.012, 0.44), p.rubber, s * (0.24 + k * 0.026), 0.208, 0.02);
    }
  }

  // Cofano lungo scolpito + cerniera centrale cromata + 2 cinghie in pelle con fibbie in ottone + 7 feritoie
  add(g, new THREE.BoxGeometry(0.41, 0.28, 0.64), p.paint, 0, 0.34, 0.27);
  add(g, new THREE.CylinderGeometry(0.205, 0.205, 0.64, 22, 1, false, Math.PI / 2, Math.PI), p.paint, 0, 0.48, 0.27, Math.PI / 2, 0, 0);
  add(g, new THREE.CylinderGeometry(0.011, 0.011, 0.64, 8), p.chrome, 0, 0.685, 0.27, Math.PI / 2);
  // Cinghie ferma-cofano in pelle con fibbie in ottone
  for (const cz of [0.1, 0.44]) {
    add(g, new THREE.TorusGeometry(0.21, 0.014, 8, 22, Math.PI), p.leather, 0, 0.48, cz);
    for (const s of [-1, 1]) {
      add(g, new THREE.BoxGeometry(0.02, 0.26, 0.03), p.leather, s * 0.21, 0.36, cz);
      add(g, new THREE.BoxGeometry(0.026, 0.04, 0.044), p.brass, s * 0.214, 0.3, cz);
    }
  }
  for (const s of [-1, 1]) {
    for (let k = 0; k < 7; k++) {
      add(g, new THREE.BoxGeometry(0.015, 0.13, 0.018), p.chrome, s * 0.208, 0.37, 0.08 + k * 0.062);
    }
  }

  // Radiatore verticale cromato a 9 lamelle, stemma e mascotte alata sul tappo
  add(g, new THREE.BoxGeometry(0.38, 0.44, 0.085), p.chrome, 0, 0.43, 0.61);
  add(g, new THREE.CylinderGeometry(0.19, 0.19, 0.085, 20, 1, false, Math.PI / 2, Math.PI), p.chrome, 0, 0.48, 0.61, Math.PI / 2, 0, 0);
  for (let k = -4; k <= 4; k++) {
    add(g, new THREE.BoxGeometry(0.012, 0.37, 0.022), p.darkMetal, k * 0.036, 0.42, 0.655);
  }
  add(g, new THREE.CylinderGeometry(0.036, 0.036, 0.02, 16), p.accent, 0, 0.61, 0.655, Math.PI / 2);
  // Tappo radiatore con mascotte alata
  add(g, new THREE.CylinderGeometry(0.028, 0.035, 0.05, 12), p.brass, 0, 0.69, 0.61);
  add(g, new THREE.BoxGeometry(0.12, 0.018, 0.032), p.brass, 0, 0.72, 0.61);
  add(g, new THREE.SphereGeometry(0.024, 10, 10), p.chrome, 0, 0.735, 0.62);

  // Abitacolo aperto boat-tail + cruscotto in radica con 3 strumenti + leva cambio + capote ripiegata
  add(g, new THREE.BoxGeometry(0.49, 0.27, 0.58), p.paint, 0, 0.335, -0.32);
  add(g, new THREE.CylinderGeometry(0.18, 0.245, 0.3, 18), p.paint, 0, 0.335, -0.63, Math.PI / 2);
  // Cruscotto in legno noce con 3 quadranti cromati
  add(g, new THREE.BoxGeometry(0.43, 0.14, 0.045), p.wood, 0, 0.44, -0.05);
  const dialMat = new THREE.MeshStandardMaterial({ map: speedometerTex(), roughness: 0.3 });
  for (const gx of [-0.11, 0, 0.11]) {
    add(g, new THREE.CylinderGeometry(0.038, 0.038, 0.018, 16), p.chrome, gx, 0.445, -0.075, Math.PI / 2);
    add(g, new THREE.CircleGeometry(0.032, 16), dialMat, gx, 0.445, -0.086, 0, Math.PI, 0);
  }
  // Sedile trapuntato in pelle con schienale a coste + capote in tela ripiegata dietro
  add(g, new THREE.BoxGeometry(0.42, 0.25, 0.16), p.leather, 0, 0.45, -0.44, -0.2);
  add(g, new THREE.BoxGeometry(0.42, 0.1, 0.31), p.leather, 0, 0.3, -0.28);
  for (let k = -2; k <= 2; k++) {
    add(g, new THREE.CylinderGeometry(0.026, 0.026, 0.24, 10), p.leather, k * 0.075, 0.46, -0.37, -0.2);
  }
  add(g, new THREE.CylinderGeometry(0.065, 0.065, 0.46, 14), p.custom(0xd6cbb8, 0.85, 0.02), 0, 0.56, -0.54, 0, 0, Math.PI / 2);
  // Volante a 4 razze in legno e ottone + leva cambio + freno a mano
  const wheelGrp = new THREE.Group();
  wheelGrp.position.set(-0.11, 0.5, -0.1);
  wheelGrp.rotation.x = 0.85;
  add(wheelGrp, new THREE.TorusGeometry(0.088, 0.014, 8, 22), p.wood);
  add(wheelGrp, new THREE.BoxGeometry(0.17, 0.012, 0.012), p.chrome);
  add(wheelGrp, new THREE.BoxGeometry(0.012, 0.17, 0.012), p.chrome);
  add(wheelGrp, new THREE.CylinderGeometry(0.024, 0.024, 0.024, 12), p.brass, 0, 0, 0, Math.PI / 2);
  g.add(wheelGrp);
  add(g, new THREE.CylinderGeometry(0.014, 0.014, 0.22, 8), p.chrome, -0.11, 0.42, -0.02, 0.85);
  add(g, new THREE.CylinderGeometry(0.009, 0.009, 0.22, 8), p.chrome, 0.02, 0.4, -0.18, -0.18);
  add(g, new THREE.SphereGeometry(0.022, 10, 10), p.brass, 0.02, 0.51, -0.2);

  // Parabrezza diviso a V con cornice cromata, montanti e 2 tergicristalli
  for (const s of [-1, 1]) {
    add(g, new THREE.BoxGeometry(0.24, 0.21, 0.014), p.glass, s * 0.115, 0.575, -0.025, -0.34, s * 0.12);
    add(g, new THREE.BoxGeometry(0.25, 0.02, 0.022), p.chrome, s * 0.115, 0.67, -0.06, -0.34, s * 0.12);
    add(g, new THREE.CylinderGeometry(0.014, 0.014, 0.23, 8), p.chrome, s * 0.24, 0.575, -0.04, -0.34);
    // Tergicristallo cromato
    add(g, new THREE.BoxGeometry(0.008, 0.11, 0.008), p.chrome, s * 0.1, 0.61, -0.025, -0.34, s * 0.12, 0.35);
    // Specchietto laterale tondo
    add(g, new THREE.CylinderGeometry(0.036, 0.036, 0.016, 14), p.chrome, s * 0.285, 0.55, -0.04, Math.PI / 2);
  }
  add(g, new THREE.CylinderGeometry(0.012, 0.012, 0.22, 8), p.chrome, 0, 0.575, -0.01, -0.34);

  // Parafanghi sinuosi estrusi + fari cromati su barra curva + tromba clacson + doppi scarichi laterali con paracalore
  tube(g, [[-0.28, 0.45, 0.59], [0, 0.47, 0.64], [0.28, 0.45, 0.59]], 0.012, p.chrome, 16, 8);
  for (const s of [-1, 1]) {
    extrude(g, [
      [-0.7, 0.26], [-0.57, 0.43], [-0.32, 0.43], [-0.18, 0.19],
      [0.24, 0.19], [0.39, 0.44], [0.64, 0.44], [0.76, 0.25],
      [0.7, 0.22], [0.59, 0.39], [0.42, 0.39], [0.27, 0.14],
      [-0.21, 0.14], [-0.35, 0.38], [-0.54, 0.38], [-0.64, 0.22],
    ], 0.165, 0.014, p.accent, s * 0.32, 0, 0, 0, -Math.PI / 2, 0);
    // Faro anteriore con ghiera + lente + parapietre a croce
    add(g, new THREE.CylinderGeometry(0.078, 0.056, 0.12, 18), p.chrome, s * 0.25, 0.47, 0.59, Math.PI / 2);
    add(g, new THREE.SphereGeometry(0.07, 14, 12), p.glow, s * 0.25, 0.47, 0.635);
    add(g, new THREE.TorusGeometry(0.075, 0.008, 8, 18), p.chrome, s * 0.25, 0.47, 0.65);
    // Fanale posteriore rosso tondo
    add(g, new THREE.CylinderGeometry(0.036, 0.032, 0.055, 14), p.chrome, s * 0.25, 0.36, -0.71, Math.PI / 2);
    add(g, new THREE.SphereGeometry(0.032, 12, 10), p.redGlow, s * 0.25, 0.36, -0.735);
    // Scarichi laterali con 3 collettori cromati uscenti dal cofano!
    for (let k = 0; k < 3; k++) {
      tube(g, [[s * 0.2, 0.41, 0.46 - k * 0.13], [s * 0.285, 0.33, 0.42 - k * 0.13], [s * 0.285, 0.22, 0.35 - k * 0.13]], 0.016, p.chrome, 10, 6);
    }
    tube(g, [[s * 0.285, 0.22, 0.36], [s * 0.285, 0.21, -0.6]], 0.025, p.chrome, 14, 8);
  }
  // Tromba clacson vintage in ottone sul lato sinistro
  add(g, new THREE.ConeGeometry(0.042, 0.16, 14, 1, true), p.brass, 0.24, 0.43, 0.52, -Math.PI / 2);

  // Paraurti anteriori e posteriori a doppia lama cromata con rostri verticali + targa HD "SD 32"
  for (const bz of [0.75, -0.79]) {
    add(g, new THREE.BoxGeometry(0.68, 0.044, 0.035), p.chrome, 0, 0.22, bz);
    for (const s of [-1, 1]) add(g, new THREE.BoxGeometry(0.032, 0.095, 0.055), p.chrome, s * 0.18, 0.22, bz);
  }
  const plateMat = new THREE.MeshStandardMaterial({ map: licensePlateTex('SD 32'), roughness: 0.35, metalness: 0.2 });
  add(g, new THREE.BoxGeometry(0.17, 0.09, 0.015), plateMat, 0, 0.29, -0.775);

  // 4 ruote a 12 raggi con fascia bianca + ruota di scorta posteriore con gallettone
  for (const [wx, wz] of [[-0.34, 0.51], [0.34, 0.51], [-0.34, -0.46], [0.34, -0.46]]) {
    const w = makeDetailedWheel(0.215, 0.088, p, { whitewall: true, spokes: 12 });
    w.position.set(wx, 0.215, wz);
    g.add(w);
    wheels.push(w);
  }
  const spare = makeDetailedWheel(0.185, 0.076, p, { whitewall: true, spokes: 12 });
  spare.position.set(0, 0.4, -0.75);
  spare.rotation.set(0, Math.PI / 2, 0.22);
  g.add(spare);

  return { group: g, anim: { wheels } };
}

// 4. YACHT DI LUSSO (VERSIONE ULTRA-DETTAGLIATA HD+)
function buildYacht(p: Palette): BuiltModel {
  const g = new THREE.Group();
  const spinY: THREE.Object3D[] = [];

  // Scafo bicolore con linea di galleggiamento, bottazzo inox e tasca ancora a prua
  extrude(g, [
    [-0.29, -0.74], [0.29, -0.74], [0.33, -0.14], [0.25, 0.44], [0, 0.92],
    [-0.25, 0.44], [-0.33, -0.14],
  ], 0.23, 0.026, p.white, 0, 0.15, 0, Math.PI / 2, 0, 0);

  extrude(g, [
    [-0.26, -0.7], [0.26, -0.7], [0.29, -0.14], [0.21, 0.4], [0, 0.84],
    [-0.21, 0.4], [-0.29, -0.14],
  ], 0.085, 0.015, p.paint, 0, 0.055, 0, Math.PI / 2, 0, 0);

  // Bottazzo perimetrale in acciaio cromato
  tube(g, [
    [-0.29, 0.275, -0.74], [-0.335, 0.275, -0.14], [-0.255, 0.285, 0.44], [0, 0.305, 0.92],
    [0.255, 0.285, 0.44], [0.335, 0.275, -0.14], [0.29, 0.275, -0.74],
  ], 0.012, p.chrome, 32, 8);

  // Ponte in legno teak con passo d'uomo vetrato + prendisole a cuscini trapuntati a prua
  extrude(g, [
    [-0.26, -0.7], [0.26, -0.7], [0.29, -0.14], [0.215, 0.42], [0, 0.83],
    [-0.215, 0.42], [-0.29, -0.14],
  ], 0.02, 0.004, p.teak, 0, 0.285, 0, Math.PI / 2, 0, 0);
  // Cuscini prendisole di prua + osteriggio (hatch)
  add(g, new THREE.BoxGeometry(0.32, 0.035, 0.26), p.white, 0, 0.305, 0.46);
  add(g, new THREE.BoxGeometry(0.14, 0.02, 0.12), p.tintedGlass, 0, 0.302, 0.66);
  add(g, new THREE.BoxGeometry(0.16, 0.016, 0.14), p.chrome, 0, 0.298, 0.66);

  // Plancetta di poppa in teak con scaletta bagno cromata + doppie eliche & timoni in ottone sotto poppa!
  add(g, new THREE.BoxGeometry(0.5, 0.04, 0.16), p.teak, 0, 0.12, -0.8);
  for (const s of [-1, 1]) {
    add(g, new THREE.CylinderGeometry(0.01, 0.01, 0.16, 8), p.chrome, s * 0.17, 0.06, -0.86, 0.2);
    // Elica in ottone + timone
    add(g, new THREE.CylinderGeometry(0.016, 0.016, 0.09, 8), p.brass, s * 0.13, 0.03, -0.62, Math.PI / 2);
    add(g, new THREE.BoxGeometry(0.09, 0.014, 0.028), p.brass, s * 0.13, 0.03, -0.65, 0, 0, 0.6);
    add(g, new THREE.BoxGeometry(0.014, 0.09, 0.028), p.brass, s * 0.13, 0.03, -0.65, 0, 0, 0.6);
    add(g, new THREE.BoxGeometry(0.014, 0.075, 0.055), p.brass, s * 0.13, 0.035, -0.71);
  }
  add(g, new THREE.BoxGeometry(0.12, 0.01, 0.02), p.chrome, 0.17, 0.02, -0.87);

  // Salone principale con vetrate panoramiche fumé, montanti, pozzetto con tavolino in teak e divano a L
  extrude(g, [
    [-0.5, 0.29], [0.36, 0.29], [0.16, 0.51], [-0.48, 0.51],
  ], 0.44, 0.022, p.white, 0, 0, 0, 0, -Math.PI / 2, 0);
  add(g, new THREE.BoxGeometry(0.49, 0.125, 0.58), p.tintedGlass, 0, 0.395, -0.13);
  add(g, new THREE.BoxGeometry(0.4, 0.14, 0.17), p.tintedGlass, 0, 0.405, 0.22, -0.64);
  // Montanti finestrature + luci di via nautiche (rosso sinistra, verde destra!)
  for (const mz of [-0.34, -0.1, 0.11]) {
    add(g, new THREE.BoxGeometry(0.5, 0.13, 0.02), p.white, 0, 0.395, mz);
  }
  add(g, new THREE.SphereGeometry(0.018, 10, 10), p.redGlow, -0.255, 0.48, 0.12);
  add(g, new THREE.SphereGeometry(0.018, 10, 10), p.custom(0x22c55e, 0.2, 0), 0.255, 0.48, 0.12);
  // Tavolino e divanetto nel pozzetto di poppa
  add(g, new THREE.BoxGeometry(0.22, 0.022, 0.14), p.teak, 0, 0.37, -0.6);
  add(g, new THREE.CylinderGeometry(0.016, 0.022, 0.09, 10), p.chrome, 0, 0.32, -0.6);
  add(g, new THREE.BoxGeometry(0.36, 0.075, 0.09), p.accent, 0, 0.34, -0.71);

  // Flybridge completo: console di comando con timone, 2 poltrone capitano, parabrezza fumé e prendisole
  add(g, new THREE.BoxGeometry(0.38, 0.085, 0.48), p.white, 0, 0.555, -0.19);
  add(g, new THREE.BoxGeometry(0.36, 0.08, 0.04), p.tintedGlass, 0, 0.635, 0.055, -0.52);
  add(g, new THREE.TorusGeometry(0.042, 0.008, 6, 16), p.chrome, -0.07, 0.63, -0.02, 0.6); // timone flybridge
  for (const cx of [-0.08, 0.08]) {
    add(g, new THREE.BoxGeometry(0.095, 0.095, 0.085), p.accent, cx, 0.635, -0.14);
  }
  add(g, new THREE.BoxGeometry(0.3, 0.055, 0.16), p.white, 0, 0.615, -0.34);

  // Arco radar sportivo + doppie cupole satellitari + antenne VHF + barra radar rotante!
  tube(g, [[-0.19, 0.56, -0.26], [-0.16, 0.81, -0.35], [0.16, 0.81, -0.35], [0.19, 0.56, -0.26]], 0.024, p.white, 20, 10);
  for (const s of [-1, 1]) {
    add(g, new THREE.SphereGeometry(0.042, 14, 12), p.white, s * 0.13, 0.85, -0.35); // satcom dome
    add(g, new THREE.CylinderGeometry(0.004, 0.007, 0.32, 6), p.chrome, s * 0.17, 0.96, -0.36, -0.2, 0, -s * 0.12); // VHF
  }
  const radar = new THREE.Group();
  radar.position.set(0, 0.88, -0.35);
  add(radar, new THREE.BoxGeometry(0.24, 0.032, 0.048), p.accent);
  add(radar, new THREE.CylinderGeometry(0.038, 0.048, 0.055, 14), p.chrome, 0, -0.032, 0);
  g.add(radar);
  spinY.push(radar);

  // Battagliola cromata di prua a 10 candelieri + bitte d'ormeggio + ancora a prua + 4 oblò per lato
  tube(g, [[-0.26, 0.36, 0.16], [-0.2, 0.37, 0.52], [0, 0.4, 0.86], [0.2, 0.37, 0.52], [0.26, 0.36, 0.16]], 0.009, p.chrome, 26, 6);
  for (const [bx, bz] of [[-0.25, 0.22], [0.25, 0.22], [-0.21, 0.44], [0.21, 0.44], [-0.13, 0.66], [0.13, 0.66], [0, 0.84]]) {
    add(g, new THREE.CylinderGeometry(0.007, 0.007, 0.095, 6), p.chrome, bx, 0.325, bz);
  }
  add(g, new THREE.BoxGeometry(0.055, 0.045, 0.06), p.chrome, 0, 0.25, 0.91); // musone ancora
  for (const s of [-1, 1]) {
    for (const oz of [-0.36, -0.14, 0.08, 0.3]) {
      add(g, new THREE.CylinderGeometry(0.034, 0.034, 0.02, 14), p.tintedGlass, s * 0.3, 0.2, oz, 0, 0, Math.PI / 2);
      add(g, new THREE.TorusGeometry(0.036, 0.008, 6, 16), p.chrome, s * 0.306, 0.2, oz, 0, Math.PI / 2);
    }
  }

  return { group: g, anim: { spinY } };
}

// 5. BIPLANO CLASSICO (VERSIONE ULTRA-DETTAGLIATA HD+)
function buildBiplane(p: Palette): BuiltModel {
  const g = new THREE.Group();
  const spinZ: THREE.Object3D[] = [];
  const wheels: THREE.Object3D[] = [];

  // Carrello d'atterraggio a V con assale ammortizzato, ruote a raggi e pattino di coda
  for (const s of [-1, 1]) {
    tube(g, [[s * 0.1, 0.34, 0.32], [s * 0.23, 0.115, 0.23]], 0.013, p.darkMetal, 8, 6);
    tube(g, [[s * 0.1, 0.34, 0.12], [s * 0.23, 0.115, 0.23]], 0.013, p.darkMetal, 8, 6);
    const w = makeDetailedWheel(0.115, 0.052, p, { spokes: 8 });
    w.position.set(s * 0.24, 0.115, 0.23);
    g.add(w);
    wheels.push(w);
  }
  add(g, new THREE.CylinderGeometry(0.013, 0.013, 0.48, 8), p.darkMetal, 0, 0.115, 0.23, 0, 0, Math.PI / 2);
  add(g, new THREE.CylinderGeometry(0.004, 0.004, 0.36, 6), p.chrome, 0, 0.22, 0.23, 0, 0, 0.78);
  add(g, new THREE.CylinderGeometry(0.004, 0.004, 0.36, 6), p.chrome, 0, 0.22, 0.23, 0, 0, -0.78);
  // Pattino di coda
  tube(g, [[0, 0.26, -0.62], [0, 0.14, -0.72]], 0.012, p.wood, 6, 6);

  const bodyGroup = new THREE.Group();
  bodyGroup.position.set(0, 0.4, 0);
  bodyGroup.rotation.x = -0.11;
  g.add(bodyGroup);

  // Fusoliera tornita con striscia laterale racing + pannello metallico anteriore
  const fuse = lathe(bodyGroup, [
    [0, -0.82], [0.045, -0.78], [0.098, -0.32], [0.158, 0.04],
    [0.165, 0.36], [0.148, 0.5], [0, 0.5],
  ], p.paint, 28);
  fuse.rotation.x = Math.PI / 2;
  add(bodyGroup, new THREE.CylinderGeometry(0.154, 0.168, 0.16, 26), p.brushed, 0, 0, 0.44, Math.PI / 2);

  // Motore radiale a 9 cilindri alettati + collettore scarico ad anello in ottone + tubi laterali
  add(bodyGroup, new THREE.TorusGeometry(0.138, 0.018, 10, 24), p.brass, 0, 0, 0.49);
  for (let i = 0; i < 9; i++) {
    const a = (i / 9) * Math.PI * 2;
    const ca = Math.cos(a), sa = Math.sin(a);
    add(bodyGroup, new THREE.CylinderGeometry(0.026, 0.028, 0.095, 10), p.darkMetal, ca * 0.142, sa * 0.142, 0.46, 0, 0, a - Math.PI / 2);
    // Alette di raffreddamento del cilindro
    for (const fr of [0.155, 0.175]) {
      add(bodyGroup, new THREE.CylinderGeometry(0.032, 0.032, 0.008, 10), p.chrome, ca * fr, sa * fr, 0.46, 0, 0, a - Math.PI / 2);
    }
  }
  for (const s of [-1, 1]) {
    tube(bodyGroup, [[s * 0.15, -0.04, 0.44], [s * 0.185, -0.05, 0.15], [s * 0.17, -0.05, -0.18]], 0.015, p.darkMetal, 14, 8);
  }

  // Elica bipala scolpita in legno lamellare con mozzo imbullonato in ottone + ogiva (animata!)
  const prop = new THREE.Group();
  prop.position.set(0, 0, 0.56);
  add(prop, new THREE.ConeGeometry(0.056, 0.125, 18), p.chrome, 0, 0, 0.042, Math.PI / 2);
  add(prop, new THREE.CylinderGeometry(0.062, 0.062, 0.025, 16), p.brass, 0, 0, 0, Math.PI / 2);
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    add(prop, new THREE.SphereGeometry(0.008, 6, 6), p.chrome, Math.cos(a) * 0.042, Math.sin(a) * 0.042, 0.014);
  }
  const blade = add(prop, new THREE.BoxGeometry(0.6, 0.068, 0.016), p.wood, 0, 0, 0);
  blade.rotation.x = 0.2;
  add(prop, new THREE.BoxGeometry(0.065, 0.07, 0.018), p.accent, 0.26, 0, 0, 0.2);
  add(prop, new THREE.BoxGeometry(0.065, 0.07, 0.018), p.accent, -0.26, 0, 0, 0.2);
  bodyGroup.add(prop);
  spinZ.push(prop);

  // Abitacolo con bordo in pelle, poggiatesta aerodinamico, cruscotto strumenti e parabrezza con cornice
  add(bodyGroup, new THREE.TorusGeometry(0.095, 0.024, 10, 20), p.leather, 0, 0.145, -0.06, Math.PI / 2);
  add(bodyGroup, new THREE.ConeGeometry(0.052, 0.22, 12), p.paint, 0, 0.16, -0.23, -Math.PI / 2); // headrest fairing
  add(bodyGroup, new THREE.BoxGeometry(0.14, 0.085, 0.014), p.glass, 0, 0.195, 0.04, -0.45);
  add(bodyGroup, new THREE.BoxGeometry(0.15, 0.014, 0.018), p.chrome, 0, 0.23, 0.022, -0.45);
  // 2 carenature strumenti/sincronizzatori sul cofano superiore
  for (const s of [-1, 1]) {
    add(bodyGroup, new THREE.CylinderGeometry(0.014, 0.014, 0.22, 8), p.darkMetal, s * 0.055, 0.175, 0.22, Math.PI / 2);
  }

  // Ali superiore e inferiore con centine in rilievo, serbatoio centrale, coccarde e luci di navigazione
  add(bodyGroup, new THREE.BoxGeometry(1.42, 0.036, 0.28), p.paint, 0, -0.08, 0.16);
  add(bodyGroup, new THREE.BoxGeometry(1.52, 0.036, 0.31), p.paint, 0, 0.34, 0.2);
  // Centine alari (ribs) in rilievo + serbatoio centrale sull'ala superiore
  add(bodyGroup, new THREE.BoxGeometry(0.26, 0.052, 0.26), p.accent, 0, 0.35, 0.2);
  for (let rx = -0.66; rx <= 0.67; rx += 0.12) {
    add(bodyGroup, new THREE.BoxGeometry(0.008, 0.042, 0.295), p.paint, rx, 0.342, 0.2);
    add(bodyGroup, new THREE.BoxGeometry(0.008, 0.042, 0.265), p.paint, rx, -0.078, 0.16);
  }
  for (const s of [-1, 1]) {
    // Coccarde tricolore sull'ala superiore
    add(bodyGroup, new THREE.CylinderGeometry(0.095, 0.095, 0.04, 20), p.white, s * 0.5, 0.342, 0.2);
    add(bodyGroup, new THREE.CylinderGeometry(0.06, 0.06, 0.044, 20), p.accent, s * 0.5, 0.343, 0.2);
    add(bodyGroup, new THREE.CylinderGeometry(0.026, 0.026, 0.048, 16), p.paint, s * 0.5, 0.344, 0.2);
    // Luci di estremità alare (rosso sinistra, verde destra)
    add(bodyGroup, new THREE.SphereGeometry(0.018, 10, 10), s < 0 ? p.redGlow : p.custom(0x22c55e, 0.2, 0), s * 0.765, 0.34, 0.22);
    // Montanti cabane centrali + doppi montanti interalari in legno + tiranti metallici a X
    tube(bodyGroup, [[s * 0.1, 0.12, 0.26], [s * 0.14, 0.34, 0.26]], 0.011, p.darkMetal, 6, 6);
    tube(bodyGroup, [[s * 0.1, 0.12, 0.1], [s * 0.14, 0.34, 0.1]], 0.011, p.darkMetal, 6, 6);
    for (const sx of [0.26, 0.56]) {
      add(bodyGroup, new THREE.CylinderGeometry(0.012, 0.012, 0.42, 8), p.wood, s * sx, 0.13, 0.27);
      add(bodyGroup, new THREE.CylinderGeometry(0.012, 0.012, 0.42, 8), p.wood, s * sx, 0.13, 0.11);
    }
    add(bodyGroup, new THREE.CylinderGeometry(0.004, 0.004, 0.52, 6), p.chrome, s * 0.41, 0.13, 0.19, 0, 0, s * 0.66);
    add(bodyGroup, new THREE.CylinderGeometry(0.004, 0.004, 0.52, 6), p.chrome, s * 0.41, 0.13, 0.19, 0, 0, -s * 0.66);
  }

  // Impennaggio di coda con piano orizzontale controventato, timone e squadrette di comando
  add(bodyGroup, new THREE.BoxGeometry(0.5, 0.024, 0.17), p.accent, 0, 0.025, -0.68);
  for (const s of [-1, 1]) {
    tube(bodyGroup, [[s * 0.04, -0.04, -0.68], [s * 0.18, 0.02, -0.68]], 0.007, p.darkMetal, 6, 6);
  }
  extrude(bodyGroup, [[-0.15, 0], [0.13, 0], [-0.01, 0.26], [-0.15, 0.24]], 0.024, 0.006, p.accent, 0, 0.025, -0.7, 0, -Math.PI / 2, 0);
  add(bodyGroup, new THREE.BoxGeometry(0.028, 0.2, 0.055), p.white, 0, 0.13, -0.75);

  return { group: g, anim: { spinZ, wheels } };
}

// 6. FOTOCAMERA REFLEX PROFESSIONALE (VERSIONE ULTRA-DETTAGLIATA)
function buildCamera(p: Palette): BuiltModel {
  const g = new THREE.Group();

  // Corpo principale smussato con angoli cilindrici (lega di magnesio + pannelli similpelle texturizzata)
  add(g, new THREE.BoxGeometry(0.92, 0.56, 0.34), p.leather, 0, 0.32, -0.05);
  add(g, new THREE.BoxGeometry(1.0, 0.56, 0.24), p.leather, 0, 0.32, -0.05);
  for (const sx of [-0.46, 0.46]) {
    for (const sz of [-0.17, 0.07]) {
      add(g, new THREE.CylinderGeometry(0.05, 0.05, 0.56, 14), p.leather, sx, 0.32, sz);
    }
  }

  // Calotta superiore e piastra di fondo fresate in metallo verniciato/spazzolato con viti
  add(g, new THREE.BoxGeometry(0.95, 0.115, 0.35), p.paint, 0, 0.645, -0.05);
  add(g, new THREE.BoxGeometry(1.01, 0.115, 0.25), p.paint, 0, 0.645, -0.05);
  for (const sx of [-0.46, 0.46]) {
    for (const sz of [-0.17, 0.07]) {
      add(g, new THREE.CylinderGeometry(0.052, 0.052, 0.115, 14), p.paint, sx, 0.645, sz);
    }
  }
  add(g, new THREE.BoxGeometry(0.98, 0.052, 0.355), p.brushed, 0, 0.026, -0.05);
  // Attacco filettato per treppiede sotto il fondello
  add(g, new THREE.CylinderGeometry(0.045, 0.045, 0.02, 16), p.chrome, 0.02, 0.005, -0.05);

  // Impugnatura ergonomica destra (handgrip) scolpita + ghiera anteriore + accento + LED AF + leva autoscatto
  add(g, new THREE.CylinderGeometry(0.115, 0.128, 0.61, 20), p.rubber, -0.43, 0.33, 0.095);
  add(g, new THREE.BoxGeometry(0.038, 0.32, 0.045), p.accent, -0.345, 0.43, 0.165, 0, 0, 0.14);
  // Ghiera di comando anteriore zigrinata incassata nell'impugnatura
  add(g, new THREE.CylinderGeometry(0.046, 0.046, 0.032, 20), p.darkMetal, -0.38, 0.56, 0.195, Math.PI / 2, 0, 0.3);
  // Pulsante sblocco obiettivo cromato + LED AF assist + leva autoscatto vintage
  add(g, new THREE.CylinderGeometry(0.026, 0.028, 0.032, 14), p.chrome, -0.255, 0.26, 0.135, Math.PI / 2);
  add(g, new THREE.SphereGeometry(0.02, 12, 10), p.glow, -0.275, 0.52, 0.13);
  add(g, new THREE.CylinderGeometry(0.024, 0.024, 0.03, 14), p.chrome, 0.34, 0.42, 0.135, Math.PI / 2);
  add(g, new THREE.BoxGeometry(0.026, 0.11, 0.022), p.chrome, 0.355, 0.36, 0.148, 0, 0, 0.24);

  // Pentaprisma scolpito ad alta definizione + targhetta frontale "SDROGO" + slitta hot-shoe multi-pezzo
  extrude(g, [
    [-0.23, 0], [0.23, 0], [0.155, 0.225], [-0.155, 0.225],
  ], 0.33, 0.022, p.paint, 0.02, 0.69, -0.04);
  // Targhetta incisa frontale sul pentaprisma
  const badgeMat = new THREE.MeshStandardMaterial({ map: cameraBadgeTex(), roughness: 0.3, metalness: 0.5 });
  add(g, new THREE.BoxGeometry(0.24, 0.068, 0.016), badgeMat, 0.02, 0.805, 0.142, -0.14);
  // Hot-shoe con guide laterali cromate + contatto centrale in ottone
  add(g, new THREE.BoxGeometry(0.155, 0.018, 0.155), p.darkMetal, 0.02, 0.935, -0.04);
  for (const s of [-1, 1]) {
    add(g, new THREE.BoxGeometry(0.026, 0.026, 0.15), p.chrome, 0.02 + s * 0.068, 0.946, -0.04);
  }
  add(g, new THREE.BoxGeometry(0.155, 0.022, 0.022), p.chrome, 0.02, 0.946, 0.028);
  add(g, new THREE.CylinderGeometry(0.016, 0.016, 0.012, 12), p.brass, 0.02, 0.946, -0.04);

  // Calotta superiore: ghiera tempi incisa (Canvas HD), leva avanzamento, manovella riavvolgimento, scatto filettato
  const dialMat = new THREE.MeshStandardMaterial({ map: cameraDialTex(), roughness: 0.35, metalness: 0.45 });
  // Ghiera tempi di scatto (destra, zigrinata + faccia superiore stampata)
  add(g, new THREE.CylinderGeometry(0.088, 0.09, 0.078, 28), p.darkMetal, -0.26, 0.74, -0.04);
  add(g, new THREE.CircleGeometry(0.084, 28), dialMat, -0.26, 0.781, -0.04, -Math.PI / 2);
  // Leva avanzamento / accensione con puntale nero
  add(g, new THREE.BoxGeometry(0.18, 0.022, 0.036), p.chrome, -0.34, 0.735, -0.11, 0, -0.35, 0);
  add(g, new THREE.BoxGeometry(0.075, 0.028, 0.046), p.rubber, -0.43, 0.735, -0.14, 0, -0.35, 0);
  // Finestrella contapose LCD/analogica
  add(g, new THREE.BoxGeometry(0.09, 0.012, 0.065), p.tintedGlass, -0.36, 0.706, -0.04);
  // Pulsante di scatto filettato + collare cromato inclinato
  add(g, new THREE.CylinderGeometry(0.052, 0.058, 0.036, 18), p.chrome, -0.39, 0.715, 0.1, 0.24);
  add(g, new THREE.CylinderGeometry(0.036, 0.038, 0.058, 18), p.accent, -0.39, 0.735, 0.105, 0.24);
  add(g, new THREE.CylinderGeometry(0.011, 0.011, 0.062, 10), p.darkMetal, -0.39, 0.738, 0.106, 0.24);
  // Sinistra: manovella riavvolgimento / selettore modalità con perno ribaltabile + ghiera ISO
  add(g, new THREE.CylinderGeometry(0.095, 0.098, 0.085, 28), p.darkMetal, 0.34, 0.745, -0.05);
  add(g, new THREE.CylinderGeometry(0.086, 0.086, 0.092, 24), p.chrome, 0.34, 0.745, -0.05);
  add(g, new THREE.BoxGeometry(0.12, 0.022, 0.034), p.chrome, 0.38, 0.8, -0.05, 0, 0.4, 0);
  add(g, new THREE.CylinderGeometry(0.016, 0.016, 0.048, 10), p.darkMetal, 0.43, 0.81, -0.07);

  // Retro professionale: oculare con conchiglia in gomma, rotella diottrie, schermo LCD Live-View HUD, D-Pad e pulsanti
  add(g, new THREE.BoxGeometry(0.18, 0.13, 0.075), p.rubber, 0.02, 0.735, -0.245);
  add(g, new THREE.CylinderGeometry(0.046, 0.046, 0.04, 18), p.lensGlass, 0.02, 0.735, -0.275, Math.PI / 2);
  add(g, new THREE.CylinderGeometry(0.02, 0.02, 0.024, 12), p.chrome, 0.13, 0.74, -0.22, Math.PI / 2); // diopter dial
  // Display LCD posteriore Live-View luminoso con cornice
  const lcdMat = new THREE.MeshStandardMaterial({
    map: cameraLcdTex(),
    emissiveMap: cameraLcdTex(),
    emissive: new THREE.Color(0xffffff),
    emissiveIntensity: 0.48,
    roughness: 0.12,
  });
  add(g, new THREE.BoxGeometry(0.56, 0.39, 0.025), p.darkMetal, 0.11, 0.31, -0.228);
  add(g, new THREE.PlaneGeometry(0.51, 0.34), lcdMat, 0.11, 0.31, -0.242, 0, Math.PI, 0);
  // Controlli posteriori a destra (lato sinistro visto da dietro): thumb rest, D-pad, 4 bottoni funzione
  add(g, new THREE.BoxGeometry(0.16, 0.055, 0.045), p.rubber, -0.34, 0.56, -0.23);
  add(g, new THREE.CylinderGeometry(0.068, 0.072, 0.024, 20), p.darkMetal, -0.32, 0.33, -0.23, Math.PI / 2);
  add(g, new THREE.CylinderGeometry(0.026, 0.026, 0.032, 14), p.chrome, -0.32, 0.33, -0.234, Math.PI / 2);
  for (const [bx, by] of [[-0.38, 0.46], [-0.26, 0.46], [-0.38, 0.19], [-0.26, 0.19]]) {
    add(g, new THREE.CylinderGeometry(0.022, 0.024, 0.024, 12), p.darkMetal, bx, by, -0.23, Math.PI / 2);
  }

  // Occhielli laterali con anelli triangolari cromati per la tracolla
  for (const s of [-1, 1]) {
    add(g, new THREE.CylinderGeometry(0.024, 0.024, 0.04, 12), p.chrome, s * 0.51, 0.58, -0.05, 0, 0, Math.PI / 2);
    add(g, new THREE.TorusGeometry(0.045, 0.0085, 8, 3), p.chrome, s * 0.545, 0.555, -0.05, 0, Math.PI / 2, Math.PI);
  }

  // OBIETTIVO 50mm f/1.4 PRO: baionetta, scala distanze HD, 32 zigrinature 3D, iride a 8 lamelle e paraluce a petalo!
  const lens = new THREE.Group();
  lens.position.set(0.02, 0.34, 0.125);
  lens.rotation.x = Math.PI / 2;
  g.add(lens);

  // Flangia baionetta cromata + pallino rosso di allineamento
  add(lens, new THREE.CylinderGeometry(0.258, 0.258, 0.032, 36), p.chrome, 0, 0.016, 0);
  add(lens, new THREE.SphereGeometry(0.012, 10, 10), p.redGlow, 0, 0.034, -0.245);

  // Barilotto multi-gradino tornito
  lathe(lens, [
    [0.242, 0.03], [0.242, 0.14], [0.228, 0.16], [0.228, 0.22],
    [0.25, 0.24], [0.25, 0.41], [0.232, 0.43], [0.232, 0.5],
    [0.2, 0.5], [0.185, 0.42], [0.16, 0.32], [0, 0.28],
  ], p.darkMetal, 40);

  // Scala distanze & diaframmi stampata (Canvas HD) attorno al barilotto
  const scaleMat = new THREE.MeshStandardMaterial({ map: lensScaleTex(), roughness: 0.4, metalness: 0.3 });
  add(lens, new THREE.CylinderGeometry(0.231, 0.231, 0.068, 36, 1, true), scaleMat, 0, 0.19, 0);

  // Ghiera di messa a fuoco con 32 rilievi zigrinati in gomma reale 3D!
  add(lens, new THREE.CylinderGeometry(0.254, 0.254, 0.155, 36), p.rubber, 0, 0.325, 0);
  for (let i = 0; i < 32; i++) {
    const a = (i / 32) * Math.PI * 2;
    add(lens, new THREE.BoxGeometry(0.012, 0.148, 0.014), p.rubber, Math.cos(a) * 0.257, 0.325, Math.sin(a) * 0.257, 0, -a, 0);
  }
  // Anello metallico serie PRO + ghiera diaframmi posteriore zigrinata
  add(lens, new THREE.TorusGeometry(0.236, 0.014, 10, 36), p.accent, 0, 0.45, 0, Math.PI / 2);
  add(lens, new THREE.TorusGeometry(0.244, 0.009, 8, 36), p.chrome, 0, 0.14, 0, Math.PI / 2);

  // Diaframma interno a 8 lamelle visibile dietro la lente frontale!
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    add(lens, new THREE.BoxGeometry(0.11, 0.008, 0.055), p.darkMetal, Math.cos(a) * 0.125, 0.34, Math.sin(a) * 0.125, 0, -a + 0.45, 0);
  }
  // Elementi ottici multi-rivestiti iridescenti (lente interna + lente frontale convessa)
  add(lens, new THREE.SphereGeometry(0.16, 24, 14, 0, Math.PI * 2, 0, Math.PI * 0.36), p.tintedGlass, 0, 0.27, 0);
  add(lens, new THREE.SphereGeometry(0.19, 28, 16, 0, Math.PI * 2, 0, Math.PI * 0.42), p.lensGlass, 0, 0.36, 0);

  // Paraluce a petalo (tulip hood) a 4 lobi scolpiti
  for (let i = 0; i < 4; i++) {
    const startA = i * (Math.PI / 2) + 0.18;
    const h = i % 2 === 0 ? 0.145 : 0.085;
    const petal = add(lens, new THREE.CylinderGeometry(0.245, 0.232, h, 14, 1, true, startA, Math.PI / 2 - 0.32), p.darkMetal, 0, 0.5 + h / 2, 0);
    petal.material = (p.darkMetal as THREE.MeshStandardMaterial).clone();
    (petal.material as THREE.MeshStandardMaterial).side = THREE.DoubleSide;
  }
  add(lens, new THREE.TorusGeometry(0.233, 0.01, 8, 36), p.darkMetal, 0, 0.5, 0, Math.PI / 2);

  return { group: g, anim: {} };
}

// 7. MOKA ITALIANA (VERSIONE ULTRA-DETTAGLIATA HD+)
function buildMoka(p: Palette): BuiltModel {
  const g = new THREE.Group();

  // Caldaia inferiore ottagonale con basamento smussato e costolature sugli 8 spigoli
  add(g, new THREE.CylinderGeometry(0.365, 0.34, 0.035, 8), p.chrome, 0, 0.018, 0);
  add(g, new THREE.CylinderGeometry(0.265, 0.365, 0.42, 8), p.brushed, 0, 0.24, 0);
  // 8 nervature lucide lungo gli spigoli della caldaia
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2 + Math.PI / 8;
    tube(g, [[Math.cos(a) * 0.362, 0.035, Math.sin(a) * 0.362], [Math.cos(a) * 0.266, 0.445, Math.sin(a) * 0.266]], 0.008, p.chrome, 6, 6);
  }
  // Valvola di sicurezza esagonale in ottone tornito con sede, ghiera e pistoncino centrale
  add(g, new THREE.CylinderGeometry(0.044, 0.046, 0.03, 6), p.brass, 0.305, 0.32, 0, 0, 0, Math.PI / 2);
  add(g, new THREE.CylinderGeometry(0.032, 0.036, 0.065, 14), p.brass, 0.33, 0.32, 0, 0, 0, Math.PI / 2);
  add(g, new THREE.CylinderGeometry(0.015, 0.015, 0.095, 12), p.chrome, 0.342, 0.32, 0, 0, 0, Math.PI / 2);

  // Giunzione filettata centrale con guarnizione scura visibile e collare godronato
  add(g, new THREE.CylinderGeometry(0.295, 0.295, 0.035, 28), p.chrome, 0, 0.46, 0);
  add(g, new THREE.TorusGeometry(0.288, 0.012, 8, 28), p.rubber, 0, 0.478, 0, Math.PI / 2);
  add(g, new THREE.CylinderGeometry(0.282, 0.292, 0.036, 8), p.paint, 0, 0.495, 0);

  // Raccoglitore superiore ottagonale svasato + 8 spigoli cromati + fascia accento
  add(g, new THREE.CylinderGeometry(0.355, 0.25, 0.5, 8), p.paint, 0, 0.76, 0);
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2 + Math.PI / 8;
    tube(g, [[Math.cos(a) * 0.254, 0.515, Math.sin(a) * 0.254], [Math.cos(a) * 0.356, 1.005, Math.sin(a) * 0.356]], 0.008, p.chrome, 6, 6);
  }
  // Beccuccio versatore scolpito con incavo interno scuro
  extrude(g, [
    [0, 0], [0.185, 0.06], [0.165, 0.11], [0.065, 0.25], [0, 0.25],
  ], 0.14, 0.016, p.paint, 0.275, 0.77, 0);
  add(g, new THREE.BoxGeometry(0.08, 0.04, 0.085), p.darkMetal, 0.38, 0.99, 0, 0, 0, -0.35);

  // Coperchio ottagonale a doppio gradino, cerniera a 3 nodi con perno e levetta alzacoperchio
  add(g, new THREE.CylinderGeometry(0.368, 0.368, 0.032, 8), p.chrome, 0, 1.022, 0);
  add(g, new THREE.ConeGeometry(0.345, 0.145, 8), p.brushed, 0, 1.11, 0);
  add(g, new THREE.TorusGeometry(0.345, 0.01, 8, 8), p.accent, 0, 1.04, 0, Math.PI / 2, Math.PI / 8);
  // Pomello in bachelite sagomato a clessidra con vite superiore in ottone
  lathe(g, [
    [0, 0], [0.042, 0], [0.036, 0.055], [0.098, 0.125], [0.095, 0.155], [0.045, 0.165], [0, 0.165],
  ], p.rubber, 24, 1.15);
  add(g, new THREE.CylinderGeometry(0.022, 0.022, 0.014, 14), p.brass, 0, 1.316, 0);
  // Cerniera a 3 nodi + perno cromato + aletta alzacoperchio in bachelite
  for (const hz of [-0.04, 0, 0.04]) {
    add(g, new THREE.CylinderGeometry(0.024, 0.024, 0.03, 12), p.chrome, -0.355, 1.01, hz, Math.PI / 2);
  }
  add(g, new THREE.CylinderGeometry(0.01, 0.01, 0.13, 8), p.brass, -0.355, 1.01, 0, Math.PI / 2);
  add(g, new THREE.BoxGeometry(0.11, 0.024, 0.055), p.rubber, -0.42, 1.035, 0, 0, 0, -0.25);

  // Manico ergonomico in bachelite con attacchi metallici imbullonati superiore e inferiore
  add(g, new THREE.BoxGeometry(0.095, 0.075, 0.075), p.chrome, -0.33, 0.92, 0);
  add(g, new THREE.BoxGeometry(0.085, 0.065, 0.07), p.chrome, -0.285, 0.56, 0);
  tube(g, [
    [-0.33, 0.92, 0], [-0.52, 0.9, 0], [-0.57, 0.78, 0], [-0.52, 0.62, 0], [-0.42, 0.55, 0], [-0.28, 0.56, 0],
  ], 0.038, p.rubber, 28, 12);
  for (const s of [-1, 1]) {
    add(g, new THREE.SphereGeometry(0.012, 8, 8), p.brass, -0.355, 0.92, s * 0.04);
    add(g, new THREE.SphereGeometry(0.012, 8, 8), p.brass, -0.31, 0.56, s * 0.038);
  }

  return { group: g, anim: {} };
}

// 8. FARO COSTIERO CON CASA DEL GUARDIANO E LENTE FRESNEL (VERSIONE ULTRA-DETTAGLIATA HD+)
function buildLighthouse(p: Palette): BuiltModel {
  const g = new THREE.Group();
  const spinY: THREE.Object3D[] = [];

  // Scogliera stratificata realistica + muretto in pietra + bitta d'ormeggio
  const rockMat = p.custom(0x666e78, 0.88, 0.06);
  const darkRock = p.custom(0x4b525c, 0.9, 0.05);
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    const r = 0.22 + (i % 3) * 0.085;
    const rock = add(g, new THREE.DodecahedronGeometry(0.14 + (i % 3) * 0.035, 0), i % 2 ? rockMat : darkRock, Math.cos(a) * r, 0.075, Math.sin(a) * r, i * 0.5, i * 0.9, 0);
    rock.scale.set(1.25, 0.58, 1.15);
  }
  // Base pavimentata in pietra + scalini ingresso
  add(g, new THREE.CylinderGeometry(0.36, 0.4, 0.09, 20), rockMat, 0, 0.11, 0);
  for (let s = 0; s < 3; s++) {
    add(g, new THREE.BoxGeometry(0.14, 0.025, 0.05 + s * 0.03), rockMat, 0, 0.16 - s * 0.024, 0.27 + s * 0.032);
  }

  // Casetta del guardiano addossata alla torre (tetto a falde, camino, finestre illuminate calde!)
  const cottage = new THREE.Group();
  cottage.position.set(-0.27, 0.15, -0.06);
  cottage.rotation.y = -0.35;
  g.add(cottage);
  add(cottage, new THREE.BoxGeometry(0.24, 0.17, 0.22), p.white, 0, 0.085, 0);
  // Tetto a due falde nel colore del giocatore
  extrude(cottage, [[-0.14, 0], [0.14, 0], [0, 0.1]], 0.24, 0.008, p.paint, 0, 0.17, 0);
  add(cottage, new THREE.BoxGeometry(0.045, 0.1, 0.045), p.custom(0x8c4a3c, 0.8, 0.05), -0.07, 0.25, -0.05); // camino
  // Finestre calde luminose della casetta
  add(cottage, new THREE.BoxGeometry(0.055, 0.06, 0.015), p.glow, -0.04, 0.09, 0.112);
  add(cottage, new THREE.BoxGeometry(0.055, 0.06, 0.015), p.glow, -0.04, 0.09, -0.112);
  add(cottage, new THREE.BoxGeometry(0.015, 0.06, 0.055), p.glow, -0.122, 0.09, 0);

  // Torre rastremata a 5 fasce + porticina ad arco con timpano + 4 finestrelle a spirale con davanzali
  for (let i = 0; i < 5; i++) {
    const y0 = 0.15 + i * 0.185;
    const rBot = 0.27 - i * 0.02;
    const rTop = 0.27 - (i + 1) * 0.02;
    add(g, new THREE.CylinderGeometry(rTop, rBot, 0.186, 28), i % 2 === 0 ? p.white : p.paint, 0, y0 + 0.092, 0);
  }
  // Portale con cornice in pietra e maniglia in ottone
  add(g, new THREE.BoxGeometry(0.11, 0.17, 0.06), p.wood, 0, 0.24, 0.245);
  add(g, new THREE.CylinderGeometry(0.055, 0.055, 0.06, 14), p.wood, 0, 0.325, 0.245, Math.PI / 2);
  add(g, new THREE.BoxGeometry(0.15, 0.022, 0.08), rockMat, 0, 0.385, 0.25);
  add(g, new THREE.SphereGeometry(0.01, 8, 8), p.brass, 0.032, 0.24, 0.28);
  for (let k = 0; k < 4; k++) {
    const a = k * 1.65 + 0.55;
    const y = 0.42 + k * 0.165;
    const r = 0.242 - k * 0.018;
    const win = new THREE.Group();
    win.position.set(Math.sin(a) * r, y, Math.cos(a) * r);
    win.rotation.y = a;
    add(win, new THREE.BoxGeometry(0.058, 0.085, 0.032), p.glow);
    add(win, new THREE.BoxGeometry(0.072, 0.014, 0.048), p.darkMetal, 0, -0.046, 0.008); // davanzale
    add(win, new THREE.BoxGeometry(0.01, 0.085, 0.038), p.darkMetal); // crociera
    add(win, new THREE.BoxGeometry(0.058, 0.01, 0.038), p.darkMetal);
    g.add(win);
  }

  // Galleria con 16 mensole a sbalzo (corbels) + ringhiera in ferro battuto a doppio corrimano
  add(g, new THREE.CylinderGeometry(0.275, 0.18, 0.075, 28), p.darkMetal, 0, 1.1, 0);
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * Math.PI * 2;
    add(g, new THREE.BoxGeometry(0.02, 0.065, 0.055), rockMat, Math.cos(a) * 0.215, 1.045, Math.sin(a) * 0.215, 0, -a + Math.PI / 2, 0);
    add(g, new THREE.CylinderGeometry(0.0065, 0.0065, 0.095, 6), p.darkMetal, Math.cos(a) * 0.26, 1.185, Math.sin(a) * 0.26);
  }
  add(g, new THREE.TorusGeometry(0.26, 0.011, 8, 32), p.darkMetal, 0, 1.23, 0, Math.PI / 2);
  add(g, new THREE.TorusGeometry(0.26, 0.007, 6, 32), p.darkMetal, 0, 1.185, 0, Math.PI / 2);

  // Lanterna con vetrata a montanti elicoidali incrociati + LENTE DI FRESNEL multianello rotante + doppio fascio!
  add(g, new THREE.CylinderGeometry(0.165, 0.165, 0.24, 24), p.glass, 0, 1.26, 0);
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    add(g, new THREE.CylinderGeometry(0.008, 0.008, 0.25, 6), p.darkMetal, Math.cos(a) * 0.168, 1.26, Math.sin(a) * 0.168, 0, -a, 0.28);
    add(g, new THREE.CylinderGeometry(0.008, 0.008, 0.25, 6), p.darkMetal, Math.cos(a) * 0.168, 1.26, Math.sin(a) * 0.168, 0, -a, -0.28);
  }
  const lamp = new THREE.Group();
  lamp.position.set(0, 1.26, 0);
  add(lamp, new THREE.CylinderGeometry(0.068, 0.068, 0.14, 16), p.glow);
  // Anelli prismatici della lente di Fresnel
  for (const fy of [-0.045, 0, 0.045]) {
    add(lamp, new THREE.TorusGeometry(0.088, 0.01, 8, 20), p.brass, 0, fy, 0, Math.PI / 2);
  }
  // Doppio cono di luce opposto rotante
  const beamMat = new THREE.MeshBasicMaterial({ color: 0xfff3b0, transparent: true, opacity: 0.24, side: THREE.DoubleSide, depthWrite: false });
  add(lamp, new THREE.ConeGeometry(0.17, 0.68, 18, 1, true), beamMat, 0, 0, 0.38, -Math.PI / 2);
  add(lamp, new THREE.ConeGeometry(0.17, 0.68, 18, 1, true), beamMat, 0, 0, -0.38, Math.PI / 2);
  g.add(lamp);
  spinY.push(lamp);

  // Cupola costolata, sfera di ventilazione, rosa dei venti (banderuola) e parafulmine in ottone
  add(g, new THREE.SphereGeometry(0.172, 24, 14, 0, Math.PI * 2, 0, Math.PI / 2), p.paint, 0, 1.38, 0);
  add(g, new THREE.TorusGeometry(0.172, 0.014, 8, 24), p.darkMetal, 0, 1.38, 0, Math.PI / 2);
  add(g, new THREE.SphereGeometry(0.038, 14, 12), p.brass, 0, 1.565, 0);
  add(g, new THREE.CylinderGeometry(0.007, 0.012, 0.18, 8), p.brass, 0, 1.65, 0);
  // Banderuola direzionale cardinale
  add(g, new THREE.BoxGeometry(0.15, 0.008, 0.008), p.brass, 0, 1.66, 0);
  add(g, new THREE.BoxGeometry(0.008, 0.008, 0.15), p.brass, 0, 1.66, 0);
  add(g, new THREE.ConeGeometry(0.016, 0.045, 6), p.brass, 0.08, 1.66, 0, 0, 0, -Math.PI / 2);

  return { group: g, anim: { spinY } };
}

// 9. MAPPAMONDO ANTICO CON MERIDIANO GRADUATO IN OTTONE (NUOVA PEDINA)
function buildGlobe(p: Palette, primaryHex: string): BuiltModel {
  const g = new THREE.Group();
  const spinY: THREE.Object3D[] = [];

  // Piedistallo tornito in noce massello con modanature e anello in ottone
  lathe(g, [
    [0, 0], [0.38, 0], [0.38, 0.045], [0.33, 0.075], [0.22, 0.11],
    [0.12, 0.18], [0.15, 0.23], [0.1, 0.29], [0.13, 0.33], [0.09, 0.37], [0, 0.37],
  ], p.wood, 36);
  add(g, new THREE.TorusGeometry(0.355, 0.015, 10, 36), p.brass, 0, 0.055, 0, Math.PI / 2);
  add(g, new THREE.TorusGeometry(0.145, 0.014, 8, 24), p.brass, 0, 0.23, 0, Math.PI / 2);

  // 3 mensole curve in ottone/noce che sorreggono l'anello dell'orizzonte
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI * 2 + Math.PI / 6;
    const ca = Math.cos(a), sa = Math.sin(a);
    tube(g, [
      [ca * 0.11, 0.26, sa * 0.11],
      [ca * 0.36, 0.42, sa * 0.36],
      [ca * 0.46, 0.78, sa * 0.46],
    ], 0.022, p.wood, 16, 8);
    add(g, new THREE.SphereGeometry(0.026, 10, 10), p.brass, ca * 0.46, 0.77, sa * 0.46);
  }

  // Anello orizzonte circolare con rosa dei venti e tacche graduate (Canvas HD)
  const horizY = 0.81;
  add(g, new THREE.TorusGeometry(0.47, 0.036, 12, 42), p.wood, 0, horizY, 0, Math.PI / 2);
  add(g, new THREE.TorusGeometry(0.506, 0.011, 8, 42), p.brass, 0, horizY + 0.01, 0, Math.PI / 2);
  const horizonMat = new THREE.MeshStandardMaterial({ map: horizonRingTex(), roughness: 0.45, metalness: 0.1 });
  add(g, new THREE.RingGeometry(0.435, 0.502, 44), horizonMat, 0, horizY + 0.037, 0, -Math.PI / 2);

  // Gruppo meridiano + sfera del mondo inclinato a 23.5° (inclinazione assiale terrestre reale)
  const assembly = new THREE.Group();
  assembly.position.set(0, horizY, 0);
  g.add(assembly);

  // Staffa inferiore di supporto del meridiano
  add(assembly, new THREE.CylinderGeometry(0.048, 0.068, 0.46, 16), p.brass, 0, -0.26, 0);

  // Semicerchio meridiano graduato in ottone (raggio 0.415) + 19 tacche incise lungo l'arco
  add(assembly, new THREE.TorusGeometry(0.415, 0.022, 10, 40, Math.PI + 0.25), p.brass, 0, 0, 0, 0, 0, -Math.PI / 2 - 0.125);
  for (let i = 0; i <= 18; i++) {
    const a = -Math.PI / 2 + (i / 18) * Math.PI;
    add(assembly, new THREE.BoxGeometry(0.026, 0.008, 0.048), p.darkMetal, Math.cos(a) * 0.415, Math.sin(a) * 0.415, 0, 0, 0, a);
  }
  // Puntale decorativo in ottone in sommità
  lathe(assembly, [
    [0, 0], [0.042, 0], [0.022, 0.05], [0.035, 0.09], [0.01, 0.15], [0, 0.17],
  ], p.brass, 16, 0.415);

  // Asse inclinato a 23.5° (0.41 rad) con perni polari in ottone
  const tilt = new THREE.Group();
  tilt.rotation.z = -0.41;
  assembly.add(tilt);

  add(tilt, new THREE.CylinderGeometry(0.015, 0.015, 0.86, 12), p.brass, 0, 0, 0);
  // Calotte polari in ottone (Polo Nord e Polo Sud)
  add(tilt, new THREE.CylinderGeometry(0.065, 0.085, 0.028, 18), p.brass, 0, 0.365, 0);
  add(tilt, new THREE.CylinderGeometry(0.085, 0.065, 0.028, 18), p.brass, 0, -0.365, 0);

  // Sfera cartografica anticata laccata lucida (ruota dolcemente attorno al proprio asse!)
  const globeMat = new THREE.MeshPhysicalMaterial({
    map: globeMapTex(primaryHex),
    roughness: 0.24,
    metalness: 0.05,
    clearcoat: 0.85,
    clearcoatRoughness: 0.12,
  });
  const sphere = add(tilt, new THREE.SphereGeometry(0.365, 42, 28), globeMat);
  // Fascia equatoriale metallica sottile attorno al globo
  add(sphere, new THREE.TorusGeometry(0.366, 0.006, 6, 42), p.brass, 0, 0, 0, Math.PI / 2);
  spinY.push(sphere);

  return { group: g, anim: { spinY } };
}

// 10. RAZZO SPAZIALE RETRO-SCI-FI (VERSIONE ULTRA-DETTAGLIATA HD+)
function buildRocket(p: Palette): BuiltModel {
  const g = new THREE.Group();
  const pulse: THREE.Mesh[] = [];

  // Fusoliera tornita aerodinamica con giunzioni stadi e 2 bande di 20 micro-rivetti!
  lathe(g, [
    [0, 0.16], [0.165, 0.16], [0.225, 0.3], [0.268, 0.54],
    [0.258, 0.82], [0.2, 1.08], [0.11, 1.28], [0.028, 1.42], [0, 1.48],
  ], p.white, 40);

  // Ogiva superiore con scudo termico metallico e antenna telemetrica a 2 dischi
  lathe(g, [
    [0.203, 1.07], [0.114, 1.28], [0.032, 1.42], [0, 1.485],
  ], p.paint, 36);
  add(g, new THREE.CylinderGeometry(0.006, 0.018, 0.22, 10), p.chrome, 0, 1.56, 0);
  add(g, new THREE.TorusGeometry(0.036, 0.007, 8, 16), p.brass, 0, 1.54, 0, Math.PI / 2);
  add(g, new THREE.TorusGeometry(0.022, 0.006, 8, 16), p.brass, 0, 1.6, 0, Math.PI / 2);
  add(g, new THREE.SphereGeometry(0.016, 10, 10), p.redGlow, 0, 1.68, 0);

  // Fasce stadio con anelli cromati e 20 micro-rivetti per fascia
  add(g, new THREE.CylinderGeometry(0.27, 0.27, 0.085, 36), p.paint, 0, 0.54, 0);
  for (const [ry, rr] of [[0.495, 0.268], [0.585, 0.268], [1.06, 0.204]]) {
    add(g, new THREE.TorusGeometry(rr, 0.012, 8, 36), p.chrome, 0, ry, 0, Math.PI / 2);
    for (let i = 0; i < 18; i++) {
      const a = (i / 18) * Math.PI * 2;
      add(g, new THREE.SphereGeometry(0.008, 6, 6), p.brass, Math.cos(a) * (rr + 0.006), ry + 0.02, Math.sin(a) * (rr + 0.006));
    }
  }

  // 4 ugelli RCS di assetto sullo stadio superiore
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
    const ca = Math.cos(a), sa = Math.sin(a);
    add(g, new THREE.BoxGeometry(0.038, 0.055, 0.038), p.darkMetal, ca * 0.215, 0.98, sa * 0.215, 0, -a, 0);
    add(g, new THREE.ConeGeometry(0.012, 0.025, 8), p.chrome, ca * 0.24, 0.98, sa * 0.24, 0, 0, -Math.PI / 2);
  }

  // Oblò principale con cornice in ottone a 12 bulloni, profondità cabina e lente convessa iridescente
  add(g, new THREE.TorusGeometry(0.11, 0.024, 12, 28), p.brass, 0, 0.8, 0.238);
  add(g, new THREE.CylinderGeometry(0.092, 0.092, 0.04, 22), p.darkMetal, 0, 0.8, 0.215, Math.PI / 2);
  add(g, new THREE.SphereGeometry(0.095, 20, 14), p.lensGlass, 0, 0.8, 0.22);
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    add(g, new THREE.SphereGeometry(0.009, 6, 6), p.chrome, Math.cos(a) * 0.114, 0.8 + Math.sin(a) * 0.114, 0.258);
  }
  // Portello d'accesso posteriore con cerniere e volantino di chiusura
  add(g, new THREE.BoxGeometry(0.14, 0.22, 0.026), p.brushed, 0, 0.78, -0.252);
  add(g, new THREE.TorusGeometry(0.028, 0.007, 6, 14), p.brass, 0.03, 0.78, -0.27);

  // 4 alette stabilizzatrici scolpite con nervature, ammortizzatori idraulici e piastre d'atterraggio!
  for (let i = 0; i < 4; i++) {
    const fin = new THREE.Group();
    fin.rotation.y = (i * Math.PI) / 2 + Math.PI / 4;
    extrude(fin, [
      [0.19, 0.46], [0.39, 0.28], [0.43, 0.02], [0.33, 0.02], [0.28, 0.2], [0.17, 0.22],
    ], 0.032, 0.009, p.paint);
    // Striscia accento + pistone idraulico cromato + piedino d'appoggio circolare
    add(fin, new THREE.BoxGeometry(0.06, 0.16, 0.038), p.accent, 0.36, 0.14, 0, 0, 0, 0.18);
    add(fin, new THREE.CylinderGeometry(0.026, 0.034, 0.14, 12), p.darkMetal, 0.38, 0.08, 0);
    add(fin, new THREE.CylinderGeometry(0.015, 0.015, 0.07, 10), p.chrome, 0.38, 0.03, 0);
    add(fin, new THREE.CylinderGeometry(0.052, 0.06, 0.022, 16), p.darkMetal, 0.38, 0.011, 0);
    tube(fin, [[0.18, 0.22, 0], [0.34, 0.09, 0]], 0.01, p.chrome, 6, 6);
    g.add(fin);
  }

  // Ugello motore a campana con anelli di raffreddamento rigenerativo + tubazioni turbopompa + fiamma a doppio strato!
  lathe(g, [[0.145, 0.18], [0.105, 0.12], [0.17, 0.02], [0.152, 0.02], [0.088, 0.12]], p.darkMetal, 28);
  for (const [ny, nr] of [[0.05, 0.155], [0.085, 0.135], [0.12, 0.112]]) {
    add(g, new THREE.TorusGeometry(nr, 0.008, 8, 24), p.brass, 0, ny, 0, Math.PI / 2);
  }
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2;
    tube(g, [[Math.cos(a) * 0.14, 0.19, Math.sin(a) * 0.14], [Math.cos(a) * 0.16, 0.11, Math.sin(a) * 0.16], [Math.cos(a) * 0.15, 0.05, Math.sin(a) * 0.15]], 0.008, p.chrome, 8, 6);
  }
  const flameOuter = add(g, new THREE.ConeGeometry(0.11, 0.2, 18), p.glow, 0, 0.0, 0, Math.PI);
  const flameCore = add(g, new THREE.ConeGeometry(0.06, 0.14, 14), p.white, 0, 0.03, 0, Math.PI);
  pulse.push(flameOuter, flameCore);

  return { group: g, anim: { pulse } };
}

// 11. CAVALLO DEGLI SCACCHI (SCULTURA STAUNTON DA COLLEZIONE — VERSIONE ULTRA-DETTAGLIATA HD+)
function buildChessKnight(p: Palette): BuiltModel {
  const g = new THREE.Group();

  // Piedistallo Staunton tornito a 7 modanature con anello in peltro/ottone intarsiato
  lathe(g, [
    [0, 0], [0.38, 0], [0.38, 0.045], [0.34, 0.075], [0.355, 0.1], [0.3, 0.145],
    [0.24, 0.2], [0.22, 0.255], [0.27, 0.285], [0.22, 0.315], [0, 0.315],
  ], p.paint, 40);
  add(g, new THREE.TorusGeometry(0.36, 0.014, 10, 36), p.brass, 0, 0.055, 0, Math.PI / 2);
  add(g, new THREE.TorusGeometry(0.255, 0.017, 10, 36), p.accent, 0, 0.285, 0, Math.PI / 2);
  add(g, new THREE.TorusGeometry(0.23, 0.009, 8, 32), p.brass, 0, 0.315, 0, Math.PI / 2);

  // Corpo principale equino scolpito con petto possente, collo arcuato e muso raffinato
  extrude(g, [
    [-0.19, 0.3], [0.2, 0.3], [0.25, 0.48], [0.14, 0.67],
    [0.36, 0.61], [0.44, 0.68], [0.41, 0.78], [0.24, 0.92],
    [0.14, 1.05], [-0.02, 1.07], [-0.16, 0.99],
    [-0.27, 0.82], [-0.28, 0.54],
  ], 0.19, 0.058, p.paint, 0, 0, 0, 0, -Math.PI / 2, 0);

  // Strati anatomici scolpiti sui fianchi (guance, mascella, spalle) + orecchie gemelle appuntite!
  for (const s of [-1, 1]) {
    const cheek = add(g, new THREE.SphereGeometry(0.115, 16, 14), p.paint, s * 0.09, 0.82, 0.04);
    cheek.scale.set(0.62, 0.95, 1.15);
    const shoulder = add(g, new THREE.SphereGeometry(0.145, 16, 14), p.paint, s * 0.095, 0.46, 0.02);
    shoulder.scale.set(0.7, 1.1, 1.15);
    // Orecchio appuntito inclinato in avanti con incavo interno
    add(g, new THREE.ConeGeometry(0.048, 0.17, 8), p.paint, s * 0.068, 1.13, -0.02, 0.22, 0, -s * 0.18);
    add(g, new THREE.ConeGeometry(0.026, 0.11, 6), p.accent, s * 0.068, 1.12, 0.005, 0.22, 0, -s * 0.18);
    // Arcata sopracciliare + occhio incastonato in ottone + narice scavata
    add(g, new THREE.SphereGeometry(0.032, 12, 10), p.paint, s * 0.125, 0.89, 0.15);
    add(g, new THREE.SphereGeometry(0.024, 12, 10), p.brass, s * 0.132, 0.865, 0.165);
    add(g, new THREE.SphereGeometry(0.016, 8, 8), p.darkMetal, s * 0.095, 0.695, 0.39);
  }
  // Solco bocca + briglia regale in ottone attorno al muso e al collo
  add(g, new THREE.BoxGeometry(0.16, 0.012, 0.12), p.darkMetal, 0, 0.65, 0.37, 0.18);
  tube(g, [[-0.13, 0.72, 0.3], [0, 0.76, 0.34], [0.13, 0.72, 0.3]], 0.012, p.brass, 12, 6);
  tube(g, [[-0.135, 0.72, 0.3], [-0.15, 0.8, 0.08], [-0.16, 0.56, -0.06]], 0.011, p.brass, 14, 6);
  tube(g, [[0.135, 0.72, 0.3], [0.15, 0.8, 0.08], [0.16, 0.56, -0.06]], 0.011, p.brass, 14, 6);
  // Collare bardatura pettorale con 5 borchie dorate
  tube(g, [[-0.18, 0.54, -0.06], [-0.17, 0.48, 0.14], [0, 0.44, 0.25], [0.17, 0.48, 0.14], [0.18, 0.54, -0.06]], 0.016, p.brass, 18, 8);
  for (const [bx, by, bz] of [[0, 0.44, 0.265], [-0.12, 0.47, 0.2], [0.12, 0.47, 0.2]]) {
    add(g, new THREE.SphereGeometry(0.018, 10, 10), p.chrome, bx, by, bz);
  }

  // Criniera scolpita a 11 ciocche ondulate graduate lungo tutta la curva del collo!
  for (let i = 0; i < 11; i++) {
    const t = i / 10;
    const z = -0.175 - Math.sin(t * Math.PI) * 0.11;
    const y = 0.39 + t * 0.65;
    const scale = 0.75 + Math.sin(t * Math.PI) * 0.45;
    const lock = add(g, new THREE.BoxGeometry(0.075 * scale, 0.065, 0.115 * scale), i % 2 === 0 ? p.accent : p.brass, 0, y, z, -0.25 - t * 0.48);
    lock.rotation.y = (i % 2 === 0 ? 1 : -1) * 0.06;
  }

  return { group: g, anim: {} };
}

// 12. OROLOGIO DA TASCHINO TOURBILLON (VERSIONE ULTRA-DETTAGLIATA)
function buildPocketWatch(p: Palette): BuiltModel {
  const g = new THREE.Group();
  const gears: { obj: THREE.Object3D; speed: number }[] = [];

  // Leggio espositore da collezione in legno di noce con cuscino in velluto e bracci in ottone
  add(g, new THREE.BoxGeometry(0.46, 0.045, 0.42), p.wood, 0, 0.0225, -0.02);
  add(g, new THREE.BoxGeometry(0.4, 0.015, 0.36), p.paint, 0, 0.05, -0.02);
  add(g, new THREE.BoxGeometry(0.22, 0.32, 0.042), p.wood, 0, 0.19, -0.19, 0.34);
  for (const s of [-1, 1]) {
    tube(g, [[s * 0.14, 0.06, 0.02], [s * 0.15, 0.15, 0.12], [s * 0.13, 0.24, 0.08]], 0.016, p.brass, 12, 8);
  }

  const watch = new THREE.Group();
  watch.position.set(0, 0.56, 0.01);
  watch.rotation.x = -0.15;
  g.add(watch);

  // Cassa lenticolare cesellata + bordo zigrinato a moneta (coin-edge) + doppia lunetta
  const caseMesh = add(watch, new THREE.SphereGeometry(0.455, 40, 26), p.brass);
  caseMesh.scale.set(1, 1, 0.35);
  // Zigrinatura perimetrale della carrure
  for (let i = 0; i < 36; i++) {
    const a = (i / 36) * Math.PI * 2;
    add(watch, new THREE.BoxGeometry(0.012, 0.012, 0.11), p.brass, Math.cos(a) * 0.452, Math.sin(a) * 0.452, 0, 0, 0, a);
  }
  add(watch, new THREE.TorusGeometry(0.432, 0.044, 14, 44), p.chrome, 0, 0, 0.092);
  add(watch, new THREE.TorusGeometry(0.452, 0.022, 12, 44), p.paint, 0, 0, 0.028);

  // Quadrante Guilloché HD con finestra Tourbillon open-heart alle ore 6
  const dialMat = new THREE.MeshStandardMaterial({ map: watchDialTex(), roughness: 0.32, metalness: 0.06 });
  add(watch, new THREE.CircleGeometry(0.398, 44), dialMat, 0, 0, 0.106);

  // MECCANISMO TOURBILLON 3D ESPOSTO (3 ingranaggi dentati animati + rubini + ponte curvo in ottone!)
  const tourb = new THREE.Group();
  tourb.position.set(0, -0.165, 0.114);
  watch.add(tourb);

  const rubyMat = new THREE.MeshPhysicalMaterial({ color: 0xe11d48, roughness: 0.06, metalness: 0.1, clearcoat: 1.0, emissive: 0x881337, emissiveIntensity: 0.35 });
  // Ingranaggio 1: bilanciere principale in ottone (14 denti)
  const g1 = makeCogwheel(0.072, 14, 0.012, p.brass, p.chrome);
  g1.position.set(0, 0, 0);
  tourb.add(g1);
  gears.push({ obj: g1, speed: 1.4 });
  add(tourb, new THREE.SphereGeometry(0.014, 10, 10), rubyMat, 0, 0, 0.012);

  // Ingranaggio 2: ruota di scappamento in acciaio cromato (10 denti, rotazione inversa)
  const g2 = makeCogwheel(0.046, 10, 0.012, p.chrome, p.brass);
  g2.position.set(-0.068, 0.036, 0.004);
  tourb.add(g2);
  gears.push({ obj: g2, speed: -2.2 });
  add(tourb, new THREE.SphereGeometry(0.01, 10, 10), rubyMat, -0.068, 0.036, 0.014);

  // Ingranaggio 3: pignone in ottone dorato (9 denti)
  const g3 = makeCogwheel(0.042, 9, 0.012, p.brass, p.chrome);
  g3.position.set(0.066, 0.03, 0.004);
  tourb.add(g3);
  gears.push({ obj: g3, speed: -2.6 });
  add(tourb, new THREE.SphereGeometry(0.01, 10, 10), rubyMat, 0.066, 0.03, 0.014);

  // Ponte del Tourbillon scolpito ad arco sopra gli ingranaggi + cornice circolare dorata
  add(tourb, new THREE.TorusGeometry(0.112, 0.012, 8, 28), p.brass, 0, 0, 0.008);
  tube(tourb, [[-0.112, 0, 0.014], [0, 0, 0.022], [0.112, 0, 0.014]], 0.011, p.brass, 14, 8);

  // Lancette Breguet scolpite con occhiello circolare tipico + lancetta secondi con contrappeso
  const hourHand = new THREE.Group();
  hourHand.position.z = 0.132;
  hourHand.rotation.z = -0.85;
  add(hourHand, new THREE.BoxGeometry(0.022, 0.16, 0.008), p.darkMetal, 0, 0.06, 0);
  add(hourHand, new THREE.TorusGeometry(0.024, 0.007, 6, 14), p.darkMetal, 0, 0.155, 0);
  add(hourHand, new THREE.ConeGeometry(0.013, 0.055, 6), p.darkMetal, 0, 0.2, 0);
  watch.add(hourHand);

  const minuteHand = new THREE.Group();
  minuteHand.position.z = 0.14;
  minuteHand.rotation.z = 0.68;
  add(minuteHand, new THREE.BoxGeometry(0.016, 0.24, 0.008), p.darkMetal, 0, 0.1, 0);
  add(minuteHand, new THREE.TorusGeometry(0.02, 0.006, 6, 14), p.darkMetal, 0, 0.24, 0);
  add(minuteHand, new THREE.ConeGeometry(0.01, 0.065, 6), p.darkMetal, 0, 0.285, 0);
  watch.add(minuteHand);

  const secondHand = new THREE.Group();
  secondHand.position.z = 0.148;
  add(secondHand, new THREE.BoxGeometry(0.008, 0.35, 0.006), p.redGlow, 0, 0.1, 0);
  add(secondHand, new THREE.TorusGeometry(0.016, 0.005, 6, 12), p.brass, 0, -0.075, 0);
  watch.add(secondHand);

  add(watch, new THREE.CylinderGeometry(0.028, 0.028, 0.045, 16), p.brass, 0, 0, 0.138, Math.PI / 2);

  // Vetro minerale bombato trasparente
  const crystal = add(watch, new THREE.SphereGeometry(0.405, 32, 18, 0, Math.PI * 2, 0, Math.PI * 0.4), p.glass, 0, 0, 0.055, Math.PI / 2);
  crystal.scale.set(1, 0.28, 1);

  // COPERCHIO HUNTER A CERNIERA APERTO (~110° a sinistra!) con incisione interna e bottone chiusura
  const hinge = new THREE.Group();
  hinge.position.set(-0.445, 0, 0.095);
  hinge.rotation.y = -1.92; // aperto verso l'esterno-sinistra per mostrare il quadrante!
  watch.add(hinge);
  // Cilindri della cerniera
  for (const hy of [-0.045, 0, 0.045]) {
    add(hinge, new THREE.CylinderGeometry(0.022, 0.022, 0.035, 12), p.brass, 0, hy, 0);
  }
  const lid = add(hinge, new THREE.SphereGeometry(0.435, 32, 18, 0, Math.PI * 2, 0, Math.PI * 0.42), p.brass, 0.445, 0, -0.055, Math.PI / 2);
  lid.scale.set(1, 0.24, 1);
  add(hinge, new THREE.TorusGeometry(0.425, 0.022, 10, 36), p.brass, 0.445, 0, 0.01);
  // Medaglione decorativo smaltato sul coperchio
  add(hinge, new THREE.CylinderGeometry(0.18, 0.18, 0.015, 24), p.paint, 0.445, 0, 0.068, Math.PI / 2);
  add(hinge, new THREE.TorusGeometry(0.185, 0.012, 8, 24), p.chrome, 0.445, 0, 0.07);

  // Collo, corona zigrinata a 14 scanalature, pulsante scatto e anello pendente (bow)
  add(watch, new THREE.CylinderGeometry(0.05, 0.065, 0.11, 18), p.brass, 0, 0.47, 0);
  add(watch, new THREE.CylinderGeometry(0.072, 0.072, 0.068, 20), p.chrome, 0, 0.555, 0);
  for (let i = 0; i < 14; i++) {
    const a = (i / 14) * Math.PI * 2;
    add(watch, new THREE.BoxGeometry(0.012, 0.062, 0.012), p.brass, Math.cos(a) * 0.075, 0.555, Math.sin(a) * 0.075, 0, -a, 0);
  }
  add(watch, new THREE.CylinderGeometry(0.036, 0.036, 0.025, 14), p.brass, 0, 0.6, 0);
  add(watch, new THREE.TorusGeometry(0.115, 0.018, 10, 28), p.brass, 0, 0.635, 0);

  // CATENELLA DA TASCHINO IN OTTONE (16 maglie 3D adagiate dal gancio fino al basamento!)
  const chainPts: [number, number, number][] = [
    [0.1, 1.15, -0.06], [0.24, 1.05, -0.04], [0.36, 0.88, -0.02], [0.44, 0.68, 0.02],
    [0.46, 0.46, 0.06], [0.43, 0.25, 0.11], [0.35, 0.11, 0.15], [0.22, 0.07, 0.16],
    [0.08, 0.07, 0.17], [-0.06, 0.07, 0.16], [-0.18, 0.07, 0.14],
  ];
  const chainCurve = new THREE.CatmullRomCurve3(chainPts.map((pt) => new THREE.Vector3(...pt)));
  const links = 18;
  for (let i = 0; i <= links; i++) {
    const t = i / links;
    const pos = chainCurve.getPoint(t);
    const tan = chainCurve.getTangent(t);
    const link = add(g, new THREE.TorusGeometry(0.028, 0.0085, 7, 14), p.brass, pos.x, pos.y, pos.z);
    link.lookAt(pos.clone().add(tan));
    if (i % 2 === 1) link.rotateZ(Math.PI / 2);
  }
  // Ciondolo finale a medaglietta sulla punta della catenella
  add(g, new THREE.CylinderGeometry(0.042, 0.042, 0.015, 18), p.brass, -0.22, 0.072, 0.13);
  add(g, new THREE.CylinderGeometry(0.026, 0.026, 0.018, 16), p.paint, -0.22, 0.073, 0.13);

  return { group: g, anim: { secondHand, minuteHand, gears } };
}

// 13. CORONA REALE IMPERIALE (VERSIONE ULTRA-DETTAGLIATA HD+)
function buildCrown(p: Palette): BuiltModel {
  const g = new THREE.Group();

  // Bordo inferiore in pelliccia d'ermellino bianco con 12 codine nere stilizzate!
  add(g, new THREE.TorusGeometry(0.365, 0.044, 12, 40), p.white, 0, 0.044, 0, Math.PI / 2);
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    add(g, new THREE.ConeGeometry(0.012, 0.042, 6), p.darkMetal, Math.cos(a) * 0.405, 0.042, Math.sin(a) * 0.405, 0, -a, Math.PI);
  }

  // Fascia circolare cesellata in oro con doppi cordoni e 24 perline superiori e inferiori
  add(g, new THREE.CylinderGeometry(0.4, 0.365, 0.21, 36, 1, true), p.brass, 0, 0.17, 0);
  add(g, new THREE.TorusGeometry(0.368, 0.02, 10, 40), p.brass, 0, 0.08, 0, Math.PI / 2);
  add(g, new THREE.TorusGeometry(0.402, 0.02, 10, 40), p.brass, 0, 0.275, 0, Math.PI / 2);
  for (let i = 0; i < 24; i++) {
    const a = (i / 24) * Math.PI * 2;
    add(g, new THREE.SphereGeometry(0.016, 8, 8), p.white, Math.cos(a) * 0.378, 0.092, Math.sin(a) * 0.378);
    add(g, new THREE.SphereGeometry(0.016, 8, 8), p.white, Math.cos(a) * 0.408, 0.268, Math.sin(a) * 0.408);
  }

  // Cuscino regale in velluto a 8 spicchi imbottiti nel colore del giocatore
  const cushion = add(g, new THREE.SphereGeometry(0.345, 32, 20), p.paint, 0, 0.37, 0);
  cushion.scale.set(1, 0.68, 1);
  add(g, new THREE.CylinderGeometry(0.345, 0.34, 0.18, 32), p.paint, 0, 0.16, 0);

  // 8 archi imperiali a S con 6 perle ciascuno (48 perle!) + 8 castoni con gemme + gigli & croci patenti alternate!
  const gemColors = [0xd90429, 0x0077b6, 0x10b981, 0x7c3aed];
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    const ca = Math.cos(a), sa = Math.sin(a);
    const archPts: [number, number, number][] = [
      [ca * 0.4, 0.28, sa * 0.4],
      [ca * 0.445, 0.51, sa * 0.445],
      [ca * 0.26, 0.7, sa * 0.26],
      [ca * 0.08, 0.66, sa * 0.08],
      [0, 0.65, 0],
    ];
    tube(g, archPts, 0.022, p.brass, 22, 8);
    // 6 perle incastonate lungo il dorso dell'arco
    const curve = new THREE.CatmullRomCurve3(archPts.map((pt) => new THREE.Vector3(...pt)));
    for (let k = 1; k <= 6; k++) {
      const pt = curve.getPoint(k / 7);
      add(g, new THREE.SphereGeometry(0.018, 8, 8), p.white, pt.x * 1.045, pt.y + 0.018, pt.z * 1.045);
    }

    // Castone dorato con 4 micro-griffe + gemma taglio cuscino sfaccettata sulla fascia
    const gemGrp = new THREE.Group();
    gemGrp.position.set(ca * 0.39, 0.175, sa * 0.39);
    gemGrp.rotation.y = -a + Math.PI / 2;
    add(gemGrp, new THREE.BoxGeometry(0.095, 0.085, 0.025), p.brass);
    const gemMat = new THREE.MeshPhysicalMaterial({
      color: gemColors[i % gemColors.length], roughness: 0.05, metalness: 0.1, clearcoat: 1, iridescence: 0.5, flatShading: true,
    });
    add(gemGrp, new THREE.OctahedronGeometry(0.044, 0), gemMat, 0, 0, 0.02);
    g.add(gemGrp);

    // Sommità del cerchio: alternanza di Croci Patenti e Gigli (Fleur-de-Lis)
    const crest = new THREE.Group();
    crest.position.set(ca * 0.402, 0.32, sa * 0.402);
    crest.rotation.y = -a + Math.PI / 2;
    if (i % 2 === 0) {
      // Croce patente reale
      add(crest, new THREE.BoxGeometry(0.085, 0.036, 0.018), p.brass, 0, 0.02, 0);
      add(crest, new THREE.BoxGeometry(0.036, 0.09, 0.018), p.brass, 0, 0.02, 0);
      add(crest, new THREE.SphereGeometry(0.018, 8, 8), gemMat, 0, 0.02, 0.014);
    } else {
      // Fleur-de-lis (giglio a 3 petali)
      add(crest, new THREE.ConeGeometry(0.026, 0.105, 6), p.brass, 0, 0.03, 0);
      add(crest, new THREE.ConeGeometry(0.02, 0.075, 6), p.brass, -0.032, 0.01, 0, 0, 0, 0.55);
      add(crest, new THREE.ConeGeometry(0.02, 0.075, 6), p.brass, 0.032, 0.01, 0, 0, 0, -0.55);
    }
    g.add(crest);
  }

  // Globo crucigero (Monde) cinto da fasce di perle + Croce Patente con rubino centrale
  add(g, new THREE.SphereGeometry(0.092, 22, 18), p.brass, 0, 0.76, 0);
  add(g, new THREE.TorusGeometry(0.095, 0.011, 8, 24), p.accent, 0, 0.76, 0, Math.PI / 2);
  add(g, new THREE.TorusGeometry(0.095, 0.01, 8, 24), p.accent, 0, 0.76, 0);
  add(g, new THREE.CylinderGeometry(0.028, 0.016, 0.18, 6), p.brass, 0, 0.94, 0);
  add(g, new THREE.CylinderGeometry(0.024, 0.014, 0.14, 6), p.brass, 0, 0.955, 0, 0, 0, Math.PI / 2);
  const topRuby = new THREE.MeshPhysicalMaterial({ color: 0xe11d48, roughness: 0.05, metalness: 0.1, clearcoat: 1, emissive: 0x881337, emissiveIntensity: 0.3 });
  add(g, new THREE.OctahedronGeometry(0.028, 0), topRuby, 0, 0.955, 0.018);

  return { group: g, anim: {} };
}

// 14. DIAMANTE TAGLIO BRILLANTE SU MONTATURA CON HALO PAVÉ (VERSIONE ULTRA-DETTAGLIATA HD+)
function buildDiamond(p: Palette): BuiltModel {
  const g = new THREE.Group();
  const spinY: THREE.Object3D[] = [];

  // Montatura cattedrale da alta gioielleria: base tornita + galleria traforata a 6 archi + halo di 16 micro-diamanti!
  lathe(g, [
    [0, 0], [0.33, 0], [0.32, 0.045], [0.27, 0.08], [0.17, 0.14],
    [0.25, 0.25], [0.21, 0.25], [0.13, 0.14], [0, 0.11],
  ], p.brass, 36);
  // Collare Halo Pavé con 16 micro-diamanti incastonati tutto intorno alla base!
  add(g, new THREE.TorusGeometry(0.31, 0.018, 10, 36), p.chrome, 0, 0.05, 0, Math.PI / 2);
  const microGem = new THREE.MeshPhysicalMaterial({
    color: 0xf0faff, roughness: 0.02, metalness: 0.1, clearcoat: 1.0, iridescence: 1.0, flatShading: true,
  });
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * Math.PI * 2;
    add(g, new THREE.OctahedronGeometry(0.026, 0), microGem, Math.cos(a) * 0.312, 0.068, Math.sin(a) * 0.312);
  }

  // 6 griffe affusolate in platino con archi di galleria + punte arrotondate a tenaglia sulla cintura
  add(g, new THREE.TorusGeometry(0.295, 0.014, 10, 32), p.brass, 0, 0.36, 0, Math.PI / 2);
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    const ca = Math.cos(a), sa = Math.sin(a);
    tube(g, [
      [ca * 0.17, 0.14, sa * 0.17],
      [ca * 0.32, 0.38, sa * 0.32],
      [ca * 0.39, 0.58, sa * 0.39],
      [ca * 0.325, 0.74, sa * 0.325],
    ], 0.024, p.chrome, 18, 10);
    // Punta artiglio (claw tip) che afferra la corona del diamante
    add(g, new THREE.SphereGeometry(0.028, 12, 10), p.chrome, ca * 0.322, 0.742, sa * 0.322);
    // Filigrana ad arco tra due griffe adiacenti
    const a2 = ((i + 1) / 6) * Math.PI * 2;
    const am = (a + a2) / 2;
    tube(g, [
      [ca * 0.29, 0.36, sa * 0.29],
      [Math.cos(am) * 0.34, 0.45, Math.sin(am) * 0.34],
      [Math.cos(a2) * 0.29, 0.36, Math.sin(a2) * 0.29],
    ], 0.012, p.brass, 12, 6);
  }

  // GEMMA A TAGLIO BRILLANTE IDEALE (Tolkowsky 16 facce + tavola + faccette stella + nucleo fuoco prismatico!)
  const gemGroup = new THREE.Group();
  gemGroup.position.y = 0.64;
  const gemMat = new THREE.MeshPhysicalMaterial({
    color: 0xe6f8ff,
    roughness: 0.01,
    metalness: 0.06,
    clearcoat: 1.0,
    iridescence: 1.0,
    iridescenceIOR: 2.42,
    transparent: true,
    opacity: 0.86,
    flatShading: true,
  });
  // Padiglione principale + piccolo culet inferiore
  add(gemGroup, new THREE.CylinderGeometry(0.365, 0.025, 0.41, 16), gemMat, 0, -0.205, 0);
  // Cintura sfaccettata
  add(gemGroup, new THREE.CylinderGeometry(0.37, 0.37, 0.032, 16), gemMat, 0, 0.016, 0);
  // Corona inferiore (bezel facets) + corona superiore (star facets) + tavola
  add(gemGroup, new THREE.CylinderGeometry(0.285, 0.37, 0.1, 16), gemMat, 0, 0.082, 0);
  add(gemGroup, new THREE.CylinderGeometry(0.205, 0.285, 0.065, 16), gemMat, 0, 0.164, 0);
  // Doppio nucleo interno riflettente per fuoco prismatico colorato nel colore giocatore + accento
  add(gemGroup, new THREE.OctahedronGeometry(0.18, 0), p.paint, 0, -0.04, 0);
  add(gemGroup, new THREE.OctahedronGeometry(0.11, 0), p.glow, 0, 0.02, 0, 0.4, 0.7, 0);
  g.add(gemGroup);
  spinY.push(gemGroup);

  return { group: g, anim: { spinY } };
}

// 15. GRATTACIELO ART DÉCO STILE CHRYSLER (VERSIONE ULTRA-DETTAGLIATA HD+)
function buildSkyscraper(p: Palette): BuiltModel {
  const g = new THREE.Group();
  const pulse: THREE.Mesh[] = [];
  const { map, emissive } = skyscraperTex();
  const facade = new THREE.MeshStandardMaterial({
    map,
    emissiveMap: emissive,
    emissive: new THREE.Color(0xffd27a),
    emissiveIntensity: 0.88,
    roughness: 0.45,
    metalness: 0.22,
  });

  // Basamento monumentale Art Déco con portico a 3 archi luminosi, colonnato e gradinata
  add(g, new THREE.BoxGeometry(0.7, 0.04, 0.7), p.darkMetal, 0, 0.02, 0);
  add(g, new THREE.BoxGeometry(0.65, 0.18, 0.65), p.brushed, 0, 0.13, 0);
  // Grandi portali vetrati luminosi sui 4 lati del basamento
  for (let side = 0; side < 4; side++) {
    const face = new THREE.Group();
    face.rotation.y = (side * Math.PI) / 2;
    add(face, new THREE.BoxGeometry(0.22, 0.13, 0.03), p.glow, 0, 0.1, 0.325);
    add(face, new THREE.BoxGeometry(0.26, 0.022, 0.05), p.brass, 0, 0.17, 0.33); // pensilina ottone
    for (let i = -2; i <= 2; i++) {
      add(face, new THREE.BoxGeometry(0.036, 0.18, 0.038), p.chrome, i * 0.145, 0.13, 0.33);
    }
    g.add(face);
  }

  // 4 gradoni Art Déco (setbacks) con finestre luminose, lesene cromate, balaustre e gargoyle stilizzati agli angoli!
  const tiers: [number, number, number][] = [
    [0.54, 0.34, 0.39],
    [0.44, 0.32, 0.72],
    [0.34, 0.28, 1.02],
    [0.24, 0.22, 1.27],
  ];
  tiers.forEach(([w, h, cy], idx) => {
    add(g, new THREE.BoxGeometry(w, h, w), facade, 0, cy, 0);
    // Cornice perimetrale a balaustra nel colore giocatore + bordino in ottone
    add(g, new THREE.BoxGeometry(w + 0.034, 0.026, w + 0.034), p.paint, 0, cy + h / 2, 0);
    add(g, new THREE.BoxGeometry(w + 0.04, 0.01, w + 0.04), p.brass, 0, cy + h / 2 + 0.016, 0);
    // Lesene angolari verticali cromate + aquile/alette Art Déco sul 2° e 3° gradone!
    for (const sx of [-1, 1]) {
      for (const sz of [-1, 1]) {
        add(g, new THREE.BoxGeometry(0.028, h + 0.02, 0.028), p.chrome, sx * (w / 2), cy, sz * (w / 2));
        if (idx === 1 || idx === 2) {
          add(g, new THREE.BoxGeometry(0.075, 0.028, 0.022), p.chrome, sx * (w / 2 + 0.028), cy + h / 2 - 0.02, sz * (w / 2 + 0.028), 0, Math.atan2(sx, sz), 0);
        }
      }
    }
  });

  // Corona iconica a 4 archi concentrici in acciaio lucido (stile Chrysler Building) con finestrelle triangolari luminose!
  for (let k = 0; k < 4; k++) {
    const r = 0.145 - k * 0.028;
    const y = 1.425 + k * 0.072;
    add(g, new THREE.CylinderGeometry(r * 0.7, r, 0.08, 8), p.chrome, 0, y, 0);
    add(g, new THREE.TorusGeometry(r * 0.92, 0.008, 6, 8), p.paint, 0, y - 0.035, 0, Math.PI / 2, Math.PI / 8);
    // 8 finestrelle a raggiera luminose per ogni livello della corona
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2 + Math.PI / 8;
      add(g, new THREE.ConeGeometry(0.016, 0.036, 4), p.glow, Math.cos(a) * (r * 0.88), y, Math.sin(a) * (r * 0.88), 0, -a, 0);
    }
  }

  // Guglia rastremata scanalata + doppio anello antenna + luce aeronautica rossa lampeggiante
  add(g, new THREE.CylinderGeometry(0.006, 0.024, 0.28, 10), p.chrome, 0, 1.78, 0);
  add(g, new THREE.TorusGeometry(0.022, 0.005, 6, 14), p.brass, 0, 1.74, 0, Math.PI / 2);
  const beacon = add(g, new THREE.SphereGeometry(0.026, 12, 12), p.redGlow, 0, 1.93, 0);
  pulse.push(beacon);

  return { group: g, anim: { pulse } };
}

// 16. CHITARRA ELETTRICA STRAT-STYLE SU STAND (VERSIONE ULTRA-DETTAGLIATA HD+)
function buildGuitar(p: Palette): BuiltModel {
  const g = new THREE.Group();

  // Stand da palco A-frame tubolare con appoggi imbottiti in gomma
  for (const s of [-1, 1]) {
    tube(g, [[s * 0.21, 0.02, 0.14], [s * 0.12, 0.36, -0.14], [0, 0.42, -0.18]], 0.015, p.darkMetal, 12, 8);
    add(g, new THREE.CylinderGeometry(0.022, 0.022, 0.09, 10), p.rubber, s * 0.18, 0.06, 0.14, Math.PI / 2);
  }
  add(g, new THREE.CylinderGeometry(0.014, 0.014, 0.38, 8), p.darkMetal, 0, 0.06, 0.12, 0, 0, Math.PI / 2);
  add(g, new THREE.CylinderGeometry(0.014, 0.014, 0.32, 8), p.darkMetal, 0, 0.03, -0.16, 0, 0, Math.PI / 2);

  const gtr = new THREE.Group();
  gtr.position.set(0, 0.09, 0.02);
  gtr.rotation.x = -0.15;
  g.add(gtr);

  // Corpo scolpito a doppia spalla mancante + reggitracolla cromati + piastra jack inclinata
  extrude(gtr, [
    [-0.18, 0.0], [0.16, 0.0], [0.285, 0.14], [0.275, 0.34], [0.16, 0.44],
    [0.205, 0.565], [0.145, 0.625], [0.08, 0.52], [-0.07, 0.54],
    [-0.155, 0.67], [-0.225, 0.605], [-0.18, 0.45], [-0.275, 0.32], [-0.265, 0.12],
  ], 0.075, 0.024, p.paint);
  // Bottoni tracolla (strap buttons) superiore e inferiore
  add(gtr, new THREE.CylinderGeometry(0.018, 0.014, 0.03, 12), p.chrome, 0, -0.025, 0);
  add(gtr, new THREE.CylinderGeometry(0.018, 0.014, 0.03, 12), p.chrome, -0.195, 0.66, 0, 0, 0, 0.55);
  // Piastra jack di uscita cromata
  add(gtr, new THREE.BoxGeometry(0.055, 0.095, 0.018), p.chrome, 0.18, 0.11, 0.056, 0, 0, -0.35);
  add(gtr, new THREE.CylinderGeometry(0.014, 0.014, 0.024, 12), p.darkMetal, 0.18, 0.11, 0.062, Math.PI / 2);

  // Battipenna multistrato con 9 micro-viti cromate perimetrali!
  extrude(gtr, [
    [-0.145, 0.115], [0.165, 0.14], [0.185, 0.405], [0.06, 0.525], [-0.085, 0.525], [-0.155, 0.34],
  ], 0.015, 0.004, p.white, 0, 0, 0.057);
  for (const [vx, vy] of [[-0.13, 0.14], [0.14, 0.16], [0.165, 0.28], [0.165, 0.39], [0.07, 0.5], [-0.07, 0.5], [-0.135, 0.34], [-0.13, 0.24]]) {
    add(gtr, new THREE.SphereGeometry(0.006, 6, 6), p.chrome, vx, vy, 0.068);
  }

  // 3 pickup single-coil con 6 poli magnetici cromati ciascuno + selettore a 5 posizioni + 3 manopole zigrinate
  for (const [py, rz] of [[0.235, 0.14], [0.34, 0], [0.445, 0]]) {
    add(gtr, new THREE.BoxGeometry(0.165, 0.038, 0.024), p.darkMetal, 0, py, 0.068, 0, 0, rz);
    for (let k = 0; k < 6; k++) {
      const px = -0.055 + k * 0.022;
      add(gtr, new THREE.CylinderGeometry(0.006, 0.006, 0.03, 8), p.chrome, px, py + px * Math.tan(rz), 0.072, Math.PI / 2);
    }
  }
  // Selettore 5-way + 3 manopole Vol/Tone/Tone
  add(gtr, new THREE.BoxGeometry(0.012, 0.06, 0.014), p.darkMetal, 0.115, 0.22, 0.068, 0, 0, 0.35);
  add(gtr, new THREE.BoxGeometry(0.016, 0.024, 0.028), p.white, 0.125, 0.245, 0.084, 0.35, 0, 0.35);
  for (let k = 0; k < 3; k++) {
    const kx = 0.155 - k * 0.034;
    const ky = 0.255 - k * 0.062;
    add(gtr, new THREE.CylinderGeometry(0.024, 0.027, 0.028, 18), p.accent, kx, ky, 0.074, Math.PI / 2);
    add(gtr, new THREE.CylinderGeometry(0.018, 0.018, 0.032, 16), p.white, kx, ky, 0.075, Math.PI / 2);
  }

  // Ponte tremolo a 6 sellette individuali + leva vibrato curvata con puntale bianco
  add(gtr, new THREE.BoxGeometry(0.185, 0.072, 0.022), p.chrome, 0, 0.135, 0.068);
  for (let k = 0; k < 6; k++) {
    add(gtr, new THREE.BoxGeometry(0.019, 0.034, 0.028), p.brushed, -0.055 + k * 0.022, 0.14, 0.074);
  }
  tube(gtr, [[0.075, 0.12, 0.08], [0.13, 0.1, 0.13], [0.19, 0.04, 0.14]], 0.0065, p.chrome, 12, 6);
  add(gtr, new THREE.CylinderGeometry(0.01, 0.01, 0.042, 8), p.white, 0.195, 0.035, 0.142, 0, 0, 0.65);

  // Manico in acero + tastiera in palissandro + capotasto + 18 tasti metallici + segnatasti in madreperla!
  add(gtr, new THREE.BoxGeometry(0.096, 0.8, 0.045), p.teak, 0, 0.89, 0.01);
  add(gtr, new THREE.BoxGeometry(0.088, 0.78, 0.022), p.wood, 0, 0.89, 0.037);
  add(gtr, new THREE.BoxGeometry(0.09, 0.015, 0.026), p.white, 0, 1.28, 0.042); // nut (capotasto)
  const dotFrets = [2, 4, 6, 8, 11, 14, 16];
  for (let f = 0; f < 18; f++) {
    const fy = 0.53 + f * 0.0415;
    add(gtr, new THREE.BoxGeometry(0.088, 0.0055, 0.009), p.chrome, 0, fy, 0.05);
    if (dotFrets.includes(f)) {
      const midY = fy + 0.02;
      if (f === 11) {
        add(gtr, new THREE.CircleGeometry(0.009, 10), p.white, -0.02, midY, 0.051);
        add(gtr, new THREE.CircleGeometry(0.009, 10), p.white, 0.02, midY, 0.051);
      } else {
        add(gtr, new THREE.CircleGeometry(0.009, 10), p.white, 0, midY, 0.051);
      }
    }
  }

  // Paletta scolpita + 2 abbassacorde + 6 meccaniche cromate + 6 corde metalliche calibrate!
  extrude(gtr, [
    [-0.048, 0], [0.048, 0], [0.068, 0.22], [0.02, 0.31], [-0.072, 0.27], [-0.06, 0.12],
  ], 0.03, 0.008, p.teak, 0, 1.28, 0.006);
  for (const ty of [1.35, 1.46]) add(gtr, new THREE.BoxGeometry(0.016, 0.012, 0.016), p.chrome, 0.012, ty, 0.03);
  for (let i = 0; i < 6; i++) {
    const y = 1.32 + i * 0.038;
    const sx = -0.03 + i * 0.012;
    add(gtr, new THREE.CylinderGeometry(0.01, 0.01, 0.042, 10), p.chrome, -0.024, y, 0.028, Math.PI / 2);
    add(gtr, new THREE.CylinderGeometry(0.008, 0.008, 0.045, 8), p.chrome, -0.058, y, 0.008, 0, 0, Math.PI / 2);
    add(gtr, new THREE.BoxGeometry(0.036, 0.022, 0.014), p.chrome, -0.088, y, 0.008);
    // Corda dal ponte fino al capotasto
    add(gtr, new THREE.CylinderGeometry(0.0018 + (5 - i) * 0.00025, 0.0018 + (5 - i) * 0.00025, 1.15, 5), p.chrome, sx, 0.71, 0.062);
    // Tratto corda dal capotasto alla rispettiva meccanica
    tube(gtr, [[sx, 1.28, 0.054], [-0.024, y, 0.04]], 0.0018, p.chrome, 4, 4);
  }

  return { group: g, anim: {} };
}

// 17. GRAMMOFONO ANTICO CON TROMBA A 10 PETALI (VERSIONE ULTRA-DETTAGLIATA HD+)
function buildGramophone(p: Palette, primaryHex: string): BuiltModel {
  const g = new THREE.Group();
  const spinY: THREE.Object3D[] = [];

  // 4 piedini torniti in ottone sotto la cassa
  for (const sx of [-0.23, 0.23]) {
    for (const sz of [-0.23, 0.23]) {
      add(g, new THREE.SphereGeometry(0.036, 12, 10), p.brass, sx, 0.032, sz);
    }
  }

  // Cassa armonica in noce con modanature a 3 gradini, pannelli intarsiati sui 4 lati e targhetta in ottone
  add(g, new THREE.BoxGeometry(0.58, 0.05, 0.58), p.wood, 0, 0.065, 0);
  add(g, new THREE.BoxGeometry(0.51, 0.24, 0.51), p.wood, 0, 0.21, 0);
  add(g, new THREE.BoxGeometry(0.57, 0.048, 0.57), p.wood, 0, 0.345, 0);
  add(g, new THREE.BoxGeometry(0.54, 0.018, 0.54), p.brass, 0, 0.322, 0);
  // Pannelli scolpiti e colonnine d'angolo sui 4 fianchi + targhetta frontale
  for (const sx of [-0.255, 0.255]) {
    for (const sz of [-0.255, 0.255]) {
      add(g, new THREE.CylinderGeometry(0.022, 0.022, 0.24, 12), p.brass, sx, 0.21, sz);
    }
  }
  for (let side = 0; side < 4; side++) {
    const panel = new THREE.Group();
    panel.rotation.y = (side * Math.PI) / 2;
    add(panel, new THREE.BoxGeometry(0.36, 0.14, 0.016), p.brass, 0, 0.21, 0.258);
    add(panel, new THREE.BoxGeometry(0.32, 0.11, 0.022), p.wood, 0, 0.21, 0.26);
    g.add(panel);
  }
  add(g, new THREE.BoxGeometry(0.16, 0.055, 0.02), p.brass, 0, 0.21, 0.272); // targhetta

  // Manovella laterale di carica con rosetta in ottone e impugnatura tornita in noce
  add(g, new THREE.CylinderGeometry(0.04, 0.042, 0.024, 16), p.brass, 0.265, 0.21, 0, 0, 0, Math.PI / 2);
  tube(g, [[0.26, 0.21, 0], [0.37, 0.21, 0], [0.4, 0.14, 0.09], [0.46, 0.14, 0.09]], 0.014, p.brass, 16, 8);
  add(g, new THREE.CylinderGeometry(0.022, 0.026, 0.085, 14), p.wood, 0.49, 0.14, 0.09, 0, 0, Math.PI / 2);
  add(g, new THREE.SphereGeometry(0.016, 10, 10), p.brass, 0.535, 0.14, 0.09);

  // Piatto rotante con bordo dorato + disco 78 giri HD (solchi + etichetta) + levetta freno/velocità!
  add(g, new THREE.BoxGeometry(0.06, 0.016, 0.025), p.brass, 0.21, 0.378, 0.18, 0, -0.4, 0);
  add(g, new THREE.SphereGeometry(0.016, 10, 10), p.chrome, 0.23, 0.392, 0.19);
  const platter = new THREE.Group();
  platter.position.set(0, 0.382, 0);
  add(platter, new THREE.CylinderGeometry(0.245, 0.255, 0.032, 36), p.brass);
  const discMat = new THREE.MeshStandardMaterial({ map: vinylTex(primaryHex), roughness: 0.24, metalness: 0.24 });
  add(platter, new THREE.CylinderGeometry(0.232, 0.232, 0.014, 36), discMat, 0, 0.023, 0);
  add(platter, new THREE.CylinderGeometry(0.011, 0.011, 0.052, 12), p.chrome, 0, 0.036, 0);
  g.add(platter);
  spinY.push(platter);

  // Staffa posteriore scolpita a voluta + braccio fonorivelatore + testina diaframma + puntina sul solco
  add(g, new THREE.CylinderGeometry(0.044, 0.062, 0.19, 18), p.brass, -0.21, 0.44, -0.21);
  tube(g, [[-0.21, 0.49, -0.21], [-0.15, 0.5, -0.02], [-0.08, 0.43, 0.12]], 0.015, p.chrome, 18, 8);
  // Testina riproduttore circolare con membrana di mica e puntina d'acciaio
  add(g, new THREE.CylinderGeometry(0.044, 0.044, 0.026, 18), p.brass, -0.075, 0.435, 0.13, 0, 0, Math.PI / 2);
  add(g, new THREE.CylinderGeometry(0.034, 0.034, 0.028, 16), p.glass, -0.075, 0.435, 0.13, 0, 0, Math.PI / 2);
  add(g, new THREE.ConeGeometry(0.006, 0.038, 6), p.chrome, -0.075, 0.405, 0.13, Math.PI);

  // Collo a collo di cigno + GRANDE TROMBA MORNING-GLORY A 10 PETALI SCANALATI IN OTTONE!
  tube(g, [[-0.21, 0.52, -0.21], [-0.26, 0.76, -0.25], [-0.12, 0.9, -0.14]], 0.038, p.brass, 22, 14);
  const horn = new THREE.Group();
  horn.position.set(-0.1, 0.91, -0.12);
  horn.rotation.set(0.68, 0.35, -0.15);
  const hornMat = (p.brass as THREE.MeshStandardMaterial).clone();
  hornMat.side = THREE.DoubleSide;
  const hornMesh = lathe(horn, [
    [0.036, 0], [0.052, 0.12], [0.095, 0.27], [0.185, 0.43], [0.32, 0.57], [0.435, 0.64],
  ], hornMat, 10);
  hornMesh.castShadow = true;
  // 10 costolature esterne lungo i petali + bordo smerlato colorato della campana
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI * 2;
    const ca = Math.cos(a), sa = Math.sin(a);
    tube(horn, [
      [ca * 0.05, 0.12, sa * 0.05],
      [ca * 0.185, 0.43, sa * 0.185],
      [ca * 0.435, 0.64, sa * 0.435],
    ], 0.009, p.paint, 12, 6);
    // Petalo arrotondato sull'orlo
    add(horn, new THREE.SphereGeometry(0.042, 10, 8), p.brass, Math.cos(a + Math.PI / 10) * 0.42, 0.64, Math.sin(a + Math.PI / 10) * 0.42);
  }
  add(horn, new THREE.TorusGeometry(0.43, 0.016, 10, 24), p.paint, 0, 0.64, 0, Math.PI / 2);
  g.add(horn);

  return { group: g, anim: { spinY } };
}

// 18. CABINATO ARCADE RETRO ANNI '80 (VERSIONE ULTRA-DETTAGLIATA HD+)
function buildArcade(p: Palette, primaryHex: string, accentHex: string): BuiltModel {
  const g = new THREE.Group();
  const pulse: THREE.Mesh[] = [];

  const profile: [number, number][] = [
    [-0.31, 0], [0.33, 0], [0.33, 0.62], [0.4, 0.72], [0.22, 0.79],
    [0.24, 1.13], [0.35, 1.25], [0.33, 1.38], [-0.27, 1.38], [-0.31, 0.6],
  ];

  // Mobile principale sagomato + grafica laterale synthwave + T-MOLDING COLORATO continuo sui bordi!
  extrude(g, profile, 0.64, 0.016, p.darkMetal, 0, 0, 0, 0, -Math.PI / 2, 0);
  const sideArtMat = new THREE.MeshStandardMaterial({ map: arcadeSideArtTex(primaryHex, accentHex), roughness: 0.35, metalness: 0.1 });
  for (const s of [-1, 1]) {
    // Pannello grafico laterale + bordo T-molding luminoso continuo lungo tutto il profilo frontale
    add(g, new THREE.PlaneGeometry(0.56, 1.26), sideArtMat, s * 0.338, 0.68, 0.0, 0, s > 0 ? Math.PI / 2 : -Math.PI / 2, 0);
    const trimPts: [number, number, number][] = [
      [s * 0.33, 0.02, 0.33], [s * 0.33, 0.62, 0.33], [s * 0.33, 0.72, 0.4],
      [s * 0.33, 0.79, 0.22], [s * 0.33, 1.13, 0.24], [s * 0.33, 1.25, 0.35],
      [s * 0.33, 1.38, 0.33], [s * 0.33, 1.38, -0.27],
    ];
    tube(g, trimPts, 0.014, p.paint, 28, 8);
  }

  // Marquee retroilluminato "SDROGO SUPER ARCADE 1984" con modanature cromate + griglia altoparlanti sotto
  const marqueeMat = new THREE.MeshStandardMaterial({
    map: arcadeMarqueeTex(primaryHex),
    emissiveMap: arcadeMarqueeTex(primaryHex),
    emissive: new THREE.Color(0xffffff),
    emissiveIntensity: 0.85,
    roughness: 0.2,
  });
  add(g, new THREE.BoxGeometry(0.58, 0.14, 0.028), marqueeMat, 0, 1.29, 0.335, -0.15);
  add(g, new THREE.BoxGeometry(0.6, 0.016, 0.036), p.chrome, 0, 1.36, 0.325, -0.15);
  add(g, new THREE.BoxGeometry(0.6, 0.016, 0.036), p.chrome, 0, 1.22, 0.345, -0.15);
  // Griglia altoparlanti inclinata sotto il marquee (6 feritoie)
  for (let i = -2; i <= 2; i++) {
    add(g, new THREE.BoxGeometry(0.06, 0.008, 0.08), p.darkMetal, i * 0.095, 1.175, 0.28, 0.45);
  }

  // Schermo CRT bombato incassato con cornice nera e grafica pixel-art HD luminosa!
  const scrMat = new THREE.MeshStandardMaterial({
    map: arcadeScreenTex(),
    emissiveMap: arcadeScreenTex(),
    emissive: new THREE.Color(0xffffff),
    emissiveIntensity: 0.92,
    roughness: 0.1,
  });
  add(g, new THREE.BoxGeometry(0.56, 0.4, 0.03), p.darkMetal, 0, 0.97, 0.235, -0.22);
  add(g, new THREE.BoxGeometry(0.49, 0.35, 0.036), scrMat, 0, 0.97, 0.24, -0.22);
  // Riflesso vetro CRT
  add(g, new THREE.PlaneGeometry(0.49, 0.35), p.glass, 0, 0.97, 0.26, -0.22);

  // Plancia comandi a 2 giocatori: 2 joystick a sfera (rosso & ciano) con ghiera + 6 tasti + P1/P2 start!
  add(g, new THREE.BoxGeometry(0.6, 0.042, 0.23), p.accent, 0, 0.725, 0.3, 0.22);
  for (const [jx, jMat] of [[-0.2, p.redGlow], [0.05, p.glow]] as [number, THREE.Material][]) {
    add(g, new THREE.CylinderGeometry(0.028, 0.028, 0.01, 14), p.darkMetal, jx, 0.752, 0.31, 0.22);
    add(g, new THREE.CylinderGeometry(0.009, 0.009, 0.085, 8), p.chrome, jx, 0.79, 0.315);
    add(g, new THREE.SphereGeometry(0.029, 14, 12), jMat, jx, 0.835, 0.315);
  }
  const btnCols = [0xff2e63, 0xf4b400, 0x2ed573, 0x00d2d3, 0xff9f1a, 0xa55eea];
  // 3 tasti per P1 + 3 tasti per P2 + 2 tasti start bianchi in alto
  for (let i = 0; i < 3; i++) {
    add(g, new THREE.CylinderGeometry(0.018, 0.021, 0.022, 12), p.custom(btnCols[i], 0.2, 0.1), -0.12 + i * 0.045, 0.75 - (i === 1 ? -0.004 : 0), 0.315 + (i === 1 ? -0.022 : 0.012), 0.22);
    add(g, new THREE.CylinderGeometry(0.018, 0.021, 0.022, 12), p.custom(btnCols[i + 3], 0.2, 0.1), 0.13 + i * 0.045, 0.75 - (i === 1 ? -0.004 : 0), 0.315 + (i === 1 ? -0.022 : 0.012), 0.22);
  }
  for (const sx of [-0.04, 0.02]) {
    add(g, new THREE.CylinderGeometry(0.014, 0.016, 0.02, 10), p.white, sx, 0.768, 0.245, 0.22);
  }

  // Gettoniera in acciaio con cornice, serratura cromata, 2 pulsanti 25¢ luminosi pulsanti e vaschette resto!
  add(g, new THREE.BoxGeometry(0.32, 0.36, 0.032), p.darkMetal, 0, 0.36, 0.335);
  add(g, new THREE.BoxGeometry(0.34, 0.38, 0.02), p.chrome, 0, 0.36, 0.326);
  add(g, new THREE.CylinderGeometry(0.016, 0.016, 0.025, 12), p.chrome, 0, 0.5, 0.35, Math.PI / 2); // serratura
  for (const cx of [-0.07, 0.07]) {
    const c = add(g, new THREE.BoxGeometry(0.056, 0.072, 0.04), p.redGlow, cx, 0.42, 0.338);
    pulse.push(c);
    add(g, new THREE.BoxGeometry(0.068, 0.056, 0.038), p.brushed, cx, 0.27, 0.336); // vaschetta resto
  }
  // Griglia ventilazione e piedini livellatori alla base
  for (let k = 0; k < 3; k++) add(g, new THREE.BoxGeometry(0.38, 0.012, 0.016), p.darkMetal, 0, 0.08 + k * 0.026, 0.335);

  return { group: g, anim: { pulse } };
}

// 19. ANCORA MARINARA AMMIRAGLIATO CON CATENA A MAGLIE 3D (VERSIONE ULTRA-DETTAGLIATA HD+)
function buildAnchor(p: Palette): BuiltModel {
  const g = new THREE.Group();

  // Letto di cima marinara arrotolata a 3 spire concentriche + bitta d'ormeggio in ottone
  const ropeMat = p.custom(0xc8a472, 0.9, 0.02);
  add(g, new THREE.TorusGeometry(0.31, 0.042, 12, 32), ropeMat, 0, 0.042, 0, Math.PI / 2);
  add(g, new THREE.TorusGeometry(0.23, 0.04, 12, 28), ropeMat, 0, 0.048, 0, Math.PI / 2);
  add(g, new THREE.TorusGeometry(0.15, 0.036, 10, 24), ropeMat, 0, 0.054, 0, Math.PI / 2);

  const anc = new THREE.Group();
  anc.position.set(0, 0.11, 0);
  anc.rotation.x = -0.18;
  g.add(anc);

  // Fuso centrale ottagonale forgiato rastremato + collari in ottone + bulloni
  add(anc, new THREE.CylinderGeometry(0.05, 0.082, 0.98, 8), p.paint, 0, 0.56, 0);
  add(anc, new THREE.CylinderGeometry(0.086, 0.086, 0.065, 8), p.brass, 0, 0.22, 0);
  add(anc, new THREE.BoxGeometry(0.16, 0.135, 0.16), p.darkMetal, 0, 0.93, 0);
  // Grillo superiore (shackle) con perno passante + grande anello cicala forgiato
  add(anc, new THREE.CylinderGeometry(0.02, 0.02, 0.14, 10), p.chrome, 0, 1.04, 0, 0, 0, Math.PI / 2);
  add(anc, new THREE.TorusGeometry(0.118, 0.028, 12, 28), p.brass, 0, 1.16, 0);

  // Ceppo trasversale in legno di quercia cerchiato con 4 fascette in ferro + sfere terminali in ottone!
  add(anc, new THREE.BoxGeometry(0.74, 0.072, 0.072), p.wood, 0, 0.93, 0);
  for (const hx of [-0.26, -0.14, 0.14, 0.26]) {
    add(anc, new THREE.BoxGeometry(0.026, 0.082, 0.082), p.darkMetal, hx, 0.93, 0);
  }
  for (const s of [-1, 1]) {
    add(anc, new THREE.SphereGeometry(0.064, 16, 14), p.brass, s * 0.39, 0.93, 0);
  }

  // Bracci curvi rinforzati + diamanti di rinforzo + marre affilate a punta di lancia con nervatura centrale
  tube(anc, [
    [-0.46, 0.44, 0], [-0.34, 0.16, 0], [0, 0.06, 0], [0.34, 0.16, 0], [0.46, 0.44, 0],
  ], 0.056, p.paint, 30, 12);
  add(anc, new THREE.CylinderGeometry(0.09, 0.065, 0.11, 8), p.darkMetal, 0, 0.06, 0);
  for (const s of [-1, 1]) {
    extrude(anc, [
      [0, -0.02], [-0.115, 0.06], [0, 0.25], [0.115, 0.06],
    ], 0.036, 0.009, p.chrome, s * 0.455, 0.4, 0, 0, 0, -s * 0.46);
    // Nervatura centrale sulla marra
    add(anc, new THREE.BoxGeometry(0.022, 0.2, 0.054), p.brass, s * 0.455, 0.46, 0, 0, 0, -s * 0.46);
  }

  // CATENA NAVALE A 22 MAGLIE 3D CON TRAVERSINO (stud-link) avvolta dall'anello fino al fuso e alla base!
  const chainPts: [number, number, number][] = [];
  for (let i = 0; i <= 26; i++) {
    const t = i / 26;
    const a = t * Math.PI * 5.2;
    const r = 0.125 + Math.sin(t * Math.PI) * 0.035;
    chainPts.push([Math.cos(a) * r, 1.12 - t * 0.96, Math.sin(a) * r]);
  }
  const chainCurve = new THREE.CatmullRomCurve3(chainPts.map((pt) => new THREE.Vector3(...pt)));
  const links = 24;
  for (let i = 0; i <= links; i++) {
    const t = i / links;
    const pos = chainCurve.getPoint(t);
    const tan = chainCurve.getTangent(t);
    const link = new THREE.Group();
    link.position.copy(pos);
    link.lookAt(pos.clone().add(tan));
    if (i % 2 === 1) link.rotateZ(Math.PI / 2);
    const torus = add(link, new THREE.TorusGeometry(0.034, 0.0105, 8, 14), p.darkMetal);
    torus.scale.set(0.78, 1.25, 1);
    add(link, new THREE.BoxGeometry(0.05, 0.012, 0.012), p.brass); // stud (traversino da nave!)
    anc.add(link);
  }

  return { group: g, anim: {} };
}

// 20. TELESCOPIO ASTRONOMICO EQUATORIALE (VERSIONE ULTRA-DETTAGLIATA HD+)
function buildTelescope(p: Palette): BuiltModel {
  const g = new THREE.Group();

  // Treppiede da osservatorio in mogano a doppi montanti per gamba + collari in ottone + puntali!
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI * 2 + Math.PI / 6;
    const ca = Math.cos(a), sa = Math.sin(a);
    const tx = -sa * 0.032, tz = ca * 0.032; // offset tangenziale per gambe doppie
    tube(g, [[ca * 0.36 + tx * 0.4, 0.04, sa * 0.36 + tz * 0.4], [ca * 0.06 + tx, 0.7, sa * 0.06 + tz]], 0.016, p.wood, 8, 8);
    tube(g, [[ca * 0.36 - tx * 0.4, 0.04, sa * 0.36 - tz * 0.4], [ca * 0.06 - tx, 0.7, sa * 0.06 - tz]], 0.016, p.wood, 8, 8);
    // Collare di serraggio in ottone a metà gamba + puntale cromato
    add(g, new THREE.BoxGeometry(0.06, 0.035, 0.045), p.brass, ca * 0.21, 0.37, sa * 0.21, 0, -a + Math.PI / 2, 0);
    add(g, new THREE.ConeGeometry(0.022, 0.06, 10), p.chrome, ca * 0.365, 0.03, sa * 0.365, Math.PI);
    // Braccio crociera
    tube(g, [[0, 0.35, 0], [ca * 0.21, 0.35, sa * 0.21]], 0.012, p.darkMetal, 6, 6);
  }

  // Vassoio porta-accessori centrale con 3 OCULARI DI RICAMBIO IN OTTONE!
  add(g, new THREE.CylinderGeometry(0.125, 0.135, 0.026, 20), p.darkMetal, 0, 0.355, 0);
  add(g, new THREE.TorusGeometry(0.128, 0.01, 8, 24), p.brass, 0, 0.368, 0, Math.PI / 2);
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI * 2;
    add(g, new THREE.CylinderGeometry(0.018, 0.02, 0.055, 12), p.brass, Math.cos(a) * 0.075, 0.392, Math.sin(a) * 0.075);
    add(g, new THREE.CylinderGeometry(0.016, 0.016, 0.012, 12), p.lensGlass, Math.cos(a) * 0.075, 0.422, Math.sin(a) * 0.075);
  }

  // Montatura Equatoriale Tedesca (GEM): testa, cerchi graduati AR/Dec, cavi micrometrici e doppio contrappeso!
  add(g, new THREE.CylinderGeometry(0.095, 0.11, 0.1, 22), p.darkMetal, 0, 0.72, 0);
  add(g, new THREE.TorusGeometry(0.098, 0.012, 8, 24), p.brass, 0, 0.74, 0, Math.PI / 2); // cerchio azimutale
  add(g, new THREE.CylinderGeometry(0.068, 0.068, 0.18, 18), p.darkMetal, 0, 0.85, 0, -0.52);
  add(g, new THREE.TorusGeometry(0.072, 0.01, 8, 20), p.chrome, 0, 0.85, 0, -0.52); // cerchio AR
  // Barra contrappeso cromata + 2 pesi in ottone scorrevoli
  add(g, new THREE.CylinderGeometry(0.014, 0.014, 0.38, 10), p.chrome, 0.16, 0.72, 0, 0, 0, 0.72);
  add(g, new THREE.CylinderGeometry(0.068, 0.068, 0.052, 20), p.brass, 0.21, 0.67, 0, 0, 0, 0.72);
  add(g, new THREE.CylinderGeometry(0.068, 0.068, 0.052, 20), p.brass, 0.265, 0.61, 0, 0, 0, 0.72);
  // Cavo flessibile di inseguimento micrometrico con manopola in ottone
  tube(g, [[-0.06, 0.84, 0], [-0.17, 0.78, -0.1], [-0.15, 0.66, -0.22]], 0.008, p.chrome, 12, 6);
  add(g, new THREE.CylinderGeometry(0.022, 0.022, 0.032, 14), p.brass, -0.15, 0.65, -0.23, 0.4);

  // Tubo ottico rifrattore apocromatico inclinato + barra dovetail + doppi anelli con viti di serraggio
  const scope = new THREE.Group();
  scope.position.set(0, 0.99, 0);
  scope.rotation.x = -0.52;
  g.add(scope);

  add(scope, new THREE.BoxGeometry(0.075, 0.028, 0.42), p.brass, 0, -0.115, 0); // barra dovetail
  add(scope, new THREE.CylinderGeometry(0.118, 0.096, 0.88, 32), p.paint, 0, 0, 0, Math.PI / 2);
  // Paraluce frontale in ottone/accento con anello cromato e interno nero opaco
  add(scope, new THREE.CylinderGeometry(0.136, 0.124, 0.24, 32), p.brass, 0, 0, 0.49, Math.PI / 2);
  add(scope, new THREE.TorusGeometry(0.136, 0.011, 8, 32), p.chrome, 0, 0, 0.61);
  // Doppi anelli di fissaggio con manopole superiori
  for (const rz of [-0.15, 0.15]) {
    add(scope, new THREE.TorusGeometry(0.114, 0.018, 10, 28), p.darkMetal, 0, 0, rz);
    add(scope, new THREE.CylinderGeometry(0.016, 0.016, 0.032, 10), p.brass, 0, 0.132, rz);
  }
  // Lente obiettiva doppietto con trattamento antiriflesso iridescente
  add(scope, new THREE.SphereGeometry(0.122, 26, 16, 0, Math.PI * 2, 0, Math.PI * 0.4), p.lensGlass, 0, 0, 0.52, Math.PI / 2);

  // Focheggiatore a cremagliera in ottone con doppie manopole zigrinate + diagonale 90° + oculare con conchiglia gomma
  add(scope, new THREE.CylinderGeometry(0.056, 0.078, 0.17, 22), p.chrome, 0, 0, -0.5, Math.PI / 2);
  add(scope, new THREE.CylinderGeometry(0.012, 0.012, 0.18, 10), p.darkMetal, 0, -0.04, -0.5, 0, 0, Math.PI / 2);
  for (const s of [-1, 1]) {
    add(scope, new THREE.CylinderGeometry(0.038, 0.038, 0.026, 18), p.brass, s * 0.095, -0.04, -0.5, 0, 0, Math.PI / 2);
    add(scope, new THREE.CylinderGeometry(0.022, 0.022, 0.038, 14), p.chrome, s * 0.115, -0.04, -0.5, 0, 0, Math.PI / 2);
  }
  // Prisma diagonale 90° + oculare Plössl con ghiera verde/accento
  add(scope, new THREE.BoxGeometry(0.068, 0.082, 0.082), p.darkMetal, 0, 0.01, -0.61);
  add(scope, new THREE.CylinderGeometry(0.034, 0.038, 0.115, 18), p.brass, 0, 0.095, -0.615);
  add(scope, new THREE.TorusGeometry(0.036, 0.008, 8, 18), p.accent, 0, 0.12, -0.615, Math.PI / 2);
  add(scope, new THREE.TorusGeometry(0.035, 0.011, 8, 18), p.rubber, 0, 0.155, -0.615, Math.PI / 2);
  add(scope, new THREE.CircleGeometry(0.026, 16), p.lensGlass, 0, 0.158, -0.615, -Math.PI / 2);

  // Cercatore ottico parallelo montato su doppio anello a 3 viti di collimazione!
  add(scope, new THREE.CylinderGeometry(0.036, 0.028, 0.36, 18), p.chrome, 0.105, 0.155, -0.07, Math.PI / 2);
  add(scope, new THREE.SphereGeometry(0.032, 14, 10), p.lensGlass, 0.105, 0.155, 0.105);
  for (const fz of [-0.15, 0.01]) {
    add(scope, new THREE.TorusGeometry(0.042, 0.008, 8, 18), p.darkMetal, 0.105, 0.155, fz);
    add(scope, new THREE.BoxGeometry(0.02, 0.085, 0.036), p.darkMetal, 0.065, 0.115, fz, 0, 0, -0.55);
    add(scope, new THREE.CylinderGeometry(0.007, 0.007, 0.03, 6), p.brass, 0.145, 0.175, fz, 0, 0, -1.0);
  }

  return { group: g, anim: {} };
}

const BUILDERS: Record<string, (p: Palette, primaryHex: string, accentHex: string) => BuiltModel> = {
  f1: buildF1,
  vespa: buildVespa,
  vintage_car: buildVintageCar,
  yacht: buildYacht,
  biplane: buildBiplane,
  camera: buildCamera,
  moka: buildMoka,
  lighthouse: buildLighthouse,
  globe: buildGlobe,
  rocket: buildRocket,
  chess_knight: buildChessKnight,
  pocket_watch: buildPocketWatch,
  crown: buildCrown,
  diamond: buildDiamond,
  skyscraper: buildSkyscraper,
  guitar: buildGuitar,
  gramophone: buildGramophone,
  arcade: buildArcade,
  anchor: buildAnchor,
  telescope: buildTelescope,
  ...FIGURINE_BUILDERS,
};

// Le pedine che si sanno costruire (servono ai test per controllare il catalogo).
export const TOKEN_IDS = Object.keys(BUILDERS);

export function buildTokenModel(id: string, palette: Palette, primaryHex = '#d93829', accentHex = '#f4b400'): BuiltModel {
  const fn = BUILDERS[id] ?? buildF1;
  return fn(palette, primaryHex, accentHex);
}

export function countModelStats(obj: THREE.Object3D): { meshes: number; triangles: number } {
  let meshes = 0;
  let triangles = 0;
  obj.traverse((o) => {
    const m = o as THREE.Mesh;
    if (!m.isMesh) return;
    meshes++;
    const idx = m.geometry.index;
    const pos = m.geometry.attributes.position;
    triangles += idx ? idx.count / 3 : pos ? pos.count / 3 : 0;
  });
  return { meshes, triangles: Math.round(triangles) };
}

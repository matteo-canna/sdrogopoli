// Città in miniatura al centro del tabellone (alberi, lago, palazzi, lampioni) e ciclo giorno/notte.
import * as THREE from 'three';

// ---------- materiali condivisi, che di notte accendono le finestre ----------

// Facciata con finestre: pareti chiare, finestre scure; la seconda tela ha solo le finestre (per la luce notturna).
function facadeTextures(cols: number, rows: number, door: boolean): { map: THREE.CanvasTexture; glow: THREE.CanvasTexture } {
  const make = (draw: (ctx: CanvasRenderingContext2D) => void) => {
    const c = document.createElement('canvas');
    c.width = 64;
    c.height = 64;
    draw(c.getContext('2d')!);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  };
  const cell = (ctx: CanvasRenderingContext2D, fill: string, wall: string | null) => {
    if (wall) {
      ctx.fillStyle = wall;
      ctx.fillRect(0, 0, 64, 64);
    } else {
      ctx.fillStyle = '#000';
      ctx.fillRect(0, 0, 64, 64);
    }
    ctx.fillStyle = fill;
    const w = 64 / cols;
    const h = 64 / rows;
    for (let r = 0; r < rows; r++) {
      for (let k = 0; k < cols; k++) {
        if (door && r === rows - 1 && k === Math.floor(cols / 2)) continue;
        ctx.fillRect(k * w + w * 0.25, r * h + h * 0.22, w * 0.5, h * 0.5);
      }
    }
    if (door) {
      ctx.fillStyle = wall ? '#6b4a2f' : '#000';
      ctx.fillRect(Math.floor(cols / 2) * w + w * 0.2, 64 - h * 0.85, w * 0.6, h * 0.85);
    }
  };
  return { map: make((ctx) => cell(ctx, '#46536a', '#ffffff')), glow: make((ctx) => cell(ctx, '#ffffff', null)) };
}

const WARM = new THREE.Color(0xffc861);
const nightMaterials: THREE.MeshStandardMaterial[] = [];

function litMaterial(color: number, cols: number, rows: number, door: boolean): THREE.MeshStandardMaterial {
  const { map, glow } = facadeTextures(cols, rows, door);
  const m = new THREE.MeshStandardMaterial({ color, map, emissiveMap: glow, emissive: WARM, emissiveIntensity: 0, roughness: 0.8 });
  nightMaterials.push(m);
  return m;
}

// Materiali di case e palazzi sulle caselle (verdi e rossi come da tradizione, con finestre).
export const HOUSE_WALL = litMaterial(0x3aa66a, 2, 2, true);
export const HOUSE_ROOF = new THREE.MeshStandardMaterial({ color: 0x1e6b3d, roughness: 0.7 });
export const HOTEL_WALL = litMaterial(0xd2463a, 4, 4, true);
export const HOTEL_ROOF = new THREE.MeshStandardMaterial({ color: 0x8e2a22, roughness: 0.7 });

// Casa con finestre, porta e comignolo.
export function makeHouse(): THREE.Group {
  const g = new THREE.Group();
  const walls = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.12, 0.14), HOUSE_WALL);
  walls.position.y = 0.06;
  const roof = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.1, 4), HOUSE_ROOF);
  roof.position.y = 0.17;
  roof.rotation.y = Math.PI / 4;
  const chimney = new THREE.Mesh(new THREE.BoxGeometry(0.025, 0.06, 0.025), HOUSE_ROOF);
  chimney.position.set(0.035, 0.19, -0.02);
  for (const m of [walls, roof, chimney]) {
    m.castShadow = true;
    g.add(m);
  }
  return g;
}

// Palazzo: un edificio alto a gradoni.
export function makeHotel(): THREE.Group {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.3, 0.22), HOTEL_WALL);
  body.position.y = 0.15;
  const top = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.12, 0.16), HOTEL_WALL);
  top.position.y = 0.36;
  const roof = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.02, 0.18), HOTEL_ROOF);
  roof.position.y = 0.43;
  for (const m of [body, top, roof]) {
    m.castShadow = true;
    g.add(m);
  }
  return g;
}

// ---------- la città al centro ----------

// Generatore pseudo-casuale fisso: la città è sempre uguale.
function rand(seed: number): () => number {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Il nome della città è scritto in diagonale: lì non si mette niente.
function onTitle(x: number, z: number): boolean {
  return Math.abs(x + z) / Math.SQRT2 < 0.95 && Math.abs(x - z) / Math.SQRT2 < 3.9;
}

export const LAKE = { x: 2.3, z: 2.3, r: 1.25 };
export const PARK = { x: -2.35, z: -2.35 };

function inLake(x: number, z: number, margin = 0.25): boolean {
  return Math.hypot(x - LAKE.x, z - LAKE.z) < LAKE.r + margin;
}

export class City {
  readonly group = new THREE.Group();
  private trees: THREE.InstancedMesh[] = [];
  private treeCount = 0;
  private lamps: THREE.Object3D[] = [];
  private lampMat = new THREE.MeshStandardMaterial({ color: 0xfff3c4, emissive: 0xffd27a, emissiveIntensity: 0 });
  private water: THREE.MeshStandardMaterial;
  private boats: THREE.Object3D[] = [];
  private time = 0;

  constructor() {
    const rnd = rand(2026);
    this.buildTrees(rnd);
    this.buildBuildings(rnd);
    this.buildLamps();
    this.buildFountain();
    this.water = new THREE.MeshStandardMaterial({ color: 0x4f9fd6, roughness: 0.15, metalness: 0.2, transparent: true, opacity: 0.85 });
    const lake = new THREE.Mesh(new THREE.CircleGeometry(LAKE.r, 48), this.water);
    lake.rotation.x = -Math.PI / 2;
    lake.position.set(LAKE.x, -0.02, LAKE.z);
    lake.receiveShadow = true;
    this.group.add(lake);
    for (let i = 0; i < 2; i++) this.boats.push(this.makeBoat(i ? 0xf4b400 : 0xe4572e));
  }

  private buildTrees(rnd: () => number): void {
    const spots: THREE.Vector3[] = [];
    // boschetto nel parco, intorno alla fontana
    for (let i = 0; i < 16; i++) {
      const a = (i / 16) * Math.PI * 2 + rnd() * 0.3;
      const r = 0.75 + rnd() * 0.9;
      spots.push(new THREE.Vector3(PARK.x + Math.cos(a) * r, 0, PARK.z + Math.sin(a) * r));
    }
    // alberi sparsi e lungo la riva del lago
    for (let i = 0; i < 70 && spots.length < 42; i++) {
      const x = (rnd() - 0.5) * 7.8;
      const z = (rnd() - 0.5) * 7.8;
      if (onTitle(x, z) || inLake(x, z) || Math.hypot(x - PARK.x, z - PARK.z) < 0.45) continue;
      if (spots.some((s) => Math.hypot(s.x - x, s.z - z) < 0.42)) continue;
      // lontano dagli angoli con i palazzi
      if (Math.abs(x - 3.2) < 1.2 && Math.abs(z + 3.2) < 1.2) continue;
      if (Math.abs(x + 3.2) < 1.2 && Math.abs(z - 3.2) < 1.2) continue;
      spots.push(new THREE.Vector3(x, 0, z));
    }
    // mescolati: con la qualità bassa si disegnano solo i primi, che così restano sparsi su tutto il parco
    for (let i = spots.length - 1; i > 0; i--) {
      const j = Math.floor(rnd() * (i + 1));
      [spots[i], spots[j]] = [spots[j], spots[i]];
    }
    const trunkGeo = new THREE.CylinderGeometry(0.03, 0.04, 0.16, 6);
    const crownGeo = new THREE.IcosahedronGeometry(0.17, 0);
    const trunks = new THREE.InstancedMesh(trunkGeo, new THREE.MeshStandardMaterial({ color: 0x7a5533 }), spots.length);
    const crowns = new THREE.InstancedMesh(crownGeo, new THREE.MeshStandardMaterial({ color: 0xffffff, flatShading: true, roughness: 0.9 }), spots.length);
    const m = new THREE.Matrix4();
    const greens = [0x3f8f4f, 0x4fa35c, 0x2f7a43, 0x6aab4a];
    spots.forEach((s, i) => {
      const k = 0.8 + rnd() * 0.5;
      m.compose(new THREE.Vector3(s.x, 0.08 * k, s.z), new THREE.Quaternion(), new THREE.Vector3(k, k, k));
      trunks.setMatrixAt(i, m);
      m.compose(new THREE.Vector3(s.x, 0.25 * k, s.z), new THREE.Quaternion().setFromEuler(new THREE.Euler(0, rnd() * 3, 0)), new THREE.Vector3(k, k * 1.15, k));
      crowns.setMatrixAt(i, m);
      crowns.setColorAt(i, new THREE.Color(greens[Math.floor(rnd() * greens.length)]));
    });
    for (const im of [trunks, crowns]) {
      im.castShadow = true;
      this.group.add(im);
    }
    this.trees = [trunks, crowns];
    this.treeCount = spots.length;
  }

  // Due quartieri di palazzine colorate negli angoli liberi.
  private buildBuildings(rnd: () => number): void {
    const colors = [0xf1e3c8, 0xe8c9a0, 0xd9a68a, 0xc9d8e8, 0xf0d0d0, 0xdfe7c8];
    const mats = colors.map((c) => litMaterial(c, 3, 4, false));
    const roofMat = new THREE.MeshStandardMaterial({ color: 0x8a8f96, roughness: 0.8 });
    for (const [cx, cz] of [
      [3.15, -3.15],
      [-3.15, 3.15],
    ]) {
      const blocks = [
        [-0.45, -0.45],
        [0.45, -0.45],
        [-0.45, 0.45],
        [0.45, 0.45],
        [0, 0],
      ];
      for (const [dx, dz] of blocks) {
        const h = 0.35 + rnd() * 0.75;
        const w = 0.32 + rnd() * 0.12;
        const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, w), mats[Math.floor(rnd() * mats.length)]);
        mesh.position.set(cx + dx, h / 2 - 0.04, cz + dz);
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        const roof = new THREE.Mesh(new THREE.BoxGeometry(w + 0.04, 0.03, w + 0.04), roofMat);
        roof.position.set(cx + dx, h - 0.03, cz + dz);
        this.group.add(mesh, roof);
      }
    }
  }

  // Lampioni lungo il viale interno: di notte si accendono.
  private buildLamps(): void {
    const spots: THREE.Vector2[] = [];
    for (let t = -3; t <= 3; t += 1.5) {
      spots.push(new THREE.Vector2(t, -4.05), new THREE.Vector2(t, 4.05), new THREE.Vector2(-4.05, t), new THREE.Vector2(4.05, t));
    }
    const poles = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.015, 0.02, 0.32, 6), new THREE.MeshStandardMaterial({ color: 0x3d4248 }), spots.length);
    const bulbs = new THREE.InstancedMesh(new THREE.SphereGeometry(0.045, 10, 8), this.lampMat, spots.length);
    const m = new THREE.Matrix4();
    spots.forEach((s, i) => {
      m.makeTranslation(s.x, 0.12, s.y);
      poles.setMatrixAt(i, m);
      m.makeTranslation(s.x, 0.3, s.y);
      bulbs.setMatrixAt(i, m);
    });
    poles.castShadow = true;
    this.group.add(poles, bulbs);
    this.lamps = [poles, bulbs];
  }

  private buildFountain(): void {
    const stone = new THREE.MeshStandardMaterial({ color: 0xcfc8b8, roughness: 0.9 });
    const basin = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.36, 0.08, 24), stone);
    basin.position.set(PARK.x, 0, PARK.z);
    const water = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.28, 0.02, 24), new THREE.MeshStandardMaterial({ color: 0x6fb7e6, roughness: 0.1 }));
    water.position.set(PARK.x, 0.04, PARK.z);
    const column = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.06, 0.22, 10), stone);
    column.position.set(PARK.x, 0.13, PARK.z);
    const bowl = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.06, 0.05, 16), stone);
    bowl.position.set(PARK.x, 0.25, PARK.z);
    for (const m of [basin, column, bowl]) m.castShadow = true;
    this.group.add(basin, water, column, bowl);
  }

  private makeBoat(color: number): THREE.Object3D {
    const g = new THREE.Group();
    const hull = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.05, 0.09), new THREE.MeshStandardMaterial({ color }));
    hull.position.y = 0.01;
    const sail = new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.18, 3), new THREE.MeshStandardMaterial({ color: 0xffffff }));
    sail.position.set(0.01, 0.12, 0);
    for (const m of [hull, sail]) m.castShadow = true;
    g.add(hull, sail);
    this.group.add(g);
    return g;
  }

  // Quanta città si vede: con la qualità bassa meno alberi, niente lampioni né barchette.
  setDetail(d: { trees: number; lamps: boolean; boats: boolean }): void {
    for (const im of this.trees) im.count = Math.max(1, Math.round(this.treeCount * d.trees));
    for (const l of this.lamps) l.visible = d.lamps;
    for (const b of this.boats) b.visible = d.boats;
  }

  // n = 0 giorno pieno, 1 notte fonda.
  setNight(n: number): void {
    const glow = THREE.MathUtils.smoothstep(n, 0.35, 0.9);
    for (const m of nightMaterials) m.emissiveIntensity = glow * 1.2;
    this.lampMat.emissiveIntensity = glow * 2.2;
    this.water.color.setHex(0x4f9fd6).lerp(new THREE.Color(0x1d3557), n);
  }

  // Le barchette girano piano sul lago.
  update(dt: number, still: boolean): void {
    if (still) return;
    this.time += dt;
    this.boats.forEach((b, i) => {
      const a = this.time * (0.12 + i * 0.05) + i * Math.PI;
      const r = LAKE.r * (0.55 - i * 0.2);
      b.position.set(LAKE.x + Math.cos(a) * r, 0, LAKE.z + Math.sin(a) * r);
      b.rotation.y = -a + (i ? 0 : Math.PI);
      b.position.y = Math.sin(this.time * 2 + i) * 0.008;
    });
  }
}

// ---------- cielo: giorno, tramonto, notte, alba ----------

export type SkyMode = 'cycle' | 'day' | 'night';

interface SkyKey {
  bg: number;
  hemiSky: number;
  hemiGround: number;
  hemi: number;
  sun: number;
  sunColor: number;
  night: number;
}

// Una tappa per giro: giorno, tramonto, notte, alba, poi di nuovo giorno.
const SKY: SkyKey[] = [
  { bg: 0xcfe5f2, hemiSky: 0xffffff, hemiGround: 0x8a9a8a, hemi: 1.6, sun: 2.2, sunColor: 0xffffff, night: 0 },
  { bg: 0xf2b98f, hemiSky: 0xffd9b8, hemiGround: 0x8a7a6a, hemi: 1.25, sun: 1.7, sunColor: 0xffa566, night: 0.35 },
  { bg: 0x141c33, hemiSky: 0x8d9cd4, hemiGround: 0x2a2f3a, hemi: 0.8, sun: 0.6, sunColor: 0x9fb4ff, night: 1 },
  { bg: 0xf3d3c8, hemiSky: 0xffe2d6, hemiGround: 0x8a8a8a, hemi: 1.2, sun: 1.5, sunColor: 0xffc4a0, night: 0.3 },
];
export const SKY_STEPS = SKY.length;

export function skyAt(phase: number): SkyKey & { sunAngle: number } {
  const p = ((phase % SKY.length) + SKY.length) % SKY.length;
  const i = Math.floor(p);
  const f = THREE.MathUtils.smoothstep(p - i, 0, 1);
  const a = SKY[i];
  const b = SKY[(i + 1) % SKY.length];
  const mix = (x: number, y: number) => new THREE.Color(x).lerp(new THREE.Color(y), f).getHex();
  return {
    bg: mix(a.bg, b.bg),
    hemiSky: mix(a.hemiSky, b.hemiSky),
    hemiGround: mix(a.hemiGround, b.hemiGround),
    hemi: a.hemi + (b.hemi - a.hemi) * f,
    sun: a.sun + (b.sun - a.sun) * f,
    sunColor: mix(a.sunColor, b.sunColor),
    night: a.night + (b.night - a.night) * f,
    // il sole (o la luna) gira intorno al tabellone
    sunAngle: (p / SKY.length) * Math.PI * 2,
  };
}

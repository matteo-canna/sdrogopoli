// Diorama urbano realistico HD+ (v2) per Sdrogopoli:
// edifici monumentali molto più grandi e dettagliati (case con abbaini/balconi/portici/tegole 3D,
// Grand Hotel a 3 livelli con colonnato e insegna luminosa, Campanile 2.55u con orologio HD,
// palazzi storici, torre Art Déco, borgo con botteghe e panni stesi, darsena, faro e scritta fluttuante "Gioco FOLLE!").
import * as THREE from 'three';
import {
  cardDeckTexture,
  clockTowerTex,
  floatingSignTextures,
  hotelSignTex,
  realisticFacadeTextures,
  roofTileTextures,
} from './boardTextures';

// ---------- Materiali condivisi che si illuminano automaticamente di notte ----------
const nightMaterials: THREE.MeshStandardMaterial[] = [];

function makeLitFacade(
  wallHex: string,
  shutterHex: string,
  cols: number,
  rows: number,
  door: boolean,
  seed: number,
  groundStyle: 'stone' | 'shop' | 'arcade' = 'stone',
): THREE.MeshStandardMaterial {
  const { map, glow, bump } = realisticFacadeTextures(wallHex, shutterHex, cols, rows, door, seed, groundStyle);
  const m = new THREE.MeshStandardMaterial({
    map,
    bumpMap: bump,
    bumpScale: 0.015,
    emissiveMap: glow,
    emissive: new THREE.Color(0xffd27a),
    emissiveIntensity: 0,
    roughness: 0.78,
    metalness: 0.04,
  });
  nightMaterials.push(m);
  return m;
}

// Materiali tetti con texture & bump map realistiche (coppi in terracotta, ardesia, rame)
let roofTerracottaMat: THREE.MeshStandardMaterial | null = null;
let roofTerracottaDarkMat: THREE.MeshStandardMaterial | null = null;
let roofSlateMat: THREE.MeshStandardMaterial | null = null;
let roofCopperMat: THREE.MeshStandardMaterial | null = null;
let porchLanternMat: THREE.MeshStandardMaterial | null = null;
let hotelSignMat: THREE.MeshStandardMaterial | null = null;

function getRoofMats() {
  if (!roofTerracottaMat) {
    const tc = roofTileTextures('terracotta');
    const sl = roofTileTextures('slate');
    const cp = roofTileTextures('copper');
    roofTerracottaMat = new THREE.MeshStandardMaterial({ map: tc.map, bumpMap: tc.bump, bumpScale: 0.025, roughness: 0.74 });
    roofTerracottaDarkMat = new THREE.MeshStandardMaterial({ color: 0xdca898, map: tc.map, bumpMap: tc.bump, bumpScale: 0.025, roughness: 0.76 });
    roofSlateMat = new THREE.MeshStandardMaterial({ map: sl.map, bumpMap: sl.bump, bumpScale: 0.02, roughness: 0.58, metalness: 0.18 });
    roofCopperMat = new THREE.MeshStandardMaterial({ map: cp.map, bumpMap: cp.bump, bumpScale: 0.016, roughness: 0.42, metalness: 0.52 });
  }
  return {
    terracotta: roofTerracottaMat!,
    terracottaDark: roofTerracottaDarkMat!,
    slate: roofSlateMat!,
    copper: roofCopperMat!,
  };
}

function getPorchLanternMat(): THREE.MeshStandardMaterial {
  if (!porchLanternMat) {
    porchLanternMat = new THREE.MeshStandardMaterial({
      color: 0xfff6d6,
      emissive: 0xffc857,
      emissiveIntensity: 0.25,
      roughness: 0.2,
    });
    nightMaterials.push(porchLanternMat);
  }
  return porchLanternMat;
}

function getHotelSignMat(): THREE.MeshStandardMaterial {
  if (!hotelSignMat) {
    const tex = hotelSignTex();
    hotelSignMat = new THREE.MeshStandardMaterial({
      map: tex,
      emissiveMap: tex,
      emissive: new THREE.Color(0xffe082),
      emissiveIntensity: 0.35,
      roughness: 0.3,
    });
    nightMaterials.push(hotelSignMat);
  }
  return hotelSignMat;
}

const HOUSE_PALETTES = [
  { wall: '#f3e6cf', shutter: '#2a6445', roof: 'terracotta' as const },
  { wall: '#ecd1a2', shutter: '#543b28', roof: 'terracottaDark' as const },
  { wall: '#e8cbc2', shutter: '#324861', roof: 'slate' as const },
  { wall: '#dce4d2', shutter: '#5c4632', roof: 'terracotta' as const },
];

let houseWallMats: THREE.MeshStandardMaterial[] | null = null;
let hotelBaseMat: THREE.MeshStandardMaterial | null = null;
let hotelMidMat: THREE.MeshStandardMaterial | null = null;
let hotelTopMat: THREE.MeshStandardMaterial | null = null;

function getHouseWallMats(): THREE.MeshStandardMaterial[] {
  if (!houseWallMats) {
    houseWallMats = HOUSE_PALETTES.map((p, i) => makeLitFacade(p.wall, p.shutter, 2, 2, true, i + 1, 'stone'));
  }
  return houseWallMats;
}

function getHotelMats() {
  if (!hotelBaseMat) {
    hotelBaseMat = makeLitFacade('#e9e0ce', '#26384a', 5, 2, true, 11, 'arcade');
    hotelMidMat = makeLitFacade('#f2ead9', '#26384a', 5, 2, false, 17, 'stone');
    hotelTopMat = makeLitFacade('#f7f1e3', '#26384a', 4, 2, false, 23, 'stone');
  }
  return { base: hotelBaseMat!, mid: hotelMidMat!, top: hotelTopMat! };
}

const STONE_PLINTH = new THREE.MeshStandardMaterial({ color: 0xc9c1b2, roughness: 0.84 });
const STONE_LIGHT = new THREE.MeshStandardMaterial({ color: 0xe6dfd0, roughness: 0.78 });
const DARK_IRON = new THREE.MeshStandardMaterial({ color: 0x242a32, roughness: 0.42, metalness: 0.78 });
const BRASS_TRIM = new THREE.MeshStandardMaterial({ color: 0xd9a74a, roughness: 0.24, metalness: 0.92 });
const HEDGE_MAT = new THREE.MeshStandardMaterial({ color: 0x357439, roughness: 0.9 });
const BRICK_MAT = new THREE.MeshStandardMaterial({ color: 0x9c4632, roughness: 0.85 });
const WOOD_MAT = new THREE.MeshStandardMaterial({ color: 0x764724, roughness: 0.76 });
const GLASS_DARK = new THREE.MeshPhysicalMaterial({ color: 0x1e2e40, roughness: 0.1, metalness: 0.25, clearcoat: 0.9 });

function makeGableRoof(w: number, h: number, d: number, mat: THREE.Material): THREE.Mesh {
  const sh = new THREE.Shape();
  sh.moveTo(-w / 2, 0);
  sh.lineTo(w / 2, 0);
  sh.lineTo(0, h);
  sh.closePath();
  const geo = new THREE.ExtrudeGeometry(sh, { depth: d, bevelEnabled: false });
  geo.translate(0, 0, -d / 2);
  const m = new THREE.Mesh(geo, mat);
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
}

// Balcone 3D realistico in pietra con ringhiera in ferro battuto e fioriera opzionale
function makeBalcony(w: number, depth: number, withFlowers = true): THREE.Group {
  const g = new THREE.Group();
  const slab = new THREE.Mesh(new THREE.BoxGeometry(w, 0.018, depth), STONE_LIGHT);
  slab.castShadow = slab.receiveShadow = true;
  g.add(slab);
  // Mensole in pietra sotto la soletta
  for (const sx of [-w * 0.34, w * 0.34]) {
    const corbel = new THREE.Mesh(new THREE.BoxGeometry(0.018, 0.022, depth * 0.7), STONE_PLINTH);
    corbel.position.set(sx, -0.016, -depth * 0.12);
    g.add(corbel);
  }
  // Corrimano e montanti in ferro battuto
  const railH = 0.048;
  const topFront = new THREE.Mesh(new THREE.BoxGeometry(w, 0.008, 0.008), DARK_IRON);
  topFront.position.set(0, railH, depth / 2 - 0.005);
  const topL = new THREE.Mesh(new THREE.BoxGeometry(0.008, 0.008, depth), DARK_IRON);
  topL.position.set(-w / 2 + 0.005, railH, 0);
  const topR = new THREE.Mesh(new THREE.BoxGeometry(0.008, 0.008, depth), DARK_IRON);
  topR.position.set(w / 2 - 0.005, railH, 0);
  g.add(topFront, topL, topR);

  const bars = Math.max(4, Math.round(w / 0.032));
  for (let i = 0; i <= bars; i++) {
    const bx = -w / 2 + 0.006 + (i / bars) * (w - 0.012);
    const bar = new THREE.Mesh(new THREE.BoxGeometry(0.005, railH, 0.005), DARK_IRON);
    bar.position.set(bx, railH / 2, depth / 2 - 0.005);
    g.add(bar);
  }
  if (withFlowers) {
    const pot = new THREE.Mesh(new THREE.BoxGeometry(w * 0.62, 0.018, 0.02), BRICK_MAT);
    pot.position.set(0, 0.018, depth / 2 - 0.012);
    const bush = new THREE.Mesh(new THREE.BoxGeometry(w * 0.58, 0.02, 0.024), HEDGE_MAT);
    bush.position.set(0, 0.032, depth / 2 - 0.012);
    g.add(pot, bush);
    const flCols = [0xe11d48, 0xf59e0b, 0xf472b6];
    for (let k = -1; k <= 1; k++) {
      const fl = new THREE.Mesh(new THREE.SphereGeometry(0.008, 6, 6), new THREE.MeshStandardMaterial({ color: flCols[(k + 1) % 3], roughness: 0.7 }));
      fl.position.set(k * w * 0.16, 0.044, depth / 2 - 0.008);
      g.add(fl);
    }
  }
  return g;
}

// Abbaino 3D (dormer window) da innestare sui tetti a falde / mansarde
function makeDormer(roofMat: THREE.Material): THREE.Group {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.078, 0.072, 0.09), STONE_LIGHT);
  body.castShadow = true;
  const win = new THREE.Mesh(new THREE.BoxGeometry(0.046, 0.048, 0.014), getPorchLanternMat());
  win.position.set(0, 0.004, 0.042);
  const roof = makeGableRoof(0.098, 0.044, 0.105, roofMat);
  roof.position.set(0, 0.036, 0);
  g.add(body, win, roof);
  return g;
}

// Comignolo realistico in mattoni con cappello e doppi fumaioli in terracotta
function makeChimney(height: number, scale = 1): THREE.Group {
  const g = new THREE.Group();
  const shaft = new THREE.Mesh(new THREE.BoxGeometry(0.042 * scale, height, 0.042 * scale), BRICK_MAT);
  shaft.position.y = height / 2;
  const cap = new THREE.Mesh(new THREE.BoxGeometry(0.056 * scale, 0.014 * scale, 0.056 * scale), STONE_PLINTH);
  cap.position.y = height + 0.006 * scale;
  shaft.castShadow = cap.castShadow = true;
  g.add(shaft, cap);
  for (const sx of [-0.011 * scale, 0.011 * scale]) {
    const pot = new THREE.Mesh(new THREE.CylinderGeometry(0.007 * scale, 0.009 * scale, 0.022 * scale, 8), BRICK_MAT);
    pot.position.set(sx, height + 0.02 * scale, 0);
    g.add(pot);
  }
  return g;
}

// ---------- CASE REALISTICHE HD+ (proporzionate per 4 case nitide senza sovrapposizioni sui tetti né sulle pedine!) ----------
export function makeHouse(variant = 0, ownerColor?: string): THREE.Group {
  const g = new THREE.Group();
  const idx = Math.abs(variant) % HOUSE_PALETTES.length;
  const pal = HOUSE_PALETTES[idx];
  const wallMat = getHouseWallMats()[idx];
  const roofs = getRoofMats();
  const roofMat = roofs[pal.roof];

  // Zoccolo in pietra + gradino d'ingresso (ingombro X <= 0.206, Z in [-0.102 .. +0.122])
  const plinth = new THREE.Mesh(new THREE.BoxGeometry(0.19, 0.032, 0.175), STONE_PLINTH);
  plinth.position.y = 0.016;
  const step = new THREE.Mesh(new THREE.BoxGeometry(0.068, 0.016, 0.034), STONE_LIGHT);
  step.position.set(0, 0.008, 0.1);

  // Corpo principale slanciato a 2 piani
  const walls = new THREE.Mesh(new THREE.BoxGeometry(0.176, 0.215, 0.162), wallMat);
  walls.position.y = 0.138;
  const cornice = new THREE.Mesh(new THREE.BoxGeometry(0.192, 0.016, 0.178), STONE_LIGHT);
  cornice.position.y = 0.25;

  // Tetto realistico con tegole 3D (larghezza 0.204 < 0.22 passo tra 4 case -> ZERO sovrapposizione!)
  let roof: THREE.Mesh;
  if (idx % 2 === 0) {
    roof = makeGableRoof(0.204, 0.105, 0.196, roofMat);
    roof.position.y = 0.258;
    const ridge = new THREE.Mesh(new THREE.CylinderGeometry(0.011, 0.011, 0.202, 8), BRICK_MAT);
    ridge.rotation.x = Math.PI / 2;
    ridge.position.y = 0.363;
    g.add(ridge);
    // Abbaino orientato CORRETTAMENTE verso l'esterno (falda sinistra x < 0 -> rotation.y = -PI/2!)
    const dorm = makeDormer(roofMat);
    dorm.scale.setScalar(0.68);
    dorm.position.set(-0.044, 0.296, 0.022);
    dorm.rotation.y = -Math.PI / 2;
    g.add(dorm);
  } else {
    roof = new THREE.Mesh(new THREE.ConeGeometry(0.144, 0.112, 4), roofMat);
    roof.position.y = 0.314;
    roof.rotation.y = Math.PI / 4;
    const finial = new THREE.Mesh(new THREE.SphereGeometry(0.015, 8, 8), BRASS_TRIM);
    finial.position.y = 0.372;
    g.add(finial);
  }

  // Comignolo dettagliato con doppi fumaioli
  const chim = makeChimney(0.09, 0.78);
  chim.position.set(0.048, 0.275, -0.038);
  g.add(chim);

  // Portico d'ingresso compatto con 2 colonnine e lanterna calda
  const porchRoof = makeGableRoof(0.08, 0.028, 0.044, roofMat);
  porchRoof.position.set(0, 0.114, 0.098);
  for (const sx of [-0.03, 0.03]) {
    const col = new THREE.Mesh(new THREE.CylinderGeometry(0.0065, 0.0075, 0.088, 8), STONE_LIGHT);
    col.position.set(sx, 0.07, 0.11);
    col.castShadow = true;
    g.add(col);
  }
  const lantern = new THREE.Mesh(new THREE.SphereGeometry(0.01, 8, 8), getPorchLanternMat());
  lantern.position.set(0.022, 0.1, 0.09);
  g.add(lantern);

  // Balconcino in ferro battuto fiorito al piano superiore
  const balc = makeBalcony(0.086, 0.032, true);
  balc.position.set(0, 0.15, 0.092);
  g.add(balc);

  // Siepi ai lati dell'ingresso
  for (const sx of [-0.06, 0.06]) {
    const hedge = new THREE.Mesh(new THREE.BoxGeometry(0.048, 0.03, 0.024), HEDGE_MAT);
    hedge.position.set(sx, 0.022, 0.098);
    hedge.castShadow = true;
    g.add(hedge);
  }

  for (const m of [plinth, step, walls, cornice, roof, porchRoof]) {
    m.castShadow = true;
    m.receiveShadow = true;
    g.add(m);
  }

  if (ownerColor) {
    const crest = new THREE.Mesh(new THREE.BoxGeometry(0.062, 0.015, 0.012), new THREE.MeshStandardMaterial({ color: ownerColor, roughness: 0.35 }));
    crest.position.set(0, 0.114, 0.122);
    g.add(crest);
  }
  return g;
}

// ---------- GRAND HOTEL MONUMENTALE HD+ (3 livelli, colonnato, 4 balconi, 3 abbaini, insegna luminosa — 100% entro la fascia!) ----------
export function makeHotel(ownerColor?: string): THREE.Group {
  const g = new THREE.Group();
  const { base: baseMat, mid: midMat, top: topMat } = getHotelMats();
  const roofs = getRoofMats();
  const awningColor = ownerColor ?? '#b91c1c';
  const awningMat = new THREE.MeshStandardMaterial({ color: awningColor, roughness: 0.42 });

  // Basamento (w=0.70, d=0.25 -> centrato a z=-0.35: retro a -0.475 dentro la casella, fronte gradini a -0.185!)
  const plinth = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.05, 0.25), STONE_PLINTH);
  plinth.position.y = 0.025;
  const stairs = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.026, 0.065), STONE_LIGHT);
  stairs.position.set(0, 0.013, 0.145);

  // 1° livello: Piano terra & mezzanino
  const tier1 = new THREE.Mesh(new THREE.BoxGeometry(0.65, 0.25, 0.22), baseMat);
  tier1.position.y = 0.175;
  const corn1 = new THREE.Mesh(new THREE.BoxGeometry(0.685, 0.026, 0.25), STONE_LIGHT);
  corn1.position.y = 0.308;

  // 2° livello: Piano nobile
  const tier2 = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.23, 0.2), midMat);
  tier2.position.y = 0.435;
  const corn2 = new THREE.Mesh(new THREE.BoxGeometry(0.635, 0.026, 0.23), STONE_LIGHT);
  corn2.position.y = 0.558;

  // 3° livello: Attico suite
  const tier3 = new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.17, 0.175), topMat);
  tier3.position.y = 0.655;
  const corn3 = new THREE.Mesh(new THREE.BoxGeometry(0.555, 0.024, 0.205), STONE_LIGHT);
  corn3.position.y = 0.748;

  // 4 Lesene angolari in pietra chiara
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      const pil = new THREE.Mesh(new THREE.BoxGeometry(0.036, 0.52, 0.036), STONE_LIGHT);
      pil.position.set(sx * 0.315, 0.305, sz * 0.102);
      pil.castShadow = true;
      g.add(pil);
    }
  }

  // Tetto mansardato in rame ossidato con 3 abbaini 3D e coronamento in ottone
  const mansard = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.32, 0.145, 4), roofs.copper);
  mansard.position.y = 0.83;
  mansard.rotation.y = Math.PI / 4;
  mansard.scale.set(1.22, 1, 0.46);
  const roofDeck = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.024, 0.135), BRASS_TRIM);
  roofDeck.position.y = 0.905;

  for (const dx of [-0.14, 0, 0.14]) {
    const dorm = makeDormer(roofs.slate);
    dorm.scale.setScalar(0.75);
    dorm.position.set(dx, 0.8, 0.072);
    g.add(dorm);
  }

  // Insegna luminosa "GRAND HOTEL" sulla sommità
  const signFrame = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.09, 0.028), BRASS_TRIM);
  signFrame.position.set(0, 0.96, 0.035);
  const signFront = new THREE.Mesh(new THREE.PlaneGeometry(0.33, 0.074), getHotelSignMat());
  signFront.position.set(0, 0.96, 0.051);
  const signBack = new THREE.Mesh(new THREE.PlaneGeometry(0.33, 0.074), getHotelSignMat());
  signBack.position.set(0, 0.96, 0.019);
  signBack.rotation.y = Math.PI;
  g.add(signFrame, signFront, signBack);

  // Colonnato d'ingresso Grand Hotel con pensilina, tappeto e 2 lanterne
  const marquee = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.034, 0.078), awningMat);
  marquee.position.set(0, 0.15, 0.138);
  const marqueeTrim = new THREE.Mesh(new THREE.BoxGeometry(0.252, 0.011, 0.084), BRASS_TRIM);
  marqueeTrim.position.set(0, 0.168, 0.138);
  const carpet = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.008, 0.085), awningMat);
  carpet.position.set(0, 0.052, 0.142);
  for (const sx of [-0.1, -0.045, 0.045, 0.1]) {
    const col = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 0.012, 0.105, 10), STONE_LIGHT);
    col.position.set(sx, 0.098, 0.165);
    col.castShadow = true;
    g.add(col);
  }
  for (const sx of [-0.105, 0.105]) {
    const sconce = new THREE.Mesh(new THREE.SphereGeometry(0.014, 8, 8), getPorchLanternMat());
    sconce.position.set(sx, 0.13, 0.118);
    g.add(sconce);
  }

  // 4 balconi 3D in ferro battuto fioriti aderenti alle facciate
  for (const bx of [-0.18, 0.18]) {
    const b1 = makeBalcony(0.14, 0.042, true);
    b1.position.set(bx, 0.34, 0.116);
    const b2 = makeBalcony(0.12, 0.038, false);
    b2.position.set(bx * 0.85, 0.58, 0.102);
    g.add(b1, b2);
  }

  for (const cx of [-0.15, 0.15]) {
    const ch = makeChimney(0.1, 0.85);
    ch.position.set(cx, 0.85, -0.042);
    g.add(ch);
  }
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.007, 0.009, 0.17, 8), BRASS_TRIM);
  pole.position.set(0, 1.075, 0.035);
  const flag = new THREE.Mesh(new THREE.BoxGeometry(0.115, 0.06, 0.008), awningMat);
  flag.position.set(0.06, 1.125, 0.035);

  for (const m of [plinth, stairs, tier1, corn1, tier2, corn2, tier3, corn3, mansard, roofDeck, marquee, marqueeTrim, carpet, pole, flag]) {
    m.castShadow = true;
    m.receiveShadow = true;
    g.add(m);
  }
  return g;
}

// ---------- Generatore deterministico ----------
function rand(seed: number): () => number {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const LAKE = { x: 2.18, z: 2.18, r: 1.28 };
export const PARK = { x: -2.1, z: -2.1 };

interface RoadCar {
  mesh: THREE.Group;
  t: number;
  speed: number;
  lane: number;
}

export class City {
  readonly group = new THREE.Group();
  private lampMat = new THREE.MeshStandardMaterial({ color: 0xfff5d6, emissive: 0xffcc66, emissiveIntensity: 0.15, roughness: 0.2 });
  private haloMat = new THREE.MeshBasicMaterial({ color: 0xffd27a, transparent: true, opacity: 0, depthWrite: false });
  private waterMat: THREE.MeshPhysicalMaterial;
  readonly signGroup = new THREE.Group();
  private signSparks: THREE.Mesh[] = [];
  private signBeamMat: THREE.MeshBasicMaterial;
  private boats: THREE.Object3D[] = [];
  private fountainDrops: { mesh: THREE.Mesh; phase: number; angle: number; radius: number }[] = [];
  private lighthouseBeam: THREE.Group | null = null;
  private towerBeacon: THREE.Mesh | null = null;
  private policeBeacons: { blue: THREE.MeshStandardMaterial; red: THREE.MeshStandardMaterial } | null = null;
  private trafficLights: { red: THREE.MeshStandardMaterial; amber: THREE.MeshStandardMaterial; green: THREE.MeshStandardMaterial } | null = null;
  private cars: RoadCar[] = [];
  private carLightsMat = new THREE.MeshStandardMaterial({ color: 0xfff9db, emissive: 0xffe082, emissiveIntensity: 0.2 });
  private sunMesh: THREE.Mesh;
  private moonMesh: THREE.Mesh;
  private starsMat: THREE.PointsMaterial;
  private time = 0;

  constructor() {
    const rnd = rand(2026);
    this.waterMat = new THREE.MeshPhysicalMaterial({
      color: 0x2f88c2,
      roughness: 0.08,
      metalness: 0.18,
      clearcoat: 1.0,
      clearcoatRoughness: 0.06,
      transparent: true,
      opacity: 0.88,
    });
    this.signBeamMat = new THREE.MeshBasicMaterial({
      color: 0xffe082,
      transparent: true,
      opacity: 0.04,
      side: THREE.DoubleSide,
      depthWrite: false,
    });

    this.buildPark(rnd);
    this.buildLake();
    this.buildHistoricDistrict(rnd);
    this.buildMarketDistrict(rnd);
    this.buildCentralPlazaAndDecks();
    this.buildFloatingSign();
    this.buildStreetLamps();
    this.buildTrafficCars();
    this.buildCornerLandmarks();

    // Sole, Luna e campo stellare
    this.sunMesh = new THREE.Mesh(
      new THREE.SphereGeometry(0.95, 20, 16),
      new THREE.MeshBasicMaterial({ color: 0xfff3b0 }),
    );
    this.moonMesh = new THREE.Mesh(
      new THREE.SphereGeometry(0.68, 20, 16),
      new THREE.MeshBasicMaterial({ color: 0xdbeafe }),
    );
    this.group.add(this.sunMesh, this.moonMesh);

    const starPos: number[] = [];
    for (let i = 0; i < 380; i++) {
      const th = rnd() * Math.PI * 2;
      const ph = Math.acos(0.15 + rnd() * 0.85);
      const R = 36 + rnd() * 8;
      starPos.push(Math.sin(ph) * Math.cos(th) * R, Math.cos(ph) * R, Math.sin(ph) * Math.sin(th) * R);
    }
    const starGeo = new THREE.BufferGeometry();
    starGeo.setAttribute('position', new THREE.Float32BufferAttribute(starPos, 3));
    this.starsMat = new THREE.PointsMaterial({ color: 0xffffff, size: 0.22, transparent: true, opacity: 0, depthWrite: false });
    this.group.add(new THREE.Points(starGeo, this.starsMat));
  }

  // ---------- 1. PARCO MONUMENTALE (NW: x < 0, z < 0) ----------
  private buildPark(rnd: () => number): void {
    const cx = PARK.x, cz = PARK.z;
    const roofs = getRoofMats();

    // Fontana monumentale a 2 vasche ingrandita con 14 getti d'acqua animati!
    const step = new THREE.Mesh(new THREE.CylinderGeometry(0.66, 0.72, 0.045, 36), STONE_PLINTH);
    step.position.set(cx, 0.0, cz);
    const basin = new THREE.Mesh(new THREE.CylinderGeometry(0.56, 0.6, 0.12, 36), STONE_LIGHT);
    basin.position.set(cx, 0.075, cz);
    const rim = new THREE.Mesh(new THREE.TorusGeometry(0.56, 0.038, 10, 36), STONE_LIGHT);
    rim.rotation.x = Math.PI / 2;
    rim.position.set(cx, 0.135, cz);
    const fWater = new THREE.Mesh(new THREE.CylinderGeometry(0.52, 0.52, 0.02, 32), this.waterMat);
    fWater.position.set(cx, 0.12, cz);
    const col = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.12, 0.42, 16), STONE_LIGHT);
    col.position.set(cx, 0.29, cz);
    const bowl1 = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.14, 0.07, 24), STONE_LIGHT);
    bowl1.position.set(cx, 0.34, cz);
    const bowl2 = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.08, 0.055, 20), STONE_LIGHT);
    bowl2.position.set(cx, 0.51, cz);
    const finial = new THREE.Mesh(new THREE.SphereGeometry(0.052, 14, 12), BRASS_TRIM);
    finial.position.set(cx, 0.58, cz);
    for (const m of [step, basin, rim, col, bowl1, bowl2, finial]) { m.castShadow = true; m.receiveShadow = true; }
    this.group.add(step, basin, rim, fWater, col, bowl1, bowl2, finial);

    const dropMat = new THREE.MeshStandardMaterial({ color: 0xcbeeff, roughness: 0.1, transparent: true, opacity: 0.85 });
    for (let i = 0; i < 14; i++) {
      const m = new THREE.Mesh(new THREE.SphereGeometry(0.026, 8, 8), dropMat);
      this.group.add(m);
      this.fountainDrops.push({ mesh: m, phase: i / 14, angle: (i / 14) * Math.PI * 2, radius: 0.3 + (i % 2) * 0.12 });
    }

    // Grande Padiglione Neoclassico del Parco (Belvedere con scalinata, 8 colonne, cupola in rame e lanterna!)
    const pav = new THREE.Group();
    pav.position.set(-1.12, -0.02, -3.02);
    const pBase1 = new THREE.Mesh(new THREE.CylinderGeometry(0.48, 0.53, 0.06, 8), STONE_PLINTH);
    pBase1.position.y = 0.03;
    const pBase2 = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.45, 0.06, 8), STONE_LIGHT);
    pBase2.position.y = 0.09;
    pav.add(pBase1, pBase2);
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      const colP = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.025, 0.46, 10), STONE_LIGHT);
      colP.position.set(Math.cos(a) * 0.36, 0.35, Math.sin(a) * 0.36);
      colP.castShadow = true;
      pav.add(colP);
    }
    const entab = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.4, 0.07, 8), STONE_LIGHT);
    entab.position.y = 0.6;
    const dome = new THREE.Mesh(new THREE.SphereGeometry(0.39, 16, 12, 0, Math.PI * 2, 0, Math.PI / 2), roofs.copper);
    dome.position.y = 0.63;
    const cupola = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.09, 0.11, 8), STONE_LIGHT);
    cupola.position.y = 1.04;
    const cupTop = new THREE.Mesh(new THREE.ConeGeometry(0.11, 0.12, 8), BRASS_TRIM);
    cupTop.position.y = 1.15;
    const innerLight = new THREE.Mesh(new THREE.SphereGeometry(0.065, 10, 8), getPorchLanternMat());
    innerLight.position.y = 0.52;
    for (const m of [pBase1, pBase2, entab, dome, cupola, cupTop]) { m.castShadow = true; m.receiveShadow = true; }
    pav.add(entab, dome, cupola, cupTop, innerLight);
    this.group.add(pav);

    // 3 panchine attorno alla fontana (il lato verso il Padiglione resta libero come vialetto d'accesso!)
    for (const i of [1, 2]) {
      const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
      const bench = this.makeBench();
      bench.position.set(cx + Math.cos(a) * 1.02, 0, cz + Math.sin(a) * 1.02);
      bench.rotation.y = -a + Math.PI / 2;
      this.group.add(bench);
    }

    // Alberi monumentali nel parco (più alti per bilanciare il nuovo skyline!)
    const treeSpots: [number, number, 'oak' | 'pine' | 'cypress'][] = [
      [-3.28, -3.22, 'pine'], [-3.35, -2.35, 'oak'], [-3.25, -1.25, 'oak'], [-2.75, -3.38, 'cypress'],
      [-2.1, -3.45, 'pine'], [-1.85, -0.88, 'pine'], [-3.05, -0.85, 'cypress'],
      [-2.55, -1.08, 'oak'], [-0.82, -1.98, 'cypress'], [-2.95, -2.9, 'oak'],
    ];
    for (const [tx, tz, kind] of treeSpots) {
      const tr = this.makeTree(kind, 1.15 + rnd() * 0.45);
      tr.position.set(tx, -0.02, tz);
      tr.rotation.y = rnd() * Math.PI * 2;
      this.group.add(tr);
    }
  }

  private makeBench(): THREE.Group {
    const g = new THREE.Group();
    const seat = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.02, 0.082), WOOD_MAT);
    seat.position.set(0, 0.06, 0);
    const back = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.072, 0.018), WOOD_MAT);
    back.position.set(0, 0.105, -0.038);
    back.rotation.x = -0.18;
    for (const sx of [-0.105, 0.105]) {
      const leg = new THREE.Mesh(new THREE.BoxGeometry(0.018, 0.066, 0.076), DARK_IRON);
      leg.position.set(sx, 0.033, 0);
      g.add(leg);
    }
    for (const m of [seat, back]) { m.castShadow = true; g.add(m); }
    return g;
  }

  private makeTree(kind: 'oak' | 'pine' | 'cypress', scale: number): THREE.Group {
    const g = new THREE.Group();
    const trunkMat = new THREE.MeshStandardMaterial({ color: 0x5d3e24, roughness: 0.9 });
    if (kind === 'cypress') {
      const tr = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.036, 0.16, 8), trunkMat);
      tr.position.y = 0.08;
      const fol = new THREE.Mesh(new THREE.ConeGeometry(0.105, 0.64, 12), new THREE.MeshStandardMaterial({ color: 0x275731, roughness: 0.88 }));
      fol.position.y = 0.42;
      tr.castShadow = fol.castShadow = true;
      g.add(tr, fol);
    } else if (kind === 'pine') {
      const tr = new THREE.Mesh(new THREE.CylinderGeometry(0.024, 0.042, 0.46, 8), trunkMat);
      tr.position.y = 0.23;
      tr.castShadow = true;
      g.add(tr);
      const pineMat = new THREE.MeshStandardMaterial({ color: 0x2f6a39, roughness: 0.86 });
      for (const [ox, oy, oz, rx, ry] of [[0, 0.5, 0, 0.24, 0.09], [-0.11, 0.46, 0.07, 0.16, 0.07], [0.11, 0.47, -0.06, 0.17, 0.07]]) {
        const c = new THREE.Mesh(new THREE.SphereGeometry(rx, 12, 10), pineMat);
        c.scale.set(1, ry / rx, 1);
        c.position.set(ox, oy, oz);
        c.castShadow = true;
        g.add(c);
      }
    } else {
      const tr = new THREE.Mesh(new THREE.CylinderGeometry(0.028, 0.044, 0.24, 8), trunkMat);
      tr.position.y = 0.12;
      tr.castShadow = true;
      g.add(tr);
      const greens = [0x3b7f40, 0x4a924c, 0x2e6b36];
      const oakMat = new THREE.MeshStandardMaterial({ color: greens[Math.floor(scale * 10) % greens.length], roughness: 0.88 });
      for (const [ox, oy, oz, r] of [[0, 0.34, 0, 0.17], [-0.095, 0.29, 0.06, 0.125], [0.1, 0.3, -0.045, 0.12], [0.02, 0.42, -0.02, 0.115]]) {
        const c = new THREE.Mesh(new THREE.SphereGeometry(r, 12, 10), oakMat);
        c.position.set(ox, oy, oz);
        c.castShadow = true;
        g.add(c);
      }
    }
    g.scale.setScalar(scale);
    return g;
  }

  // ---------- 2. LAGO, FARO MONUMENTALE & CLUB NAUTICO (SE: x > 0, z > 0) ----------
  private buildLake(): void {
    const roofs = getRoofMats();
    const lake = new THREE.Mesh(new THREE.CircleGeometry(LAKE.r, 56), this.waterMat);
    lake.rotation.x = -Math.PI / 2;
    lake.position.set(LAKE.x, -0.022, LAKE.z);
    lake.receiveShadow = true;
    this.group.add(lake);

    const quay = new THREE.Mesh(new THREE.TorusGeometry(LAKE.r + 0.045, 0.05, 10, 52), STONE_PLINTH);
    quay.rotation.x = Math.PI / 2;
    quay.position.set(LAKE.x, 0.0, LAKE.z);
    quay.receiveShadow = true;
    this.group.add(quay);

    // Pontile in legno + Darsena / Club Nautico sul lungolago!
    const pier = new THREE.Group();
    pier.position.set(1.14, 0.02, 1.68);
    pier.rotation.y = -0.46;
    const deck = new THREE.Mesh(new THREE.BoxGeometry(0.56, 0.036, 0.24), WOOD_MAT);
    deck.castShadow = deck.receiveShadow = true;
    pier.add(deck);
    for (const px of [-0.24, 0, 0.24]) {
      for (const pz of [-0.11, 0.11]) {
        const post = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.022, 0.14, 8), WOOD_MAT);
        post.position.set(px, 0.01, pz);
        pier.add(post);
      }
    }
    this.group.add(pier);

    // Club Nautico (Darsena in stile lago di Como con porticato, finestre calde e tetto in ardesia!)
    const club = new THREE.Group();
    club.position.set(1.02, -0.01, 3.16);
    club.rotation.y = 0.65;
    const clubWall = makeLitFacade('#f4eee2', '#1d4ed8', 3, 2, true, 91, 'arcade');
    const cPlinth = new THREE.Mesh(new THREE.BoxGeometry(0.68, 0.06, 0.46), STONE_PLINTH);
    cPlinth.position.y = 0.03;
    const cBody = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.42, 0.4), clubWall);
    cBody.position.y = 0.27;
    const cCorn = new THREE.Mesh(new THREE.BoxGeometry(0.66, 0.028, 0.44), STONE_LIGHT);
    cCorn.position.y = 0.49;
    const cRoof = makeGableRoof(0.7, 0.2, 0.48, roofs.slate);
    cRoof.position.y = 0.504;
    const cVeranda = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.024, 0.14), roofs.slate);
    cVeranda.position.set(0, 0.24, 0.26);
    cVeranda.rotation.x = 0.18;
    for (const sx of [-0.26, -0.09, 0.09, 0.26]) {
      const col = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.016, 0.22, 8), STONE_LIGHT);
      col.position.set(sx, 0.13, 0.31);
      club.add(col);
    }
    const cDorm = makeDormer(roofs.slate);
    cDorm.position.set(0, 0.57, 0.14);
    const cChim = makeChimney(0.14, 1.0);
    cChim.position.set(0.18, 0.55, -0.08);
    for (const m of [cPlinth, cBody, cCorn, cRoof, cVeranda]) { m.castShadow = true; m.receiveShadow = true; club.add(m); }
    club.add(cDorm, cChim);
    this.group.add(club);

    // Faro Costiero Monumentale (1.30u di altezza!) con scogliera, casetta del guardiano e fascio rotante!
    const lh = new THREE.Group();
    lh.position.set(3.26, -0.02, 1.18);
    const rock = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.32, 0.12, 10), new THREE.MeshStandardMaterial({ color: 0x6c737c, roughness: 0.9 }));
    rock.position.y = 0.06;
    const cottage = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.24, 0.24), makeLitFacade('#f4efe4', '#b91c1c', 2, 1, true, 99, 'stone'));
    cottage.position.set(-0.04, 0.18, -0.24);
    const cotRoof = makeGableRoof(0.3, 0.11, 0.28, roofs.terracotta);
    cotRoof.position.set(-0.04, 0.3, -0.24);
    const tower = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.18, 0.92, 24), new THREE.MeshStandardMaterial({ color: 0xf8f5ec, roughness: 0.58 }));
    tower.position.y = 0.56;
    const band1 = new THREE.Mesh(new THREE.CylinderGeometry(0.135, 0.155, 0.22, 24), new THREE.MeshStandardMaterial({ color: 0xd93829, roughness: 0.52 }));
    band1.position.y = 0.42;
    const band2 = new THREE.Mesh(new THREE.CylinderGeometry(0.115, 0.13, 0.2, 24), new THREE.MeshStandardMaterial({ color: 0xd93829, roughness: 0.52 }));
    band2.position.y = 0.8;
    const gallery = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.12, 0.055, 24), DARK_IRON);
    gallery.position.y = 1.04;
    const rail = new THREE.Mesh(new THREE.TorusGeometry(0.17, 0.01, 8, 24), DARK_IRON);
    rail.rotation.x = Math.PI / 2; rail.position.y = 1.12;
    const glass = new THREE.Mesh(new THREE.CylinderGeometry(0.105, 0.105, 0.18, 20), new THREE.MeshStandardMaterial({ color: 0xfff5d6, emissive: 0xffd27a, emissiveIntensity: 1.0 }));
    glass.position.y = 1.15;
    const dome = new THREE.Mesh(new THREE.SphereGeometry(0.112, 18, 12, 0, Math.PI * 2, 0, Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0xd93829, roughness: 0.42 }));
    dome.position.y = 1.24;
    const spire = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.014, 0.14, 8), BRASS_TRIM);
    spire.position.y = 1.38;
    for (const m of [rock, cottage, cotRoof, tower, band1, band2, gallery, rail, dome, spire]) { m.castShadow = true; m.receiveShadow = true; lh.add(m); }
    lh.add(glass);

    const beamGrp = new THREE.Group();
    beamGrp.position.y = 1.15;
    const bMat = new THREE.MeshBasicMaterial({ color: 0xfff3b0, transparent: true, opacity: 0.24, side: THREE.DoubleSide, depthWrite: false });
    const cone1 = new THREE.Mesh(new THREE.ConeGeometry(0.22, 1.35, 16, 1, true), bMat);
    cone1.rotation.x = -Math.PI / 2; cone1.position.z = 0.72;
    const cone2 = new THREE.Mesh(new THREE.ConeGeometry(0.22, 1.35, 16, 1, true), bMat);
    cone2.rotation.x = Math.PI / 2; cone2.position.z = -0.72;
    beamGrp.add(cone1, cone2);
    lh.add(beamGrp);
    this.lighthouseBeam = beamGrp;
    this.group.add(lh);

    for (const col of [0xd93829, 0xeab308, 0x2563eb]) this.boats.push(this.makeSailboat(col));
    for (const [tx, tz] of [[3.38, 2.95], [3.42, 0.88], [1.95, 0.72]]) {
      const tr = this.makeTree('pine', 1.15);
      tr.position.set(tx, -0.02, tz);
      this.group.add(tr);
    }
  }

  private makeSailboat(color: number): THREE.Object3D {
    const g = new THREE.Group();
    const hullMat = new THREE.MeshStandardMaterial({ color, roughness: 0.35, metalness: 0.1 });
    const white = new THREE.MeshStandardMaterial({ color: 0xfaf8f2, roughness: 0.6, side: THREE.DoubleSide });
    const sh = new THREE.Shape();
    sh.moveTo(-0.15, 0); sh.lineTo(0.085, 0.06); sh.lineTo(0.175, 0); sh.lineTo(0.085, -0.06); sh.closePath();
    const hullGeo = new THREE.ExtrudeGeometry(sh, { depth: 0.05, bevelEnabled: true, bevelThickness: 0.008, bevelSize: 0.008, bevelSegments: 2 });
    hullGeo.rotateX(Math.PI / 2);
    const hull = new THREE.Mesh(hullGeo, hullMat);
    hull.position.y = 0.032;
    const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.009, 0.34, 8), WOOD_MAT);
    mast.position.set(0.01, 0.2, 0);
    const sailGeo = new THREE.BufferGeometry();
    sailGeo.setAttribute('position', new THREE.Float32BufferAttribute([0.01, 0.36, 0, -0.125, 0.085, 0.015, 0.01, 0.085, 0], 3));
    sailGeo.computeVertexNormals();
    const sail = new THREE.Mesh(sailGeo, white);
    const jibGeo = new THREE.BufferGeometry();
    jibGeo.setAttribute('position', new THREE.Float32BufferAttribute([0.01, 0.34, 0, 0.155, 0.075, -0.01, 0.01, 0.075, 0], 3));
    jibGeo.computeVertexNormals();
    const jib = new THREE.Mesh(jibGeo, white);
    for (const m of [hull, mast, sail, jib]) { m.castShadow = true; g.add(m); }
    this.group.add(g);
    return g;
  }

  // ---------- 3. CENTRO STORICO MONUMENTALE & SKYLINE (NE: x > 0, z < 0) ----------
  private buildHistoricDistrict(rnd: () => number): void {
    const roofs = getRoofMats();

    // A) GRANDE TORRE CAMPANARIA DEL CENTRO STORICO (altezza ~2.58 unità!)
    const bell = new THREE.Group();
    bell.position.set(2.04, -0.02, -2.04);
    const towerMat = makeLitFacade('#e5d5ba', '#4a3525', 2, 5, true, 31, 'stone');
    // Podio a gradoni
    const p1 = new THREE.Mesh(new THREE.BoxGeometry(0.68, 0.1, 0.68), STONE_PLINTH);
    p1.position.y = 0.05;
    const p2 = new THREE.Mesh(new THREE.BoxGeometry(0.58, 0.12, 0.58), STONE_LIGHT);
    p2.position.y = 0.16;
    // Fusto della torre con lesene angolari in pietra
    const shaft = new THREE.Mesh(new THREE.BoxGeometry(0.48, 1.38, 0.48), towerMat);
    shaft.position.y = 0.91;
    for (const sx of [-1, 1]) {
      for (const sz of [-1, 1]) {
        const pil = new THREE.Mesh(new THREE.BoxGeometry(0.068, 1.42, 0.068), STONE_LIGHT);
        pil.position.set(sx * 0.225, 0.92, sz * 0.225);
        pil.castShadow = true;
        bell.add(pil);
      }
    }
    // Portale con timpano triangolare alla base della torre
    const portal = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.28, 0.06), STONE_LIGHT);
    portal.position.set(0, 0.34, 0.245);
    const ped = makeGableRoof(0.3, 0.11, 0.08, STONE_LIGHT);
    ped.position.set(0, 0.48, 0.245);
    bell.add(portal, ped);

    // 4 OROLOGI MONUMENTALI HD con lancette e cornice dorata sulle 4 facce!
    const clkTex = clockTowerTex();
    const clkMat = new THREE.MeshStandardMaterial({ map: clkTex, emissiveMap: clkTex, emissive: new THREE.Color(0xffe082), emissiveIntensity: 0.25, roughness: 0.3 });
    nightMaterials.push(clkMat);
    for (let s = 0; s < 4; s++) {
      const a = (s * Math.PI) / 2;
      const ring = new THREE.Mesh(new THREE.TorusGeometry(0.145, 0.018, 10, 24), BRASS_TRIM);
      ring.position.set(Math.sin(a) * 0.245, 1.35, Math.cos(a) * 0.245);
      ring.rotation.y = a;
      const cf = new THREE.Mesh(new THREE.CircleGeometry(0.138, 24), clkMat);
      cf.position.set(Math.sin(a) * 0.252, 1.35, Math.cos(a) * 0.252);
      cf.rotation.y = a;
      bell.add(ring, cf);
    }

    // Cornicione sporgente a mensole + Cella Campanaria aperta a 8 colonne + Campana di bronzo + Cupola ottagonale in rame!
    const ledge = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.07, 0.6), STONE_LIGHT);
    ledge.position.y = 1.63;
    for (const sx of [-0.21, 0.21]) {
      for (const sz of [-0.21, 0.21]) {
        const col = new THREE.Mesh(new THREE.CylinderGeometry(0.032, 0.038, 0.38, 10), STONE_LIGHT);
        col.position.set(sx, 1.85, sz);
        col.castShadow = true;
        bell.add(col);
        // Pinnacolo d'angolo
        const pin = new THREE.Mesh(new THREE.ConeGeometry(0.042, 0.16, 4), STONE_LIGHT);
        pin.position.set(sx * 1.15, 2.15, sz * 1.15);
        bell.add(pin);
      }
    }
    const brassBell = new THREE.Mesh(new THREE.ConeGeometry(0.1, 0.16, 18), BRASS_TRIM);
    brassBell.position.y = 1.84;
    const bCap = new THREE.Mesh(new THREE.BoxGeometry(0.56, 0.06, 0.56), STONE_LIGHT);
    bCap.position.y = 2.06;
    const drum = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.27, 0.14, 8), STONE_LIGHT);
    drum.position.y = 2.16;
    const spire = new THREE.Mesh(new THREE.ConeGeometry(0.28, 0.52, 8), roofs.copper);
    spire.position.y = 2.48;
    const crossV = new THREE.Mesh(new THREE.BoxGeometry(0.022, 0.16, 0.022), BRASS_TRIM);
    crossV.position.y = 2.8;
    const crossH = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.022, 0.022), BRASS_TRIM);
    crossH.position.y = 2.83;
    for (const m of [p1, p2, shaft, ledge, brassBell, bCap, drum, spire, crossV, crossH]) { m.castShadow = true; m.receiveShadow = true; bell.add(m); }
    this.group.add(bell);

    // B) GRATTACIELO ART DÉCO DI LUSSO (angolo NE esterno: 3.12, -3.12, altezza ~2.25u!)
    const tower = this.makeArtDecoTower();
    tower.position.set(3.12, -0.02, -3.12);
    this.group.add(tower);

    // C) 4 GRANDI PALAZZI STORICI ITALIANI (molto più grandi e dettagliati, con balconi 3D, abbaini, portici e comignoli!)
    const palazzi: [number, number, number, number, number, string, 'terracotta' | 'terracottaDark' | 'slate', number, boolean][] = [
      [1.08, -1.56, 0.66, 1.18, 0.58, '#ecd9bc', 'terracotta',     41, true],
      [3.04, -1.14, 0.74, 1.38, 0.66, '#e6c5a8', 'terracottaDark', 42, true],
      [1.08, -3.02, 0.72, 1.28, 0.66, '#f0e4d0', 'slate',          43, true],
      [2.12, -3.15, 0.64, 1.08, 0.58, '#dde5d4', 'terracotta',     44, false],
      [3.12, -2.14, 0.62, 1.15, 0.6,  '#eedcb6', 'terracottaDark', 45, false],
    ];
    palazzi.forEach(([px, pz, w, h, d, wall, roofKind, seed, hasShop], i) => {
      const b = this.makeGrandPalazzo(w, h, d, wall, roofKind, seed, hasShop);
      b.position.set(px, -0.02, pz);
      b.rotation.y = (i % 2) * (Math.PI / 2);
      this.group.add(b);
    });

    for (const [cx, cz] of [[3.55, -0.78], [3.55, -1.68], [3.55, -2.62], [0.72, -3.48]]) {
      const cy = this.makeTree('cypress', 1.15 + rnd() * 0.3);
      cy.position.set(cx, -0.02, cz);
      this.group.add(cy);
    }
  }

  private makeArtDecoTower(): THREE.Group {
    const g = new THREE.Group();
    const roofs = getRoofMats();
    const m1 = makeLitFacade('#dfd6c5', '#2a394a', 4, 4, true, 51, 'arcade');
    const m2 = makeLitFacade('#eae2d2', '#2a394a', 3, 3, false, 53, 'stone');
    const m3 = makeLitFacade('#f2ebdc', '#2a394a', 2, 2, false, 55, 'stone');

    const base = new THREE.Mesh(new THREE.BoxGeometry(0.76, 0.14, 0.76), STONE_PLINTH);
    base.position.y = 0.07;
    const t1 = new THREE.Mesh(new THREE.BoxGeometry(0.68, 0.88, 0.68), m1);
    t1.position.y = 0.56;
    const c1 = new THREE.Mesh(new THREE.BoxGeometry(0.73, 0.04, 0.73), STONE_LIGHT);
    c1.position.y = 1.01;
    const t2 = new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.56, 0.52), m2);
    t2.position.y = 1.3;
    const c2 = new THREE.Mesh(new THREE.BoxGeometry(0.56, 0.036, 0.56), BRASS_TRIM);
    c2.position.y = 1.59;
    const t3 = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.34, 0.36), m3);
    t3.position.y = 1.77;
    const crown = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.24, 0.24, 8), roofs.copper);
    crown.position.y = 2.06;
    const spire = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 0.025, 0.3, 10), BRASS_TRIM);
    spire.position.y = 2.31;
    const beacon = new THREE.Mesh(new THREE.SphereGeometry(0.035, 10, 8), new THREE.MeshStandardMaterial({ color: 0xff2e43, emissive: 0xff1e35, emissiveIntensity: 1.5 }));
    beacon.position.y = 2.47;
    this.towerBeacon = beacon;

    // Lesene verticali cromate agli spigoli dei gradoni
    for (const sx of [-1, 1]) {
      for (const sz of [-1, 1]) {
        const fin1 = new THREE.Mesh(new THREE.BoxGeometry(0.038, 0.9, 0.038), STONE_LIGHT);
        fin1.position.set(sx * 0.34, 0.56, sz * 0.34);
        const fin2 = new THREE.Mesh(new THREE.BoxGeometry(0.032, 0.58, 0.032), BRASS_TRIM);
        fin2.position.set(sx * 0.26, 1.3, sz * 0.26);
        g.add(fin1, fin2);
      }
    }
    for (const m of [base, t1, c1, t2, c2, t3, crown, spire]) { m.castShadow = true; m.receiveShadow = true; g.add(m); }
    g.add(beacon);
    return g;
  }

  // Palazzo realistico multi-piano per la città centrale (bugnato, balconi 3D, tendoni negozi, tetto a tegole, abbaini e comignoli!)
  private makeGrandPalazzo(
    w: number,
    h: number,
    d: number,
    wallHex: string,
    roofKind: 'terracotta' | 'terracottaDark' | 'slate',
    seed: number,
    hasShop: boolean,
  ): THREE.Group {
    const g = new THREE.Group();
    const roofs = getRoofMats();
    const roofMat = roofs[roofKind];
    const floors = Math.max(3, Math.round(h * 3.1));
    const mat = makeLitFacade(wallHex, '#31463e', 3, floors, true, seed, hasShop ? 'shop' : 'stone');

    // Basamento in pietra + corpo principale
    const plinth = new THREE.Mesh(new THREE.BoxGeometry(w + 0.05, 0.06, d + 0.05), STONE_PLINTH);
    plinth.position.y = 0.03;
    const body = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    body.position.y = 0.06 + h / 2;

    // Cornicione superiore sporgente + fasce marcapiano 3D reali!
    const cornice = new THREE.Mesh(new THREE.BoxGeometry(w + 0.075, 0.042, d + 0.075), STONE_LIGHT);
    cornice.position.y = 0.06 + h + 0.014;
    const beltY = 0.06 + h / floors;
    const belt = new THREE.Mesh(new THREE.BoxGeometry(w + 0.032, 0.024, d + 0.032), STONE_LIGHT);
    belt.position.y = beltY;

    // Tetto a due falde con texture tegole, colmo, 2 abbaini e doppi comignoli!
    const roofH = 0.21;
    const roof = makeGableRoof(w + 0.09, roofH, d + 0.08, roofMat);
    roof.position.y = 0.06 + h + 0.034;
    const ridge = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, d + 0.09, 8), BRICK_MAT);
    ridge.rotation.x = Math.PI / 2;
    ridge.position.y = 0.06 + h + 0.034 + roofH;

    // 2 abbaini sui due spioventi del tetto
    for (const s of [-1, 1]) {
      const dorm = makeDormer(roofMat);
      dorm.position.set(s * (w * 0.23), 0.06 + h + 0.11, 0);
      dorm.rotation.y = s * (Math.PI / 2);
      g.add(dorm);
    }

    // Comignolo realistico + piccolo lucernario/unità tecnica sul retro
    const chim = makeChimney(0.17, 1.15);
    chim.position.set(w * 0.22, 0.06 + h + 0.12, -d * 0.24);
    g.add(chim);

    // 2 Balconi 3D in ferro battuto con fioriere sul piano nobile (fronte + retro)
    const balcY = beltY + (h / floors) * 0.92;
    const balcF = makeBalcony(w * 0.42, 0.068, true);
    balcF.position.set(0, balcY, d / 2 + 0.03);
    const balcB = makeBalcony(w * 0.36, 0.06, false);
    balcB.position.set(0, balcY, -(d / 2 + 0.028));
    balcB.rotation.y = Math.PI;
    g.add(balcF, balcB);

    // Tendoni da bottega / caffè al piano terra se hasShop!
    if (hasShop) {
      const shopCols = [0xc2410c, 0x1d4ed8, 0x15803d, 0x9f1239];
      const awMat = new THREE.MeshStandardMaterial({ color: shopCols[seed % shopCols.length], roughness: 0.65 });
      for (const sx of [-w * 0.28, w * 0.28]) {
        const aw = new THREE.Mesh(new THREE.BoxGeometry(w * 0.32, 0.018, 0.11), awMat);
        aw.position.set(sx, beltY - 0.04, d / 2 + 0.045);
        aw.rotation.x = 0.36;
        aw.castShadow = true;
        g.add(aw);
      }
      // Lampioncino sopra il portone
      const gl = new THREE.Mesh(new THREE.SphereGeometry(0.018, 8, 8), getPorchLanternMat());
      gl.position.set(0, beltY - 0.025, d / 2 + 0.025);
      g.add(gl);
    }

    for (const m of [plinth, body, cornice, belt, roof, ridge]) { m.castShadow = true; m.receiveShadow = true; g.add(m); }
    return g;
  }

  // ---------- 4. BORGO VECCHIO & MERCATO (SW: x < 0, z > 0) ----------
  private buildMarketDistrict(rnd: () => number): void {
    // 5 grandi palazzine del Borgo Vecchio con botteghe, balconi fioriti e PANNI STESI tra due palazzi!
    const borgo: [number, number, number, number, number, string, 'terracotta' | 'terracottaDark' | 'slate', number][] = [
      [-3.12, 1.15, 0.68, 1.24, 0.62, '#f2d3b0', 'terracotta',     71],
      [-3.12, 2.15, 0.66, 1.48, 0.64, '#d6e4ed', 'slate',          72],
      [-3.08, 3.12, 0.72, 1.12, 0.64, '#f0cac0', 'terracottaDark', 73],
      [-2.08, 3.15, 0.7,  1.34, 0.62, '#ede0b5', 'terracotta',     74],
      [-1.08, 3.12, 0.66, 1.08, 0.62, '#dde7cd', 'slate',          75],
    ];
    borgo.forEach(([px, pz, w, h, d, wall, roofKind, seed], i) => {
      const b = this.makeGrandPalazzo(w, h, d, wall, roofKind, seed, true);
      b.position.set(px, -0.02, pz);
      b.rotation.y = (i < 3 ? Math.PI / 2 : Math.PI);
      this.group.add(b);
    });

    // Dettaglio iconico di Sdrogopoli ("Via dei Panni Stesi"): 2 fili di panni colorati tesi tra le palazzine del Borgo!
    const laundryCols = [0xef4444, 0xfef08a, 0x38bdf8, 0xffffff, 0x4ade80, 0xf472b6];
    for (const [yLine, zOff] of [[0.78, 0], [0.98, 0.08]]) {
      const lineGeo = new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(-2.78, yLine, 2.25 + zOff),
        new THREE.Vector3(-2.15, yLine - 0.06, 2.82 + zOff),
      ]);
      this.group.add(new THREE.Line(lineGeo, new THREE.LineBasicMaterial({ color: 0x4b5563 })));
      for (let k = 1; k <= 5; k++) {
        const t = k / 6;
        const cloth = new THREE.Mesh(
          new THREE.BoxGeometry(0.065, 0.075, 0.012),
          new THREE.MeshStandardMaterial({ color: laundryCols[(k + Math.round(yLine * 10)) % laundryCols.length], roughness: 0.85 }),
        );
        cloth.position.set(-2.78 + t * 0.63, yLine - Math.sin(t * Math.PI) * 0.06 - 0.04, 2.25 + zOff + t * 0.57);
        cloth.rotation.y = 0.72;
        cloth.castShadow = true;
        this.group.add(cloth);
      }
    }

    // 4 bancarelle ricche del Mercato con tendoni a righe, lampadine calde e cassette di frutta
    const stallColors = [0xd93829, 0x2563eb, 0x16a34a, 0xea580c];
    const stallCoords: [number, number, number][] = [
      [-1.35, 1.32, 0.35], [-2.18, 1.38, -0.2], [-1.35, 2.18, 1.4], [-2.15, 2.18, 2.15],
    ];
    stallCoords.forEach(([sx, sz, rot], i) => {
      const st = new THREE.Group();
      st.position.set(sx, -0.01, sz);
      st.rotation.y = rot;
      const counter = new THREE.Mesh(new THREE.BoxGeometry(0.48, 0.14, 0.25), WOOD_MAT);
      counter.position.y = 0.07;
      for (const px of [-0.22, 0.22]) {
        for (const pz of [-0.1, 0.1]) {
          const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.34, 6), WOOD_MAT);
          pole.position.set(px, 0.17, pz);
          st.add(pole);
        }
      }
      for (let k = -1; k <= 1; k++) {
        const stripe = new THREE.Mesh(
          new THREE.BoxGeometry(0.18, 0.018, 0.33),
          new THREE.MeshStandardMaterial({ color: k === 0 ? 0xfaf6ee : stallColors[i], roughness: 0.7 }),
        );
        stripe.position.set(k * 0.18, 0.345, 0);
        stripe.rotation.x = 0.18;
        stripe.castShadow = true;
        st.add(stripe);
      }
      const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.018, 8, 8), getPorchLanternMat());
      bulb.position.set(0, 0.32, 0.14);
      st.add(bulb);
      for (let k = -1; k <= 1; k++) {
        const crate = new THREE.Mesh(
          new THREE.BoxGeometry(0.11, 0.055, 0.14),
          new THREE.MeshStandardMaterial({ color: [0xf59e0b, 0x22c55e, 0xef4444][(i + k + 3) % 3], roughness: 0.7 }),
        );
        crate.position.set(k * 0.135, 0.165, 0.01);
        st.add(crate);
      }
      counter.castShadow = true;
      st.add(counter);
      this.group.add(st);
    });

    const oak = this.makeTree('oak', 1.15 + rnd() * 0.2);
    oak.position.set(-0.92, -0.02, 0.92);
    this.group.add(oak);
  }

  // ---------- 5. PIAZZA CENTRALE & 2 MAZZI DI CARTE FISICI 3D ----------
  private buildCentralPlazaAndDecks(): void {
    const curb = new THREE.Mesh(new THREE.CylinderGeometry(0.84, 0.88, 0.05, 36), STONE_PLINTH);
    curb.position.y = 0.0;
    curb.receiveShadow = true;
    this.group.add(curb);

    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2 + Math.PI / 8;
      const bush = new THREE.Mesh(new THREE.SphereGeometry(0.105, 10, 8), HEDGE_MAT);
      bush.scale.set(1.2, 0.72, 1.2);
      bush.position.set(Math.cos(a) * 0.68, 0.055, Math.sin(a) * 0.68);
      bush.castShadow = true;
      this.group.add(bush);
    }
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * Math.PI * 2;
      const lamp = new THREE.Mesh(new THREE.CylinderGeometry(0.038, 0.048, 0.05, 12), DARK_IRON);
      lamp.position.set(Math.cos(a) * 0.36, 0.04, Math.sin(a) * 0.36);
      const lens = new THREE.Mesh(new THREE.CircleGeometry(0.03, 12), this.lampMat);
      lens.rotation.x = -Math.PI / 2;
      lens.position.set(Math.cos(a) * 0.36, 0.066, Math.sin(a) * 0.36);
      this.group.add(lamp, lens);
    }

    // 2 Mazzi fisici di carte 3D su piazzole diagonali tangenti alla rotonda (fuori da strade e incroci!)
    const decks: [number, number, number, 'sorte' | 'quartiere'][] = [
      [-1.16, -1.16, -Math.PI / 4, 'sorte'],
      [1.16, 1.16, Math.PI * 0.75, 'quartiere'],
    ];
    for (const [dx, dz, rot, kind] of decks) {
      const dg = new THREE.Group();
      dg.position.set(dx, 0.01, dz);
      dg.rotation.y = rot;
      const tray = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.035, 0.68), STONE_PLINTH);
      tray.receiveShadow = true;
      dg.add(tray);
      const topTex = cardDeckTexture(kind);
      const cardSide = new THREE.MeshStandardMaterial({ color: 0xf4efe4, roughness: 0.75 });
      const cardTop = new THREE.MeshStandardMaterial({ map: topTex, roughness: 0.45 });
      const stack = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.13, 0.58), [cardSide, cardSide, cardTop, cardSide, cardSide, cardSide]);
      stack.position.y = 0.088;
      stack.castShadow = true;
      const topCard = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.014, 0.58), [cardSide, cardSide, cardTop, cardSide, cardSide, cardSide]);
      topCard.position.set(0.015, 0.165, -0.01);
      topCard.rotation.y = 0.06;
      topCard.castShadow = true;
      dg.add(stack, topCard);
      this.group.add(dg);
    }
  }

  // ---------- 6. SCRITTA AEREA FLUTTUANTE 3D: "Gioco FOLLE!" (sollevata sopra lo skyline!) ----------
  private buildFloatingSign(): void {
    const { map, emissive } = floatingSignTextures();
    this.signGroup.position.set(0, 3.45, 0);

    const w = 3.85, h = 1.18, depth = 0.16;
    const frame = new THREE.Mesh(new THREE.BoxGeometry(w + 0.16, h + 0.16, depth), BRASS_TRIM);
    this.signGroup.add(frame);

    const body = new THREE.Mesh(new THREE.BoxGeometry(w + 0.05, h + 0.05, depth + 0.02), DARK_IRON);
    this.signGroup.add(body);

    const faceMat = new THREE.MeshStandardMaterial({
      map,
      emissiveMap: emissive,
      emissive: new THREE.Color(0xffffff),
      emissiveIntensity: 0.88,
      roughness: 0.22,
      metalness: 0.18,
    });
    const front = new THREE.Mesh(new THREE.PlaneGeometry(w, h), faceMat);
    front.position.z = depth / 2 + 0.016;
    const back = new THREE.Mesh(new THREE.PlaneGeometry(w, h), faceMat);
    back.position.z = -(depth / 2 + 0.016);
    back.rotation.y = Math.PI;
    this.signGroup.add(front, back);

    for (const sx of [-1, 1]) {
      for (const sy of [-1, 1]) {
        const stud = new THREE.Mesh(new THREE.OctahedronGeometry(0.095, 0), BRASS_TRIM);
        stud.position.set(sx * (w / 2 + 0.08), sy * (h / 2 + 0.08), 0);
        this.signGroup.add(stud);
      }
    }
    const sparkMat = new THREE.MeshStandardMaterial({ color: 0xfde047, emissive: 0xfbbf24, emissiveIntensity: 1.25, roughness: 0.15 });
    for (let i = 0; i < 6; i++) {
      const sp = new THREE.Mesh(new THREE.OctahedronGeometry(0.082, 0), sparkMat);
      this.signGroup.add(sp);
      this.signSparks.push(sp);
    }

    this.group.add(this.signGroup);

    const beam = new THREE.Mesh(new THREE.CylinderGeometry(1.28, 0.44, 3.15, 24, 1, true), this.signBeamMat);
    beam.position.set(0, 1.64, 0);
    this.group.add(beam);
  }

  // ---------- 7. LAMPIONI D'EPOCA ----------
  private buildStreetLamps(): void {
    const spots: [number, number, number][] = [];
    for (const t of [-3.1, -1.55, 1.55, 3.1]) {
      spots.push([t, -3.65, 0], [t, 3.65, Math.PI], [-3.65, t, Math.PI / 2], [3.65, t, -Math.PI / 2]);
    }
    const haloGeo = new THREE.SphereGeometry(0.18, 10, 8);
    for (const [lx, lz, rot] of spots) {
      const lg = new THREE.Group();
      lg.position.set(lx, -0.02, lz);
      lg.rotation.y = rot;
      const base = new THREE.Mesh(new THREE.CylinderGeometry(0.026, 0.04, 0.09, 8), DARK_IRON);
      base.position.y = 0.045;
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.013, 0.02, 0.48, 8), DARK_IRON);
      pole.position.y = 0.28;
      const arm = new THREE.Mesh(new THREE.BoxGeometry(0.018, 0.018, 0.12), DARK_IRON);
      arm.position.set(0, 0.51, -0.05);
      const lantern = new THREE.Mesh(new THREE.SphereGeometry(0.046, 10, 8), this.lampMat);
      lantern.position.set(0, 0.485, -0.1);
      const cap = new THREE.Mesh(new THREE.ConeGeometry(0.058, 0.038, 8), DARK_IRON);
      cap.position.set(0, 0.53, -0.1);
      const halo = new THREE.Mesh(haloGeo, this.haloMat);
      halo.position.set(0, 0.485, -0.1);
      pole.castShadow = true;
      lg.add(base, pole, arm, lantern, cap, halo);
      this.group.add(lg);
    }
  }

  // ---------- 8. MICRO-TRAFFICO ANIMATO ----------
  private buildTrafficCars(): void {
    const specs: [number, number, number, boolean][] = [
      [0xd93829, 0.05, 0.028, false],
      [0xeab308, 0.42, 0.024, false],
      [0x2f6f4f, 0.74, 0.021, true],
    ];
    for (const [col, startT, speed, isBus] of specs) {
      const cg = new THREE.Group();
      const paint = new THREE.MeshPhysicalMaterial({ color: col, roughness: 0.25, metalness: 0.25, clearcoat: 0.8 });
      const len = isBus ? 0.36 : 0.25;
      const h = isBus ? 0.13 : 0.07;
      const body = new THREE.Mesh(new THREE.BoxGeometry(0.12, h, len), paint);
      body.position.y = 0.026 + h / 2;
      body.castShadow = true;
      cg.add(body);
      if (!isBus) {
        const cab = new THREE.Mesh(new THREE.BoxGeometry(0.104, 0.058, 0.125), GLASS_DARK);
        cab.position.set(0, 0.112, -0.015);
        cab.castShadow = true;
        cg.add(cab);
      } else {
        const win = new THREE.Mesh(new THREE.BoxGeometry(0.124, 0.044, len * 0.82), new THREE.MeshStandardMaterial({ color: 0x93c5fd, emissive: 0xffd27a, emissiveIntensity: 0.35 }));
        win.position.set(0, 0.112, 0);
        cg.add(win);
      }
      const wheelMat = new THREE.MeshStandardMaterial({ color: 0x16181c, roughness: 0.9 });
      for (const wx of [-0.06, 0.06]) {
        for (const wz of [-len * 0.32, len * 0.32]) {
          const w = new THREE.Mesh(new THREE.CylinderGeometry(0.026, 0.026, 0.02, 10), wheelMat);
          w.rotation.z = Math.PI / 2;
          w.position.set(wx, 0.026, wz);
          cg.add(w);
        }
      }
      for (const lx of [-0.038, 0.038]) {
        const hl = new THREE.Mesh(new THREE.SphereGeometry(0.014, 6, 6), this.carLightsMat);
        hl.position.set(lx, 0.058, len / 2 + 0.004);
        const tl = new THREE.Mesh(new THREE.SphereGeometry(0.012, 6, 6), new THREE.MeshStandardMaterial({ color: 0xef4444, emissive: 0xef4444, emissiveIntensity: 0.9 }));
        tl.position.set(lx, 0.058, -len / 2 - 0.004);
        cg.add(hl, tl);
      }
      this.group.add(cg);
      this.cars.push({ mesh: cg, t: startT, speed, lane: isBus ? 3.92 : 4.14 });
    }
  }

  // ---------- 9. MONUMENTI ARCHITETTONICI SUI 4 ANGOLI (sull'apron esterno, orientati verso il centro, ZERO sovrapposizioni!) ----------
  private buildCornerLandmarks(): void {
    const roofs = getRoofMats();

    // Angolo 0 — PARTENZA (+5.80, +5.80): Arco Trionfale Neoclassico tangente all'angolo (fronte +Z verso il centro!)
    const startArch = new THREE.Group();
    startArch.position.set(5.8, -0.04, 5.8);
    startArch.rotation.y = -Math.PI * 0.75;
    for (const sx of [-0.3, 0.3]) {
      const pier = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.62, 0.16), STONE_LIGHT);
      pier.position.set(sx, 0.31, 0);
      pier.castShadow = true;
      const baseP = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.1, 0.2), STONE_PLINTH);
      baseP.position.set(sx, 0.05, 0);
      const urn = new THREE.Mesh(new THREE.SphereGeometry(0.045, 12, 10), BRASS_TRIM);
      urn.position.set(sx, 0.85, 0);
      startArch.add(pier, baseP, urn);
    }
    const entab = new THREE.Mesh(new THREE.BoxGeometry(0.84, 0.14, 0.18), new THREE.MeshStandardMaterial({ color: 0xd93829, roughness: 0.38 }));
    entab.position.set(0, 0.68, 0);
    const attic = new THREE.Mesh(new THREE.BoxGeometry(0.68, 0.08, 0.16), STONE_LIGHT);
    attic.position.set(0, 0.78, 0);
    const goldTop = new THREE.Mesh(new THREE.BoxGeometry(0.88, 0.026, 0.21), BRASS_TRIM);
    goldTop.position.set(0, 0.75, 0);
    for (const m of [entab, attic, goldTop]) { m.castShadow = true; startArch.add(m); }
    this.group.add(startArch);

    // Angolo 10 — CASERMA (-5.80, +5.80): Stazione di Polizia Neoclassica orientata verso il centro!
    const jail = new THREE.Group();
    jail.position.set(-5.8, -0.04, 5.8);
    jail.rotation.y = Math.PI * 0.75;
    const jBase = new THREE.Mesh(new THREE.BoxGeometry(0.54, 0.07, 0.44), STONE_PLINTH);
    jBase.position.y = 0.035;
    const jBody = new THREE.Mesh(new THREE.BoxGeometry(0.48, 0.44, 0.38), makeLitFacade('#dcd7cc', '#1e293b', 3, 2, true, 88, 'stone'));
    jBody.position.y = 0.29;
    const jCorn = new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.034, 0.42), STONE_LIGHT);
    jCorn.position.y = 0.52;
    const jRoof = makeGableRoof(0.54, 0.13, 0.44, roofs.slate);
    jRoof.position.y = 0.535;
    for (let k = -1; k <= 1; k++) {
      const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.009, 0.009, 0.17, 8), DARK_IRON);
      bar.position.set(k * 0.048 - 0.125, 0.33, 0.198);
      jail.add(bar);
    }
    const blueMat = new THREE.MeshStandardMaterial({ color: 0x3b82f6, emissive: 0x2563eb, emissiveIntensity: 1.5 });
    const redMat = new THREE.MeshStandardMaterial({ color: 0xef4444, emissive: 0xdc2626, emissiveIntensity: 0.2 });
    const bLamp = new THREE.Mesh(new THREE.CylinderGeometry(0.036, 0.04, 0.064, 12), blueMat);
    bLamp.position.set(-0.09, 0.67, 0);
    const rLamp = new THREE.Mesh(new THREE.CylinderGeometry(0.036, 0.04, 0.064, 12), redMat);
    rLamp.position.set(0.09, 0.67, 0);
    for (const m of [jBase, jBody, jCorn, jRoof]) { m.castShadow = true; m.receiveShadow = true; jail.add(m); }
    jail.add(bLamp, rLamp);
    this.policeBeacons = { blue: blueMat, red: redMat };
    this.group.add(jail);

    // Angolo 20 — PANCHINA DEL PARCO (-5.80, -5.80): Pergolato + panchina + quercia orientati verso il centro!
    const freeCorner = new THREE.Group();
    freeCorner.position.set(-5.8, -0.04, -5.8);
    freeCorner.rotation.y = Math.PI * 0.25;
    const b3d = this.makeBench();
    b3d.scale.setScalar(1.45);
    const t3d = this.makeTree('oak', 1.05);
    t3d.position.set(0.32, 0, -0.02);
    for (const sx of [-0.22, 0.22]) {
      const p = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.018, 0.42, 8), WOOD_MAT);
      p.position.set(sx, 0.21, -0.04);
      p.castShadow = true;
      freeCorner.add(p);
    }
    const pergola = new THREE.Mesh(new THREE.BoxGeometry(0.54, 0.024, 0.22), WOOD_MAT);
    pergola.position.set(0, 0.42, -0.03);
    pergola.castShadow = true;
    freeCorner.add(b3d, t3d, pergola);
    this.group.add(freeCorner);

    // Angolo 30 — FERMATO DAI VIGILI (+5.80, -5.80): Garitta + semaforo 3 luci + sbarra orientati verso il centro!
    const copCorner = new THREE.Group();
    copCorner.position.set(5.8, -0.04, -5.8);
    copCorner.rotation.y = -Math.PI * 0.25;
    const booth = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.4, 0.26), STONE_LIGHT);
    booth.position.set(0.18, 0.2, -0.04);
    const boothRoof = new THREE.Mesh(new THREE.ConeGeometry(0.22, 0.13, 4), roofs.slate);
    boothRoof.position.set(0.18, 0.46, -0.04);
    boothRoof.rotation.y = Math.PI / 4;
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.024, 0.6, 10), DARK_IRON);
    post.position.set(-0.2, 0.3, 0.02);
    const box = new THREE.Mesh(new THREE.BoxGeometry(0.105, 0.26, 0.09), DARK_IRON);
    box.position.set(-0.2, 0.5, 0.02);
    const tlRed = new THREE.MeshStandardMaterial({ color: 0xef4444, emissive: 0xef4444, emissiveIntensity: 1.5 });
    const tlAmb = new THREE.MeshStandardMaterial({ color: 0xf59e0b, emissive: 0xf59e0b, emissiveIntensity: 0.1 });
    const tlGrn = new THREE.MeshStandardMaterial({ color: 0x22c55e, emissive: 0x22c55e, emissiveIntensity: 0.1 });
    for (const [ly, mat] of [[0.58, tlRed], [0.5, tlAmb], [0.42, tlGrn]] as [number, THREE.MeshStandardMaterial][]) {
      const l = new THREE.Mesh(new THREE.SphereGeometry(0.026, 10, 8), mat);
      l.position.set(-0.2, ly, 0.068);
      copCorner.add(l);
    }
    this.trafficLights = { red: tlRed, amber: tlAmb, green: tlGrn };
    for (let k = 0; k < 5; k++) {
      const seg = new THREE.Mesh(new THREE.BoxGeometry(0.084, 0.028, 0.022), new THREE.MeshStandardMaterial({ color: k % 2 === 0 ? 0xd93829 : 0xfafafa }));
      seg.position.set(0.08 - k * 0.08, 0.18 + k * 0.024, 0.09);
      seg.rotation.z = -0.28;
      copCorner.add(seg);
    }
    for (const m of [booth, boothRoof, post, box]) { m.castShadow = true; copCorner.add(m); }
    this.group.add(copCorner);
  }

  // ---------- Ciclo Giorno/Notte ----------
  setNight(n: number, sunAngle = 0): void {
    const glow = THREE.MathUtils.smoothstep(n, 0.28, 0.88);
    for (const m of nightMaterials) m.emissiveIntensity = glow * 1.4;
    this.lampMat.emissiveIntensity = 0.15 + glow * 2.6;
    this.haloMat.opacity = glow * 0.28;
    this.carLightsMat.emissiveIntensity = 0.2 + glow * 2.2;
    this.signBeamMat.opacity = 0.03 + glow * 0.14;
    this.waterMat.color.setHex(0x2f88c2).lerp(new THREE.Color(0x0f2544), n);
    this.starsMat.opacity = THREE.MathUtils.smoothstep(n, 0.45, 0.95) * 0.9;

    const R = 28;
    const sy = Math.cos(sunAngle) * R * 0.65;
    const sx = Math.sin(sunAngle) * R;
    const sz = -10;
    this.sunMesh.position.set(sx, sy, sz);
    this.sunMesh.visible = sy > -2;
    this.moonMesh.position.set(-sx, -sy, sz);
    this.moonMesh.visible = -sy > -2;
  }

  // ---------- Animazioni continue ----------
  update(dt: number, still: boolean): void {
    if (still) return;
    this.time += dt;

    // 1. Scritta fluttuante "Gioco FOLLE!" ben sopra lo skyline
    this.signGroup.position.y = 3.45 + Math.sin(this.time * 1.8) * 0.18;
    this.signGroup.rotation.y = this.time * 0.42;
    this.signGroup.rotation.z = Math.sin(this.time * 1.2) * 0.04;
    this.signSparks.forEach((sp, i) => {
      const a = this.time * 1.1 + (i / this.signSparks.length) * Math.PI * 2;
      sp.position.set(Math.cos(a) * 2.22, Math.sin(a * 2) * 0.58, Math.sin(a) * 0.48);
      sp.rotation.y += dt * 3;
    });

    // 2. Barche a vela sul lago
    this.boats.forEach((b, i) => {
      const a = this.time * (0.14 + i * 0.045) + i * ((Math.PI * 2) / 3);
      const r = LAKE.r * (0.58 - i * 0.16);
      b.position.set(LAKE.x + Math.cos(a) * r, -0.015 + Math.sin(this.time * 2.4 + i) * 0.008, LAKE.z + Math.sin(a) * r);
      b.rotation.y = -a + Math.PI / 2;
      b.rotation.z = Math.sin(this.time * 2.1 + i) * 0.06;
    });

    // 3. Zampilli della fontana monumentale
    for (const d of this.fountainDrops) {
      const u = (this.time * 0.95 + d.phase) % 1;
      const r = d.radius * u;
      const y = 0.52 + 0.28 * u - 0.65 * u * u;
      d.mesh.position.set(PARK.x + Math.cos(d.angle) * r, Math.max(0.12, y), PARK.z + Math.sin(d.angle) * r);
      const s = 0.55 + Math.sin(u * Math.PI) * 0.72;
      d.mesh.scale.setScalar(s);
    }

    if (this.lighthouseBeam) this.lighthouseBeam.rotation.y += dt * 1.35;
    if (this.towerBeacon) {
      const s = 0.8 + Math.sin(this.time * 6) * 0.35;
      this.towerBeacon.scale.setScalar(s);
    }

    if (this.policeBeacons) {
      const flash = Math.sin(this.time * 9) > 0;
      this.policeBeacons.blue.emissiveIntensity = flash ? 2.2 : 0.1;
      this.policeBeacons.red.emissiveIntensity = flash ? 0.1 : 2.2;
    }
    if (this.trafficLights) {
      const phase = Math.floor(this.time * 0.45) % 3;
      this.trafficLights.red.emissiveIntensity = phase === 0 ? 1.8 : 0.08;
      this.trafficLights.green.emissiveIntensity = phase === 1 ? 1.8 : 0.08;
      this.trafficLights.amber.emissiveIntensity = phase === 2 ? 1.8 : 0.08;
    }

    for (const c of this.cars) {
      c.t = (c.t + dt * c.speed) % 1;
      const L = c.lane;
      const p = c.t * 4;
      const seg = Math.floor(p);
      const f = p - seg;
      let x = 0, z = 0, yaw = 0;
      if (seg === 0) { x = -L + f * 2 * L; z = -L; yaw = Math.PI / 2; }
      else if (seg === 1) { x = L; z = -L + f * 2 * L; yaw = 0; }
      else if (seg === 2) { x = L - f * 2 * L; z = L; yaw = -Math.PI / 2; }
      else { x = -L; z = L - f * 2 * L; yaw = Math.PI; }
      c.mesh.position.set(x, -0.015, z);
      c.mesh.rotation.y = yaw;
    }
  }
}

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

const SKY: SkyKey[] = [
  { bg: 0xb9dcf2, hemiSky: 0xffffff, hemiGround: 0x6f7f6e, hemi: 1.4, sun: 2.3, sunColor: 0xfffaf0, night: 0 },
  { bg: 0xec9e6c, hemiSky: 0xffcfa8, hemiGround: 0x6e5b4e, hemi: 1.1, sun: 1.8, sunColor: 0xff8c42, night: 0.42 },
  { bg: 0x0d1528, hemiSky: 0x7b91cc, hemiGround: 0x1e2432, hemi: 0.65, sun: 0.55, sunColor: 0x9fb8ff, night: 1 },
  { bg: 0xf1c2b8, hemiSky: 0xffe0d4, hemiGround: 0x7a767a, hemi: 1.15, sun: 1.6, sunColor: 0xffb896, night: 0.32 },
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
    sunAngle: (p / SKY.length) * Math.PI * 2,
  };
}

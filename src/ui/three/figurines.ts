// 10 Personaggi-Statuetta 3D Anatomici HD+ da collezione per Gioco Folle! (v5).
// Corpi scolpiti con mesh organiche (buildLoft a sezione ellittica/anatomica, pieghe drappeggiate reali,
// muscolatura/corazze stratificate, mani articolate con 5 dita, calzature scolpite e volti cesellati).
import * as THREE from 'three';
import {
  chainmailBumpTex,
  evaChestTex,
  f1WheelTex,
  fabricWeaveBumpTex,
  grimoireTex,
  heraldryTex,
  missionFlagTex,
  quiltedBumpTex,
  type Palette,
} from './materials';
import { add, extrude, lathe, makeCogwheel, tube, type BuiltModel } from './models';


function withBump(base: THREE.Material, bump: THREE.Texture, bumpScale: number): THREE.Material {
  const m = (base as THREE.MeshStandardMaterial).clone();
  m.bumpMap = bump;
  m.bumpScale = bumpScale;
  return m;
}

export interface CharacterRig {
  body: THREE.Group;
  head: THREE.Group;
  armL: THREE.Group;
  armR: THREE.Group;
  legL: THREE.Group;
  legR: THREE.Group;
  cape?: THREE.Group;
  baseBodyY: number;
  restArmLX?: number;
  restArmRX?: number;
  restArmLZ?: number;
  restArmRZ?: number;
  restLegRotY?: number;
}

interface LoftSlice {
  y: number;
  rx: number;
  rz: number;
  ox?: number;
  oz?: number;
  // Scolpisce pettorali (+Z) con leggero solco sternale
  chest?: number;
  // Solco spinale posteriore (-Z)
  spine?: number;
  // Pieghe sinusoidali (drappeggio abiti, hakama, pieghe tuta)
  folds?: number;
  foldAmp?: number;
}

// Costruisce una geometria organica 3D continua (loft) con normali lisce rivolte verso l'esterno e UV pulite.
function buildLoft(slices: LoftSlice[], segs = 28, caps = true): THREE.BufferGeometry {
  const nRings = slices.length;
  const cols = segs + 1;
  const positions: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];

  const yMin = slices[0].y;
  const ySpan = Math.max(0.001, slices[nRings - 1].y - yMin);

  for (let r = 0; r < nRings; r++) {
    const sl = slices[r];
    const ox = sl.ox ?? 0;
    const oz = sl.oz ?? 0;
    const chest = sl.chest ?? 0;
    const spine = sl.spine ?? 0;
    const folds = sl.folds ?? 0;
    const foldAmp = sl.foldAmp ?? 0;
    const v = (sl.y - yMin) / ySpan;

    for (let s = 0; s <= segs; s++) {
      const u = s / segs;
      const th = u * Math.PI * 2;
      const ct = Math.cos(th);
      const st = Math.sin(th);

      let rx = sl.rx;
      let rz = sl.rz;
      if (folds > 0 && foldAmp !== 0) {
        const wave = 1 + foldAmp * Math.cos(th * folds);
        rx *= wave;
        rz *= wave;
      }

      let x = ox + rx * ct;
      let z = oz + rz * st;

      // Definizione anatomica pettorali (due rilievi simmetrici frontali con leggero incavo sternale centrale)
      if (chest > 0 && st > 0) {
        const pecs = Math.pow(st, 1.4) * (0.62 + 0.52 * Math.sin(Math.min(Math.PI, Math.abs(ct) * Math.PI * 1.15)));
        z += chest * pecs;
      }
      // Definizione solco dorsale / scapole sul retro (-Z)
      if (spine > 0 && st < 0) {
        const back = Math.pow(-st, 1.8);
        const groove = Math.exp(-ct * ct * 9);
        const scap = Math.exp(-Math.pow(Math.abs(ct) - 0.55, 2) * 14);
        z += spine * back * (groove * 0.65 - scap * 0.45);
      }

      positions.push(x, sl.y, z);
      uvs.push(u, v);
    }
  }

  for (let r = 0; r < nRings - 1; r++) {
    for (let s = 0; s < segs; s++) {
      const a = r * cols + s;
      const b = (r + 1) * cols + s;
      const c = (r + 1) * cols + (s + 1);
      const d = r * cols + (s + 1);
      indices.push(a, b, c, a, c, d);
    }
  }

  if (caps) {
    // Tappo inferiore (-Y)
    const first = slices[0];
    const bc = positions.length / 3;
    positions.push(first.ox ?? 0, first.y, first.oz ?? 0);
    uvs.push(0.5, 0);
    for (let s = 0; s < segs; s++) indices.push(bc, s, s + 1);

    // Tappo superiore (+Y)
    const last = slices[nRings - 1];
    const tc = positions.length / 3;
    const topStart = (nRings - 1) * cols;
    positions.push(last.ox ?? 0, last.y, last.oz ?? 0);
    uvs.push(0.5, 1);
    for (let s = 0; s < segs; s++) indices.push(tc, topStart + s + 1, topStart + s);
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return geo;
}

// Mantello aperto drappeggiato con pieghe scolpite vere (non un cilindro rigido!).
function buildDrapedCapeGeo(topW: number, botW: number, height: number, folds = 7): THREE.BufferGeometry {
  const rows = 10;
  const cols = 28;
  const positions: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];
  for (let r = 0; r <= rows; r++) {
    const t = r / rows; // 0 = spalle, 1 = orlo inferiore
    const y = -t * height;
    const arcSpan = Math.PI * (0.58 + t * 0.24);
    const radius = topW + (botW - topW) * Math.pow(t, 0.85);
    const sweepBack = t * t * 0.16;
    for (let c = 0; c <= cols; c++) {
      const u = c / cols;
      const a = Math.PI + (u - 0.5) * arcSpan;
      const foldDepth = Math.sin(u * Math.PI) * t * 0.038 * Math.cos(u * folds * Math.PI * 2);
      const rad = radius + foldDepth;
      const x = Math.sin(a) * rad;
      const z = Math.cos(a) * rad - sweepBack;
      positions.push(x, y, z);
      uvs.push(u, t);
    }
  }
  const stride = cols + 1;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const a = r * stride + c;
      const b = (r + 1) * stride + c;
      const d = r * stride + (c + 1);
      const e = (r + 1) * stride + (c + 1);
      indices.push(a, d, e, a, e, b);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return geo;
}

function addSculptedCape(body: THREE.Group, rig: CharacterRig, matMain: THREE.Material, matTrim: THREE.Material): void {
  const cape = new THREE.Group();
  cape.position.set(0, 0.49, -0.02);
  const clothMat = (matMain as THREE.MeshStandardMaterial).clone();
  clothMat.side = THREE.DoubleSide;
  const mesh = add(cape, buildDrapedCapeGeo(0.18, 0.36, 0.94, 6), clothMat, 0, 0, 0);
  mesh.castShadow = true;
  // Collare e fibbie dorate sulle clavicole
  tube(cape, [[-0.17, 0.01, 0.05], [-0.14, 0.02, -0.14], [0, 0.02, -0.19], [0.14, 0.02, -0.14], [0.17, 0.01, 0.05]], 0.022, matTrim, 20, 8);
  for (const s of [-1, 1]) {
    add(cape, new THREE.CylinderGeometry(0.028, 0.028, 0.018, 14), matTrim, s * 0.14, -0.01, 0.135, Math.PI / 2);
  }
  body.add(cape);
  rig.cape = cape;
}

// Mano anatomica scolpita con palmo, pollice opponibile e 4 dita piegate!
function makeSculptedHand(
  gloveMat: THREE.Material,
  side: number,
  knuckleMat?: THREE.Material,
): THREE.Group {
  const g = new THREE.Group();
  // Palmo sagomato
  add(g, new THREE.BoxGeometry(0.044, 0.068, 0.062), gloveMat, 0, -0.022, 0.01);
  if (knuckleMat) {
    add(g, new THREE.BoxGeometry(0.048, 0.02, 0.058), knuckleMat, side * 0.008, -0.048, 0.014);
  }
  // 4 dita scalate (indice, medio, anulare, mignolo) piegate a presa
  const lengths = [0.048, 0.054, 0.05, 0.04];
  for (let i = 0; i < 4; i++) {
    const fz = 0.032 - i * 0.018;
    const len = lengths[i];
    const finger = new THREE.Group();
    finger.position.set(side * 0.006, -0.052, fz);
    finger.rotation.z = -side * 0.65;
    add(finger, new THREE.CapsuleGeometry(0.0085, len * 0.55, 4, 8), gloveMat, 0, -len * 0.35, 0);
    // Falange distale curvata verso il palmo
    add(finger, new THREE.CapsuleGeometry(0.0075, len * 0.42, 4, 8), gloveMat, -side * 0.016, -len * 0.72, 0, 0, 0, -side * 0.8);
    g.add(finger);
  }
  // Pollice opponibile
  const thumb = new THREE.Group();
  thumb.position.set(-side * 0.018, -0.024, 0.036);
  thumb.rotation.set(0.55, 0, side * 0.42);
  add(thumb, new THREE.CapsuleGeometry(0.0095, 0.036, 4, 8), gloveMat, 0, -0.022, 0);
  g.add(thumb);
  return g;
}

// Calzatura / stivale anatomico scolpito (tacco, arco plantare, collo del piede, punta e suola!)
type BootStyle = 'racing' | 'sabaton' | 'waraji' | 'diver' | 'lunar' | 'tallBoot' | 'oxfordSpat' | 'baroque' | 'cyber' | 'pointed';

function makeSculptedBoot(
  bootMat: THREE.Material,
  soleMat: THREE.Material,
  trimMat: THREE.Material,
  style: BootStyle,
): THREE.Group {
  const g = new THREE.Group();
  // Il pivot del piede è alla caviglia (y = -0.56 rispetto all'anca -> suola esattamente a y = -0.66)
  // Suola con tacco scolpito e arco plantare!
  add(g, new THREE.BoxGeometry(0.118, 0.026, 0.145), soleMat, 0, -0.087, 0.075); // avampiede
  add(g, new THREE.BoxGeometry(0.106, 0.034, 0.088), soleMat, 0, -0.083, -0.055); // tacco
  add(g, new THREE.BoxGeometry(0.095, 0.016, 0.06), soleMat, 0, -0.082, 0.005); // arco

  // Tomaia / collo del piede sagomato + punta anatomica arrotondata
  const vamp = add(g, new THREE.CylinderGeometry(0.055, 0.06, 0.1, 16), bootMat, 0, -0.022, -0.01);
  vamp.scale.set(1.0, 1.0, 1.15);
  add(g, new THREE.BoxGeometry(0.108, 0.062, 0.165), bootMat, 0, -0.05, 0.038);
  const toe = add(g, new THREE.SphereGeometry(0.056, 16, 12), bootMat, 0, -0.052, 0.12);
  toe.scale.set(0.98, 0.62, 1.25);

  if (style === 'sabaton') {
    // Sabaton in piastre d'acciaio articolate (4 lamelle sovrapposte + sperone!)
    for (let i = 0; i < 4; i++) {
      add(g, new THREE.TorusGeometry(0.056 - i * 0.005, 0.012, 8, 16, Math.PI), trimMat, 0, -0.048 - i * 0.005, 0.02 + i * 0.034, -0.2);
    }
    add(g, new THREE.CylinderGeometry(0.008, 0.008, 0.07, 8), trimMat, 0, -0.055, -0.11, Math.PI / 2); // sperone
    add(g, new THREE.OctahedronGeometry(0.018, 0), trimMat, 0, -0.055, -0.145);
  } else if (style === 'diver') {
    // Scarpone da palombaro con punta massiccia in ottone, suola in piombo spessa e 2 cinghie!
    add(g, new THREE.BoxGeometry(0.132, 0.038, 0.27), soleMat, 0, -0.081, 0.035);
    const cap = add(g, new THREE.SphereGeometry(0.066, 16, 12), trimMat, 0, -0.046, 0.125);
    cap.scale.set(1.02, 0.72, 1.15);
    for (const sz of [0.01, 0.07]) add(g, new THREE.BoxGeometry(0.124, 0.02, 0.026), trimMat, 0, -0.024, sz);
  } else if (style === 'lunar') {
    // Stivale lunare Apollo con battistrada a 5 nervature profonde e puntale blu/accento
    for (let i = 0; i < 5; i++) {
      add(g, new THREE.BoxGeometry(0.128, 0.016, 0.022), trimMat, 0, -0.092, -0.07 + i * 0.052);
    }
    add(g, new THREE.TorusGeometry(0.068, 0.014, 8, 18), trimMat, 0, 0.015, 0, Math.PI / 2);
  } else if (style === 'tallBoot') {
    // Stivale da cavallerizza con cinturino caviglia + fibbia ottone + stringhe anteriori
    add(g, new THREE.TorusGeometry(0.062, 0.01, 8, 18), trimMat, 0, 0.005, 0, Math.PI / 2);
    add(g, new THREE.BoxGeometry(0.022, 0.026, 0.026), trimMat, 0.06, 0.005, 0.01);
    for (let i = 0; i < 3; i++) add(g, new THREE.BoxGeometry(0.058, 0.007, 0.008), trimMat, 0, -0.016 + i * 0.022, 0.065 - i * 0.006);
  } else if (style === 'oxfordSpat') {
    // Ghette vittoriane bianche con 4 bottoncini laterali sopra scarpe Oxford lucide!
    const spat = add(g, new THREE.CylinderGeometry(0.062, 0.068, 0.088, 18), trimMat, 0, -0.015, 0.005);
    spat.scale.set(1.02, 1, 1.25);
    for (let i = 0; i < 3; i++) {
      add(g, new THREE.SphereGeometry(0.007, 6, 6), bootMat, 0.066, -0.04 + i * 0.022, 0.01);
    }
  } else if (style === 'baroque') {
    // Scarpa barocca con fibbia rettangolare d'oro sulla linguetta e tacco rosso aristocratico!
    const redHeel = new THREE.MeshStandardMaterial({ color: 0xb91c1c, roughness: 0.35, metalness: 0.1 });
    add(g, new THREE.BoxGeometry(0.088, 0.044, 0.072), redHeel, 0, -0.078, -0.06);
    add(g, new THREE.BoxGeometry(0.074, 0.044, 0.016), trimMat, 0, -0.018, 0.075, -0.35);
    add(g, new THREE.BoxGeometry(0.048, 0.024, 0.02), bootMat, 0, -0.018, 0.078, -0.35);
  } else if (style === 'racing') {
    // Scarpetta F1 slim con fascia velcro sulla caviglia e protezione tallone
    add(g, new THREE.BoxGeometry(0.114, 0.022, 0.05), trimMat, 0, 0.0, 0.032);
    add(g, new THREE.BoxGeometry(0.112, 0.04, 0.028), trimMat, 0, -0.055, -0.09);
  } else if (style === 'cyber') {
    // Stivale mecha corazzato con punta divisa e luce tallone
    add(g, new THREE.BoxGeometry(0.016, 0.048, 0.09), soleMat, 0, -0.052, 0.135);
    add(g, new THREE.BoxGeometry(0.115, 0.022, 0.032), trimMat, 0, -0.055, -0.092);
  } else if (style === 'waraji') {
    // Sandalo corazzato giapponese con lacci incrociati dorati
    for (const sz of [-0.01, 0.055]) add(g, new THREE.BoxGeometry(0.118, 0.012, 0.018), trimMat, 0, -0.016, sz);
  }
  return g;
}

// Volto anatomico scolpito (cranio ovale, mascella e mento, zigomi, arcata sopracciliare, naso e orecchie!)
function makeSculptedHead(head: THREE.Group, skinMat: THREE.Material): void {
  // Collo anatomico con muscoli sternocleidomastoidei
  add(head, buildLoft([
    { y: -0.04, rx: 0.088, rz: 0.078, oz: -0.008 },
    { y: 0.02, rx: 0.068, rz: 0.066, oz: -0.004 },
    { y: 0.08, rx: 0.064, rz: 0.064, oz: 0 },
  ], 20, true), skinMat);

  // Cranio + mascella + mento scolpito con loft verticale
  add(head, buildLoft([
    { y: 0.045, rx: 0.048, rz: 0.056, oz: 0.042 }, // mento
    { y: 0.085, rx: 0.102, rz: 0.118, oz: 0.022 }, // linea mandibola
    { y: 0.135, rx: 0.128, rz: 0.138, oz: 0.01 },  // zigomi
    { y: 0.195, rx: 0.138, rz: 0.15, oz: -0.004 }, // arcata frontale
    { y: 0.265, rx: 0.142, rz: 0.154, oz: -0.012 },// calotta cranica
    { y: 0.315, rx: 0.105, rz: 0.115, oz: -0.012 },
    { y: 0.34, rx: 0.045, rz: 0.05, oz: -0.01 },
  ], 26, true), skinMat);

  // Naso scolpito con ponte nasale e punta + orecchie scolpite
  extrude(head, [[0, 0], [0.038, 0.008], [0.012, 0.062], [0, 0.062]], 0.024, 0.007, skinMat, 0, 0.135, 0.138, 0, -Math.PI / 2, 0);
  for (const s of [-1, 1]) {
    const ear = add(head, new THREE.SphereGeometry(0.028, 12, 10), skinMat, s * 0.138, 0.17, -0.01);
    ear.scale.set(0.45, 1.25, 0.8);
  }
}

interface HumanoidOpts {
  torsoMat: THREE.Material;
  pelvisMat?: THREE.Material;
  thighMat: THREE.Material;
  calfMat: THREE.Material;
  kneeMat?: THREE.Material;
  bootMat: THREE.Material;
  soleMat?: THREE.Material;
  bootTrim?: THREE.Material;
  bootStyle: BootStyle;
  upperArmMat: THREE.Material;
  forearmMat: THREE.Material;
  elbowMat?: THREE.Material;
  cuffMat?: THREE.Material;
  gloveMat: THREE.Material;
  knuckleMat?: THREE.Material;
  build: 'athletic' | 'armored' | 'bulky' | 'tailored' | 'cyber' | 'robed';
  hideLegs?: boolean;
  suitCreases?: boolean;
}

interface HumanoidParts {
  root: THREE.Group;
  rig: CharacterRig;
  handL: THREE.Group;
  handR: THREE.Group;
  backMount: THREE.Group;
}

// Crea un corpo umanoide ANATOMICAMENTE SCOLPITO (proporzioni eroiche 1:7, torso a V, cosce/polpacci/bicipiti/avambracci lofted, mani a 5 dita, stivali scolpiti).
function makeSculptedHumanoid(p: Palette, opts: HumanoidOpts): HumanoidParts {
  const root = new THREE.Group();
  const baseBodyY = 0.66;
  const body = new THREE.Group();
  body.position.set(0, baseBodyY, 0);
  root.add(body);

  const b = opts.build;
  const shoulderW = b === 'bulky' ? 0.285 : b === 'armored' ? 0.275 : b === 'cyber' ? 0.265 : 0.242;
  const hipX = b === 'bulky' ? 0.112 : 0.1;
  const limbScale = b === 'bulky' ? 1.24 : b === 'armored' ? 1.08 : b === 'tailored' ? 0.94 : 1.0;

  // --- TORSO ANATOMICO SCOLPITO (bacino -> vita stretta -> cassa toracica & pettorali -> clavicole & trapezio) ---
  if (b !== 'robed') {
    const k = b === 'bulky' ? 1.18 : b === 'armored' ? 1.08 : b === 'tailored' ? 0.96 : 1.0;
    const waistK = b === 'bulky' ? 1.14 : b === 'armored' ? 0.88 : b === 'cyber' ? 0.82 : 0.9;
    const creases = opts.suitCreases ? { folds: 5, foldAmp: 0.035 } : {};
    const torsoSlices: LoftSlice[] = [
      { y: -0.06, rx: 0.165 * k, rz: 0.118 * k, oz: -0.01 },                                   // base bacino/glutei
      { y: 0.02,  rx: 0.175 * k, rz: 0.126 * k, oz: -0.005, spine: 0.016 },                    // cresta iliaca
      { y: 0.14,  rx: 0.145 * waistK, rz: 0.106 * waistK, oz: 0.004, spine: 0.02, ...creases },// vita scolpita (V-taper!)
      { y: 0.25,  rx: 0.185 * k, rz: 0.128 * k, oz: 0.008, chest: 0.018, spine: 0.024 },       // cassa toracica bassa
      { y: 0.37,  rx: 0.222 * k, rz: 0.142 * k, oz: 0.012, chest: 0.032, spine: 0.028 },       // pettorali & dorsali!
      { y: 0.465, rx: 0.205 * k, rz: 0.118 * k, oz: 0.004, chest: 0.012, spine: 0.018 },       // clavicole / spalle
      { y: 0.525, rx: 0.125 * k, rz: 0.088 * k, oz: -0.006 },                                  // trapezio
      { y: 0.56,  rx: 0.075,     rz: 0.07,      oz: -0.006 },                                  // base collo
    ];
    add(body, buildLoft(torsoSlices, 32, true), opts.torsoMat);

    // Blocco pelvico scolpito (collega naturalmente l'attacco delle cosce senza vuoti!)
    const pelvis = add(body, buildLoft([
      { y: -0.105, rx: 0.062 * k, rz: 0.088 * k, oz: -0.005 },
      { y: -0.055, rx: 0.155 * k, rz: 0.116 * k, oz: -0.012 },
      { y: 0.015,  rx: 0.172 * k, rz: 0.124 * k, oz: -0.006 },
    ], 24, true), opts.pelvisMat ?? opts.torsoMat);
    pelvis.castShadow = true;
  }

  // --- GAMBE ANATOMICHE SCOLPITE (coscia muscolosa -> ginocchio -> polpaccio sagomato -> caviglia -> stivale) ---
  const legL = new THREE.Group();
  legL.position.set(-hipX, -0.02, 0);
  legL.rotation.y = 0.09; // leggera apertura eroica naturale dei piedi!
  const legR = new THREE.Group();
  legR.position.set(hipX, -0.02, 0);
  legR.rotation.y = -0.09;

  const soleM = opts.soleMat ?? p.rubber;
  const trimM = opts.bootTrim ?? p.brass;

  for (const [leg, s] of [[legL, -1], [legR, 1]] as [THREE.Group, number][]) {
    if (!opts.hideLegs) {
      // Coscia scolpita (più piena in alto e sul quadricipite, rastremata al ginocchio)
      const thighSlices: LoftSlice[] = [
        { y: -0.295, rx: 0.054 * limbScale, rz: 0.058 * limbScale, oz: 0.004 },
        { y: -0.21,  rx: 0.068 * limbScale, rz: 0.074 * limbScale, oz: 0.012 },
        { y: -0.1,   rx: 0.08 * limbScale,  rz: 0.086 * limbScale, oz: 0.006, ox: -s * 0.004 },
        { y: 0.01,   rx: 0.084 * limbScale, rz: 0.088 * limbScale, oz: -0.004 },
      ];
      add(leg, buildLoft(thighSlices, 22, true), opts.thighMat);

      // Articolazione ginocchio + rotula/ginocchiera scolpita
      add(leg, new THREE.SphereGeometry(0.056 * limbScale, 16, 12), opts.kneeMat ?? opts.thighMat, 0, -0.305, 0.012);

      // Polpaccio & tibia scolpiti (rigonfiamento muscolare posteriore gastrocnemio + caviglia snella!)
      const calfSlices: LoftSlice[] = [
        { y: -0.555, rx: 0.044 * limbScale, rz: 0.048 * limbScale, oz: 0.0 },    // caviglia
        { y: -0.47,  rx: 0.052 * limbScale, rz: 0.058 * limbScale, oz: -0.008 }, // tendine d'Achille
        { y: -0.385, rx: 0.064 * limbScale, rz: 0.072 * limbScale, oz: -0.014 }, // pancia del polpaccio!
        { y: -0.31,  rx: 0.056 * limbScale, rz: 0.06 * limbScale,  oz: -0.002 }, // sotto-ginocchio
      ];
      add(leg, buildLoft(calfSlices, 22, true), opts.calfMat);
    }

    // Stivale / calzatura scolpita con suola esattamente a y = -0.64 (mondo y = 0.00!)
    const boot = makeSculptedBoot(opts.bootMat, soleM, trimM, opts.bootStyle);
    boot.position.set(0, -0.54, 0);
    leg.add(boot);
  }
  body.add(legL, legR);

  // --- BRACCIA ANATOMICHE SCOLPITE (deltoide -> bicipite/tricipite -> gomito -> avambraccio rastremato -> mano a 5 dita) ---
  const armL = new THREE.Group();
  armL.position.set(-shoulderW, 0.455, 0);
  const armR = new THREE.Group();
  armR.position.set(shoulderW, 0.455, 0);

  const handL = new THREE.Group();
  const handR = new THREE.Group();

  const buildSculptedArm = (arm: THREE.Group, hand: THREE.Group, side: number) => {
    const aS = limbScale * (b === 'bulky' ? 0.96 : 1.0);
    // Deltoide arrotondato che si innesta nella spalla
    const delt = add(arm, new THREE.SphereGeometry(0.072 * aS, 16, 14), opts.upperArmMat, -side * 0.008, 0.005, 0);
    delt.scale.set(1.0, 1.12, 1.02);

    // Braccio superiore (bicipite/tricipite scolpiti con leggera inclinazione naturale)
    const upper = new THREE.Group();
    upper.rotation.set(-0.08, 0, side * 0.08);
    add(upper, buildLoft([
      { y: -0.225, rx: 0.046 * aS, rz: 0.05 * aS,  oz: 0 },      // gomito
      { y: -0.14,  rx: 0.058 * aS, rz: 0.065 * aS, oz: 0.006 },  // bicipite/tricipite
      { y: -0.05,  rx: 0.064 * aS, rz: 0.068 * aS, oz: 0.002 },  // inserzione deltoide
      { y: 0.02,   rx: 0.055 * aS, rz: 0.058 * aS, oz: 0 },
    ], 20, true), opts.upperArmMat);
    arm.add(upper);

    // Gomito articolato
    add(arm, new THREE.SphereGeometry(0.048 * aS, 14, 12), opts.elbowMat ?? opts.forearmMat, side * 0.02, -0.228, 0.015);

    // Avambraccio muscoloso rastremato verso il polso (leggermente flesso in avanti!)
    const fore = new THREE.Group();
    fore.position.set(side * 0.02, -0.228, 0.015);
    fore.rotation.set(-0.48, 0, -side * 0.06);
    add(fore, buildLoft([
      { y: -0.205, rx: 0.036 * aS, rz: 0.04 * aS },              // polso snello
      { y: -0.13,  rx: 0.044 * aS, rz: 0.048 * aS, oz: 0.003 },
      { y: -0.055, rx: 0.054 * aS, rz: 0.058 * aS, oz: 0.005 },  // brachioradiale
      { y: 0.01,   rx: 0.046 * aS, rz: 0.048 * aS },
    ], 20, true), opts.forearmMat);
    if (opts.cuffMat) {
      add(fore, new THREE.TorusGeometry(0.044 * aS, 0.013, 8, 18), opts.cuffMat, 0, -0.18, 0, Math.PI / 2);
    }
    arm.add(fore);

    // Mano scolpita a 5 dita posizionata esattamente al polso
    hand.position.set(0, -0.215, 0);
    hand.rotation.x = 0.48; // compensa la flessione così i prop sono dritti rispetto al mondo
    hand.add(makeSculptedHand(opts.gloveMat, side, opts.knuckleMat));
    fore.add(hand);
  };
  buildSculptedArm(armL, handL, -1);
  buildSculptedArm(armR, handR, 1);
  body.add(armL, armR);

  // Pivot testa + attacco schiena
  const head = new THREE.Group();
  head.position.set(0, 0.565, 0);
  body.add(head);

  const backMount = new THREE.Group();
  backMount.position.set(0, 0.31, -0.145);
  body.add(backMount);

  const rig: CharacterRig = {
    body, head, armL, armR, legL, legR,
    baseBodyY,
    restArmLZ: 0.06,
    restArmRZ: -0.06,
    restLegRotY: 0.09,
  };
  return { root, rig, handL, handR, backMount };
}

// ============================================================================
// I 10 PERSONAGGI ANATOMICI HD+ (v5)
// ============================================================================

// 21. PILOTA F1 (CORPO ATLETICO CON TUTA FIA TRAPUNTATA, FLEX PANELS & HANS)
function buildCharDriver(p: Palette): BuiltModel {
  const suitMat = withBump(p.paint, quiltedBumpTex(), 0.01);

  const h = makeSculptedHumanoid(p, {
    torsoMat: suitMat,
    thighMat: suitMat,
    calfMat: suitMat,
    kneeMat: p.darkMetal,
    bootMat: p.darkMetal,
    bootTrim: p.accent,
    bootStyle: 'racing',
    upperArmMat: suitMat,
    forearmMat: suitMat,
    elbowMat: p.darkMetal,
    cuffMat: p.white,
    gloveMat: p.white,
    knuckleMat: p.carbon,
    build: 'athletic',
  });
  const { body, head } = h.rig;

  // Pannelli racing bianchi/accento sagomati sul petto, cerniera centrale metallica con cursore e cuciture!
  add(body, new THREE.BoxGeometry(0.115, 0.43, 0.032), p.white, 0, 0.28, 0.148);
  add(body, new THREE.BoxGeometry(0.022, 0.44, 0.038), p.chrome, 0, 0.28, 0.152); // zip centrale
  add(body, new THREE.BoxGeometry(0.016, 0.036, 0.044), p.accent, 0, 0.47, 0.15); // cursore zip
  // Patch pettorali + cintura FIA ergonomica con fibbia in alluminio spazzolato
  add(body, new THREE.BoxGeometry(0.07, 0.035, 0.025), p.accent, -0.11, 0.37, 0.152, 0, -0.25);
  add(body, new THREE.BoxGeometry(0.07, 0.035, 0.025), p.white, 0.11, 0.37, 0.152, 0, 0.25);
  add(body, buildLoft([
    { y: 0.08, rx: 0.156, rz: 0.116, oz: 0.004 },
    { y: 0.15, rx: 0.152, rz: 0.112, oz: 0.004 },
  ], 24, false), p.darkMetal);
  add(body, new THREE.BoxGeometry(0.082, 0.062, 0.038), p.chrome, 0, 0.115, 0.125);
  // Bande racing verticali lungo le cosce e polpacci + inserti elasticizzati sulle ginocchia
  for (const [leg, s] of [[h.rig.legL, -1], [h.rig.legR, 1]] as [THREE.Group, number][]) {
    add(leg, new THREE.BoxGeometry(0.022, 0.24, 0.04), p.white, s * 0.074, -0.15, 0.005);
    add(leg, new THREE.BoxGeometry(0.018, 0.2, 0.034), p.accent, s * 0.062, -0.42, -0.005);
    for (let k = -1; k <= 1; k++) add(leg, new THREE.TorusGeometry(0.058, 0.007, 6, 14, Math.PI), p.darkMetal, 0, -0.305 + k * 0.016, 0.012);
  }
  // Spalline estrazione pilota + dispositivo HANS in carbonio anatomico sulle clavicole
  for (const s of [-1, 1]) {
    add(body, new THREE.BoxGeometry(0.085, 0.022, 0.058), p.white, s * 0.17, 0.49, 0.008, 0, 0, -s * 0.22);
    tube(body, [[s * 0.09, 0.53, -0.08], [s * 0.115, 0.515, 0.05], [s * 0.09, 0.35, 0.158]], 0.02, p.carbon, 14, 8);
  }
  tube(body, [[-0.09, 0.54, -0.08], [0, 0.58, -0.13], [0.09, 0.54, -0.08]], 0.024, p.carbon, 14, 8);

  // Casco integrale F1 in carbonio/vernice con visiera iridescente, spoiler posteriore e prese d'aria
  add(head, new THREE.CylinderGeometry(0.068, 0.08, 0.085, 18), p.darkMetal, 0, 0.01, 0);
  const helm = add(head, new THREE.SphereGeometry(0.185, 28, 22), p.paint, 0, 0.18, 0.01);
  helm.scale.set(0.94, 1.0, 1.08);
  add(head, new THREE.BoxGeometry(0.2, 0.1, 0.135), p.paint, 0, 0.105, 0.125);
  add(head, new THREE.BoxGeometry(0.11, 0.042, 0.028), p.carbon, 0, 0.095, 0.195);
  add(head, new THREE.BoxGeometry(0.195, 0.032, 0.075), p.carbon, 0, 0.23, -0.165, 0.35);
  add(head, new THREE.TorusGeometry(0.182, 0.013, 8, 28), p.accent, 0, 0.21, 0.01, Math.PI / 2);
  for (const s of [-1, 1]) {
    add(head, new THREE.BoxGeometry(0.034, 0.022, 0.07), p.white, s * 0.055, 0.355, 0.04, 0.25);
    add(head, new THREE.CylinderGeometry(0.024, 0.024, 0.02, 14), p.chrome, s * 0.175, 0.19, 0.04, 0, 0, Math.PI / 2);
  }
  add(head, new THREE.CylinderGeometry(0.182, 0.18, 0.088, 26, 1, false, -0.95, 1.9), p.lensGlass, 0, 0.195, 0.032);
  add(head, new THREE.CylinderGeometry(0.185, 0.185, 0.022, 26, 1, false, -0.92, 1.84), p.accent, 0, 0.232, 0.032);

  // Mano sinistra: VOLANTE F1 A FARFALLA HD
  const wheelGrp = new THREE.Group();
  wheelGrp.position.set(0.02, -0.02, 0.055);
  wheelGrp.rotation.set(-0.25, 0.3, 0.18);
  add(wheelGrp, new THREE.BoxGeometry(0.24, 0.13, 0.026), p.carbon);
  for (const s of [-1, 1]) add(wheelGrp, new THREE.CapsuleGeometry(0.022, 0.085, 6, 10), p.rubber, s * 0.125, 0, 0);
  const hudMat = new THREE.MeshStandardMaterial({ map: f1WheelTex(), emissiveMap: f1WheelTex(), emissive: new THREE.Color(0xffffff), emissiveIntensity: 0.45, roughness: 0.2 });
  add(wheelGrp, new THREE.PlaneGeometry(0.21, 0.105), hudMat, 0, 0, 0.015);
  h.handL.add(wheelGrp);

  // Mano destra alzata: COPPA GRAN PREMIO IN ORO 24K
  h.rig.restArmRX = -0.62;
  h.rig.armR.rotation.x = -0.62;
  const cup = new THREE.Group();
  cup.position.set(0.01, -0.01, 0.03);
  cup.rotation.x = 0.62;
  add(cup, new THREE.CylinderGeometry(0.058, 0.07, 0.052, 16), p.darkMetal, 0, 0, 0);
  lathe(cup, [
    [0, 0.026], [0.044, 0.026], [0.022, 0.08], [0.02, 0.14], [0.074, 0.2], [0.104, 0.33], [0.114, 0.35], [0.094, 0.35], [0.068, 0.22], [0, 0.2],
  ], p.brass, 24);
  for (const s of [-1, 1]) tube(cup, [[s * 0.094, 0.32, 0], [s * 0.152, 0.28, 0], [s * 0.132, 0.2, 0], [s * 0.064, 0.18, 0]], 0.011, p.brass, 12, 6);
  h.handR.add(cup);

  return { group: h.root, anim: { charRig: h.rig } };
}

// 22. CAVALIERE PALADINO (ARMATURA GOTICA ANATOMICA A PIASTRE SCANALATE & COTTA DI MAGLIA)
function buildCharKnight(p: Palette, primaryHex: string, accentHex: string): BuiltModel {
  const mailMat = withBump(p.custom(0x525a66, 0.42, 0.88), chainmailBumpTex(), 0.022);

  const h = makeSculptedHumanoid(p, {
    torsoMat: p.chrome,
    pelvisMat: mailMat,
    thighMat: p.brushed,
    calfMat: p.chrome,
    kneeMat: p.chrome,
    bootMat: p.chrome,
    bootTrim: p.brass,
    bootStyle: 'sabaton',
    upperArmMat: p.brushed,
    forearmMat: p.chrome,
    elbowMat: p.chrome,
    cuffMat: p.brass,
    gloveMat: p.chrome,
    knuckleMat: p.brass,
    build: 'armored',
  });
  const { body, head, armL, armR, legL, legR } = h.rig;

  // Corazza gotica a vita stretta (cuirass) con carena centrale, nervature a ventaglio e bordature in ottone!
  add(body, buildLoft([
    { y: 0.08, rx: 0.152, rz: 0.118, oz: 0.008 },
    { y: 0.15, rx: 0.144, rz: 0.112, oz: 0.01 },
    { y: 0.28, rx: 0.21,  rz: 0.165, oz: 0.022, chest: 0.036, spine: 0.028 },
    { y: 0.41, rx: 0.242, rz: 0.172, oz: 0.018, chest: 0.038, spine: 0.026 },
    { y: 0.49, rx: 0.195, rz: 0.125, oz: 0.004 },
  ], 32, true), p.chrome);
  // Carena verticale dorata sul petto + 2 nervature gotiche oblique + gorgiera a piastre
  add(body, new THREE.BoxGeometry(0.022, 0.35, 0.045), p.brass, 0, 0.31, 0.195);
  for (const s of [-1, 1]) {
    tube(body, [[0, 0.2, 0.19], [s * 0.12, 0.34, 0.19], [s * 0.18, 0.44, 0.11]], 0.01, p.brass, 12, 6);
  }
  add(body, new THREE.TorusGeometry(0.125, 0.022, 10, 24), p.brass, 0, 0.51, 0, Math.PI / 2);

  // Falda gotica (faulds) a 3 lamelle ellittiche + 2 scarselle (tassets) laterali sopra gonna in cotta di maglia!
  add(body, buildLoft([
    { y: -0.22, rx: 0.22, rz: 0.165, folds: 10, foldAmp: 0.03 },
    { y: 0.02,  rx: 0.178, rz: 0.135 },
  ], 28, false), mailMat);
  for (let i = 0; i < 3; i++) {
    add(body, buildLoft([
      { y: 0.04 - i * 0.05, rx: 0.172 + i * 0.016, rz: 0.132 + i * 0.012 },
      { y: 0.08 - i * 0.05, rx: 0.162 + i * 0.016, rz: 0.124 + i * 0.012 },
    ], 24, false), i % 2 === 0 ? p.chrome : p.brushed);
  }
  // Cintura in pelle con borchie + scarselle sulle cosce + tabarro araldico frontale
  add(body, buildLoft([{ y: 0.075, rx: 0.162, rz: 0.126 }, { y: 0.125, rx: 0.16, rz: 0.124 }], 24, false), p.leather);
  add(body, new THREE.BoxGeometry(0.07, 0.068, 0.035), p.brass, 0, 0.1, 0.132);
  add(body, new THREE.BoxGeometry(0.155, 0.38, 0.022), p.paint, 0, -0.15, 0.175, -0.08);
  add(body, new THREE.BoxGeometry(0.168, 0.024, 0.028), p.brass, 0, -0.33, 0.19);

  // Spallacci gotici a 3 lamelle + cubitiere (couters) alate sui gomiti + ginocchiere alate (poleyns)!
  for (const [arm, s] of [[armL, -1], [armR, 1]] as [THREE.Group, number][]) {
    for (let k = 0; k < 3; k++) {
      const pauldron = add(arm, new THREE.SphereGeometry(0.118 - k * 0.012, 18, 12, 0, Math.PI * 2, 0, Math.PI * 0.56), k === 0 ? p.chrome : p.brushed, s * 0.02, 0.04 - k * 0.042, 0, 0, 0, -s * 0.36);
      pauldron.scale.set(1.12, 0.8, 1.08);
    }
    add(arm, new THREE.TorusGeometry(0.112, 0.012, 8, 18), p.brass, s * 0.02, 0.015, 0, Math.PI / 2, -s * 0.36);
    // Cubitiera alata gotica sul gomito
    add(arm, new THREE.ConeGeometry(0.048, 0.075, 6), p.brass, s * 0.055, -0.228, -0.01, 0, 0, -s * Math.PI / 2);
  }
  for (const [leg, s] of [[legL, -1], [legR, 1]] as [THREE.Group, number][]) {
    // Scarsella sulla coscia + ginocchiera (poleyn) con aletta laterale dorata + schiniere con cresta
    add(leg, new THREE.BoxGeometry(0.125, 0.14, 0.032), p.chrome, 0, -0.07, 0.09, -0.15);
    add(leg, new THREE.ConeGeometry(0.055, 0.06, 6), p.brass, 0, -0.305, 0.068, Math.PI / 2);
    add(leg, new THREE.CylinderGeometry(0.048, 0.048, 0.018, 12), p.brass, s * 0.066, -0.305, 0.01, 0, 0, Math.PI / 2);
    add(leg, new THREE.BoxGeometry(0.016, 0.21, 0.028), p.brass, 0, -0.43, 0.068);
  }

  // Mantello reale drappeggiato a pieghe scolpite!
  addSculptedCape(body, h.rig, p.paint, p.brass);

  // Elmo Armet gotico con visiera acuminata, cresta in ottone e pennacchio
  add(head, new THREE.CylinderGeometry(0.088, 0.11, 0.09, 18), mailMat, 0, 0.0, 0);
  add(head, new THREE.SphereGeometry(0.168, 26, 20), p.chrome, 0, 0.185, 0);
  extrude(head, [[0, -0.085], [0.155, -0.02], [0.115, 0.07], [0, 0.088]], 0.23, 0.018, p.brushed, 0, 0.165, 0.075, 0, -Math.PI / 2, 0);
  add(head, new THREE.BoxGeometry(0.21, 0.02, 0.06), p.darkMetal, 0, 0.21, 0.198);
  add(head, new THREE.BoxGeometry(0.02, 0.165, 0.04), p.brass, 0, 0.16, 0.208);
  for (const s of [-1, 1]) {
    for (let k = 0; k < 3; k++) add(head, new THREE.SphereGeometry(0.0085, 6, 6), p.darkMetal, s * (0.042 + k * 0.022), 0.13 - k * 0.01, 0.208 - k * 0.012);
  }
  add(head, new THREE.TorusGeometry(0.172, 0.016, 8, 24, Math.PI), p.brass, 0, 0.195, 0, 0, Math.PI / 2);
  tube(head, [[0, 0.37, 0.02], [0, 0.45, -0.14], [0, 0.36, -0.28], [0, 0.17, -0.34]], 0.04, p.paint, 18, 10);
  tube(head, [[0, 0.37, 0.02], [0, 0.48, -0.16], [0, 0.39, -0.31]], 0.022, p.accent, 14, 8);

  // Scudo araldico gotico + spada lunga con sguscio
  const shield = new THREE.Group();
  shield.position.set(-0.04, -0.02, 0.05);
  shield.rotation.set(0.1, -0.35, 0);
  extrude(shield, [
    [-0.195, 0.255], [0.195, 0.255], [0.195, -0.02], [0.115, -0.2], [0, -0.315], [-0.115, -0.2], [-0.195, -0.02],
  ], 0.036, 0.012, p.brass);
  const crestMat = new THREE.MeshStandardMaterial({ map: heraldryTex(primaryHex, accentHex), roughness: 0.35, metalness: 0.2 });
  add(shield, new THREE.BoxGeometry(0.33, 0.41, 0.015), crestMat, 0, 0.03, 0.024);
  add(shield, new THREE.SphereGeometry(0.044, 14, 12), p.brass, 0, 0.03, 0.042);
  h.handL.add(shield);

  const sword = new THREE.Group();
  sword.position.set(0.01, -0.02, 0.01);
  sword.rotation.set(0.32, 0, -0.1);
  add(sword, new THREE.CylinderGeometry(0.018, 0.02, 0.22, 12), p.leather, 0, -0.02, 0);
  add(sword, new THREE.OctahedronGeometry(0.04, 0), p.brass, 0, -0.14, 0);
  add(sword, new THREE.BoxGeometry(0.28, 0.03, 0.04), p.brass, 0, 0.095, 0);
  add(sword, new THREE.BoxGeometry(0.06, 0.72, 0.016), p.chrome, 0, 0.46, 0);
  add(sword, new THREE.BoxGeometry(0.016, 0.64, 0.021), p.darkMetal, 0, 0.45, 0);
  add(sword, new THREE.ConeGeometry(0.04, 0.14, 4), p.chrome, 0, 0.89, 0, 0, Math.PI / 4);
  h.handR.add(sword);

  return { group: h.root, anim: { charRig: h.rig } };
}

// 23. SAMURAI SHOGUN (CORAZZA Ō-YOROI LAMELLARE, HAKAMA PIEGHETTATI & SUNEATE)
function buildCharSamurai(p: Palette): BuiltModel {
  const clothDark = withBump(p.custom(0x1e2430, 0.75, 0.06), fabricWeaveBumpTex(), 0.012);
  const h = makeSculptedHumanoid(p, {
    torsoMat: p.paint,
    pelvisMat: clothDark,
    thighMat: clothDark,
    calfMat: p.darkMetal,
    kneeMat: p.paint,
    bootMat: p.leather,
    bootTrim: p.brass,
    bootStyle: 'waraji',
    upperArmMat: clothDark,
    forearmMat: p.darkMetal,
    elbowMat: p.brass,
    cuffMat: p.brass,
    gloveMat: p.leather,
    knuckleMat: p.brass,
    build: 'armored',
  });
  const { body, head, armL, armR, legL, legR } = h.rig;

  // 5 fasce lamellari orizzontali con cordini Odoshi dorati + pettorina Munaita + nodo cerimoniale Agemaki sul retro!
  for (let i = 0; i < 5; i++) {
    const y = 0.13 + i * 0.072;
    const rx = 0.168 + i * 0.015;
    const rz = 0.125 + i * 0.008;
    add(body, buildLoft([{ y: y - 0.012, rx: rx + 0.004, rz: rz + 0.004 }, { y: y + 0.012, rx, rz }], 26, false), p.brass);
  }
  // Piastre frontali Sendan-no-ita e Kyūbi-no-ita sul petto
  add(body, new THREE.BoxGeometry(0.085, 0.16, 0.028), p.paint, -0.11, 0.38, 0.162, 0, -0.25);
  add(body, new THREE.BoxGeometry(0.085, 0.16, 0.028), p.brass, 0.11, 0.38, 0.162, 0, 0.25);
  // Nodo cerimoniale Agemaki rosso/oro sulla schiena
  add(body, new THREE.TorusGeometry(0.06, 0.016, 8, 16), p.accent, -0.055, 0.34, -0.165);
  add(body, new THREE.TorusGeometry(0.06, 0.016, 8, 16), p.accent, 0.055, 0.34, -0.165);
  tube(body, [[-0.03, 0.32, -0.17], [-0.05, 0.12, -0.19]], 0.014, p.accent, 8, 6);
  tube(body, [[0.03, 0.32, -0.17], [0.05, 0.12, -0.19]], 0.014, p.accent, 8, 6);

  // Fascia Obi in seta con fiocco + 6 gonnelle lamellari Kusazuri scolpite
  add(body, buildLoft([{ y: 0.05, rx: 0.178, rz: 0.136 }, { y: 0.125, rx: 0.174, rz: 0.132 }], 26, false), p.accent);
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2 + Math.PI / 6;
    const plate = new THREE.Group();
    plate.rotation.y = a;
    for (let r = 0; r < 3; r++) {
      add(plate, new THREE.BoxGeometry(0.16, 0.066, 0.026), r % 2 === 0 ? p.paint : p.darkMetal, 0, -0.01 - r * 0.072, 0.175 + r * 0.016, -0.14);
      add(plate, new THREE.BoxGeometry(0.164, 0.01, 0.03), p.brass, 0, -0.042 - r * 0.072, 0.178 + r * 0.016, -0.14);
    }
    body.add(plate);
  }

  // Pantaloni Hakama pieghettati sulle cosce + schinieri Suneate a stecche verticali con ginocchiere Tateage!
  for (const leg of [legL, legR]) {
    add(leg, buildLoft([
      { y: -0.32, rx: 0.092, rz: 0.095, folds: 7, foldAmp: 0.09 },
      { y: -0.16, rx: 0.102, rz: 0.105, folds: 7, foldAmp: 0.07 },
      { y: 0.0,   rx: 0.092, rz: 0.095, folds: 7, foldAmp: 0.04 },
    ], 26, false), clothDark);
    // Ginocchiera Tateage + 5 stecche verticali metalliche Suneate sullo stinco
    add(leg, new THREE.BoxGeometry(0.095, 0.1, 0.032), p.paint, 0, -0.305, 0.062);
    for (let k = -2; k <= 2; k++) {
      const a = k * 0.35;
      add(leg, new THREE.BoxGeometry(0.018, 0.21, 0.016), p.chrome, Math.sin(a) * 0.065, -0.435, Math.cos(a) * 0.068, 0, a, 0);
    }
  }

  // Spallacci Sode a 4 lamelle + parabraccia Kote a stecche verticali
  for (const [arm, s] of [[armL, -1], [armR, 1]] as [THREE.Group, number][]) {
    for (let k = 0; k < 4; k++) {
      add(arm, new THREE.BoxGeometry(0.03, 0.066, 0.205), k === 0 ? p.brass : p.paint, s * (0.095 + k * 0.006), 0.04 - k * 0.058, 0, 0, 0, -s * 0.16);
    }
  }
  // Wakizashi infilato nell'Obi sul lato sinistro
  add(body, new THREE.CylinderGeometry(0.02, 0.017, 0.44, 10), p.darkMetal, -0.18, 0.05, 0.07, 1.35, 0.25, 0.2);
  add(body, new THREE.CylinderGeometry(0.036, 0.036, 0.014, 14), p.brass, -0.15, 0.09, 0.25, 1.35, 0.25, 0.2);

  // Elmo Kabuto con Menpō, Shikoro e corna Kuwagata
  add(head, new THREE.SphereGeometry(0.16, 22, 16), p.darkMetal, 0, 0.165, 0);
  add(head, new THREE.BoxGeometry(0.19, 0.105, 0.115), p.darkMetal, 0, 0.105, 0.105);
  add(head, new THREE.BoxGeometry(0.105, 0.02, 0.028), p.brass, 0, 0.1, 0.168);
  for (const s of [-1, 1]) add(head, new THREE.SphereGeometry(0.017, 8, 8), p.glow, s * 0.052, 0.17, 0.148);
  add(head, new THREE.SphereGeometry(0.198, 24, 16, 0, Math.PI * 2, 0, Math.PI * 0.56), p.paint, 0, 0.195, 0);
  add(head, new THREE.CylinderGeometry(0.034, 0.048, 0.04, 12), p.brass, 0, 0.398, 0);
  for (let k = 0; k < 3; k++) {
    add(head, new THREE.CylinderGeometry(0.208 + k * 0.022, 0.224 + k * 0.022, 0.046, 20, 1, true, Math.PI * 0.45, Math.PI * 1.1), k % 2 === 0 ? p.paint : p.darkMetal, 0, 0.185 - k * 0.046, -0.01);
  }
  add(head, new THREE.CylinderGeometry(0.066, 0.066, 0.024, 20), p.brass, 0, 0.345, 0.175, Math.PI / 2);
  add(head, new THREE.CylinderGeometry(0.04, 0.04, 0.028, 18), p.redGlow, 0, 0.345, 0.177, Math.PI / 2);
  for (const s of [-1, 1]) {
    tube(head, [[s * 0.028, 0.315, 0.17], [s * 0.175, 0.405, 0.165], [s * 0.285, 0.565, 0.135], [s * 0.235, 0.66, 0.115]], 0.021, p.brass, 16, 8);
  }

  // Katana curva + ventaglio Tessen
  const katana = new THREE.Group();
  katana.position.set(0.01, -0.02, 0.02);
  katana.rotation.set(0.42, 0.08, -0.12);
  add(katana, new THREE.CylinderGeometry(0.018, 0.02, 0.25, 12), p.leather, 0, -0.04, 0);
  for (let i = 0; i < 6; i++) add(katana, new THREE.TorusGeometry(0.021, 0.005, 6, 10), p.accent, 0, -0.14 + i * 0.04, 0, Math.PI / 2);
  add(katana, new THREE.CylinderGeometry(0.05, 0.05, 0.014, 18), p.brass, 0, 0.095, 0);
  const bladeCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0, 0.1, 0), new THREE.Vector3(0, 0.42, 0.015), new THREE.Vector3(0, 0.74, 0.065), new THREE.Vector3(0, 0.96, 0.13),
  ]);
  const bladeGeo = new THREE.TubeGeometry(bladeCurve, 22, 0.018, 6, false);
  bladeGeo.scale(0.35, 1, 1.5);
  add(katana, bladeGeo, p.chrome);
  h.handR.add(katana);

  const fan = new THREE.Group();
  fan.position.set(-0.01, -0.01, 0.04);
  fan.rotation.set(-0.3, 0.4, 0.25);
  add(fan, new THREE.CylinderGeometry(0.012, 0.014, 0.12, 8), p.brass, 0, -0.04, 0);
  add(fan, new THREE.CylinderGeometry(0.175, 0.175, 0.014, 16, 1, false, -0.85, 1.7), p.paint, 0, 0.02, 0, Math.PI / 2);
  add(fan, new THREE.CylinderGeometry(0.185, 0.185, 0.01, 16, 1, false, -0.85, 1.7), p.brass, 0, 0.02, 0, Math.PI / 2);
  h.handL.add(fan);

  return { group: h.root, anim: { charRig: h.rig } };
}

// 24. PALOMBARO MARK V (PIEGE TELA VULCANIZZATA, IMBRACATURA IN CUOIO, 8 ZAVORRE & SCARPONI IN PIOMBO)
function buildCharDiver(p: Palette): BuiltModel {
  const canvasMat = withBump(p.custom(0xc8b89a, 0.84, 0.03), fabricWeaveBumpTex(), 0.02);

  const h = makeSculptedHumanoid(p, {
    torsoMat: canvasMat,
    pelvisMat: canvasMat,
    thighMat: canvasMat,
    calfMat: canvasMat,
    kneeMat: p.leather,
    bootMat: p.leather,
    soleMat: p.darkMetal,
    bootTrim: p.brass,
    bootStyle: 'diver',
    upperArmMat: canvasMat,
    forearmMat: canvasMat,
    elbowMat: p.leather,
    cuffMat: p.brass,
    gloveMat: p.rubber,
    build: 'bulky',
    suitCreases: true,
  });
  const { body, head } = h.rig;
  const { backMount } = h;

  // Imbracatura incrociata pesante in cuoio sul petto e sulla schiena + cinghia sottocoscia + anelli D-ring in ottone!
  for (const s of [-1, 1]) {
    tube(body, [[s * 0.14, 0.44, 0.15], [s * 0.09, 0.25, 0.175], [s * 0.12, 0.09, 0.15]], 0.02, p.leather, 12, 8);
    tube(body, [[s * 0.14, 0.44, -0.15], [s * 0.09, 0.25, -0.175], [s * 0.12, 0.09, -0.15]], 0.02, p.leather, 12, 8);
    add(body, new THREE.TorusGeometry(0.026, 0.007, 6, 14), p.brass, s * 0.105, 0.26, 0.19);
    // Ginocchiere di rinforzo in cuoio con fibbie laterali
    add(s < 0 ? h.rig.legL : h.rig.legR, new THREE.BoxGeometry(0.11, 0.115, 0.04), p.leather, 0, -0.305, 0.085);
  }
  // Cintura zavorra con 8 blocchi di piombo individuali rivettati + fibbia centrale
  add(body, buildLoft([{ y: 0.06, rx: 0.215, rz: 0.168 }, { y: 0.135, rx: 0.21, rz: 0.162 }], 26, false), p.leather);
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2 + 0.2;
    add(body, new THREE.BoxGeometry(0.072, 0.085, 0.042), p.darkMetal, Math.cos(a) * 0.218, 0.1, Math.sin(a) * 0.172, 0, -a + Math.PI / 2, 0);
  }
  // Corsaletto anatomico Mark V a 12 bulloni a farfalla che abbraccia le spalle
  add(body, buildLoft([
    { y: 0.38, rx: 0.268, rz: 0.195, oz: 0.005 },
    { y: 0.46, rx: 0.245, rz: 0.185, oz: 0.004 },
    { y: 0.54, rx: 0.185, rz: 0.165, oz: 0 },
  ], 28, true), p.paint);
  add(body, new THREE.TorusGeometry(0.182, 0.018, 8, 26), p.brass, 0, 0.545, 0, Math.PI / 2);
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    add(body, new THREE.SphereGeometry(0.014, 8, 8), p.brass, Math.cos(a) * 0.258, 0.405, Math.sin(a) * 0.19);
  }
  // Pugnale subacqueo con fodero in ottone sulla coscia sinistra
  add(h.rig.legL, new THREE.CylinderGeometry(0.025, 0.018, 0.24, 12), p.brass, -0.108, -0.16, 0.02);
  add(h.rig.legL, new THREE.TorusGeometry(0.098, 0.01, 6, 16), p.leather, 0, -0.14, 0, Math.PI / 2);

  // Doppia bombola d'aria in ottone sulla schiena con valvole e tubi aria verso l'elmo
  for (const s of [-1, 1]) {
    add(backMount, new THREE.CylinderGeometry(0.082, 0.082, 0.44, 18), p.brass, s * 0.095, -0.02, -0.11);
    add(backMount, new THREE.SphereGeometry(0.082, 16, 12), p.brass, s * 0.095, 0.2, -0.11);
    add(backMount, new THREE.CylinderGeometry(0.024, 0.028, 0.06, 10), p.chrome, s * 0.095, 0.29, -0.11);
    tube(body, [[s * 0.095, 0.59, -0.25], [s * 0.16, 0.71, -0.22], [s * 0.12, 0.74, -0.1]], 0.02, p.rubber, 16, 8);
  }
  add(backMount, new THREE.BoxGeometry(0.28, 0.04, 0.04), p.leather, 0, 0.09, -0.19);
  add(backMount, new THREE.BoxGeometry(0.28, 0.04, 0.04), p.leather, 0, -0.12, -0.19);

  // Elmo Mark V in ottone a 4 oblò vetrati con griglie a croce
  add(head, new THREE.SphereGeometry(0.222, 30, 22), p.brass, 0, 0.195, 0);
  add(head, new THREE.CylinderGeometry(0.178, 0.192, 0.065, 24), p.brass, 0, 0.015, 0);
  const ports: [number, number, number, number, number, number, number][] = [
    [0, 0.205, 0.202, 0, 0, 0, 0.095],
    [-0.202, 0.205, 0.02, 0, -Math.PI / 2, 0, 0.072],
    [0.202, 0.205, 0.02, 0, Math.PI / 2, 0, 0.072],
    [0, 0.37, 0.102, -0.95, 0, 0, 0.064],
  ];
  for (const [px, py, pz, rx, ry, rz, pr] of ports) {
    const port = new THREE.Group();
    port.position.set(px, py, pz);
    port.rotation.set(rx, ry, rz);
    add(port, new THREE.TorusGeometry(pr, 0.018, 10, 22), p.chrome);
    add(port, new THREE.CircleGeometry(pr * 0.9, 20), p.lensGlass, 0, 0, 0.008);
    add(port, new THREE.BoxGeometry(pr * 1.9, 0.014, 0.018), p.brass, 0, 0, 0.016);
    add(port, new THREE.BoxGeometry(0.014, pr * 1.9, 0.018), p.brass, 0, 0, 0.016);
    head.add(port);
  }
  add(head, new THREE.CylinderGeometry(0.032, 0.036, 0.055, 14), p.chrome, 0.17, 0.095, 0.14, 0, 0, -0.7);

  // Lanterna accesa pulsante + tridente da recupero
  const pulse: THREE.Mesh[] = [];
  const lantern = new THREE.Group();
  lantern.position.set(0.01, -0.15, 0.05);
  add(lantern, new THREE.TorusGeometry(0.044, 0.01, 8, 16), p.brass, 0, 0.15, 0);
  add(lantern, new THREE.CylinderGeometry(0.074, 0.092, 0.048, 16), p.brass, 0, 0.11, 0);
  add(lantern, new THREE.CylinderGeometry(0.086, 0.092, 0.048, 16), p.brass, 0, -0.11, 0);
  add(lantern, new THREE.CylinderGeometry(0.07, 0.07, 0.17, 18), p.glass, 0, 0, 0);
  const bulb = add(lantern, new THREE.SphereGeometry(0.046, 14, 12), p.glow, 0, 0, 0);
  pulse.push(bulb);
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    add(lantern, new THREE.CylinderGeometry(0.007, 0.007, 0.21, 6), p.brass, Math.cos(a) * 0.08, 0, Math.sin(a) * 0.08);
  }
  h.handR.add(lantern);

  const trident = new THREE.Group();
  trident.position.set(-0.01, -0.02, 0.01);
  trident.rotation.x = 0.2;
  add(trident, new THREE.CylinderGeometry(0.018, 0.02, 0.98, 12), p.brass, 0, 0.28, 0);
  add(trident, new THREE.BoxGeometry(0.22, 0.024, 0.024), p.brass, 0, 0.77, 0);
  for (const tx of [-0.1, 0, 0.1]) {
    add(trident, new THREE.CylinderGeometry(0.01, 0.012, 0.18 + (tx === 0 ? 0.06 : 0), 8), p.chrome, tx, 0.86 + (tx === 0 ? 0.03 : 0), 0);
    add(trident, new THREE.ConeGeometry(0.022, 0.075, 6), p.chrome, tx, 0.97 + (tx === 0 ? 0.06 : 0), 0);
  }
  h.handL.add(trident);

  return { group: h.root, anim: { charRig: h.rig, pulse } };
}

// 25. ASTRONAUTA EVA (GUSCIO HUT, CUSCINETTI SPALLA, GIUNTI A SOFFIETTO & TUBI OMBELICALI)
function buildCharAstronaut(p: Palette, primaryHex: string, accentHex: string): BuiltModel {
  const suitWhite = withBump(p.white, fabricWeaveBumpTex(), 0.009);

  const h = makeSculptedHumanoid(p, {
    torsoMat: suitWhite,
    pelvisMat: suitWhite,
    thighMat: suitWhite,
    calfMat: suitWhite,
    kneeMat: p.brushed,
    bootMat: p.brushed,
    bootTrim: p.paint,
    bootStyle: 'lunar',
    upperArmMat: suitWhite,
    forearmMat: suitWhite,
    elbowMat: p.brushed,
    cuffMat: p.paint,
    gloveMat: p.brushed,
    knuckleMat: p.paint,
    build: 'bulky',
  });
  const { body, head, armL, armR, legL, legR } = h.rig;
  const { backMount } = h;

  // Anello metallico rotante in vita + CUSCINETTI SCYE INCLINATI ALLE SPALLE + soffietti su gomiti e ginocchia!
  add(body, new THREE.TorusGeometry(0.195, 0.018, 10, 28), p.chrome, 0, 0.11, 0, Math.PI / 2);
  add(body, new THREE.TorusGeometry(0.205, 0.012, 8, 28), p.paint, 0, 0.075, 0, Math.PI / 2);
  for (const s of [-1, 1]) {
    // Scye bearing (anello rotante metallico della spalla EVA!)
    add(body, new THREE.TorusGeometry(0.095, 0.016, 10, 22), p.chrome, s * 0.235, 0.44, 0, 0, Math.PI / 2, s * 0.35);
    // Soffietti articolari sui gomiti e sulle ginocchia
    const arm = s < 0 ? armL : armR;
    for (let k = -1; k <= 1; k++) add(arm, new THREE.TorusGeometry(0.068, 0.012, 8, 16), p.brushed, s * 0.02, -0.228 + k * 0.024, 0.015, Math.PI / 2 - 0.22);
    const leg = s < 0 ? legL : legR;
    for (let k = -1; k <= 1; k++) add(leg, new THREE.TorusGeometry(0.088, 0.014, 8, 18), p.brushed, 0, -0.305 + k * 0.028, 0.008, Math.PI / 2);
    // Tasca porta-campioni sulla coscia
    add(leg, new THREE.BoxGeometry(0.048, 0.14, 0.11), p.white, s * 0.098, -0.15, 0.01);
    add(leg, new THREE.BoxGeometry(0.052, 0.026, 0.114), p.paint, s * 0.098, -0.09, 0.01);
  }
  // Checklist e specchietto da polso sull'avambraccio sinistro!
  add(armL, new THREE.BoxGeometry(0.052, 0.075, 0.026), p.darkMetal, -0.04, -0.33, 0.11, -0.45, 0, 0.3);
  add(armL, new THREE.PlaneGeometry(0.04, 0.062), p.chrome, -0.04, -0.33, 0.125, -0.45, 0, 0.3);

  // Modulo DCM pettorale HD + 2 TUBI OMBELICALI (rosso & blu) dallo zaino PLSS intorno alla vita!
  add(body, new THREE.BoxGeometry(0.24, 0.22, 0.115), p.brushed, 0, 0.31, 0.2);
  const dcmMat = new THREE.MeshStandardMaterial({ map: evaChestTex(), roughness: 0.35, metalness: 0.25 });
  add(body, new THREE.PlaneGeometry(0.215, 0.195), dcmMat, 0, 0.31, 0.26);
  // Tubi vita O2/raffreddamento dallo zaino PLSS al petto
  tube(body, [[-0.14, 0.14, -0.22], [-0.25, 0.12, -0.04], [-0.22, 0.18, 0.15], [-0.09, 0.25, 0.21]], 0.018, p.custom(0x2563eb, 0.45, 0.15), 20, 8);
  tube(body, [[0.14, 0.14, -0.22], [0.25, 0.12, -0.04], [0.22, 0.18, 0.15], [0.09, 0.25, 0.21]], 0.018, p.custom(0xdc2626, 0.45, 0.15), 20, 8);

  // Zaino PLSS con radiatore, serbatoi ausiliari e doppia antenna
  add(backMount, new THREE.BoxGeometry(0.36, 0.48, 0.2), p.white, 0, 0.06, -0.12);
  add(backMount, new THREE.BoxGeometry(0.33, 0.12, 0.215), p.paint, 0, 0.21, -0.12);
  add(backMount, new THREE.BoxGeometry(0.24, 0.22, 0.03), p.brushed, 0, -0.02, -0.225);
  for (const s of [-1, 1]) {
    add(backMount, new THREE.CylinderGeometry(0.006, 0.01, 0.38, 8), p.chrome, s * 0.14, 0.49, -0.14, -0.15);
    add(backMount, new THREE.SphereGeometry(0.016, 8, 8), p.accent, s * 0.14, 0.68, -0.17);
  }

  // Casco sferico EVA con collare di blocco, visiera dorata a specchio e faretti LED
  add(head, new THREE.TorusGeometry(0.185, 0.022, 10, 26), p.paint, 0, 0.01, 0, Math.PI / 2);
  add(head, new THREE.SphereGeometry(0.232, 30, 22), p.white, 0, 0.2, 0);
  const goldVisor = new THREE.MeshPhysicalMaterial({ color: 0xf6c343, roughness: 0.04, metalness: 0.98, clearcoat: 1.0 });
  add(head, new THREE.SphereGeometry(0.22, 26, 18, -Math.PI * 0.42, Math.PI * 0.84, Math.PI * 0.2, Math.PI * 0.56), goldVisor, 0, 0.2, 0.025);
  add(head, new THREE.TorusGeometry(0.222, 0.015, 8, 28), p.brushed, 0, 0.2, 0.015);
  for (const s of [-1, 1]) {
    add(head, new THREE.BoxGeometry(0.048, 0.055, 0.085), p.darkMetal, s * 0.232, 0.22, 0.03);
    add(head, new THREE.SphereGeometry(0.018, 10, 10), p.glow, s * 0.232, 0.22, 0.075);
  }

  // Bandiera missione FOLLE! + capsula campione lunare luminoso
  const flagGrp = new THREE.Group();
  flagGrp.position.set(0.01, -0.02, 0.01);
  add(flagGrp, new THREE.CylinderGeometry(0.014, 0.016, 1.12, 10), p.chrome, 0, 0.36, 0);
  add(flagGrp, new THREE.CylinderGeometry(0.01, 0.01, 0.38, 8), p.chrome, 0.19, 0.9, 0, 0, 0, Math.PI / 2);
  const flagMat = new THREE.MeshStandardMaterial({ map: missionFlagTex(primaryHex, accentHex), side: THREE.DoubleSide, roughness: 0.5 });
  add(flagGrp, new THREE.PlaneGeometry(0.36, 0.24), flagMat, 0.19, 0.77, 0);
  h.handR.add(flagGrp);

  const pulse: THREE.Mesh[] = [];
  const pod = new THREE.Group();
  pod.position.set(-0.01, 0.02, 0.04);
  add(pod, new THREE.CylinderGeometry(0.065, 0.065, 0.035, 16), p.chrome, 0, 0.095, 0);
  add(pod, new THREE.CylinderGeometry(0.065, 0.065, 0.035, 16), p.chrome, 0, -0.095, 0);
  add(pod, new THREE.CylinderGeometry(0.055, 0.055, 0.16, 16), p.glass, 0, 0, 0);
  const rock = add(pod, new THREE.OctahedronGeometry(0.038, 0), p.glow, 0, 0, 0);
  pulse.push(rock);
  h.handL.add(pod);

  return { group: h.root, anim: { charRig: h.rig, pulse } };
}

// 26. AVIATORE STEAMPUNK (CAPPOTTO SCOLPITO, GILET, BRACCIO MECCANICO CLOCKWORK & STIVALI ALTI)
function buildCharSteampunk(p: Palette): BuiltModel {
  const breechesMat = withBump(p.custom(0x4b3f35, 0.78, 0.04), fabricWeaveBumpTex(), 0.015);

  const h = makeSculptedHumanoid(p, {
    torsoMat: p.paint,
    pelvisMat: breechesMat,
    thighMat: breechesMat,
    calfMat: p.leather,
    kneeMat: p.leather,
    bootMat: p.leather,
    bootTrim: p.brass,
    bootStyle: 'tallBoot',
    upperArmMat: p.paint,
    forearmMat: p.leather,
    elbowMat: p.brass,
    cuffMat: p.brass,
    gloveMat: p.leather,
    knuckleMat: p.brass,
    build: 'athletic',
  });
  const { body, head, armR, legL, legR } = h.rig;
  const { backMount } = h;
  const gears: { obj: THREE.Object3D; speed: number }[] = [];
  const pulse: THREE.Mesh[] = [];

  // Gilet vittoriano doppiopetto scolpito + 6 bottoni d'ottone + risvolti larghi del soprabito + spalline con fibbie!
  add(body, new THREE.BoxGeometry(0.155, 0.35, 0.036), p.leather, 0, 0.28, 0.145);
  for (const s of [-1, 1]) {
    for (let k = 0; k < 3; k++) add(body, new THREE.SphereGeometry(0.012, 8, 8), p.brass, s * 0.042, 0.2 + k * 0.072, 0.168);
    // Risvolti del soprabito + spalline (epaulets) in pelle con bottone in ottone
    add(body, new THREE.BoxGeometry(0.072, 0.25, 0.038), p.leather, s * 0.11, 0.37, 0.145, 0, 0, s * 0.22);
    add(body, new THREE.BoxGeometry(0.095, 0.022, 0.056), p.leather, s * 0.17, 0.495, 0.005, 0, 0, -s * 0.2);
    add(body, new THREE.SphereGeometry(0.012, 8, 8), p.brass, s * 0.13, 0.515, 0.005);
  }
  // Cinturone in pelle con fibbia, 2 tasche porta-attrezzi e MANOMETRO A PRESSIONE IN OTTONE sul fianco!
  add(body, buildLoft([{ y: 0.075, rx: 0.162, rz: 0.122 }, { y: 0.14, rx: 0.156, rz: 0.118 }], 24, false), p.leather);
  add(body, new THREE.BoxGeometry(0.074, 0.068, 0.036), p.brass, 0, 0.108, 0.13);
  for (const s of [-1, 1]) {
    add(body, new THREE.BoxGeometry(0.068, 0.088, 0.052), p.leather, s * 0.165, 0.07, 0.04, 0, s * 0.35);
    add(body, new THREE.SphereGeometry(0.01, 6, 6), p.brass, s * 0.185, 0.085, 0.06);
  }
  add(body, new THREE.CylinderGeometry(0.038, 0.038, 0.024, 16), p.brass, -0.11, 0.105, 0.128, Math.PI / 2);
  add(body, new THREE.CircleGeometry(0.03, 14), p.white, -0.11, 0.105, 0.142);
  // Bandoliera diagonale in cuoio con fibbia dorata
  tube(body, [[-0.16, 0.48, 0.08], [-0.04, 0.3, 0.175], [0.15, 0.12, 0.12]], 0.018, p.leather, 14, 8);
  add(body, new THREE.BoxGeometry(0.048, 0.042, 0.022), p.brass, -0.04, 0.31, 0.185, 0, 0, -0.65);

  // Falde del soprabito scolpite con pieghe fluide aperte davanti (drappeggio organico!)
  const coatMat = (p.paint as THREE.MeshStandardMaterial).clone();
  coatMat.side = THREE.DoubleSide;
  add(body, buildDrapedCapeGeo(0.165, 0.27, 0.45, 5), coatMat, 0, 0.09, 0.02);
  // Sciarpa da aviatore annodata e svolazzante
  add(body, new THREE.TorusGeometry(0.108, 0.034, 10, 22), p.accent, 0, 0.535, 0.01, Math.PI / 2);
  tube(body, [[0.06, 0.52, -0.08], [0.17, 0.42, -0.22], [0.24, 0.22, -0.3]], 0.03, p.accent, 14, 8);

  // BRACCIO PROTESICO CLOCKWORK ASIMMETRICO SULL'AVAMBRACCIO DESTRO (pistoni cromati + ingranaggio da polso!)
  add(armR, new THREE.TorusGeometry(0.06, 0.012, 8, 18), p.brass, 0.02, -0.228, 0.015, Math.PI / 2);
  add(armR, new THREE.CylinderGeometry(0.012, 0.012, 0.18, 8), p.chrome, 0.072, -0.31, 0.055, -0.48);
  add(armR, new THREE.CylinderGeometry(0.01, 0.01, 0.18, 8), p.brass, 0.055, -0.31, 0.095, -0.48);
  const wristGear = makeCogwheel(0.045, 10, 0.012, p.brass, p.chrome);
  wristGear.position.set(0.075, -0.33, 0.075);
  wristGear.rotation.y = Math.PI / 2;
  armR.add(wristGear);
  gears.push({ obj: wristGear, speed: 3.2 });

  // Toppe in pelle sulle ginocchia e risvolti sugli stivali alti
  for (const leg of [legL, legR]) {
    add(leg, new THREE.BoxGeometry(0.095, 0.1, 0.035), p.leather, 0, -0.305, 0.062);
    add(leg, new THREE.TorusGeometry(0.068, 0.012, 8, 18), p.brass, 0, -0.345, -0.004, Math.PI / 2);
  }

  // Jetpack Steampunk clockwork sulla schiena con 2 ingranaggi rotanti e fiamme
  add(backMount, new THREE.BoxGeometry(0.28, 0.28, 0.11), p.brass, 0, 0.05, -0.08);
  for (const s of [-1, 1]) {
    add(backMount, new THREE.CylinderGeometry(0.074, 0.086, 0.38, 18), p.brass, s * 0.135, 0.02, -0.12);
    add(backMount, new THREE.SphereGeometry(0.074, 14, 12), p.chrome, s * 0.135, 0.21, -0.12);
    add(backMount, new THREE.TorusGeometry(0.082, 0.012, 8, 18), p.darkMetal, s * 0.135, 0.08, -0.12, Math.PI / 2);
    add(backMount, new THREE.TorusGeometry(0.086, 0.012, 8, 18), p.darkMetal, s * 0.135, -0.08, -0.12, Math.PI / 2);
    add(backMount, new THREE.ConeGeometry(0.064, 0.09, 14), p.darkMetal, s * 0.135, -0.2, -0.12);
    const fl = add(backMount, new THREE.ConeGeometry(0.046, 0.14, 12), p.glow, s * 0.135, -0.3, -0.12, Math.PI);
    pulse.push(fl);
  }
  const g1 = makeCogwheel(0.085, 12, 0.018, p.brass, p.chrome);
  g1.position.set(-0.045, 0.09, -0.155);
  backMount.add(g1);
  gears.push({ obj: g1, speed: 2.0 });
  const g2 = makeCogwheel(0.062, 9, 0.018, p.chrome, p.brass);
  g2.position.set(0.058, -0.01, -0.155);
  backMount.add(g2);
  gears.push({ obj: g2, speed: -2.7 });

  // Volto scolpito anatomico + cuffia aviatore in pelle + baffoni + grandi occhialoni multi-lente in ottone!
  const skin = p.custom(0xe6bfa0, 0.56, 0.02);
  makeSculptedHead(head, skin);
  add(head, new THREE.SphereGeometry(0.158, 24, 16, 0, Math.PI * 2, 0, Math.PI * 0.6), p.leather, 0, 0.21, -0.01);
  for (const s of [-1, 1]) {
    add(head, new THREE.BoxGeometry(0.042, 0.15, 0.105), p.leather, s * 0.145, 0.14, -0.015, 0, 0, -s * 0.12);
    add(head, new THREE.CylinderGeometry(0.062, 0.066, 0.058, 20), p.brass, s * 0.068, 0.225, 0.142, Math.PI / 2);
    add(head, new THREE.CircleGeometry(0.052, 18), p.lensGlass, s * 0.068, 0.225, 0.174);
    if (s === 1) {
      add(head, new THREE.CylinderGeometry(0.03, 0.03, 0.072, 14), p.chrome, 0.118, 0.265, 0.155, Math.PI / 2);
      add(head, new THREE.CircleGeometry(0.024, 12), p.glow, 0.118, 0.265, 0.194);
    }
    add(head, new THREE.CapsuleGeometry(0.016, 0.062, 6, 8), p.wood, s * 0.042, 0.118, 0.152, 0, 0, s * 1.25);
  }
  add(head, new THREE.TorusGeometry(0.156, 0.014, 8, 24), p.leather, 0, 0.225, -0.005, Math.PI / 2);

  // Chiave-bastone ad etere luminosa
  const tool = new THREE.Group();
  tool.position.set(0.01, -0.02, 0.02);
  tool.rotation.x = 0.28;
  add(tool, new THREE.CylinderGeometry(0.019, 0.021, 0.72, 12), p.brass, 0, 0.18, 0);
  add(tool, new THREE.TorusGeometry(0.095, 0.024, 10, 20, Math.PI * 1.45), p.brass, 0, 0.56, 0, 0, 0, 0.75);
  const core = add(tool, new THREE.OctahedronGeometry(0.046, 0), p.glow, 0, 0.56, 0);
  pulse.push(core);
  h.handR.add(tool);

  return { group: h.root, anim: { charRig: h.rig, gears, pulse } };
}

// 27. MAGNATE GENTILUOMO (FRAC SARTORIALE, REVERS IN SETA, BOUTONNIÈRE, CODE DI RONDINE & GHETTE)
function buildCharTycoon(p: Palette): BuiltModel {
  const woolDark = withBump(p.custom(0x1e222b, 0.7, 0.06), fabricWeaveBumpTex(), 0.01);

  const h = makeSculptedHumanoid(p, {
    torsoMat: p.paint,
    pelvisMat: woolDark,
    thighMat: woolDark,
    calfMat: woolDark,
    kneeMat: woolDark,
    bootMat: p.darkMetal,
    bootTrim: p.white,
    bootStyle: 'oxfordSpat',
    upperArmMat: p.paint,
    forearmMat: p.paint,
    elbowMat: p.paint,
    cuffMat: p.white,
    gloveMat: p.white,
    build: 'tailored',
  });
  const { body, head, legL, legR } = h.rig;

  // Gilet broccato sartoriale + camicia con colletto a punte rigide + papillon + revers in seta + rosa all'occhiello!
  add(body, new THREE.BoxGeometry(0.155, 0.34, 0.036), p.accent, 0, 0.25, 0.145);
  add(body, new THREE.BoxGeometry(0.105, 0.17, 0.042), p.white, 0, 0.425, 0.138);
  // Colletto inamidato a punte (wing collar) + papillon scolpito
  for (const s of [-1, 1]) {
    add(body, new THREE.BoxGeometry(0.055, 0.045, 0.018), p.white, s * 0.048, 0.535, 0.088, 0, -s * 0.45, s * 0.2);
    // Revers a lancia (peak lapels) in raso scuro
    add(body, new THREE.BoxGeometry(0.068, 0.26, 0.036), p.darkMetal, s * 0.102, 0.36, 0.145, 0, 0, s * 0.24);
  }
  // Fazzoletto da taschino bianco + ROSA ROSSA BOUTONNIÈRE sul revers sinistro!
  add(body, new THREE.ConeGeometry(0.028, 0.045, 4), p.white, 0.125, 0.38, 0.168, 0, 0, -0.3);
  add(body, new THREE.SphereGeometry(0.019, 10, 10), p.redGlow, 0.088, 0.41, 0.172);
  add(body, new THREE.BoxGeometry(0.01, 0.032, 0.01), p.custom(0x16a34a, 0.6, 0), 0.085, 0.385, 0.168, 0, 0, 0.2);

  // Papillon scolpito + 6 bottoni d'oro doppiopetto + catenella orologio sul gilet!
  add(body, new THREE.ConeGeometry(0.034, 0.072, 8), p.paint, -0.034, 0.495, 0.165, 0, 0, -Math.PI / 2);
  add(body, new THREE.ConeGeometry(0.034, 0.072, 8), p.paint, 0.034, 0.495, 0.165, 0, 0, Math.PI / 2);
  add(body, new THREE.SphereGeometry(0.02, 10, 10), p.brass, 0, 0.495, 0.172);
  for (const s of [-1, 1]) {
    for (let k = 0; k < 3; k++) add(body, new THREE.SphereGeometry(0.011, 8, 8), p.brass, s * 0.038, 0.14 + k * 0.062, 0.17);
  }
  tube(body, [[-0.08, 0.19, 0.168], [0, 0.14, 0.182], [0.09, 0.19, 0.168]], 0.007, p.brass, 12, 6);

  // Code di rondine posteriori scolpite con 2 bottoni d'oro sul punto vita + piega stirata sui pantaloni!
  for (const s of [-1, 1]) {
    extrude(body, [[0, 0], [0.115, 0.04], [0.105, -0.44], [0.015, -0.48]], 0.028, 0.008, p.paint, s * 0.015, 0.08, -0.14, 0.12, s < 0 ? Math.PI : 0, 0);
    add(body, new THREE.SphereGeometry(0.015, 8, 8), p.brass, s * 0.055, 0.1, -0.145);
  }
  for (const leg of [legL, legR]) {
    add(leg, new THREE.BoxGeometry(0.008, 0.48, 0.015), woolDark, 0, -0.28, 0.075); // piega stirata frontale
  }

  // Volto scolpito anatomico con baffoni arricciati, sopracciglia folte, monocolo con catenella e cilindro in seta!
  const skin = p.custom(0xf0c8a8, 0.56, 0.02);
  makeSculptedHead(head, skin);
  for (const s of [-1, 1]) {
    add(head, new THREE.SphereGeometry(0.018, 10, 10), p.darkMetal, s * 0.052, 0.195, 0.135);
    add(head, new THREE.BoxGeometry(0.054, 0.017, 0.022), p.white, s * 0.054, 0.23, 0.142, 0, 0, -s * 0.12);
    tube(head, [[0, 0.122, 0.155], [s * 0.06, 0.118, 0.16], [s * 0.118, 0.138, 0.145], [s * 0.105, 0.16, 0.138]], 0.018, p.white, 14, 8);
  }
  add(head, new THREE.TorusGeometry(0.046, 0.008, 8, 20), p.brass, 0.055, 0.195, 0.16);
  add(head, new THREE.CircleGeometry(0.042, 16), p.glass, 0.055, 0.195, 0.16);
  tube(head, [[0.102, 0.19, 0.156], [0.13, 0.08, 0.14], [0.105, -0.02, 0.13]], 0.0045, p.brass, 12, 6);

  // Cilindro in seta con tesa ricurva e fascia in raso
  add(head, new THREE.CylinderGeometry(0.245, 0.245, 0.022, 30), p.darkMetal, 0, 0.305, 0);
  add(head, new THREE.TorusGeometry(0.24, 0.014, 8, 30), p.darkMetal, 0, 0.31, 0, Math.PI / 2);
  add(head, new THREE.CylinderGeometry(0.162, 0.145, 0.3, 28), p.darkMetal, 0, 0.455, 0);
  add(head, new THREE.CylinderGeometry(0.152, 0.148, 0.056, 28), p.accent, 0, 0.345, 0);

  // Bastone da passeggio in ebano + valigetta 24h con banconote smeraldo
  const cane = new THREE.Group();
  cane.position.set(0.02, -0.02, 0.01);
  cane.rotation.x = 0.22;
  add(cane, new THREE.CylinderGeometry(0.016, 0.013, 0.78, 12), p.darkMetal, 0, -0.26, 0);
  add(cane, new THREE.SphereGeometry(0.044, 16, 14), p.brass, 0, 0.14, 0);
  add(cane, new THREE.TorusGeometry(0.022, 0.008, 8, 16), p.brass, 0, 0.1, 0, Math.PI / 2);
  add(cane, new THREE.CylinderGeometry(0.013, 0.011, 0.06, 10), p.chrome, 0, -0.63, 0);
  h.handR.add(cane);

  const bag = new THREE.Group();
  bag.position.set(-0.02, -0.15, 0.01);
  bag.rotation.y = Math.PI / 2;
  add(bag, new THREE.BoxGeometry(0.3, 0.21, 0.095), p.leather, 0, 0, 0);
  add(bag, new THREE.TorusGeometry(0.05, 0.012, 8, 16, Math.PI), p.brass, 0, 0.105, 0);
  for (const sx of [-0.09, 0.09]) add(bag, new THREE.BoxGeometry(0.03, 0.03, 0.105), p.brass, sx, 0.08, 0);
  const cashMat = p.custom(0x22c55e, 0.55, 0.05);
  add(bag, new THREE.BoxGeometry(0.09, 0.075, 0.035), cashMat, 0.03, 0.12, 0.015, 0.2, 0.15, -0.25);
  add(bag, new THREE.BoxGeometry(0.024, 0.078, 0.038), p.brass, 0.03, 0.12, 0.015, 0.2, 0.15, -0.25);
  h.handL.add(bag);

  return { group: h.root, anim: { charRig: h.rig } };
}

// 28. NOBILE MASCHERATO VENEZIANO (GIUSTACUORE BAROCCO A PIEGHE, CALZE IN SETA SCOLPITE & SCARPE CON TACCO ROSSO)
function buildCharVenetian(p: Palette): BuiltModel {
  const velvetMat = withBump(p.paint, fabricWeaveBumpTex(), 0.012);

  const h = makeSculptedHumanoid(p, {
    torsoMat: velvetMat,
    pelvisMat: velvetMat,
    thighMat: velvetMat,    // culottes barocche al ginocchio!
    calfMat: p.white,       // polpacci anatomici in calze di seta bianca!
    kneeMat: p.brass,       // fibbia giarrettiera dorata
    bootMat: p.darkMetal,
    bootTrim: p.brass,
    bootStyle: 'baroque',
    upperArmMat: velvetMat,
    forearmMat: velvetMat,
    elbowMat: velvetMat,
    cuffMat: p.white,
    gloveMat: p.white,
    build: 'tailored',
  });
  const { body, head, armL, armR, legL, legR } = h.rig;

  // Falda barocca a pieghe profonde (buildLoft con 12 pieghe!) aperta frontalmente + bordatura dorata
  const skirtMat = (velvetMat as THREE.MeshStandardMaterial).clone();
  skirtMat.side = THREE.DoubleSide;
  add(body, buildLoft([
    { y: -0.29, rx: 0.275, rz: 0.215, folds: 12, foldAmp: 0.07 },
    { y: -0.1,  rx: 0.215, rz: 0.165, folds: 12, foldAmp: 0.045 },
    { y: 0.08,  rx: 0.152, rz: 0.118, folds: 12, foldAmp: 0.015 },
  ], 36, false), skirtMat);
  add(body, new THREE.TorusGeometry(0.272, 0.012, 8, 36), p.brass, 0, -0.285, 0, Math.PI / 2);

  // Alamari barocchi dorati (brandebourg) sul petto + Jabot in pizzo bianco a 3 balze + balteo diagonale d'oro!
  for (let k = 0; k < 5; k++) {
    add(body, new THREE.BoxGeometry(0.155, 0.015, 0.022), p.brass, 0, 0.13 + k * 0.056, 0.148 + k * 0.005);
    add(body, new THREE.SphereGeometry(0.012, 8, 8), p.brass, -0.075, 0.13 + k * 0.056, 0.155 + k * 0.005);
    add(body, new THREE.SphereGeometry(0.012, 8, 8), p.brass, 0.075, 0.13 + k * 0.056, 0.155 + k * 0.005);
  }
  for (let k = 0; k < 3; k++) add(body, new THREE.ConeGeometry(0.062 + k * 0.012, 0.085, 12), p.white, 0, 0.47 - k * 0.052, 0.175);
  // Balteo / fusciacca dorata diagonale + cintura
  tube(body, [[0.15, 0.49, 0.08], [0.02, 0.29, 0.18], [-0.15, 0.09, 0.12]], 0.02, p.accent, 14, 8);
  add(body, buildLoft([{ y: 0.06, rx: 0.158, rz: 0.122 }, { y: 0.115, rx: 0.154, rz: 0.118 }], 24, false), p.accent);
  // Ampi paramani barocchi risvoltati sugli avambracci + fiocchi giarrettiere sulle ginocchia!
  for (const arm of [armL, armR]) {
    add(arm, new THREE.CylinderGeometry(0.062, 0.052, 0.095, 16), p.accent, 0, -0.35, 0.08, -0.48);
  }
  for (const [leg, s] of [[legL, -1], [legR, 1]] as [THREE.Group, number][]) {
    add(leg, new THREE.TorusGeometry(0.06, 0.011, 8, 18), p.brass, 0, -0.305, 0, Math.PI / 2);
    add(leg, new THREE.BoxGeometry(0.028, 0.028, 0.028), p.accent, s * 0.062, -0.305, 0.01);
  }

  // Mantello drappeggiato scuro con bordi in oro
  addSculptedCape(body, h.rig, p.darkMetal, p.brass);

  // Maschera Veneziana scolpita + 7 raggi solari dorati + tricorno piumato in velluto
  add(head, new THREE.SphereGeometry(0.155, 24, 18), p.darkMetal, 0, 0.175, -0.01);
  const mask = add(head, new THREE.SphereGeometry(0.16, 24, 18, -Math.PI * 0.42, Math.PI * 0.84, Math.PI * 0.15, Math.PI * 0.7), p.white, 0, 0.175, 0.02);
  mask.scale.set(0.94, 1.06, 1.05);
  add(head, new THREE.ConeGeometry(0.024, 0.074, 8), p.white, 0, 0.16, 0.188, Math.PI / 2.2);
  for (const s of [-1, 1]) {
    add(head, new THREE.SphereGeometry(0.025, 12, 10), p.darkMetal, s * 0.054, 0.2, 0.158);
    add(head, new THREE.TorusGeometry(0.031, 0.007, 8, 16), p.brass, s * 0.054, 0.2, 0.168);
  }
  for (let i = -3; i <= 3; i++) {
    const a = i * 0.36;
    add(head, new THREE.ConeGeometry(0.018, 0.14 + (i % 2 === 0 ? 0.04 : 0), 6), p.brass, Math.sin(a) * 0.205, 0.25 + Math.cos(a) * 0.12, 0.115, 0, 0, -a);
  }
  add(head, new THREE.CylinderGeometry(0.275, 0.245, 0.078, 3), p.paint, 0, 0.33, 0, 0, Math.PI / 3);
  add(head, new THREE.SphereGeometry(0.165, 18, 14), p.paint, 0, 0.34, 0);
  add(head, new THREE.CylinderGeometry(0.283, 0.253, 0.022, 3), p.brass, 0, 0.37, 0, 0, Math.PI / 3);
  tube(head, [[-0.14, 0.37, 0.06], [-0.26, 0.51, -0.05], [-0.22, 0.55, -0.22]], 0.028, p.white, 16, 8);
  tube(head, [[-0.12, 0.37, 0.06], [-0.2, 0.55, -0.02], [-0.14, 0.59, -0.18]], 0.022, p.accent, 14, 8);

  // Scettro da gran ballo in oro
  const scepter = new THREE.Group();
  scepter.position.set(0.01, -0.02, 0.02);
  scepter.rotation.x = 0.22;
  add(scepter, new THREE.CylinderGeometry(0.015, 0.013, 0.9, 12), p.brass, 0, 0.18, 0);
  add(scepter, new THREE.OctahedronGeometry(0.055, 0), p.paint, 0, 0.65, 0);
  add(scepter, new THREE.TorusGeometry(0.072, 0.012, 8, 20), p.brass, 0, 0.65, 0);
  h.handR.add(scepter);

  return { group: h.root, anim: { charRig: h.rig } };
}

// 29. ANDROIDE CYBER-MECHA (CORAZZE PETTORALI SEGMENTATE, ADDOMINALI A PIASTRE, SERVO-GIUNTI LED & COLONNA CARBONIO)
function buildCharAndroid(p: Palette): BuiltModel {
  const h = makeSculptedHumanoid(p, {
    torsoMat: p.carbon,
    pelvisMat: p.darkMetal,
    thighMat: p.carbon,
    calfMat: p.darkMetal,
    kneeMat: p.chrome,
    bootMat: p.paint,
    bootTrim: p.glow,
    bootStyle: 'cyber',
    upperArmMat: p.carbon,
    forearmMat: p.darkMetal,
    elbowMat: p.chrome,
    cuffMat: p.glow,
    gloveMat: p.darkMetal,
    knuckleMat: p.glow,
    build: 'cyber',
  });
  const { body, head, armL, armR, legL, legR } = h.rig;
  const { backMount } = h;
  const pulse: THREE.Mesh[] = [];
  const spinY: THREE.Object3D[] = [];

  // 4 pistoni idraulici cromati sull'addome + 6 PIASTRE ADDOMINALI SEGMENTATE + COLONNA VERTEBRALE MECCANICA POSTERIORE!
  for (const s of [-1, 1]) {
    add(body, new THREE.CylinderGeometry(0.012, 0.012, 0.21, 8), p.chrome, s * 0.125, 0.15, 0.045, 0, 0, s * 0.18);
    add(body, new THREE.CylinderGeometry(0.012, 0.012, 0.21, 8), p.chrome, s * 0.125, 0.15, -0.05, 0, 0, s * 0.18);
    // 3 coppie di piastre addominali scolpite
    for (let k = 0; k < 3; k++) {
      add(body, new THREE.BoxGeometry(0.068, 0.044, 0.036), p.darkMetal, s * 0.042, 0.11 + k * 0.052, 0.118, 0, s * 0.18);
    }
    // PIASTRE PETTORALI CORAZZATE ANGOLARI nel colore del giocatore + clavicole in titanio!
    add(body, new THREE.BoxGeometry(0.145, 0.155, 0.09), p.paint, s * 0.1, 0.37, 0.115, -0.14, s * 0.22, -s * 0.1);
    add(body, new THREE.BoxGeometry(0.11, 0.045, 0.13), p.chrome, s * 0.125, 0.48, 0.02, 0, 0, -s * 0.22);
    // Scapole corazzate posteriori
    add(body, new THREE.BoxGeometry(0.13, 0.17, 0.07), p.paint, s * 0.1, 0.37, -0.115, 0.1, -s * 0.22);
  }
  // Colonna vertebrale segmentata esposta sul dorso (7 vertebre cromate)
  for (let v = 0; v < 7; v++) {
    add(body, new THREE.BoxGeometry(0.048, 0.032, 0.042), v % 2 === 0 ? p.chrome : p.darkMetal, 0, 0.08 + v * 0.064, -0.138);
  }
  // Reattore esagonale centrale al petto pulsante
  add(body, new THREE.CylinderGeometry(0.068, 0.068, 0.038, 6), p.chrome, 0, 0.365, 0.165, Math.PI / 2);
  const core = add(body, new THREE.CylinderGeometry(0.048, 0.048, 0.046, 6), p.glow, 0, 0.365, 0.168, Math.PI / 2);
  pulse.push(core);

  // Spallacci mecha + piastre bicipite/avambraccio + SERVO-ANELLI LUMINOSI sui gomiti e sulle ginocchia!
  for (const [arm, s] of [[armL, -1], [armR, 1]] as [THREE.Group, number][]) {
    add(arm, new THREE.BoxGeometry(0.145, 0.125, 0.175), p.paint, s * 0.032, 0.03, 0, 0, 0, -s * 0.24);
    add(arm, new THREE.BoxGeometry(0.152, 0.022, 0.15), p.glow, s * 0.038, 0.05, 0, 0, 0, -s * 0.24);
    // Servo-anello luminoso del gomito + placca avambraccio verniciata
    add(arm, new THREE.TorusGeometry(0.046, 0.008, 8, 16), p.glow, s * 0.02, -0.228, 0.015, 0, Math.PI / 2);
    add(arm, new THREE.BoxGeometry(0.055, 0.145, 0.088), p.paint, s * 0.045, -0.32, 0.065, -0.48);
  }
  for (const [leg, s] of [[legL, -1], [legR, 1]] as [THREE.Group, number][]) {
    // Piastre coscia + ginocchiera meccanica con servo-ring LED + schiniere aerodinamico verniciato
    add(leg, new THREE.BoxGeometry(0.095, 0.21, 0.09), p.paint, s * 0.02, -0.145, 0.035);
    add(leg, new THREE.TorusGeometry(0.058, 0.009, 8, 16), p.glow, 0, -0.305, 0.008, 0, Math.PI / 2);
    add(leg, new THREE.BoxGeometry(0.092, 0.21, 0.088), p.paint, 0, -0.435, 0.022);
    add(leg, new THREE.BoxGeometry(0.02, 0.19, 0.024), p.glow, s * 0.048, -0.435, 0.03);
  }

  // Doppie alette dorsali + propulsori ionici
  for (const s of [-1, 1]) {
    extrude(backMount, [[0, 0], [0.22, 0.16], [0.28, 0.42], [0.16, 0.44], [0, 0.2]], 0.024, 0.006, p.carbon, s * 0.08, 0.02, -0.04, 0, s < 0 ? Math.PI : 0, 0);
    add(backMount, new THREE.CylinderGeometry(0.042, 0.052, 0.14, 12), p.darkMetal, s * 0.09, -0.02, -0.06, 0.35);
    const jet = add(backMount, new THREE.SphereGeometry(0.036, 10, 10), p.glow, s * 0.09, -0.09, -0.085);
    pulse.push(jet);
  }

  // Testa androide scolpita con visiera olografica continua, doppie antenne e mentoniera in carbonio
  add(head, new THREE.CylinderGeometry(0.056, 0.072, 0.09, 12), p.carbon, 0, 0.01, 0);
  add(head, new THREE.BoxGeometry(0.225, 0.255, 0.27), p.paint, 0, 0.19, 0);
  add(head, new THREE.BoxGeometry(0.175, 0.1, 0.18), p.carbon, 0, 0.095, 0.075);
  add(head, new THREE.BoxGeometry(0.242, 0.084, 0.175), p.tintedGlass, 0, 0.21, 0.082);
  const visorLine = add(head, new THREE.BoxGeometry(0.248, 0.024, 0.155), p.glow, 0, 0.21, 0.095);
  pulse.push(visorLine);
  for (const s of [-1, 1]) {
    add(head, new THREE.CylinderGeometry(0.034, 0.034, 0.04, 14), p.chrome, s * 0.13, 0.2, 0, 0, 0, Math.PI / 2);
    add(head, new THREE.CylinderGeometry(0.008, 0.012, 0.2, 8), p.chrome, s * 0.14, 0.31, -0.04, -0.35);
  }

  // Bastone al plasma + cubo olografico Tesseract rotante
  const baton = new THREE.Group();
  baton.position.set(0.01, -0.02, 0.02);
  baton.rotation.x = 0.32;
  add(baton, new THREE.CylinderGeometry(0.019, 0.019, 0.32, 12), p.darkMetal, 0, 0.04, 0);
  const blade = add(baton, new THREE.CylinderGeometry(0.015, 0.011, 0.56, 12), p.glow, 0, 0.48, 0);
  pulse.push(blade);
  h.handR.add(baton);

  const holo = new THREE.Group();
  holo.position.set(-0.01, 0.1, 0.05);
  add(holo, new THREE.BoxGeometry(0.11, 0.11, 0.11), p.glass, 0, 0, 0, 0.6, 0.6, 0.4);
  const innerCube = add(holo, new THREE.OctahedronGeometry(0.064, 0), p.glow);
  pulse.push(innerCube);
  spinY.push(holo);
  h.handL.add(holo);

  return { group: h.root, anim: { charRig: h.rig, pulse, spinY } };
}

// 30. ARCIMAGO ALCHIMISTA (TUNICA DRAPPEGGIATA A 14 PIEGHE SCULTOREE, MANICHE A CAMPANA & BANDOLIERA POZIONI)
function buildCharWizard(p: Palette): BuiltModel {
  const skin = p.custom(0xedc5a5, 0.56, 0.02);
  const robeMat = withBump(p.paint, fabricWeaveBumpTex(), 0.014);

  const h = makeSculptedHumanoid(p, {
    torsoMat: robeMat,
    pelvisMat: robeMat,
    thighMat: robeMat,
    calfMat: robeMat,
    bootMat: p.leather,
    bootTrim: p.brass,
    bootStyle: 'pointed',
    upperArmMat: robeMat,
    forearmMat: robeMat,
    cuffMat: p.brass,
    gloveMat: skin,
    build: 'robed',
    hideLegs: true,
  });
  const { body, head, armL, armR } = h.rig;
  const spinY: THREE.Object3D[] = [];
  const pulse: THREE.Mesh[] = [];

  // TUNICA ARCANA SCULTOREA A 14 PIEGHE VERTICALI PROFONDE (addio cono liscio!) con vita sagomata e petto scolpito!
  const robeSlices: LoftSlice[] = [
    { y: -0.64, rx: 0.365, rz: 0.315, folds: 14, foldAmp: 0.085 }, // orlo inferiore riccamente pieghettato
    { y: -0.38, rx: 0.285, rz: 0.245, folds: 14, foldAmp: 0.068 },
    { y: -0.1,  rx: 0.215, rz: 0.175, folds: 14, foldAmp: 0.045 },
    { y: 0.09,  rx: 0.162, rz: 0.128, folds: 10, foldAmp: 0.018 }, // vita stretta dalla cintura
    { y: 0.24,  rx: 0.195, rz: 0.145, chest: 0.022, spine: 0.02 },
    { y: 0.39,  rx: 0.228, rz: 0.155, chest: 0.028, spine: 0.024 },
    { y: 0.49,  rx: 0.185, rz: 0.12,  oz: 0 },
    { y: 0.55,  rx: 0.09,  rz: 0.082, oz: -0.005 },
  ];
  add(body, buildLoft(robeSlices, 42, true), robeMat);

  // Soprabito aperto sul davanti che lascia intravedere il corpetto/stola ricamata in oro + bordi dorati
  add(body, buildLoft([
    { y: -0.635, rx: 0.37, rz: 0.32, folds: 14, foldAmp: 0.085 },
    { y: -0.59,  rx: 0.355, rz: 0.305, folds: 14, foldAmp: 0.08 },
  ], 42, false), p.brass);
  add(body, new THREE.BoxGeometry(0.125, 1.04, 0.045), p.accent, 0, -0.08, 0.215, -0.14);
  for (const s of [-1, 1]) {
    tube(body, [[s * 0.08, 0.48, 0.155], [s * 0.075, 0.12, 0.155], [s * 0.105, -0.62, 0.32]], 0.014, p.brass, 18, 6);
  }

  // Ampie MANICHE A CAMPANA DRAPPEGGIATE sopra gli avambracci (tratto iconico dell'Arcimago!)
  for (const [arm, s] of [[armL, -1], [armR, 1]] as [THREE.Group, number][]) {
    const bellMat = (robeMat as THREE.MeshStandardMaterial).clone();
    bellMat.side = THREE.DoubleSide;
    const bell = new THREE.Group();
    bell.position.set(s * 0.02, -0.22, 0.015);
    bell.rotation.set(-0.48, 0, -s * 0.06);
    add(bell, buildLoft([
      { y: -0.18, rx: 0.115, rz: 0.115, folds: 7, foldAmp: 0.08 },
      { y: 0.02,  rx: 0.062, rz: 0.062, folds: 7, foldAmp: 0.03 },
    ], 22, false), bellMat);
    add(bell, new THREE.TorusGeometry(0.115, 0.01, 8, 22), p.brass, 0, -0.175, 0, Math.PI / 2);
    arm.add(bell);
  }

  // Mantellina drappeggiata sulle spalle (pieghe scolpite!) con fermaglio a stella dorata
  const mantleMat = (robeMat as THREE.MeshStandardMaterial).clone();
  mantleMat.side = THREE.DoubleSide;
  add(body, buildLoft([
    { y: 0.27, rx: 0.285, rz: 0.22, folds: 10, foldAmp: 0.055 },
    { y: 0.41, rx: 0.245, rz: 0.18, folds: 10, foldAmp: 0.03 },
    { y: 0.51, rx: 0.145, rz: 0.115 },
  ], 32, false), mantleMat);
  add(body, new THREE.TorusGeometry(0.282, 0.011, 8, 30), p.brass, 0, 0.275, 0, Math.PI / 2);
  add(body, new THREE.OctahedronGeometry(0.038, 0), p.brass, 0, 0.455, 0.175);

  // Cintura e bandoliera in pelle da alchimista con 3 AMPOLLE DI POZIONE LUMINOSE + ASTUCCIO PERGAMENE IN OTTONE!
  add(body, buildLoft([{ y: 0.055, rx: 0.175, rz: 0.14 }, { y: 0.12, rx: 0.17, rz: 0.135 }], 26, false), p.leather);
  add(body, new THREE.BoxGeometry(0.072, 0.068, 0.038), p.brass, 0, 0.088, 0.148);
  tube(body, [[-0.16, 0.48, 0.1], [-0.03, 0.3, 0.195], [0.16, 0.1, 0.12]], 0.016, p.leather, 14, 8);
  const vialCols = [0xef4444, 0x10b981, 0x38bdf8];
  vialCols.forEach((col, i) => {
    const a = -0.82 + i * 0.82;
    const vx = Math.sin(a) * 0.215, vz = Math.cos(a) * 0.185;
    const vMat = new THREE.MeshStandardMaterial({ color: col, emissive: col, emissiveIntensity: 0.95, roughness: 0.15 });
    add(body, new THREE.SphereGeometry(0.034, 12, 10), vMat, vx, 0.005, vz);
    add(body, new THREE.CylinderGeometry(0.012, 0.014, 0.036, 8), p.wood, vx, 0.046, vz);
  });
  // Astuccio porta-pergamene in ottone sul retro della cintura
  add(body, new THREE.CylinderGeometry(0.034, 0.034, 0.26, 14), p.leather, -0.05, 0.07, -0.175, 0, 0, Math.PI / 2.2);
  add(body, new THREE.CylinderGeometry(0.037, 0.037, 0.036, 14), p.brass, -0.17, 0.085, -0.175, 0, 0, Math.PI / 2.2);
  add(body, new THREE.CylinderGeometry(0.037, 0.037, 0.036, 14), p.brass, 0.07, 0.055, -0.175, 0, 0, Math.PI / 2.2);

  // Volto scolpito del saggio + barba fluente a 3 strati + cappello da Arcimago piegato
  makeSculptedHead(head, skin);
  for (const s of [-1, 1]) {
    add(head, new THREE.SphereGeometry(0.018, 10, 10), p.glow, s * 0.05, 0.195, 0.135);
    add(head, new THREE.BoxGeometry(0.058, 0.018, 0.022), p.white, s * 0.054, 0.23, 0.142, 0, 0, -s * 0.18);
    add(head, new THREE.CapsuleGeometry(0.017, 0.058, 6, 8), p.white, s * 0.046, 0.125, 0.145, 0, 0, s * 1.2);
  }
  add(head, new THREE.ConeGeometry(0.112, 0.36, 14), p.white, 0, -0.015, 0.112, Math.PI + 0.18);
  add(head, new THREE.ConeGeometry(0.072, 0.25, 12), p.white, -0.052, 0.025, 0.092, Math.PI + 0.14, 0, -0.2);
  add(head, new THREE.ConeGeometry(0.072, 0.25, 12), p.white, 0.052, 0.025, 0.092, Math.PI + 0.14, 0, 0.2);

  add(head, new THREE.CylinderGeometry(0.315, 0.345, 0.025, 32), p.paint, 0, 0.295, 0);
  add(head, new THREE.TorusGeometry(0.325, 0.013, 8, 32), p.brass, 0, 0.295, 0, Math.PI / 2);
  add(head, new THREE.CylinderGeometry(0.142, 0.162, 0.064, 24), p.accent, 0, 0.335, 0);
  add(head, new THREE.BoxGeometry(0.072, 0.062, 0.026), p.brass, 0, 0.335, 0.158);
  add(head, new THREE.CylinderGeometry(0.094, 0.158, 0.24, 22), p.paint, 0, 0.46, -0.02, -0.2);
  add(head, new THREE.ConeGeometry(0.094, 0.28, 20), p.paint, 0.05, 0.66, -0.1, -0.68, 0, -0.35);

  // Bastone d'astrolabio rotante + Grimorio runico aperto HD
  const staff = new THREE.Group();
  staff.position.set(0.02, -0.02, 0.03);
  staff.rotation.x = 0.2;
  tube(staff, [[0, -0.68, 0], [0.015, -0.18, 0], [-0.015, 0.32, 0.01], [0, 0.66, 0]], 0.021, p.wood, 20, 10);
  add(staff, new THREE.TorusGeometry(0.03, 0.01, 8, 14), p.brass, 0, 0.64, 0, Math.PI / 2);
  const orb = new THREE.Group();
  orb.position.set(0, 0.79, 0);
  add(orb, new THREE.TorusGeometry(0.115, 0.012, 8, 24), p.brass, 0, 0, 0, 0.35, 0.2);
  add(orb, new THREE.TorusGeometry(0.088, 0.01, 8, 20), p.brass, 0, 0, 0, -0.5, 0.8);
  const crystal = add(orb, new THREE.OctahedronGeometry(0.06, 0), p.glow);
  pulse.push(crystal);
  spinY.push(orb);
  staff.add(orb);
  h.handR.add(staff);

  const book = new THREE.Group();
  book.position.set(-0.02, 0.01, 0.06);
  book.rotation.set(-0.55, 0.3, 0.15);
  add(book, new THREE.BoxGeometry(0.145, 0.19, 0.016), p.leather, -0.075, 0, -0.01, 0, 0.25);
  add(book, new THREE.BoxGeometry(0.145, 0.19, 0.016), p.leather, 0.075, 0, -0.01, 0, -0.25);
  add(book, new THREE.CylinderGeometry(0.016, 0.016, 0.195, 10), p.brass, 0, 0, -0.028);
  const pageMat = new THREE.MeshStandardMaterial({
    map: grimoireTex(),
    emissiveMap: grimoireTex(),
    emissive: new THREE.Color(0xffe082),
    emissiveIntensity: 0.35,
    roughness: 0.65,
  });
  add(book, new THREE.PlaneGeometry(0.27, 0.172), pageMat, 0, 0, 0.016);
  h.handL.add(book);

  return { group: h.root, anim: { charRig: h.rig, spinY, pulse } };
}

export const FIGURINE_BUILDERS: Record<string, (p: Palette, primaryHex: string, accentHex: string) => BuiltModel> = {
  char_driver: buildCharDriver,
  char_knight: buildCharKnight,
  char_samurai: buildCharSamurai,
  char_diver: buildCharDiver,
  char_astronaut: buildCharAstronaut,
  char_steampunk: buildCharSteampunk,
  char_tycoon: buildCharTycoon,
  char_venetian: buildCharVenetian,
  char_android: buildCharAndroid,
  char_wizard: buildCharWizard,
};

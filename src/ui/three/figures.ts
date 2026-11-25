// Pedine-personaggio fatte di forme semplici, costruite qui dentro: niente file da scaricare,
// niente licenze da controllare, e questo modulo arriva solo a chi sceglie uno di loro
// (characters3d.ts lo carica con un import() dinamico).
//
// Le pose non sono animazioni registrate: si muovono le parti (testa, braccia, gambe) in base
// al tempo, quindi bastano poche righe per ognuna e il risultato è sempre lo stesso.
import * as THREE from 'three';
import type { Appearance } from '../../engine';
import type { Piece, Pose, Reaction } from './characters3d';

// Il corpo di una pedina: le parti che si muovono. Tutto è costruito alto 1, poi si scala.
export interface FigureParts {
  group: THREE.Group;
  head: THREE.Object3D;
  body: THREE.Object3D;
  arms: THREE.Object3D[];
  legs: THREE.Object3D[];
  // roba che penzola (coda, antenna): oscilla da sola
  wiggle: THREE.Object3D[];
}

function mat(color: THREE.ColorRepresentation, rough = 0.5, metal = 0.05): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({ color, roughness: rough, metalness: metal });
}

function mesh(geo: THREE.BufferGeometry, m: THREE.Material, x = 0, y = 0, z = 0): THREE.Mesh {
  const me = new THREE.Mesh(geo, m);
  me.position.set(x, y, z);
  me.castShadow = true;
  return me;
}

// Un braccio o una gamba: il pezzo pende dal suo attacco, così ruotandolo si muove bene.
function limb(geo: THREE.BufferGeometry, m: THREE.Material, at: THREE.Vector3, length: number): THREE.Group {
  const g = new THREE.Group();
  g.position.copy(at);
  const me = mesh(geo, m, 0, -length / 2, 0);
  g.add(me);
  return g;
}

// ---------- robottino ----------
function buildRobot(color: string): FigureParts {
  const body = mat(color, 0.35, 0.45);
  const metalDark = mat(0x3a4049, 0.4, 0.6);
  const glass = mat(0x2b3a4a, 0.2, 0.3);
  const glow = new THREE.MeshStandardMaterial({ color: 0xffe79a, emissive: 0xffc24a, emissiveIntensity: 0.8, roughness: 0.4 });
  const group = new THREE.Group();

  const torso = mesh(new THREE.BoxGeometry(0.3, 0.36, 0.22), body, 0, 0.5, 0);
  const belly = mesh(new THREE.BoxGeometry(0.2, 0.1, 0.02), metalDark, 0, 0.47, 0.13);
  const headG = new THREE.Group();
  headG.position.set(0, 0.76, 0);
  headG.add(mesh(new THREE.BoxGeometry(0.28, 0.24, 0.24), body));
  headG.add(mesh(new THREE.BoxGeometry(0.22, 0.1, 0.02), glass, 0, 0.02, 0.12));
  const antenna = new THREE.Group();
  antenna.position.set(0, 0.12, 0);
  antenna.add(mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.14), metalDark, 0, 0.07, 0));
  antenna.add(mesh(new THREE.SphereGeometry(0.035, 12, 10), glow, 0, 0.15, 0));
  headG.add(antenna);

  const armGeo = new THREE.BoxGeometry(0.09, 0.26, 0.09);
  const arms = [-1, 1].map((s) => limb(armGeo, metalDark, new THREE.Vector3(s * 0.23, 0.64, 0), 0.26));
  const legGeo = new THREE.BoxGeometry(0.11, 0.3, 0.12);
  const legs = [-1, 1].map((s) => limb(legGeo, metalDark, new THREE.Vector3(s * 0.1, 0.32, 0), 0.3));

  group.add(torso, belly, headG, ...arms, ...legs);
  return { group, head: headG, body: torso, arms, legs, wiggle: [antenna] };
}

// ---------- gatto ----------
function buildCat(color: string): FigureParts {
  const fur = mat(color, 0.75, 0);
  const pale = mat(new THREE.Color(color).lerp(new THREE.Color(0xffffff), 0.55), 0.8, 0);
  const dark = mat(0x2a2320, 0.6, 0);
  const group = new THREE.Group();

  const torso = mesh(new THREE.CapsuleGeometry(0.13, 0.2, 6, 14), fur, 0, 0.45, 0);
  const chest = mesh(new THREE.SphereGeometry(0.085, 14, 10), pale, 0, 0.4, 0.09);
  const headG = new THREE.Group();
  headG.position.set(0, 0.78, 0);
  headG.add(mesh(new THREE.SphereGeometry(0.14, 16, 12), fur));
  // muso e nasino
  headG.add(mesh(new THREE.SphereGeometry(0.055, 12, 10), pale, 0, -0.04, 0.11));
  headG.add(mesh(new THREE.SphereGeometry(0.022, 8, 6), dark, 0, -0.02, 0.15));
  for (const s of [-1, 1]) {
    const ear = mesh(new THREE.ConeGeometry(0.055, 0.16, 4), fur, s * 0.085, 0.15, 0);
    ear.rotation.set(-0.15, Math.PI / 4, s * 0.25);
    headG.add(ear);
    headG.add(mesh(new THREE.SphereGeometry(0.024, 8, 6), dark, s * 0.06, 0.015, 0.125));
  }

  const armGeo = new THREE.CapsuleGeometry(0.04, 0.12, 4, 8);
  const arms = [-1, 1].map((s) => limb(armGeo, fur, new THREE.Vector3(s * 0.12, 0.47, 0.05), 0.2));
  const legGeo = new THREE.CapsuleGeometry(0.05, 0.12, 4, 8);
  const legs = [-1, 1].map((s) => limb(legGeo, fur, new THREE.Vector3(s * 0.09, 0.3, 0), 0.22));

  // coda: tre pezzi uno dentro l'altro, così si piega
  const tail = new THREE.Group();
  tail.position.set(0, 0.42, -0.15);
  let node: THREE.Object3D = tail;
  for (let i = 0; i < 3; i++) {
    const piece = new THREE.Group();
    piece.position.y = i ? 0.1 : 0;
    piece.add(mesh(new THREE.CapsuleGeometry(0.03 - i * 0.005, 0.08, 4, 8), fur, 0, 0.05, 0));
    piece.rotation.x = -0.3;
    node.add(piece);
    node = piece;
  }

  group.add(torso, chest, headG, tail, ...arms, ...legs);
  return { group, head: headG, body: torso, arms, legs, wiggle: [tail] };
}

// ---------- astronauta ----------
function buildAstronaut(color: string): FigureParts {
  const suit = mat(color, 0.6, 0.05);
  const white = mat(0xf2f1ec, 0.6, 0);
  const glass = new THREE.MeshStandardMaterial({ color: 0x24303d, roughness: 0.1, metalness: 0.5 });
  const pack = mat(0x8d949c, 0.5, 0.3);
  const group = new THREE.Group();

  const torso = mesh(new THREE.CapsuleGeometry(0.17, 0.2, 6, 14), suit, 0, 0.5, 0);
  const collar = mesh(new THREE.CylinderGeometry(0.13, 0.14, 0.05, 16), white, 0, 0.66, 0);
  const backpack = mesh(new THREE.BoxGeometry(0.2, 0.22, 0.09), pack, 0, 0.52, -0.17);
  const headG = new THREE.Group();
  headG.position.set(0, 0.8, 0);
  headG.add(mesh(new THREE.SphereGeometry(0.17, 18, 14), white));
  // la visiera è una sfera schiacciata appoggiata davanti al casco: si vede bene da ogni lato
  const visor = mesh(new THREE.SphereGeometry(0.12, 16, 12), glass, 0, 0, 0.07);
  visor.scale.set(1, 0.72, 0.5);
  headG.add(visor);

  const armGeo = new THREE.CapsuleGeometry(0.055, 0.16, 4, 10);
  const arms = [-1, 1].map((s) => limb(armGeo, white, new THREE.Vector3(s * 0.2, 0.62, 0), 0.24));
  const legGeo = new THREE.CapsuleGeometry(0.065, 0.16, 4, 10);
  const legs = [-1, 1].map((s) => limb(legGeo, white, new THREE.Vector3(s * 0.09, 0.34, 0), 0.26));

  group.add(torso, collar, backpack, headG, ...arms, ...legs);
  return { group, head: headG, body: torso, arms, legs, wiggle: [] };
}

export const FIGURES: Record<string, (color: string) => FigureParts> = {
  robot: buildRobot,
  gatto: buildCat,
  astronauta: buildAstronaut,
};

// Quanto dura una reazione prima di tornare alla posa di base.
const REACTION_SECONDS = 1.2;

// Pedina-personaggio animata a mano. Ha gli stessi metodi del modello scaricato (Piece),
// così il resto del gioco non sa la differenza.
export class FigureModel implements Piece {
  readonly root = new THREE.Group();
  private parts: FigureParts;
  private pose: Pose = 'idle';
  private basePose: Pose = 'idle';
  private time = 0;
  private reactionUntil = 0;
  private base: THREE.Mesh;

  constructor(look: Appearance, height: number, build = FIGURES[look.character]) {
    const tint = new THREE.Color(look.color);
    this.parts = (build ?? buildRobot)(look.color);
    // ogni figura viene alta come i personaggi scaricati, qualunque forma abbia:
    // si misura l'ingombro e si scala di conseguenza, coi piedi appoggiati sulla base
    const box = new THREE.Box3().setFromObject(this.parts.group);
    const tall = Math.max(box.max.y - box.min.y, 0.001);
    const k = (height * 0.94) / tall;
    this.parts.group.scale.setScalar(k);
    this.parts.group.position.y = height * 0.06 - box.min.y * k;
    this.root.add(this.parts.group);

    // stessa base colorata dei personaggi scaricati: si riconosce il giocatore da lontano
    this.base = new THREE.Mesh(
      new THREE.CylinderGeometry(height * 0.3, height * 0.33, height * 0.06, 32),
      new THREE.MeshStandardMaterial({ color: tint, roughness: 0.35, metalness: 0.1 }),
    );
    this.base.name = 'base';
    this.base.position.y = height * 0.03;
    this.base.castShadow = true;
    this.base.receiveShadow = true;
    this.root.add(this.base);
  }

  play(pose: Pose): void {
    this.pose = pose;
  }

  get currentPose(): Pose {
    return this.pose;
  }

  setBase(pose: Pose, _fade = 0.2, interrupt = false): void {
    this.basePose = pose;
    if (interrupt) this.reactionUntil = 0;
    if (this.time >= this.reactionUntil) this.pose = pose;
  }

  react(reaction: Reaction): void {
    this.pose = reaction;
    this.reactionUntil = this.time + REACTION_SECONDS;
  }

  get reacting(): boolean {
    return this.time < this.reactionUntil;
  }

  update(dt: number): void {
    this.time += dt;
    if (this.reactionUntil && this.time >= this.reactionUntil) {
      this.reactionUntil = 0;
      this.pose = this.basePose;
    }
    applyPose(this.parts, this.pose, this.time);
  }

  dispose(): void {
    this.base.geometry.dispose();
    (this.base.material as THREE.Material).dispose();
    this.parts.group.traverse((o) => {
      const m = o as THREE.Mesh;
      if (!m.isMesh) return;
      m.geometry.dispose();
      for (const mt of Array.isArray(m.material) ? m.material : [m.material]) mt.dispose();
    });
  }
}

// Mette le parti nella posizione giusta per la posa, al tempo t. È una funzione pura sui numeri,
// quindi si può provare senza disegnare niente (tests/figure.test.ts).
export function applyPose(p: FigureParts, pose: Pose, t: number): void {
  const g = p.group;
  const swing = (speed: number, amp: number, offset = 0) => Math.sin(t * speed + offset) * amp;
  // tutto riparte da fermo: ogni posa scrive solo quello che le serve
  g.rotation.set(0, g.rotation.y, 0);
  g.position.y = g.userData.baseY ?? (g.userData.baseY = g.position.y);
  p.head.rotation.set(0, 0, 0);
  for (const a of p.arms) a.rotation.set(0, 0, 0);
  for (const l of p.legs) l.rotation.set(0, 0, 0);
  for (const w of p.wiggle) w.rotation.z = swing(3, 0.12);

  switch (pose) {
    case 'walk':
      g.position.y += Math.abs(swing(11, 0.012));
      p.arms.forEach((a, i) => (a.rotation.x = swing(11, 0.7, i * Math.PI)));
      p.legs.forEach((l, i) => (l.rotation.x = swing(11, 0.6, i * Math.PI + Math.PI)));
      break;
    case 'jump':
      g.position.y += 0.02;
      for (const a of p.arms) a.rotation.x = -2.1;
      for (const l of p.legs) l.rotation.x = 0.5;
      break;
    case 'cheer':
      g.rotation.y += 0.06;
      g.position.y += Math.abs(swing(8, 0.02));
      p.arms.forEach((a, i) => {
        a.rotation.x = -2.4;
        a.rotation.z = swing(8, 0.25, i * Math.PI);
      });
      break;
    case 'hit':
      g.position.x = swing(28, 0.015);
      p.head.rotation.z = swing(28, 0.12);
      for (const a of p.arms) a.rotation.x = 0.5;
      break;
    case 'collect':
      p.arms.forEach((a) => (a.rotation.x = -1.3));
      g.position.y += Math.abs(swing(7, 0.015));
      break;
    case 'build':
      p.arms.forEach((a, i) => (a.rotation.x = -1.1 + swing(9, 0.5, i * 0.4)));
      p.head.rotation.x = 0.2;
      break;
    case 'defeat':
      g.rotation.x = 0.5;
      g.position.y -= 0.04;
      for (const a of p.arms) a.rotation.x = 0.4;
      break;
    case 'sit':
      g.position.y -= 0.06;
      for (const l of p.legs) l.rotation.x = -1.2;
      for (const a of p.arms) a.rotation.x = 0.3;
      break;
    default:
      // fermo: respira e muove appena la testa
      g.position.y += swing(2, 0.006);
      p.head.rotation.y = swing(0.7, 0.18);
      break;
  }
  if (pose !== 'hit') g.position.x = 0;
}

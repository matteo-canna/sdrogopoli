// Dadi 3D: cadono e rotolano vicino alla pedina e si fermano sul risultato del motore.
import * as THREE from 'three';

export const DICE_SECONDS = 0.9;
// valore su ciascuna faccia del dado, nell'ordine delle facce di BoxGeometry
const DIE_FACES = [3, 4, 1, 6, 2, 5];
// rotazione che porta in alto la faccia con il valore indicato
const FACE_UP: Record<number, THREE.Euler> = {
  1: new THREE.Euler(0, 0, 0),
  6: new THREE.Euler(Math.PI, 0, 0),
  2: new THREE.Euler(-Math.PI / 2, 0, 0),
  5: new THREE.Euler(Math.PI / 2, 0, 0),
  3: new THREE.Euler(0, 0, Math.PI / 2),
  4: new THREE.Euler(0, 0, -Math.PI / 2),
};

interface DiceAnim {
  start: THREE.Vector3;
  end: THREE.Vector3;
  final: THREE.Euler;
  spin: THREE.Vector3;
  t: number;
}


export class Dice3D {
  private meshes: THREE.Mesh[];
  private anim: (DiceAnim | null)[] = [null, null];
  private hideAt = 0;

  constructor(scene: THREE.Scene) {
    this.meshes = [makeDie(), makeDie()];
    for (const m of this.meshes) scene.add(m);
  }

  // Lancia i dadi vicino al punto "at"; restano visibili fino a "hideAt" (secondi dell'orologio della scena).
  roll(values: [number, number], at: THREE.Vector3, hideAt: number): void {
    // un po' verso il centro del tabellone, così restano sul piano verde
    const inward = at.clone().multiplyScalar(-1).setY(0);
    if (inward.lengthSq() > 0.01) inward.normalize();
    const side = new THREE.Vector3(-inward.z, 0, inward.x);
    const center = at.clone().add(inward.multiplyScalar(1.6));
    values.forEach((v, i) => {
      const die = this.meshes[i];
      const final = FACE_UP[v].clone();
      final.y += Math.random() * Math.PI * 2;
      const end = center.clone().add(side.clone().multiplyScalar(i === 0 ? -0.32 : 0.32)).setY(0.17);
      const start = end.clone().add(new THREE.Vector3((Math.random() - 0.5) * 0.6, 2.4, (Math.random() - 0.5) * 0.6));
      this.anim[i] = { start, end, final, spin: new THREE.Vector3(Math.PI * (4 + i * 2), Math.PI * 2, Math.PI * (2 + i * 2)), t: 0 };
      die.visible = true;
    });
    this.hideAt = hideAt;
  }

  // Ferma subito i dadi sul risultato.
  finish(): void {
    for (const a of this.anim) if (a) a.t = 1;
  }

  update(dt: number, speed: number, reduceMotion: boolean, now: number): void {
    this.anim.forEach((a, i) => {
      if (!a) return;
      const die = this.meshes[i];
      a.t = reduceMotion ? 1 : Math.min(a.t + (dt * speed) / DICE_SECONDS, 1);
      const u = a.t;
      // caduta con due piccoli rimbalzi
      const bounce = u < 0.6 ? 1 - (u / 0.6) ** 2 : u < 0.85 ? 0.12 * Math.sin(((u - 0.6) / 0.25) * Math.PI) : 0.03 * Math.sin(((u - 0.85) / 0.15) * Math.PI);
      const k = Math.min(u / 0.6, 1);
      die.position.set(
        a.start.x + (a.end.x - a.start.x) * k,
        a.end.y + Math.max(bounce, 0) * (a.start.y - a.end.y),
        a.start.z + (a.end.z - a.start.z) * k,
      );
      const ease = 1 - (1 - u) ** 3;
      die.rotation.set(a.final.x + a.spin.x * (1 - ease), a.final.y + a.spin.y * (1 - ease), a.final.z + a.spin.z * (1 - ease));
      if (u >= 1) this.anim[i] = null;
    });
    if (this.hideAt && now > this.hideAt) {
      for (const d of this.meshes) d.visible = false;
      this.hideAt = 0;
    }
  }

}

function dieFace(value: number): THREE.MeshStandardMaterial {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = '#fffdf6';
  ctx.fillRect(0, 0, 128, 128);
  ctx.fillStyle = '#1f2421';
  const pos: Record<number, [number, number][]> = {
    1: [[64, 64]],
    2: [[34, 34], [94, 94]],
    3: [[30, 30], [64, 64], [98, 98]],
    4: [[34, 34], [94, 34], [34, 94], [94, 94]],
    5: [[30, 30], [98, 30], [64, 64], [30, 98], [98, 98]],
    6: [[34, 28], [94, 28], [34, 64], [94, 64], [34, 100], [94, 100]],
  };
  for (const [x, y] of pos[value]) {
    ctx.beginPath();
    ctx.arc(x, y, value === 1 ? 14 : 11, 0, Math.PI * 2);
    ctx.fill();
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return new THREE.MeshStandardMaterial({ map: tex, roughness: 0.4 });
}

function makeDie(): THREE.Mesh {
  // facce nell'ordine di BoxGeometry (+x, -x, +y, -y, +z, -z); le facce opposte sommano 7
  const mats = DIE_FACES.map((v) => dieFace(v));
  const die = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.34, 0.34), mats);
  die.castShadow = true;
  die.visible = false;
  // prima si porta in alto la faccia giusta (X e Z), poi si gira attorno all'asse verticale (Y)
  die.rotation.order = 'YXZ';
  return die;
}


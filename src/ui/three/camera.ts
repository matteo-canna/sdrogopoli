// Camera: segue la pedina di turno da dietro le spalle, oppure mostra tutto il tabellone.
import * as THREE from 'three';

export type CameraMode = 'follow' | 'overview';
const UP = new THREE.Vector3(0, 1, 0);

export const MIN_ZOOM = 0.45;
export const MAX_ZOOM = 1.8;

export class CameraRig {
  // scelte di chi guarda: giro intorno al punto guardato (radianti) e distanza (1 = quella proposta)
  yaw = 0;
  zoom = 1;
  private target = new THREE.Vector3();
  private pos = new THREE.Vector3(0, 14, 11);
  private lookAt = new THREE.Vector3();

  constructor(private camera: THREE.PerspectiveCamera) {
    camera.position.copy(this.pos);
  }

  // "token" null = vista d'insieme.
  update(dt: number, token: THREE.Object3D | null, reduceMotion: boolean): void {
    if (!token) {
      this.target.set(0, 0, 0);
      this.pos.set(0, 12, 9.5);
    } else {
      // la camera sta all'esterno del tabellone, alle spalle della pedina, e guarda verso il centro
      const p = token.position;
      const out = new THREE.Vector3(p.x, 0, p.z);
      if (out.lengthSq() < 0.01) out.set(0, 0, 1);
      out.normalize();
      this.target.set(p.x * 0.8, 0, p.z * 0.8);
      this.pos.set(p.x + out.x * 3.4, 3.7, p.z + out.z * 3.4);
    }
    if (this.yaw || this.zoom !== 1) {
      const off = this.pos.clone().sub(this.target).applyAxisAngle(UP, this.yaw).multiplyScalar(this.zoom);
      this.pos.copy(this.target).add(off);
    }
    // inseguimento morbido (indipendente dalla frequenza dei fotogrammi)
    const k = reduceMotion ? 1 : 1 - Math.exp(-dt * 3);
    this.camera.position.lerp(this.pos, k);
    this.lookAt.lerp(this.target, k);
    this.camera.lookAt(this.lookAt);
  }

  // Gesti: girare intorno e avvicinarsi.
  rotate(delta: number): void {
    this.yaw = Math.atan2(Math.sin(this.yaw + delta), Math.cos(this.yaw + delta));
  }

  zoomBy(factor: number): void {
    this.zoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, this.zoom * factor));
  }

  // Vero se chi guarda ha girato o avvicinato la camera.
  get moved(): boolean {
    return Math.abs(this.yaw) > 1e-3 || Math.abs(this.zoom - 1) > 1e-3;
  }

  reset(): void {
    this.yaw = 0;
    this.zoom = 1;
  }

  // Vero quando la camera è arrivata dove deve stare.
  get settled(): boolean {
    return this.camera.position.distanceToSquared(this.pos) < 1e-4 && this.lookAt.distanceToSquared(this.target) < 1e-4;
  }

  // Su schermi stretti allarga il campo visivo per vedere tutto il tabellone.
  resize(w: number, h: number): void {
    this.camera.aspect = w / h;
    this.camera.fov = w / h < 0.8 ? 60 : 45;
    this.camera.updateProjectionMatrix();
  }
}

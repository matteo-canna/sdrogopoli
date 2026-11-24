// Camera: segue la pedina di turno da dietro le spalle, oppure mostra tutto il tabellone.
import * as THREE from 'three';

export type CameraMode = 'follow' | 'overview';

export class CameraRig {
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
    // inseguimento morbido (indipendente dalla frequenza dei fotogrammi)
    const k = reduceMotion ? 1 : 1 - Math.exp(-dt * 3);
    this.camera.position.lerp(this.pos, k);
    this.lookAt.lerp(this.target, k);
    this.camera.lookAt(this.lookAt);
  }

  // Su schermi stretti allarga il campo visivo per vedere tutto il tabellone.
  resize(w: number, h: number): void {
    this.camera.aspect = w / h;
    this.camera.fov = w / h < 0.8 ? 60 : 45;
    this.camera.updateProjectionMatrix();
  }
}

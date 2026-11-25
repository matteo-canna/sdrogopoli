// Pedine 3D realistiche HD+ per Sdrogopoli (30 modelli: 20 oggetti + 10 personaggi articolati).
// API 100% compatibile con board3d.ts e main.ts.
import * as THREE from 'three';
import type { Appearance } from '../../engine';
import { normalizeAppearance } from '../characters';
import { createPalette, getStudioEnvMap } from './materials';
import { buildPedestal, buildTokenModel, type AnimParts } from './models';

export type Pose = 'idle' | 'walk' | 'jump' | 'cheer' | 'defeat' | 'sit' | 'hit' | 'collect' | 'build';
export type Reaction = 'cheer' | 'hit' | 'collect' | 'build';

// Nessun file esterno da scaricare: tutti i 30 modelli sono costruiti proceduralmente all'istante.
export function loadModel(_characterId: string): Promise<void> {
  return Promise.resolve();
}

export class CharacterModel {
  readonly root = new THREE.Group();
  private pivot = new THREE.Group();
  private subject = new THREE.Group();
  private anim: AnimParts;
  private pose: Pose = 'idle';
  private basePose: Pose = 'idle';
  private reactionUntil = 0;
  private time = 0;
  private poseTime = 0;

  constructor(look: Appearance, height: number) {
    const n = normalizeAppearance(look);
    const finish = n.finish ?? 'real';
    const baseStyle = n.baseStyle ?? 'minimal';
    const accent = n.accentColor ?? '#f4b400';

    const palette = createPalette(finish, n.color, accent);
    const { group: pedestal, topY } = buildPedestal(baseStyle, n.color, accent);
    const built = buildTokenModel(n.character, palette, n.color, accent);
    this.anim = built.anim;

    const box = new THREE.Box3().setFromObject(built.group);
    const size = new THREE.Vector3();
    const center = new THREE.Vector3();
    box.getSize(size);
    box.getCenter(center);

    const maxHoriz = Math.max(size.x, size.z, 0.01);
    const maxDim = Math.max(size.y, maxHoriz * 0.92, 0.01);
    const fitScale = (built.anim.charRig ? 1.02 : 0.92) / maxDim;

    built.group.scale.setScalar(fitScale);
    built.group.position.set(-center.x * fitScale, -box.min.y * fitScale + topY, -center.z * fitScale);

    this.subject.add(built.group);
    this.pivot.add(pedestal, this.subject);

    this.pivot.scale.setScalar(height / 1.05);
    this.root.add(this.pivot);
  }

  play(pose: Pose, _fade = 0.2): void {
    if (pose === this.pose) return;
    this.pose = pose;
    this.poseTime = 0;
  }

  get currentPose(): Pose | null {
    return this.pose;
  }

  setBase(pose: Pose, fade = 0.2, interrupt = false): void {
    this.basePose = pose;
    if (interrupt) this.reactionUntil = 0;
    if (this.time >= this.reactionUntil) this.play(pose, fade);
  }

  react(reaction: Reaction): void {
    this.play(reaction, 0.15);
    const dur = reaction === 'cheer' ? 1.8 : reaction === 'build' ? 1.3 : 1.0;
    this.reactionUntil = this.time + dur;
  }

  update(dt: number): void {
    this.time += dt;
    this.poseTime += dt;
    if (this.reactionUntil > 0 && this.time >= this.reactionUntil) {
      this.reactionUntil = 0;
      this.play(this.basePose, 0.2);
    }

    const t = this.poseTime;
    this.pivot.position.set(0, 0, 0);
    this.pivot.rotation.set(0, 0, 0);
    this.subject.position.y = 0;
    this.subject.rotation.set(0, 0, 0);

    // Micro-animazioni meccaniche/magiche continue
    const wheelSpeed = this.pose === 'walk' ? 14 : this.pose === 'cheer' ? 9 : 0.8;
    if (this.anim.wheels) for (const w of this.anim.wheels) w.rotation.x += dt * wheelSpeed;
    if (this.anim.spinY) for (const o of this.anim.spinY) o.rotation.y += dt * 1.1;
    if (this.anim.spinZ) for (const o of this.anim.spinZ) o.rotation.z += dt * (this.pose === 'walk' ? 24 : 11);
    if (this.anim.gears) for (const gr of this.anim.gears) gr.obj.rotation.z += dt * gr.speed;
    if (this.anim.secondHand) this.anim.secondHand.rotation.z = -Math.floor(this.time) * (Math.PI / 30);
    if (this.anim.minuteHand) this.anim.minuteHand.rotation.z = 0.68 - this.time * 0.02;
    if (this.anim.pulse) {
      const s = 0.85 + Math.sin(this.time * 8) * 0.2;
      for (const m of this.anim.pulse) m.scale.setScalar(s);
    }

    // Animazione articolata dedicata ai 10 Personaggi HD+
    const rig = this.anim.charRig;
    if (rig) {
      const by = rig.baseBodyY ?? 0.66;
      const rxL = rig.restArmLX ?? 0;
      const rxR = rig.restArmRX ?? 0;
      const rzL = rig.restArmLZ ?? 0.06;
      const rzR = rig.restArmRZ ?? -0.06;
      const legY = rig.restLegRotY ?? 0.09;
      rig.body.position.set(0, by, 0);
      rig.body.rotation.set(0, 0, 0);
      rig.head.rotation.set(0, 0, 0);
      rig.armL.rotation.set(rxL, 0, rzL);
      rig.armR.rotation.set(rxR, 0, rzR);
      rig.legL.rotation.set(0, legY, 0);
      rig.legR.rotation.set(0, -legY, 0);
      if (rig.cape) rig.cape.rotation.x = 0.04 + Math.sin(this.time * 2.5) * 0.035;

      switch (this.pose) {
        case 'idle':
          rig.body.position.y = by + Math.sin(this.time * 2.5) * 0.012;
          rig.head.rotation.y = Math.sin(this.time * 1.0) * 0.12;
          rig.armL.rotation.z = rzL + Math.sin(this.time * 2.5) * 0.025;
          rig.armR.rotation.z = rzR - Math.sin(this.time * 2.5) * 0.025;
          break;
        case 'walk': {
          const w = this.time * 10.5;
          rig.body.position.y = by + Math.abs(Math.sin(w)) * 0.045;
          rig.body.rotation.z = Math.sin(w) * 0.045;
          rig.legL.rotation.x = Math.sin(w) * 0.55;
          rig.legR.rotation.x = -Math.sin(w) * 0.55;
          rig.armL.rotation.x = rxL - Math.sin(w) * 0.45;
          rig.armR.rotation.x = rxR + Math.sin(w) * 0.45;
          if (rig.cape) rig.cape.rotation.x = 0.24 + Math.abs(Math.sin(w)) * 0.14;
          break;
        }
        case 'jump': {
          const p = Math.min(t / 0.55, 1);
          const arc = Math.sin(p * Math.PI);
          rig.body.position.y = by + arc * 0.38;
          rig.armL.rotation.x = -arc * 1.4;
          rig.armR.rotation.x = -arc * 1.4;
          rig.armL.rotation.z = rzL + arc * 0.9;
          rig.armR.rotation.z = rzR - arc * 0.9;
          rig.legL.rotation.x = arc * 0.35;
          rig.legR.rotation.x = -arc * 0.35;
          break;
        }
        case 'cheer': {
          const hop = Math.abs(Math.sin(t * 7.2));
          rig.body.position.y = by + hop * 0.22;
          this.pivot.rotation.y = t * Math.PI * 2.1;
          rig.armL.rotation.x = -2.2 + Math.sin(t * 14) * 0.22;
          rig.armR.rotation.x = -2.2 - Math.sin(t * 14) * 0.22;
          rig.armL.rotation.z = 0.45;
          rig.armR.rotation.z = -0.45;
          break;
        }
        case 'build': {
          const swing = Math.sin(t * 13);
          rig.body.rotation.x = 0.14 + Math.max(0, swing) * 0.08;
          rig.armR.rotation.x = -1.35 + swing * 0.85;
          rig.armL.rotation.x = -0.55;
          break;
        }
        case 'collect': {
          rig.body.position.y = by + Math.sin(t * 6) * 0.04;
          rig.armR.rotation.x = -1.8 + Math.sin(t * 14) * 0.3;
          rig.armR.rotation.z = -0.35;
          rig.head.rotation.x = -0.12 + Math.sin(t * 7) * 0.08;
          break;
        }
        case 'hit': {
          const k = Math.max(0, 1 - t / 0.85);
          rig.body.rotation.x = -0.38 * k;
          rig.body.rotation.z = Math.sin(t * 28) * 0.18 * k;
          rig.armL.rotation.z = 0.9 * k;
          rig.armR.rotation.z = -0.9 * k;
          break;
        }
        case 'sit': {
          rig.body.position.y = by * 0.56;
          rig.legL.rotation.x = -1.32;
          rig.legR.rotation.x = -1.32;
          rig.head.rotation.y = Math.sin(this.time * 1.4) * 0.32;
          rig.head.rotation.x = 0.12;
          break;
        }
        case 'defeat': {
          const k = Math.min(t / 0.55, 1);
          const ease = 1 - Math.pow(1 - k, 3);
          rig.body.rotation.x = -ease * (Math.PI / 2);
          rig.body.position.y = by - ease * (by - 0.18);
          rig.armL.rotation.z = ease * 1.1;
          rig.armR.rotation.z = -ease * 1.1;
          break;
        }
      }
      return;
    }

    // Animazioni per i 20 Oggetti HD+
    switch (this.pose) {
      case 'idle':
        this.subject.position.y = Math.sin(this.time * 2.2) * 0.008;
        break;
      case 'walk': {
        const w = this.time * 12;
        this.pivot.position.y = Math.abs(Math.sin(w)) * 0.08;
        this.pivot.rotation.x = 0.1 + Math.sin(w) * 0.06;
        this.pivot.rotation.z = Math.cos(w) * 0.05;
        break;
      }
      case 'jump': {
        const p = Math.min(t / 0.55, 1);
        const arc = Math.sin(p * Math.PI);
        this.pivot.position.y = arc * 0.34;
        this.pivot.rotation.x = -arc * 0.35;
        this.pivot.rotation.y = p * Math.PI * 2;
        break;
      }
      case 'cheer': {
        const hop = Math.abs(Math.sin(t * 7.2));
        this.pivot.position.y = hop * 0.2;
        this.pivot.rotation.y = t * Math.PI * 2.4;
        this.pivot.rotation.z = Math.sin(t * 14) * 0.09;
        break;
      }
      case 'build': {
        const k = Math.abs(Math.sin(t * 10));
        this.pivot.position.y = k * 0.08;
        this.pivot.rotation.x = k * 0.22;
        break;
      }
      case 'collect': {
        const hop = Math.abs(Math.sin(t * 9));
        this.pivot.position.y = hop * 0.12;
        this.pivot.rotation.z = Math.sin(t * 12) * 0.14;
        break;
      }
      case 'hit': {
        const k = Math.max(0, 1 - t / 0.85);
        this.pivot.rotation.x = -0.34 * k;
        this.pivot.rotation.z = Math.sin(t * 28) * 0.22 * k;
        break;
      }
      case 'sit':
        this.pivot.rotation.z = 0.16 + Math.sin(this.time * 1.4) * 0.05;
        this.pivot.rotation.x = 0.1;
        break;
      case 'defeat': {
        const k = Math.min(t / 0.55, 1);
        const ease = 1 - Math.pow(1 - k, 3);
        this.pivot.rotation.z = -ease * (Math.PI / 2);
        this.pivot.position.y = ease * 0.16;
        break;
      }
    }
  }

  dispose(): void {
    this.root.traverse((o) => {
      const m = o as THREE.Mesh;
      if (!m.isMesh) return;
      m.geometry.dispose();
      const mats = Array.isArray(m.material) ? m.material : [m.material];
      for (const material of mats) material.dispose();
    });
  }
}

export async function createCharacter(look: Appearance, height: number): Promise<CharacterModel> {
  return new CharacterModel(look, height);
}

export class CharacterPreview {
  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera = new THREE.PerspectiveCamera(34, 1, 0.1, 25);
  private clock = new THREE.Clock();
  private character: CharacterModel | null = null;
  private resizeObserver: ResizeObserver;
  private frame = 0;
  private request = 0;
  private reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;

  constructor(private container: HTMLElement) {
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.15;
    container.appendChild(this.renderer.domElement);

    this.scene.environment = getStudioEnvMap(this.renderer);
    this.camera.position.set(0, 1.35, 3.05);
    this.camera.lookAt(0, 0.72, 0);

    const hemi = new THREE.HemisphereLight(0xffffff, 0x7a8894, 0.9);
    const key = new THREE.DirectionalLight(0xfff7ea, 1.8);
    key.position.set(3, 5, 4);
    key.castShadow = true;
    const rim = new THREE.DirectionalLight(0xc2e0ff, 1.1);
    rim.position.set(-3, 3, -3);
    this.scene.add(hemi, key, rim);

    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(container);
    this.resize();
    this.loop();
  }

  moveTo(container: HTMLElement): void {
    if (container === this.container) return;
    this.resizeObserver.unobserve(this.container);
    this.container = container;
    container.appendChild(this.renderer.domElement);
    this.resizeObserver.observe(container);
    this.resize();
  }

  async show(look: Appearance): Promise<void> {
    const req = ++this.request;
    const next = await createCharacter(look, 1.55);
    if (req !== this.request || !this.frame) {
      next.dispose();
      return;
    }
    const yaw = this.character?.root.rotation.y ?? -0.5;
    if (this.character) {
      this.scene.remove(this.character.root);
      this.character.dispose();
    }
    this.character = next;
    next.root.rotation.y = yaw;
    this.scene.add(next.root);
  }

  private loop = (): void => {
    this.frame = requestAnimationFrame(this.loop);
    const dt = Math.min(this.clock.getDelta(), 0.1);
    if (this.character) {
      this.character.update(dt);
      if (!this.reduceMotion) this.character.root.rotation.y += dt * 0.55;
    }
    this.renderer.render(this.scene, this.camera);
  };

  private resize(): void {
    const w = this.container.clientWidth || 1;
    const h = this.container.clientHeight || 1;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  dispose(): void {
    cancelAnimationFrame(this.frame);
    this.frame = 0;
    this.character?.dispose();
    this.resizeObserver.disconnect();
    this.renderer.dispose();
    this.renderer.forceContextLoss();
    this.renderer.domElement.remove();
  }
}

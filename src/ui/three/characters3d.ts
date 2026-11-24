// Personaggi 3D animati usati come pedine (modelli KayKit, CC0).
import * as THREE from 'three';
import { GLTFLoader, type GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { clone as cloneSkinned } from 'three/examples/jsm/utils/SkeletonUtils.js';
import type { Appearance } from '../../engine';
import { characterDef } from '../characters';

// altezza del modello originale (circa 2,4 unità) ridotta a quella di una pedina
const MODEL_HEIGHT = 2.4;

export type Pose = 'idle' | 'walk' | 'jump' | 'cheer' | 'defeat' | 'sit' | 'hit' | 'collect' | 'build';
const CLIPS: Record<Pose, string> = {
  idle: 'Idle',
  walk: 'Walking_A',
  jump: 'Jump_Full_Short',
  cheer: 'Cheer',
  defeat: 'Death_A',
  // seduto per terra in Caserma
  sit: 'Sit_Floor_Idle',
  // colpito: quando paga
  hit: 'Hit_A',
  // gesto con la mano: quando incassa
  collect: 'Interact',
  // usa un attrezzo: quando costruisce
  build: 'Use_Item',
};
// Reazioni brevi agli eventi: finite, si torna alla posa di base.
export type Reaction = 'cheer' | 'hit' | 'collect' | 'build';
const ONCE: Pose[] = ['jump', 'defeat', 'hit', 'collect', 'build'];

const loader = new GLTFLoader();
const cache = new Map<string, Promise<GLTF>>();

// Carica un modello una sola volta (le pedine uguali ne condividono i dati).
export function loadModel(characterId: string): Promise<GLTF> {
  const def = characterDef(characterId);
  let p = cache.get(def.id);
  if (!p) {
    p = loader.loadAsync(`${import.meta.env.BASE_URL}characters/${def.file}`);
    // se il caricamento fallisce si potrà riprovare
    p.catch(() => cache.delete(def.id));
    cache.set(def.id, p);
  }
  return p;
}

// Un personaggio pronto per la scena, con le sue animazioni.
export class CharacterModel {
  readonly root = new THREE.Group();
  private mixer: THREE.AnimationMixer;
  private actions = new Map<Pose, THREE.AnimationAction>();
  private pose: Pose | null = null;
  // posa a cui tornare dopo una reazione
  private basePose: Pose = 'idle';
  private reactionUntil = 0;
  private time = 0;
  private base: THREE.Mesh;

  constructor(gltf: GLTF, look: Appearance, height: number) {
    const def = characterDef(look.character);
    const model = cloneSkinned(gltf.scene) as THREE.Group;
    model.scale.setScalar(height / MODEL_HEIGHT);
    const tint = new THREE.Color(look.color);
    model.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (!mesh.isMesh) return;
      mesh.castShadow = true;
      // le mesh attaccate alle mani (handslot) sono armi e oggetti: si vede solo quello scelto
      const inHand = o.parent?.name.startsWith('handslot') ?? false;
      if (inHand) mesh.visible = o.name === look.item;
      else if (o.name === def.hat) mesh.visible = look.hat;
      else if (o.name === def.cape) {
        mesh.visible = look.cape;
        // il mantello prende il colore del giocatore
        const mat = (mesh.material as THREE.MeshStandardMaterial).clone();
        mat.color = tint.clone().lerp(new THREE.Color(0xffffff), 0.15);
        mesh.material = mat;
      }
    });
    this.root.add(model);

    // base colorata sotto i piedi: si riconosce il giocatore anche da lontano
    const base = (this.base = new THREE.Mesh(
      new THREE.CylinderGeometry(height * 0.3, height * 0.33, height * 0.06, 32),
      new THREE.MeshStandardMaterial({ color: tint, roughness: 0.35, metalness: 0.1 }),
    ));
    base.position.y = height * 0.03;
    base.castShadow = true;
    base.receiveShadow = true;
    this.root.add(base);
    model.position.y = height * 0.06;

    this.mixer = new THREE.AnimationMixer(model);
    for (const pose of Object.keys(CLIPS) as Pose[]) {
      const clip = gltf.animations.find((a) => a.name === CLIPS[pose]);
      if (!clip) continue;
      const action = this.mixer.clipAction(clip);
      if (ONCE.includes(pose)) {
        action.setLoop(THREE.LoopOnce, 1);
        action.clampWhenFinished = true;
      }
      this.actions.set(pose, action);
    }
    this.play('idle', 0);
  }

  // Passa dolcemente a un'altra animazione.
  play(pose: Pose, fade = 0.2): void {
    if (pose === this.pose) return;
    const next = this.actions.get(pose);
    if (!next) return;
    const prev = this.pose ? this.actions.get(this.pose) : undefined;
    next.reset().setEffectiveWeight(1).play();
    if (prev && fade > 0) next.crossFadeFrom(prev, fade, false);
    else prev?.stop();
    this.pose = pose;
  }

  get currentPose(): Pose | null {
    return this.pose;
  }

  // Posa continua (fermo, cammina, seduto…): una reazione in corso la rimanda alla fine.
  // Con interrupt la reazione si interrompe subito (per esempio quando deve camminare).
  setBase(pose: Pose, fade = 0.2, interrupt = false): void {
    this.basePose = pose;
    if (interrupt) this.reactionUntil = 0;
    if (this.time >= this.reactionUntil) this.play(pose, fade);
  }

  // Reazione breve a un evento (comprare, pagare, incassare, costruire).
  react(reaction: Reaction): void {
    const action = this.actions.get(reaction);
    if (!action) return;
    this.play(reaction, 0.15);
    // l'esultanza gira in tondo: ne basta un giro e mezzo
    const seconds = reaction === 'cheer' ? Math.min(action.getClip().duration * 1.5, 2.5) : action.getClip().duration;
    this.reactionUntil = this.time + seconds;
  }

  get reacting(): boolean {
    return this.time < this.reactionUntil;
  }

  update(dt: number): void {
    this.time += dt;
    if (this.reactionUntil && this.time >= this.reactionUntil) {
      this.reactionUntil = 0;
      this.play(this.basePose, 0.25);
    }
    this.mixer.update(dt);
  }

  dispose(): void {
    this.mixer.stopAllAction();
    // le geometrie del modello sono condivise con le altre copie: si libera solo la base
    this.base.geometry.dispose();
    (this.base.material as THREE.Material).dispose();
  }
}

export async function createCharacter(look: Appearance, height: number): Promise<CharacterModel> {
  const gltf = await loadModel(look.character);
  return new CharacterModel(gltf, look, height);
}

// Anteprima di un personaggio che gira su sé stesso (schermata di personalizzazione).
export class CharacterPreview {
  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera = new THREE.PerspectiveCamera(30, 1, 0.1, 50);
  private clock = new THREE.Clock();
  private character: CharacterModel | null = null;
  private frame = 0;
  private request = 0;
  private resizeObserver: ResizeObserver;
  private reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;

  constructor(private container: HTMLElement) {
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    container.appendChild(this.renderer.domElement);
    this.scene.add(new THREE.HemisphereLight(0xffffff, 0x8a7f70, 2.2));
    const sun = new THREE.DirectionalLight(0xffffff, 2);
    sun.position.set(2, 4, 3);
    this.scene.add(sun);
    this.camera.position.set(0, 1.55, 4.6);
    this.camera.lookAt(0, 1.1, 0);
    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(container);
    this.resize();
    this.loop();
  }

  // Sposta l'anteprima in un altro contenitore (quando l'editor viene ridisegnato).
  moveTo(container: HTMLElement): void {
    if (container === this.container) return;
    this.resizeObserver.unobserve(this.container);
    this.container = container;
    container.appendChild(this.renderer.domElement);
    this.resizeObserver.observe(container);
    this.resize();
  }

  // Mostra un aspetto.
  async show(look: Appearance): Promise<void> {
    const req = ++this.request;
    try {
      const next = await createCharacter(look, 1.7);
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
    } catch {
      /* anteprima non disponibile */
    }
  }

  private loop = (): void => {
    this.frame = requestAnimationFrame(this.loop);
    const dt = Math.min(this.clock.getDelta(), 0.1);
    if (this.character) {
      this.character.update(dt);
      if (!this.reduceMotion) this.character.root.rotation.y += dt * 0.6;
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

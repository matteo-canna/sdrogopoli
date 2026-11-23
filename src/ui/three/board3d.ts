// Tabellone 3D: caselle, pedine animate, case e camera che segue la pedina in movimento.
import * as THREE from 'three';
import { board } from '../../data';
import type { GameState } from '../../engine';
import { gridPosition, PLAYER_COLORS } from '../view';
import { centerTexture, spaceTexture } from './textures';

const SIZE = board.spaces.length;
const HOP_SECONDS = 0.22;
const TILE = 0.96;

// Posizione nel mondo 3D del centro di una casella (tabellone di 11×11 unità centrato nell'origine).
function spaceCenter(index: number): THREE.Vector3 {
  const { row, col } = gridPosition(index);
  return new THREE.Vector3(col - 6, 0, row - 6);
}

// Rotazione del testo: si legge guardando la casella dall'esterno del tabellone.
function textRotation(index: number): number {
  if (index < 10) return 0;
  if (index < 20) return -Math.PI / 2;
  if (index < 30) return Math.PI;
  return Math.PI / 2;
}

// Piccolo spostamento per non sovrapporre le pedine nella stessa casella.
const TOKEN_OFFSETS = [new THREE.Vector3(-0.2, 0, -0.2), new THREE.Vector3(0.2, 0, -0.2), new THREE.Vector3(-0.2, 0, 0.2), new THREE.Vector3(0.2, 0, 0.2)];

interface Hop {
  from: THREE.Vector3;
  to: THREE.Vector3;
  height: number;
}

interface TokenView {
  mesh: THREE.Group;
  shownPosition: number;
  queue: Hop[];
  hopTime: number;
}

export type CameraMode = 'follow' | 'overview';

export class Board3D {
  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera = new THREE.PerspectiveCamera(45, 1, 0.1, 100);
  private tiles: THREE.Mesh[] = [];
  private buildings: THREE.Group[] = [];
  private ownerMarkers: THREE.Mesh[] = [];
  private tokens: TokenView[] = [];
  private raycaster = new THREE.Raycaster();
  private clock = new THREE.Clock();
  private camTarget = new THREE.Vector3();
  private camPos = new THREE.Vector3(0, 14, 11);
  private lookAt = new THREE.Vector3();
  private focusPlayer = 0;
  private selected: string | null = null;
  private resizeObserver: ResizeObserver;
  private frame = 0;
  private busy = false;
  private reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
  cameraMode: CameraMode = 'follow';

  constructor(
    private container: HTMLElement,
    private onSpaceClick: (spaceId: string) => void,
    private onBusyChange: (busy: boolean) => void,
  ) {
    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    container.appendChild(this.renderer.domElement);

    this.buildScene();
    this.camera.position.copy(this.camPos);

    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(container);
    this.resize();
    this.renderer.domElement.addEventListener('pointerdown', this.onPointerDown);
    this.renderer.domElement.addEventListener('pointerup', this.onPointerUp);
    this.loop();
  }

  // ---------- costruzione della scena ----------

  private buildScene(): void {
    const dark = window.matchMedia?.('(prefers-color-scheme: dark)').matches;
    this.scene.background = new THREE.Color(dark ? 0x161a18 : 0xf3efe3);

    this.scene.add(new THREE.HemisphereLight(0xffffff, 0x8a9a8a, 1.6));
    const sun = new THREE.DirectionalLight(0xffffff, 2.2);
    sun.position.set(6, 12, 8);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    const sc = sun.shadow.camera;
    sc.left = sc.bottom = -8;
    sc.right = sc.top = 8;
    this.scene.add(sun);

    // base del tabellone
    const base = new THREE.Mesh(
      new THREE.BoxGeometry(11.4, 0.3, 11.4),
      new THREE.MeshStandardMaterial({ color: 0x6b8f71, roughness: 0.9 }),
    );
    base.position.y = -0.2;
    base.receiveShadow = true;
    this.scene.add(base);

    const center = new THREE.Mesh(
      new THREE.PlaneGeometry(9, 9),
      new THREE.MeshStandardMaterial({ map: centerTexture(), roughness: 0.95 }),
    );
    center.rotation.x = -Math.PI / 2;
    center.position.y = -0.04;
    center.receiveShadow = true;
    this.scene.add(center);

    // caselle: un blocchetto con la faccia superiore disegnata
    const geo = new THREE.BoxGeometry(TILE, 0.1, TILE);
    const sideMat = new THREE.MeshStandardMaterial({ color: 0xeae4d3, roughness: 0.8 });
    board.spaces.forEach((space, i) => {
      const tex = spaceTexture(space, this.renderer);
      tex.center.set(0.5, 0.5);
      tex.rotation = textRotation(i);
      const topMat = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.85, emissive: 0x000000 });
      // ordine facce BoxGeometry: +x, -x, +y, -y, +z, -z
      const tile = new THREE.Mesh(geo, [sideMat, sideMat, topMat, sideMat, sideMat, sideMat]);
      tile.position.copy(spaceCenter(i)).setY(-0.05);
      tile.receiveShadow = true;
      tile.userData.spaceId = space.id;
      this.scene.add(tile);
      this.tiles.push(tile);

      const group = new THREE.Group();
      group.position.copy(spaceCenter(i));
      this.scene.add(group);
      this.buildings.push(group);
    });
  }

  private makeToken(color: string): THREE.Group {
    const mat = new THREE.MeshStandardMaterial({ color, roughness: 0.35, metalness: 0.1 });
    const g = new THREE.Group();
    const body = new THREE.Mesh(new THREE.ConeGeometry(0.16, 0.42, 24), mat);
    body.position.y = 0.21;
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.11, 24, 16), mat);
    head.position.y = 0.45;
    for (const m of [body, head]) {
      m.castShadow = true;
      g.add(m);
    }
    return g;
  }

  private tokenRest(playerId: number, index: number): THREE.Vector3 {
    return spaceCenter(index).add(TOKEN_OFFSETS[playerId]);
  }

  // ---------- aggiornamento dallo stato del motore ----------

  update(state: GameState, selected: string | null): void {
    // crea le pedine alla prima chiamata (o se cambia la partita)
    if (this.tokens.length !== state.players.length) {
      for (const t of this.tokens) this.scene.remove(t.mesh);
      this.tokens = state.players.map((p) => {
        const mesh = this.makeToken(PLAYER_COLORS[p.id]);
        mesh.position.copy(this.tokenRest(p.id, p.position));
        this.scene.add(mesh);
        return { mesh, shownPosition: p.position, queue: [], hopTime: 0 };
      });
    }

    state.players.forEach((p, i) => {
      const view = this.tokens[i];
      view.mesh.visible = !p.bankrupt;
      if (p.position !== view.shownPosition) {
        this.enqueueMove(view, p.id, view.shownPosition, p.position, p.inJail);
        view.shownPosition = p.position;
        this.focusPlayer = p.id;
      }
    });
    if (!this.tokens.some((t) => t.queue.length)) this.focusPlayer = state.current;

    this.updateBuildings(state);
    this.setSelected(selected);
  }

  // Prepara i salti casella per casella. Indietro di poche caselle (carte) si cammina all'indietro;
  // verso la Caserma si fa un unico grande salto.
  private enqueueMove(view: TokenView, playerId: number, from: number, to: number, jailed: boolean): void {
    const forward = (to - from + SIZE) % SIZE;
    const backward = (from - to + SIZE) % SIZE;
    const path: number[] = [];
    if (jailed && board.spaces[to].type === 'jail') path.push(to);
    else if (backward <= 3) for (let k = 1; k <= backward; k++) path.push((from - k + SIZE) % SIZE);
    else for (let k = 1; k <= forward; k++) path.push((from + k) % SIZE);

    let prev = view.queue.length ? view.queue[view.queue.length - 1].to : view.mesh.position.clone();
    for (const idx of path) {
      const next = this.tokenRest(playerId, idx);
      view.queue.push({ from: prev, to: next, height: path.length === 1 && jailed ? 2 : 0.45 });
      prev = next;
    }
    if (this.reduceMotion) {
      view.mesh.position.copy(prev);
      view.queue = [];
    }
  }

  private updateBuildings(state: GameState): void {
    for (const m of this.ownerMarkers) this.scene.remove(m);
    this.ownerMarkers = [];
    board.spaces.forEach((space, i) => {
      const group = this.buildings[i];
      const own = state.ownership[space.id];
      const key = own ? `${own.owner}-${own.houses}-${own.mortgaged}` : '';
      if (group.userData.key === key) return;
      group.userData.key = key;
      group.clear();
      if (!own) return;
      // bordino del colore del proprietario
      const ring = new THREE.Mesh(
        new THREE.TorusGeometry(0.06, 0.025, 8, 16),
        new THREE.MeshStandardMaterial({ color: PLAYER_COLORS[own.owner], transparent: own.mortgaged, opacity: own.mortgaged ? 0.35 : 1 }),
      );
      ring.rotation.x = -Math.PI / 2;
      ring.position.set(0.36, 0.03, 0.36);
      group.add(ring);
      if (own.houses === 5) {
        const hotel = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.3, 0.22), new THREE.MeshStandardMaterial({ color: 0xc0392b }));
        hotel.position.set(0, 0.15, 0);
        hotel.castShadow = true;
        this.placeOnBand(hotel, i);
        group.add(hotel);
      } else {
        for (let h = 0; h < own.houses; h++) {
          const house = new THREE.Group();
          const walls = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.12, 0.14), new THREE.MeshStandardMaterial({ color: 0x2e9e5b }));
          walls.position.y = 0.06;
          const roof = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.1, 4), new THREE.MeshStandardMaterial({ color: 0x1e6b3d }));
          roof.position.y = 0.17;
          roof.rotation.y = Math.PI / 4;
          for (const m of [walls, roof]) { m.castShadow = true; house.add(m); }
          house.position.set(-0.27 + h * 0.18, 0, 0);
          this.placeOnBand(house, i);
          group.add(house);
        }
      }
    });
  }

  // Sposta un edificio sulla fascia colorata (il lato della casella verso il centro del tabellone).
  private placeOnBand(obj: THREE.Object3D, index: number): void {
    const angle = textRotation(index);
    const local = obj.position.clone().add(new THREE.Vector3(0, 0, -0.36));
    local.applyAxisAngle(new THREE.Vector3(0, 1, 0), angle);
    obj.position.copy(local);
    obj.rotation.y = angle;
  }

  private setSelected(spaceId: string | null): void {
    if (spaceId === this.selected) return;
    this.selected = spaceId;
    for (const tile of this.tiles) {
      const top = (tile.material as THREE.MeshStandardMaterial[])[2];
      top.emissive.setHex(tile.userData.spaceId === spaceId ? 0x2f6f4f : 0x000000);
      top.emissiveIntensity = 0.35;
    }
  }

  // ---------- camera ----------

  private updateCamera(dt: number): void {
    const token = this.tokens[this.focusPlayer]?.mesh;
    if (this.cameraMode === 'overview' || !token) {
      this.camTarget.set(0, 0, 0);
      this.camPos.set(0, 12, 9.5);
    } else {
      // la camera sta all'esterno del tabellone, alle spalle della pedina, e guarda verso il centro
      const p = token.position;
      const out = new THREE.Vector3(p.x, 0, p.z);
      if (out.lengthSq() < 0.01) out.set(0, 0, 1);
      out.normalize();
      this.camTarget.set(p.x * 0.7, 0, p.z * 0.7);
      this.camPos.set(p.x + out.x * 4.2, 4.8, p.z + out.z * 4.2);
    }
    // inseguimento morbido (indipendente dalla frequenza dei fotogrammi)
    const k = this.reduceMotion ? 1 : 1 - Math.exp(-dt * 3);
    this.camera.position.lerp(this.camPos, k);
    this.lookAt.lerp(this.camTarget, k);
    this.camera.lookAt(this.lookAt);
  }

  // ---------- ciclo di animazione ----------

  private loop = (): void => {
    this.frame = requestAnimationFrame(this.loop);
    const dt = Math.min(this.clock.getDelta(), 0.1);
    let moving = false;
    for (const t of this.tokens) {
      const hop = t.queue[0];
      if (!hop) continue;
      moving = true;
      t.hopTime += dt;
      const dur = hop.height > 1 ? HOP_SECONDS * 3 : HOP_SECONDS;
      const u = Math.min(t.hopTime / dur, 1);
      t.mesh.position.lerpVectors(hop.from, hop.to, u);
      t.mesh.position.y = Math.sin(Math.PI * u) * hop.height;
      if (u >= 1) {
        t.queue.shift();
        t.hopTime = 0;
      }
    }
    if (moving !== this.busy) {
      this.busy = moving;
      this.onBusyChange(moving);
    }
    this.updateCamera(dt);
    this.renderer.render(this.scene, this.camera);
  };

  private resize(): void {
    const w = this.container.clientWidth || 1;
    const h = this.container.clientHeight || 1;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    // su schermi stretti allarga il campo visivo per vedere tutto il tabellone
    this.camera.fov = w / h < 0.8 ? 60 : 45;
    this.camera.updateProjectionMatrix();
  }

  // ---------- clic sulle caselle ----------

  private down = { x: 0, y: 0 };
  private onPointerDown = (e: PointerEvent): void => {
    this.down = { x: e.clientX, y: e.clientY };
  };
  private onPointerUp = (e: PointerEvent): void => {
    if (Math.hypot(e.clientX - this.down.x, e.clientY - this.down.y) > 6) return;
    const rect = this.renderer.domElement.getBoundingClientRect();
    const ndc = new THREE.Vector2(((e.clientX - rect.left) / rect.width) * 2 - 1, -((e.clientY - rect.top) / rect.height) * 2 + 1);
    this.raycaster.setFromCamera(ndc, this.camera);
    const hit = this.raycaster.intersectObjects(this.tiles, false)[0];
    if (hit) this.onSpaceClick(hit.object.userData.spaceId);
  };

  dispose(): void {
    cancelAnimationFrame(this.frame);
    this.resizeObserver.disconnect();
    this.renderer.dispose();
    this.renderer.domElement.remove();
  }
}

// Vero se il browser supporta WebGL; altrimenti si usa il tabellone 2D.
export function webglAvailable(): boolean {
  try {
    const c = document.createElement('canvas');
    return !!(c.getContext('webgl2') || c.getContext('webgl'));
  } catch {
    return false;
  }
}

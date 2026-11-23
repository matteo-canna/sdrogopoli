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

const DICE_SECONDS = 0.9;
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
  private dice: THREE.Mesh[] = [];
  private diceAnim: (DiceAnim | null)[] = [null, null];
  private diceHideAt = 0;
  private tokensWaitUntil = 0;
  private marker!: THREE.Mesh;
  private currentPlayer = 0;
  private reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
  cameraMode: CameraMode = 'follow';
  // chiamata a ogni salto completato (per il suono)
  onHop: (() => void) | null = null;

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
    this.dice = [this.makeDie(), this.makeDie()];
    this.marker = this.makeMarker();
    this.scene.add(this.marker);
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

  // Ogni giocatore ha una pedina di forma diversa, oltre che di colore diverso.
  private makeToken(color: string, shape: number): THREE.Group {
    const mat = new THREE.MeshStandardMaterial({ color, roughness: 0.3, metalness: 0.15 });
    const g = new THREE.Group();
    const parts: THREE.Mesh[] = [];
    const base = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.17, 0.06, 28), mat);
    base.position.y = 0.03;
    parts.push(base);
    switch (shape % 4) {
      case 0: {
        // pedone: cono e testa tonda
        const body = new THREE.Mesh(new THREE.ConeGeometry(0.13, 0.36, 24), mat);
        body.position.y = 0.22;
        const head = new THREE.Mesh(new THREE.SphereGeometry(0.1, 24, 16), mat);
        head.position.y = 0.44;
        parts.push(body, head);
        break;
      }
      case 1: {
        // torre: cilindro con merli
        const body = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.12, 0.34, 20), mat);
        body.position.y = 0.23;
        parts.push(body);
        for (let k = 0; k < 4; k++) {
          const m = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.07, 0.06), mat);
          const a = (k * Math.PI) / 2;
          m.position.set(Math.cos(a) * 0.08, 0.43, Math.sin(a) * 0.08);
          parts.push(m);
        }
        break;
      }
      case 2: {
        // gemma: ottaedro su uno stelo
        const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.06, 0.16, 12), mat);
        stem.position.y = 0.14;
        const gem = new THREE.Mesh(new THREE.OctahedronGeometry(0.16), mat);
        gem.position.y = 0.36;
        gem.scale.y = 1.3;
        parts.push(stem, gem);
        break;
      }
      default: {
        // anello: un toro in piedi
        const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.07, 0.1, 12), mat);
        stem.position.y = 0.1;
        const ring = new THREE.Mesh(new THREE.TorusGeometry(0.14, 0.05, 14, 28), mat);
        ring.position.y = 0.3;
        parts.push(stem, ring);
      }
    }
    for (const m of parts) {
      m.castShadow = true;
      g.add(m);
    }
    return g;
  }

  // Freccia che fluttua sopra la pedina di chi è di turno.
  private makeMarker(): THREE.Mesh {
    const m = new THREE.Mesh(
      new THREE.ConeGeometry(0.1, 0.2, 4),
      new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xffd54a, emissiveIntensity: 0.8 }),
    );
    m.rotation.x = Math.PI;
    return m;
  }

  // ---------- dadi 3D ----------

  private dieFace(value: number): THREE.MeshStandardMaterial {
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

  private makeDie(): THREE.Mesh {
    // facce nell'ordine di BoxGeometry (+x, -x, +y, -y, +z, -z); le facce opposte sommano 7
    const mats = DIE_FACES.map((v) => this.dieFace(v));
    const die = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.34, 0.34), mats);
    die.castShadow = true;
    die.visible = false;
    // prima si porta in alto la faccia giusta (X e Z), poi si gira attorno all'asse verticale (Y)
    die.rotation.order = 'YXZ';
    this.scene.add(die);
    return die;
  }

  // Fa cadere e rotolare i dadi vicino alla pedina, fermandoli sul risultato del motore.
  showDice(values: [number, number], playerId: number): void {
    const token = this.tokens[playerId]?.mesh;
    const at = token ? token.position.clone().setY(0) : new THREE.Vector3();
    // un po' verso il centro del tabellone, così restano sul piano verde
    const inward = at.clone().multiplyScalar(-1).setY(0);
    if (inward.lengthSq() > 0.01) inward.normalize();
    const side = new THREE.Vector3(-inward.z, 0, inward.x);
    const center = at.clone().add(inward.multiplyScalar(1.6));
    values.forEach((v, i) => {
      const die = this.dice[i];
      const final = FACE_UP[v].clone();
      final.y += Math.random() * Math.PI * 2;
      const end = center.clone().add(side.clone().multiplyScalar(i === 0 ? -0.32 : 0.32)).setY(0.17);
      const start = end.clone().add(new THREE.Vector3((Math.random() - 0.5) * 0.6, 2.4, (Math.random() - 0.5) * 0.6));
      this.diceAnim[i] = { start, end, final, spin: new THREE.Vector3(Math.PI * (4 + i * 2), Math.PI * 2, Math.PI * (2 + i * 2)), t: 0 };
      die.visible = true;
    });
    this.diceHideAt = this.clock.elapsedTime + (this.reduceMotion ? 2 : DICE_SECONDS + 2.2);
    this.tokensWaitUntil = this.clock.elapsedTime + (this.reduceMotion ? 0 : DICE_SECONDS);
  }

  private animateDice(dt: number): void {
    this.diceAnim.forEach((a, i) => {
      if (!a) return;
      const die = this.dice[i];
      a.t = this.reduceMotion ? 1 : Math.min(a.t + dt / DICE_SECONDS, 1);
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
      if (u >= 1) this.diceAnim[i] = null;
    });
    if (this.diceHideAt && this.clock.elapsedTime > this.diceHideAt) {
      for (const d of this.dice) d.visible = false;
      this.diceHideAt = 0;
    }
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
        const mesh = this.makeToken(PLAYER_COLORS[p.id], p.id);
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
    this.currentPlayer = state.phase === 'gameOver' && state.winner !== null ? state.winner : state.current;

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
      this.camTarget.set(p.x * 0.8, 0, p.z * 0.8);
      this.camPos.set(p.x + out.x * 3.4, 3.7, p.z + out.z * 3.4);
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
    this.animateDice(dt);
    const diceRolling = this.clock.elapsedTime < this.tokensWaitUntil;
    for (const t of this.tokens) {
      const hop = t.queue[0];
      if (!hop) continue;
      moving = true;
      // la pedina parte quando i dadi si sono fermati
      if (diceRolling) continue;
      t.hopTime += dt;
      const dur = hop.height > 1 ? HOP_SECONDS * 3 : HOP_SECONDS;
      const u = Math.min(t.hopTime / dur, 1);
      t.mesh.position.lerpVectors(hop.from, hop.to, u);
      t.mesh.position.y = Math.sin(Math.PI * u) * hop.height;
      if (u >= 1) {
        t.queue.shift();
        t.hopTime = 0;
        this.onHop?.();
      }
    }
    // freccia sopra la pedina di turno, che sale e scende piano
    const active = this.tokens[this.currentPlayer]?.mesh;
    this.marker.visible = !!active && active.visible;
    if (active) {
      this.marker.position.set(active.position.x, active.position.y + 0.75 + Math.sin(this.clock.elapsedTime * 3) * 0.06, active.position.z);
      this.marker.rotation.y += dt * 1.5;
    }
    if (diceRolling) moving = true;
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

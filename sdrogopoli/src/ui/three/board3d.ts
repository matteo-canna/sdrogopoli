// Tabellone 3D Diorama Urbano Realistico per Sdrogopoli:
// caselle HD, basamento urbano a marciapiede, case e Grand Hotel realistici, dadi 3D smussati,
// città centrale viva con insegna fluttuante "Gioco FOLLE!", cielo Giorno/Notte e camera libera 360°.
import * as THREE from 'three';
import { board } from '../../data';
import type { GameState } from '../../engine';
import { gridPosition } from '../view';
import { tokenScale, tokenSlot } from '../tokenLayout';
import { appearanceOf, playerColor } from '../characters';
import { createCharacter, type CharacterModel, type Reaction } from './characters3d';
import { centerTexture, spaceTexture } from './boardTextures';
import { City, makeHotel, makeHouse, skyAt, SKY_STEPS, type SkyMode } from './city';
import { getStudioEnvMap } from './materials';

const SIZE = board.spaces.length;
const HOP_SECONDS = 0.22;
const TILE = 0.96;

function spaceCenter(index: number): THREE.Vector3 {
  const { row, col } = gridPosition(index);
  return new THREE.Vector3(col - 6, 0, row - 6);
}

function textRotation(index: number): number {
  if (index < 10) return 0;
  if (index < 20) return -Math.PI / 2;
  if (index < 30) return Math.PI;
  return Math.PI / 2;
}

const DICE_SECONDS = 0.9;
const DIE_FACES = [3, 4, 1, 6, 2, 5];
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
  character: CharacterModel | null;
  hideAt: number;
  wasBankrupt: boolean;
  inJail: boolean;
  pendingReaction: Reaction | null;
}

function reactionFor(prev: GameState, next: GameState, playerId: number): Reaction | null {
  const before = prev.players[playerId];
  const after = next.players[playerId];
  if (!before || !after || after.bankrupt) return null;
  const owned = [0, 0];
  const houses = [0, 0];
  [prev, next].forEach((s, k) => {
    for (const o of Object.values(s.ownership)) {
      if (o.owner !== playerId) continue;
      owned[k]++;
      houses[k] += o.houses;
    }
  });
  if (houses[1] > houses[0]) return 'build';
  if (owned[1] > owned[0]) return 'cheer';
  if (after.money < before.money) return 'hit';
  if (after.money > before.money) return 'collect';
  return null;
}

const CHARACTER_HEIGHT = 0.54;

function restYaw(pos: THREE.Vector3): number {
  if (Math.abs(pos.x) > Math.abs(pos.z)) return pos.x > 0 ? Math.PI / 2 : -Math.PI / 2;
  return pos.z > 0 ? 0 : Math.PI;
}

function turnTowards(from: number, to: number, k: number): number {
  let d = (to - from) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d < -Math.PI) d += Math.PI * 2;
  return from + d * k;
}

export type CameraMode = 'follow' | 'overview';

export class Board3D {
  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera = new THREE.PerspectiveCamera(44, 1, 0.1, 140);
  private tiles: THREE.Mesh[] = [];
  private buildings: THREE.Group[] = [];
  private tokens: TokenView[] = [];
  private playerCount = 0;
  private raycaster = new THREE.Raycaster();
  private clock = new THREE.Clock();
  private camTarget = new THREE.Vector3();
  private camPos = new THREE.Vector3(0, 12.5, 11.8);
  private lookAt = new THREE.Vector3();
  private focusPlayer = 0;
  private selected: string | null = null;
  private resizeObserver: ResizeObserver;
  private frame = 0;
  private busy = false;
  private dice: THREE.Group[] = [];
  private diceAnim: (DiceAnim | null)[] = [null, null];
  private diceHideAt = 0;
  private tokensWaitUntil = 0;
  private marker!: THREE.Mesh;
  private currentPlayer = 0;
  private winner: number | null = null;

  private skyColor = new THREE.Color(0xb9dcf2);
  private hemi = new THREE.HemisphereLight(0xffffff, 0x6f7f6e, 1.4);
  private sun = new THREE.DirectionalLight(0xfffaf0, 2.3);
  private city = new City();
  private skyPhase = -1;
  private skyTarget = 0;
  skyMode: SkyMode = 'cycle';
  private round = 1;
  private tokensKey = '';
  private lastState: GameState | null = null;
  private reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
  cameraMode: CameraMode = 'follow';
  onHop: (() => void) | null = null;

  // Controlli orbita libera 360° (attivi trascinando in vista d'insieme o con rotella zoom)
  private orbitYaw = 0;
  private orbitPitch = 0.78;
  private orbitDist = 16.2;
  private dragging = false;
  private moved = false;
  private down = { x: 0, y: 0 };
  private lastPointer = { x: 0, y: 0 };

  constructor(
    private container: HTMLElement,
    private onSpaceClick: (spaceId: string) => void,
    private onBusyChange: (busy: boolean) => void,
    private onLost: () => void = () => {},
  ) {
    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.08;
    container.appendChild(this.renderer.domElement);

    this.setupEnvironment();
    this.buildScene();
    this.dice = [this.makeDie(), this.makeDie()];
    this.marker = this.makeMarker();
    this.scene.add(this.marker);
    this.camera.position.copy(this.camPos);

    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(container);
    this.resize();
    const dom = this.renderer.domElement;
    dom.addEventListener('pointerdown', this.onPointerDown);
    window.addEventListener('pointermove', this.onPointerMove);
    window.addEventListener('pointerup', this.onPointerUp);
    dom.addEventListener('wheel', this.onWheel, { passive: false });
    dom.addEventListener('webglcontextlost', this.onContextLost);
    this.loop();
  }

  private setupEnvironment(): void {
    this.scene.environment = getStudioEnvMap(this.renderer);
  }

  private buildScene(): void {
    this.scene.background = this.skyColor;
    this.scene.add(this.hemi);

    const sun = this.sun;
    sun.position.set(7, 13, 8);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    sun.shadow.bias = -0.0004;
    const sc = sun.shadow.camera;
    sc.left = sc.bottom = -9.5;
    sc.right = sc.top = 9.5;
    sc.near = 1;
    sc.far = 38;
    this.scene.add(sun);
    this.scene.add(this.city.group);

    // Basamento urbano a strati (Diorama Urbano Realistico):
    // 1) Plinto strutturale in ardesia/asfalto scuro
    const plinth = new THREE.Mesh(
      new THREE.BoxGeometry(12.9, 0.42, 12.9),
      new THREE.MeshStandardMaterial({ color: 0x2a3038, roughness: 0.78, metalness: 0.12 }),
    );
    plinth.position.y = -0.31;
    plinth.receiveShadow = true;
    this.scene.add(plinth);

    // 2) Marciapiede perimetrale rialzato in pietra chiara (sotto le 40 caselle)
    const sidewalk = new THREE.Mesh(
      new THREE.BoxGeometry(12.44, 0.14, 12.44),
      new THREE.MeshStandardMaterial({ color: 0xbeb7a9, roughness: 0.85 }),
    );
    sidewalk.position.y = -0.11;
    sidewalk.receiveShadow = true;
    this.scene.add(sidewalk);

    // 3) Piano del diorama centrale 9×9 con texture 2048px (asfalto, strisce pedonali, parco, piazze, lago)
    const center = new THREE.Mesh(
      new THREE.PlaneGeometry(9.04, 9.04),
      new THREE.MeshStandardMaterial({ map: centerTexture(this.renderer), roughness: 0.88 }),
    );
    center.rotation.x = -Math.PI / 2;
    center.position.y = -0.036;
    center.receiveShadow = true;
    this.scene.add(center);

    // 4) Le 40 caselle in travertino bisellato HD
    const geo = new THREE.BoxGeometry(TILE, 0.085, TILE);
    const sideMat = new THREE.MeshStandardMaterial({ color: 0xd4cbb8, roughness: 0.78 });
    board.spaces.forEach((space, i) => {
      const tex = spaceTexture(space, this.renderer);
      tex.center.set(0.5, 0.5);
      tex.rotation = textRotation(i);
      const topMat = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.78, emissive: 0x000000 });
      const tile = new THREE.Mesh(geo, [sideMat, sideMat, topMat, sideMat, sideMat, sideMat]);
      tile.position.copy(spaceCenter(i)).setY(-0.042);
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

  private makeToken(color: string, shape: number): THREE.Group {
    const mat = new THREE.MeshStandardMaterial({ color, roughness: 0.3, metalness: 0.25 });
    const g = new THREE.Group();
    const base = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.17, 0.06, 28), mat);
    base.position.y = 0.03;
    const body = new THREE.Mesh(
      shape % 2 === 0 ? new THREE.ConeGeometry(0.12, 0.36, 24) : new THREE.CylinderGeometry(0.1, 0.12, 0.34, 20),
      mat,
    );
    body.position.y = 0.22;
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.095, 20, 14), mat);
    head.position.y = 0.43;
    for (const m of [base, body, head]) { m.castShadow = true; g.add(m); }
    return g;
  }

  private makeMarker(): THREE.Mesh {
    const m = new THREE.Mesh(
      new THREE.ConeGeometry(0.1, 0.22, 6),
      new THREE.MeshStandardMaterial({ color: 0xfff5cc, emissive: 0xffc83d, emissiveIntensity: 0.9, roughness: 0.2 }),
    );
    m.rotation.x = Math.PI;
    return m;
  }

  // ---------- Dadi 3D in avorio con spigoli smussati e puntini incisi ----------
  private dieFace(value: number): THREE.MeshStandardMaterial {
    const c = document.createElement('canvas');
    c.width = c.height = 192;
    const ctx = c.getContext('2d');
    if (ctx) {
      const grad = ctx.createRadialGradient(96, 96, 12, 96, 96, 124);
      grad.addColorStop(0, '#fffdf7');
      grad.addColorStop(1, '#e8e0cf');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, 192, 192);
      ctx.strokeStyle = 'rgba(130, 118, 96, 0.28)';
      ctx.lineWidth = 8;
      ctx.strokeRect(4, 4, 184, 184);

      const pos: Record<number, [number, number][]> = {
        1: [[96, 96]],
        2: [[48, 48], [144, 144]],
        3: [[44, 44], [96, 96], [148, 148]],
        4: [[50, 50], [142, 50], [50, 142], [142, 142]],
        5: [[46, 46], [146, 46], [96, 96], [46, 146], [146, 146]],
        6: [[50, 42], [142, 42], [50, 96], [142, 96], [50, 150], [142, 150]],
      };
      for (const [x, y] of pos[value]) {
        const r = value === 1 ? 24 : 17;
        ctx.fillStyle = 'rgba(0,0,0,0.18)';
        ctx.beginPath(); ctx.arc(x + 2, y + 2, r, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = value === 1 ? '#c81e1e' : '#1b2028';
        ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
      }
    }
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    return new THREE.MeshStandardMaterial({ map: tex, roughness: 0.25, metalness: 0.05 });
  }

  private makeDie(): THREE.Group {
    const g = new THREE.Group();
    const mats = DIE_FACES.map((v) => this.dieFace(v));
    const core = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.36, 0.36), mats);
    core.castShadow = true;
    g.add(core);
    g.visible = false;
    g.rotation.order = 'YXZ';
    this.scene.add(g);
    return g;
  }

  showDice(values: [number, number], playerId: number): void {
    const token = this.tokens[playerId]?.mesh;
    const at = token ? token.position.clone().setY(0) : new THREE.Vector3();
    const inward = at.clone().multiplyScalar(-1).setY(0);
    if (inward.lengthSq() > 0.01) inward.normalize();
    const side = new THREE.Vector3(-inward.z, 0, inward.x);
    const center = at.clone().add(inward.multiplyScalar(1.65));
    values.forEach((v, i) => {
      const die = this.dice[i];
      const final = FACE_UP[v].clone();
      final.y += Math.random() * Math.PI * 2;
      const end = center.clone().add(side.clone().multiplyScalar(i === 0 ? -0.34 : 0.34)).setY(0.18);
      const start = end.clone().add(new THREE.Vector3((Math.random() - 0.5) * 0.65, 2.5, (Math.random() - 0.5) * 0.65));
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
    const slot = tokenSlot(playerId, this.playerCount);
    return spaceCenter(index).add(new THREE.Vector3(slot.x, 0, slot.z));
  }

  update(state: GameState, selected: string | null): void {
    const key = JSON.stringify(state.players.map((p) => appearanceOf(p)));
    if (key !== this.tokensKey) {
      this.tokensKey = key;
      for (const t of this.tokens) {
        this.scene.remove(t.mesh);
        t.character?.dispose();
      }
      this.playerCount = state.players.length;
      this.tokens = state.players.map((p) => this.createTokenView(state, p.id));
      this.lastState = null;
    }
    const prev = this.lastState;
    this.lastState = state;

    state.players.forEach((p, i) => {
      const view = this.tokens[i];
      if (p.bankrupt && !view.wasBankrupt) {
        view.wasBankrupt = true;
        if (view.character && !this.reduceMotion) {
          view.character.play('defeat');
          view.hideAt = this.clock.elapsedTime + 2;
        } else view.mesh.visible = false;
      }
      view.inJail = p.inJail;
      const reaction = prev && prev !== state ? reactionFor(prev, state, p.id) : null;
      if (reaction) view.pendingReaction = reaction;
      if (p.position !== view.shownPosition) {
        this.enqueueMove(view, p.id, view.shownPosition, p.position, p.inJail);
        view.shownPosition = p.position;
        this.focusPlayer = p.id;
      }
    });
    if (!this.tokens.some((t) => t.queue.length)) this.focusPlayer = state.current;
    this.currentPlayer = state.phase === 'gameOver' && state.winner !== null ? state.winner : state.current;
    this.winner = state.phase === 'gameOver' ? state.winner : null;
    this.round = state.round ?? 1;
    if (this.skyPhase < 0) this.skyPhase = this.skyMode === 'cycle' ? (this.round - 1) % SKY_STEPS : this.skyMode === 'day' ? 0 : 2;

    this.updateBuildings(state);
    this.setSelected(selected);
  }

  private createTokenView(state: GameState, playerId: number): TokenView {
    const p = state.players[playerId];
    const mesh = new THREE.Group();
    const size = tokenScale(state.players.length);
    const fallback = this.makeToken(playerColor(p), p.id);
    fallback.scale.setScalar(size);
    mesh.add(fallback);
    mesh.position.copy(this.tokenRest(p.id, p.position));
    mesh.rotation.y = restYaw(mesh.position);
    mesh.visible = !p.bankrupt;
    this.scene.add(mesh);
    const view: TokenView = { mesh, shownPosition: p.position, queue: [], hopTime: 0, character: null, hideAt: 0, wasBankrupt: p.bankrupt, inJail: p.inJail, pendingReaction: null };
    const key = this.tokensKey;
    createCharacter(appearanceOf(p), CHARACTER_HEIGHT * size)
      .then((character) => {
        if (key !== this.tokensKey || this.disposed) {
          character.dispose();
          return;
        }
        mesh.remove(fallback);
        mesh.add(character.root);
        view.character = character;
      })
      .catch(() => {});
    return view;
  }

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
      view.queue.push({ from: prev, to: next, height: path.length === 1 && jailed ? 2 : view.character ? 0.08 : 0.45 });
      prev = next;
    }
    if (this.reduceMotion) {
      view.mesh.position.copy(prev);
      view.queue = [];
    }
  }

  private updateBuildings(state: GameState): void {
    board.spaces.forEach((space, i) => {
      const group = this.buildings[i];
      const own = state.ownership[space.id];
      const key = own ? `${own.owner}-${own.houses}-${own.mortgaged}` : '';
      if (group.userData.key === key) return;
      group.userData.key = key;
      group.clear();
      if (!own) return;

      const color = playerColor(state.players[own.owner]);
      // Targhetta proprietario lucida sul bordo esterno della casella (sempre leggibile!)
      const strip = new THREE.Mesh(
        new THREE.BoxGeometry(0.74, 0.022, 0.06),
        new THREE.MeshStandardMaterial({ color, roughness: 0.3, metalness: 0.2, transparent: own.mortgaged, opacity: own.mortgaged ? 0.35 : 1 }),
      );
      strip.position.set(0, 0.012, 0.43);
      this.orientLocal(strip, i);
      group.add(strip);

      if (own.mortgaged) {
        const bar = new THREE.Mesh(
          new THREE.BoxGeometry(0.68, 0.015, 0.08),
          new THREE.MeshStandardMaterial({ color: 0xb91c1c, roughness: 0.5, transparent: true, opacity: 0.8 }),
        );
        bar.position.set(0, 0.01, 0);
        bar.rotation.y = Math.PI / 4;
        group.add(bar);
        return;
      }

      if (own.houses === 5) {
        const hotel = makeHotel(color);
        this.placeOnBand(hotel, i);
        group.add(hotel);
      } else {
        for (let h = 0; h < own.houses; h++) {
          const house = makeHouse(i + h, color);
          house.position.set(-0.33 + h * 0.22, 0, 0);
          this.placeOnBand(house, i);
          group.add(house);
        }
      }
    });
  }

  private orientLocal(obj: THREE.Object3D, index: number): void {
    const angle = textRotation(index);
    obj.position.applyAxisAngle(new THREE.Vector3(0, 1, 0), angle);
    obj.rotation.y += angle;
  }

  private placeOnBand(obj: THREE.Object3D, index: number): void {
    const angle = textRotation(index);
    const local = obj.position.clone().add(new THREE.Vector3(0, 0, -0.355));
    local.applyAxisAngle(new THREE.Vector3(0, 1, 0), angle);
    obj.position.copy(local);
    obj.rotation.y = angle;
  }

  private setSelected(spaceId: string | null): void {
    if (spaceId === this.selected) return;
    this.selected = spaceId;
    for (const tile of this.tiles) {
      const top = (tile.material as THREE.MeshStandardMaterial[])[2];
      top.emissive.setHex(tile.userData.spaceId === spaceId ? 0xd97706 : 0x000000);
      top.emissiveIntensity = 0.28;
    }
  }

  private updateSky(dt: number): void {
    this.skyTarget = this.skyMode === 'day' ? 0 : this.skyMode === 'night' ? 2 : (this.round - 1) % SKY_STEPS;
    if (this.skyPhase < 0) return;
    if (this.reduceMotion) this.skyPhase = this.skyTarget;
    else {
      const diff = ((this.skyTarget - this.skyPhase) % SKY_STEPS + SKY_STEPS + SKY_STEPS / 2) % SKY_STEPS - SKY_STEPS / 2;
      this.skyPhase = (this.skyPhase + diff * Math.min(1, dt * 1.4) + SKY_STEPS) % SKY_STEPS;
    }
    const k = skyAt(this.skyPhase);
    this.skyColor.setHex(k.bg);
    this.hemi.color.setHex(k.hemiSky);
    this.hemi.groundColor.setHex(k.hemiGround);
    this.hemi.intensity = k.hemi;
    this.sun.intensity = k.sun;
    this.sun.color.setHex(k.sunColor);
    this.sun.position.set(Math.cos(k.sunAngle) * 11, 12, Math.sin(k.sunAngle) * 11);
    this.city.setNight(k.night, k.sunAngle);
  }

  private loop = (): void => {
    this.frame = requestAnimationFrame(this.loop);
    const dt = Math.min(this.clock.getDelta(), 0.1);
    this.animateDice(dt);
    this.updateSky(dt);
    this.city.update(dt, this.reduceMotion);

    let moving = false;
    const waiting = this.clock.elapsedTime < this.tokensWaitUntil;
    for (const t of this.tokens) {
      t.character?.update(dt);
      if (t.hideAt && this.clock.elapsedTime >= t.hideAt) {
        t.mesh.visible = false;
        t.hideAt = 0;
      }
      if (!t.queue.length || waiting) continue;
      moving = true;
      const hop = t.queue[0];
      const big = hop.height > 1;
      t.hopTime += dt / (big ? HOP_SECONDS * 2.5 : HOP_SECONDS);
      const u = Math.min(t.hopTime, 1);
      t.mesh.position.lerpVectors(hop.from, hop.to, u);
      t.mesh.position.y = Math.sin(u * Math.PI) * hop.height;
      const dx = hop.to.x - hop.from.x;
      const dz = hop.to.z - hop.from.z;
      if (dx * dx + dz * dz > 0.0001) t.mesh.rotation.y = turnTowards(t.mesh.rotation.y, Math.atan2(dx, dz), Math.min(1, dt * 16));
      t.character?.setBase(big ? 'jump' : 'walk', 0.12, true);
      if (u >= 1) {
        t.queue.shift();
        t.hopTime = 0;
        this.onHop?.();
      }
    }

    const busy = moving || waiting;
    if (!busy) {
      this.tokens.forEach((t, i) => {
        if (!t.wasBankrupt && t.character) {
          const isWin = this.winner === i;
          t.character.setBase(isWin ? 'cheer' : t.inJail ? 'sit' : 'idle');
          if (t.pendingReaction) {
            if (!this.reduceMotion && !isWin) t.character.react(t.pendingReaction);
            t.pendingReaction = null;
          }
        }
        t.mesh.rotation.y = turnTowards(t.mesh.rotation.y, restYaw(t.mesh.position), Math.min(1, dt * 6));
      });
    }
    if (busy !== this.busy) {
      this.busy = busy;
      this.onBusyChange(busy);
    }

    const active = this.tokens[this.currentPlayer]?.mesh;
    if (active && active.visible && !moving) {
      this.marker.visible = true;
      const top = (this.tokens[this.currentPlayer]?.character ? CHARACTER_HEIGHT * 1.45 + 0.2 : 0.78) * tokenScale(this.playerCount);
      this.marker.position.set(active.position.x, top + Math.sin(this.clock.elapsedTime * 5) * 0.07, active.position.z);
      this.marker.rotation.y += dt * 2.2;
    } else {
      this.marker.visible = false;
    }

    // Camera fluida: segue la pedina in 'follow', oppure orbita libera 360° in 'overview'!
    let desiredPos: THREE.Vector3;
    if (this.cameraMode === 'overview') {
      this.camTarget.set(0, 0.3, 0);
      desiredPos = new THREE.Vector3(
        Math.sin(this.orbitYaw) * Math.cos(this.orbitPitch) * this.orbitDist,
        Math.sin(this.orbitPitch) * this.orbitDist,
        Math.cos(this.orbitYaw) * Math.cos(this.orbitPitch) * this.orbitDist,
      );
    } else {
      const focus = this.tokens[this.focusPlayer]?.mesh.position ?? new THREE.Vector3();
      const out = focus.clone().setY(0);
      if (out.lengthSq() < 0.01) out.set(0, 0, 1);
      out.normalize();
      this.camTarget.set(focus.x * 0.85, 0.25, focus.z * 0.85);
      desiredPos = focus.clone().add(out.multiplyScalar(4.8)).setY(4.9);
    }
    const k = this.reduceMotion ? 1 : Math.min(1, dt * 4.5);
    this.camPos.lerp(desiredPos, k);
    this.lookAt.lerp(this.camTarget, k);
    this.camera.position.copy(this.camPos);
    this.camera.lookAt(this.lookAt);

    this.renderer.render(this.scene, this.camera);
  };

  private resize(): void {
    const w = this.container.clientWidth || 1;
    const h = this.container.clientHeight || 1;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.fov = w / h < 0.8 ? 58 : 44;
    this.camera.updateProjectionMatrix();
  }

  private onPointerDown = (e: PointerEvent): void => {
    this.dragging = true;
    this.moved = false;
    this.down = { x: e.clientX, y: e.clientY };
    this.lastPointer = { x: e.clientX, y: e.clientY };
  };

  private onPointerMove = (e: PointerEvent): void => {
    if (!this.dragging) return;
    const dx = e.clientX - this.lastPointer.x;
    const dy = e.clientY - this.lastPointer.y;
    if (Math.hypot(e.clientX - this.down.x, e.clientY - this.down.y) > 6) {
      this.moved = true;
      this.cameraMode = 'overview';
    }
    if (this.moved) {
      this.orbitYaw -= dx * 0.008;
      this.orbitPitch = THREE.MathUtils.clamp(this.orbitPitch + dy * 0.007, 0.22, 1.48);
    }
    this.lastPointer = { x: e.clientX, y: e.clientY };
  };

  private onPointerUp = (e: PointerEvent): void => {
    if (!this.dragging) return;
    this.dragging = false;
    if (this.moved) return;
    const rect = this.renderer.domElement.getBoundingClientRect();
    const ndc = new THREE.Vector2(((e.clientX - rect.left) / rect.width) * 2 - 1, -((e.clientY - rect.top) / rect.height) * 2 + 1);
    this.raycaster.setFromCamera(ndc, this.camera);
    const hit = this.raycaster.intersectObjects(this.tiles, false)[0];
    if (hit) this.onSpaceClick(hit.object.userData.spaceId);
  };

  private onWheel = (e: WheelEvent): void => {
    e.preventDefault();
    this.cameraMode = 'overview';
    this.orbitDist = THREE.MathUtils.clamp(this.orbitDist + e.deltaY * 0.01, 6.5, 26);
  };

  private disposed = false;

  private onContextLost = (e: Event): void => {
    e.preventDefault();
    if (!this.disposed) this.onLost();
  };

  dispose(): void {
    this.disposed = true;
    for (const t of this.tokens) t.character?.dispose();
    cancelAnimationFrame(this.frame);
    this.resizeObserver.disconnect();
    const dom = this.renderer.domElement;
    dom.removeEventListener('pointerdown', this.onPointerDown);
    window.removeEventListener('pointermove', this.onPointerMove);
    window.removeEventListener('pointerup', this.onPointerUp);
    dom.removeEventListener('wheel', this.onWheel);
    dom.removeEventListener('webglcontextlost', this.onContextLost);
    this.renderer.dispose();
    this.renderer.forceContextLoss();
    dom.remove();
  }
}

let webglChecked: boolean | null = null;
export function webglAvailable(): boolean {
  if (webglChecked !== null) return webglChecked;
  try {
    const c = document.createElement('canvas');
    const gl = (c.getContext('webgl2') || c.getContext('webgl')) as WebGLRenderingContext | null;
    webglChecked = !!gl;
    gl?.getExtension('WEBGL_lose_context')?.loseContext();
  } catch {
    webglChecked = false;
  }
  return webglChecked;
}

// Tabellone 3D: caselle, pedine animate, case e camera che segue la pedina in movimento.
import * as THREE from 'three';
import { board } from '../../data';
import type { GameState } from '../../engine';
import { tokenScale, tokenSlot } from '../tokenLayout';
import { appearanceOf, playerColor, playerMarks } from '../characters';
import { createCharacter } from './characters3d';
import { CHARACTER_HEIGHT, HOP_SECONDS, boardSide, boardSize, restYaw, spaceCenter, textRotation, turnTowards } from './layout';
import { DICE_SECONDS, Dice3D } from './dice3d';
import { CameraRig, type CameraMode } from './camera';
export type { CameraMode } from './camera';
import { buildBoard } from './tiles';
import { makeMarker, makeOwnerFlag, makeToken, reactionFor, type TokenView } from './pieces';
import { City, makeHotel, makeHouse, skyAt, SKY_STEPS, type SkyMode } from './city';
import { getStudioEnvMap } from './materials';
import { motionReduced } from '../motion';
import { spaceName, t } from '../../i18n';
import { deviceInfo, FrameWatch, QUALITY_SETTINGS, resolveQuality, type Quality, type QualityLevel } from '../quality';

export class Board3D {
  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera = new THREE.PerspectiveCamera(45, 1, 0.1, 140);
  private tiles: THREE.Mesh[] = [];
  private buildings: THREE.Group[] = [];
  private ownerMarkers: THREE.Mesh[] = [];
  private tokens: TokenView[] = [];
  // numero di giocatori della partita mostrata: decide dove stanno le pedine nella casella
  private playerCount = 0;
  private raycaster = new THREE.Raycaster();
  private clock = new THREE.Clock();
  private rig = new CameraRig(this.camera, boardSide() / 11);
  private focusPlayer = 0;
  private selected: string | null = null;
  private resizeObserver: ResizeObserver;
  private frame = 0;
  // a scena ferma si smette di disegnare (la scheda grafica si riposa) fino al prossimo cambiamento
  private sleeping = false;
  private stillFor = 0;
  private skyMoving = false;
  private busy = false;
  private dice!: Dice3D;
  private tokensWaitUntil = 0;
  // velocità delle animazioni: 1 normale, 2 doppia; Infinity = istantanea (niente animazioni)
  speed = 1;
  // qualità grafica: la scelta delle impostazioni e il gradino che si sta usando
  private qualityChoice: Quality = 'auto';
  private level: QualityLevel = resolveQuality('auto', deviceInfo());
  private watch = new FrameWatch();
  // vero quando "automatica" ha abbassato la qualità da sola (per dirlo nelle impostazioni)
  lowered = false;
  onQualityChange: ((level: QualityLevel, lowered: boolean) => void) | null = null;
  get quality(): Quality {
    return this.qualityChoice;
  }
  set quality(q: Quality) {
    this.qualityChoice = q;
    this.lowered = false;
    this.level = resolveQuality(q, deviceInfo());
    this.watch.reset();
    this.applyQuality();
    this.wake();
  }
  get qualityLevel(): QualityLevel {
    return this.level;
  }
  private marker!: THREE.Mesh;
  private currentPlayer = 0;
  private winner: number | null = null;
  // cielo: fase attuale (0 giorno, 1 tramonto, 2 notte, 3 alba) e fase verso cui si va
  private skyColor = new THREE.Color(0xb9dcf2);
  private hemi = new THREE.HemisphereLight(0xffffff, 0x6f7f6e, 1.4);
  private sun = new THREE.DirectionalLight(0xfffaf0, 2.3);
  private city = new City();
  private skyPhase = -1;
  private skyTarget = 0;
  private sky: SkyMode = 'cycle';
  get skyMode(): SkyMode {
    return this.sky;
  }
  set skyMode(mode: SkyMode) {
    this.sky = mode;
    this.wake();
  }
  private round = 1;
  private tokensKey = '';
  private lastState: GameState | null = null;
  // letto a ogni fotogramma: la scelta nelle impostazioni vale subito
  private get reduceMotion(): boolean {
    return motionReduced();
  }
  private camMode: CameraMode = 'follow';
  get cameraMode(): CameraMode {
    return this.camMode;
  }
  set cameraMode(mode: CameraMode) {
    this.camMode = mode;
    this.syncReset();
    this.wake();
  }
  // chiamata a ogni salto completato (per il suono)
  onHop: (() => void) | null = null;

  constructor(
    private container: HTMLElement,
    private onSpaceClick: (spaceId: string) => void,
    private onBusyChange: (busy: boolean) => void,
    // chiamata se il browser spegne la grafica (per esempio con poca memoria): la scena va ricreata
    private onLost: () => void = () => {},
  ) {
    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    // colori da pellicola
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.08;
    container.appendChild(this.renderer.domElement);

    this.buildScene();
    this.applyQuality();
    this.dice = new Dice3D(this.scene);
    this.marker = makeMarker();
    this.scene.add(this.marker);

    this.resizeObserver = new ResizeObserver(() => {
      this.resize();
      this.wake();
    });
    this.resizeObserver.observe(container);
    this.resize();
    const canvas = this.renderer.domElement;
    canvas.addEventListener('pointerdown', this.onPointerDown);
    canvas.addEventListener('pointermove', this.onPointerMove);
    canvas.addEventListener('pointerup', this.onPointerUp);
    canvas.addEventListener('pointercancel', this.onPointerCancel);
    canvas.addEventListener('pointerleave', this.onPointerLeave);
    canvas.addEventListener('wheel', this.onWheel, { passive: false });
    // cartellino della casella e pulsante per tornare alla vista proposta, sopra la scena
    this.tag.className = 'space-tag';
    this.tag.hidden = true;
    this.tag.setAttribute('aria-hidden', 'true');
    this.resetBtn.type = 'button';
    this.resetBtn.className = 'view3d-reset';
    this.resetBtn.hidden = true;
    this.resetBtn.addEventListener('click', () => this.resetView());
    container.append(this.tag, this.resetBtn);
    this.renderer.domElement.addEventListener('webglcontextlost', this.onContextLost);
    this.loop();
  }

  // ---------- costruzione della scena ----------

  private buildScene(): void {
    this.scene.background = this.skyColor;

    this.scene.add(this.hemi);
    const sun = this.sun;
    sun.position.set(6, 12, 8);
    sun.castShadow = true;
    sun.shadow.mapSize.set(QUALITY_SETTINGS.alta.shadowMap, QUALITY_SETTINGS.alta.shadowMap);
    const sc = sun.shadow.camera;
    sun.shadow.bias = -0.0004;
    sc.left = sc.bottom = -9.5;
    sc.right = sc.top = 9.5;
    sc.near = 1;
    sc.far = 38;
    this.scene.add(sun);
    // le decorazioni sono disegnate per il centro del tabellone grande: si riducono con lui
    this.city.group.scale.setScalar((boardSide() - 2) / 9);
    this.scene.add(this.city.group);

    const { tiles, buildings } = buildBoard(this.scene, this.renderer);
    this.tiles = tiles;
    this.buildings = buildings;
  }

  // ---------- dadi 3D ----------

  // Fa cadere e rotolare i dadi vicino alla pedina, fermandoli sul risultato del motore.
  showDice(values: [number, number], playerId: number): void {
    this.wake();
    const token = this.tokens[playerId]?.mesh;
    const at = token ? token.position.clone().setY(0) : new THREE.Vector3();
    const fast = this.reduceMotion || !Number.isFinite(this.speed);
    this.dice.roll(values, at, this.clock.elapsedTime + (fast ? 2 : DICE_SECONDS / this.speed + 2.2));
    this.tokensWaitUntil = this.clock.elapsedTime + (fast ? 0 : DICE_SECONDS / this.speed);
  }

  // Salta le animazioni in corso: dadi fermi sul risultato e pedine già arrivate.
  skip(): void {
    this.wake();
    this.dice.finish();
    this.tokensWaitUntil = 0;
    for (const t of this.tokens) {
      const last = t.queue.at(-1);
      if (!last) continue;
      t.mesh.position.copy(last.to).setY(0);
      t.queue = [];
      t.hopTime = 0;
    }
  }

  get isBusy(): boolean {
    return this.busy;
  }

  private tokenRest(playerId: number, index: number): THREE.Vector3 {
    const slot = tokenSlot(playerId, this.playerCount);
    return spaceCenter(index).add(new THREE.Vector3(slot.x, 0, slot.z));
  }

  // ---------- aggiornamento dallo stato del motore ----------

  update(state: GameState, selected: string | null): void {
    this.wake();
    // crea le pedine alla prima chiamata (o se cambia la partita)
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
    this.fillTag();

    state.players.forEach((p, i) => {
      const view = this.tokens[i];
      if (p.bankrupt && !view.wasBankrupt) {
        // il personaggio cade a terra e poi sparisce
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
    // alla prima partita mostrata il cielo parte già dall'ora giusta
    if (this.skyPhase < 0) this.skyPhase = this.skyMode === 'cycle' ? (this.round - 1) % SKY_STEPS : this.skyMode === 'day' ? 0 : 2;

    this.updateBuildings(state);
    this.setSelected(selected);
  }

  // Crea la pedina: subito quella semplice, poi il personaggio 3D appena il modello è caricato.
  private createTokenView(state: GameState, playerId: number): TokenView {
    const p = state.players[playerId];
    const mesh = new THREE.Group();
    const size = tokenScale(state.players.length);
    const fallback = makeToken(playerColor(p), p.id);
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
        // la partita (o l'aspetto) potrebbe essere cambiata nel frattempo
        if (key !== this.tokensKey || this.disposed) {
          character.dispose();
          return;
        }
        mesh.remove(fallback);
        // riflessi da studio solo sulle pedine (oro, cromo…): su tutta la città costerebbero troppo
        // ai dispositivi deboli, sulle pedine sono pochi pixel
        const env = getStudioEnvMap(this.renderer);
        character.root.traverse((o) => {
          const m = (o as THREE.Mesh).material as THREE.MeshStandardMaterial | THREE.MeshStandardMaterial[] | undefined;
          for (const mt of m ? (Array.isArray(m) ? m : [m]) : []) if (mt.isMeshStandardMaterial && !mt.envMap) mt.envMap = env;
        });
        mesh.add(character.root);
        view.character = character;
      })
      .catch(() => {
        /* modello non disponibile: resta la pedina semplice */
      });
    return view;
  }

  // Prepara i salti casella per casella. Indietro di poche caselle (carte) si cammina all'indietro;
  // verso la Caserma si fa un unico grande salto.
  private enqueueMove(view: TokenView, playerId: number, from: number, to: number, jailed: boolean): void {
    const SIZE = boardSize();
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
      // bandierina del proprietario: il suo colore e la sua sigla, così si riconosce anche senza i colori
      const flag = makeOwnerFlag(playerColor(state.players[own.owner]), playerMarks(state.players)[own.owner], own.mortgaged);
      // nell'angolo esterno della casella, lontano dalle case
      flag.position.set(0.3, 0, 0.64);
      this.placeOnBand(flag, i);
      group.add(flag);
      if (own.houses === 5) {
        const hotel = makeHotel(playerColor(state.players[own.owner]));
        this.placeOnBand(hotel, i);
        group.add(hotel);
      } else {
        for (let h = 0; h < own.houses; h++) {
          // case di forme diverse, con un dettaglio del colore del proprietario
          const house = makeHouse(i + h, playerColor(state.players[own.owner]));
          house.position.set(-0.33 + h * 0.22, 0, 0);
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
    this.fillTag();
    for (const tile of this.tiles) {
      const top = (tile.material as THREE.MeshStandardMaterial[])[2];
      top.emissive.setHex(tile.userData.spaceId === spaceId ? 0x2f6f4f : 0x000000);
      top.emissiveIntensity = 0.35;
    }
  }

  // ---------- qualità grafica ----------

  private applyQuality(): void {
    const q = QUALITY_SETTINGS[this.level];
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, q.pixelRatio));
    this.renderer.shadowMap.enabled = q.shadows;
    this.sun.castShadow = q.shadows;
    if (q.shadows && this.sun.shadow.mapSize.width !== q.shadowMap) {
      this.sun.shadow.mapSize.set(q.shadowMap, q.shadowMap);
      this.sun.shadow.map?.dispose();
      this.sun.shadow.map = null;
    }
    this.city.setDetail(q);
    this.resize();
    this.onQualityChange?.(this.level, this.lowered);
  }

  // ---------- cielo ----------

  // Ogni giro la giornata avanza di una tappa (giorno, tramonto, notte, alba); oppure resta fissa.
  private updateSky(dt: number): void {
    this.skyTarget = this.skyMode === 'day' ? 0 : this.skyMode === 'night' ? 2 : (this.round - 1) % SKY_STEPS;
    // prima di conoscere la partita si aspetta (update() fissa l'ora giusta)
    if (this.skyPhase < 0) return;
    this.skyMoving = false;
    if (this.reduceMotion) this.skyPhase = this.skyTarget;
    else {
      // si va sempre avanti, come il tempo
      const ahead = (this.skyTarget - this.skyPhase + SKY_STEPS) % SKY_STEPS;
      if (ahead > 1e-3) this.skyPhase = (this.skyPhase + Math.min(ahead, dt * 0.35)) % SKY_STEPS;
      this.skyMoving = ahead > 1e-3;
    }
    const k = skyAt(this.skyPhase);
    this.skyColor.setHex(k.bg);
    this.hemi.color.setHex(k.hemiSky);
    this.hemi.groundColor.setHex(k.hemiGround);
    this.hemi.intensity = k.hemi;
    this.sun.color.setHex(k.sunColor);
    this.sun.intensity = k.sun;
    this.sun.position.set(Math.cos(k.sunAngle + 0.9) * 10, 12, Math.sin(k.sunAngle + 0.9) * 10);
    this.city.setNight(k.night, k.sunAngle);
  }

  // ---------- ciclo di animazione ----------

  private loop = (): void => {
    this.frame = requestAnimationFrame(this.loop);
    const dt = Math.min(this.clock.getDelta(), 0.1);
    let moving = false;
    if (!Number.isFinite(this.speed)) this.skip();
    this.dice.update(dt, this.speed, this.reduceMotion, this.clock.elapsedTime);
    const diceRolling = this.clock.elapsedTime < this.tokensWaitUntil;
    const turnK = 1 - Math.exp(-dt * 10);
    // le reazioni partono quando tutti sono fermi (chi incassa aspetta che arrivi chi paga)
    const allStill = !diceRolling && !this.tokens.some((t) => t.queue.length);
    for (const t of this.tokens) {
      t.character?.update(dt);
      if (t.hideAt && this.clock.elapsedTime > t.hideAt) {
        t.mesh.visible = false;
        t.hideAt = 0;
      }
      const hop = t.queue[0];
      if (!hop || diceRolling) {
        if (hop) moving = true;
        // fermo: guarda verso l'esterno; il vincitore esulta, in Caserma si siede
        if (!t.wasBankrupt && t.character) {
          const winner = this.winner === this.tokens.indexOf(t);
          t.character.setBase(winner ? 'cheer' : t.inJail ? 'sit' : 'idle');
          if (allStill && t.pendingReaction) {
            if (!this.reduceMotion && !winner) t.character.react(t.pendingReaction);
            t.pendingReaction = null;
          }
          t.mesh.rotation.y = turnTowards(t.mesh.rotation.y, restYaw(t.mesh.position), turnK);
        }
        continue;
      }
      moving = true;
      // la pedina parte quando i dadi si sono fermati
      t.hopTime += dt * this.speed;
      const big = hop.height > 1;
      const dur = big ? HOP_SECONDS * 3 : HOP_SECONDS;
      const u = Math.min(t.hopTime / dur, 1);
      t.mesh.position.lerpVectors(hop.from, hop.to, u);
      t.mesh.position.y = Math.sin(Math.PI * u) * hop.height;
      // cammina guardando dove va (il salto verso la Caserma è un salto vero)
      t.character?.setBase(big ? 'jump' : 'walk', 0.12, true);
      const dx = hop.to.x - hop.from.x;
      const dz = hop.to.z - hop.from.z;
      if (dx * dx + dz * dz > 1e-4) t.mesh.rotation.y = turnTowards(t.mesh.rotation.y, Math.atan2(dx, dz), turnK);
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
      const top = (this.tokens[this.currentPlayer]?.character ? CHARACTER_HEIGHT * 1.45 + 0.15 : 0.75) * tokenScale(this.playerCount);
      this.marker.position.set(active.position.x, active.position.y + top + Math.sin(this.clock.elapsedTime * 3) * 0.06, active.position.z);
      this.marker.rotation.y += dt * 1.5;
    }
    if (diceRolling) moving = true;
    if (moving !== this.busy) {
      this.busy = moving;
      this.onBusyChange(moving);
    }
    this.updateSky(dt);
    // con "automatica", se il gioco va a scatti si scende di un gradino (una volta sola)
    if (this.qualityChoice === 'auto' && moving) {
      const lower = this.watch.tick(dt, this.level);
      if (lower) {
        this.level = lower;
        this.lowered = true;
        this.applyQuality();
      }
    }
    this.city.update(dt, this.reduceMotion);
    this.rig.update(dt, this.cameraMode === 'overview' ? null : this.tokens[this.focusPlayer]?.mesh ?? null, this.reduceMotion);
    this.renderer.render(this.scene, this.camera);
    this.placeTag();
    // tutto fermo da qualche secondo (pedine, dadi, camera, cielo, reazioni): ci si ferma
    const calm =
      !moving &&
      !this.skyMoving &&
      this.rig.settled &&
      this.winner === null &&
      this.dice.visibleUntil === 0 &&
      !this.tokens.some((t) => t.pendingReaction || t.character?.reacting);
    this.stillFor = calm ? this.stillFor + dt : 0;
    if (this.stillFor > (this.reduceMotion ? 0.5 : 4)) {
      this.sleeping = true;
      cancelAnimationFrame(this.frame);
    }
  };

  // Riprende a disegnare dopo una pausa (nuovo stato, tocco, cambio di vista o di dimensione).
  wake(): void {
    this.stillFor = 0;
    if (!this.sleeping || this.disposed) return;
    this.sleeping = false;
    this.clock.getDelta();
    this.frame = requestAnimationFrame(this.loop);
  }

  // Vero se la scena è in pausa (per i test).
  get isSleeping(): boolean {
    return this.sleeping;
  }

  private resize(): void {
    const w = this.container.clientWidth || 1;
    const h = this.container.clientHeight || 1;
    this.renderer.setSize(w, h, false);
    this.rig.resize(w, h);
  }

  // ---------- gesti: tocco, trascinamento, pizzico, rotella ----------

  private pointers = new Map<number, { x: number; y: number }>();
  private down = { x: 0, y: 0 };
  private dragged = false;
  private hovered: string | null = null;
  private tag = document.createElement('div');
  private resetBtn = document.createElement('button');

  private tileAt(clientX: number, clientY: number): string | null {
    const rect = this.renderer.domElement.getBoundingClientRect();
    const ndc = new THREE.Vector2(((clientX - rect.left) / rect.width) * 2 - 1, -((clientY - rect.top) / rect.height) * 2 + 1);
    this.raycaster.setFromCamera(ndc, this.camera);
    return this.raycaster.intersectObjects(this.tiles, false)[0]?.object.userData.spaceId ?? null;
  }

  private onPointerDown = (e: PointerEvent): void => {
    this.wake();
    this.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (this.pointers.size === 1) {
      this.down = { x: e.clientX, y: e.clientY };
      this.dragged = false;
    } else this.dragged = true;
    this.renderer.domElement.setPointerCapture?.(e.pointerId);
  };

  private onPointerMove = (e: PointerEvent): void => {
    const before = this.pointers.get(e.pointerId);
    if (!before) {
      // il mouse che passa sopra una casella mostra il suo cartellino
      if (e.pointerType === 'mouse') this.setHovered(this.tileAt(e.clientX, e.clientY));
      return;
    }
    const others = [...this.pointers.entries()].filter(([id]) => id !== e.pointerId).map(([, p]) => p);
    const now = { x: e.clientX, y: e.clientY };
    if (others.length === 0) {
      // un dito (o il mouse premuto): si gira intorno
      if (!this.dragged && Math.hypot(now.x - this.down.x, now.y - this.down.y) <= 6) return;
      this.dragged = true;
      this.rig.rotate(-(now.x - before.x) * 0.008);
    } else {
      // due dita: pizzico per avvicinarsi, rotazione per girare
      const o = others[0];
      const d0 = Math.hypot(before.x - o.x, before.y - o.y);
      const d1 = Math.hypot(now.x - o.x, now.y - o.y);
      if (d0 > 0 && d1 > 0) this.rig.zoomBy(d0 / d1);
      const a0 = Math.atan2(before.y - o.y, before.x - o.x);
      const a1 = Math.atan2(now.y - o.y, now.x - o.x);
      this.rig.rotate(Math.atan2(Math.sin(a1 - a0), Math.cos(a1 - a0)));
    }
    this.pointers.set(e.pointerId, now);
    this.syncReset();
    this.wake();
  };

  private onPointerUp = (e: PointerEvent): void => {
    const was = this.pointers.delete(e.pointerId);
    if (!was || this.dragged || this.pointers.size) return;
    // un tocco durante un'animazione la salta, invece di selezionare una casella
    if (this.busy) {
      this.skip();
      return;
    }
    const hit = this.tileAt(e.clientX, e.clientY);
    if (hit) this.onSpaceClick(hit);
  };

  private onPointerCancel = (e: PointerEvent): void => {
    this.pointers.delete(e.pointerId);
  };

  private onPointerLeave = (e: PointerEvent): void => {
    if (e.pointerType === 'mouse') this.setHovered(null);
  };

  private onWheel = (e: WheelEvent): void => {
    e.preventDefault();
    this.zoomBy(Math.exp(Math.max(-1, Math.min(1, e.deltaY / 300))));
  };

  // Anche dalla tastiera (+ e −, Maiusc con le frecce).
  zoomBy(factor: number): void {
    this.rig.zoomBy(factor);
    this.syncReset();
    this.wake();
  }

  rotateBy(radians: number): void {
    this.rig.rotate(radians);
    this.syncReset();
    this.wake();
  }

  // Torna alla vista proposta (dietro la pedina, o d'insieme).
  resetView(): void {
    this.rig.reset();
    this.syncReset();
    this.wake();
  }

  get viewMoved(): boolean {
    return this.rig.moved;
  }

  private syncReset(): void {
    this.resetBtn.hidden = !this.rig.moved;
    this.resetBtn.textContent = this.camMode === 'follow' ? `🎯 ${t('board3d.resetFollow')}` : `🎯 ${t('board3d.resetOverview')}`;
  }

  // ---------- cartellino della casella ----------

  private setHovered(spaceId: string | null): void {
    if (spaceId === this.hovered) return;
    this.hovered = spaceId;
    this.fillTag();
    this.wake();
  }

  // Nome della casella e, sotto, il prezzo o di chi è.
  private fillTag(): void {
    const id = this.hovered ?? this.selected;
    const space = id ? board.spaces.find((sp) => sp.id === id) : null;
    if (!space) {
      this.tag.hidden = true;
      return;
    }
    const own = this.lastState?.ownership[space.id];
    const owner = own ? this.lastState!.players[own.owner] : null;
    let sub = '';
    if (owner) sub = t('board3d.ownedBy', { name: owner.name }) + (own!.houses === 5 ? ' · 🏢' : own!.houses ? ` · 🏠${own!.houses}` : '') + (own!.mortgaged ? ` · ${t('space.mortgaged')}` : '');
    else if ('price' in space) sub = t('board3d.forSale', { price: `${board.currency.symbol} ${space.price}` });
    this.tag.replaceChildren();
    const name = document.createElement('strong');
    name.textContent = spaceName(space.id);
    this.tag.append(name);
    if (sub) {
      const small = document.createElement('small');
      small.textContent = sub;
      this.tag.append(small);
    }
    this.tag.style.setProperty('--c', owner ? playerColor(owner) : 'transparent');
    this.tag.dataset.tagSpace = space.id;
    this.tag.hidden = false;
  }

  private tagPoint = new THREE.Vector3();
  private placeTag(): void {
    if (this.tag.hidden) return;
    const tile = this.tiles.find((m) => m.userData.spaceId === this.tag.dataset.tagSpace);
    if (!tile) return;
    tile.getWorldPosition(this.tagPoint);
    this.tagPoint.y += 0.35;
    this.tagPoint.project(this.camera);
    const off = this.tagPoint.z > 1 || Math.abs(this.tagPoint.x) > 1.05 || Math.abs(this.tagPoint.y) > 1.05;
    this.tag.style.visibility = off ? 'hidden' : '';
    const w = this.container.clientWidth;
    const h = this.container.clientHeight;
    this.tag.style.transform = `translate(${((this.tagPoint.x + 1) / 2) * w}px, ${((1 - this.tagPoint.y) / 2) * h}px) translate(-50%, -100%)`;
  }

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
    this.renderer.domElement.removeEventListener('webglcontextlost', this.onContextLost);
    this.renderer.dispose();
    // restituisce subito il contesto WebGL al browser (altrimenti resta occupato fino alla pulizia della memoria)
    this.renderer.forceContextLoss();
    this.renderer.domElement.remove();
  }
}

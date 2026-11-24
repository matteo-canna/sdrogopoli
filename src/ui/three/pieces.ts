// Pedine: forme semplici (finché il personaggio 3D non è pronto), freccia del turno e reazioni.
import * as THREE from 'three';
import type { GameState } from '../../engine';
import type { CharacterModel, Reaction } from './characters3d';

export interface Hop {
  from: THREE.Vector3;
  to: THREE.Vector3;
  height: number;
}

export interface TokenView {
  mesh: THREE.Group;
  shownPosition: number;
  queue: Hop[];
  hopTime: number;
  // personaggio animato (null finché non è caricato: intanto si vede la pedina semplice)
  character: CharacterModel | null;
  // momento in cui nascondere la pedina dopo la bancarotta
  hideAt: number;
  wasBankrupt: boolean;
  inJail: boolean;
  // reazione da mostrare appena il personaggio si ferma
  pendingReaction: Reaction | null;
}

// Come reagisce un giocatore a quello che è appena successo (null = nessuna reazione).
export function reactionFor(prev: GameState, next: GameState, playerId: number): Reaction | null {
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

// Ogni giocatore ha una pedina di forma diversa, oltre che di colore diverso.
export function makeToken(color: string, shape: number): THREE.Group {
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
export function makeMarker(): THREE.Mesh {
  const m = new THREE.Mesh(
    new THREE.ConeGeometry(0.1, 0.2, 4),
    new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xffd54a, emissiveIntensity: 0.8 }),
  );
  m.rotation.x = Math.PI;
  return m;
}


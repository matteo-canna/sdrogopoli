// Tabellone fisso: base, centro disegnato e caselle (con un gruppo per le case di ognuna).
import * as THREE from 'three';
import { board } from '../../data';
import { centerTexture, spaceTexture } from './textures';
import { boardSide, spaceCenter, textRotation, TILE } from './layout';

export function buildBoard(scene: THREE.Scene, renderer: THREE.WebGLRenderer): { tiles: THREE.Mesh[]; buildings: THREE.Group[] } {
  const tiles: THREE.Mesh[] = [];
  const buildings: THREE.Group[] = [];
  // base del tabellone: grande quanto la griglia delle caselle, con un bordo di 0.4
  const g = boardSide();
  const base = new THREE.Mesh(
    new THREE.BoxGeometry(g + 0.4, 0.3, g + 0.4),
    new THREE.MeshStandardMaterial({ color: 0x6b8f71, roughness: 0.9 }),
  );
  base.position.y = -0.2;
  base.receiveShadow = true;
  scene.add(base);

  const center = new THREE.Mesh(
    new THREE.PlaneGeometry(g - 2, g - 2),
    new THREE.MeshStandardMaterial({ map: centerTexture(), roughness: 0.95 }),
  );
  center.rotation.x = -Math.PI / 2;
  center.position.y = -0.04;
  center.receiveShadow = true;
  scene.add(center);

  // caselle: un blocchetto con la faccia superiore disegnata
  const geo = new THREE.BoxGeometry(TILE, 0.1, TILE);
  const sideMat = new THREE.MeshStandardMaterial({ color: 0xeae4d3, roughness: 0.8 });
  board.spaces.forEach((space, i) => {
    const tex = spaceTexture(space, renderer);
    tex.center.set(0.5, 0.5);
    tex.rotation = textRotation(i);
    const topMat = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.85, emissive: 0x000000 });
    // ordine facce BoxGeometry: +x, -x, +y, -y, +z, -z
    const tile = new THREE.Mesh(geo, [sideMat, sideMat, topMat, sideMat, sideMat, sideMat]);
    tile.position.copy(spaceCenter(i)).setY(-0.05);
    tile.receiveShadow = true;
    tile.userData.spaceId = space.id;
    scene.add(tile);
    tiles.push(tile);

    const group = new THREE.Group();
    group.position.copy(spaceCenter(i));
    scene.add(group);
    buildings.push(group);
  });
  return { tiles, buildings };
}

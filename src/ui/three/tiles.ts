// Tabellone fisso: base, centro disegnato e caselle (con un gruppo per le case di ognuna).
import * as THREE from 'three';
import { board } from '../../data';
import { centerTexture, spaceTexture } from './boardTextures';
import { boardSide, spaceCenter, textRotation, TILE } from './layout';

export function buildBoard(scene: THREE.Scene, renderer: THREE.WebGLRenderer): { tiles: THREE.Mesh[]; buildings: THREE.Group[] } {
  const tiles: THREE.Mesh[] = [];
  const buildings: THREE.Group[] = [];
  // base del tabellone: zoccolo scuro e marciapiede, poco più grandi della griglia delle caselle
  const g = boardSide();
  const plinth = new THREE.Mesh(
    new THREE.BoxGeometry(g + 1.9, 0.42, g + 1.9),
    new THREE.MeshStandardMaterial({ color: 0x2a3038, roughness: 0.78, metalness: 0.12 }),
  );
  plinth.position.y = -0.31;
  plinth.receiveShadow = true;
  scene.add(plinth);
  const sidewalk = new THREE.Mesh(
    new THREE.BoxGeometry(g + 1.44, 0.14, g + 1.44),
    new THREE.MeshStandardMaterial({ color: 0xbeb7a9, roughness: 0.85 }),
  );
  sidewalk.position.y = -0.11;
  sidewalk.receiveShadow = true;
  scene.add(sidewalk);

  // centro: la città vista dall'alto (strade, prati, lago), disegnata per il tabellone grande e ridotta con lui
  const center = new THREE.Mesh(
    new THREE.PlaneGeometry(g - 2 + 0.04, g - 2 + 0.04),
    new THREE.MeshStandardMaterial({ map: centerTexture(renderer), roughness: 0.88 }),
  );
  center.rotation.x = -Math.PI / 2;
  center.position.y = -0.036;
  center.receiveShadow = true;
  scene.add(center);

  // caselle: un blocchetto con la faccia superiore disegnata
  const geo = new THREE.BoxGeometry(TILE, 0.085, TILE);
  const sideMat = new THREE.MeshStandardMaterial({ color: 0xd4cbb8, roughness: 0.78 });
  board.spaces.forEach((space, i) => {
    const tex = spaceTexture(space, renderer);
    tex.center.set(0.5, 0.5);
    tex.rotation = textRotation(i);
    const topMat = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.78, emissive: 0x000000 });
    // ordine facce BoxGeometry: +x, -x, +y, -y, +z, -z
    const tile = new THREE.Mesh(geo, [sideMat, sideMat, topMat, sideMat, sideMat, sideMat]);
    tile.position.copy(spaceCenter(i)).setY(-0.042);
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

import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { CHARACTERS, characterDef, defaultAppearance } from '../src/ui/characters';
import { FIGURES, FigureModel, applyPose, type FigureParts } from '../src/ui/three/figures';
import { it as itMsgs } from '../src/i18n/it';
import type { MsgKey } from '../src/i18n';
import { en } from '../src/i18n/en';

const figureIds = CHARACTERS.filter((c) => c.figure).map((c) => c.id);

describe('catalogo', () => {
  it('le figure del catalogo sono quelle costruite', () => {
    expect(figureIds.length).toBeGreaterThanOrEqual(3);
    expect(figureIds.sort()).toEqual(Object.keys(FIGURES).sort());
  });

  it('le figure non hanno file da scaricare né cappelli, mantelli o oggetti', () => {
    for (const id of figureIds) {
      const def = characterDef(id);
      expect(def.file, id).toBe('');
      expect(def.hat, id).toBeNull();
      expect(def.cape, id).toBeNull();
      expect(Object.keys(def.items), id).toEqual([]);
      expect(def.emoji, id).toBeTruthy();
    }
  });

  it('ogni personaggio ha il nome nelle due lingue', () => {
    for (const c of CHARACTERS) {
      const k = `char.${c.id}` as MsgKey;
      expect(itMsgs[k], c.id).toBeTruthy();
      expect(en[k], c.id).toBeTruthy();
    }
  });
});

describe('costruzione', () => {
  it.each(figureIds)('%s ha testa, braccia e gambe e sta in piedi sull\'origine', (id) => {
    const parts = FIGURES[id]('#e4572e');
    expect(parts.head).toBeTruthy();
    expect(parts.arms.length).toBe(2);
    expect(parts.legs.length).toBe(2);
    const box = new THREE.Box3().setFromObject(parts.group);
    // alto più che largo, e appoggiato a terra
    expect(box.max.y - box.min.y, id).toBeGreaterThan(0.5);
    expect(box.min.y, id).toBeGreaterThanOrEqual(-0.01);
    expect(box.max.y - box.min.y, id).toBeGreaterThan(box.max.x - box.min.x);
  });

  it.each(figureIds)('%s viene alto come i personaggi scaricati', (id) => {
    const model = new FigureModel({ ...defaultAppearance(0), character: id }, 1.7);
    const box = new THREE.Box3().setFromObject(model.root);
    expect(box.max.y, id).toBeGreaterThan(1.5);
    expect(box.max.y, id).toBeLessThan(1.9);
    model.dispose();
  });

  it('usa il colore scelto per la base', () => {
    const model = new FigureModel({ ...defaultAppearance(0), character: 'robot', color: '#2e86de' }, 1);
    const base = model.root.getObjectByName('base') as THREE.Mesh;
    expect(base).toBeTruthy();
    expect(`#${(base.material as THREE.MeshStandardMaterial).color.getHexString()}`).toBe('#2e86de');
    model.dispose();
  });
});

describe('pose', () => {
  const parts = (): FigureParts => FIGURES.robot('#e4572e');

  it('ogni posa muove qualcosa di diverso', () => {
    const snapshot = (pose: Parameters<typeof applyPose>[1]) => {
      const p = parts();
      applyPose(p, pose, 0.4);
      return JSON.stringify([
        p.group.position.toArray(),
        p.group.rotation.toArray().slice(0, 3),
        p.head.rotation.toArray().slice(0, 3),
        p.arms.map((a) => a.rotation.x),
        p.legs.map((l) => l.rotation.x),
      ]);
    };
    const poses = ['idle', 'walk', 'jump', 'cheer', 'hit', 'collect', 'build', 'defeat', 'sit'] as const;
    const seen = new Map<string, string>();
    for (const pose of poses) {
      const key = snapshot(pose);
      expect(seen.has(key), `${pose} uguale a ${seen.get(key)}`).toBe(false);
      seen.set(key, pose);
    }
  });

  it('camminando le braccia vanno avanti e indietro', () => {
    const p = parts();
    applyPose(p, 'walk', 0);
    const a = p.arms[0].rotation.x;
    applyPose(p, 'walk', 0.3);
    expect(p.arms[0].rotation.x).not.toBe(a);
    // le due braccia non vanno mai dalla stessa parte
    expect(Math.sign(p.arms[0].rotation.x)).not.toBe(Math.sign(p.arms[1].rotation.x));
  });

  it('tornando alla posa di base le parti tornano a posto', () => {
    const p = parts();
    applyPose(p, 'defeat', 1);
    expect(p.group.rotation.x).toBeGreaterThan(0);
    applyPose(p, 'idle', 0);
    expect(p.group.rotation.x).toBe(0);
    expect(p.group.position.x).toBe(0);
  });
});

describe('reazioni', () => {
  it('una reazione dura un momento e poi torna la posa di base', () => {
    const model = new FigureModel(defaultAppearance(0), 1, FIGURES.gatto);
    model.setBase('idle');
    model.react('cheer');
    expect(model.reacting).toBe(true);
    expect(model.currentPose).toBe('cheer');
    model.update(0.5);
    expect(model.currentPose).toBe('cheer');
    model.update(1);
    expect(model.reacting).toBe(false);
    expect(model.currentPose).toBe('idle');
    model.dispose();
  });

  it('camminare interrompe subito la reazione', () => {
    const model = new FigureModel(defaultAppearance(0), 1, FIGURES.astronauta);
    model.react('collect');
    model.setBase('walk', 0.1, true);
    expect(model.reacting).toBe(false);
    expect(model.currentPose).toBe('walk');
    model.dispose();
  });
});

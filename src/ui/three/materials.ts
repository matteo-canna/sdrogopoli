// Sistema PBR procedurale v3 (Full HD+): mappa riflessi da studio (PMREM), texture Canvas HD e palette materiali realistici.
import * as THREE from 'three';
import type { FinishId } from '../../engine';

const envCache = new WeakMap<THREE.WebGLRenderer, THREE.Texture>();

export function getStudioEnvMap(renderer: THREE.WebGLRenderer): THREE.Texture {
  const cached = envCache.get(renderer);
  if (cached) return cached;
  const pmrem = new THREE.PMREMGenerator(renderer);
  pmrem.compileEquirectangularShader();

  const envScene = new THREE.Scene();
  envScene.background = new THREE.Color(0x1f2630);

  const addPanel = (color: number, intensity: number, w: number, h: number, pos: [number, number, number], look: [number, number, number]) => {
    const m = new THREE.Mesh(
      new THREE.PlaneGeometry(w, h),
      new THREE.MeshBasicMaterial({ color: new THREE.Color(color).multiplyScalar(intensity), side: THREE.DoubleSide }),
    );
    m.position.set(...pos);
    m.lookAt(...look);
    envScene.add(m);
  };

  addPanel(0xfff7ea, 3.2, 8, 5, [6, 7, 5], [0, 0, 0]);
  addPanel(0xc8e4ff, 2.0, 8, 6, [-7, 4, 3], [0, 0, 0]);
  addPanel(0xffffff, 2.8, 10, 2.5, [0, 5, -7], [0, 0, 0]);
  addPanel(0xffffff, 2.4, 12, 1.2, [0, 2.2, 7], [0, 0.5, 0]);
  addPanel(0x4a5560, 0.9, 18, 18, [0, -5, 0], [0, 0, 0]);

  const rt = pmrem.fromScene(envScene, 0.035);
  pmrem.dispose();
  envCache.set(renderer, rt.texture);
  return rt.texture;
}

const texCache = new Map<string, THREE.CanvasTexture>();

function makeTexRect(
  key: string,
  w: number,
  h: number,
  draw: (ctx: CanvasRenderingContext2D, w: number, h: number) => void,
  repeat = 1,
  srgb = true,
): THREE.CanvasTexture {
  const existing = texCache.get(key);
  if (existing) return existing;
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d');
  if (ctx) draw(ctx, w, h);
  const tex = new THREE.CanvasTexture(c);
  if (srgb) tex.colorSpace = THREE.SRGBColorSpace;
  if (repeat > 1) {
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(repeat, repeat);
  }
  tex.anisotropy = 4;
  texCache.set(key, tex);
  return tex;
}

function makeTex(key: string, size: number, draw: (ctx: CanvasRenderingContext2D, s: number) => void, repeat = 1, srgb = true): THREE.CanvasTexture {
  return makeTexRect(key, size, size, (ctx, w) => draw(ctx, w), repeat, srgb);
}

export function brushedBumpTex(): THREE.CanvasTexture {
  return makeTex('brushed-bump', 256, (ctx, s) => {
    ctx.fillStyle = '#808080';
    ctx.fillRect(0, 0, s, s);
    for (let y = 0; y < s; y++) {
      const v = 110 + Math.floor(Math.sin(y * 1.7) * 14 + ((y * 53) % 28));
      ctx.fillStyle = `rgb(${v},${v},${v})`;
      ctx.fillRect(0, y, s, 1);
    }
  }, 2, false);
}

export function leatherBumpTex(): THREE.CanvasTexture {
  return makeTex('leather-bump', 256, (ctx, s) => {
    ctx.fillStyle = '#7c7c7c';
    ctx.fillRect(0, 0, s, s);
    for (let i = 0; i < 2200; i++) {
      const x = (i * 97) % s;
      const y = (i * 53 + Math.floor(i / 4) * 13) % s;
      const r = 1.1 + (i % 3) * 0.65;
      ctx.fillStyle = i % 2 ? '#9c9c9c' : '#555555';
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    }
  }, 3, false);
}

export function carbonTex(): THREE.CanvasTexture {
  return makeTex('carbon', 128, (ctx, s) => {
    ctx.fillStyle = '#181c22';
    ctx.fillRect(0, 0, s, s);
    const step = 16;
    for (let y = 0; y < s; y += step) {
      for (let x = 0; x < s; x += step) {
        const alt = ((x + y) / step) % 2 === 0;
        ctx.fillStyle = alt ? '#2a303a' : '#12151a';
        ctx.fillRect(x, y, step / 2, step);
        ctx.fillStyle = alt ? '#1f242d' : '#2f3642';
        ctx.fillRect(x + step / 2, y, step / 2, step);
      }
    }
  }, 4, true);
}

export function woodTex(tone: 'walnut' | 'teak' = 'walnut'): THREE.CanvasTexture {
  return makeTex(`wood-${tone}`, 256, (ctx, s) => {
    ctx.fillStyle = tone === 'teak' ? '#b8834b' : '#5a361e';
    ctx.fillRect(0, 0, s, s);
    for (let y = 0; y < s; y += 2) {
      const n = Math.sin(y * 0.18) * 14 + Math.cos(y * 0.43) * 8;
      ctx.fillStyle = tone === 'teak'
        ? `rgba(${90 + n}, ${55 + n * 0.6}, 25, 0.28)`
        : `rgba(${45 + n}, ${22 + n * 0.5}, 10, 0.35)`;
      ctx.fillRect(0, y, s, 2);
    }
    if (tone === 'teak') {
      ctx.fillStyle = '#2d1c10';
      for (let x = 0; x < s; x += 32) ctx.fillRect(x, 0, 3, s);
    }
  }, 2, true);
}

export function marbleTex(): THREE.CanvasTexture {
  return makeTex('marble', 256, (ctx, s) => {
    ctx.fillStyle = '#f2efe9';
    ctx.fillRect(0, 0, s, s);
    ctx.strokeStyle = 'rgba(130, 128, 122, 0.35)';
    for (let k = 0; k < 14; k++) {
      ctx.lineWidth = 1 + (k % 3);
      ctx.beginPath();
      let y = (k * 23) % s;
      ctx.moveTo(0, y);
      for (let x = 0; x <= s; x += 16) {
        y += Math.sin(x * 0.04 + k * 1.7) * 8;
        ctx.lineTo(x, y);
      }
      ctx.stroke();
    }
  }, 1, true);
}

// ---------- TEXTURE HD PER VEICOLI, STRUMENTI, GLOBO, OROLOGIO, ARCADE & ARCHITETTURA ----------

export function licensePlateTex(text: string): THREE.CanvasTexture {
  return makeTexRect(`plate-${text}`, 256, 128, (ctx, w, h) => {
    ctx.fillStyle = '#f8f6ee';
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = '#181c24';
    ctx.lineWidth = 8;
    ctx.strokeRect(6, 6, w - 12, h - 12);
    ctx.fillStyle = '#1d4ed8';
    ctx.fillRect(10, 10, 36, h - 20);
    ctx.fillStyle = '#fde047';
    ctx.font = 'bold 20px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('IT', 28, h * 0.72);
    ctx.fillStyle = '#111827';
    ctx.font = '900 52px monospace';
    ctx.fillText(text, w * 0.57, h * 0.54);
  }, 1, true);
}

export function speedometerTex(): THREE.CanvasTexture {
  return makeTex('speedo', 256, (ctx, s) => {
    const c = s / 2;
    ctx.fillStyle = '#f7f2e4';
    ctx.fillRect(0, 0, s, s);
    ctx.strokeStyle = '#1f2937';
    ctx.lineWidth = 6;
    ctx.beginPath(); ctx.arc(c, c, 114, 0, Math.PI * 2); ctx.stroke();
    for (let i = 0; i <= 12; i++) {
      const a = Math.PI * 0.75 + (i / 12) * Math.PI * 1.5;
      ctx.lineWidth = i % 2 === 0 ? 5 : 2.5;
      ctx.strokeStyle = i >= 10 ? '#dc2626' : '#111827';
      ctx.beginPath();
      ctx.moveTo(c + Math.cos(a) * 90, c + Math.sin(a) * 90);
      ctx.lineTo(c + Math.cos(a) * 108, c + Math.sin(a) * 108);
      ctx.stroke();
    }
    // Contachilometri
    ctx.fillStyle = '#111827';
    ctx.fillRect(c - 34, c + 36, 68, 22);
    ctx.fillStyle = '#f8fafc';
    ctx.font = 'bold 14px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('01964', c, c + 47);
    // Lancetta rossa
    ctx.strokeStyle = '#dc2626';
    ctx.lineWidth = 5;
    ctx.beginPath(); ctx.moveTo(c, c); ctx.lineTo(c + 52, c - 64); ctx.stroke();
    ctx.fillStyle = '#111827';
    ctx.beginPath(); ctx.arc(c, c, 10, 0, Math.PI * 2); ctx.fill();
  }, 1, true);
}

export function globeMapTex(primaryHex: string): THREE.CanvasTexture {
  return makeTexRect(`globe-map-${primaryHex}`, 1024, 512, (ctx, w, h) => {
    const bg = ctx.createLinearGradient(0, 0, 0, h);
    bg.addColorStop(0, '#c8d5cf');
    bg.addColorStop(0.25, '#a8c2c7');
    bg.addColorStop(0.5, '#95b6bf');
    bg.addColorStop(0.75, '#a8c2c7');
    bg.addColorStop(1, '#d3dad4');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, w, h);

    ctx.strokeStyle = 'rgba(65, 55, 38, 0.25)';
    ctx.lineWidth = 1.2;
    for (let x = 0; x <= w; x += w / 24) {
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke();
    }
    for (let y = 0; y <= h; y += h / 12) {
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke();
    }
    ctx.strokeStyle = 'rgba(140, 45, 30, 0.55)';
    ctx.lineWidth = 2.2;
    ctx.beginPath(); ctx.moveTo(0, h / 2); ctx.lineTo(w, h / 2); ctx.stroke();
    ctx.setLineDash([8, 6]);
    ctx.lineWidth = 1.4;
    ctx.beginPath(); ctx.moveTo(0, h * 0.37); ctx.lineTo(w, h * 0.37); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(0, h * 0.63); ctx.lineTo(w, h * 0.63); ctx.stroke();
    ctx.setLineDash([]);

    const drawLand = (pts: [number, number][], fill: string) => {
      ctx.beginPath();
      pts.forEach(([px, py], i) => {
        const x = (px / 360 + 0.5) * w;
        const y = (0.5 - py / 180) * h;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      });
      ctx.closePath();
      ctx.fillStyle = fill;
      ctx.fill();
      ctx.strokeStyle = '#5c4328';
      ctx.lineWidth = 2.4;
      ctx.stroke();
    };

    drawLand([[-165, 65], [-135, 70], [-95, 68], [-60, 52], [-75, 35], [-82, 24], [-98, 18], [-105, 22], [-118, 32], [-128, 48], [-150, 60]], '#dec494');
    drawLand([[-52, 60], [-42, 82], [-18, 80], [-24, 68], [-44, 60]], '#e7d9b8');
    drawLand([[-80, 10], [-62, 10], [-35, -6], [-40, -23], [-55, -36], [-68, -54], [-75, -46], [-72, -18], [-81, -4]], '#d4b581');
    drawLand([[-10, 36], [5, 43], [12, 45], [18, 40], [15, 37], [11, 42], [22, 37], [30, 46], [42, 60], [28, 70], [8, 62], [-6, 54], [-9, 43]], primaryHex);
    drawLand([[-17, 15], [-6, 35], [11, 37], [33, 31], [43, 12], [51, 11], [40, -10], [33, -26], [19, -35], [12, -16], [9, 4], [-8, 5]], '#d8b77e');
    drawLand([[44, -12], [50, -14], [47, -25], [43, -23]], '#d8b77e');
    drawLand([[32, 42], [60, 70], [110, 74], [168, 66], [142, 46], [122, 38], [120, 22], [105, 10], [98, 18], [80, 8], [68, 24], [52, 24], [44, 13], [35, 32]], '#e0c696');
    drawLand([[130, 31], [142, 44], [145, 42], [136, 33]], '#c9a66b');
    drawLand([[114, -22], [132, -12], [145, -14], [154, -28], [146, -38], [132, -33], [115, -34]], '#d7b47c');
    drawLand([[-180, -72], [-120, -74], [-60, -66], [0, -70], [60, -68], [120, -67], [180, -72], [180, -90], [-180, -90]], '#ece8dc');

    const drawCompass = (cx: number, cy: number, r: number) => {
      ctx.save();
      ctx.translate(cx, cy);
      ctx.strokeStyle = 'rgba(92, 67, 40, 0.55)';
      ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.stroke();
      for (let i = 0; i < 8; i++) {
        const a = (i * Math.PI) / 4;
        const len = i % 2 === 0 ? r * 1.15 : r * 0.72;
        ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(Math.cos(a) * len, Math.sin(a) * len); ctx.stroke();
      }
      ctx.restore();
    };
    drawCompass(w * 0.14, h * 0.56, 26);
    drawCompass(w * 0.42, h * 0.62, 22);
  }, 1, true);
}

export function horizonRingTex(): THREE.CanvasTexture {
  return makeTex('globe-horizon', 512, (ctx, s) => {
    const c = s / 2;
    ctx.fillStyle = '#efe3c6';
    ctx.fillRect(0, 0, s, s);
    ctx.strokeStyle = '#5a3d20';
    ctx.lineWidth = 4;
    ctx.beginPath(); ctx.arc(c, c, 242, 0, Math.PI * 2); ctx.stroke();
    ctx.beginPath(); ctx.arc(c, c, 190, 0, Math.PI * 2); ctx.stroke();
    for (let i = 0; i < 72; i++) {
      const a = (i / 72) * Math.PI * 2;
      ctx.lineWidth = i % 9 === 0 ? 3.5 : 1.5;
      ctx.beginPath();
      ctx.moveTo(c + Math.cos(a) * 190, c + Math.sin(a) * 190);
      ctx.lineTo(c + Math.cos(a) * (i % 9 === 0 ? 214 : 204), c + Math.sin(a) * (i % 9 === 0 ? 214 : 204));
      ctx.stroke();
    }
    const labels = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
    ctx.fillStyle = '#3b2412';
    ctx.font = 'bold 26px Georgia, serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    labels.forEach((lbl, i) => {
      const a = (i / 8) * Math.PI * 2 - Math.PI / 2;
      ctx.save();
      ctx.translate(c + Math.cos(a) * 224, c + Math.sin(a) * 224);
      ctx.rotate(a + Math.PI / 2);
      ctx.fillText(lbl, 0, 0);
      ctx.restore();
    });
  }, 1, true);
}

export function watchDialTex(): THREE.CanvasTexture {
  return makeTex('watch-dial-v2', 512, (ctx, s) => {
    const c = s / 2;
    const grad = ctx.createRadialGradient(c, c, 20, c, c, c);
    grad.addColorStop(0, '#fffdf8');
    grad.addColorStop(0.75, '#f2e9d5');
    grad.addColorStop(1, '#d5c7a8');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, s, s);

    ctx.strokeStyle = 'rgba(130, 112, 78, 0.16)';
    ctx.lineWidth = 1.2;
    for (let i = 0; i < 48; i++) {
      const a = (i / 48) * Math.PI * 2;
      ctx.beginPath(); ctx.moveTo(c, c); ctx.lineTo(c + Math.cos(a) * 150, c + Math.sin(a) * 150); ctx.stroke();
    }
    for (let r = 36; r <= 146; r += 18) {
      ctx.beginPath(); ctx.arc(c, c, r, 0, Math.PI * 2); ctx.stroke();
    }

    ctx.strokeStyle = '#1b1f26';
    ctx.lineWidth = 4;
    ctx.beginPath(); ctx.arc(c, c, 232, 0, Math.PI * 2); ctx.stroke();
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(c, c, 218, 0, Math.PI * 2); ctx.stroke();
    for (let i = 0; i < 60; i++) {
      const a = (i / 60) * Math.PI * 2 - Math.PI / 2;
      ctx.lineWidth = i % 5 === 0 ? 5.5 : 2;
      ctx.beginPath();
      ctx.moveTo(c + Math.cos(a) * 218, c + Math.sin(a) * 218);
      ctx.lineTo(c + Math.cos(a) * 232, c + Math.sin(a) * 232);
      ctx.stroke();
    }

    const romans = ['XII', 'I', 'II', 'III', 'IV', 'V', '', 'VII', 'VIII', 'IX', 'X', 'XI'];
    ctx.fillStyle = '#14171d';
    ctx.font = 'bold 38px Georgia, serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    romans.forEach((r, i) => {
      if (!r) return;
      const a = (i / 12) * Math.PI * 2 - Math.PI / 2;
      ctx.fillText(r, c + Math.cos(a) * 176, c + Math.sin(a) * 176);
    });

    ctx.font = 'bold 21px Georgia, serif';
    ctx.fillText('GIOCO FOLLE!', c, c - 76);
    ctx.font = 'italic 14px Georgia, serif';
    ctx.fillStyle = '#5c5240';
    ctx.fillText('TOURBILLON · GENÈVE', c, c - 50);

    ctx.fillStyle = '#17191f';
    ctx.beginPath(); ctx.arc(c, c + 106, 70, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#b88a32';
    ctx.lineWidth = 6;
    ctx.beginPath(); ctx.arc(c, c + 106, 70, 0, Math.PI * 2); ctx.stroke();

    for (const sx of [-86, 86]) {
      ctx.fillStyle = '#2563eb';
      ctx.beginPath(); ctx.arc(c + sx, c + 106, 6, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = '#93c5fd';
      ctx.lineWidth = 1.6;
      ctx.beginPath(); ctx.moveTo(c + sx - 4, c + 106 - 2); ctx.lineTo(c + sx + 4, c + 106 + 2); ctx.stroke();
    }
  }, 1, true);
}

export function cameraDialTex(): THREE.CanvasTexture {
  return makeTex('cam-dial', 256, (ctx, s) => {
    const c = s / 2;
    ctx.fillStyle = '#1b1f26';
    ctx.fillRect(0, 0, s, s);
    ctx.strokeStyle = '#6c7480';
    ctx.lineWidth = 4;
    ctx.beginPath(); ctx.arc(c, c, 114, 0, Math.PI * 2); ctx.stroke();
    const vals = ['A', '1000', '500', '250', '125', '60', '30', '15', 'B'];
    ctx.font = 'bold 20px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    vals.forEach((v, i) => {
      const a = (i / vals.length) * Math.PI * 2 - Math.PI / 2;
      ctx.fillStyle = v === 'A' ? '#ef4444' : v === 'B' ? '#f59e0b' : '#f1f5f9';
      ctx.fillText(v, c + Math.cos(a) * 84, c + Math.sin(a) * 84);
    });
    ctx.fillStyle = '#374151';
    ctx.beginPath(); ctx.arc(c, c, 32, 0, Math.PI * 2); ctx.fill();
  }, 1, true);
}

export function cameraLcdTex(): THREE.CanvasTexture {
  return makeTexRect('cam-lcd', 384, 256, (ctx, w, h) => {
    const g = ctx.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, '#10203a');
    g.addColorStop(0.58, '#4a6485');
    g.addColorStop(0.75, '#d98c5f');
    g.addColorStop(1, '#1b232e');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);

    ctx.fillStyle = '#111824';
    const bld = [[24, 150, 32], [62, 130, 40], [110, 110, 36], [156, 92, 46], [210, 124, 38], [258, 138, 44], [312, 148, 46]];
    for (const [bx, by, bw] of bld) ctx.fillRect(bx, by, bw, h - by - 36);

    ctx.strokeStyle = 'rgba(255,255,255,0.28)';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(w / 3, 28); ctx.lineTo(w / 3, h - 36);
    ctx.moveTo((2 * w) / 3, 28); ctx.lineTo((2 * w) / 3, h - 36);
    ctx.moveTo(14, h * 0.36); ctx.lineTo(w - 14, h * 0.36);
    ctx.moveTo(14, h * 0.66); ctx.lineTo(w - 14, h * 0.66);
    ctx.stroke();

    ctx.strokeStyle = '#22c55e';
    ctx.lineWidth = 2.5;
    ctx.strokeRect(w / 2 - 28, h / 2 - 22, 56, 44);

    ctx.fillStyle = 'rgba(0,0,0,0.68)';
    ctx.fillRect(0, 0, w, 28);
    ctx.fillRect(0, h - 36, w, 36);

    ctx.fillStyle = '#e2e8f0';
    ctx.font = 'bold 14px monospace';
    ctx.fillText('RAW+JPG   AF-S   [ 482 ]', 12, 19);
    ctx.fillStyle = '#22c55e';
    ctx.fillRect(w - 42, 8, 26, 12);

    ctx.fillStyle = '#f8fafc';
    ctx.font = 'bold 17px monospace';
    ctx.fillText('1/500   F1.4   ISO 100   +0.3', 14, h - 12);
  }, 1, true);
}

export function lensScaleTex(): THREE.CanvasTexture {
  return makeTexRect('lens-scale', 512, 64, (ctx, w, h) => {
    ctx.fillStyle = '#171a20';
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#cbd5e1';
    ctx.font = 'bold 18px monospace';
    ctx.textBaseline = 'middle';
    ctx.fillText('0.45   0.7   1.2   2   5   ∞   |  50mm  1:1.4  PRO', 18, 22);
    ctx.fillStyle = '#f59e0b';
    ctx.font = 'bold 15px monospace';
    ctx.fillText('16  11  8  5.6  4  2.8  2  1.4  |  16  11  8  4  1.4', 18, 48);
  }, 1, true);
}

export function cameraBadgeTex(): THREE.CanvasTexture {
  return makeTexRect('cam-badge', 256, 64, (ctx, w, h) => {
    ctx.fillStyle = '#15181e';
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = '#94a3b8';
    ctx.lineWidth = 4;
    ctx.strokeRect(4, 4, w - 8, h - 8);
    ctx.fillStyle = '#f8fafc';
    ctx.font = '900 30px Georgia, serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('FOLLE!', w / 2, h / 2);
  }, 1, true);
}

export function vinylTex(accentHex: string): THREE.CanvasTexture {
  return makeTex(`vinyl-v3-${accentHex}`, 512, (ctx, s) => {
    const c = s / 2;
    ctx.fillStyle = '#111317';
    ctx.fillRect(0, 0, s, s);
    // Riflesso diagonale da vinile
    const sheen = ctx.createLinearGradient(0, 0, s, s);
    sheen.addColorStop(0, 'rgba(255,255,255,0)');
    sheen.addColorStop(0.46, 'rgba(255,255,255,0.12)');
    sheen.addColorStop(0.54, 'rgba(255,255,255,0)');
    ctx.fillStyle = sheen;
    ctx.fillRect(0, 0, s, s);
    for (let r = 84; r < 248; r += 3) {
      ctx.strokeStyle = r % 36 === 0 ? '#090a0d' : r % 6 === 0 ? '#272b33' : '#181a20';
      ctx.lineWidth = r % 36 === 0 ? 3.5 : 1.3;
      ctx.beginPath(); ctx.arc(c, c, r, 0, Math.PI * 2); ctx.stroke();
    }
    // Etichetta centrale vintage con scritta dorata
    ctx.fillStyle = accentHex;
    ctx.beginPath(); ctx.arc(c, c, 78, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#f4c442';
    ctx.lineWidth = 4;
    ctx.beginPath(); ctx.arc(c, c, 66, 0, Math.PI * 2); ctx.stroke();
    ctx.fillStyle = '#fff9db';
    ctx.font = 'bold 16px Georgia, serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('FOLLE!', c, c - 28);
    ctx.font = 'italic 12px Georgia, serif';
    ctx.fillText('78 RPM · HI-FI', c, c + 30);
    ctx.fillStyle = '#111';
    ctx.beginPath(); ctx.arc(c, c, 10, 0, Math.PI * 2); ctx.fill();
  }, 1, true);
}

export function arcadeScreenTex(): THREE.CanvasTexture {
  return makeTex('arcade-screen-v3', 384, (ctx, s) => {
    ctx.fillStyle = '#050816';
    ctx.fillRect(0, 0, s, s);
    // Campo stellare
    for (let i = 0; i < 45; i++) {
      ctx.fillStyle = i % 3 === 0 ? '#93c5fd' : '#ffffff';
      ctx.fillRect((i * 83) % s, (i * 59) % (s * 0.65), 2, 2);
    }
    // HUD punteggio in alto
    ctx.fillStyle = '#f43f5e';
    ctx.font = 'bold 18px monospace';
    ctx.fillText('1UP 42100', 18, 26);
    ctx.fillStyle = '#fde047';
    ctx.fillText('HI 99850', 220, 26);
    // Griglia synthwave prospettica
    ctx.strokeStyle = 'rgba(0, 229, 255, 0.55)';
    ctx.lineWidth = 2;
    for (let y = 215; y < s; y += 26) {
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(s, y); ctx.stroke();
    }
    for (let x = -80; x <= s + 80; x += 48) {
      ctx.beginPath(); ctx.moveTo(s / 2, 215); ctx.lineTo(x, s); ctx.stroke();
    }
    // Ondate di alieni pixel-art
    const colors = ['#ff2e63', '#f59e0b', '#22c55e', '#a855f7'];
    for (let r = 0; r < 4; r++) {
      ctx.fillStyle = colors[r];
      for (let c = 0; c < 6; c++) {
        const bx = 36 + c * 54;
        const by = 52 + r * 34;
        ctx.fillRect(bx, by + 6, 30, 14);
        ctx.fillRect(bx + 6, by, 18, 6);
        ctx.fillStyle = '#050816';
        ctx.fillRect(bx + 6, by + 9, 5, 5);
        ctx.fillRect(bx + 19, by + 9, 5, 5);
        ctx.fillStyle = colors[r];
      }
    }
    // Scudi pixelati + navicella + doppio laser
    ctx.fillStyle = '#22c55e';
    for (const sx of [54, 166, 278]) ctx.fillRect(sx, 268, 48, 16);
    ctx.fillStyle = '#00e5ff';
    ctx.fillRect(168, 326, 48, 18);
    ctx.fillRect(184, 310, 16, 16);
    ctx.fillStyle = '#fef08a';
    ctx.fillRect(189, 198, 6, 108);
    // Scanlines CRT
    ctx.fillStyle = 'rgba(0,0,0,0.24)';
    for (let y = 0; y < s; y += 4) ctx.fillRect(0, y, s, 2);
  }, 1, true);
}

export function arcadeMarqueeTex(primaryHex: string): THREE.CanvasTexture {
  return makeTexRect(`marquee-v3-${primaryHex}`, 384, 128, (ctx, w, h) => {
    const g = ctx.createLinearGradient(0, 0, w, 0);
    g.addColorStop(0, '#0f0722');
    g.addColorStop(0.5, primaryHex);
    g.addColorStop(1, '#0f0722');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = '#38bdf8';
    ctx.lineWidth = 6;
    ctx.strokeRect(8, 8, w - 16, h - 16);
    ctx.fillStyle = '#fef08a';
    ctx.font = '900 54px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('FOLLE!', w / 2, h * 0.48);
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 16px monospace';
    ctx.fillText('★ SUPER ARCADE 1984 ★', w / 2, h * 0.82);
  }, 1, true);
}

export function arcadeSideArtTex(primaryHex: string, accentHex: string): THREE.CanvasTexture {
  return makeTexRect(`arcade-side-${primaryHex}-${accentHex}`, 256, 512, (ctx, w, h) => {
    ctx.fillStyle = '#121622';
    ctx.fillRect(0, 0, w, h);
    // Bande diagonali retro anni '80
    const stripes = [primaryHex, accentHex, '#f43f5e', '#38bdf8'];
    stripes.forEach((col, i) => {
      ctx.fillStyle = col;
      ctx.beginPath();
      const y = 90 + i * 44;
      ctx.moveTo(0, y); ctx.lineTo(w, y - 55); ctx.lineTo(w, y - 28); ctx.lineTo(0, y + 27);
      ctx.closePath(); ctx.fill();
    });
    // Sole synthwave stilizzato
    ctx.fillStyle = accentHex;
    ctx.beginPath(); ctx.arc(w * 0.52, h * 0.68, 66, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#121622';
    for (let k = 0; k < 5; k++) ctx.fillRect(0, h * 0.68 + k * 14, w, 4 + k);
  }, 1, true);
}

export function skyscraperTex(): { map: THREE.CanvasTexture; emissive: THREE.CanvasTexture } {
  const map = makeTex('deco-map-v3', 384, (ctx, s) => {
    ctx.fillStyle = '#d8d0c1';
    ctx.fillRect(0, 0, s, s);
    for (let y = 10; y < s; y += 24) {
      for (let x = 12; x < s; x += 28) {
        ctx.fillStyle = '#24303e';
        ctx.fillRect(x, y, 15, 16);
        ctx.fillStyle = '#b49452';
        ctx.fillRect(x, y + 16, 15, 3); // spandrel dorato
      }
    }
    ctx.fillStyle = '#ebe4d6';
    for (let x = 0; x < s; x += 28) ctx.fillRect(x, 0, 7, s);
  }, 2, true);

  const emissive = makeTex('deco-emissive-v3', 384, (ctx, s) => {
    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, s, s);
    for (let y = 10; y < s; y += 24) {
      for (let x = 12; x < s; x += 28) {
        if ((x * 7 + y * 13) % 5 !== 0) {
          ctx.fillStyle = (x + y) % 3 === 0 ? '#ffd884' : '#fff0c4';
          ctx.fillRect(x, y, 15, 16);
        }
      }
    }
  }, 2, false);

  return { map, emissive };
}


// ---------- TEXTURE HD PER I 10 PERSONAGGI DA COLLEZIONE (v4) ----------

export function heraldryTex(primaryHex: string, accentHex: string): THREE.CanvasTexture {
  return makeTex(`heraldry-${primaryHex}-${accentHex}`, 256, (ctx, s) => {
    const c = s / 2;
    ctx.fillStyle = primaryHex;
    ctx.fillRect(0, 0, s, s);
    // Inquartatura araldica diagonale/a croce
    ctx.fillStyle = '#181e29';
    ctx.fillRect(c, 0, c, c);
    ctx.fillRect(0, c, c, c);
    // Croce centrale dorata
    ctx.fillStyle = accentHex;
    ctx.fillRect(c - 18, 0, 36, s);
    ctx.fillRect(0, c - 18, s, 36);
    // Cornice doppia con borchie
    ctx.strokeStyle = accentHex;
    ctx.lineWidth = 14;
    ctx.strokeRect(7, 7, s - 14, s - 14);
    // Stemma centrale a scudetto
    ctx.fillStyle = primaryHex;
    ctx.beginPath();
    ctx.arc(c, c, 36, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#fff5cc';
    ctx.lineWidth = 5;
    ctx.stroke();
    ctx.fillStyle = '#fff5cc';
    ctx.font = 'bold 42px Georgia, serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('S', c, c + 2);
  }, 1, true);
}

export function evaChestTex(): THREE.CanvasTexture {
  return makeTex('eva-chest', 256, (ctx, s) => {
    ctx.fillStyle = '#dde3ea';
    ctx.fillRect(0, 0, s, s);
    ctx.strokeStyle = '#64748b';
    ctx.lineWidth = 8;
    ctx.strokeRect(8, 8, s - 16, s - 16);
    // Display telemetria O2 verde
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(26, 26, 128, 62);
    ctx.fillStyle = '#22c55e';
    ctx.font = 'bold 20px monospace';
    ctx.fillText('O2  98%', 36, 52);
    ctx.fillStyle = '#38bdf8';
    ctx.fillText('PSI 4.3', 36, 76);
    // Manometro circolare
    ctx.fillStyle = '#1e293b';
    ctx.beginPath(); ctx.arc(200, 57, 30, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#ef4444'; ctx.lineWidth = 4;
    ctx.beginPath(); ctx.moveTo(200, 57); ctx.lineTo(218, 40); ctx.stroke();
    // 4 interruttori a levetta + valvole rossa e blu
    for (let i = 0; i < 4; i++) {
      ctx.fillStyle = '#334155';
      ctx.fillRect(30 + i * 32, 114, 18, 36);
      ctx.fillStyle = '#cbd5e1';
      ctx.fillRect(34 + i * 32, 118, 10, 14);
    }
    ctx.fillStyle = '#dc2626';
    ctx.beginPath(); ctx.arc(64, 196, 26, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#2563eb';
    ctx.beginPath(); ctx.arc(140, 196, 26, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#f59e0b';
    ctx.fillRect(184, 174, 44, 44);
  }, 1, true);
}

export function missionFlagTex(primaryHex: string, accentHex: string): THREE.CanvasTexture {
  return makeTexRect(`flag-${primaryHex}-${accentHex}`, 384, 256, (ctx, w, h) => {
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(0, 0, w, h);
    // Bande orbitali
    ctx.fillStyle = primaryHex;
    ctx.fillRect(0, 0, w, h * 0.22);
    ctx.fillRect(0, h * 0.78, w, h * 0.22);
    // Orbita dorata + pianeta
    ctx.strokeStyle = accentHex;
    ctx.lineWidth = 8;
    ctx.beginPath(); ctx.ellipse(w * 0.5, h * 0.5, 118, 46, -0.22, 0, Math.PI * 2); ctx.stroke();
    ctx.fillStyle = accentHex;
    ctx.beginPath(); ctx.arc(w * 0.5, h * 0.5, 36, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.font = '900 32px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('FOLLE!', w * 0.5, h * 0.5);
  }, 1, true);
}

export function grimoireTex(): THREE.CanvasTexture {
  return makeTexRect('grimoire-pages', 512, 256, (ctx, w, h) => {
    ctx.fillStyle = '#f3e5c3';
    ctx.fillRect(0, 0, w, h);
    // Ombra piega centrale del libro
    const fold = ctx.createLinearGradient(w / 2 - 24, 0, w / 2 + 24, 0);
    fold.addColorStop(0, 'rgba(90,60,25,0)');
    fold.addColorStop(0.5, 'rgba(70,45,15,0.45)');
    fold.addColorStop(1, 'rgba(90,60,25,0)');
    ctx.fillStyle = fold;
    ctx.fillRect(w / 2 - 24, 0, 48, h);
    // Pagina sinistra: cerchio alchemico dorato con stella a 6 punte
    const lx = w * 0.25, cy = h * 0.5;
    ctx.strokeStyle = '#92400e';
    ctx.lineWidth = 4;
    ctx.beginPath(); ctx.arc(lx, cy, 78, 0, Math.PI * 2); ctx.stroke();
    ctx.beginPath(); ctx.arc(lx, cy, 62, 0, Math.PI * 2); ctx.stroke();
    ctx.strokeStyle = '#d97706';
    ctx.lineWidth = 3;
    for (let k = 0; k < 2; k++) {
      ctx.beginPath();
      for (let i = 0; i <= 3; i++) {
        const a = (i / 3) * Math.PI * 2 + (k * Math.PI) / 3 - Math.PI / 2;
        const px = lx + Math.cos(a) * 60, py = cy + Math.sin(a) * 60;
        if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
      }
      ctx.stroke();
    }
    // Pagina destra: testo runico + capolettera rosso
    ctx.fillStyle = '#b91c1c';
    ctx.fillRect(w * 0.56, 30, 48, 48);
    ctx.fillStyle = '#fef3c7';
    ctx.font = 'bold 34px Georgia, serif';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('A', w * 0.56 + 24, 55);
    ctx.fillStyle = '#451a03';
    for (let r = 0; r < 9; r++) {
      const x0 = r < 3 ? w * 0.67 : w * 0.56;
      const rw = r < 3 ? 130 : (r % 3 === 0 ? 155 : 185);
      ctx.fillRect(x0, 34 + r * 22, rw, 6);
    }
  }, 1, true);
}

export function f1WheelTex(): THREE.CanvasTexture {
  return makeTexRect('f1-wheel-hud', 256, 128, (ctx, w, h) => {
    ctx.fillStyle = '#11161f';
    ctx.fillRect(0, 0, w, h);
    // 10 shift LEDs colorati in alto
    const leds = ['#22c55e','#22c55e','#22c55e','#ef4444','#ef4444','#ef4444','#3b82f6','#3b82f6'];
    leds.forEach((col, i) => {
      ctx.fillStyle = col;
      ctx.beginPath(); ctx.arc(28 + i * 28, 18, 7, 0, Math.PI * 2); ctx.fill();
    });
    // Schermo telemetria centrale: marcia 8 + velocità
    ctx.fillStyle = '#070b14';
    ctx.fillRect(58, 34, 140, 74);
    ctx.strokeStyle = '#334155'; ctx.lineWidth = 3;
    ctx.strokeRect(58, 34, 140, 74);
    ctx.fillStyle = '#facc15';
    ctx.font = '900 54px monospace';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('8', 102, 72);
    ctx.fillStyle = '#38bdf8';
    ctx.font = 'bold 20px monospace';
    ctx.fillText('334', 162, 60);
    ctx.fillStyle = '#22c55e';
    ctx.font = 'bold 14px monospace';
    ctx.fillText('DRS', 162, 88);
    // Pulsanti laterali colorati
    const btns = [[24, 52, '#ef4444'], [24, 86, '#3b82f6'], [232, 52, '#eab308'], [232, 86, '#22c55e']];
    for (const [bx, by, col] of btns) {
      ctx.fillStyle = col as string;
      ctx.beginPath(); ctx.arc(bx as number, by as number, 11, 0, Math.PI * 2); ctx.fill();
    }
  }, 1, true);
}


export function chainmailBumpTex(): THREE.CanvasTexture {
  return makeTex('chainmail-bump', 256, (ctx, s) => {
    ctx.fillStyle = '#303030';
    ctx.fillRect(0, 0, s, s);
    ctx.strokeStyle = '#d8d8d8';
    ctx.lineWidth = 3.2;
    const step = 16;
    for (let y = 0; y <= s + step; y += step * 0.72) {
      const row = Math.round(y / (step * 0.72));
      const off = (row % 2) * (step * 0.5);
      for (let x = -step; x <= s + step; x += step) {
        ctx.beginPath();
        ctx.arc(x + off, y, step * 0.44, 0, Math.PI * 2);
        ctx.stroke();
      }
    }
  }, 4, false);
}

export function quiltedBumpTex(): THREE.CanvasTexture {
  return makeTex('quilted-bump', 256, (ctx, s) => {
    ctx.fillStyle = '#a8a8a8';
    ctx.fillRect(0, 0, s, s);
    ctx.strokeStyle = '#404040';
    ctx.lineWidth = 3;
    const step = 32;
    for (let i = -s; i <= s * 2; i += step) {
      ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i + s, s); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(i, s); ctx.lineTo(i + s, 0); ctx.stroke();
    }
  }, 3, false);
}

export function fabricWeaveBumpTex(): THREE.CanvasTexture {
  return makeTex('fabric-bump', 256, (ctx, s) => {
    ctx.fillStyle = '#808080';
    ctx.fillRect(0, 0, s, s);
    for (let y = 0; y < s; y += 4) {
      ctx.fillStyle = y % 8 === 0 ? '#969696' : '#6c6c6c';
      ctx.fillRect(0, y, s, 2);
    }
    for (let x = 0; x < s; x += 4) {
      ctx.fillStyle = x % 8 === 0 ? 'rgba(200,200,200,0.35)' : 'rgba(60,60,60,0.35)';
      ctx.fillRect(x, 0, 2, s);
    }
  }, 5, false);
}

export interface Palette {
  paint: THREE.Material;
  accent: THREE.Material;
  chrome: THREE.Material;
  brushed: THREE.Material;
  brass: THREE.Material;
  darkMetal: THREE.Material;
  rubber: THREE.Material;
  leather: THREE.Material;
  carbon: THREE.Material;
  wood: THREE.Material;
  teak: THREE.Material;
  white: THREE.Material;
  glass: THREE.Material;
  tintedGlass: THREE.Material;
  lensGlass: THREE.Material;
  glow: THREE.Material;
  redGlow: THREE.Material;
  custom: (color: THREE.ColorRepresentation, roughness?: number, metalness?: number) => THREE.Material;
}

export function createPalette(finish: FinishId, primaryHex: string, accentHex: string): Palette {
  const primary = new THREE.Color(primaryHex);
  const accent = new THREE.Color(accentHex);
  const bump = brushedBumpTex();

  if (finish !== 'real') {
    const preset: Record<Exclude<FinishId, 'real'>, { base: number | THREE.Color; sec: number | THREE.Color; r: number; m: number; clearcoat?: number }> = {
      pewter:    { base: 0xa6aeb8, sec: 0x6f7782, r: 0.34, m: 0.88 },
      gold:      { base: 0xf4c442, sec: 0xc9961a, r: 0.18, m: 0.96, clearcoat: 0.3 },
      bronze:    { base: 0xb07442, sec: 0x6b4222, r: 0.36, m: 0.85 },
      chrome:    { base: 0xeaf0f6, sec: 0x9aa6b5, r: 0.08, m: 0.99 },
      porcelain: { base: primary,  sec: accent,   r: 0.12, m: 0.06, clearcoat: 1.0 },
    };
    const p = preset[finish];
    const mk = (col: number | THREE.Color, roughDelta = 0, useBump = true) =>
      new THREE.MeshPhysicalMaterial({
        color: col,
        roughness: THREE.MathUtils.clamp(p.r + roughDelta, 0.04, 0.9),
        metalness: p.m,
        clearcoat: p.clearcoat ?? 0,
        clearcoatRoughness: 0.08,
        bumpMap: useBump && finish !== 'porcelain' ? bump : null,
        bumpScale: finish === 'chrome' ? 0.002 : 0.008,
      });

    const mainM = mk(p.base, 0);
    const secM = mk(p.sec, 0.08);
    const hiM = mk(p.base, -0.08, false);
    const tintAccent = finish === 'porcelain' ? mk(accent, -0.02, false) : secM;
    return {
      paint: mainM,
      accent: tintAccent,
      chrome: hiM,
      brushed: mainM,
      brass: secM,
      darkMetal: secM,
      rubber: mk(p.sec, 0.2),
      leather: mk(p.sec, 0.16),
      carbon: secM,
      wood: mk(p.sec, 0.12),
      teak: mainM,
      white: hiM,
      glass: new THREE.MeshPhysicalMaterial({ color: p.base, roughness: 0.06, metalness: p.m * 0.6, transparent: true, opacity: 0.55 }),
      tintedGlass: secM,
      lensGlass: hiM,
      glow: new THREE.MeshStandardMaterial({ color: accent, emissive: accent, emissiveIntensity: 0.7, roughness: 0.2 }),
      redGlow: new THREE.MeshStandardMaterial({ color: 0xff2e43, emissive: 0xff2e43, emissiveIntensity: 0.8, roughness: 0.2 }),
      custom: () => mainM,
    };
  }

  return {
    paint: new THREE.MeshPhysicalMaterial({ color: primary, roughness: 0.22, metalness: 0.35, clearcoat: 1.0, clearcoatRoughness: 0.07 }),
    accent: new THREE.MeshPhysicalMaterial({ color: accent, roughness: 0.26, metalness: 0.45, clearcoat: 0.7, clearcoatRoughness: 0.1 }),
    chrome: new THREE.MeshStandardMaterial({ color: 0xf0f4f8, roughness: 0.08, metalness: 0.98 }),
    brushed: new THREE.MeshStandardMaterial({ color: 0xd4dae0, roughness: 0.28, metalness: 0.9, bumpMap: bump, bumpScale: 0.008 }),
    brass: new THREE.MeshStandardMaterial({ color: 0xd9a74a, roughness: 0.22, metalness: 0.92, bumpMap: bump, bumpScale: 0.005 }),
    darkMetal: new THREE.MeshStandardMaterial({ color: 0x262b33, roughness: 0.38, metalness: 0.82, bumpMap: bump, bumpScale: 0.006 }),
    rubber: new THREE.MeshStandardMaterial({ color: 0x1b1e23, roughness: 0.88, metalness: 0.04 }),
    leather: new THREE.MeshStandardMaterial({ color: 0x221d1a, roughness: 0.62, metalness: 0.05, bumpMap: leatherBumpTex(), bumpScale: 0.018 }),
    carbon: new THREE.MeshPhysicalMaterial({ map: carbonTex(), roughness: 0.28, metalness: 0.25, clearcoat: 0.8, clearcoatRoughness: 0.12 }),
    wood: new THREE.MeshStandardMaterial({ map: woodTex('walnut'), roughness: 0.5, metalness: 0.05 }),
    teak: new THREE.MeshStandardMaterial({ map: woodTex('teak'), roughness: 0.56, metalness: 0.05 }),
    white: new THREE.MeshPhysicalMaterial({ color: 0xf7f8fa, roughness: 0.25, metalness: 0.05, clearcoat: 0.5, clearcoatRoughness: 0.12 }),
    glass: new THREE.MeshPhysicalMaterial({ color: 0xdff4ff, roughness: 0.05, metalness: 0.05, transparent: true, opacity: 0.38, reflectivity: 0.95 }),
    tintedGlass: new THREE.MeshPhysicalMaterial({ color: 0x101824, roughness: 0.06, metalness: 0.3, clearcoat: 1.0, transparent: true, opacity: 0.85 }),
    lensGlass: new THREE.MeshPhysicalMaterial({ color: 0x1a2a5e, roughness: 0.04, metalness: 0.2, clearcoat: 1.0, iridescence: 0.95, iridescenceIOR: 1.55, transparent: true, opacity: 0.8 }),
    glow: new THREE.MeshStandardMaterial({ color: accent, emissive: accent, emissiveIntensity: 1.35, roughness: 0.18 }),
    redGlow: new THREE.MeshStandardMaterial({ color: 0xff2233, emissive: 0xff1e2d, emissiveIntensity: 1.5, roughness: 0.2 }),
    custom: (color, roughness = 0.45, metalness = 0.1) => new THREE.MeshStandardMaterial({ color, roughness, metalness }),
  };
}

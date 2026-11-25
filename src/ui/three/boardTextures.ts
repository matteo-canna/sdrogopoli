// Texture procedurali HD (512px-2048px) v2 per il Diorama Urbano Realistico di Gioco Folle!
// Include tessere architettoniche 512px, mappa suolo 2048px, facciate realistiche 512px con bugnato/vetrine/persiane,
// texture + bump tegole (cotto/ardesia), orologio campanile, insegna Grand Hotel e scritta aerea "Gioco FOLLE!".
import * as THREE from 'three';
import { board } from '../../data';
import type { Space } from '../../engine';
import { spaceName } from '../../i18n';

function wrapText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const words = text.split(' ');
  const lines: string[] = [];
  let line = '';
  for (const w of words) {
    const test = line ? `${line} ${w}` : w;
    if (ctx.measureText(test).width > maxWidth && line) {
      lines.push(line);
      line = w;
    } else {
      line = test;
    }
  }
  if (line) lines.push(line);
  return lines;
}

function drawVectorIcon(ctx: CanvasRenderingContext2D, type: Space['type'], cx: number, cy: number, r: number, deck?: string): void {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';

  switch (type) {
    case 'start': {
      ctx.fillStyle = '#d93829';
      ctx.beginPath();
      ctx.moveTo(r * 0.9, 0);
      ctx.lineTo(r * 0.15, -r * 0.62);
      ctx.lineTo(r * 0.15, -r * 0.25);
      ctx.lineTo(-r * 0.9, -r * 0.25);
      ctx.lineTo(-r * 0.9, r * 0.25);
      ctx.lineTo(r * 0.15, r * 0.25);
      ctx.lineTo(r * 0.15, r * 0.62);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = '#7f1d1d';
      ctx.lineWidth = 4;
      ctx.stroke();
      break;
    }
    case 'station': {
      ctx.fillStyle = '#1f2937';
      ctx.fillRect(-r * 0.58, -r * 0.65, r * 1.16, r * 1.12);
      ctx.fillStyle = '#93c5fd';
      ctx.fillRect(-r * 0.44, -r * 0.48, r * 0.88, r * 0.42);
      ctx.fillStyle = '#fde047';
      ctx.beginPath();
      ctx.arc(-r * 0.3, r * 0.2, r * 0.12, 0, Math.PI * 2);
      ctx.arc(r * 0.3, r * 0.2, r * 0.12, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#374151';
      ctx.lineWidth = 6;
      ctx.beginPath();
      ctx.moveTo(-r * 0.48, r * 0.55); ctx.lineTo(-r * 0.72, r * 0.85);
      ctx.moveTo(r * 0.48, r * 0.55); ctx.lineTo(r * 0.72, r * 0.85);
      ctx.moveTo(-r * 0.66, r * 0.72); ctx.lineTo(r * 0.66, r * 0.72);
      ctx.stroke();
      break;
    }
    case 'utility': {
      ctx.fillStyle = '#f59e0b';
      ctx.beginPath();
      ctx.arc(0, -r * 0.18, r * 0.52, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#92400e';
      ctx.lineWidth = 5;
      ctx.stroke();
      ctx.fillStyle = '#475569';
      ctx.fillRect(-r * 0.25, r * 0.34, r * 0.5, r * 0.34);
      ctx.fillStyle = '#fef3c7';
      ctx.beginPath();
      ctx.moveTo(0, -r * 0.52); ctx.lineTo(-r * 0.16, -r * 0.1); ctx.lineTo(r * 0.04, -r * 0.1);
      ctx.lineTo(-r * 0.08, r * 0.22); ctx.lineTo(r * 0.2, -r * 0.22); ctx.lineTo(0, -r * 0.22);
      ctx.closePath();
      ctx.fill();
      break;
    }
    case 'tax': {
      ctx.fillStyle = '#b91c1c';
      ctx.beginPath();
      ctx.arc(0, 0, r * 0.68, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#fde68a';
      ctx.lineWidth = 5;
      ctx.stroke();
      ctx.fillStyle = '#fef9c3';
      ctx.font = `900 ${Math.round(r * 0.95)}px Georgia, serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('Ƒ', 0, 4);
      break;
    }
    case 'card': {
      const isSorte = deck === 'sorte';
      ctx.fillStyle = isSorte ? '#ea580c' : '#0369a1';
      ctx.beginPath();
      ctx.roundRect(-r * 0.62, -r * 0.78, r * 1.24, r * 1.56, 14);
      ctx.fill();
      ctx.strokeStyle = isSorte ? '#fde047' : '#bae6fd';
      ctx.lineWidth = 6;
      ctx.stroke();
      ctx.fillStyle = '#ffffff';
      ctx.font = `900 ${Math.round(r * 1.15)}px Georgia, serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(isSorte ? '?' : '!', 0, 4);
      break;
    }
    case 'jail': {
      ctx.fillStyle = '#e2e8f0';
      ctx.fillRect(-r * 0.65, -r * 0.65, r * 1.3, r * 1.3);
      ctx.strokeStyle = '#1e293b';
      ctx.lineWidth = 8;
      ctx.strokeRect(-r * 0.65, -r * 0.65, r * 1.3, r * 1.3);
      for (let k = -1; k <= 1; k++) {
        ctx.beginPath();
        ctx.moveTo(k * r * 0.32, -r * 0.65);
        ctx.lineTo(k * r * 0.32, r * 0.65);
        ctx.stroke();
      }
      break;
    }
    case 'free': {
      ctx.fillStyle = '#15803d';
      ctx.beginPath();
      ctx.arc(0, 0, r * 0.72, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#d97706';
      ctx.fillRect(-r * 0.45, -r * 0.22, r * 0.9, r * 0.16);
      ctx.fillRect(-r * 0.48, r * 0.04, r * 0.96, r * 0.16);
      ctx.fillStyle = '#1e293b';
      ctx.fillRect(-r * 0.38, r * 0.2, r * 0.1, r * 0.26);
      ctx.fillRect(r * 0.28, r * 0.2, r * 0.1, r * 0.26);
      break;
    }
    case 'goToJail': {
      ctx.fillStyle = '#dc2626';
      ctx.beginPath();
      ctx.arc(0, -r * 0.14, r * 0.56, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 8;
      ctx.stroke();
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(-r * 0.34, -r * 0.22, r * 0.68, r * 0.16);
      ctx.fillStyle = '#334155';
      ctx.fillRect(-r * 0.08, r * 0.42, r * 0.16, r * 0.42);
      break;
    }
  }
  ctx.restore();
}

export function spaceTexture(space: Space, renderer: THREE.WebGLRenderer): THREE.CanvasTexture {
  const size = 512;
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const ctx = c.getContext('2d');
  if (ctx) {
    const grad = ctx.createLinearGradient(0, 0, size, size);
    grad.addColorStop(0, '#f8f5ec');
    grad.addColorStop(1, '#ece5d6');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, size, size);

    ctx.fillStyle = 'rgba(110, 100, 82, 0.045)';
    for (let i = 0; i < 600; i++) {
      const px = (i * 137) % size;
      const py = (i * 97 + Math.floor(i / 5) * 23) % size;
      ctx.fillRect(px, py, 3, 3);
    }

    ctx.strokeStyle = '#8b8373';
    ctx.lineWidth = 8;
    ctx.strokeRect(4, 4, size - 8, size - 8);
    ctx.strokeStyle = 'rgba(139, 131, 115, 0.35)';
    ctx.lineWidth = 3;
    ctx.strokeRect(16, 16, size - 32, size - 32);

    let top = 46;
    if (space.type === 'property') {
      const color = board.groups.find((g) => g.id === space.group)?.color ?? '#999999';
      ctx.fillStyle = color;
      ctx.fillRect(10, 10, size - 20, 116);
      const sheen = ctx.createLinearGradient(0, 10, 0, 126);
      sheen.addColorStop(0, 'rgba(255,255,255,0.22)');
      sheen.addColorStop(1, 'rgba(0,0,0,0.12)');
      ctx.fillStyle = sheen;
      ctx.fillRect(10, 10, size - 20, 116);
      ctx.fillStyle = '#2d2a24';
      ctx.fillRect(10, 126, size - 20, 6);
      top = 158;
    } else {
      drawVectorIcon(ctx, space.type, size / 2, 124, 68, space.type === 'card' ? space.deck : undefined);
      top = 222;
    }

    ctx.fillStyle = '#1b1e1c';
    ctx.font = '800 50px system-ui, -apple-system, "Segoe UI", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    const lines = wrapText(ctx, spaceName(space.id), size - 56).slice(0, 3);
    for (const line of lines) {
      ctx.fillText(line, size / 2, top);
      top += 56;
    }

    let footer = '';
    if ('price' in space) footer = `${board.currency.symbol} ${space.price}`;
    else if (space.type === 'tax') footer = `-${board.currency.symbol} ${space.amount}`;
    else if (space.type === 'start') footer = `+${board.currency.symbol} ${space.salary}`;

    if (footer) {
      ctx.fillStyle = 'rgba(30, 36, 33, 0.08)';
      ctx.beginPath();
      ctx.roundRect(size * 0.2, size - 88, size * 0.6, 56, 14);
      ctx.fill();
      ctx.fillStyle = space.type === 'tax' ? '#b91c1c' : '#26302a';
      ctx.font = '800 42px system-ui, sans-serif';
      ctx.textBaseline = 'middle';
      ctx.fillText(footer, size / 2, size - 59);
    }
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
  return tex;
}

export function centerTexture(renderer?: THREE.WebGLRenderer): THREE.CanvasTexture {
  const S = 2048;
  const c = document.createElement('canvas');
  c.width = c.height = S;
  const ctx = c.getContext('2d');
  if (ctx) {
    const px = (v: number) => ((v + 4.5) / 9) * S;
    const u = S / 9;

    ctx.fillStyle = '#4e7c44';
    ctx.fillRect(0, 0, S, S);
    for (let i = 0; i < 4500; i++) {
      const gx = (i * 193) % S;
      const gy = (i * 127 + Math.floor(i / 7) * 31) % S;
      const r = 6 + (i % 18);
      ctx.fillStyle = i % 3 === 0 ? 'rgba(98, 145, 76, 0.22)' : i % 3 === 1 ? 'rgba(54, 96, 48, 0.22)' : 'rgba(122, 162, 86, 0.16)';
      ctx.beginPath();
      ctx.arc(gx, gy, r, 0, Math.PI * 2);
      ctx.fill();
    }

    // NW: Parco Monumentale
    ctx.fillStyle = '#5c914e';
    ctx.beginPath(); ctx.arc(px(-2.1), px(-2.1), 1.95 * u, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#dfd4be';
    ctx.lineWidth = 0.22 * u;
    ctx.beginPath();
    ctx.arc(px(-2.1), px(-2.1), 0.72 * u, 0, Math.PI * 2);
    ctx.moveTo(px(-3.75), px(-2.1)); ctx.lineTo(px(-0.2), px(-2.1));
    ctx.moveTo(px(-2.1), px(-3.75)); ctx.lineTo(px(-2.1), px(-0.2));
    ctx.stroke();

    // NE: Piazza in travertino del Centro Storico
    ctx.fillStyle = '#cfc7b8';
    ctx.beginPath(); ctx.roundRect(px(0.55), px(-3.65), 3.1 * u, 3.1 * u, 0.22 * u); ctx.fill();
    ctx.strokeStyle = 'rgba(90, 82, 70, 0.24)';
    ctx.lineWidth = 3;
    for (let t = 0.6; t <= 3.6; t += 0.26) {
      ctx.beginPath(); ctx.moveTo(px(t), px(-3.65)); ctx.lineTo(px(t), px(-0.55)); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(px(0.55), px(-t)); ctx.lineTo(px(3.65), px(-t)); ctx.stroke();
    }

    // SW: Piazza in porfido del Borgo & Mercato
    ctx.fillStyle = '#b8ada0';
    ctx.beginPath(); ctx.roundRect(px(-3.65), px(0.55), 3.1 * u, 3.1 * u, 0.22 * u); ctx.fill();
    ctx.strokeStyle = 'rgba(72, 64, 56, 0.24)';
    ctx.lineWidth = 3;
    for (let r = 0.35; r <= 2.1; r += 0.24) {
      ctx.beginPath(); ctx.arc(px(-2.1), px(2.1), r * u, 0, Math.PI * 2); ctx.stroke();
    }

    // SE: Lungolago con banchina in pietra
    ctx.fillStyle = '#d4cab6';
    ctx.beginPath(); ctx.arc(px(2.15), px(2.15), 1.65 * u, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#e7d8b5';
    ctx.beginPath(); ctx.arc(px(2.15), px(2.15), 1.48 * u, 0, Math.PI * 2); ctx.fill();

    const drawRoadStroke = (color: string, widthUnits: number) => {
      ctx.strokeStyle = color;
      ctx.lineWidth = widthUnits * u;
      ctx.lineJoin = 'round';
      ctx.strokeRect(px(-4.04), px(-4.04), 8.08 * u, 8.08 * u);
      ctx.beginPath();
      ctx.moveTo(px(-4.04), px(0)); ctx.lineTo(px(4.04), px(0));
      ctx.moveTo(px(0), px(-4.04)); ctx.lineTo(px(0), px(4.04));
      ctx.stroke();
    };
    drawRoadStroke('#cbc4b6', 0.78);
    drawRoadStroke('#8e897f', 0.62);
    drawRoadStroke('#343940', 0.56);

    ctx.fillStyle = 'rgba(255,255,255,0.035)';
    for (let i = 0; i < 2400; i++) ctx.fillRect((i * 251) % S, (i * 173) % S, 2, 2);

    ctx.save();
    ctx.strokeStyle = 'rgba(245, 245, 240, 0.78)';
    ctx.lineWidth = 4;
    ctx.setLineDash([24, 22]);
    ctx.strokeRect(px(-4.04), px(-4.04), 8.08 * u, 8.08 * u);
    ctx.beginPath();
    ctx.moveTo(px(-3.6), px(0)); ctx.lineTo(px(-1.15), px(0));
    ctx.moveTo(px(1.15), px(0)); ctx.lineTo(px(3.6), px(0));
    ctx.moveTo(px(0), px(-3.6)); ctx.lineTo(px(0), px(-1.15));
    ctx.moveTo(px(0), px(1.15)); ctx.lineTo(px(0), px(3.6));
    ctx.stroke();
    ctx.restore();

    const drawCrosswalk = (cx: number, cy: number, vertical: boolean) => {
      ctx.fillStyle = 'rgba(248, 248, 244, 0.85)';
      for (let k = -3; k <= 3; k++) {
        if (vertical) ctx.fillRect(px(cx) + k * 14 - 4, px(cy) - 24, 8, 48);
        else ctx.fillRect(px(cx) - 24, px(cy) + k * 14 - 4, 48, 8);
      }
    };
    drawCrosswalk(0, -3.55, true);
    drawCrosswalk(0, 3.55, true);
    drawCrosswalk(-3.55, 0, false);
    drawCrosswalk(3.55, 0, false);

    ctx.fillStyle = '#343940';
    ctx.beginPath(); ctx.arc(px(0), px(0), 1.24 * u, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = 'rgba(245,245,240,0.65)';
    ctx.lineWidth = 4;
    ctx.setLineDash([18, 16]);
    ctx.beginPath(); ctx.arc(px(0), px(0), 1.02 * u, 0, Math.PI * 2); ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = '#d9d1c2';
    ctx.beginPath(); ctx.arc(px(0), px(0), 0.82 * u, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#8b7e6a';
    ctx.lineWidth = 6;
    ctx.stroke();

    ctx.save();
    ctx.translate(px(0), px(0));
    for (let i = 0; i < 8; i++) {
      ctx.rotate(Math.PI / 4);
      ctx.fillStyle = i % 2 === 0 ? '#5c6b5c' : '#a89a84';
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(0.16 * u, -0.25 * u);
      ctx.lineTo(0, -0.7 * u);
      ctx.lineTo(-0.16 * u, -0.25 * u);
      ctx.closePath();
      ctx.fill();
    }
    ctx.fillStyle = '#e8e0cf';
    ctx.beginPath(); ctx.arc(0, 0, 0.22 * u, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  if (renderer) tex.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
  return tex;
}

export function floatingSignTextures(): { map: THREE.CanvasTexture; emissive: THREE.CanvasTexture } {
  const w = 1024, h = 320;
  const draw = (emissiveOnly: boolean) => {
    const c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    const ctx = c.getContext('2d');
    if (ctx) {
      if (emissiveOnly) {
        ctx.fillStyle = '#000000';
        ctx.fillRect(0, 0, w, h);
      } else {
        const bg = ctx.createLinearGradient(0, 0, w, h);
        bg.addColorStop(0, '#131926');
        bg.addColorStop(0.5, '#1e293b');
        bg.addColorStop(1, '#111827');
        ctx.fillStyle = bg;
        ctx.fillRect(0, 0, w, h);

        ctx.strokeStyle = 'rgba(251, 191, 36, 0.08)';
        ctx.lineWidth = 4;
        for (let x = -h; x < w + h; x += 36) {
          ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x + h, h); ctx.stroke();
        }
      }

      ctx.strokeStyle = emissiveOnly ? '#fbbf24' : '#f59e0b';
      ctx.lineWidth = 10;
      ctx.beginPath(); ctx.roundRect(16, 16, w - 32, h - 32, 34); ctx.stroke();

      ctx.strokeStyle = '#38bdf8';
      ctx.lineWidth = 4;
      ctx.beginPath(); ctx.roundRect(30, 30, w - 60, h - 60, 24); ctx.stroke();

      const drawStar = (sx: number, sy: number, r: number, col: string) => {
        ctx.fillStyle = col;
        ctx.beginPath();
        for (let i = 0; i < 8; i++) {
          const rad = i % 2 === 0 ? r : r * 0.36;
          const a = (i * Math.PI) / 4;
          if (i === 0) ctx.moveTo(sx + Math.cos(a) * rad, sy + Math.sin(a) * rad);
          else ctx.lineTo(sx + Math.cos(a) * rad, sy + Math.sin(a) * rad);
        }
        ctx.closePath();
        ctx.fill();
      };
      drawStar(86, h / 2, 26, '#fde047');
      drawStar(w - 86, h / 2, 26, '#fde047');

      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.font = '900 116px ui-rounded, system-ui, -apple-system, "Segoe UI", sans-serif';

      if (!emissiveOnly) {
        ctx.fillStyle = 'rgba(0, 0, 0, 0.55)';
        ctx.fillText('Gioco FOLLE!', w / 2 + 5, h / 2 + 7);
      }
      const txtGrad = ctx.createLinearGradient(0, 75, 0, h - 75);
      txtGrad.addColorStop(0, '#fffbeb');
      txtGrad.addColorStop(0.5, '#fde047');
      txtGrad.addColorStop(1, '#f97316');
      ctx.fillStyle = txtGrad;
      ctx.fillText('Gioco FOLLE!', w / 2, h / 2 + 2);

      ctx.font = '800 26px system-ui, sans-serif';
      ctx.fillStyle = '#7dd3fc';
      ctx.fillText('★  IL GIOCO DEI QUARTIERI  ·  EDIZIONE 3D  ★', w / 2, h - 54);
    }
    const tex = new THREE.CanvasTexture(c);
    if (!emissiveOnly) tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 8;
    return tex;
  };
  return { map: draw(false), emissive: draw(true) };
}

export function cardDeckTexture(kind: 'sorte' | 'quartiere'): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 384;
  const ctx = c.getContext('2d');
  if (ctx) {
    const isSorte = kind === 'sorte';
    ctx.fillStyle = isSorte ? '#c2410c' : '#0369a1';
    ctx.fillRect(0, 0, 256, 384);
    ctx.strokeStyle = isSorte ? '#fde047' : '#bae6fd';
    ctx.lineWidth = 10;
    ctx.strokeRect(14, 14, 228, 356);
    ctx.lineWidth = 3;
    ctx.strokeRect(26, 26, 204, 332);
    ctx.fillStyle = '#ffffff';
    ctx.font = '900 118px Georgia, serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(isSorte ? '?' : '!', 128, 165);
    ctx.font = '800 24px system-ui, sans-serif';
    ctx.fillText(isSorte ? 'COLPO DI' : 'VOCI DI', 128, 272);
    ctx.fillText(isSorte ? 'SORTE' : 'QUARTIERE', 128, 304);
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

// ---------- NUOVE TEXTURE ARCHITETTONICHE ULTRA-REALISTICHE (512px) ----------

// Texture + Bump Map per tetti a coppi in terracotta o tegole in ardesia
export function roofTileTextures(kind: 'terracotta' | 'slate' | 'copper'): { map: THREE.CanvasTexture; bump: THREE.CanvasTexture } {
  const S = 256;
  const build = (isBump: boolean) => {
    const c = document.createElement('canvas');
    c.width = c.height = S;
    const ctx = c.getContext('2d');
    if (ctx) {
      if (isBump) {
        ctx.fillStyle = '#707070';
        ctx.fillRect(0, 0, S, S);
      } else {
        ctx.fillStyle = kind === 'terracotta' ? '#ad4d30' : kind === 'copper' ? '#41766c' : '#3a4452';
        ctx.fillRect(0, 0, S, S);
      }
      const rows = 8;
      const cols = kind === 'terracotta' ? 10 : 8;
      const rw = S / cols;
      const rh = S / rows;
      for (let r = 0; r < rows; r++) {
        const off = kind === 'terracotta' ? 0 : (r % 2) * (rw * 0.5);
        for (let k = -1; k <= cols; k++) {
          const x = k * rw + off;
          const y = r * rh;
          const v = ((r * 13 + k * 7) % 5) - 2;
          if (isBump) {
            const g = ctx.createLinearGradient(x, y, x + rw, y);
            g.addColorStop(0, '#383838');
            g.addColorStop(0.5, '#d8d8d8');
            g.addColorStop(1, '#383838');
            ctx.fillStyle = g;
            ctx.fillRect(x + 1, y + 1, rw - 2, rh - 2);
            ctx.fillStyle = '#242424';
            ctx.fillRect(x, y + rh - 3, rw, 3);
          } else {
            if (kind === 'terracotta') {
              const g = ctx.createLinearGradient(x, y, x + rw, y);
              g.addColorStop(0, `rgb(${135 + v * 6}, ${54 + v * 3}, ${34 + v * 2})`);
              g.addColorStop(0.45, `rgb(${198 + v * 6}, ${92 + v * 4}, ${56 + v * 3})`);
              g.addColorStop(1, `rgb(${128 + v * 6}, ${50 + v * 3}, ${30 + v * 2})`);
              ctx.fillStyle = g;
            } else if (kind === 'copper') {
              ctx.fillStyle = `rgb(${62 + v * 5}, ${118 + v * 6}, ${106 + v * 5})`;
            } else {
              ctx.fillStyle = `rgb(${56 + v * 5}, ${66 + v * 5}, ${78 + v * 6})`;
            }
            ctx.fillRect(x + 1, y + 1, rw - 2, rh - 2);
            // Ombra sovrapposizione tegole
            ctx.fillStyle = 'rgba(0,0,0,0.28)';
            ctx.fillRect(x, y + rh - 3, rw, 3);
          }
        }
      }
    }
    const tex = new THREE.CanvasTexture(c);
    if (!isBump) tex.colorSpace = THREE.SRGBColorSpace;
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(2, 2);
    tex.anisotropy = 4;
    return tex;
  };
  return { map: build(false), bump: build(true) };
}

// Facciate architettoniche 512x512 ultra-dettagliate: intonaco a grana fine, bugnato al piano terra,
// bugne d'angolo, marcapiani, finestre ad arco/timpano con persiane a lamelle, vetrine negozi e luci notturne calde!
export function realisticFacadeTextures(
  wallHex: string,
  shutterHex: string,
  cols: number,
  rows: number,
  door: boolean,
  seed = 1,
  groundStyle: 'stone' | 'shop' | 'arcade' = 'stone',
): { map: THREE.CanvasTexture; glow: THREE.CanvasTexture; bump: THREE.CanvasTexture } {
  const S = 512;
  const build = (mode: 'map' | 'glow' | 'bump') => {
    const c = document.createElement('canvas');
    c.width = c.height = S;
    const ctx = c.getContext('2d');
    if (ctx) {
      const ch = S / rows;
      const cw = S / cols;

      if (mode === 'glow') {
        ctx.fillStyle = '#000000';
        ctx.fillRect(0, 0, S, S);
      } else if (mode === 'bump') {
        ctx.fillStyle = '#808080';
        ctx.fillRect(0, 0, S, S);
      } else {
        ctx.fillStyle = wallHex;
        ctx.fillRect(0, 0, S, S);
        // Micro-grana intonaco realistico
        for (let i = 0; i < 1800; i++) {
          const px = (i * 199 + seed * 31) % S;
          const py = (i * 131 + Math.floor(i / 6) * 17) % S;
          ctx.fillStyle = i % 2 === 0 ? 'rgba(255,255,255,0.06)' : 'rgba(60,45,30,0.06)';
          ctx.fillRect(px, py, 4, 4);
        }
        // Leggera ombra sottogronda in alto
        const topSh = ctx.createLinearGradient(0, 0, 0, 38);
        topSh.addColorStop(0, 'rgba(30,25,20,0.22)');
        topSh.addColorStop(1, 'rgba(30,25,20,0)');
        ctx.fillStyle = topSh;
        ctx.fillRect(0, 0, S, 38);
      }

      // Basamento al piano terra in bugnato di pietra (ashlar rustication)
      const gfTop = S - ch;
      if (mode !== 'glow') {
        ctx.fillStyle = mode === 'bump' ? '#9e9e9e' : '#cdc5b6';
        ctx.fillRect(0, gfTop, S, ch);
        const bh = Math.max(14, ch / 6);
        for (let y = gfTop; y < S; y += bh) {
          ctx.fillStyle = mode === 'bump' ? '#484848' : 'rgba(65,58,48,0.28)';
          ctx.fillRect(0, y, S, 3);
          const off = (Math.round(y / bh) % 2) * 32;
          for (let x = off; x < S; x += 64) ctx.fillRect(x, y, 2, bh);
        }
      }

      // Bugne d'angolo (stone quoins) sui lati sinistro e destro
      if (mode !== 'glow') {
        const qh = 26;
        for (let y = 0; y < gfTop; y += qh) {
          const qw = (Math.round(y / qh) % 2 === 0) ? 26 : 16;
          ctx.fillStyle = mode === 'bump' ? '#b8b8b8' : '#ded6c7';
          ctx.fillRect(0, y + 2, qw, qh - 4);
          ctx.fillRect(S - qw, y + 2, qw, qh - 4);
          ctx.fillStyle = mode === 'bump' ? '#505050' : 'rgba(70,60,50,0.24)';
          ctx.fillRect(0, y, qw, 2);
          ctx.fillRect(S - qw, y, qw, 2);
        }
      }

      // Marcapiani in pietra tra i piani
      if (mode !== 'glow') {
        for (let r = 1; r < rows; r++) {
          const y = r * ch;
          ctx.fillStyle = mode === 'bump' ? '#c8c8c8' : '#e4ddd0';
          ctx.fillRect(0, y - 5, S, 10);
          ctx.fillStyle = mode === 'bump' ? '#424242' : 'rgba(40,32,25,0.28)';
          ctx.fillRect(0, y + 5, S, 5);
        }
      }

      // Finestre, persiane a lamelle, timpani, portoni e vetrine negozi
      for (let r = 0; r < rows; r++) {
        const isGround = r === rows - 1;
        for (let k = 0; k < cols; k++) {
          const isCenterDoor = door && isGround && k === Math.floor(cols / 2);
          if (isCenterDoor) continue;

          const wx = k * cw + cw * 0.25;
          const wy = r * ch + ch * (isGround ? 0.14 : 0.19);
          const ww = cw * (isGround && groundStyle !== 'stone' ? 0.64 : 0.5);
          const wh = ch * (isGround && groundStyle !== 'stone' ? 0.72 : 0.58);
          const cx = wx + ww / 2;
          const lit = isGround && groundStyle !== 'stone' ? true : ((r * 7 + k * 11 + seed * 5) % 4) !== 0;

          if (mode === 'glow') {
            if (lit) {
              ctx.fillStyle = isGround && groundStyle !== 'stone'
                ? '#ffe4a3'
                : (r + k + seed) % 3 === 0 ? '#ffd070' : '#fff0c4';
              ctx.fillRect(wx + 5, wy + 5, ww - 10, wh - 10);
            }
          } else if (mode === 'bump') {
            ctx.fillStyle = '#383838'; // incasso finestra
            ctx.fillRect(wx, wy, ww, wh);
            ctx.fillStyle = '#b4b4b4'; // cornice & davanzale sporgente
            ctx.fillRect(wx - 8, wy - 10, ww + 16, 10);
            ctx.fillRect(wx - 10, wy + wh, ww + 20, 10);
          } else {
            if (isGround && groundStyle !== 'stone') {
              // Vetrina negozio o arcata luminosa al piano terra!
              ctx.fillStyle = '#ebe4d6';
              ctx.fillRect(wx - 6, wy - 8, ww + 12, wh + 10);
              const sg = ctx.createLinearGradient(wx, wy, wx, wy + wh);
              sg.addColorStop(0, '#2a3848');
              sg.addColorStop(0.55, '#594a36');
              sg.addColorStop(1, '#362d24');
              ctx.fillStyle = sg;
              ctx.fillRect(wx, wy, ww, wh);
              // Mensole e riflesso diagonale vetrina
              ctx.fillStyle = 'rgba(255,255,255,0.14)';
              ctx.beginPath();
              ctx.moveTo(wx + 6, wy + 6); ctx.lineTo(wx + ww * 0.48, wy + 6);
              ctx.lineTo(wx + 6, wy + wh * 0.62); ctx.closePath(); ctx.fill();
              ctx.strokeStyle = '#d4c8b4';
              ctx.lineWidth = 4;
              ctx.strokeRect(wx + 2, wy + 2, ww - 4, wh - 4);
            } else {
              // Persiane laterali a lamelle orizzontali
              const shW = ww * 0.27;
              ctx.fillStyle = shutterHex;
              ctx.fillRect(wx - shW - 2, wy, shW, wh);
              ctx.fillRect(wx + ww + 2, wy, shW, wh);
              ctx.fillStyle = 'rgba(0,0,0,0.22)';
              for (let ly = wy + 6; ly < wy + wh - 4; ly += 7) {
                ctx.fillRect(wx - shW, ly, shW - 4, 2);
                ctx.fillRect(wx + ww + 4, ly, shW - 4, 2);
              }
              // Cornice in pietra + architrave/timpano superiore
              ctx.fillStyle = '#ede7da';
              ctx.fillRect(wx - 5, wy - 5, ww + 10, wh + 10);
              ctx.fillStyle = '#dfd8c8';
              ctx.fillRect(wx - 10, wy - 13, ww + 20, 9);
              // Vetro scuro con riflesso cielo e tendina interna
              const vg = ctx.createLinearGradient(wx, wy, wx, wy + wh);
              vg.addColorStop(0, '#1e2e40');
              vg.addColorStop(0.65, '#3b536b');
              vg.addColorStop(1, '#2a3a4a');
              ctx.fillStyle = vg;
              ctx.fillRect(wx, wy, ww, wh);
              ctx.fillStyle = 'rgba(255,248,235,0.15)';
              ctx.fillRect(wx + 2, wy + 2, ww * 0.26, wh - 4);
              // Infisso inglese a 6 riquadri
              ctx.fillStyle = '#f5f1e8';
              ctx.fillRect(cx - 2.5, wy, 5, wh);
              ctx.fillRect(wx, wy + wh * 0.36, ww, 4);
              ctx.fillRect(wx, wy + wh * 0.68, ww, 4);
              // Davanzale in pietra con mensoline
              ctx.fillStyle = '#d2c9b8';
              ctx.fillRect(wx - 9, wy + wh + 2, ww + 18, 9);
            }
          }
        }
      }

      // Portone d'ingresso ad arco in legno massello con sopraluce vetrato
      if (door) {
        const dx = Math.floor(cols / 2) * cw + cw * 0.18;
        const dw = cw * 0.64;
        const dh = ch * 0.86;
        const dy = S - dh;
        if (mode === 'glow') {
          // Sopraluce sopra il portone acceso di notte!
          ctx.fillStyle = '#ffd984';
          ctx.fillRect(dx + 8, dy + 6, dw - 16, dh * 0.18);
        } else if (mode === 'bump') {
          ctx.fillStyle = '#404040';
          ctx.fillRect(dx, dy, dw, dh);
        } else {
          ctx.fillStyle = '#ebe4d6';
          ctx.fillRect(dx - 8, dy - 8, dw + 16, dh + 8);
          ctx.fillStyle = '#4e2f1b';
          ctx.fillRect(dx, dy, dw, dh);
          // Sopraluce vetrato ad arco
          ctx.fillStyle = '#384c60';
          ctx.fillRect(dx + 6, dy + 6, dw - 12, dh * 0.2);
          // 2 ante riquadrate con bugne legno e maniglie in ottone
          ctx.strokeStyle = '#351e10';
          ctx.lineWidth = 4;
          ctx.strokeRect(dx + 6, dy + dh * 0.3, dw / 2 - 10, dh * 0.62);
          ctx.strokeRect(dx + dw / 2 + 4, dy + dh * 0.3, dw / 2 - 10, dh * 0.62);
          ctx.fillStyle = '#e0b04b';
          ctx.beginPath();
          ctx.arc(dx + dw / 2 - 8, dy + dh * 0.62, 5, 0, Math.PI * 2);
          ctx.arc(dx + dw / 2 + 8, dy + dh * 0.62, 5, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }
    const tex = new THREE.CanvasTexture(c);
    if (mode === 'map') tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 4;
    return tex;
  };
  return { map: build('map'), glow: build('glow'), bump: build('bump') };
}

// Orologio HD per la Torre Campanaria
export function clockTowerTex(): THREE.CanvasTexture {
  const S = 256;
  const c = document.createElement('canvas');
  c.width = c.height = S;
  const ctx = c.getContext('2d');
  if (ctx) {
    const m = S / 2;
    ctx.fillStyle = '#fff9e6';
    ctx.beginPath(); ctx.arc(m, m, m - 4, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#b48a34';
    ctx.lineWidth = 10;
    ctx.beginPath(); ctx.arc(m, m, m - 8, 0, Math.PI * 2); ctx.stroke();
    ctx.fillStyle = '#1e242c';
    ctx.font = 'bold 26px Georgia, serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const rom = ['XII','I','II','III','IV','V','VI','VII','VIII','IX','X','XI'];
    rom.forEach((r, i) => {
      const a = (i / 12) * Math.PI * 2 - Math.PI / 2;
      ctx.fillText(r, m + Math.cos(a) * 86, m + Math.sin(a) * 86);
    });
    // Lancette eleganti
    ctx.strokeStyle = '#1e242c';
    ctx.lineCap = 'round';
    ctx.lineWidth = 8;
    ctx.beginPath(); ctx.moveTo(m, m); ctx.lineTo(m + 44, m - 36); ctx.stroke();
    ctx.lineWidth = 5;
    ctx.beginPath(); ctx.moveTo(m, m); ctx.lineTo(m - 12, m - 68); ctx.stroke();
    ctx.fillStyle = '#d9a74a';
    ctx.beginPath(); ctx.arc(m, m, 9, 0, Math.PI * 2); ctx.fill();
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

// Insegna luminosa "GRAND HOTEL" per la sommità degli hotel
export function hotelSignTex(): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 64;
  const ctx = c.getContext('2d');
  if (ctx) {
    ctx.fillStyle = '#141a24';
    ctx.fillRect(0, 0, 256, 64);
    ctx.strokeStyle = '#f4c442';
    ctx.lineWidth = 5;
    ctx.strokeRect(4, 4, 248, 56);
    ctx.fillStyle = '#fde68a';
    ctx.font = '900 28px Georgia, serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('GRAND HOTEL', 128, 34);
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

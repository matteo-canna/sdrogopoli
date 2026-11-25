// Disegna le facce delle caselle su un canvas 2D, usato come texture nel 3D.
import * as THREE from 'three';
import { board } from '../../data';
import type { Space } from '../../engine';
import { spaceName } from '../../i18n';

const ICONS: Partial<Record<Space['type'], string>> = {
  start: '🏁', station: '🚋', utility: '💡', tax: '💸', card: '❓', jail: '🚓', free: '🪑', goToJail: '👮',
};

// Spezza il testo in righe che stanno nella larghezza indicata.
function wrap(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const words = text.split(' ');
  const lines: string[] = [];
  let line = '';
  for (const w of words) {
    const test = line ? `${line} ${w}` : w;
    if (ctx.measureText(test).width > maxWidth && line) {
      lines.push(line);
      line = w;
    } else line = test;
  }
  if (line) lines.push(line);
  return lines;
}

export function spaceTexture(space: Space, renderer: THREE.WebGLRenderer): THREE.CanvasTexture {
  const size = 256;
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = '#fffdf6';
  ctx.fillRect(0, 0, size, size);
  ctx.strokeStyle = '#9aa59c';
  ctx.lineWidth = 4;
  ctx.strokeRect(2, 2, size - 4, size - 4);

  let top = 24;
  if (space.type === 'property') {
    const color = board.groups.find((g) => g.id === space.group)?.color ?? '#999';
    ctx.fillStyle = color;
    ctx.fillRect(4, 4, size - 8, 56);
    top = 76;
  }
  const icon = ICONS[space.type];
  if (icon) {
    ctx.font = '56px system-ui, "Apple Color Emoji", "Segoe UI Emoji", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillText(icon, size / 2, top);
    top += 66;
  }
  ctx.fillStyle = '#1f2421';
  ctx.font = '600 30px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  for (const line of wrap(ctx, spaceName(space.id), size - 24).slice(0, 3)) {
    ctx.fillText(line, size / 2, top);
    top += 34;
  }
  if ('price' in space) {
    ctx.fillStyle = '#5d6660';
    ctx.font = '28px system-ui, sans-serif';
    ctx.textBaseline = 'bottom';
    ctx.fillText(`${board.currency.symbol} ${space.price}`, size / 2, size - 14);
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = renderer.capabilities.getMaxAnisotropy();
  return tex;
}

export function centerTexture(): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = c.height = 1024;
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = '#dfe9d8';
  ctx.fillRect(0, 0, 1024, 1024);
  // da coordinate del tabellone (-4,5…4,5) a pixel
  const px = (v: number) => ((v + 4.5) / 9) * 1024;
  const u = 1024 / 9;
  // viale tutto intorno, con i lampioni
  ctx.strokeStyle = '#c9c4b6';
  ctx.lineWidth = 0.22 * u;
  ctx.strokeRect(px(-4.05), px(-4.05), 8.1 * u, 8.1 * u);
  // parco con vialetti intorno alla fontana
  ctx.fillStyle = '#cfe3c0';
  ctx.beginPath();
  ctx.arc(px(-2.35), px(-2.35), 1.85 * u, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#e6dcc4';
  ctx.lineWidth = 0.12 * u;
  ctx.beginPath();
  ctx.arc(px(-2.35), px(-2.35), 0.55 * u, 0, Math.PI * 2);
  ctx.moveTo(px(-2.35), px(-4.05));
  ctx.lineTo(px(-2.35), px(-0.6));
  ctx.moveTo(px(-4.05), px(-2.35));
  ctx.lineTo(px(-0.6), px(-2.35));
  ctx.stroke();
  // spiaggia intorno al lago
  ctx.fillStyle = '#eadfbe';
  ctx.beginPath();
  ctx.arc(px(2.3), px(2.3), 1.42 * u, 0, Math.PI * 2);
  ctx.fill();
  // piazze lastricate dei due quartieri
  ctx.fillStyle = '#d6d2c6';
  ctx.fillRect(px(3.15 - 0.8), px(-3.15 - 0.8), 1.6 * u, 1.6 * u);
  ctx.fillRect(px(-3.15 - 0.8), px(3.15 - 0.8), 1.6 * u, 1.6 * u);
  ctx.translate(512, 512);
  ctx.rotate(-Math.PI / 4);
  ctx.fillStyle = '#2f6f4f';
  ctx.font = '800 150px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('Sdrogopoli', 0, 0);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

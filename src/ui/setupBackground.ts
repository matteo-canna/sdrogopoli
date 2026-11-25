// Sfondo animato della schermata iniziale. Tre temi, scelti nelle impostazioni:
// - "citta": cielo con nuvole, mongolfiera, aereo con lo striscione e la città dei quartieri in basso;
// - "festa": tavolo da gioco colorato con dadi, monete, casette e carte che fluttuano;
// - "strisce": strisce caramella nei colori dei quartieri e coriandoli che cadono.
// Tutto è disegnato nel codice (niente file), si muove solo con transform/opacity e si ferma
// con il movimento ridotto (regola generale in base.css).
import { board } from '../data';

export const BACKGROUNDS = ['citta', 'festa', 'strisce'] as const;
export type BackgroundId = (typeof BACKGROUNDS)[number];
export const DEFAULT_BACKGROUND: BackgroundId = 'citta';

// Colori allegri di riserva, se il tabellone ha pochi quartieri.
const CANDY = ['#ff6b6b', '#ff9f43', '#feca57', '#1dd1a1', '#48dbfb', '#54a0ff', '#a55eea', '#ff6bcb'];

function palette(): string[] {
  const groups = board.groups.map((g) => g.color);
  return groups.length >= 6 ? groups : CANDY;
}

// Generatore pseudo-casuale fisso: lo sfondo è uguale a ogni apertura (niente salti tra un ridisegno e l'altro).
function seeded(seed: number): () => number {
  let s = seed;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

// Una fila di casette larga 1600 unità: tetto a punta, porta e finestre.
function skyline(colors: string[], seed: number, minH: number, maxH: number, windows: boolean): string {
  const rnd = seeded(seed);
  let x = 0;
  let out = '';
  let i = 0;
  while (x < 1600) {
    const w = 70 + Math.round(rnd() * 50);
    const h = minH + Math.round(rnd() * (maxH - minH));
    const roof = 26 + Math.round(rnd() * 18);
    const c = colors[i % colors.length];
    const top = 300 - h;
    out += `<g class="house" style="--d:${(i % 7) * 0.35}s">
      <path d="M${x + 4} 300 V${top} L${x + w / 2} ${top - roof} L${x + w - 4} ${top} V300 Z" fill="${c}"/>`;
    if (windows) {
      const cols = w > 95 ? 3 : 2;
      for (let r = 0; r < Math.min(3, Math.floor((h - 40) / 36)); r++)
        for (let k = 0; k < cols; k++) {
          const wx = x + 14 + k * ((w - 28 - 14) / Math.max(1, cols - 1));
          out += `<rect class="win" style="--d:${((i * 3 + r + k) % 9) * 0.7}s" x="${wx.toFixed(1)}" y="${top + 14 + r * 36}" width="14" height="18" rx="3"/>`;
        }
      out += `<rect class="door" x="${x + w / 2 - 9}" y="${300 - 30}" width="18" height="30" rx="9"/>`;
    }
    out += '</g>';
    x += w + 6;
    i++;
  }
  return out;
}

const CLOUD = '<path d="M30 60 a24 24 0 0 1 22-34 a32 32 0 0 1 60-6 a26 26 0 0 1 44 14 a20 20 0 0 1 4 26 Z"/>';

function cityHtml(colors: string[]): string {
  const starRnd = seeded(42);
  const rot = colors.slice(3).concat(colors.slice(0, 3));
  return `
    <div class="bg-sun"><svg viewBox="0 0 200 200"><g class="rays">${Array.from({ length: 12 }, (_, i) => `<rect x="94" y="4" width="12" height="34" rx="6" transform="rotate(${i * 30} 100 100)"/>`).join('')}</g><circle cx="100" cy="100" r="50"/></svg></div>
    <div class="bg-stars">${Array.from({ length: 28 }, () => {
      const r = starRnd;
      return `<i style="left:${(r() * 100).toFixed(1)}%;top:${(r() * 55).toFixed(1)}%;--d:${(r() * 4).toFixed(1)}s"></i>`;
    }).join('')}</div>
    ${[
      [8, 0.9, 70, 0],
      [22, 0.7, 95, -40],
      [40, 1.2, 80, -20],
      [58, 0.8, 110, -70],
    ]
      .map(([top, scale, dur, delay]) => `<svg class="bg-cloud" viewBox="0 0 170 70" style="top:${top}%;--s:${scale};--t:${dur}s;animation-delay:${delay}s">${CLOUD}</svg>`)
      .join('')}
    <svg class="bg-balloon" viewBox="0 0 120 180">
      <ellipse cx="60" cy="58" rx="50" ry="56" fill="${colors[5 % colors.length]}"/>
      <ellipse cx="60" cy="58" rx="32" ry="56" fill="${colors[2 % colors.length]}"/>
      <ellipse cx="60" cy="58" rx="13" ry="56" fill="${colors[4 % colors.length]}"/>
      <path d="M28 100 L46 138 M92 100 L74 138" stroke="#6b4a2b" stroke-width="3"/>
      <rect x="44" y="136" width="32" height="24" rx="5" fill="#9a5b33"/>
    </svg>
    <div class="bg-plane"><svg viewBox="0 0 420 70">
      <path d="M8 35 C40 20 70 50 100 35 C130 20 160 50 190 35" stroke="#fff" stroke-width="2" fill="none" stroke-dasharray="4 6"/>
      <rect x="190" y="14" width="160" height="42" rx="8" fill="#fff" stroke="${colors[0]}" stroke-width="3"/>
      <text x="270" y="43" text-anchor="middle" font-size="22" font-weight="800" fill="${colors[3 % colors.length]}" font-family="ui-rounded, system-ui, sans-serif">Gioco Folle!</text>
      <path d="M350 35 h12" stroke="#555" stroke-width="2"/>
      <path d="M362 28 h36 a10 10 0 0 1 0 14 h-36 Z" fill="${colors[0]}"/>
      <path d="M376 28 l-6 -16 h10 l10 16 Z M376 42 l-6 16 h10 l10 -16 Z" fill="${colors[1 % colors.length]}"/>
      <circle cx="398" cy="35" r="3" fill="#fff"/>
    </svg></div>
    <svg class="bg-city back" viewBox="0 0 1600 300" preserveAspectRatio="xMidYMax slice">${skyline(rot, 3, 120, 230, false)}</svg>
    <svg class="bg-city front" viewBox="0 0 1600 300" preserveAspectRatio="xMidYMax slice">${skyline(colors, 11, 70, 170, true)}</svg>
    <div class="bg-ground"></div>`;
}

// Oggetti del gioco che galleggiano sul tavolo.
function die(n: number): string {
  const pips: Record<number, [number, number][]> = {
    1: [[50, 50]],
    3: [[28, 28], [50, 50], [72, 72]],
    5: [[28, 28], [72, 28], [50, 50], [28, 72], [72, 72]],
    6: [[28, 26], [72, 26], [28, 50], [72, 50], [28, 74], [72, 74]],
  };
  return `<svg viewBox="0 0 100 100"><rect x="6" y="6" width="88" height="88" rx="20" fill="#fff" stroke="#1f2421" stroke-width="5"/>${(pips[n] ?? pips[5]).map(([x, y]) => `<circle cx="${x}" cy="${y}" r="8" fill="#1f2421"/>`).join('')}</svg>`;
}
function coin(): string {
  return `<svg viewBox="0 0 100 100"><circle cx="50" cy="50" r="44" fill="#f4b400" stroke="#b07d00" stroke-width="6"/><circle cx="50" cy="50" r="31" fill="none" stroke="#ffe08a" stroke-width="4"/><text x="50" y="64" text-anchor="middle" font-size="40" font-weight="900" fill="#8a5d00" font-family="ui-rounded, system-ui, sans-serif">F</text></svg>`;
}
function house(c: string): string {
  return `<svg viewBox="0 0 100 100"><path d="M14 92 V46 L50 12 L86 46 V92 Z" fill="${c}" stroke="#1f2421" stroke-width="5" stroke-linejoin="round"/><rect x="40" y="62" width="20" height="30" rx="4" fill="#fff"/></svg>`;
}
function card(c: string): string {
  return `<svg viewBox="0 0 80 110"><rect x="5" y="5" width="70" height="100" rx="10" fill="#fff" stroke="#1f2421" stroke-width="5"/><rect x="12" y="12" width="56" height="22" rx="4" fill="${c}"/><text x="40" y="82" text-anchor="middle" font-size="40" font-weight="900" fill="${c}" font-family="ui-rounded, system-ui, sans-serif">?</text></svg>`;
}

function partyHtml(colors: string[]): string {
  const items = [
    die(5), coin(), house(colors[0]), card(colors[3 % colors.length]), die(3), coin(),
    house(colors[5 % colors.length]), die(6), card(colors[6 % colors.length]), coin(), house(colors[2 % colors.length]), die(1),
  ];
  // posizioni fisse, sparse ai lati per non stare sotto ai riquadri
  const spots: [number, number, number][] = [
    [4, 12, 70], [88, 8, 56], [12, 46, 80], [92, 38, 64], [3, 78, 58], [84, 70, 72],
    [30, 4, 44], [64, 3, 50], [46, 88, 60], [70, 90, 46], [22, 92, 54], [96, 92, 40],
  ];
  return `<div class="bg-dots"></div>
    <div class="bg-border top"></div><div class="bg-border bottom"></div>
    ${items.map((svg, i) => `<div class="bg-float" style="left:${spots[i][0]}%;top:${spots[i][1]}%;--w:${spots[i][2]}px;--d:${(i * 0.9) % 6}s;--t:${6 + (i % 4)}s;--r:${(i % 2 ? -1 : 1) * (8 + (i % 3) * 6)}deg">${svg}</div>`).join('')}`;
}

function stripesHtml(colors: string[]): string {
  const stops = colors.map((c, i) => `${c} ${i * 60}px ${(i + 1) * 60}px`).join(', ');
  const rnd = seeded(5);
  return `<div class="bg-stripes" style="--stripes:repeating-linear-gradient(-45deg, ${stops});--period:${colors.length * 60 * Math.SQRT2}px"></div>
    <div class="bg-veil"></div>
    ${Array.from({ length: 22 }, (_, i) => `<i class="bg-confetti" style="left:${(rnd() * 100).toFixed(1)}%;--c:${['#fff', '#feca57', '#ff6bcb', '#48dbfb'][i % 4]};--t:${(9 + rnd() * 9).toFixed(1)}s;--d:${(-rnd() * 18).toFixed(1)}s;--x:${(rnd() * 80 - 40).toFixed(0)}px"></i>`).join('')}`;
}

export function backgroundHtml(kind: BackgroundId): string {
  const colors = palette();
  const inner = kind === 'festa' ? partyHtml(colors) : kind === 'strisce' ? stripesHtml(CANDY) : cityHtml(CANDY);
  return `<div class="setup-bg bg-${kind}" aria-hidden="true">${inner}</div>`;
}

export function isBackground(x: unknown): x is BackgroundId {
  return BACKGROUNDS.includes(x as BackgroundId);
}

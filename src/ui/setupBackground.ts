// Sfondo della schermata iniziale, in stile gioco da tavolo classico. Due temi, scelti nelle impostazioni:
// - "tavolo": il tabellone vero del gioco appoggiato in prospettiva su un tavolo di panno verde,
//   con dadi, banconote, un atto di proprietà, casette e pedine sparsi intorno;
// - "tabellone": lo schermo diventa il tabellone, con il percorso delle caselle lungo i bordi
//   e due pedine che lo percorrono.
// Tutto è disegnato nel codice (niente file), i colori sono quelli dei quartieri, si muove solo con
// transform/opacity e si ferma con il movimento ridotto (regola generale in base.css).
import { board } from '../data';

export const BACKGROUNDS = ['tavolo', 'tabellone'] as const;
export type BackgroundId = (typeof BACKGROUNDS)[number];
export const DEFAULT_BACKGROUND: BackgroundId = 'tavolo';

const INK = '#1f2421';
const PAPER = '#f6efd9';
const CRIMSON = '#b8323b';
const GOLD = '#e3b23c';
const FONT = 'ui-rounded, system-ui, sans-serif';

type Space = (typeof board.spaces)[number];

function groupColor(s: Space): string | null {
  if (s.type !== 'property' || !('group' in s)) return null;
  return board.groups.find((g) => g.id === s.group)?.color ?? null;
}

// ---------- il tabellone visto dall'alto (viewBox 1000×1000, 40 caselle come quello del gioco) ----------
const C = 136; // lato delle caselle d'angolo
const W = (1000 - 2 * C) / 9; // larghezza delle caselle sui lati
const BAND = 28; // fascia colorata del quartiere

// Rettangolo della casella e della sua fascia (verso il centro), partendo dall'angolo in basso a destra.
function spaceRect(i: number): { x: number; y: number; w: number; h: number; band: [number, number, number, number] } {
  const side = Math.floor(i / 10);
  const k = i % 10;
  if (k === 0) {
    const pos = [[1000 - C, 1000 - C], [0, 1000 - C], [0, 0], [1000 - C, 0]][side];
    return { x: pos[0], y: pos[1], w: C, h: C, band: [0, 0, 0, 0] };
  }
  if (side === 0) { const x = 1000 - C - k * W; return { x, y: 1000 - C, w: W, h: C, band: [x, 1000 - C, W, BAND] }; }
  if (side === 1) { const y = 1000 - C - k * W; return { x: 0, y, w: C, h: W, band: [C - BAND, y, BAND, W] }; }
  if (side === 2) { const x = C + (k - 1) * W; return { x, y: 0, w: W, h: C, band: [x, C - BAND, W, BAND] }; }
  const y = C + (k - 1) * W;
  return { x: 1000 - C, y, w: C, h: W, band: [1000 - C, y, BAND, W] };
}

// Piccole icone delle caselle speciali, disegnate al centro della casella.
function glyph(s: Space, cx: number, cy: number): string {
  const txt = (t: string, fill: string, size = 40) => `<text x="${cx}" y="${cy + size * 0.36}" text-anchor="middle" font-size="${size}" font-weight="900" fill="${fill}" font-family="${FONT}">${t}</text>`;
  switch (s.type) {
    case 'card': return txt('?', CRIMSON, 46);
    case 'tax': return txt('Ƒ', '#8a5d00', 40);
    case 'station': return `<g transform="translate(${cx - 20} ${cy - 16})" fill="${INK}"><rect width="40" height="22" rx="5"/><rect x="5" y="4" width="10" height="8" rx="2" fill="${PAPER}"/><rect x="25" y="4" width="10" height="8" rx="2" fill="${PAPER}"/><circle cx="9" cy="27" r="5"/><circle cx="31" cy="27" r="5"/></g>`;
    case 'utility': return `<circle cx="${cx}" cy="${cy}" r="17" fill="${GOLD}" stroke="${INK}" stroke-width="4"/><path d="M${cx - 2} ${cy - 10} l-6 12 h8 l-4 10 l12 -14 h-8 l4 -8 Z" fill="${INK}"/>`;
    case 'start': return `<path d="M${cx - 44} ${cy + 18} h52 v18 l36 -36 l-36 -36 v18 h-52 Z" fill="${CRIMSON}" stroke="${INK}" stroke-width="4" stroke-linejoin="round"/>`;
    case 'jail': return `<rect x="${cx - 34}" y="${cy - 34}" width="68" height="68" rx="6" fill="#f08c6c" stroke="${INK}" stroke-width="4"/>${[-18, 0, 18].map((d) => `<path d="M${cx + d} ${cy - 34} v68" stroke="${INK}" stroke-width="5"/>`).join('')}`;
    case 'free': return `<circle cx="${cx}" cy="${cy}" r="36" fill="${GOLD}" stroke="${INK}" stroke-width="4"/>${txt('Ƒ', INK, 44)}`;
    case 'goToJail': return `<path d="M${cx} ${cy - 40} l11 24 l26 3 l-19 18 l5 26 l-23 -13 l-23 13 l5 -26 l-19 -18 l26 -3 Z" fill="#3a5fcd" stroke="${INK}" stroke-width="4" stroke-linejoin="round"/>`;
    default: return '';
  }
}

function pawnSvg(c: string, cx: number, cy: number, r = 14): string {
  return `<g transform="translate(${cx} ${cy})"><ellipse cx="0" cy="${r * 1.1}" rx="${r * 1.25}" ry="${r * 0.55}" fill="rgba(0,0,0,.25)"/><circle r="${r}" fill="${c}" stroke="${INK}" stroke-width="3"/><circle r="${r * 0.4}" cx="${-r * 0.3}" cy="${-r * 0.3}" fill="rgba(255,255,255,.55)"/></g>`;
}

function boardSvg(): string {
  let spaces = '';
  board.spaces.slice(0, 40).forEach((s, i) => {
    const r = spaceRect(i);
    spaces += `<rect x="${r.x}" y="${r.y}" width="${r.w}" height="${r.h}" fill="${PAPER}" stroke="${INK}" stroke-width="3"/>`;
    const c = groupColor(s);
    const cx = r.x + r.w / 2;
    const cy = r.y + r.h / 2;
    if (c) {
      const [bx, by, bw, bh] = r.band;
      spaces += `<rect x="${bx}" y="${by}" width="${bw}" height="${bh}" fill="${c}" stroke="${INK}" stroke-width="3"/>`;
      // due righe al posto del nome e del prezzo
      const vertical = r.w > r.h;
      const lx = vertical ? (r.x < 500 ? r.x + 24 : r.x + BAND + 20) : r.x + 14;
      const ly = vertical ? r.y + 16 : (r.y < 500 ? r.y + 22 : r.y + BAND + 22);
      spaces += vertical
        ? `<path d="M${lx + 20} ${ly} v${r.h - 32} M${lx + 54} ${ly + 14} v${r.h - 60}" stroke="rgba(31,36,33,.28)" stroke-width="7" stroke-linecap="round"/>`
        : `<path d="M${lx} ${ly + 20} h${r.w - 28} M${lx + 10} ${ly + 54} h${r.w - 48}" stroke="rgba(31,36,33,.28)" stroke-width="7" stroke-linecap="round"/>`;
    } else spaces += glyph(s, cx, cy);
  });
  // qualche casetta sulle fasce dei quartieri già costruiti
  const houses = [[6, 1], [8, 2], [16, 3], [26, 2], [27, 1], [37, 1]]
    .map(([i, n]) => {
      const [bx, by, bw, bh] = spaceRect(i).band;
      const horiz = bw > bh;
      return Array.from({ length: n }, (_, k) => {
        const x = horiz ? bx + 10 + k * 22 : bx + 5;
        const y = horiz ? by + 5 : by + 10 + k * 22;
        return `<path d="M${x} ${y + 18} v-10 l9 -8 l9 8 v10 Z" fill="#fff" stroke="${INK}" stroke-width="2.5" stroke-linejoin="round"/>`;
      }).join('');
    })
    .join('');
  const colors = board.groups.map((g) => g.color);
  const pawns = [[3, colors[3 % colors.length]], [14, CRIMSON], [24, colors[4 % colors.length]], [33, GOLD]]
    .map(([i, c]) => { const r = spaceRect(i as number); return pawnSvg(c as string, r.x + r.w / 2, r.y + r.h / 2 + 4, 16); })
    .join('');
  return `<svg viewBox="0 0 1000 1000">
    <rect x="-14" y="-14" width="1028" height="1028" rx="18" fill="${INK}"/>
    <rect width="1000" height="1000" fill="#e9dfbf"/>
    <rect x="${C}" y="${C}" width="${1000 - 2 * C}" height="${1000 - 2 * C}" fill="#efe5c6"/>
    <path d="M${C} ${C} L${1000 - C} ${1000 - C} M${1000 - C} ${C} L${C} ${1000 - C}" stroke="rgba(31,36,33,.06)" stroke-width="2"/>
    ${spaces}${houses}
    <g transform="translate(300 290) rotate(-12)"><rect width="150" height="104" rx="10" fill="#f08c6c" stroke="${INK}" stroke-width="4"/><rect x="8" y="8" width="134" height="88" rx="6" fill="none" stroke="#fff" stroke-width="3" stroke-dasharray="6 5"/><text x="75" y="70" text-anchor="middle" font-size="54" font-weight="900" fill="#fff" font-family="${FONT}">?</text></g>
    <g transform="translate(560 610) rotate(-12)"><rect width="150" height="104" rx="10" fill="#138a8a" stroke="${INK}" stroke-width="4"/><rect x="8" y="8" width="134" height="88" rx="6" fill="none" stroke="#fff" stroke-width="3" stroke-dasharray="6 5"/><text x="75" y="70" text-anchor="middle" font-size="54" font-weight="900" fill="#fff" font-family="${FONT}">!</text></g>
    <g transform="translate(500 500) rotate(-12)"><rect x="-230" y="-52" width="460" height="104" rx="16" fill="${CRIMSON}" stroke="${INK}" stroke-width="5"/><rect x="-218" y="-40" width="436" height="80" rx="10" fill="none" stroke="${GOLD}" stroke-width="4"/><text y="22" text-anchor="middle" font-size="62" font-weight="900" fill="#fff" letter-spacing="3" font-family="${FONT}">GIOCO FOLLE!</text></g>
    ${pawns}
  </svg>`;
}

// ---------- oggetti sparsi sul tavolo ----------
function die(n: number): string {
  const pips: Record<number, [number, number][]> = {
    2: [[30, 30], [70, 70]],
    3: [[28, 28], [50, 50], [72, 72]],
    4: [[30, 30], [70, 30], [30, 70], [70, 70]],
    5: [[28, 28], [72, 28], [50, 50], [28, 72], [72, 72]],
    6: [[30, 26], [70, 26], [30, 50], [70, 50], [30, 74], [70, 74]],
  };
  return `<svg viewBox="0 0 100 100"><rect x="4" y="4" width="92" height="92" rx="20" fill="#fbf7ee" stroke="#c9c0ab" stroke-width="3"/><rect x="4" y="4" width="92" height="92" rx="20" fill="none" stroke="rgba(255,255,255,.9)" stroke-width="2" transform="translate(-1.5 -1.5)"/>${(pips[n] ?? pips[5]).map(([x, y]) => `<circle cx="${x}" cy="${y}" r="8.5" fill="${n === 5 ? CRIMSON : INK}"/>`).join('')}</svg>`;
}

function banknote(value: number, c: string): string {
  return `<svg viewBox="0 0 200 104"><rect x="2" y="2" width="196" height="100" rx="6" fill="${c}"/><rect x="10" y="10" width="180" height="84" rx="4" fill="none" stroke="rgba(31,36,33,.45)" stroke-width="2"/><ellipse cx="100" cy="52" rx="34" ry="30" fill="rgba(255,255,255,.55)" stroke="rgba(31,36,33,.35)" stroke-width="2"/><text x="100" y="66" text-anchor="middle" font-size="40" font-weight="900" fill="${INK}" font-family="${FONT}">Ƒ</text><text x="30" y="38" text-anchor="middle" font-size="22" font-weight="800" fill="${INK}" font-family="${FONT}">${value}</text><text x="170" y="84" text-anchor="middle" font-size="22" font-weight="800" fill="${INK}" font-family="${FONT}">${value}</text></svg>`;
}

function deed(c: string): string {
  return `<svg viewBox="0 0 120 160"><rect x="3" y="3" width="114" height="154" rx="6" fill="#fffdf6" stroke="${INK}" stroke-width="3"/><rect x="12" y="12" width="96" height="36" rx="3" fill="${c}" stroke="${INK}" stroke-width="2"/><path d="M34 26 h52 M44 36 h32" stroke="rgba(255,255,255,.85)" stroke-width="4" stroke-linecap="round"/>${[64, 80, 94, 108, 122].map((y, i) => `<path d="M20 ${y} h${i === 0 ? 80 : 50} M${i === 0 ? 100 : 86} ${y} h${i === 0 ? 0 : 14}" stroke="rgba(31,36,33,.35)" stroke-width="4" stroke-linecap="round"/>`).join('')}<path d="M30 140 h60" stroke="rgba(31,36,33,.25)" stroke-width="3"/></svg>`;
}

// casetta e albergo in prospettiva, come i pezzi di legno sul tavolo
function piece(c: string, wide = false): string {
  const w = wide ? 70 : 40;
  return `<svg viewBox="0 0 ${w + 30} 70"><path d="M4 ${30} l${w / 2} -24 l${w / 2} 24 v34 h-${w} Z" fill="${c}" stroke="${INK}" stroke-width="3" stroke-linejoin="round"/><path d="M${w + 4} 30 l22 -12 v34 l-22 12 Z" fill="${c}" stroke="${INK}" stroke-width="3" stroke-linejoin="round"/><path d="M${w + 4} 30 l22 -12 l-${w / 2} -18 l-${w / 2 - 22} 6 Z" fill="${c}" stroke="${INK}" stroke-width="3" stroke-linejoin="round"/><path d="M${w + 4} 30 l22 -12 v34 l-22 12 Z" fill="rgba(0,0,0,.25)"/><path d="M${w + 4} 30 l22 -12 l-${w / 2} -18 l-${w / 2 - 22} 6 Z" fill="rgba(0,0,0,.12)"/></svg>`;
}

function pawnPiece(c: string): string {
  // pedina classica: base larga, corpo a campana, collarino e testa tonda
  return `<svg viewBox="0 0 60 90"><ellipse cx="30" cy="83" rx="27" ry="6" fill="rgba(0,0,0,.28)"/><path d="M5 82 q0 -10 9 -12 q6 -2 8 -10 l2 -22 h12 l2 22 q2 8 8 10 q9 2 9 12 Z" fill="${c}" stroke="${INK}" stroke-width="3" stroke-linejoin="round"/><rect x="17" y="34" width="26" height="7" rx="3.5" fill="${c}" stroke="${INK}" stroke-width="3"/><circle cx="30" cy="20" r="14" fill="${c}" stroke="${INK}" stroke-width="3"/><circle cx="25" cy="15" r="4.5" fill="rgba(255,255,255,.6)"/><path d="M14 74 q16 5 32 0" stroke="rgba(0,0,0,.18)" stroke-width="3" fill="none"/></svg>`;
}

function tableHtml(): string {
  const colors = board.groups.map((g) => g.color);
  const g = (k: number) => colors[k % colors.length];
  // [classe, left %, top %, larghezza px, rotazione, contenuto]
  const props: [string, number, number, number, number, string][] = [
    ['note', 2, 8, 150, -14, banknote(500, '#f2a65a')],
    ['note', 5, 11, 150, -4, banknote(100, '#a8d5a2')],
    ['note', 8, 14, 150, 8, banknote(50, '#9cc7e8')],
    ['deed', 88, 6, 92, 12, deed(g(3))],
    ['deed', 92, 12, 92, 24, deed(g(5))],
    ['piece', 84, 76, 60, -6, piece(g(6))],
    ['piece', 90, 82, 92, 10, piece(CRIMSON, true)],
    ['piece', 4, 70, 52, 8, piece(g(2))],
    ['figure', 12, 84, 46, 0, pawnPiece(g(4))],
    ['figure', 78, 88, 40, 0, pawnPiece(GOLD)],
  ];
  return `<div class="bg-felt"></div><div class="bg-lamp"></div>
    <div class="bg-board">${boardSvg()}</div>
    ${props.map(([cls, x, y, w, r, svg]) => `<div class="bg-prop ${cls}" style="left:${x}%;top:${y}%;--w:${w}px;--r:${r}deg">${svg}</div>`).join('')}
    <div class="bg-dice"><div class="die a">${die(5)}</div><div class="die b">${die(3)}</div></div>`;
}

// ---------- lo schermo come tabellone: il percorso delle caselle lungo i bordi ----------
function cell(s: Space): string {
  const c = groupColor(s);
  if (c) return `<i style="--g:${c}"></i>`;
  const mark = s.type === 'card' ? '?' : s.type === 'tax' ? 'Ƒ' : s.type === 'station' ? '🚉' : s.type === 'utility' ? '⚡' : '';
  return `<i class="plain"><b>${mark}</b></i>`;
}

function trackHtml(): string {
  const sp = board.spaces.slice(0, 40);
  const corner = (k: number, cls: string) => {
    const s = sp[k];
    const mark = s.type === 'start' ? '➜' : s.type === 'jail' ? '▦' : s.type === 'free' ? 'Ƒ' : '★';
    return `<div class="bg-corner ${cls} t-${s.type}"><b>${mark}</b></div>`;
  };
  const bottom = sp.slice(1, 10).reverse().map(cell).join('');
  const left = sp.slice(11, 20).reverse().map(cell).join('');
  const top = sp.slice(21, 30).map(cell).join('');
  const right = sp.slice(31, 40).map(cell).join('');
  const colors = board.groups.map((g) => g.color);
  return `<div class="bg-paper"></div>
    <div class="bg-track bottom">${bottom}</div><div class="bg-track left">${left}</div>
    <div class="bg-track top">${top}</div><div class="bg-track right">${right}</div>
    ${corner(0, 'br')}${corner(10, 'bl')}${corner(20, 'tl')}${corner(30, 'tr')}
    <div class="bg-walker top"><div class="hop">${pawnPiece(CRIMSON)}</div></div>
    <div class="bg-walker bottom"><div class="hop">${pawnPiece(colors[3 % colors.length])}</div></div>`;
}

export function backgroundHtml(kind: BackgroundId): string {
  const inner = kind === 'tabellone' ? trackHtml() : tableHtml();
  return `<div class="setup-bg bg-${kind}" aria-hidden="true">${inner}</div>`;
}

export function isBackground(x: unknown): x is BackgroundId {
  return BACKGROUNDS.includes(x as BackgroundId);
}

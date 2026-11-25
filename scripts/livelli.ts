// Simulazione dei livelli e dei caratteri del computer.
// 1) Livelli: partite a 3 (facile, normale, difficile) in tutti gli ordini, così il posto non conta.
// 2) Caratteri: partite a 5 con un computer per carattere (tutti normali), a rotazione.
// Uso: npm run livelli -- [partite] (scrive docs/livelli-computer.md)
import { writeFileSync } from 'node:fs';
import { board, cards } from '../src/data';
import { BOT_LEVELS, BOT_STYLES, applyAction, chooseBotAction, createGame, seededRng, type BotProfile, type GameContext, type GameState } from '../src/engine';

const GAMES = Number(process.argv[2] ?? 600);
const MAX_ROUNDS = 150;

function play(profiles: BotProfile[], seed: number, rules = {}): GameState {
  const ctx: GameContext = { board, cards, rng: seededRng(seed * 7919 + 13) };
  let s = createGame(profiles.map((bot, i) => ({ name: `P${i + 1}`, isBot: true, bot })), ctx, { maxRounds: 60, ...rules }, seed);
  while (s.phase !== 'gameOver' && s.round <= MAX_ROUNDS) s = applyAction(s, chooseBotAction(s, ctx), ctx);
  return s;
}

function rotations<T>(items: T[]): T[][] {
  return items.map((_, r) => items.map((__, i) => items[(i + r) % items.length]));
}

// ---------- livelli ----------
const levels = BOT_LEVELS.map((l) => l.id);
const orders = [levels, [...levels].reverse()].flatMap(rotations);
const levelWins: Record<string, number> = Object.fromEntries(levels.map((l) => [l, 0]));
let levelGames = 0;
for (let g = 0; g < GAMES; g++) {
  const order = orders[g % orders.length];
  const s = play(order.map((level) => ({ level, style: 'equilibrato' })), g + 1);
  if (s.winner === null) continue;
  levelGames++;
  levelWins[order[s.winner]]++;
}

// ---------- caratteri ----------
const styles = BOT_STYLES.map((x) => x.id);
const styleOrders = rotations(styles);
const acc: Record<string, { wins: number; bought: number; built: number; trades: number; money: number; n: number }> = Object.fromEntries(
  styles.map((x) => [x, { wins: 0, bought: 0, built: 0, trades: 0, money: 0, n: 0 }]),
);
let styleGames = 0;
for (let g = 0; g < GAMES; g++) {
  const order = styleOrders[g % styleOrders.length];
  const s = play(order.map((style) => ({ level: 'normale', style })), 100_000 + g);
  if (s.winner !== null) styleGames++;
  order.forEach((style, seat) => {
    const a = acc[style];
    a.n++;
    if (s.winner === seat) a.wins++;
    a.bought += s.stats[seat].bought;
    a.built += s.stats[seat].built;
    a.trades += s.stats[seat].trades;
    a.money += s.history?.length ? s.history[Math.min(9, s.history.length - 1)][seat] : 0;
  });
}

const pct = (n: number, d: number) => (d ? `${Math.round((n / d) * 100)}%` : '-');
const lines = [
  '# Livelli e caratteri del computer',
  '',
  `Generato con \`npm run livelli -- ${GAMES}\`. Partite di al massimo 60 giri (vince il patrimonio più alto).`,
  '',
  '## Livelli',
  `${levelGames} partite a tre (facile, normale, difficile), con l'ordine al tavolo che cambia a ogni partita.`,
  '',
  '| Livello | Vittorie |',
  '|---|---|',
  ...levels.map((l) => `| ${BOT_LEVELS.find((x) => x.id === l)!.label} | ${levelWins[l]} (${pct(levelWins[l], levelGames)}) |`),
  '',
  '## Caratteri',
  `${styleGames} partite a cinque, un computer normale per carattere, a rotazione. Medie per partita; il patrimonio è quello al giro 10.`,
  '',
  '| Carattere | Vittorie | Proprietà comprate | Case costruite | Scambi | Patrimonio al giro 10 |',
  '|---|---|---|---|---|---|',
  ...styles.map((x) => {
    const a = acc[x];
    return `| ${BOT_STYLES.find((y) => y.id === x)!.label} | ${pct(a.wins, a.n)} | ${(a.bought / a.n).toFixed(1)} | ${(a.built / a.n).toFixed(1)} | ${(a.trades / a.n).toFixed(2)} | ${Math.round(a.money / a.n)} |`;
  }),
  '',
];
const report = lines.join('\n');
writeFileSync(process.argv[3] ?? 'docs/livelli-computer.md', report);
console.log(report);

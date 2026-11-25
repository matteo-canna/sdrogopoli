// Misura la durata dei tipi di partita (src/engine/presets.ts) e scrive docs/tipi-di-partita.md.
// Uso: npm run preset -- [partite]. Se una mediana cambia, va aggiornato "rounds" in presets.ts.
import { writeFileSync } from 'node:fs';
import { board, cards } from '../src/data';
import { PRESETS, applyAction, chooseBotAction, createGame, estimatedMinutes, seededRng, type GameContext } from '../src/engine';

const GAMES = Number(process.argv[2] ?? 300);
const lines = [
  '# Tipi di partita',
  '',
  `Durata misurata con \`npm run preset -- ${GAMES}\`: ${GAMES} partite tra 4 computer normali per ogni tipo (massimo 150 giri).`,
  `I minuti sono una stima per 4 persone, con ${25} secondi a turno.`,
  '',
  '| Tipo | Regole | Finite | Giri (mediana) | 90° percentile | Minuti in 4 persone | Nel gioco |',
  '|---|---|---|---|---|---|---|',
];
for (const p of PRESETS) {
  const rounds: number[] = [];
  for (let g = 1; g <= GAMES; g++) {
    const ctx: GameContext = { board, cards, rng: seededRng(g * 31 + 7) };
    let s = createGame(Array.from({ length: 4 }, (_, i) => ({ name: `P${i}`, isBot: true })), ctx, p.rules, g);
    while (s.phase !== 'gameOver' && s.round <= 150) s = applyAction(s, chooseBotAction(s, ctx), ctx);
    if (s.phase === 'gameOver') rounds.push(s.round);
  }
  rounds.sort((a, b) => a - b);
  const median = rounds[rounds.length >> 1];
  lines.push(`| ${p.label} | \`${JSON.stringify(p.rules)}\` | ${rounds.length} | ${median} | ${rounds[Math.floor(rounds.length * 0.9)]} | ${estimatedMinutes({ rounds: median }, 4, 0)} | ${p.rounds} |`);
}
const report = lines.join('\n') + '\n';
writeFileSync('docs/tipi-di-partita.md', report);
console.log(report);

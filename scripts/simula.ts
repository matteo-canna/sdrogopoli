// Simulazione di bilanciamento: il computer gioca contro sé stesso molte partite
// e scrive un rapporto su durata, vantaggio del primo giocatore e rendita dei quartieri.
// Uso: npm run simula -- [partite] [giocatori]
import { writeFileSync } from 'node:fs';
import { board, cards } from '../src/data';
import { applyAction, chooseBotAction, computeRent, createGame, seededRng, type GameContext, type GameState } from '../src/engine';

const GAMES = Number(process.argv[2] ?? 400);
const PLAYERS = Number(process.argv[3] ?? 4);
const MAX_ROUNDS = 150;

interface Stats {
  finished: number;
  rounds: number[];
  winsBySeat: number[];
  landings: number[];
  rentBySpace: Record<string, number>;
  groupCompleted: Record<string, number>;
  trades: number;
  auctions: number;
}

const stats: Stats = {
  finished: 0,
  rounds: [],
  winsBySeat: Array(PLAYERS).fill(0),
  landings: Array(board.spaces.length).fill(0),
  rentBySpace: {},
  groupCompleted: {},
  trades: 0,
  auctions: 0,
};

function completedGroups(s: GameState): Set<string> {
  const done = new Set<string>();
  for (const g of board.groups) {
    const props = board.spaces.filter((sp) => sp.type === 'property' && sp.group === g.id);
    const owners = new Set(props.map((p) => s.ownership[p.id]?.owner));
    if (owners.size === 1 && !owners.has(undefined)) done.add(g.id);
  }
  return done;
}

for (let seed = 1; seed <= GAMES; seed++) {
  const ctx: GameContext = { board, cards, rng: seededRng(seed * 7919) };
  let s = createGame(Array.from({ length: PLAYERS }, (_, i) => ({ name: `P${i + 1}`, isBot: true })), ctx);
  const seen = new Set<string>();
  while (s.phase !== 'gameOver' && s.round <= MAX_ROUNDS) {
    const action = chooseBotAction(s, ctx);
    const before = s;
    s = applyAction(s, action, ctx);
    if (action.type === 'acceptTrade') stats.trades++;
    if (action.type === 'decline') stats.auctions++;
    // dopo un lancio: casella di arrivo e affitto pagato
    if (action.type === 'roll' || (before.players[before.current].position !== s.players[before.current].position)) {
      const p = s.players[before.current];
      const space = board.spaces[p.position];
      if (action.type === 'roll') stats.landings[p.position]++;
      const own = s.ownership[space.id];
      if (own && own.owner !== p.id && action.type === 'roll') {
        const total = s.lastRoll ? s.lastRoll[0] + s.lastRoll[1] : 7;
        stats.rentBySpace[space.id] = (stats.rentBySpace[space.id] ?? 0) + computeRent(s, ctx, space.id, total);
      }
    }
    for (const g of completedGroups(s)) {
      if (!seen.has(g)) {
        seen.add(g);
        stats.groupCompleted[g] = (stats.groupCompleted[g] ?? 0) + 1;
      }
    }
  }
  if (s.phase === 'gameOver' && s.winner !== null) {
    stats.finished++;
    stats.rounds.push(s.round);
    stats.winsBySeat[s.winner]++;
  }
}

// ---------- rapporto ----------

const pct = (n: number, d: number) => (d ? `${Math.round((n / d) * 100)}%` : '-');
const sorted = [...stats.rounds].sort((a, b) => a - b);
const median = sorted.length ? sorted[Math.floor(sorted.length / 2)] : 0;
const totalLandings = stats.landings.reduce((a, b) => a + b, 0);

const lines: string[] = [];
lines.push(`# Rapporto di bilanciamento`);
lines.push('');
lines.push(`${GAMES} partite tra ${PLAYERS} giocatori computer, massimo ${MAX_ROUNDS} giri. Generato con \`npm run simula -- ${GAMES} ${PLAYERS}\`.`);
lines.push('');
lines.push(`## Durata`);
lines.push(`- Partite finite con un vincitore: **${stats.finished} su ${GAMES} (${pct(stats.finished, GAMES)})**`);
lines.push(`- Giri per finire: mediana **${median}**, 10° percentile ${sorted[Math.floor(sorted.length * 0.1)] ?? '-'}, 90° percentile ${sorted[Math.floor(sorted.length * 0.9)] ?? '-'}`);
lines.push(`- Scambi accettati: ${(stats.trades / GAMES).toFixed(1)} per partita · Aste: ${(stats.auctions / GAMES).toFixed(1)} per partita`);
lines.push('');
lines.push(`## Vittorie per posto al tavolo`);
lines.push(`| Posto | Vittorie |`);
lines.push(`|---|---|`);
stats.winsBySeat.forEach((w, i) => lines.push(`| ${i + 1}° a giocare | ${w} (${pct(w, stats.finished)}) |`));
lines.push('');
lines.push(`## Quartieri`);
lines.push(`Rendita = affitto medio incassato per partita, diviso il costo per comprare il quartiere e costruirci 3 case per via.`);
lines.push('');
lines.push(`| Quartiere | Arrivi per partita | Completato | Affitto per partita | Costo con 3 case | Rendita |`);
lines.push(`|---|---|---|---|---|---|`);
for (const g of board.groups) {
  const props = board.spaces.filter((sp) => sp.type === 'property' && sp.group === g.id);
  const landings = props.reduce((sum, sp) => sum + stats.landings[board.spaces.indexOf(sp)], 0) / GAMES;
  const rent = props.reduce((sum, sp) => sum + (stats.rentBySpace[sp.id] ?? 0), 0) / GAMES;
  const cost = props.reduce((sum, sp) => sum + (sp.type === 'property' ? sp.price + 3 * sp.housePrice : 0), 0);
  lines.push(`| ${g.name} | ${landings.toFixed(1)} | ${pct(stats.groupCompleted[g.id] ?? 0, GAMES)} | ${Math.round(rent)} | ${cost} | ${(rent / cost).toFixed(2)} |`);
}
const stationRent = board.spaces.filter((s) => s.type === 'station').reduce((sum, sp) => sum + (stats.rentBySpace[sp.id] ?? 0), 0) / GAMES;
const utilityRent = board.spaces.filter((s) => s.type === 'utility').reduce((sum, sp) => sum + (stats.rentBySpace[sp.id] ?? 0), 0) / GAMES;
lines.push(`| Fermate (4) | | | ${Math.round(stationRent)} | 800 | ${(stationRent / 800).toFixed(2)} |`);
lines.push(`| Servizi (2) | | | ${Math.round(utilityRent)} | 300 | ${(utilityRent / 300).toFixed(2)} |`);
lines.push('');
lines.push(`## Caselle più visitate`);
const top = stats.landings.map((n, i) => ({ n, i })).sort((a, b) => b.n - a.n).slice(0, 8);
for (const t of top) lines.push(`- ${board.spaces[t.i].name}: ${pct(t.n, totalLandings)} degli arrivi`);

const report = lines.join('\n') + '\n';
const out = process.argv[4] ?? 'docs/bilanciamento.md';
writeFileSync(out, report);
console.log(report);

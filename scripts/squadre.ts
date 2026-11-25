// Simulazione delle partite a squadre: quattro computer, due contro due.
// Uso: npm run squadre -- [partite]
import { writeFileSync } from 'node:fs';
import { board, cards } from '../src/data';
import { applyAction, chooseBotAction, createGame, netWorth, seededRng, teamMembers, type GameContext, type GameState } from '../src/engine';

const GAMES = Number(process.argv[2] ?? 300);
const MAX_ROUNDS = 150;

function play(seed: number, teams: boolean): GameState {
  const ctx: GameContext = { board, cards, rng: seededRng(seed * 7919) };
  let s = createGame(
    Array.from({ length: 4 }, (_, i) => ({ name: `P${i + 1}`, isBot: true })),
    ctx,
    { teams },
  );
  while (s.phase !== 'gameOver' && s.round <= MAX_ROUNDS) s = applyAction(s, chooseBotAction(s, ctx), ctx);
  return s;
}

const rounds: number[] = [];
const soloRounds: number[] = [];
const winsByTeam = [0, 0];
let finished = 0;
let finishedSolo = 0;
for (let seed = 1; seed <= GAMES; seed++) {
  const s = play(seed, true);
  if (s.phase === 'gameOver' && s.winner !== null) {
    finished++;
    rounds.push(s.round);
    winsByTeam[s.players[s.winner].team ?? 0]++;
  }
  const solo = play(seed, false);
  if (solo.phase === 'gameOver') {
    finishedSolo++;
    soloRounds.push(solo.round);
  }
}

function median(xs: number[]): number {
  if (!xs.length) return 0;
  const v = [...xs].sort((a, b) => a - b);
  return v[Math.floor(v.length / 2)];
}

// controllo di coerenza: i compagni non si pagano l'affitto, quindi i patrimoni restano più alti
const sample = play(1, true);
const teamWorths = [0, 1].map((t) =>
  teamMembers(sample, sample.players.findIndex((p) => p.team === t)).reduce((sum, m) => sum + (sample.players[m].bankrupt ? 0 : netWorth(sample, { board, cards }, m)), 0),
);

const out = `# Partite a squadre (2 contro 2)

Simulazione con ${GAMES} partite tra quattro computer normali, confrontate con le stesse partite
senza squadre (stessi semi, quindi stessi dadi e stesse carte).

| | a squadre | senza squadre |
| --- | --- | --- |
| partite finite entro ${MAX_ROUNDS} giri | ${finished} | ${finishedSolo} |
| giri (mediana) | ${median(rounds)} | ${median(soloRounds)} |

Vittorie per squadra: squadra 1 ${winsByTeam[0]}, squadra 2 ${winsByTeam[1]}
(la squadra 1 ha il primo e il terzo posto, la squadra 2 il secondo e il quarto).

Esempio di fine partita (seme 1): patrimoni di squadra ${teamWorths[0]} e ${teamWorths[1]}.

Scritto da \`npm run squadre\`.
`;
writeFileSync(process.argv[3] ?? 'docs/squadre.md', out);
console.log(out);

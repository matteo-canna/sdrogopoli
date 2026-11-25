// Simulazione delle regole facoltative "Quote di quartiere" ed "Edifici speciali": quattro computer
// normali giocano le stesse partite (stessi semi) con e senza le regole.
// Uso: npm run quote -- [partite]
import { writeFileSync } from 'node:fs';
import { board, cards } from '../src/data';
import { applyAction, chooseBotAction, createGame, seededRng, type GameContext, type GameRules, type GameState } from '../src/engine';

const GAMES = Number(process.argv[2] ?? 300);
const MAX_ROUNDS = 150;
// giro in cui si guarda chi è in testa, per contare le rimonte
const CHECK_ROUND = 20;

interface Result {
  state: GameState;
  shares: number;
  landmarks: number;
  dividends: number;
}

function play(seed: number, rules: Partial<GameRules>): Result {
  const ctx: GameContext = { board, cards, rng: seededRng(seed * 7919) };
  let s = createGame(
    Array.from({ length: 4 }, (_, i) => ({ name: `P${i + 1}`, isBot: true })),
    ctx,
    rules,
  );
  let shares = 0;
  let landmarks = 0;
  while (s.phase !== 'gameOver' && s.round <= MAX_ROUNDS) {
    const a = chooseBotAction(s, ctx);
    if (a.type === 'buyShare') shares++;
    if (a.type === 'buildLandmark') landmarks++;
    s = applyAction(s, a, ctx);
  }
  const dividends = s.stats.reduce((a, st) => a + (st.dividends ?? 0), 0);
  return { state: s, shares, landmarks, dividends };
}

function median(xs: number[]): number {
  if (!xs.length) return 0;
  const v = [...xs].sort((a, b) => a - b);
  return v[Math.floor(v.length / 2)];
}

const VARIANTS: { name: string; rules: Partial<GameRules> }[] = [
  { name: 'senza', rules: {} },
  { name: 'quote', rules: { shares: true } },
  { name: 'edifici', rules: { landmarks: true } },
  { name: 'tutte e due', rules: { shares: true, landmarks: true } },
];

const rows = VARIANTS.map((v) => {
  const rounds: number[] = [];
  const seatWins = [0, 0, 0, 0];
  let finished = 0;
  let comebacks = 0;
  let checked = 0;
  let shares = 0;
  let landmarks = 0;
  let dividends = 0;
  for (let seed = 1; seed <= GAMES; seed++) {
    const r = play(seed, v.rules);
    const s = r.state;
    shares += r.shares;
    landmarks += r.landmarks;
    dividends += r.dividends;
    if (s.phase !== 'gameOver' || s.winner === null) continue;
    finished++;
    rounds.push(s.round);
    seatWins[s.winner]++;
    const at = s.history[CHECK_ROUND];
    if (at) {
      checked++;
      const leader = at.indexOf(Math.max(...at));
      if (leader !== s.winner) comebacks++;
    }
  }
  const pct = (n: number, d: number) => (d ? `${Math.round((n / d) * 100)}%` : '-');
  return {
    name: v.name,
    finished,
    median: median(rounds),
    seats: seatWins.map((w) => pct(w, finished)).join(' / '),
    comebacks: pct(comebacks, checked),
    shares: (shares / GAMES).toFixed(1),
    landmarks: (landmarks / GAMES).toFixed(1),
    dividends: Math.round(dividends / GAMES),
  };
});

const out = `# Quote di quartiere ed edifici speciali

Simulazione con ${GAMES} partite tra quattro computer normali sul tabellone predefinito, le stesse
(stessi semi, quindi stessi dadi e stesse carte all'inizio) con e senza le regole facoltative.
"Rimonte" sono le partite vinte da chi al giro ${CHECK_ROUND} non era in testa per patrimonio.

| regole | partite finite entro ${MAX_ROUNDS} giri | giri (mediana) | vittorie per posto | rimonte | quote comprate | edifici costruiti | dividendi pagati |
| --- | --- | --- | --- | --- | --- | --- | --- |
${rows.map((r) => `| ${r.name} | ${r.finished} | ${r.median} | ${r.seats} | ${r.comebacks} | ${r.shares} | ${r.landmarks} | ${r.dividends} |`).join('\n')}

Quote, edifici e dividendi sono medie per partita.

Scritto da \`npm run quote\`.
`;
writeFileSync(process.argv[3] ?? 'docs/bilanciamento-quote.md', out);
console.log(out);

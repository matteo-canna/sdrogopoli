// Simulazione comparativa delle regole facoltative: quattro computer normali giocano
// le stesse partite (stessi semi) senza regole facoltative, con ogni regola da sola e con tutte insieme.
// Uso: npm run regole -- [partite] [file]
import { writeFileSync } from 'node:fs';
import { board, cards } from '../src/data';
import {
  applyAction,
  chooseBotAction,
  createGame,
  seededRng,
  type GameContext,
  type GameRules,
  type GameState,
} from '../src/engine';

const GAMES = Number(process.argv[2] ?? 200);
const PLAYERS = 4;
const MAX_ROUNDS = 150;
// Limite di sicurezza sulle azioni per evitare eventuali loop in combinazioni di regole.
const MAX_ACTIONS = 6000;

interface RuleConfig {
  label: string;
  rules: Partial<GameRules>;
}

// Elenco delle configurazioni da misurare: per provare una nuova regola di GameRules
// basta aggiungere una riga qui sotto.
const CONFIGS: RuleConfig[] = [
  { label: 'Nessuna regola facoltativa', rules: {} },
  { label: 'Eventi di quartiere (`events`)', rules: { events: true } },
  { label: 'Ruota del Mercato (`wheel`)', rules: { wheel: true } },
  { label: 'Quote di quartiere (`shares`)', rules: { shares: true } },
  { label: 'Edifici speciali (`landmarks`)', rules: { landmarks: true } },
  { label: 'Dado Sprint (`sprintDie`)', rules: { sprintDie: true } },
  { label: 'Squadre 2 vs 2 (`teams`)', rules: { teams: true } },
  {
    label: 'Tutte insieme',
    rules: {
      events: true,
      wheel: true,
      shares: true,
      landmarks: true,
      sprintDie: true,
      teams: true,
    },
  },
];

interface ConfigSummary {
  label: string;
  median: number;
  p90: number;
  seatPcts: string;
  bankruptcyPct: string;
  roundLimitPct: string;
  finished: number;
}

// Gioca una singola partita fino alla fine o fino al limite di giri.
function playGame(seed: number, rules: Partial<GameRules>): GameState {
  const ctx: GameContext = { board, cards, rng: seededRng(seed * 7919) };
  let state = createGame(
    Array.from({ length: PLAYERS }, (_, i) => ({ name: `P${i + 1}`, isBot: true })),
    ctx,
    rules,
  );
  let actions = 0;
  while (state.phase !== 'gameOver' && state.round <= MAX_ROUNDS && actions < MAX_ACTIONS) {
    state = applyAction(state, chooseBotAction(state, ctx), ctx);
    actions++;
  }
  return state;
}

// Calcola un percentile su un elenco di numeri (es. 0.5 per la mediana, 0.9 per il 90°).
function percentile(values: number[], p: number): number {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.min(sorted.length - 1, Math.floor(sorted.length * p));
  return sorted[index];
}

function pct(part: number, total: number): string {
  return total ? `${Math.round((part / total) * 100)}%` : '-';
}

function pct1(part: number, total: number): string {
  return total ? `${((part / total) * 100).toFixed(1)}%` : '-';
}

// Esegue tutte le partite previste per una singola configurazione.
function runConfig(config: RuleConfig): ConfigSummary {
  const rounds: number[] = [];
  const winsBySeat = Array(PLAYERS).fill(0);
  let finishedByBankruptcy = 0;
  let finishedByRoundLimit = 0;

  for (let seed = 1; seed <= GAMES; seed++) {
    const state = playGame(seed, config.rules);
    if (state.phase === 'gameOver' && state.winner !== null) {
      rounds.push(state.round);
      winsBySeat[state.winner]++;
      if (state.winReason === 'rounds') {
        finishedByRoundLimit++;
      } else {
        finishedByBankruptcy++;
      }
    } else {
      // Partita interrotta al raggiungimento del limite massimo di giri
      finishedByRoundLimit++;
    }
  }

  const finished = rounds.length;
  console.error(`[regole] ${config.label}: ${finished}/${GAMES} concluse (mediana ${percentile(rounds, 0.5)})`);
  return {
    label: config.label,
    median: percentile(rounds, 0.5),
    p90: percentile(rounds, 0.9),
    seatPcts: winsBySeat.map((w) => pct(w, finished)).join(' / '),
    bankruptcyPct: pct1(finishedByBankruptcy, GAMES),
    roundLimitPct: pct1(finishedByRoundLimit, GAMES),
    finished,
  };
}

const startedAt = Date.now();
const rows = CONFIGS.map(runConfig);
const elapsedSeconds = ((Date.now() - startedAt) / 1000).toFixed(1);

const lines: string[] = [
  '# Bilanciamento delle regole facoltative',
  '',
  `Simulazione con ${GAMES} partite per configurazione tra ${PLAYERS} computer normali sul tabellone predefinito (${board.spaces.length} caselle, semi fissi 1–${GAMES}, limite massimo ${MAX_ROUNDS} giri).`,
  '',
  '| Configurazione | Giri (mediana) | Giri (90° perc.) | Vittorie 1° / 2° / 3° / 4° | Bancarotta | Limite giri |',
  '| --- | ---: | ---: | --- | ---: | ---: |',
  ...rows.map(
    (r) =>
      `| ${r.label} | ${r.median || '-'} | ${r.p90 || '-'} | ${r.seatPcts} | ${r.bankruptcyPct} | ${r.roundLimitPct} |`,
  ),
  '',
  'Note:',
  `- Mediana, 90° percentile e vittorie per posto sono calcolati sulle partite concluse entro ${MAX_ROUNDS} giri.`,
  '- In modalità squadre (`teams`), il 1° e il 3° posto formano la Squadra 1, il 2° e il 4° la Squadra 2; la colonna indica il posto del giocatore registrato come vincitore.',
  '- Per misurare una nuova regola di `GameRules`, aggiungere una voce all\'array `CONFIGS` in `scripts/regole.ts` e rilanciare `npm run regole`.',
  '',
  `Scritto da \`npm run regole\` (${elapsedSeconds} s).`,
];

const report = lines.join('\n') + '\n';
const outFile = process.argv[3] ?? 'docs/bilanciamento-regole.md';
writeFileSync(outFile, report);
console.log(report);

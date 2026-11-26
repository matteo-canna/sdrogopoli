// Statistiche per tabellone: per ogni tabellone registrato in BOARDS simula 500 partite
// a 4 computer con semi fissi e misura frequenza di arrivo sulle caselle e rendimento dei quartieri.
// Uso: npm run caselle -- [partite] [file]
import { writeFileSync } from 'node:fs';
import { cards } from '../src/data';
import { BOARDS, type BoardChoice } from '../src/data/boards';
import {
  applyAction,
  chooseBotAction,
  createGame,
  seededRng,
  type BoardData,
  type GameContext,
  type Space,
} from '../src/engine';

const GAMES = Number(process.argv[2] ?? 500);
const PLAYERS = 4;
const MAX_ROUNDS = 150;
// Limite di sicurezza sulle azioni per singola partita.
const MAX_ACTIONS = 6000;

interface BoardStats {
  choice: BoardChoice;
  finished: number;
  totalLandings: number;
  landings: number[];
  rentByGroup: Record<string, number>;
  paidByGroup: Record<string, number>;
}

// Etichetta leggibile in italiano per il tipo di casella (o nome del quartiere).
function spaceLabel(space: Space, groupNames: Map<string, string>): string {
  switch (space.type) {
    case 'property':
      return groupNames.get(space.group) ?? space.group;
    case 'station':
      return 'Fermata';
    case 'utility':
      return 'Servizio';
    case 'card':
      return space.deck === 'sorte' ? 'Colpo di Sorte' : 'Voci di Quartiere';
    case 'tax':
      return 'Tassa';
    case 'start':
      return 'Partenza';
    case 'jail':
      return 'Caserma';
    case 'goToJail':
      return 'Vai in Caserma';
    case 'free':
      return 'Panchina';
  }
}

// Simula tutte le partite per un singolo tabellone leggendo solo lo stato prima e dopo ogni azione.
function simulateBoard(choice: BoardChoice): BoardStats {
  const board: BoardData = choice.data;
  const spaceById = new Map<string, Space>(board.spaces.map((sp) => [sp.id, sp]));
  const landings = Array(board.spaces.length).fill(0);
  const rentByGroup: Record<string, number> = {};
  const paidByGroup: Record<string, number> = {};
  for (const g of board.groups) {
    rentByGroup[g.id] = 0;
    paidByGroup[g.id] = 0;
  }

  let finished = 0;

  for (let seed = 1; seed <= GAMES; seed++) {
    const ctx: GameContext = { board, cards, rng: seededRng(seed * 7919) };
    let state = createGame(
      Array.from({ length: PLAYERS }, (_, i) => ({ name: `P${i + 1}`, isBot: true })),
      ctx,
    );

    let actions = 0;
    while (state.phase !== 'gameOver' && state.round <= MAX_ROUNDS && actions < MAX_ACTIONS) {
      const before = state;
      const action = chooseBotAction(before, ctx);
      state = applyAction(before, action, ctx);
      actions++;

      const currentIdx = before.current;
      const prevPlayer = before.players[currentIdx];
      const nextPlayer = state.players[currentIdx];

      // 1) Arrivi sulle caselle: lancio dei dadi (fuori dalla Caserma) o spostamento da carta.
      const movedOnRoll = action.type === 'roll' && (!prevPlayer.inJail || !nextPlayer.inJail);
      const movedOnChoice = action.type === 'chooseCard' && prevPlayer.position !== nextPlayer.position;
      if (movedOnRoll || movedOnChoice) {
        landings[nextPlayer.position]++;

        // Affitto effettivamente incassato su questa casella (differenza su state.stats.rentReceived).
        const landedSpace = board.spaces[nextPlayer.position];
        if (landedSpace.type === 'property') {
          let rentDelta = 0;
          for (let i = 0; i < state.stats.length; i++) {
            const diff = state.stats[i].rentReceived - before.stats[i].rentReceived;
            if (diff > 0) rentDelta += diff;
          }
          if (rentDelta > 0) {
            rentByGroup[landedSpace.group] = (rentByGroup[landedSpace.group] ?? 0) + rentDelta;
          }
        }
      }

      // 2) Prezzo pagato per acquisto diretto di una via.
      if (action.type === 'buy') {
        const sp = board.spaces[prevPlayer.position];
        if (sp.type === 'property' && state.ownership[sp.id] && !before.ownership[sp.id]) {
          paidByGroup[sp.group] = (paidByGroup[sp.group] ?? 0) + sp.price;
        }
      }

      // 3) Prezzo pagato per aggiudicazione all'asta (anche in coda dopo bancarotta).
      if (before.auction && (!state.auction || state.auction.spaceId !== before.auction.spaceId)) {
        const sp = spaceById.get(before.auction.spaceId);
        if (sp?.type === 'property' && state.ownership[sp.id]) {
          const winningBid = action.type === 'bid' ? action.amount : before.auction.highestBid;
          if (winningBid > 0) {
            paidByGroup[sp.group] = (paidByGroup[sp.group] ?? 0) + winningBid;
          }
        }
      }

      // 4) Prezzo pagato per costruzione di case o palazzi.
      if (action.type === 'build') {
        const sp = spaceById.get(action.spaceId);
        const prevHouses = before.ownership[action.spaceId]?.houses ?? 0;
        const nextHouses = state.ownership[action.spaceId]?.houses ?? 0;
        if (sp?.type === 'property' && nextHouses > prevHouses) {
          paidByGroup[sp.group] = (paidByGroup[sp.group] ?? 0) + sp.housePrice * (nextHouses - prevHouses);
        }
      }
    }

    if (state.phase === 'gameOver' && state.winner !== null) {
      finished++;
    }
  }

  const totalLandings = landings.reduce((sum, n) => sum + n, 0);
  console.error(`[caselle] ${choice.id}: ${finished}/${GAMES} concluse, ${totalLandings} arrivi`);
  return { choice, finished, totalLandings, landings, rentByGroup, paidByGroup };
}

function pct2(part: number, total: number): string {
  return total ? `${((part / total) * 100).toFixed(2)}%` : '-';
}

const startedAt = Date.now();
const results = BOARDS.map(simulateBoard);
const elapsedSeconds = ((Date.now() - startedAt) / 1000).toFixed(1);

const lines: string[] = [
  '# Statistiche delle caselle e dei quartieri',
  '',
  `Simulazione con ${GAMES} partite per tabellone tra ${PLAYERS} computer normali (semi fissi 1–${GAMES}, limite massimo ${MAX_ROUNDS} giri).`,
  'Per ogni casella è riportata la quota di arrivi sul totale; per ogni quartiere il rendimento medio (affitto totale incassato diviso il prezzo totale pagato tra vie e case).',
];

for (const res of results) {
  const board = res.choice.data;
  const title = board.title ?? res.choice.id;
  const groupNames = new Map(board.groups.map((g) => [g.id, g.name]));

  const ranked = board.spaces
    .map((space, index) => ({
      index,
      space,
      count: res.landings[index],
      freq: res.totalLandings ? res.landings[index] / res.totalLandings : 0,
    }))
    .sort((a, b) => b.count - a.count || a.index - b.index);

  const top5 = ranked.slice(0, 5);
  const bottom5 = [...ranked].reverse().slice(0, 5);

  const groupRows = board.groups
    .map((g) => {
      const rent = res.rentByGroup[g.id] ?? 0;
      const paid = res.paidByGroup[g.id] ?? 0;
      const ratio = paid > 0 ? rent / paid : 0;
      return { name: g.name, rent, paid, ratio };
    })
    .sort((a, b) => b.ratio - a.ratio);

  lines.push('');
  lines.push(`## ${title} (\`${res.choice.id}\`, ${board.spaces.length} caselle)`);
  lines.push('');
  lines.push(`Partite concluse entro ${MAX_ROUNDS} giri: **${res.finished} su ${GAMES}** · Arrivi totali: **${res.totalLandings.toLocaleString('it-IT')}**.`);
  lines.push('');
  lines.push('### 5 caselle più visitate');
  for (const item of top5) {
    lines.push(`- **${item.space.name}** (${spaceLabel(item.space, groupNames)}): ${pct2(item.count, res.totalLandings)} (${item.count} arrivi)`);
  }
  lines.push('');
  lines.push('### 5 caselle meno visitate');
  for (const item of bottom5) {
    lines.push(`- **${item.space.name}** (${spaceLabel(item.space, groupNames)}): ${pct2(item.count, res.totalLandings)} (${item.count} arrivi)`);
  }
  lines.push('');
  lines.push('### Rendimento per quartiere');
  lines.push('');
  lines.push('| Quartiere | Affitto incassato (Ƒ) | Prezzo pagato vie + case (Ƒ) | Rendimento (affitto / prezzo) |');
  lines.push('| --- | ---: | ---: | ---: |');
  for (const g of groupRows) {
    lines.push(`| ${g.name} | ${g.rent.toLocaleString('it-IT')} | ${g.paid.toLocaleString('it-IT')} | ${g.ratio.toFixed(2)}× |`);
  }
  lines.push('');
  lines.push('### Tutte le caselle (ordinate per frequenza)');
  lines.push('');
  lines.push('| # | Casella | Tipo / Quartiere | Arrivi | Frequenza |');
  lines.push('| ---: | --- | --- | ---: | ---: |');
  for (const item of ranked) {
    lines.push(`| ${item.index} | ${item.space.name} | ${spaceLabel(item.space, groupNames)} | ${item.count} | ${pct2(item.count, res.totalLandings)} |`);
  }
}

lines.push('');
lines.push(`Scritto da \`npm run caselle\` (${elapsedSeconds} s).`);

const report = lines.join('\n') + '\n';
const outFile = process.argv[3] ?? 'docs/caselle.md';
writeFileSync(outFile, report);
console.log(report);

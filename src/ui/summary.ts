// Riepilogo di fine partita (classifica, premi, grafico) e classifica tra amici salvata nel browser.
// Le funzioni che calcolano non usano il DOM, così si possono provare con i test.
import { emptyStats, netWorth, type GameContext, type GameState, type PlayerStats } from '../engine';
import { board } from '../data';
import { playerColor } from './characters';
import { escapeHtml as esc } from './view';

const SYMBOL = board.currency.symbol;

function statsOf(state: GameState, id: number): PlayerStats {
  return state.stats?.[id] ?? emptyStats();
}

// Ordine finale: il vincitore, poi chi è rimasto in gioco per patrimonio, poi chi è fallito più tardi.
export function standings(state: GameState, ctx: GameContext): number[] {
  const worth = (id: number) => (state.players[id].bankrupt ? -1 : netWorth(state, ctx, id));
  return state.players
    .map((p) => p.id)
    .sort((a, b) => {
      if (a === state.winner) return -1;
      if (b === state.winner) return 1;
      const wa = worth(a);
      const wb = worth(b);
      if (wa !== wb) return wb - wa;
      return (statsOf(state, b).bankruptRound ?? 0) - (statsOf(state, a).bankruptRound ?? 0);
    });
}

export interface Award {
  emoji: string;
  title: string;
  playerId: number;
  detail: string;
}

// Premi simpatici: a chi ha fatto di più in ogni categoria (nessun premio se nessuno ha punti).
export function awards(state: GameState): Award[] {
  const defs: { emoji: string; title: string; value: (s: PlayerStats) => number; detail: (n: number) => string }[] = [
    { emoji: '💰', title: 'Re degli affitti', value: (s) => s.rentReceived, detail: (n) => `${SYMBOL} ${n} incassati` },
    { emoji: '🏗️', title: 'Costruttore', value: (s) => s.built, detail: (n) => `${n} ${n === 1 ? 'casa costruita' : 'case costruite'}` },
    { emoji: '🛒', title: 'Collezionista', value: (s) => s.bought, detail: (n) => `${n} ${n === 1 ? 'proprietà comprata' : 'proprietà comprate'}` },
    { emoji: '🤝', title: 'Gran mercante', value: (s) => s.trades, detail: (n) => `${n} ${n === 1 ? 'scambio' : 'scambi'}` },
    { emoji: '🎲', title: 'Mano fortunata', value: (s) => s.doubles, detail: (n) => `${n} doppi` },
    { emoji: '💸', title: 'Benefattore', value: (s) => s.rentPaid + s.taxesPaid, detail: (n) => `${SYMBOL} ${n} pagati in affitti e tasse` },
    { emoji: '🚓', title: 'Cliente della Caserma', value: (s) => s.jailVisits, detail: (n) => `${n} ${n === 1 ? 'volta' : 'volte'} in Caserma` },
  ];
  const result: Award[] = [];
  for (const d of defs) {
    let best = -1;
    let bestValue = 0;
    state.players.forEach((p) => {
      const v = d.value(statsOf(state, p.id));
      if (v > bestValue) {
        bestValue = v;
        best = p.id;
      }
    });
    if (best >= 0) result.push({ emoji: d.emoji, title: d.title, playerId: best, detail: d.detail(bestValue) });
  }
  return result;
}

// Grafico a linee del patrimonio giro per giro (SVG, si adatta alla larghezza).
function chartSvg(state: GameState): string {
  const h = state.history ?? [];
  if (h.length < 2) return '';
  const W = 300;
  const H = 140;
  const pad = 6;
  const max = Math.max(1, ...h.flat());
  const x = (i: number) => pad + (i / (h.length - 1)) * (W - pad * 2);
  const y = (v: number) => H - pad - (v / max) * (H - pad * 2);
  const lines = state.players
    .map((p) => {
      const pts = h.map((row, i) => `${x(i).toFixed(1)},${y(row[p.id] ?? 0).toFixed(1)}`).join(' ');
      return `<polyline points="${pts}" fill="none" stroke="${playerColor(p)}" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round" vector-effect="non-scaling-stroke"/>`;
    })
    .join('');
  return `<figure class="chart">
      <figcaption>Patrimonio giro per giro</figcaption>
      <svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" role="img" aria-label="Grafico del patrimonio dei giocatori in ${h.length - 1} giri">
        <line x1="${pad}" y1="${H - pad}" x2="${W - pad}" y2="${H - pad}" class="axis"/>
        ${lines}
      </svg>
      <div class="chart-scale"><span>inizio</span><span>massimo ${SYMBOL} ${max}</span><span>fine</span></div>
    </figure>`;
}

export function renderSummary(state: GameState, ctx: GameContext): string {
  const medals = ['🥇', '🥈', '🥉', '4°'];
  const order = standings(state, ctx);
  const rows = order
    .map((id, rank) => {
      const p = state.players[id];
      const st = statsOf(state, id);
      const what = p.bankrupt ? `bancarotta al giro ${st.bankruptRound ?? '?'}` : `patrimonio ${SYMBOL} ${netWorth(state, ctx, id)}`;
      return `<li><span class="medal">${medals[rank]}</span><span class="token" style="background:${playerColor(p)}"></span>
        <strong>${p.isBot ? '🤖 ' : ''}${esc(p.name)}</strong><span class="what">${what}</span></li>`;
    })
    .join('');
  const prizes = awards(state)
    .map((a) => `<li><span class="award-emoji">${a.emoji}</span><div><strong>${a.title}</strong>: ${esc(state.players[a.playerId].name)}<br><small>${a.detail}</small></div></li>`)
    .join('');
  return `<section class="summary">
      <h4>Classifica finale · ${state.round} ${state.round === 1 ? 'giro' : 'giri'}</h4>
      <ol class="standings">${rows}</ol>
      ${chartSvg(state)}
      ${prizes ? `<h4>Premi</h4><ul class="awards">${prizes}</ul>` : ''}
    </section>`;
}

// ---------- classifica tra amici ----------

export interface LeaderEntry {
  name: string;
  isBot: boolean;
  played: number;
  wins: number;
  // miglior patrimonio a fine partita
  best: number;
}

// Aggiunge il risultato di una partita finita alla classifica (restituisce una nuova lista).
export function addResult(entries: LeaderEntry[], state: GameState, ctx: GameContext): LeaderEntry[] {
  const next = entries.map((e) => ({ ...e }));
  for (const p of state.players) {
    const key = p.name.trim().toLowerCase();
    let e = next.find((x) => x.name.trim().toLowerCase() === key && x.isBot === p.isBot);
    if (!e) {
      e = { name: p.name.trim(), isBot: p.isBot, played: 0, wins: 0, best: 0 };
      next.push(e);
    }
    e.played++;
    if (p.id === state.winner) e.wins++;
    if (!p.bankrupt) e.best = Math.max(e.best, netWorth(state, ctx, p.id));
  }
  return sortLeaderboard(next);
}

export function sortLeaderboard(entries: LeaderEntry[]): LeaderEntry[] {
  return [...entries].sort((a, b) => b.wins - a.wins || b.wins / b.played - a.wins / a.played || b.best - a.best);
}

export function renderLeaderboard(entries: LeaderEntry[]): string {
  if (!entries.length) return '';
  const rows = entries
    .slice(0, 10)
    .map(
      (e, i) => `<tr><td>${i + 1}</td><td>${e.isBot ? '🤖 ' : ''}${esc(e.name)}</td><td>${e.wins}</td><td>${e.played}</td><td>${SYMBOL} ${e.best}</td></tr>`,
    )
    .join('');
  return `<details class="leaderboard">
      <summary>🏆 Classifica tra amici</summary>
      <table>
        <thead><tr><th>#</th><th>Nome</th><th>Vittorie</th><th>Partite</th><th>Record</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
      <button type="button" class="link" data-reset-leaderboard>Azzera la classifica</button>
    </details>`;
}

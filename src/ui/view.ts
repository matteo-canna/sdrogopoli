// Funzioni di rendering: trasformano lo stato del motore in HTML.
import { board, cards } from '../data';
import { computeRent, netWorth, unmortgageCost, type GameState, type Space } from '../engine';

export const PLAYER_COLORS = ['#e4572e', '#2e86de', '#f4b400', '#8e44ad'];
const SYMBOL = board.currency.symbol;

export function money(n: number): string {
  return `${SYMBOL} ${n}`;
}

export function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
}

// Posizione di ogni casella nella griglia 11x11: la Partenza è in basso a destra
// e il percorso gira in senso orario (verso sinistra, poi su, poi a destra, poi giù).
export function gridPosition(index: number): { row: number; col: number } {
  if (index <= 10) return { row: 11, col: 11 - index };
  if (index <= 20) return { row: 11 - (index - 10), col: 1 };
  if (index <= 30) return { row: 1, col: 1 + (index - 20) };
  return { row: 1 + (index - 30), col: 11 };
}

function side(index: number): string {
  if (index % 10 === 0) return 'corner';
  if (index < 10) return 'bottom';
  if (index < 20) return 'left';
  if (index < 30) return 'top';
  return 'right';
}

const ICONS: Partial<Record<Space['type'], string>> = {
  start: '🏁',
  station: '🚋',
  utility: '💡',
  tax: '💸',
  card: '❓',
  jail: '🚓',
  free: '🪑',
  goToJail: '👮',
};

function groupColor(space: Space): string | null {
  if (space.type !== 'property') return null;
  return board.groups.find((g) => g.id === space.group)?.color ?? null;
}

export function renderBoard(state: GameState, selected: string | null): string {
  const cells = board.spaces.map((space, i) => {
    const { row, col } = gridPosition(i);
    const own = state.ownership[space.id];
    const color = groupColor(space);
    const tokens = state.players
      .filter((p) => !p.bankrupt && p.position === i)
      .map((p) => `<span class="token" style="background:${PLAYER_COLORS[p.id]}" title="${escapeHtml(p.name)}"></span>`)
      .join('');
    const houses = own && own.houses > 0 ? `<span class="houses">${own.houses === 5 ? '🏢' : '🏠'.repeat(own.houses)}</span>` : '';
    const owner = own ? `<span class="owner" style="background:${PLAYER_COLORS[own.owner]}"></span>` : '';
    const price = 'price' in space ? `<span class="price">${space.price}</span>` : '';
    const icon = ICONS[space.type] ? `<span class="icon">${ICONS[space.type]}</span>` : '';
    return `
      <button class="space ${side(i)} ${selected === space.id ? 'selected' : ''} ${own?.mortgaged ? 'mortgaged' : ''}"
        style="grid-row:${row};grid-column:${col}" data-space="${space.id}" aria-label="${escapeHtml(space.name)}">
        ${color ? `<span class="band" style="background:${color}"></span>` : ''}
        ${owner}
        ${icon}
        <span class="name">${escapeHtml(space.name)}</span>
        ${price}${houses}
        <span class="tokens">${tokens}</span>
      </button>`;
  });
  return cells.join('');
}

// Scheda della casella selezionata, con i comandi per il giocatore di turno.
export function renderSpaceDetails(state: GameState, spaceId: string): string {
  const space = board.spaces.find((s) => s.id === spaceId)!;
  const own = state.ownership[space.id];
  const lines: string[] = [];
  if (space.type === 'property') {
    const labels = ['Terreno', '1 casa', '2 case', '3 case', '4 case', 'Palazzo'];
    lines.push(`<p>Prezzo ${money(space.price)} · Casa ${money(space.housePrice)}</p>`);
    lines.push(`<table class="rents">${space.rent.map((r, i) => `<tr class="${own && own.houses === i ? 'now' : ''}"><td>${labels[i]}</td><td>${money(r)}</td></tr>`).join('')}</table>`);
  } else if (space.type === 'station') {
    lines.push(`<p>Prezzo ${money(space.price)}</p><p>Affitto con 1-4 fermate: ${space.rent.map(money).join(' / ')}</p>`);
  } else if (space.type === 'utility') {
    lines.push(`<p>Prezzo ${money(space.price)}</p><p>Affitto: ${space.diceMultiplier[0]}× i dadi con 1 servizio, ${space.diceMultiplier[1]}× con 2</p>`);
  } else if (space.type === 'tax') {
    lines.push(`<p>Si pagano ${money(space.amount)} alla banca.</p>`);
  } else if (space.type === 'start') {
    lines.push(`<p>Passando di qui si incassano ${money(space.salary)}.</p>`);
  }
  if (own) {
    const ownerName = escapeHtml(state.players[own.owner].name);
    const rent = computeRent(state, { board, cards, rng: Math.random }, space.id, 7);
    lines.push(`<p>Proprietario: <strong>${ownerName}</strong>${own.mortgaged ? ' (ipotecata)' : ''}</p>`);
    if (space.type !== 'utility') lines.push(`<p>Affitto attuale: ${money(rent)}</p>`);
  }

  const buttons: string[] = [];
  const canManage = own && own.owner === state.current && state.phase !== 'gameOver';
  if (canManage && 'mortgage' in space) {
    if (space.type === 'property' && !own.mortgaged) {
      buttons.push(`<button data-action="build" data-space="${space.id}">Costruisci (${money(space.housePrice)})</button>`);
      if (own.houses > 0) buttons.push(`<button data-action="sell" data-space="${space.id}">Vendi casa (+${money(space.housePrice / 2)})</button>`);
    }
    if (!own.mortgaged) buttons.push(`<button data-action="mortgage" data-space="${space.id}">Ipoteca (+${money(space.mortgage)})</button>`);
    else buttons.push(`<button data-action="unmortgage" data-space="${space.id}">Riscatta (${money(unmortgageCost(space.mortgage))})</button>`);
  }

  return `
    <div class="details">
      <h3>${groupColor(space) ? `<span class="dot" style="background:${groupColor(space)}"></span>` : ''}${escapeHtml(space.name)}</h3>
      ${lines.join('')}
      ${buttons.length ? `<div class="actions">${buttons.join('')}</div>` : ''}
    </div>`;
}

export function renderPlayers(state: GameState): string {
  const ctx = { board, cards, rng: Math.random };
  return state.players
    .map((p) => {
      const owned = Object.entries(state.ownership)
        .filter(([, o]) => o.owner === p.id)
        .map(([id, o]) => {
          const s = board.spaces.find((sp) => sp.id === id)!;
          const c = groupColor(s) ?? '#999';
          return `<button class="chip ${o.mortgaged ? 'mortgaged' : ''}" data-space="${id}" style="border-color:${c}">${escapeHtml(s.name)}${o.houses ? ` ${o.houses === 5 ? '🏢' : '🏠×' + o.houses}` : ''}</button>`;
        })
        .join('');
      const active = p.id === state.current && state.phase !== 'gameOver';
      const where = p.bankrupt ? 'In bancarotta' : p.inJail ? '🚓 In Caserma' : `📍 ${escapeHtml(board.spaces[p.position].name)}`;
      return `
        <div class="player ${active ? 'active' : ''} ${p.bankrupt ? 'out' : ''}">
          <div class="player-head">
            <span class="token big" style="background:${PLAYER_COLORS[p.id]}"></span>
            <strong>${p.isBot ? '🤖 ' : ''}${escapeHtml(p.name)}</strong>
            ${active ? '<span class="badge">di turno</span>' : ''}
            <span class="money ${p.money < 0 ? 'negative' : ''}" title="Contanti">${money(p.money)}</span>
          </div>
          <div class="player-meta">
            <span>${where}</span>
            ${p.bankrupt ? '' : `<span title="Contanti + proprietà + case">Patrimonio ${money(netWorth(state, ctx, p.id))}</span>`}
          </div>
          ${p.jailCards.length ? `<div class="status">🎟️ ${p.jailCards.length} carta esci gratis</div>` : ''}
          ${owned ? `<div class="chips">${owned}</div>` : ''}
        </div>`;
    })
    .join('');
}

// Pulsanti delle azioni disponibili nella fase corrente.
export function renderTurnActions(state: GameState): string {
  if (state.phase === 'gameOver') {
    return `<p class="winner">🏆 ${escapeHtml(state.players[state.winner!].name)} vince!</p>
      <button data-action="newGame">Nuova partita</button>`;
  }
  const p = state.players[state.current];
  if (p.isBot) return `<p class="hint">🤖 ${escapeHtml(p.name)} sta pensando…</p>`;
  const b: string[] = [];
  if (state.phase === 'roll') {
    if (p.inJail) {
      b.push(`<button data-action="payJailFine" ${p.money < 50 ? 'disabled' : ''}>Paga ${money(50)} ed esci</button>`);
      if (p.jailCards.length) b.push(`<button data-action="useJailCard">Usa carta esci gratis</button>`);
      b.push(`<button class="primary" data-action="roll">Tenta il doppio</button>`);
    } else {
      b.push(`<button class="primary" data-action="roll">${state.extraRoll ? 'Doppio! Rilancia' : 'Lancia i dadi'}</button>`);
    }
  } else if (state.phase === 'buy') {
    const space = board.spaces[p.position];
    const price = 'price' in space ? space.price : 0;
    b.push(`<button class="primary" data-action="buy" ${p.money < price ? 'disabled' : ''}>Compra ${escapeHtml(space.name)} (${money(price)})</button>`);
    b.push(`<button data-action="decline">Non comprare</button>`);
  } else if (state.phase === 'endTurn') {
    if (p.money < 0) {
      b.push(`<p class="warning">Sei in debito di ${money(-p.money)}: vendi case o ipoteca (tocca le tue proprietà), oppure dichiara bancarotta.</p>`);
      b.push(`<button class="danger" data-action="bankrupt">Bancarotta</button>`);
    } else {
      b.push(`<button class="primary" data-action="endTurn">Fine turno</button>`);
    }
  }
  return b.join('');
}

const DIE = ['', '⚀', '⚁', '⚂', '⚃', '⚄', '⚅'];
export function renderDice(state: GameState): string {
  if (!state.lastRoll) return '';
  return `<span class="dice">${DIE[state.lastRoll[0]]}${DIE[state.lastRoll[1]]}</span>`;
}

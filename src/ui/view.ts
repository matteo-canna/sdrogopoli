// Funzioni di rendering: trasformano lo stato del motore in HTML.
import { board, cards } from '../data';
import { actingPlayer, computeRent, debtOptions, liquidationValue, MIN_BID, netWorth, unmortgageCost, type GameState, type Space, type TradeSide } from '../engine';
import { playerColor } from './characters';

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
      .map((p) => `<span class="token" style="background:${playerColor(p)}" title="${escapeHtml(p.name)}"></span>`)
      .join('');
    const houses = own && own.houses > 0 ? `<span class="houses">${own.houses === 5 ? '🏢' : '🏠'.repeat(own.houses)}</span>` : '';
    const owner = own ? `<span class="owner" style="background:${playerColor(state.players[own.owner])}"></span>` : '';
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
        <span class="tokens ${state.players.length > 8 ? 'many' : ''}">${tokens}</span>
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
      // proprietà nell'ordine del tabellone, così i quartieri restano vicini
      const owned = board.spaces
        .filter((sp) => state.ownership[sp.id]?.owner === p.id)
        .map((s) => {
          const o = state.ownership[s.id];
          const c = groupColor(s) ?? '#8a948d';
          const label = `${s.name}${o.mortgaged ? ' (ipotecata)' : ''}${o.houses ? `, ${o.houses === 5 ? 'palazzo' : o.houses === 1 ? '1 casa' : `${o.houses} case`}` : ''}`;
          return `<button class="chip ${o.mortgaged ? 'mortgaged' : ''}" data-space="${s.id}" style="--g:${c}" aria-label="${escapeHtml(label)}">${escapeHtml(s.name)}${o.houses ? ` <span class="chip-houses">${o.houses === 5 ? '🏢' : '🏠' + o.houses}</span>` : ''}</button>`;
        })
        .join('');
      const active = p.id === state.current && state.phase !== 'gameOver';
      const where = p.bankrupt ? 'In bancarotta' : p.inJail ? '🚓 In Caserma' : `📍 ${escapeHtml(board.spaces[p.position].name)}`;
      return `
        <div class="player ${active ? 'active' : ''} ${p.bankrupt ? 'out' : ''}" style="--c:${playerColor(p)}">
          <div class="player-head">
            <span class="token big" style="background:${playerColor(p)}"></span>
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
  const p = state.players[actingPlayer(state)];
  const banner = state.trade ? renderTradeOffer(state) : state.phase === 'auction' ? renderAuction(state) : '';
  if (p.isBot) return `${banner}<p class="hint">🤖 ${escapeHtml(p.name)} sta pensando…</p>`;
  const b: string[] = [banner];
  if (state.trade) {
    b.push(`<button class="primary" data-action="acceptTrade">Accetta</button>`);
    b.push(`<button data-action="rejectTrade">Rifiuta</button>`);
    return b.join('');
  }
  if (state.phase === 'auction') {
    const a = state.auction!;
    const base = Math.max(MIN_BID, a.highestBid);
    for (const step of a.highestBid === 0 ? [0, 40, 90] : [10, 50, 100]) {
      const amount = base + step;
      b.push(`<button class="${step === (a.highestBid === 0 ? 0 : 10) ? 'primary' : ''}" data-action="bid" data-amount="${amount}" ${amount > p.money ? 'disabled' : ''}>Offri ${money(amount)}</button>`);
    }
    b.push(`<button data-action="pass">Passa</button>`);
    return b.join('');
  }
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
    b.push(`<button data-action="decline">Lascia all'asta</button>`);
  } else if (state.phase === 'endTurn') {
    if (p.money < 0) {
      b.push(renderDebt(state, p.id));
    } else {
      b.push(`<button class="primary" data-action="endTurn">Fine turno</button>`);
    }
  }
  if ((state.phase === 'roll' || state.phase === 'endTurn') && state.players.some((o) => o.id !== p.id && !o.bankrupt)) {
    b.push(`<button data-action="openTrade">🤝 Proponi scambio</button>`);
  }
  return b.join('');
}

const DIE = ['', '⚀', '⚁', '⚂', '⚃', '⚄', '⚅'];
export function renderDice(state: GameState): string {
  if (!state.lastRoll) return '';
  return `<span class="dice">${DIE[state.lastRoll[0]]}${DIE[state.lastRoll[1]]}</span>`;
}

function spaceNames(ids: string[]): string {
  return ids.map((id) => escapeHtml(board.spaces.find((s) => s.id === id)!.name)).join(', ');
}

function sideText(side: TradeSide): string {
  const parts = [];
  if (side.money) parts.push(money(side.money));
  if (side.spaces.length) parts.push(spaceNames(side.spaces));
  return parts.join(' + ') || 'niente';
}

function renderTradeOffer(state: GameState): string {
  const t = state.trade!;
  const from = escapeHtml(state.players[t.from].name);
  const to = escapeHtml(state.players[t.to].name);
  return `<div class="offer">
    <h4>🤝 ${from} propone uno scambio a ${to}</h4>
    <p><strong>${from} dà:</strong> ${sideText(t.give)}</p>
    <p><strong>${from} chiede:</strong> ${sideText(t.get)}</p>
  </div>`;
}

// Pannello del debito: quanto manca, cosa si può vendere o ipotecare e quanto rende.
// La bancarotta compare solo quando nemmeno vendendo tutto si arriva a coprire il debito.
function renderDebt(state: GameState, playerId: number): string {
  const ctx = { board, cards, rng: Math.random };
  const debt = -state.players[playerId].money;
  const available = liquidationValue(state, ctx, playerId);
  const creditor = state.creditor === null ? 'alla banca' : `a ${escapeHtml(state.players[state.creditor].name)}`;
  if (available < debt) {
    return `<div class="debt-panel">
      <p class="warning">Devi ${money(debt)} ${creditor}.</p>
      <p>Anche vendendo tutte le case e ipotecando tutto arriveresti a ${money(available)}: non basta.</p>
      <button class="danger" data-action="bankrupt">Dichiara bancarotta</button>
    </div>`;
  }
  const options = debtOptions(state, ctx, playerId)
    .map(({ action, gain }) => {
      const id = 'spaceId' in action ? action.spaceId : '';
      const name = escapeHtml(board.spaces.find((s) => s.id === id)?.name ?? '');
      const label = action.type === 'sell' ? `Vendi una casa su ${name}` : `Ipoteca ${name}`;
      return `<li><button data-action="${action.type}" data-space="${id}">${label} <strong>+${money(gain)}</strong></button></li>`;
    })
    .join('');
  return `<div class="debt-panel">
    <p class="warning">Devi ${money(debt)} ${creditor}.</p>
    <p>Puoi ricavare fino a ${money(available)}. Scegli tu cosa vendere o ipotecare, oppure lascia fare al gioco.</p>
    <button class="primary" data-action="coverDebt">Copri il debito automaticamente</button>
    <ul class="debt-options">${options}</ul>
  </div>`;
}

function renderAuction(state: GameState): string {
  const a = state.auction!;
  const space = board.spaces.find((s) => s.id === a.spaceId)!;
  const leader = a.highestBidder === null ? 'nessuna offerta' : `${money(a.highestBid)} di ${escapeHtml(state.players[a.highestBidder].name)}`;
  const turn = escapeHtml(state.players[a.bidders[a.turn]].name);
  return `<div class="offer">
    <h4>🔨 Asta: ${escapeHtml(space.name)} ${'price' in space ? `(valore ${money(space.price)})` : ''}</h4>
    <p>Offerta più alta: <strong>${leader}</strong></p>
    <p>Tocca a <strong>${turn}</strong> · in gara: ${a.bidders.map((id) => escapeHtml(state.players[id].name)).join(', ')}</p>
  </div>`;
}

// Modulo per preparare uno scambio: si scelgono il giocatore, le caselle e i soldi.
export interface TradeDraft {
  to: number;
  give: TradeSide;
  get: TradeSide;
}

function tradeableSpaces(state: GameState, owner: number): string[] {
  return Object.entries(state.ownership)
    .filter(([id, o]) => {
      if (o.owner !== owner) return false;
      const sp = board.spaces.find((s) => s.id === id)!;
      if (sp.type !== 'property') return true;
      return board.spaces.every((g) => g.type !== 'property' || g.group !== sp.group || (state.ownership[g.id]?.houses ?? 0) === 0);
    })
    .map(([id]) => id);
}

export function renderTradeEditor(state: GameState, d: TradeDraft): string {
  const me = state.players[state.current];
  const others = state.players.filter((o) => o.id !== me.id && !o.bankrupt);
  const list = (owner: number, side: 'give' | 'get') => {
    const ids = tradeableSpaces(state, owner);
    if (!ids.length) return '<p class="hint">Nessuna casella scambiabile.</p>';
    const chosen = side === 'give' ? d.give.spaces : d.get.spaces;
    return ids
      .map((id) => {
        const sp = board.spaces.find((s) => s.id === id)!;
        const c = groupColor(sp) ?? '#999';
        return `<label class="pick"><input type="checkbox" data-trade="${side}-space" value="${id}" ${chosen.includes(id) ? 'checked' : ''}>
          <span class="dot" style="background:${c}"></span>${escapeHtml(sp.name)}${state.ownership[id].mortgaged ? ' (ipotecata)' : ''}</label>`;
      })
      .join('');
  };
  const other = state.players[d.to];
  return `<form class="trade-editor" id="trade-form">
    <h4>🤝 Proponi uno scambio</h4>
    <label class="row">Con
      <select data-trade="to">${others.map((o) => `<option value="${o.id}" ${o.id === d.to ? 'selected' : ''}>${o.isBot ? '🤖 ' : ''}${escapeHtml(o.name)}</option>`).join('')}</select>
    </label>
    <div class="trade-cols">
      <fieldset><legend>Tu dai</legend>
        ${list(me.id, 'give')}
        <label class="row">Soldi <input type="number" inputmode="numeric" min="0" max="${Math.max(me.money, 0)}" step="10" value="${d.give.money}" data-trade="give-money"></label>
      </fieldset>
      <fieldset><legend>Chiedi a ${escapeHtml(other.name)}</legend>
        ${list(other.id, 'get')}
        <label class="row">Soldi <input type="number" inputmode="numeric" min="0" max="${Math.max(other.money, 0)}" step="10" value="${d.get.money}" data-trade="get-money"></label>
      </fieldset>
    </div>
    <div class="actions">
      <button class="primary" type="submit">Proponi</button>
      <button type="button" data-action="closeTrade">Annulla</button>
    </div>
  </form>`;
}

// Funzioni di rendering: trasformano lo stato del motore in HTML.
import { board, cards } from '../data';
import { actingPlayer, BOT_LEVELS, MAX_COUNTERS, tradeCompletions, BOT_STYLES, computeRent, debtOptions, liquidationValue, MIN_BID, netWorth, unmortgageCost, type BotProfile, type GameState, type Space, type TradeSide } from '../engine';
import { inkOn, playerColor, playerMarks } from './characters';
import { deckName, cardOption, cardText, spaceName, t, text, tn, type MsgKey } from '../i18n';

// Dischetto con il colore e la sigla del giocatore (la sigla lo distingue anche senza colori).
export function playerBadge(state: GameState, playerId: number, cls = 'token big'): string {
  const p = state.players[playerId];
  const c = playerColor(p);
  const mark = playerMarks(state.players)[playerId];
  return `<span class="${cls} mark" style="background:${c};color:${inkOn(c)}" aria-hidden="true">${escapeHtml(mark)}</span>`;
}


export function money(n: number): string {
  return `${board.currency.symbol} ${n}`;
}

export function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
}

// Caselle per lato e lato della griglia: un tabellone di 40 caselle ha 10 caselle per lato
// e una griglia 11x11 (gli angoli sono in comune tra due lati).
export function perSide(spaces = board.spaces.length): number {
  return Math.max(1, Math.round(spaces / 4));
}

export function gridSide(spaces = board.spaces.length): number {
  return perSide(spaces) + 1;
}

// Posizione di ogni casella nella griglia: la Partenza è in basso a destra
// e il percorso gira in senso orario (verso sinistra, poi su, poi a destra, poi giù).
export function gridPosition(index: number, spaces = board.spaces.length): { row: number; col: number } {
  const n = perSide(spaces);
  const g = n + 1;
  if (index <= n) return { row: g, col: g - index };
  if (index <= 2 * n) return { row: g - (index - n), col: 1 };
  if (index <= 3 * n) return { row: 1, col: 1 + (index - 2 * n) };
  return { row: 1 + (index - 3 * n), col: g };
}

export function side(index: number, spaces = board.spaces.length): string {
  const n = perSide(spaces);
  if (index % n === 0) return 'corner';
  if (index < n) return 'bottom';
  if (index < 2 * n) return 'left';
  if (index < 3 * n) return 'top';
  return 'right';
}

// Griglia e centro del tabellone: dipendono da quante caselle ha, quindi si scrivono qui
// (il CSS non sa quanto è lungo il tabellone). --cells serve per la misura delle caselle.
export function boardStyle(spaces = board.spaces.length): string {
  const g = gridSide(spaces);
  const track = `1.6fr repeat(${g - 2}, 1fr) 1.6fr`;
  return `--cells:${g};grid-template-columns:${track};grid-template-rows:${track}`;
}

export function centerStyle(spaces = board.spaces.length): string {
  const g = gridSide(spaces);
  return `grid-row:2 / ${g};grid-column:2 / ${g}`;
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

// Case e palazzo come piccoli segni dentro la fascia colorata, come sul tabellone vero.
function housePips(houses: number): string {
  if (houses <= 0) return '';
  const pips = houses === 5 ? '<i class="hotel"></i>' : '<i class="house"></i>'.repeat(houses);
  return `<span class="pips" aria-hidden="true">${pips}</span>`;
}

// Descrizione a voce di una casella: nome, proprietario, case e chi c'è sopra.
export function spaceLabel(state: GameState, i: number): string {
  const space = board.spaces[i];
  const own = state.ownership[space.id];
  const here = state.players.filter((p) => !p.bankrupt && p.position === i);
  return [
    spaceName(space.id),
    'price' in space && !own ? t('space.forSale', { amount: space.price }) : '',
    own ? t('space.ownedBy', { name: state.players[own.owner].name }) : '',
    own?.mortgaged ? t('space.mortgaged') : '',
    own && own.houses ? housesText(own.houses) : '',
    here.length ? t('space.here', { names: here.map((p) => p.name).join(', ') }) : '',
  ].filter(Boolean).join(', ');
}

// "palazzo", "1 casa", "3 case"
export function housesText(houses: number): string {
  return houses === 5 ? t('space.hotel') : tn('space.houses', houses);
}

// Tabellone e centro insieme, con le misure della griglia giuste per la sua lunghezza.
export function renderBoardBox(state: GameState, selected: string | null): string {
  return `<div class="board" style="${boardStyle()}">${renderBoard(state, selected)}<div class="center" style="${centerStyle()}">${renderTable(state)}</div></div>`;
}

// Il tabellone è un solo punto di sosta per il tasto Tab: le frecce scorrono le caselle
// (tabindex "mobile": vale 0 solo per la casella selezionata o, senza selezione, per quella di chi gioca).
export function renderBoard(state: GameState, selected: string | null): string {
  const stop = selected ?? board.spaces[state.players[state.current]?.position ?? 0]?.id;
  const marks = playerMarks(state.players);
  const cells = board.spaces.map((space, i) => {
    const { row, col } = gridPosition(i);
    const own = state.ownership[space.id];
    const color = groupColor(space);
    const here = state.players.filter((p) => !p.bankrupt && p.position === i);
    // pedine grandi con la sigla; quella di chi è di turno ha un anello
    const tokens = here
      .map((p) => {
        const c = playerColor(p);
        return `<span class="pawn ${p.id === state.current && state.phase !== 'gameOver' ? 'now' : ''}" style="background:${c};color:${inkOn(c)}" title="${escapeHtml(p.name)}">${escapeHtml(marks[p.id])}</span>`;
      })
      .join('');
    const owner = own ? playerBadge(state, own.owner, 'owner') : '';
    const ownColor = own ? playerColor(state.players[own.owner]) : '';
    const price = 'price' in space && !own && !here.length ? `<span class="price">${space.price}</span>` : '';
    const icon = ICONS[space.type] ? `<span class="icon">${ICONS[space.type]}</span>` : '';
    const label = spaceLabel(state, i);
    return `
      <button class="space ${side(i)} ${own ? 'owned' : ''} ${selected === space.id ? 'selected' : ''} ${own?.mortgaged ? 'mortgaged' : ''}"
        style="grid-row:${row};grid-column:${col}${own ? `;--own:${ownColor}` : ''}" data-space="${space.id}" tabindex="${space.id === stop ? 0 : -1}" aria-label="${escapeHtml(label)}">
        ${color ? `<span class="band" style="background:${color}">${housePips(own?.houses ?? 0)}</span>` : ''}
        ${owner}
        ${icon}
        <span class="name">${escapeHtml(spaceName(space.id))}</span>
        ${price}
        <span class="pawns ${here.length > 3 ? 'crowd' : ''}">${tokens}</span>
      </button>`;
  });
  return cells.join('');
}

// Evento del quartiere e andamento del mercato, quando le regole facoltative sono attive.
export function renderEvents(state: GameState): string {
  const rows: string[] = [];
  if (state.event) {
    rows.push(`<li class="ev ev-${state.event.id}">${t(`event.${state.event.id}` as MsgKey, { group: state.event.group })}</li>`);
  }
  if (state.market) {
    rows.push(`<li class="ev ev-${state.market.id}">${t(`market.${state.market.id}` as MsgKey)} <small>${t('market.until', { n: state.market.until })}</small></li>`);
  }
  return rows.length ? `<ul class="events" aria-label="${t('event.now')}">${rows.join('')}</ul>` : '';
}

// Il centro del tavolo: di chi è il turno, gli ultimi dadi e le ultime mosse.
export function renderTable(state: GameState): string {
  const p = state.players[state.current];
  const last = state.log.slice(-3).reverse();
  return `
    <h1 class="title">Sdrogopoli</h1>
    ${renderEvents(state)}
    ${state.phase === 'gameOver' ? '' : `<p class="table-turn">${playerBadge(state, p.id)} <span>${t('turn.of', { name: `<strong>${escapeHtml(p.name)}</strong>` })}</span></p>`}
    ${state.lastRoll ? `<span class="center-dice">${renderDice(state)}</span>` : ''}
    ${last.length ? `<ol class="table-log" aria-label="${t('table.lastMoves')}">${last.map((l) => `<li>${escapeHtml(text(l))}</li>`).join('')}</ol>` : ''}`;
}

// Quante vie del quartiere ha chi è di turno, e se comprando questa lo completerebbe.
function groupNote(state: GameState, group: string, spaceId: string): string {
  const me = state.current;
  const streets = board.spaces.filter((sp) => sp.type === 'property' && sp.group === group);
  const mine = streets.filter((sp) => state.ownership[sp.id]?.owner === me).length;
  const own = state.ownership[spaceId];
  if (!own && mine === streets.length - 1) return `<p class="group-note good">⭐ ${t('group.wouldComplete')}</p>`;
  if (own && own.owner !== me && streets.every((sp) => state.ownership[sp.id]?.owner === own.owner)) {
    return `<p class="group-note">${t('group.completeOf', { name: escapeHtml(state.players[own.owner].name) })}</p>`;
  }
  if (mine > 0) return `<p class="group-note">${t('group.youHave', { n: mine, total: streets.length })}</p>`;
  return '';
}

// Carta della casella selezionata, che compare sopra il tabellone.
export function renderSpaceCard(state: GameState, spaceId: string): string {
  const space = board.spaces.find((s) => s.id === spaceId);
  if (!space) return '';
  return `<div class="space-card" role="dialog" aria-label="${escapeHtml(spaceName(space.id))}">
    <button class="card-close" data-action="closeCard" aria-label="${t('card.close')}">✕</button>
    ${renderSpaceDetails(state, spaceId)}
  </div>`;
}

// Scheda della casella selezionata, con i comandi per il giocatore di turno.
export function renderSpaceDetails(state: GameState, spaceId: string): string {
  const space = board.spaces.find((s) => s.id === spaceId)!;
  const own = state.ownership[space.id];
  const lines: string[] = [];
  if (space.type === 'property') {
    const labels = [t('space.land'), ...[1, 2, 3, 4].map((n) => tn('space.houses', n)), t('space.hotelCap')];
    lines.push(`<p>${t('space.priceHouse', { price: money(space.price), house: money(space.housePrice) })}</p>`);
    lines.push(`<table class="rents">${space.rent.map((r, i) => `<tr class="${own && own.houses === i ? 'now' : ''}"><td>${labels[i]}</td><td>${money(r)}</td></tr>`).join('')}</table>`);
  } else if (space.type === 'station') {
    // si mostrano solo le fermate che esistono su questo tabellone
    const stops = board.spaces.filter((sp) => sp.type === 'station').length;
    lines.push(`<p>${t('space.price', { price: money(space.price) })}</p><p>${t('space.stationRent', { n: stops, rents: space.rent.slice(0, stops).map(money).join(' / ') })}</p>`);
  } else if (space.type === 'utility') {
    lines.push(`<p>${t('space.price', { price: money(space.price) })}</p><p>${t('space.utilityRent', { a: space.diceMultiplier[0], b: space.diceMultiplier[1] })}</p>`);
  } else if (space.type === 'tax') {
    lines.push(`<p>${t('space.taxText', { amount: money(space.amount) })}</p>`);
  } else if (space.type === 'start') {
    lines.push(`<p>${t('space.startText', { amount: money(space.salary) })}</p>`);
  }
  if (own) {
    const ownerName = escapeHtml(state.players[own.owner].name);
    const rent = computeRent(state, { board, cards }, space.id, 7);
    lines.push(`<p class="owner-line">${t('space.owner')} ${playerBadge(state, own.owner, 'token')} <strong>${ownerName}</strong>${own.mortgaged ? ` (${t('space.mortgaged')})` : ''}</p>`);
    if (space.type !== 'utility') lines.push(`<p>${t('space.rentNow', { amount: money(rent) })}</p>`);
  }
  if (space.type === 'property' && state.phase !== 'gameOver') lines.push(groupNote(state, space.group, space.id));

  const buttons: string[] = [];
  const canManage = own && own.owner === state.current && state.phase !== 'gameOver';
  if (canManage && 'mortgage' in space) {
    if (space.type === 'property' && !own.mortgaged) {
      buttons.push(`<button data-action="build" data-space="${space.id}">${t('btn.build', { amount: money(space.housePrice) })}</button>`);
      if (own.houses > 0) buttons.push(`<button data-action="sell" data-space="${space.id}">${t('btn.sellHouse', { amount: money(space.housePrice / 2) })}</button>`);
    }
    if (!own.mortgaged) buttons.push(`<button data-action="mortgage" data-space="${space.id}">${t('btn.mortgage', { amount: money(space.mortgage) })}</button>`);
    else buttons.push(`<button data-action="unmortgage" data-space="${space.id}">${t('btn.unmortgage', { amount: money(unmortgageCost(space.mortgage)) })}</button>`);
  }

  return `
    <div class="details">
      <h3>${groupColor(space) ? `<span class="dot" style="background:${groupColor(space)}"></span>` : ''}${escapeHtml(spaceName(space.id))}</h3>
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
          const label = `${spaceName(s.id)}${o.mortgaged ? ` (${t('space.mortgaged')})` : ''}${o.houses ? `, ${housesText(o.houses)}` : ''}`;
          return `<button class="chip ${o.mortgaged ? 'mortgaged' : ''}" data-space="${s.id}" style="--g:${c}" aria-label="${escapeHtml(label)}">${escapeHtml(spaceName(s.id))}${o.houses ? ` <span class="chip-houses">${o.houses === 5 ? '🏢' : '🏠' + o.houses}</span>` : ''}</button>`;
        })
        .join('');
      const active = p.id === state.current && state.phase !== 'gameOver';
      const where = p.bankrupt ? t('player.bankrupt') : p.inJail ? `🚓 ${t('player.inJail')}` : `📍 ${escapeHtml(spaceName(board.spaces[p.position].id))}`;
      return `
        <div class="player ${active ? 'active' : ''} ${p.bankrupt ? 'out' : ''}" data-seat="${p.id}" style="--c:${playerColor(p)}">
          <div class="player-head">
            ${playerBadge(state, p.id)}
            <strong>${p.isBot ? '🤖 ' : ''}${escapeHtml(p.name)}</strong>
            ${active ? `<span class="badge">${t('player.onTurn')}</span>` : ''}
            ${p.team !== undefined ? `<span class="badge team">${t('team.label', { n: p.team + 1 })}</span>` : ''}
            <span class="money ${p.money < 0 ? 'negative' : ''}" title="${t('player.cash')}">${money(p.money)}</span>
          </div>
          <div class="player-meta">
            <span>${where}</span>
            ${p.bot ? `<span class="bot-kind" title="${escapeHtml(botStyleText(p.bot.style))}">🤖 ${escapeHtml(botLabel(p.bot))}</span>` : ''}
            ${p.bankrupt ? '' : `<span title="${t('player.worthHint')}">${t('player.worth', { amount: money(netWorth(state, ctx, p.id)) })}</span>`}
          </div>
          ${p.jailCards.length ? `<div class="status">🎟️ ${tn('player.jailCards', p.jailCards.length)}</div>` : ''}
          ${owned ? `<div class="chips">${owned}</div>` : ''}
        </div>`;
    })
    .join('');
}

// Pulsanti delle azioni disponibili nella fase corrente.
export function renderTurnActions(state: GameState): string {
  if (state.phase === 'gameOver') {
    return `<p class="winner">🏆 ${t('turn.wins', { name: escapeHtml(state.players[state.winner!].name) })}</p>
      <button data-action="newGame">${t('btn.newGame')}</button>`;
  }
  const p = state.players[actingPlayer(state)];
  const banner = state.trade ? renderTradeOffer(state) : state.phase === 'auction' ? renderAuction(state) : '';
  if (p.isBot) return `${banner}<p class="hint">🤖 ${t('turn.thinking', { name: escapeHtml(p.name) })}</p>`;
  const b: string[] = [banner];
  if (state.trade) {
    b.push(`<button class="primary" data-action="acceptTrade">${t('btn.accept')}</button>`);
    if ((state.trade.counters ?? 0) < MAX_COUNTERS) b.push(`<button data-action="counterTrade">↩️ ${t('btn.counter')}</button>`);
    b.push(`<button data-action="rejectTrade">${t('btn.reject')}</button>`);
    return b.join('');
  }
  if (state.phase === 'auction') {
    const a = state.auction!;
    const base = Math.max(MIN_BID, a.highestBid);
    for (const step of a.highestBid === 0 ? [0, 40, 90] : [10, 50, 100]) {
      const amount = base + step;
      b.push(`<button class="${step === (a.highestBid === 0 ? 0 : 10) ? 'primary' : ''}" data-action="bid" data-amount="${amount}" ${amount > p.money ? 'disabled' : ''}>${t('btn.bid', { amount: money(amount) })}</button>`);
    }
    b.push(`<button data-action="pass">${t('btn.pass')}</button>`);
    return b.join('');
  }
  if (state.phase === 'cardChoice') {
    const card = cards.cards.find((c) => c.id === state.pendingCard);
    if (card?.effect.kind === 'choice') {
      b.push(`<div class="offer card-choice"><h4>🃏 ${escapeHtml(deckName(card.deck))}</h4><p>${escapeHtml(cardText(card.id))}</p><p class="hint">${t('card.choose')}</p></div>`);
      card.effect.options.forEach((_, i) => b.push(`<button class="${i === 0 ? 'primary' : ''}" data-action="chooseCard" data-option="${i}">${escapeHtml(cardOption(card.id, i))}</button>`));
      return b.join('');
    }
  }
  if (state.phase === 'roll') {
    if (p.inJail) {
      b.push(`<button data-action="payJailFine" ${p.money < 50 ? 'disabled' : ''}>${t('btn.payFine', { amount: money(50) })}</button>`);
      if (p.jailCards.length) b.push(`<button data-action="useJailCard">${t('btn.useJailCard')}</button>`);
      b.push(`<button class="primary" data-action="roll">${t('btn.tryDouble')}</button>`);
    } else {
      b.push(`<button class="primary" data-action="roll">${state.extraRoll ? t('btn.rollAgain') : t('btn.roll')}</button>`);
    }
  } else if (state.phase === 'buy') {
    const space = board.spaces[p.position];
    const price = 'price' in space ? space.price : 0;
    b.push(`<button class="primary" data-action="buy" ${p.money < price ? 'disabled' : ''}>${t('btn.buy', { space: escapeHtml(spaceName(space.id)), amount: money(price) })}</button>`);
    b.push(`<button data-action="decline">${t('btn.decline')}</button>`);
  } else if (state.phase === 'endTurn') {
    if (p.money < 0) {
      b.push(renderDebt(state, p.id));
    } else {
      b.push(`<button class="primary" data-action="endTurn">${t('btn.endTurn')}</button>`);
    }
  }
  if ((state.phase === 'roll' || state.phase === 'endTurn') && state.players.some((o) => o.id !== p.id && !o.bankrupt)) {
    b.push(`<button data-action="openTrade">🤝 ${t('btn.openTrade')}</button>`);
  }
  return b.join('');
}

const DIE = ['', '⚀', '⚁', '⚂', '⚃', '⚄', '⚅'];
export function renderDice(state: GameState): string {
  if (!state.lastRoll) return '';
  return `<span class="dice">${DIE[state.lastRoll[0]]}${DIE[state.lastRoll[1]]}</span>`;
}

function spaceNames(ids: string[]): string {
  return ids.map((id) => escapeHtml(spaceName(id))).join(', ');
}

function sideText(side: TradeSide): string {
  const parts = [];
  if (side.money) parts.push(money(side.money));
  if (side.spaces.length) parts.push(spaceNames(side.spaces));
  return parts.join(' + ') || t('trade.nothing');
}

function renderTradeOffer(state: GameState): string {
  const tr = state.trade!;
  const from = escapeHtml(state.players[tr.from].name);
  const to = escapeHtml(state.players[tr.to].name);
  return `<div class="offer">
    <h4>${tr.counters ? `↩️ ${t('trade.counterTitle', { from, to })}` : `🤝 ${t('trade.offerTitle', { from, to })}`}</h4>
    <div class="offer-cols">
      <div><span class="offer-label">${t('trade.gives', { name: from })}</span>${sideText(tr.give)}</div>
      <div><span class="offer-label">${t('trade.asks', { name: from })}</span>${sideText(tr.get)}</div>
    </div>
    ${tradeSummaryHtml(state, tr)}
  </div>`;
}

// Pannello del debito: quanto manca, cosa si può vendere o ipotecare e quanto rende.
// La bancarotta compare solo quando nemmeno vendendo tutto si arriva a coprire il debito.
function renderDebt(state: GameState, playerId: number): string {
  const ctx = { board, cards, rng: Math.random };
  const debt = -state.players[playerId].money;
  const available = liquidationValue(state, ctx, playerId);
  const owe = state.creditor === null ? t('debt.oweBank', { amount: money(debt) }) : t('debt.owe', { amount: money(debt), name: escapeHtml(state.players[state.creditor].name) });
  if (available < debt) {
    return `<div class="debt-panel">
      <p class="warning">${owe}</p>
      <p>${t('debt.notEnough', { amount: money(available) })}</p>
      <button class="danger" data-action="bankrupt">${t('btn.bankrupt')}</button>
    </div>`;
  }
  const options = debtOptions(state, ctx, playerId)
    .map(({ action, gain }) => {
      const id = 'spaceId' in action ? action.spaceId : '';
      const name = escapeHtml(spaceName(id));
      const label = action.type === 'sell' ? t('debt.sellOn', { space: name }) : t('debt.mortgage', { space: name });
      return `<li><button data-action="${action.type}" data-space="${id}">${label} <strong>+${money(gain)}</strong></button></li>`;
    })
    .join('');
  return `<div class="debt-panel">
    <p class="warning">${owe}</p>
    <p>${t('debt.canRaise', { amount: money(available) })}</p>
    <button class="primary" data-action="coverDebt">${t('btn.coverDebt')}</button>
    <ul class="debt-options">${options}</ul>
  </div>`;
}

function renderAuction(state: GameState): string {
  const a = state.auction!;
  const space = board.spaces.find((s) => s.id === a.spaceId)!;
  const leader = a.highestBidder === null ? t('auction.noBid') : t('auction.bidBy', { amount: money(a.highestBid), name: escapeHtml(state.players[a.highestBidder].name) });
  const turn = escapeHtml(state.players[a.bidders[a.turn]].name);
  return `<div class="offer">
    <h4>🔨 ${t('auction.title', { space: escapeHtml(spaceName(space.id)) })} ${'price' in space ? `(${t('auction.value', { amount: money(space.price) })})` : ''}</h4>
    <p>${t('auction.highest')} <strong>${leader}</strong></p>
    <p>${t('turn.of', { name: `<strong>${turn}</strong>` })} · ${t('auction.bidders', { names: a.bidders.map((id) => escapeHtml(state.players[id].name)).join(', ') })}</p>
  </div>`;
}

// Modulo per preparare uno scambio: si scelgono il giocatore, le caselle e i soldi.
export interface TradeDraft {
  to: number;
  give: TradeSide;
  get: TradeSide;
  // risposta a uno scambio ricevuto: chi scrive è il destinatario, e l'altro non si cambia
  counter?: boolean;
}

// Chi completa quale quartiere se lo scambio va in porto: la cosa da guardare prima di accettare.
export function tradeSummaryHtml(state: GameState, offer: { from: number; to: number; give: TradeSide; get: TradeSide }): string {
  const done = tradeCompletions(state, { board, cards }, offer);
  if (!done.length) return `<p class="trade-note">${t('trade.noCompletion')}</p>`;
  return done
    .map((d) => {
      const g = board.groups.find((x) => x.id === d.group)!;
      return `<p class="trade-note complete" style="--g:${g.color}">✨ ${t('trade.completes', { name: `<strong>${escapeHtml(state.players[d.player].name)}</strong>`, group: `<strong>${escapeHtml(g.name)}</strong>` })}</p>`;
    })
    .join('');
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
  const me = state.players[d.counter && state.trade ? state.trade.to : state.current];
  const others = state.players.filter((o) => o.id !== me.id && !o.bankrupt);
  const list = (owner: number, side: 'give' | 'get') => {
    const ids = tradeableSpaces(state, owner);
    if (!ids.length) return `<p class="hint">${t('trade.noSpaces')}</p>`;
    const chosen = side === 'give' ? d.give.spaces : d.get.spaces;
    return ids
      .map((id) => {
        const sp = board.spaces.find((s) => s.id === id)!;
        const c = groupColor(sp) ?? '#999';
        return `<label class="pick"><input type="checkbox" data-trade="${side}-space" value="${id}" ${chosen.includes(id) ? 'checked' : ''}>
          <span class="dot" style="background:${c}"></span>${escapeHtml(spaceName(sp.id))}${state.ownership[id].mortgaged ? ` (${t('space.mortgaged')})` : ''}</label>`;
      })
      .join('');
  };
  const other = state.players[d.to];
  return `<form class="trade-editor" id="trade-form">
    <h4>${d.counter ? `↩️ ${t('trade.counterTo', { name: escapeHtml(other.name) })}` : `🤝 ${t('trade.proposeTitle')}`}</h4>
    ${d.counter ? `<p class="hint">${t('trade.counterHint')}</p>` : `<label class="row">${t('trade.with')}
      <select data-trade="to">${others.map((o) => `<option value="${o.id}" ${o.id === d.to ? 'selected' : ''}>${o.isBot ? '🤖 ' : ''}${escapeHtml(o.name)}</option>`).join('')}</select>
    </label>`}
    <div class="trade-cols">
      <fieldset><legend>${t('trade.youGive')}</legend>
        ${list(me.id, 'give')}
        <label class="row">${t('trade.money')} <input type="number" inputmode="numeric" min="0" max="${Math.max(me.money, 0)}" step="10" value="${d.give.money}" data-trade="give-money"></label>
      </fieldset>
      <fieldset><legend>${t('trade.youAsk', { name: escapeHtml(other.name) })}</legend>
        ${list(other.id, 'get')}
        <label class="row">${t('trade.money')} <input type="number" inputmode="numeric" min="0" max="${Math.max(other.money, 0)}" step="10" value="${d.get.money}" data-trade="get-money"></label>
      </fieldset>
    </div>
    <div data-trade-summary aria-live="polite">${tradeSummaryHtml(state, { from: me.id, to: d.to, give: d.give, get: d.get })}</div>
    <div class="actions">
      <button class="primary" type="submit">${d.counter ? t('btn.sendCounter') : t('btn.propose')}</button>
      <button type="button" data-action="closeTrade">${t('btn.cancel')}</button>
    </div>
  </form>`;
}

// "Difficile · Collezionista": livello e carattere di un computer.
export function botLabel(b: BotProfile): string {
  const level = BOT_LEVELS.some((l) => l.id === b.level) ? t(`bot.level.${b.level}` as MsgKey) : '';
  const style = BOT_STYLES.find((x) => x.id === b.style);
  return style && style.id !== 'equilibrato' ? `${level} · ${t(`bot.style.${style.id}` as MsgKey)}` : level;
}

export function botStyleText(style: string): string {
  return BOT_STYLES.some((x) => x.id === style) ? t(`bot.styleText.${style}` as MsgKey) : '';
}

// Soldi che si muovono, avvisi brevi e momenti forti dopo una mossa.
// Le funzioni che guardano lo stato sono pure (si provano in tests/momenti.test.ts);
// quelle in fondo mettono gli avvisi nella pagina.
import { HOTEL, ownsWholeGroup, type GameContext, type GameState, type LogLine } from '../engine';
import { t, text, type Message, type MsgKey } from '../i18n';
import { motionReduced } from './motion';

export interface MoneyChange {
  seat: number;
  delta: number;
}

// Di quanto sono cambiati i soldi di ciascuno.
export function moneyChanges(prev: GameState, next: GameState): MoneyChange[] {
  return next.players.flatMap((p, i) => {
    const before = prev.players[i]?.money;
    return before === undefined || before === p.money ? [] : [{ seat: i, delta: p.money - before }];
  });
}

// Righe del registro che spiegano un movimento di soldi (o una carta pescata, che lo dice da sé).
const MONEY_KEYS = new Set<MsgKey>([
  'log.rent',
  'log.tax',
  'log.pot',
  'log.passGo',
  'log.jailFine',
  'log.interest',
  'log.interestReceived',
  'log.buys',
  'log.auctionWon',
  'log.draws',
]);

function freshLines(prev: GameState, next: GameState): LogLine[] {
  const n = Math.min(Math.max((next.eventCount ?? 0) - (prev.eventCount ?? 0), 0), next.log.length);
  return n ? next.log.slice(-n) : [];
}

// Le frasi degli avvisi brevi: chi paga o incassa quanto, e perché.
export function moneyNotices(prev: GameState, next: GameState): Message[] {
  return freshLines(prev, next).filter((l): l is Message => typeof l === 'object' && !!l && MONEY_KEYS.has(l.k));
}

export interface Moment {
  icon: string;
  msg: Message;
  seat: number;
}

// I momenti da festeggiare (o da compatire): quartiere completato, palazzo, bancarotta.
export function bigMoments(prev: GameState, next: GameState, ctx: GameContext): Moment[] {
  const out: Moment[] = [];
  for (const g of ctx.board.groups) {
    for (const p of next.players) {
      if (p.bankrupt || !ownsWholeGroup(next, ctx, p.id, g.id) || ownsWholeGroup(prev, ctx, p.id, g.id)) continue;
      out.push({ icon: '🏘️', seat: p.id, msg: { k: 'moment.group', p: { name: p.name, group: g.id } } });
    }
  }
  for (const [id, own] of Object.entries(next.ownership)) {
    if (own.houses === HOTEL && (prev.ownership[id]?.houses ?? 0) < HOTEL) {
      out.push({ icon: '🏢', seat: own.owner, msg: { k: 'moment.hotel', p: { name: next.players[own.owner].name, space: id } } });
    }
  }
  for (const p of next.players) {
    if (p.bankrupt && !prev.players[p.id]?.bankrupt) out.push({ icon: '💥', seat: p.id, msg: { k: 'moment.bankrupt', p: { name: p.name } } });
  }
  return out;
}

// ——— nella pagina ———

function layer(id: string, cls: string): HTMLElement {
  let el = document.getElementById(id);
  if (el) return el;
  el = document.createElement('div');
  el.id = id;
  el.className = cls;
  // il lettore di schermo le stesse frasi le sente già dagli annunci
  el.setAttribute('aria-hidden', 'true');
  document.body.append(el);
  return el;
}

const NOTICE_MS = 3200;
const MAX_NOTICES = 3;

// Avvisi brevi in alto: al massimo tre insieme, i più vecchi lasciano il posto.
export function showNotices(lines: Message[], durationFactor = 1): void {
  if (!lines.length) return;
  const box = layer('avvisi', 'notices');
  for (const m of lines.slice(-MAX_NOTICES)) {
    const el = document.createElement('div');
    el.className = 'notice';
    el.textContent = text(m);
    box.append(el);
    setTimeout(() => el.remove(), NOTICE_MS / Math.max(durationFactor, 0.5));
  }
  while (box.children.length > MAX_NOTICES) box.firstElementChild!.remove();
}

// Un momento forte: un cartello al centro per un paio di secondi.
export function showMoment(m: Moment, color: string): void {
  const box = layer('momento', 'moment-layer');
  box.replaceChildren();
  const el = document.createElement('div');
  el.className = 'moment';
  el.style.setProperty('--c', color);
  const icon = document.createElement('span');
  icon.className = 'moment-icon';
  icon.textContent = m.icon;
  const p = document.createElement('p');
  p.textContent = text(m.msg);
  el.append(icon, p);
  if (!motionReduced() && m.icon !== '💥') {
    // coriandoli: pochi pezzi di carta colorata che cadono
    for (let i = 0; i < 18; i++) {
      const c = document.createElement('i');
      c.className = 'confetto';
      c.style.setProperty('--x', `${Math.round((i / 17) * 100)}%`);
      c.style.setProperty('--d', `${(i * 37) % 400}ms`);
      c.style.setProperty('--h', `${(i * 47) % 360}`);
      el.append(c);
    }
  }
  box.append(el);
  setTimeout(() => el.remove(), 2600);
}

// I soldi nella scheda del giocatore: il numero scorre fino al valore nuovo e compare "+200" o "−50".
export function animateMoney(root: ParentNode, changes: MoneyChange[], format: (n: number) => string, finalOf: (seat: number) => number): void {
  const reduced = motionReduced();
  for (const { seat, delta } of changes) {
    const el = root.querySelector<HTMLElement>(`.player[data-seat="${seat}"] .money`);
    if (!el) continue;
    const chip = document.createElement('span');
    chip.className = `money-delta ${delta > 0 ? 'up' : 'down'}`;
    chip.setAttribute('aria-hidden', 'true');
    chip.textContent = `${delta > 0 ? '+' : '−'}${format(Math.abs(delta))}`;
    el.before(chip);
    setTimeout(() => chip.remove(), 1600);
    if (reduced) continue;
    const end = finalOf(seat);
    const start = end - delta;
    const t0 = performance.now();
    const step = (now: number) => {
      if (!el.isConnected) return;
      const k = Math.min((now - t0) / 600, 1);
      el.textContent = format(Math.round(start + (end - start) * (1 - (1 - k) ** 3)));
      if (k < 1) requestAnimationFrame(step);
    };
    el.textContent = format(start);
    requestAnimationFrame(step);
  }
}

export function momentText(m: Moment): string {
  return `${m.icon} ${t(m.msg.k, m.msg.p)}`;
}

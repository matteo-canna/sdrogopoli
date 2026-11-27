// Gestione del modulo di scambio tra giocatori: creazione, modifica, riepilogo e invio.
import type { Action, GameState } from '../engine';
import { tradeSummaryHtml, type TradeDraft } from './view';

export function createTradeDraft(state: GameState): TradeDraft {
  const to = state.players.find((o) => o.id !== state.current && !o.bankrupt)!.id;
  return { to, give: { money: 0, spaces: [] }, get: { money: 0, spaces: [] } };
}

export function createCounterDraft(state: GameState): TradeDraft | null {
  const t = state.trade;
  if (!t) return null;
  // si parte dallo scambio ricevuto, girato dal proprio punto di vista
  return {
    to: t.from,
    give: { money: t.get.money, spaces: [...t.get.spaces] },
    get: { money: t.give.money, spaces: [...t.give.spaces] },
    counter: true,
  };
}

// Aggiorna "chi completa quale quartiere" mentre si prepara lo scambio, senza ridisegnare il modulo.
export function refreshTradeSummary(app: HTMLElement, s: GameState | null, tradeDraft: TradeDraft | null): void {
  if (!s || !tradeDraft) return;
  const me = tradeDraft.counter && s.trade ? s.trade.to : s.current;
  const html = tradeSummaryHtml(s, { from: me, to: tradeDraft.to, give: tradeDraft.give, get: tradeDraft.get });
  app.querySelectorAll('[data-trade-summary]').forEach((el) => (el.innerHTML = html));
}

// Gestisce un evento change nei campi del modulo di scambio.
export function handleTradeChange(
  app: HTMLElement,
  el: HTMLInputElement | HTMLSelectElement,
  state: GameState | null,
  tradeDraft: TradeDraft | null,
  setDraft: (d: TradeDraft) => void,
  render: () => void,
): void {
  const field = el.dataset.trade;
  if (!field || !tradeDraft || !state) return;
  if (field === 'to') {
    setDraft({ to: Number(el.value), give: tradeDraft.give, get: { money: 0, spaces: [] } });
    render();
    return;
  }
  if (field === 'give-money' || field === 'get-money') {
    const side = field === 'give-money' ? tradeDraft.give : tradeDraft.get;
    side.money = Math.max(0, Math.floor(Number(el.value) || 0));
    return;
  }
  const side = field === 'give-space' ? tradeDraft.give : tradeDraft.get;
  const id = el.value;
  side.spaces = (el as HTMLInputElement).checked ? [...side.spaces, id] : side.spaces.filter((x) => x !== id);
  refreshTradeSummary(app, state, tradeDraft);
}

// Gestisce l'invio del modulo di scambio.
export function submitTradeForm(
  form: HTMLFormElement,
  tradeDraft: TradeDraft,
  act: (action: Action) => void,
  hasError: () => boolean,
  clearDraft: () => void,
  render: () => void,
): void {
  // legge anche i campi soldi non ancora confermati
  for (const input of form.querySelectorAll<HTMLInputElement>('input[type=number]')) {
    const side = input.dataset.trade === 'give-money' ? tradeDraft.give : tradeDraft.get;
    side.money = Math.max(0, Math.floor(Number(input.value) || 0));
  }
  if (tradeDraft.counter) act({ type: 'counterTrade', offer: { give: tradeDraft.give, get: tradeDraft.get } });
  else act({ type: 'proposeTrade', offer: { to: tradeDraft.to, give: tradeDraft.give, get: tradeDraft.get } });
  if (!hasError()) clearDraft();
  render();
}

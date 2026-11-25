// Informazioni della schermata iniziale: come si gioca, i quartieri della città e le regole in breve.
// Le funzioni che calcolano non usano il DOM, così si possono provare con i test.
import { board, cards } from '../data';
import { JAIL_FINE, MAX_PLAYERS, MIN_PLAYERS } from '../engine';
import { escapeHtml } from './view';
import { deckName, t, type MsgKey } from '../i18n';

// il simbolo si legge al momento: cambia col tabellone
const SYMBOL = () => board.currency.symbol;

export interface District {
  id: string;
  name: string;
  color: string;
  streets: number;
  minPrice: number;
  maxPrice: number;
}

// Un quartiere per gruppo di colore, con quante vie ha e quanto costano.
export function districts(): District[] {
  return board.groups.map((g) => {
    const prices = board.spaces.flatMap((s) => (s.type === 'property' && s.group === g.id ? [s.price] : []));
    return { id: g.id, name: g.name, color: g.color, streets: prices.length, minPrice: Math.min(...prices), maxPrice: Math.max(...prices) };
  });
}

// Numeri del gioco mostrati come "carta d'identità" del tabellone.
export function gameFacts(): { value: string; label: string }[] {
  const start = board.spaces.find((s) => s.type === 'start');
  const salary = start && 'salary' in start ? start.salary : 0;
  return [
    { value: `${MIN_PLAYERS}-${MAX_PLAYERS}`, label: t('facts.players') },
    { value: String(board.spaces.length), label: t('facts.spaces') },
    { value: String(board.groups.length), label: t('facts.groups') },
    { value: String(cards.cards.length), label: t('facts.cards') },
    { value: `${SYMBOL()} ${board.startingMoney}`, label: t('facts.start') },
    { value: `${SYMBOL()} ${salary}`, label: t('facts.salary') },
  ];
}

const STEPS: [string, number][] = [
  ['🎲', 1],
  ['🏠', 2],
  ['🏗️', 3],
  ['💸', 4],
];

function deckNames(): string {
  return Object.keys(cards.decks).map((d) => `“${escapeHtml(deckName(d))}”`).join(` ${t('setup.and')} `);
}

export function renderIntro(): string {
  const start = board.spaces.find((s) => s.type === 'start');
  const salary = start && 'salary' in start ? start.salary : 0;
  return `
    <section class="card intro-block" aria-labelledby="how-title">
      <h2 id="how-title">${t('intro.how')}</h2>
      <ol class="steps">
        ${STEPS.map(([icon, n]) => `<li><span class="step-icon" aria-hidden="true">${icon}</span><div><strong>${t(`intro.step${n}` as MsgKey)}</strong><p>${t(`intro.step${n}Text` as MsgKey)}</p></div></li>`).join('')}
      </ol>
      <details class="rules-more">
        <summary>${t('intro.rules')}</summary>
        <ul>
          <li>🏁 ${t('intro.rule1', { amount: `${SYMBOL()} ${salary}` })}</li>
          <li>❓ ${t('intro.rule2', { decks: deckNames() })}</li>
          <li>🚋 ${t('intro.rule3')}</li>
          <li>👮 ${t('intro.rule4', { amount: `${SYMBOL()} ${JAIL_FINE}` })}</li>
          <li>🤝 ${t('intro.rule5')}</li>
          <li>🏦 ${t('intro.rule6')}</li>
          <li>⏱️ ${t('intro.rule7')}</li>
        </ul>
      </details>
    </section>
    <section class="card intro-block" aria-labelledby="city-title">
      <h2 id="city-title">${t('intro.city')}</h2>
      <ul class="facts">
        ${gameFacts().map((f) => `<li><strong>${f.value}</strong><span>${f.label}</span></li>`).join('')}
      </ul>
      <ul class="districts">
        ${districts().map((d) => `<li style="--g:${d.color}"><span class="district-name">${escapeHtml(d.name)}</span><span class="district-price">${t('intro.streets', { n: d.streets })} · ${SYMBOL()} ${d.minPrice}${d.maxPrice !== d.minPrice ? `-${d.maxPrice}` : ''}</span></li>`).join('')}
      </ul>
    </section>`;
}

// Consigli mostrati a rotazione durante il caricamento.
export function loadingTips(): string[] {
  return [1, 2, 3, 4, 5, 6].map((n) => t(`loadingTip.${n}` as MsgKey));
}

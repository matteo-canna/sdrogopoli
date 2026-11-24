// Informazioni della schermata iniziale: come si gioca, i quartieri della città e le regole in breve.
// Le funzioni che calcolano non usano il DOM, così si possono provare con i test.
import { board, cards } from '../data';
import { JAIL_FINE, MAX_PLAYERS, MIN_PLAYERS } from '../engine';
import { escapeHtml } from './view';

const SYMBOL = board.currency.symbol;

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
    { value: `${MIN_PLAYERS}-${MAX_PLAYERS}`, label: 'giocatori' },
    { value: String(board.spaces.length), label: 'caselle' },
    { value: String(board.groups.length), label: 'quartieri' },
    { value: String(cards.cards.length), label: 'carte' },
    { value: `${SYMBOL} ${board.startingMoney}`, label: 'per iniziare' },
    { value: `${SYMBOL} ${salary}`, label: 'alla Partenza' },
  ];
}

const STEPS: [string, string, string][] = [
  ['🎲', 'Lancia i dadi', 'Muovi la pedina in senso orario. Con un doppio rilanci.'],
  ['🏠', 'Compra le vie', "Se nessuno la possiede puoi comprarla. Se rinunci va all'asta."],
  ['🏗️', 'Costruisci', 'Con tutto un quartiere dello stesso colore costruisci case e poi il palazzo.'],
  ['💸', 'Incassa gli affitti', 'Chi arriva sulle tue vie paga. Vince chi resta in piedi.'],
];

function deckNames(): string {
  return Object.values(cards.decks).map((d) => `“${escapeHtml(d.name)}”`).join(' e ');
}

export function renderIntro(): string {
  const start = board.spaces.find((s) => s.type === 'start');
  const salary = start && 'salary' in start ? start.salary : 0;
  return `
    <section class="card intro-block" aria-labelledby="how-title">
      <h2 id="how-title">Come si gioca</h2>
      <ol class="steps">
        ${STEPS.map(([icon, title, text]) => `<li><span class="step-icon" aria-hidden="true">${icon}</span><div><strong>${title}</strong><p>${text}</p></div></li>`).join('')}
      </ol>
      <details class="rules-more">
        <summary>Regole in breve</summary>
        <ul>
          <li>🏁 Ogni volta che passi dalla Partenza incassi ${SYMBOL} ${salary}.</li>
          <li>❓ Sulle caselle con il punto di domanda peschi una carta: ${deckNames()}.</li>
          <li>🚋 Fermate e 💡 servizi non si costruiscono: l'affitto cresce con quanti ne possiedi.</li>
          <li>👮 Chi viene fermato dai vigili va in Caserma: esce con un doppio, pagando ${SYMBOL} ${JAIL_FINE} o con la carta esci gratis.</li>
          <li>🤝 Nel tuo turno puoi proporre scambi di vie e soldi agli altri giocatori.</li>
          <li>🏦 Se sei in debito vendi case o ipoteca le vie; se non basta dichiari bancarotta.</li>
          <li>⏱️ Con una durata in giri vince chi ha il patrimonio più alto alla fine.</li>
        </ul>
      </details>
    </section>
    <section class="card intro-block" aria-labelledby="city-title">
      <h2 id="city-title">La città</h2>
      <ul class="facts">
        ${gameFacts().map((f) => `<li><strong>${f.value}</strong><span>${f.label}</span></li>`).join('')}
      </ul>
      <ul class="districts">
        ${districts().map((d) => `<li style="--g:${d.color}"><span class="district-name">${escapeHtml(d.name)}</span><span class="district-price">${d.streets} vie · ${SYMBOL} ${d.minPrice}${d.maxPrice !== d.minPrice ? `-${d.maxPrice}` : ''}</span></li>`).join('')}
      </ul>
    </section>`;
}

// Consigli mostrati a rotazione durante il caricamento.
export const LOADING_TIPS = [
  'Un quartiere completo raddoppia gli affitti anche senza case.',
  'Le vie arancioni del Porto sono tra le più visitate: chi ci arriva spesso paga.',
  'Un doppio ti fa rilanciare, ma tre doppi di fila ti portano in Caserma.',
  "Non vuoi comprare? La via va all'asta e puoi vincerla a meno.",
  'Ipotecare una via ti dà soldi subito, ma non incassi affitti finché non la riscatti.',
  'Uno scambio ben fatto può completare un quartiere: provalo con 🤝.',
];

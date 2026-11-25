// Tavolo online: codice e link da condividere, sala d'attesa con chi è collegato, nota sulla privacy.
// La partita vera la tiene chi crea il tavolo (src/net/host.ts); qui c'è solo la pagina.
import type { Appearance } from '../engine';
import type { Member } from '../net/protocol';
import type { Transport } from '../net/transport';
import { BroadcastTransport } from '../net/broadcast';
import { MAX_SEATS } from '../net/host';
import { CHARACTERS, characterDef } from './characters';
import { escapeHtml } from './view';

// lettere e numeri che non si confondono a voce o scritti a mano (niente 0/O, 1/I/L)
const CODE_CHARS = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
export const CODE_LENGTH = 6;

export function tableCode(random: () => number = Math.random): string {
  return Array.from({ length: CODE_LENGTH }, () => CODE_CHARS[Math.floor(random() * CODE_CHARS.length)]).join('');
}

// Codice scritto da una persona: maiuscole, senza spazi o trattini. null se non è valido.
export function cleanCode(raw: string): string | null {
  const code = raw.toUpperCase().replace(/[\s-]/g, '');
  return code.length === CODE_LENGTH && [...code].every((c) => CODE_CHARS.includes(c)) ? code : null;
}

export function codeFromHash(hash: string): string | null {
  const m = /tavolo=([^&]+)/.exec(hash);
  return m ? cleanCode(decodeURIComponent(m[1])) : null;
}

// Link da mandare agli amici: stessa pagina con il codice dopo il #.
export function tableLink(code: string, loc: Pick<Location, 'origin' | 'pathname' | 'search'> = location): string {
  return `${loc.origin}${loc.pathname}${loc.search}#tavolo=${code}`;
}

// Canale tra i dispositivi: WebRTC con Trystero (scaricato solo quando serve). Con ?rete=locale
// le schede dello stesso browser si parlano direttamente: serve per i test e per provare da soli.
export async function openTransport(code: string): Promise<Transport> {
  if (new URLSearchParams(location.search).get('rete') === 'locale') return new BroadcastTransport(code);
  const { TrysteroTransport } = await import('../net/trystero');
  return new TrysteroTransport(code);
}

export const DURATIONS: [string, string][] = [
  ['', "Fino all'ultimo rimasto"],
  ['15', '15 giri (partita breve)'],
  ['20', '20 giri'],
  ['25', '25 giri'],
  ['40', '40 giri'],
];

export interface LobbyView {
  role: 'host' | 'guest';
  code: string;
  // la mia riga nell'elenco
  meId: string;
  name: string;
  look: Appearance;
  members: Member[];
  computers: number;
  // l'ospite ha trovato l'oste
  connected: boolean;
  ready: boolean;
  // messaggio in evidenza (errori, tavolo chiuso, attesa lunga)
  status: string;
}

export interface LobbyHandlers {
  onProfile: (name: string, look: Appearance) => void;
  onComputers: (n: number) => void;
  onReady: (ready: boolean) => void;
  onStart: (maxRounds: number | null) => void;
  onLeave: () => void;
}

export function renderLobby(app: HTMLElement, view: LobbyView, h: LobbyHandlers): void {
  const link = tableLink(view.code);
  app.innerHTML = `
    <main class="setup lobby">
      <header class="brand">
        <h1>🌐 Tavolo online</h1>
        <p>${view.role === 'host' ? 'Manda il link o il codice agli amici: quando sono tutti dentro, inizia la partita.' : 'Sei al tavolo di un amico: scegli nome e personaggio, poi tocca "Sono pronto".'}</p>
      </header>
      <section class="card lobby-code" aria-labelledby="code-title">
        <h2 id="code-title">Codice del tavolo</h2>
        <p class="table-code" data-table-code>${view.code}</p>
        ${view.role === 'host' ? `
        <label class="lobby-link">Link da condividere
          <input readonly value="${escapeHtml(link)}" data-table-link>
        </label>
        <div class="lobby-buttons">
          <button type="button" class="primary" data-copy>📋 Copia il link</button>
          ${'share' in navigator ? '<button type="button" data-share>📤 Condividi</button>' : ''}
        </div>
        <p class="lobby-msg" role="status" aria-live="polite" data-copy-msg></p>` : ''}
      </section>
      <section class="card" aria-labelledby="me-title">
        <h2 id="me-title">Tu</h2>
        <label class="lobby-name">Il tuo nome
          <input maxlength="20" value="${escapeHtml(view.name)}" data-lobby-name autocomplete="nickname">
        </label>
        <div class="look-group" role="radiogroup" aria-label="Personaggio">
          ${CHARACTERS.map((c) => `<button type="button" class="chip-btn" role="radio" aria-checked="${c.id === view.look.character}" data-lobby-character="${c.id}">${c.emoji} ${c.label}</button>`).join('')}
        </div>
      </section>
      <section class="card" aria-labelledby="members-title">
        <h2 id="members-title">Al tavolo</h2>
        <div data-lobby-members></div>
        <div data-lobby-controls></div>
        <p class="lobby-status" role="status" aria-live="polite" data-lobby-status></p>
      </section>
      <section class="card privacy-note" aria-labelledby="privacy-title">
        <h2 id="privacy-title">🔒 Privacy</h2>
        <p>I dispositivi al tavolo si collegano direttamente tra loro, come in una videochiamata: per questo <strong>chi è al tavolo può vedere il tuo indirizzo IP</strong>. Per trovarsi si passa da server pubblici e gratuiti (relay Nostr), che vedono il codice del tavolo ma non la partita. Nessun account, niente viene salvato su un server.</p>
        <p>Condividi il link solo con persone che conosci.</p>
      </section>
      <button type="button" class="link" data-lobby-leave>← Esci dal tavolo</button>
    </main>`;

  let name = view.name;
  let look = view.look;
  const nameInput = app.querySelector<HTMLInputElement>('[data-lobby-name]')!;
  nameInput.addEventListener('change', () => {
    name = nameInput.value.trim() || name;
    h.onProfile(name, look);
  });
  const main = app.querySelector<HTMLElement>('.lobby')!;
  main.addEventListener('click', async (e) => {
    const b = (e.target as HTMLElement).closest<HTMLButtonElement>('button');
    if (!b) return;
    if (b.dataset.lobbyCharacter) {
      look = { ...look, character: b.dataset.lobbyCharacter, item: characterDef(b.dataset.lobbyCharacter).defaultItem };
      main.querySelectorAll<HTMLElement>('[data-lobby-character]').forEach((x) => x.setAttribute('aria-checked', String(x === b)));
      h.onProfile(nameInput.value.trim() || name, look);
    } else if (b.hasAttribute('data-copy')) {
      const msg = main.querySelector('[data-copy-msg]')!;
      try {
        await navigator.clipboard.writeText(link);
        msg.textContent = '✅ Link copiato: incollalo in una chat con gli amici.';
      } catch {
        main.querySelector<HTMLInputElement>('[data-table-link]')!.select();
        msg.textContent = 'Seleziona il link e copialo a mano.';
      }
    } else if (b.hasAttribute('data-share')) {
      void navigator.share({ title: 'Sdrogopoli', text: `Vieni a giocare a Sdrogopoli! Codice del tavolo: ${view.code}`, url: link }).catch(() => {});
    } else if (b.dataset.computers) h.onComputers(Number(b.dataset.computers));
    else if (b.hasAttribute('data-ready')) h.onReady(b.getAttribute('aria-pressed') !== 'true');
    else if (b.hasAttribute('data-lobby-start')) {
      const rounds = main.querySelector<HTMLSelectElement>('[data-lobby-rounds]')?.value;
      h.onStart(Number(rounds) || null);
    } else if (b.hasAttribute('data-lobby-leave')) h.onLeave();
  });
  updateLobby(app, view);
}

// Aggiorna solo l'elenco e i pulsanti, senza toccare il nome che si sta scrivendo.
export function updateLobby(app: HTMLElement, view: LobbyView): void {
  const list = app.querySelector('[data-lobby-members]');
  if (!list) return;
  list.innerHTML = view.connected
    ? `<ul class="lobby-members">
      ${view.members
        .map((m) => {
          const def = characterDef(m.look?.character ?? '');
          const you = m.id === view.meId;
          return `<li style="--c:${escapeHtml(m.look?.color ?? 'var(--line)')}"><span class="member-emoji" aria-hidden="true">${def.emoji}</span>
            <span class="member-name">${escapeHtml(m.name)}${you ? ' <small>(tu)</small>' : ''}</span>
            <span class="member-state">${m.host ? '🏠 ha creato il tavolo' : m.ready ? '✅ pronto' : '⏳ non ancora pronto'}</span></li>`;
        })
        .join('')}
      ${Array.from({ length: view.computers }, (_, c) => `<li class="member-bot"><span class="member-emoji" aria-hidden="true">🤖</span><span class="member-name">Computer ${c + 1}</span><span class="member-state">gioca da solo</span></li>`).join('')}
    </ul>`
    : '<p class="lobby-wait">Mi collego al tavolo…</p>';
  const controls = app.querySelector('[data-lobby-controls]')!;
  const seats = view.members.length + view.computers;
  if (view.role === 'host') {
    const waiting = view.members.filter((m) => !m.host && !m.ready).length;
    const maxComputers = MAX_SEATS - view.members.length;
    controls.innerHTML = `
      <div class="lobby-computers">
        <span>Computer al tavolo</span>
        <button type="button" data-computers="${view.computers - 1}" ${view.computers <= 0 ? 'disabled' : ''} aria-label="Un computer in meno">−</button>
        <strong aria-live="polite">${view.computers}</strong>
        <button type="button" data-computers="${view.computers + 1}" ${view.computers >= maxComputers ? 'disabled' : ''} aria-label="Un computer in più">+</button>
      </div>
      <label class="lobby-rounds">Durata
        <select data-lobby-rounds>${DURATIONS.map(([v, l]) => `<option value="${v}" ${v === '20' ? 'selected' : ''}>${l}</option>`).join('')}</select>
      </label>
      <button type="button" class="primary" data-lobby-start ${seats < 2 || waiting ? 'disabled' : ''}>Inizia la partita</button>
      <p class="hint">${seats < 2 ? 'Serve almeno un altro giocatore: un amico o un computer.' : waiting ? `Aspetta che tutti siano pronti (${waiting} ${waiting === 1 ? 'manca' : 'mancano'}).` : `Si gioca in ${seats}. Fino a ${MAX_SEATS} al tavolo.`}</p>`;
  } else {
    controls.innerHTML = view.connected
      ? `<button type="button" class="${view.ready ? '' : 'primary'}" data-ready aria-pressed="${view.ready}">${view.ready ? '✅ Pronto (tocca per annullare)' : 'Sono pronto'}</button>
         <p class="hint">${view.ready ? "Aspetta che chi ha creato il tavolo inizi la partita." : 'Quando hai scelto nome e personaggio, tocca "Sono pronto".'}</p>`
      : '';
  }
  app.querySelector('[data-lobby-status]')!.textContent = view.status;
}

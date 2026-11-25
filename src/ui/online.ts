// Tavolo online: codice e link da condividere, sala d'attesa con chi è collegato, nota sulla privacy.
// La partita vera la tiene chi crea il tavolo (src/net/host.ts); qui c'è solo la pagina.
import type { Appearance } from '../engine';
import type { Member } from '../net/protocol';
import type { Transport } from '../net/transport';
import { BroadcastTransport } from '../net/broadcast';
import { MAX_SEATS } from '../net/host';
import { CHARACTERS, characterDef } from './characters';
import { escapeHtml } from './view';
import { t, tn } from '../i18n';

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

// Durate e tempi per mossa proposti nella sala d'attesa (valore, testo nella lingua scelta).
export function durations(): [string, string][] {
  return [
    ['', t('rules.untilLast')],
    ['15', t('rules.roundsShort', { n: 15 })],
    ...[20, 25, 40].map((n): [string, string] => [String(n), t('rules.rounds', { n })]),
  ];
}

export function turnLimits(): [string, string][] {
  return [
    ['', t('lobby.noLimit')],
    ['30', t('lobby.seconds', { n: 30 })],
    ['60', t('lobby.minute')],
    ['120', t('lobby.minutes', { n: 2 })],
  ];
}

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
  onStart: (maxRounds: number | null, limitSeconds: number | null) => void;
  onLeave: () => void;
}

export function renderLobby(app: HTMLElement, view: LobbyView, h: LobbyHandlers): void {
  const link = tableLink(view.code);
  app.innerHTML = `
    <main class="setup lobby">
      <header class="brand">
        <h1>🌐 ${t('lobby.title')}</h1>
        <p>${view.role === 'host' ? t('lobby.hostIntro') : t('lobby.guestIntro')}</p>
      </header>
      <section class="card lobby-code" aria-labelledby="code-title">
        <h2 id="code-title">${t('lobby.code')}</h2>
        <p class="table-code" data-table-code>${view.code}</p>
        ${view.role === 'host' ? `
        <label class="lobby-link">${t('lobby.link')}
          <input readonly value="${escapeHtml(link)}" data-table-link>
        </label>
        <div class="lobby-buttons">
          <button type="button" class="primary" data-copy>📋 ${t('lobby.copy')}</button>
          ${'share' in navigator ? `<button type="button" data-share>📤 ${t('lobby.share')}</button>` : ''}
        </div>
        <p class="lobby-msg" role="status" aria-live="polite" data-copy-msg></p>` : ''}
      </section>
      <section class="card" aria-labelledby="me-title">
        <h2 id="me-title">${t('lobby.you')}</h2>
        <label class="lobby-name">${t('lobby.yourName')}
          <input maxlength="20" value="${escapeHtml(view.name)}" data-lobby-name autocomplete="nickname">
        </label>
        <div class="look-group" role="radiogroup" aria-label="${t('look.character')}">
          ${CHARACTERS.map((c) => `<button type="button" class="chip-btn" role="radio" aria-checked="${c.id === view.look.character}" data-lobby-character="${c.id}">${c.emoji} ${c.label}</button>`).join('')}
        </div>
      </section>
      <section class="card" aria-labelledby="members-title">
        <h2 id="members-title">${t('lobby.atTable')}</h2>
        <div data-lobby-members></div>
        <div data-lobby-controls></div>
        <p class="lobby-status" role="status" aria-live="polite" data-lobby-status></p>
      </section>
      <section class="card privacy-note" aria-labelledby="privacy-title">
        <h2 id="privacy-title">🔒 Privacy</h2>
        <p>${t('lobby.privacy1')} <strong>${t('lobby.privacyIp')}</strong>. ${t('lobby.privacy2')}</p>
        <p>${t('lobby.privacy3')}</p>
      </section>
      <button type="button" class="link" data-lobby-leave>← ${t('online.leave')}</button>
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
        msg.textContent = `✅ ${t('lobby.copied')}`;
      } catch {
        main.querySelector<HTMLInputElement>('[data-table-link]')!.select();
        msg.textContent = t('lobby.copyByHand');
      }
    } else if (b.hasAttribute('data-share')) {
      void navigator.share({ title: 'Gioco Folle!', text: t('lobby.shareText', { code: view.code }), url: link }).catch(() => {});
    } else if (b.dataset.computers) h.onComputers(Number(b.dataset.computers));
    else if (b.hasAttribute('data-ready')) h.onReady(b.getAttribute('aria-pressed') !== 'true');
    else if (b.hasAttribute('data-lobby-start')) {
      const rounds = main.querySelector<HTMLSelectElement>('[data-lobby-rounds]')?.value;
      const limit = main.querySelector<HTMLSelectElement>('[data-lobby-limit]')?.value;
      h.onStart(Number(rounds) || null, Number(limit) || null);
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
            <span class="member-name">${escapeHtml(m.name)}${you ? ` <small>(${t('lobby.youShort')})</small>` : ''}</span>
            <span class="member-state">${m.host ? `🏠 ${t('lobby.isHost')}` : m.ready ? `✅ ${t('lobby.ready')}` : `⏳ ${t('lobby.notReady')}`}</span></li>`;
        })
        .join('')}
      ${Array.from({ length: view.computers }, (_, c) => `<li class="member-bot"><span class="member-emoji" aria-hidden="true">🤖</span><span class="member-name">Computer ${c + 1}</span><span class="member-state">${t('lobby.botPlays')}</span></li>`).join('')}
    </ul>`
    : `<p class="lobby-wait">${t('lobby.connecting')}</p>`;
  const controls = app.querySelector('[data-lobby-controls]')!;
  const seats = view.members.length + view.computers;
  // le scelte fatte restano anche quando l'elenco si aggiorna
  const rounds = controls.querySelector<HTMLSelectElement>('[data-lobby-rounds]')?.value ?? '20';
  const limit = controls.querySelector<HTMLSelectElement>('[data-lobby-limit]')?.value ?? '60';
  if (view.role === 'host') {
    const waiting = view.members.filter((m) => !m.host && !m.ready).length;
    const maxComputers = MAX_SEATS - view.members.length;
    controls.innerHTML = `
      <div class="lobby-computers">
        <span>${t('lobby.computers')}</span>
        <button type="button" data-computers="${view.computers - 1}" ${view.computers <= 0 ? 'disabled' : ''} aria-label="${t('lobby.lessComputer')}">−</button>
        <strong aria-live="polite">${view.computers}</strong>
        <button type="button" data-computers="${view.computers + 1}" ${view.computers >= maxComputers ? 'disabled' : ''} aria-label="${t('lobby.moreComputer')}">+</button>
      </div>
      <label class="lobby-rounds">${t('lobby.duration')}
        <select data-lobby-rounds>${durations().map(([v, l]) => `<option value="${v}" ${v === rounds ? 'selected' : ''}>${l}</option>`).join('')}</select>
      </label>
      <label class="lobby-rounds">${t('lobby.limit')}
        <select data-lobby-limit>${turnLimits().map(([v, l]) => `<option value="${v}" ${v === limit ? 'selected' : ''}>${l}</option>`).join('')}</select>
      </label>
      <p class="hint">${t('lobby.limitHint')}</p>
      <button type="button" class="primary" data-lobby-start ${seats < 2 || waiting ? 'disabled' : ''}>${t('setup.start')}</button>
      <p class="hint">${seats < 2 ? t('lobby.needOne') : waiting ? tn('lobby.waitReady', waiting) : t('lobby.seats', { n: seats, max: MAX_SEATS })}</p>`;
  } else {
    controls.innerHTML = view.connected
      ? `<button type="button" class="${view.ready ? '' : 'primary'}" data-ready aria-pressed="${view.ready}">${view.ready ? `✅ ${t('lobby.readyUndo')}` : t('lobby.imReady')}</button>
         <p class="hint">${view.ready ? t('lobby.waitHost') : t('lobby.readyHint')}</p>`
      : '';
  }
  app.querySelector('[data-lobby-status]')!.textContent = view.status;
}

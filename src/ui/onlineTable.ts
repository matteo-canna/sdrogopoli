// Tavolo online: sala d'attesa, sincronizzazione dello stato, timer del turno e reazioni rapide.
import { DEFAULT_BOARD } from '../data';
import { actingPlayer, SEAT_BONUS, type Action, type Appearance, type GameContext, type GameState } from '../engine';
import { t } from '../i18n';
import { QUICK_SAYS, sayText } from '../net/chat';
import { GuestRoom } from '../net/guest';
import { HostRoom, type HostSnapshot } from '../net/host';
import { turnServers } from '../net/turn';
import { audio } from './audio';
import { playerColor } from './characters';
import { cleanCode, codeFromHash, openTransport, renderLobby, tableCode, updateLobby, type LobbyView } from './online';
import { KEYS, readPref, writePref } from './prefs';
import { randomSeed } from './session';
import { setupLooks } from './setup';
import { escapeHtml, playerBadge } from './view';

export type Online = { role: 'host'; room: HostRoom; code: string } | { role: 'guest'; room: GuestRoom; code: string };

const HOST_TABLE = 'sdrogopoli-tavolo-oste';
const GUEST_KEY = 'sdrogopoli-chiave-tavolo';

function readSession(key: string): string | null {
  try {
    return sessionStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeSession(key: string, value: string | null): void {
  try {
    if (value === null) sessionStorage.removeItem(key);
    else sessionStorage.setItem(key, value);
  } catch {
    /* senza memoria della scheda: ricaricando si perde il posto */
  }
}

function guestKey(): string {
  let key = readSession(GUEST_KEY);
  if (!key) {
    key = Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2);
    writeSession(GUEST_KEY, key);
  }
  return key;
}

export function clockText(ms: number): string {
  const sec = Math.ceil(ms / 1000);
  return sec >= 60 ? `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}` : `${sec} s`;
}

export interface OnlineTableDeps {
  app: HTMLElement;
  ctx: GameContext;
  getState: () => GameState | null;
  setState: (s: GameState) => void;
  clearSession: () => void;
  loadSession: () => void;
  useBoard: (id: string) => void;
  cancelBots: () => void;
  destroy3d: () => void;
  onResetUi: (opts: { resumeOffered: boolean; newsFrom: number; lastActorBot?: boolean; clearError?: boolean }) => void;
  setError: (msg: string) => void;
  onMoveReceived: (prev: GameState, next: GameState, action: Action, mine: boolean) => void;
  render: () => void;
}

export class OnlineTable {
  online: Online | null = null;
  lobbyShown = false;
  lobbyStatus = '';
  onlineName = readPref(KEYS.onlineName) ?? '';
  onlineLook: Appearance = setupLooks[0];
  saysOpen = false;

  constructor(private readonly deps: OnlineTableDeps) {
    // Ogni secondo: conto alla rovescia e, per chi ha creato il tavolo, controllo del tempo scaduto.
    setInterval(() => {
      if (!this.online || !this.deps.getState()) return;
      if (this.online.role === 'host' && this.online.room.checkTimer()) return;
      const clock = this.deps.app.querySelectorAll<HTMLElement>('[data-clock]');
      const left = this.timeLeft();
      clock.forEach((el) => {
        el.hidden = left === null;
        if (left === null) return;
        el.textContent = `⏱ ${clockText(left)}`;
        el.classList.toggle('late', left <= 10_000);
      });
    }, 1000);

    window.addEventListener('pagehide', () => {
      if (this.online?.role === 'host') this.online.room.close();
      else this.online?.room.leave();
    });
  }

  mySeat(): number | null {
    if (!this.online) return null;
    return this.online.role === 'host' ? this.online.room.hostSeat : this.online.room.seat;
  }

  myTurn(s: GameState): boolean {
    return !this.online || actingPlayer(s) === this.mySeat();
  }

  isComputerSeat(seat: number): boolean {
    return !!this.online && this.online.role === 'host' && this.online.room.isComputerSeat(seat);
  }

  stepComputer(): void {
    if (this.online?.role === 'host') this.online.room.stepComputer();
  }

  iAmAway(): boolean {
    const seat = this.mySeat();
    if (!this.online || seat === null) return false;
    return this.online.role === 'host' ? this.online.room.away.has(seat) : this.online.room.away.includes(seat);
  }

  timeLeft(): number | null {
    return this.online ? this.online.room.timeLeft() : null;
  }

  seatNote(seat: number): string {
    if (!this.online) return '';
    const offline = this.online.role === 'host' ? this.online.room.offlineSeats() : this.online.room.offline;
    const away = this.online.role === 'host' ? [...this.online.room.away] : this.online.room.away;
    if (offline.includes(seat)) return ` · 📴 ${t('online.seatOffline')}`;
    if (away.includes(seat)) return ` · 🤖 ${t('online.seatAway')}`;
    return '';
  }

  saysHtml(): string {
    if (!this.online || this.mySeat() === null) return '';
    return `<div class="quick-says">
    <button class="says-toggle" data-action="toggleSays" aria-expanded="${this.saysOpen}">💬 ${t('says.toggle')}</button>
    ${this.saysOpen ? `<div class="says-list">${QUICK_SAYS.map((q) => `<button data-action="say" data-say="${q.id}">${escapeHtml(sayText(q.id) ?? '')}</button>`).join('')}</div>` : ''}
  </div>`;
  }

  say(id: string | undefined): void {
    if (!this.online) return;
    if (this.online.role === 'host') this.online.room.say(this.online.room.hostSeat, id);
    else this.online.room.say(id ?? '');
    this.saysOpen = false;
  }

  private showSaid = (seat: number, id: string): void => {
    const s = this.deps.getState();
    const text = sayText(id);
    if (!s || !text || !s.players[seat]) return;
    let box = document.querySelector<HTMLElement>('#says');
    if (!box) {
      box = document.createElement('div');
      box.id = 'says';
      box.setAttribute('aria-live', 'polite');
      document.body.append(box);
    }
    const p = s.players[seat];
    const el = document.createElement('div');
    el.className = 'said';
    el.style.setProperty('--c', playerColor(p));
    el.innerHTML = `${playerBadge(s, seat, 'token')} <strong>${escapeHtml(p.name)}</strong> <span>${escapeHtml(text)}</span>`;
    box.append(el);
    while (box.children.length > 4) box.firstElementChild!.remove();
    setTimeout(() => el.remove(), 4000);
  };

  private lobbyView(): LobbyView {
    const o = this.online!;
    return {
      role: o.role,
      code: o.code,
      meId: o.role === 'host' ? 'oste' : o.room.myId,
      name: this.onlineName,
      look: this.onlineLook,
      members: o.room.members,
      computers: o.room.computers,
      connected: o.role === 'host' || o.room.connected,
      ready: o.role === 'guest' && o.room.ready,
      status: this.lobbyStatus,
    };
  }

  showLobby(): void {
    this.deps.destroy3d();
    const { app } = this.deps;
    if (this.lobbyShown && app.querySelector('.lobby')) {
      updateLobby(app, this.lobbyView());
      return;
    }
    this.lobbyShown = true;
    renderLobby(app, this.lobbyView(), {
      onProfile: (name, look) => {
        this.onlineName = name;
        this.onlineLook = look;
        writePref(KEYS.onlineName, name);
        if (this.online?.role === 'host') this.online.room.setHostProfile(name, look);
        else if (this.online) {
          this.online.room.name = name;
          this.online.room.look = look;
          this.online.room.setReady(this.online.room.ready);
        }
      },
      onComputers: (n) => this.online?.role === 'host' && this.online.room.setComputers(n),
      onReady: (ready) => {
        if (this.online?.role !== 'guest') return;
        this.online.room.setReady(ready);
        this.deps.render();
      },
      onStart: (maxRounds, limitSeconds) => {
        if (this.online?.role !== 'host') return;
        this.online.room.setTurnLimit(limitSeconds ? limitSeconds * 1000 : null);
        this.online.room.start({ maxRounds, seatBonus: SEAT_BONUS }, randomSeed());
      },
      onLeave: () => this.leave(),
    });
    app.querySelector<HTMLInputElement>('[data-lobby-name]')?.focus();
  }

  private onTableChange = (prev: GameState | null, next: GameState, action: Action | null): void => {
    this.deps.setState(next);
    if (this.online?.role === 'host') {
      const snap = this.online.room.snapshot();
      if (snap) writeSession(HOST_TABLE, JSON.stringify({ code: this.online.code, snap }));
    }
    if (this.lobbyShown) {
      this.lobbyShown = false;
      this.deps.onResetUi({ resumeOffered: false, newsFrom: next.eventCount ?? 0, lastActorBot: false, clearError: true });
    }
    if (prev && action) {
      const mine = actingPlayer(prev) === this.mySeat();
      this.deps.onMoveReceived(prev, next, action, mine);
    }
    this.deps.render();
  };

  async enter(role: 'host' | 'guest', code: string, restore?: HostSnapshot): Promise<void> {
    this.deps.cancelBots();
    this.deps.destroy3d();
    this.deps.useBoard(DEFAULT_BOARD);
    this.deps.clearSession();
    this.lobbyStatus = '';
    this.lobbyShown = false;
    this.deps.onResetUi({ resumeOffered: false, newsFrom: 0, clearError: true });
    const name = this.onlineName || (role === 'host' ? t('online.hostName') : t('online.guestName'));
    let transport;
    try {
      transport = await openTransport(code);
    } catch {
      this.lobbyStatus = t('online.cannotOpen');
      this.online = null;
      this.deps.loadSession();
      const s = this.deps.getState();
      this.deps.onResetUi({ resumeOffered: !!s, newsFrom: s?.eventCount ?? 0 });
      this.deps.render();
      return;
    }
    if (role === 'host') {
      const room = new HostRoom(transport, this.deps.ctx, name, this.onlineLook);
      this.online = { role, room, code };
      room.onLobby = () => this.deps.render();
      room.onChange = this.onTableChange;
      room.onSaid = this.showSaid;
      if (restore) {
        room.restore(restore);
        return;
      }
    } else {
      const room = new GuestRoom(transport, name, this.onlineLook, guestKey());
      this.online = { role, room, code };
      room.onLobby = () => this.deps.render();
      room.onChange = this.onTableChange;
      room.onError = (reason) => {
        if (room.closed) this.lobbyStatus = room.closed;
        if (this.deps.getState()) this.deps.setError(reason);
        else this.lobbyStatus = reason;
        audio.play('error');
        this.deps.render();
      };
      room.onHostLeft = () => {
        const msg = room.closed || t('online.hostLeft');
        this.lobbyStatus = msg;
        this.deps.setError(msg);
        this.deps.render();
      };
      room.onHostBack = () => {
        this.lobbyStatus = '';
        this.deps.setError('');
        this.deps.render();
      };
      room.onPresence = () => this.deps.render();
      room.onSaid = this.showSaid;
      setTimeout(() => {
        if (this.online?.room === room && !room.connected && !room.closed) {
          this.lobbyStatus = t('online.noAnswer') + (turnServers(import.meta.env).length ? '' : ` ${t('online.sameWifi')}`);
          this.deps.render();
        }
      }, 15000);
      history.replaceState(null, '', `#tavolo=${code}`);
    }
    this.deps.render();
  }

  leave(): void {
    if (!this.online) return;
    this.deps.cancelBots();
    if (this.online.role === 'host') this.online.room.close();
    else this.online.room.leave();
    this.online = null;
    writeSession(HOST_TABLE, null);
    this.lobbyShown = false;
    this.lobbyStatus = '';
    this.deps.destroy3d();
    history.replaceState(null, '', location.pathname + location.search);
    this.deps.clearSession();
    this.deps.loadSession();
    const s = this.deps.getState();
    this.deps.onResetUi({ resumeOffered: !!s, newsFrom: s?.eventCount ?? 0, clearError: true });
    this.deps.render();
  }

  setupHandlers() {
    return {
      onCreate: () => void this.enter('host', tableCode()),
      onJoin: (raw: string) => {
        const code = cleanCode(raw);
        if (code) void this.enter('guest', code);
        return !!code;
      },
    };
  }

  initFromLocation(): void {
    const linkCode = codeFromHash(location.hash);
    const savedTable = readSession(HOST_TABLE);
    if (linkCode) void this.enter('guest', linkCode);
    else if (savedTable) {
      try {
        const { code, snap } = JSON.parse(savedTable) as { code: string; snap: HostSnapshot };
        if (cleanCode(code) && snap?.state) void this.enter('host', code, snap);
      } catch {
        writeSession(HOST_TABLE, null);
      }
    }
    window.addEventListener('hashchange', () => {
      const code = codeFromHash(location.hash);
      if (code && code !== this.online?.code) {
        if (this.online) this.leave();
        void this.enter('guest', code);
      }
    });
  }
}

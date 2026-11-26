// Versione per Mac (app desktop fatta con Tauri, cartella src-tauri/).
// Si costruisce con `vite build --mode desktop`: niente gioco online, niente service worker,
// e i link esterni si aprono nel browser di sistema invece che dentro la finestra del gioco.
export const DESKTOP = import.meta.env.MODE === 'desktop';

interface TauriGlobal {
  opener?: { openUrl: (url: string) => Promise<void> };
}

// true se il link va aperto fuori dalla finestra del gioco (pagine web e segnalazioni)
export function isExternalLink(href: string): boolean {
  return /^(https?:|mailto:)/i.test(href);
}

// Nell'app per Mac un link con target="_blank" non aprirebbe niente: lo si passa al browser di sistema.
export function setupDesktopLinks(): void {
  if (!DESKTOP) return;
  document.addEventListener('click', (e) => {
    const link = (e.target as HTMLElement | null)?.closest?.('a[href]') as HTMLAnchorElement | null;
    if (!link || !isExternalLink(link.href)) return;
    const tauri = (window as unknown as { __TAURI__?: TauriGlobal }).__TAURI__;
    if (!tauri?.opener) return;
    e.preventDefault();
    void tauri.opener.openUrl(link.href).catch(() => {});
  });
}

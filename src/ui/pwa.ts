// App installabile e offline: registra il service worker e avvisa quando c'è una versione nuova.
export function setupOffline(): void {
  if (!import.meta.env.PROD || !('serviceWorker' in navigator)) return;
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register(`${import.meta.env.BASE_URL}sw.js`)
      .then((reg) => {
        // versione nuova già scaricata e in attesa
        if (reg.waiting && navigator.serviceWorker.controller) offerUpdate(reg.waiting);
        reg.addEventListener('updatefound', () => {
          const next = reg.installing;
          next?.addEventListener('statechange', () => {
            if (next.state === 'installed' && navigator.serviceWorker.controller) offerUpdate(next);
          });
        });
        // chi tiene il gioco aperto a lungo vede comunque gli aggiornamenti
        setInterval(() => reg.update().catch(() => {}), 60 * 60 * 1000);
      })
      .catch(() => {});
    let reloading = false;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (reloading) return;
      reloading = true;
      // la partita è già salvata a ogni mossa: ricaricando si riprende da dove si era
      location.reload();
    });
  });
}

function offerUpdate(worker: ServiceWorker): void {
  if (document.querySelector('.update-toast')) return;
  const box = document.createElement('div');
  box.className = 'update-toast';
  box.setAttribute('role', 'status');
  box.innerHTML = `<span>✨ C'è una versione nuova di Sdrogopoli.</span>
    <button class="primary" data-update>Aggiorna</button>
    <button class="link" data-later aria-label="Più tardi">Più tardi</button>`;
  box.querySelector('[data-update]')!.addEventListener('click', () => worker.postMessage('aggiorna'));
  box.querySelector('[data-later]')!.addEventListener('click', () => box.remove());
  document.body.append(box);
}

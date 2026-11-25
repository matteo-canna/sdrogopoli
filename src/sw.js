// Service worker di Sdrogopoli: tiene in memoria tutti i file del gioco, così si gioca anche offline.
// L'elenco dei file e la versione li scrive la build (vite.config.ts).
const VERSION = '__VERSIONE__';
const FILES = [/* __FILE__ */];
const CACHE = `sdrogopoli-${VERSION}`;

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(FILES)));
});

self.addEventListener('activate', (event) => {
  // via le versioni vecchie
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k.startsWith('sdrogopoli-') && k !== CACHE).map((k) => caches.delete(k)))),
  );
});

// la pagina chiede di passare subito alla nuova versione quando chi gioca tocca "Aggiorna"
self.addEventListener('message', (event) => {
  if (event.data === 'aggiorna') self.skipWaiting();
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return;
  // la pagina: prima la rete (per vedere subito una versione nuova), se manca quella salvata
  if (req.mode === 'navigate') {
    event.respondWith(fetch(req).catch(() => caches.match('./', { ignoreSearch: true, ignoreVary: true })));
    return;
  }
  // tutto il resto ha il nome con l'impronta o non cambia: prima la copia salvata
  event.respondWith(caches.match(req, { ignoreSearch: true, ignoreVary: true }).then((hit) => hit ?? fetch(req)));
});

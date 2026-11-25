// Service worker di Gioco Folle!: tiene in memoria tutti i file del gioco, così si gioca anche offline.
// L'elenco dei file e la versione li scrive la build (vite.config.ts).
const VERSION = '__VERSIONE__';
const FILES = [/* __FILE__ */];
// la grafica 3D: si salva solo quando la pagina dice che serve
const FILES_3D = [/* __FILE_3D__ */];
// il prefisso "sdrogopoli-" resta quello di prima così le cache vecchie vengono ripulite
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
  // chi usa il 3D lo ritrova anche offline
  if (event.data === 'salva-3d') {
    event.waitUntil(
      caches.open(CACHE).then(async (cache) => {
        for (const f of FILES_3D) if (!(await cache.match(f))) await cache.add(f).catch(() => {});
      }),
    );
  }
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return;
  // la pagina: prima la rete (per vedere subito una versione nuova), se manca quella salvata
  if (req.mode === 'navigate') {
    // cache: 'no-cache' scavalca la copia del browser (GitHub Pages la tiene 10 minuti)
    event.respondWith(fetch(req.url, { cache: 'no-cache', credentials: 'same-origin' }).catch(() => caches.match('./', { ignoreSearch: true, ignoreVary: true })));
    return;
  }
  // tutto il resto ha il nome con l'impronta o non cambia: prima la copia salvata.
  // Quello che non era in elenco (la grafica 3D) si salva la prima volta che arriva.
  event.respondWith(
    caches.match(req, { ignoreSearch: true, ignoreVary: true }).then(
      (hit) =>
        hit ??
        fetch(req).then((res) => {
          if (res.ok && res.type === 'basic') {
            const copy = res.clone();
            event.waitUntil(caches.open(CACHE).then((cache) => cache.put(req, copy)));
          }
          return res;
        }),
    ),
  );
});

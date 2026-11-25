// Carica la grafica 3D solo quando serve (vista 3D o anteprima dei personaggi).
// Chi gioca in 2D non scarica three.js.
type Module3D = typeof import('./three/index');
let pending: Promise<Module3D> | null = null;

export function load3d(): Promise<Module3D> {
  if (!pending) {
    pending = import('./three/index');
    // chi usa il 3D lo ritrova anche offline: il service worker ne salva una copia
    pending
      .then(() => {
        if (import.meta.env.PROD && 'serviceWorker' in navigator) void navigator.serviceWorker.ready.then((reg) => reg.active?.postMessage('salva-3d'));
      })
      .catch(() => {});
    // se il download fallisce (per esempio offline) si potrà riprovare
    pending.catch(() => (pending = null));
  }
  return pending;
}

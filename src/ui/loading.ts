// Schermata di caricamento: è già nella pagina (index.html) e si vede prima ancora che parta il codice.
// Qui si caricano in anticipo i personaggi 3D, si aggiorna la barra e poi la schermata sparisce.
import { LOADING_TIPS } from './intro';

// Tempo minimo, così la schermata non lampeggia, e massimo, così non resta mai bloccata.
const MIN_MS = 900;
const MAX_MS = 12000;

export interface LoadingTask {
  label: string;
  run: () => Promise<unknown>;
}

function wait(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

// Esegue i compiti in parallelo aggiornando la barra; un errore non ferma il gioco
// (per esempio senza personaggi 3D restano le pedine semplici).
export async function runLoading(tasks: LoadingTask[]): Promise<void> {
  const splash = document.querySelector<HTMLElement>('#splash');
  if (!splash) return;
  const bar = splash.querySelector<HTMLElement>('.splash-bar span');
  const status = splash.querySelector<HTMLElement>('.splash-status');
  const tip = splash.querySelector<HTMLElement>('.splash-tip');
  const started = performance.now();
  // un passo in più per il codice del gioco, che a questo punto è già arrivato
  const total = tasks.length + 1;
  let done = 1;
  const update = (label: string) => {
    const pct = Math.round((done / total) * 100);
    splash.classList.add('determinate');
    if (bar) bar.style.width = `${pct}%`;
    splash.querySelector('.splash-bar')?.setAttribute('aria-valuenow', String(pct));
    if (status) status.textContent = label;
  };
  update(tasks.length ? 'Preparo i personaggi…' : 'Pronto!');

  let tipIndex = Math.floor(Math.random() * LOADING_TIPS.length);
  const showTip = () => {
    if (tip) tip.textContent = `💡 ${LOADING_TIPS[tipIndex++ % LOADING_TIPS.length]}`;
  };
  showTip();
  const tipTimer = setInterval(showTip, 3500);

  const all = Promise.all(
    tasks.map((t) =>
      t.run().then(
        () => {
          done++;
          update(done === total ? 'Pronto!' : t.label);
        },
        () => {
          done++;
          update(t.label);
        },
      ),
    ),
  );
  await Promise.race([all, wait(MAX_MS)]);
  const elapsed = performance.now() - started;
  if (elapsed < MIN_MS) await wait(MIN_MS - elapsed);
  clearInterval(tipTimer);
  hideSplash();
}

// Fa sparire la schermata con una dissolvenza e poi la toglie dalla pagina.
export function hideSplash(): void {
  const splash = document.querySelector<HTMLElement>('#splash');
  if (!splash || splash.classList.contains('hide')) return;
  splash.classList.add('hide');
  splash.setAttribute('aria-busy', 'false');
  setTimeout(() => splash.remove(), 450);
}

# Come contribuire a Gioco Folle!

Grazie per voler dare una mano! Queste regole valgono per tutti: persone e IA.

## Il progetto
Gioco Folle! è un gioco da tavolo di compravendita immobiliare che si gioca nel browser.
Nome, caselle, carte e grafica sono originali: non usare mai nomi, carte, testi o grafica di giochi
esistenti. La moneta si chiama foulbucks (Ƒ). Il gioco è e resta completamente gratuito: niente
server, pubblicità, acquisti o servizi a pagamento.

Stack: TypeScript + Vite, interfaccia HTML/CSS (niente React), 3D con three.js, test con Vitest e
Playwright. Stato del lavoro e decisioni prese: [`STATO.md`](STATO.md).

## Struttura delle cartelle
- `src/engine/` — logica di gioco pura, senza DOM né grafica. Il generatore casuale arriva come
  parametro (`Rng`), così i test sono deterministici.
- `src/data/` — tabelloni e carte in JSON (con la traduzione inglese `*.en.json`).
- `src/ui/` — interfaccia; `src/ui/three/` — vista 3D.
- `src/i18n/` — tutte le frasi: `it.ts` ed `en.ts` con le stesse chiavi.
- `src/net/` — gioco online peer-to-peer.
- `tests/` — test del motore (Vitest); `tests/helpers.ts` ha `newGame`, `ctxWith`, `own`, `indexOf`.
- `e2e/` — test nel browser (Playwright).
- `scripts/` — simulazioni e strumenti (`npm run simula`, `livelli`, `quote`…).
- `docs/` — documentazione delle regole, del bilanciamento e delle scelte.

## Regole per il codice
- Nomi di variabili e funzioni in inglese, commenti in italiano.
- Ogni nuova regola di gioco ha almeno un test in `tests/`.
- Nuovi campi in `GameState` o `GameRules` (`src/engine/state.ts`) devono essere facoltativi o ricevere
  un valore in `migrateState` (`src/engine/save.ts`): le partite salvate prima devono continuare ad aprirsi.
- Ogni testo nuovo visibile va in `src/i18n/it.ts` **e** in `src/i18n/en.ts`.
- Non toccare file che il compito non nomina; se serve, dillo chiaramente nella PR.
- Non aggiungere dipendenze npm senza dirlo e spiegare perché.
- Alla fine aggiungi una riga in fondo alla sezione "Fatto finora" di `STATO.md`, in italiano semplice,
  che inizia con la data di oggi.

## Comandi
- `npm install` — installa le dipendenze
- `npm run dev` — avvia il gioco in locale
- `npm test` — test del motore (Vitest)
- `npm run build` — controllo dei tipi e versione pubblicabile in `dist/`
- `npm run e2e` — test nel browser (Playwright); va lanciato **dopo** `npm run build`, perché prova la
  build in `dist/`. La prima volta serve `npx playwright install chromium`.

Lo stesso controllo (unit test + build + test nel browser) parte da solo su GitHub per ogni PR: è il
controllo **build**.

## Come si apre una PR
1. **Un compito = un ramo = una PR.** Crea un ramo nuovo da `main` aggiornato, ad esempio
   `ia/terzo-tabellone`. Mai lavorare o caricare file direttamente su `main`.
2. Fai le modifiche, prova con `npm test` (e `npm run build`), aggiungi la riga in `STATO.md`.
3. Apri la PR verso `main` e compila il modello che compare.
4. Nella scheda **Files changed** controlla che ogni file stia al suo posto (`src/…`, `tests/…`,
   `docs/…`) e che non ci siano file fuori dall'elenco del compito.
5. Aspetta il segno verde del controllo **build**, poi **Squash and merge**.

Un compito alla volta: due PR aperte insieme rischiano conflitti (soprattutto su `STATO.md`,
`src/i18n/*.ts`, `src/engine/state.ts`).

### Niente cartelle copiate
Il gioco pubblicato si costruisce **solo** dai file nella radice del repository (`src/`, `public/`,
`index.html`…). **Mai caricare la cartella del progetto dentro il repository** (es. con "Add files via
upload"): si crea una seconda copia (`sdrogopoli/src/…`) che il sito ignora, il lavoro non compare nel
gioco e chi viene dopo trova due versioni dello stesso file. Per aggiungere un file dal sito di GitHub
entra prima nella cartella giusta e carica **solo il file**; se nella pagina di commit vedi percorsi come
`sdrogopoli/src/...`, annulla.

## Cosa non rinominare
Il gioco prima si chiamava "Sdrogopoli". Questi nomi restano apposta, perché cambiarli romperebbe
partite salvate e link:
- il nome del repository e l'indirizzo del sito `/sdrogopoli/`;
- le chiavi salvate nel browser `sdrogopoli-…`;
- i codici interni dei file esportati, il codice della partita del giorno, il canale online e il nome
  della cache offline.

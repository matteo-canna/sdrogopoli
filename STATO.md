# Stato del progetto

_Aggiornare alla fine di ogni sessione di lavoro._

## Obiettivo attuale
Prototipo giocabile nel browser, completamente gratuito (niente server, pubblicità o acquisti).

## Piano
1. ✅ Base del progetto: Vite + TypeScript + Vitest, cartelle, pubblicazione su GitHub Pages.
2. ✅ Contenuti originali: tabellone, caselle, prezzi, affitti e carte in JSON (`src/data/`).
3. ✅ Motore di gioco con test: turni, dadi, movimento, acquisto, affitti, carte, prigione, bancarotta, vincitore.
4. ✅ Interfaccia minima
5. 🟡 Vista 3D con camera che segue la pedina (in revisione): tabellone HTML/CSS, 2-4 giocatori sullo stesso dispositivo.

## Decisioni
- Interfaccia in HTML/CSS + TypeScript semplice (niente React per ora; si può rivalutare).
- Vista 3D con Three.js (gratuito, licenza MIT) in `src/ui/three/`. Resta disponibile la vista 2D, usata anche se il browser non supporta WebGL.
- Il motore riceve il generatore casuale come parametro (`Rng`), così i test sono deterministici.
- Hosting: GitHub Pages (richiede repository pubblico).
- Valuta: sdroghi (Ꞩ), 1500 a testa all'inizio, 200 di stipendio alla Partenza.
- Mazzi di carte: "Colpo di Sorte" e "Voci di Quartiere" (12 carte ciascuno).

## Fatto finora
- 2026-11-23: struttura iniziale, lancio dei dadi nel motore con test, pagina provvisoria.
- 2026-11-23: proposta di tabellone (40 caselle, 8 quartieri) e 24 carte in `src/data/`, con test di coerenza dei dati.
- 2026-11-23: motore di gioco (`state.ts`, `rules.ts`) con 39 test: turni, doppi, Caserma, acquisto, affitti, carte, case, ipoteche, debiti e bancarotta.
- 2026-11-23: interfaccia con tabellone HTML/CSS, schermata iniziale 2-4 giocatori, scheda delle caselle, gestione case/ipoteche, partita salvata nel browser.
- 2026-11-23: vista 3D: tabellone con caselle disegnate, pedine che saltano casella per casella, case e palazzi, camera che segue la pedina o vista d'insieme.
- 2026-11-23: avversari controllati dal computer (`src/engine/bot.ts`), scelta Persona/Computer nella schermata iniziale.

## Regole semplificate nel prototipo
- Se un giocatore non compra una casella, resta libera (niente asta).
- Niente scambi tra giocatori.
- Con un debito il giocatore vende case o ipoteca; se non basta dichiara bancarotta.

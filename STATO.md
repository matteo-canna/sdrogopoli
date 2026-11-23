# Stato del progetto

_Aggiornare alla fine di ogni sessione di lavoro._

## Obiettivo attuale
Prototipo giocabile nel browser, completamente gratuito (niente server, pubblicità o acquisti).

## Piano
1. ✅ Base del progetto: Vite + TypeScript + Vitest, cartelle, pubblicazione su GitHub Pages.
2. ⬜ Contenuti originali: tabellone, caselle, prezzi, affitti e carte in JSON (`src/data/`).
3. ⬜ Motore di gioco con test: turni, dadi, movimento, acquisto, affitti, carte, prigione, bancarotta, vincitore.
4. ⬜ Interfaccia minima: tabellone HTML/CSS, 2-4 giocatori sullo stesso dispositivo.

## Decisioni
- Interfaccia in HTML/CSS + TypeScript semplice (niente React per ora; si può rivalutare).
- Il motore riceve il generatore casuale come parametro (`Rng`), così i test sono deterministici.
- Hosting: GitHub Pages (richiede repository pubblico).

## Fatto finora
- 2026-11-23: struttura iniziale, lancio dei dadi nel motore con test, pagina provvisoria.

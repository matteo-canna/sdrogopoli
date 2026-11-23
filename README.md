# Sdrogopoli

Gioco da tavolo digitale ispirato ai giochi di compravendita immobiliare. Nome, caselle, carte e grafica sono originali. Gratuito.

## Comandi
- `npm install` — installa le dipendenze
- `npm run dev` — avvia il gioco in locale
- `npm test` — esegue i test del motore
- `npm run build` — crea la versione pubblicabile in `dist/`

## Struttura
- `src/engine/` — logica di gioco pura (nessun codice grafico)
- `src/ui/` — interfaccia e rendering
- `src/data/` — caselle, proprietà, carte (JSON)
- `tests/` — test del motore

Stato e decisioni: vedi [`STATO.md`](STATO.md).

# Sdrogopoli

Gioco da tavolo digitale ispirato ai giochi di compravendita immobiliare. Nome, caselle, carte, diorama urbano 3D e 30 pedine 3D realistiche sono originali e gratuiti.

## Comandi
- `npm install` — installa le dipendenze
- `npm run dev` — avvia il gioco in locale
- `npm test` — esegue i test del motore e del catalogo
- `npm run build` — verifica TypeScript e crea la versione pubblicabile in `dist/`

## Struttura
- `src/engine/` — logica di gioco pura (nessun codice grafico)
- `src/ui/` — interfaccia 2D/3D e rendering PBR (`src/ui/three/`)
- `src/data/` — caselle, proprietà, carte (JSON)
- `tests/` — test automatici Vitest

Stato e decisioni: vedi [`STATO.md`](STATO.md).

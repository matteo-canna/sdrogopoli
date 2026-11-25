# Sdrogopoli

Gioco da tavolo digitale ispirato ai giochi di compravendita immobiliare. Nome, caselle, carte e grafica sono originali. Gratuito.

## Comandi
- `npm install` — installa le dipendenze
- `npm run dev` — avvia il gioco in locale
- `npm test` — esegue i test del motore
- `npm run build` — crea la versione pubblicabile in `dist/`
- `npm run build:itch` — crea `dist-itch/` con percorsi relativi e `sdrogopoli-itch.zip` da caricare su itch.io (vedi [`docs/itch.md`](docs/itch.md))

## Struttura
- `src/engine/` — logica di gioco pura (nessun codice grafico)
- `src/ui/` — interfaccia e rendering
- `src/data/` — caselle, proprietà, carte (JSON)
- `tests/` — test del motore

Stato e decisioni: vedi [`STATO.md`](STATO.md).

## Crediti
- Personaggi 3D: [KayKit Adventurers](https://kaylousberg.com) di Kay Lousberg, licenza CC0 (vedi `public/characters/LICENSE-KayKit.txt`).

## Licenza
Il codice e i contenuti originali di Sdrogopoli sono distribuiti con licenza MIT (vedi [`LICENSE`](LICENSE)). I personaggi KayKit restano sotto la loro licenza CC0, three.js e Trystero sotto la loro licenza MIT.

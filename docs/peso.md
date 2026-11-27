# Peso della build iniziale

Per evitare che il gioco diventi lento da aprire senza accorgersene, la CI esegue `npm run peso` subito dopo `npm run build` (`.github/workflows/deploy.yml`).

Lo script `scripts/peso.ts` legge `dist/index.html`, raccoglie solo i file JS e CSS caricati all'avvio (`<script src>`, `<link rel="stylesheet">` e `<link rel="modulepreload">`), li comprime con `zlib.gzipSync` ed esce con codice 1 se il totale supera la soglia `MAX_GZIP_BYTES`. I moduli caricati su richiesta con `import()` (come la vista 3D con three.js, le pedine da collezione, l'editor di tabelloni e il modulo online Trystero) non rientrano nel peso iniziale.

## Misura attuale (26 novembre 2026)

| File | Originale | Gzip | Gzip (byte) |
| --- | ---: | ---: | ---: |
| `assets/index-*.js` | 306.82 KB | 98.25 KB | 100 606 |
| `assets/index-*.css` | 67.71 KB | 14.36 KB | 14 701 |
| **Totale** | **374.53 KB** | **112.60 KB** | **115 307** |

- **Soglia attuale (`MAX_GZIP_BYTES`)**: **132 604 byte** (129.50 KB), pari al totale iniziale +15%.
- **Margine residuo**: 17 297 byte (16.89 KB).

## Come verificare in locale

```bash
npm run build && npm run peso
```

## Come alzare la soglia

Se una nuova funzione giustifica un aumento stabile del codice iniziale:

1. Controlla prima se il nuovo codice può essere spostato dietro un `import()` dinamico (come `src/ui/lazy3d.ts` o `src/ui/boardEditor.ts`), così non pesa sull'avvio.
2. Se l'aumento è davvero necessario all'avvio, aggiorna la costante `MAX_GZIP_BYTES` in cima a `scripts/peso.ts` (ad esempio al nuovo totale +15%).
3. Aggiorna la tabella e la data in questo file (`docs/peso.md`) e spiega il motivo dell'aumento nella descrizione della PR.

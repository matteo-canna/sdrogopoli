# Pubblicare Gioco Folle! su itch.io

Il gioco gira tutto nel browser, quindi su itch.io si carica come "HTML game": un file .zip
con dentro `index.html` e il resto. È gratis e non serve nessun server.

## 1. Preparare il file

```bash
npm run build:itch
```

Scrive `dist-itch/` (la stessa build di GitHub Pages ma con i percorsi relativi, perché su itch.io
il gioco sta in una cartella con un indirizzo che non conosciamo prima) e il file
`gioco-folle-itch.zip` pronto da caricare. Sono circa 0,9 MB.

## 2. Creare la pagina su itch.io

1. Entra su [itch.io](https://itch.io) e scegli **Upload new project**.
2. **Title**: `Gioco Folle!`. **Short description**: "Compra le vie della città, costruisci case e manda in rovina gli amici."
3. **Classification**: `Games`. **Kind of project**: `HTML`.
4. **Pricing**: `No payments`. Niente donazioni, come deciso: il gioco resta gratuito senza nessuna richiesta di soldi.
5. **Uploads**: carica `gioco-folle-itch.zip` e spunta **This file will be played in the browser**.
6. **Embed options**:
   - *Viewport dimensions*: 1280 × 800 (il gioco si adatta da solo, ma questa misura è comoda sul computer).
   - *Fullscreen button*: sì.
   - *Mobile friendly*: sì, con *Orientation* su `Default` (il gioco ha una versione per telefono).
7. **Community**: a tua scelta (i commenti vanno bene, non c'è niente da moderare nel gioco).
8. **Visibility**: `Public` quando sei pronto.

## 3. Cosa cambia rispetto a GitHub Pages

- L'indirizzo è di itch.io e il gioco sta dentro un iframe: va tutto, compresi 3D, suoni e salvataggi.
- Il gioco online tra amici funziona anche qui (usa gli stessi relay pubblici).
- L'installazione come app e il funzionamento offline restano solo sulla versione di GitHub Pages:
  dentro l'iframe di itch.io il browser non permette sempre il service worker, e il gioco se ne accorge
  da solo e continua a funzionare normalmente.
- I salvataggi stanno nel browser e sono separati da quelli della versione su GitHub Pages: il profilo
  si può portare da una parte all'altra con "Esporta il profilo" e "Importa un profilo".

## 4. Aggiornare

Rifai `npm run build:itch` e carica il nuovo zip al posto del vecchio (stesso upload, pulsante
**Replace file**). Chi gioca vede subito la versione nuova.

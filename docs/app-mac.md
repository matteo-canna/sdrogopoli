# Gioco Folle! per Mac

Versione del gioco da installare sul proprio Mac, per giocare senza browser e senza internet.
È la stessa partita del sito, con queste differenze:

- niente gioco online (tavoli con gli amici): si gioca da 2 a 8 sullo stesso computer, anche contro il computer;
- partite, salvataggi e preferenze restano nell'app (separati da quelli del browser);
- i link esterni (crediti, "Segnala un problema") si aprono nel browser.

Funziona sui Mac con processore Intel e su quelli Apple (M1, M2…), da macOS 10.15 in poi.

## Scaricare l'app

1. Su GitHub apri **Actions** → **App per Mac** e scegli l'ultimo run verde di `main`
   (oppure **Run workflow** per farne uno nuovo).
2. In fondo alla pagina, in **Artifacts**, scarica `gioco-folle-mac` (è uno zip).
3. Dentro ci sono il file `.dmg` e lo stesso programma già pronto in `Gioco Folle (app).zip`.

## Installarla

1. Apri il `.dmg` e trascina **Gioco Folle!** nella cartella **Applicazioni**.
2. La prima volta il Mac dice che non può verificare lo sviluppatore (l'app non è firmata da Apple,
   perché serve un account a pagamento). Per aprirla:
   - **tasto destro** (o ctrl+clic) sull'app in Applicazioni → **Apri** → **Apri**;
   - se non c'è il pulsante "Apri" (macOS 15 Sequoia e successivi): **Impostazioni di Sistema** →
     **Privacy e sicurezza** → in fondo, accanto a "Gioco Folle!", **Apri comunque**.
3. Dalla seconda volta si apre normalmente, anche dal Launchpad o dal Dock.

Se il Mac dice che l'app "è danneggiata", nel Terminale:

```sh
xattr -dr com.apple.quarantine "/Applications/Gioco Folle!.app"
```

## Costruirla sul proprio Mac (facoltativo)

Servono Node 22 e Rust (https://rustup.rs). Dalla cartella del progetto:

```sh
npm ci
npm run mac         # apre l'app in prova, si aggiorna mentre si modifica il codice
npm run build:mac   # crea .app e .dmg in src-tauri/target/release/bundle/
```

## Come è fatta

- `src-tauri/`: l'app Tauri 2 (una finestra che mostra il gioco; i file del gioco sono dentro l'app).
- `npm run build:desktop` costruisce il gioco in `dist-desktop/` con `--mode desktop`:
  `src/ui/platform.ts` (`DESKTOP`) toglie il gioco online, il service worker e manda i link esterni al browser.
- `.github/workflows/mac.yml` costruisce l'app su un Mac di GitHub a ogni push su `main`.

# I tabelloni

Si sceglie prima di iniziare, nella schermata iniziale. Il tabellone scelto resta per la prossima
partita e finisce nel salvataggio, così una partita ripresa torna sul suo.

| | Città sul Lago (`citta`) | Isola dei Venti (`isola`) | Valle Stretta (`valle`) |
| --- | --- | --- | --- |
| caselle | 40 (10 per lato) | 32 (8 per lato) | 28 (7 per lato) |
| quartieri | 8 | 7 | 6 |
| vie in vendita | 22 | 18 | 15 |
| fermate / servizi | 4 / 2 | 3 / 1 | 2 / 1 |
| giri per finire (4 computer) | 48 (mediana) | 33 (mediana) | 28 (mediana) |

I rapporti di equilibrio li scrivono `npm run simula` (`docs/bilanciamento.md`),
`npm run simula -- 300 4 docs/bilanciamento-isola.md isola` (`docs/bilanciamento-isola.md`) e
`npm run simula:valle` (`docs/bilanciamento-valle.md`).

Online si gioca sempre sul tabellone predefinito, così chi crea il tavolo e chi entra vedono le
stesse caselle; anche la partita del giorno usa quello, perché sia uguale per tutti.

## Com'è fatto un tabellone

Un tabellone è un file JSON in `src/data/`, elencato in `src/data/boards.ts` insieme ai nomi
inglesi delle sue caselle. Regole da rispettare (le controlla `tests/data.test.ts` per ogni
tabellone, quindi un tabellone sbagliato non passa la build):

- il numero di caselle è un multiplo di 4: un quarto per lato, e gli angoli sono in comune.
  Agli angoli ci vanno le caselle senza prezzo: Partenza (sempre la prima), prigione, sosta e
  "vai in prigione".
- ogni quartiere ha almeno due vie, un colore suo e diverso da quelli del gioco classico;
- gli affitti crescono con le case e l'ipoteca vale meno del prezzo;
- servono almeno due fermate, un servizio, una tassa e caselle di tutti e due i mazzi;
- gli id delle caselle sono diversi da quelli di ogni altro tabellone (il registro di una partita
  vecchia resta leggibile), e tutte le caselle che non sono vie hanno il nome inglese.

Le carte sono le stesse per tutti i tabelloni. Quelle che mandano su una casella precisa non ne
scrivono l'id, ma un **ruolo** (`partenza`, `lusso`, `studio`); ogni tabellone dice qual è la sua
casella per quel ruolo, nel campo `targets`. Nel testo della carta `{space}` diventa il nome della
casella del tabellone in uso, quindi la stessa carta si legge bene dappertutto.

Il disegno non va toccato: il 2D e il 3D calcolano la griglia dalla lunghezza del tabellone
(`perSide`, `gridPosition`, `boardStyle` in `src/ui/view.ts`, `spaceCenter` in
`src/ui/three/layout.ts`), e nel 3D la base, il centro, le decorazioni e la vista d'insieme si
riducono insieme a lui.

## Tabelloni fatti dai giocatori

Nella schermata iniziale, sotto i tabelloni, "✏️ Crea o modifica un tabellone" apre l'editor
(`src/ui/boardEditor.ts`, scaricato solo quando si apre). Si parte da un tabellone del gioco o da
uno fatto prima e si cambiano nome, soldi iniziali, nomi e colori dei quartieri, nomi delle
caselle, prezzi e tasse. Cambiando il prezzo di una via, affitti e ipoteca lo seguono
(`withPrice`: gli affitti restano crescenti, il prezzo delle case resta quello). La forma del
tabellone, cioè quante caselle e di che tipo, resta quella di partenza: chi vuole cambiarla scrive
il file a mano e lo importa.

Un tabellone fatto così ha i nomi in una lingua sola: quella in cui è stato scritto. Mentre si
gioca su di lui i nomi vengono dai suoi dati (`spaceName` e `groupName` in `src/i18n/index.ts`),
anche se riusa gli id delle caselle del tabellone di partenza.

**Il controllo.** Tutto quello che entra (editor, file, link, partita salvata) passa da
`validateBoard` in `src/engine/boardCheck.ts`, che restituisce una copia pulita con solo i campi
che il gioco conosce, oppure l'elenco degli errori (codici tradotti con le chiavi `boardErr.*`).
Oltre alle regole qui sopra controlla che niente possa diventare codice nella pagina: id con sole
lettere minuscole, cifre e trattini, colori `#rrggbb`, nomi senza `< > & "` (l'apostrofo va bene),
lunghezze e numeri entro limiti fissi, da 20 a 48 caselle, al massimo 4 fermate e 2 servizi, e
le carte "vai a" che trovano la loro casella.

**Dove stanno.** `src/ui/boardStore.ts`:

- *nel browser*: "Salva e scegli" li mette in `sdrogopoli-tabelloni` (al massimo 12) e li rende
  sceglibili. L'id si calcola dal contenuto (`mio-…`), quindi lo stesso tabellone arrivato due
  volte non si doppia, e salvando una modifica la versione nuova prende il posto della vecchia;
- *in un file*: "Esporta file" scarica un `.folle-tabellone`
  (`{ kind: "sdrogopoli-tabellone", version: 1, board }`), "Importa un file" lo rilegge;
- *in un link*: "Copia il link" dà un indirizzo `#tabellone=…` con il tabellone intero compresso
  (deflate e base64url, circa 2 KB per Valle Stretta). Chi lo apre se lo trova tra i suoi
  tabelloni, già scelto per la prossima partita, e l'indirizzo si ripulisce. Niente server;
- *in una partita*: il salvataggio di una partita su un tabellone dell'editor porta con sé i dati
  (`boardData`), così si riprende, si esporta e si rivede anche su un altro dispositivo; lì il
  tabellone vale per quella partita e non finisce tra quelli salvati.

Online e partita del giorno restano sul tabellone predefinito.

Prove: `tests/editor.test.ts` (controllo, prezzi, salvataggio, file, link, una partita intera sul
tabellone nuovo e il suo salvataggio aperto altrove) ed `e2e/editor.spec.ts`.

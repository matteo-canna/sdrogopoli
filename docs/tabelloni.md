# I tabelloni

Si sceglie prima di iniziare, nella schermata iniziale. Il tabellone scelto resta per la prossima
partita e finisce nel salvataggio, così una partita ripresa torna sul suo.

| | Città sul Lago (`citta`) | Valle Stretta (`valle`) |
| --- | --- | --- |
| caselle | 40 (10 per lato) | 28 (7 per lato) |
| quartieri | 8 | 6 |
| vie in vendita | 22 | 15 |
| fermate / servizi | 4 / 2 | 2 / 1 |
| giri per finire (4 computer) | 48 (mediana) | 28 (mediana) |

I rapporti di equilibrio li scrivono `npm run simula` (`docs/bilanciamento.md`) e
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

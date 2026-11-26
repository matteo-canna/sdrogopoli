# Compiti da far fare a un'altra IA

_Preparato il 25 novembre 2026, dopo la PR #58 (moneta foulbucks, già unita). Ogni compito è indipendente dagli altri: si può
farne uno, provarlo, unirlo e passare al successivo._

Come usare questo file:

1. Leggi la **guida all'integrazione** qui sotto (serve a non ripetere l'errore della cartella copiata).
2. All'inizio di ogni conversazione con l'altra IA incolla il **prompt di base**.
3. Poi incolla il **prompt del compito** che hai scelto.
4. Quando l'IA ha finito, porta il lavoro su GitHub come spiegato nella guida e apri una PR.

Legenda della colonna "Rischio":
🟢 tocca solo file suoi, nessun conflitto previsto ·
🟡 tocca file condivisi, conviene farlo da solo e unirlo subito ·
🔴 si sovrappone a lavoro in corso: aspettare (vedi in fondo).

---

## Guida all'integrazione su GitHub

### La regola d'oro
**Un compito = un ramo (branch) = una PR.** Mai caricare file direttamente su `main`, mai caricare
una cartella intera del progetto.

### Perché la cartella copiata è un problema
Il gioco pubblicato si costruisce **solo** dai file nella radice del repository (`src/`, `public/`,
`index.html`…). Se carichi la cartella del progetto con "Add files via upload", GitHub crea
`sdrogopoli/src/…` dentro il repository: una seconda copia che il sito ignora. Il lavoro sembra
caricato ma nel gioco non compare niente, e chi viene dopo trova due versioni dello stesso file.

### Caso A: l'IA ha accesso diretto al repository (Codex, Copilot, Claude Code…)
1. Dille di lavorare su un ramo nuovo, ad esempio `ia/terzo-tabellone`, e di aprire la PR verso `main`.
2. Apri la PR su GitHub, scheda **Files changed**: controlla che i percorsi siano quelli attesi
   (vedi la colonna "File" del compito) e che non ci siano file fuori dall'elenco.
3. Aspetta il segno verde del controllo **build** (unit test + build + test nel browser).
4. **Squash and merge**.

### Caso B: l'IA ti dà i file e li carichi tu dal sito di GitHub
1. Su github.com, nel repository, apri il menu dei rami (in alto a sinistra, dice `main`), scrivi un
   nome nuovo (es. `ia/terzo-tabellone`) e scegli **Create branch**. Da qui in poi lavori su quel ramo.
2. Per **modificare un file che esiste già**: aprilo, matita ✏️ in alto a destra, incolla il contenuto
   nuovo al posto di quello vecchio, **Commit changes** sul ramo nuovo.
3. Per **aggiungere un file nuovo**: entra prima nella cartella giusta (es. clicca `src`, poi `data`),
   poi **Add file → Upload files** e trascina **solo il file**, non la cartella che lo contiene.
   In alternativa **Add file → Create new file** e scrivi il percorso completo nel nome
   (es. `src/data/board.isola.json`): GitHub crea le cartelle da solo.
4. Mai trascinare una cartella chiamata `sdrogopoli`, `gioco-folle`, `src` o simili dalla radice:
   se nella pagina di commit vedi percorsi come `sdrogopoli/src/...`, annulla.
5. Quando hai caricato tutto, GitHub mostra **Compare & pull request**: aprila verso `main`.
6. Nella PR, scheda **Files changed**: ogni file deve stare al suo posto (`src/…`, `tests/…`,
   `docs/…`). Se qualcosa è finito in una sottocartella sbagliata, cancellalo da lì (apri il file,
   menu "…" → Delete file) e ricaricalo nel posto giusto.
7. Aspetta il controllo verde **build**. Se è rosso, apri "Details", copia l'errore e dallo all'IA.
8. **Squash and merge**, poi elimina il ramo.

### Altre buone abitudini
- **Un compito alla volta.** Se ne fai due in parallelo, il secondo può andare in conflitto col primo
  (soprattutto `STATO.md`, `src/i18n/*.ts`, `src/engine/state.ts`). Unisci il primo, poi parti col secondo
  partendo dal `main` aggiornato.
- **Dai all'IA i file aggiornati.** Se l'IA non legge il repository da sola, dalle sempre le versioni
  dei file presi da `main` in quel momento, non copie vecchie.
- **Conflitto su `STATO.md`?** Nella PR premi "Resolve conflicts", tieni le righe di entrambi
  (cancella solo i segni `<<<<<<<`, `=======`, `>>>>>>>`), "Mark as resolved", "Commit merge".
- **Cosa non toccare mai senza motivo**: il nome del repository, l'indirizzo `/sdrogopoli/`, le chiavi
  `sdrogopoli-…` salvate nel browser e i codici interni dei file esportati (rompono partite e link).
- **Se il controllo build non parte** su una PR aperta dal sito, va bene lo stesso aspettare un minuto
  e ricaricare: parte da solo per ogni PR.

---

## Prompt di base (da incollare all'inizio di ogni conversazione)

```text
Lavori sul gioco "Gioco Folle!", un gioco da tavolo di compravendita immobiliare nel browser
(repository GitHub matteo-canna/sdrogopoli). Nome, caselle, carte e grafica sono originali: non usare
mai nomi, carte, testi o grafica di giochi esistenti. La moneta si chiama foulbucks, simbolo Ƒ.
Il gioco è e resta completamente gratuito: niente server, pubblicità, acquisti, servizi a pagamento.

Stack: TypeScript + Vite, interfaccia HTML/CSS (niente React), 3D con three.js, test con Vitest
(cartella tests/) e Playwright (cartella e2e/). Comandi: npm test, npm run build, npm run e2e.

Struttura:
- src/engine/ logica di gioco pura, senza DOM né grafica; testabile da sola. Il generatore casuale
  arriva come parametro (Rng), così i test sono deterministici.
- src/data/ tabelloni e carte in JSON (con traduzione inglese *.en.json).
- src/ui/ interfaccia; src/ui/three/ vista 3D; src/i18n/it.ts ed en.ts tutte le frasi (stesse chiavi).
- src/net/ gioco online peer-to-peer.
- tests/ test del motore (tests/helpers.ts ha newGame, ctxWith, own, indexOf).

Regole per il codice:
- Nomi di variabili e funzioni in inglese, commenti in italiano.
- Ogni nuova regola di gioco ha almeno un test in tests/.
- Nuovi campi in GameState o GameRules (src/engine/state.ts) devono essere facoltativi o ricevere un
  valore in migrateState (src/engine/save.ts): le partite salvate prima devono continuare ad aprirsi.
- Ogni testo nuovo visibile va in src/i18n/it.ts E in src/i18n/en.ts.
- Non cambiare le chiavi del browser "sdrogopoli-…" né l'indirizzo /sdrogopoli/.
- Non toccare file che il compito non nomina; se devi farlo, dillo chiaramente alla fine.
- Non aggiungere dipendenze npm senza dirlo e spiegare perché.
- Alla fine aggiungi una riga in fondo alla sezione "Fatto finora" di STATO.md, in italiano semplice,
  che inizia con la data di oggi.

Quando hai finito dammi:
1. l'elenco dei file nuovi o modificati, ognuno con il PERCORSO COMPLETO dalla radice del repository
   (es. src/engine/rules.ts), e il contenuto completo di ognuno;
2. il titolo e la descrizione per la pull request;
3. cosa hai provato e cosa no.
Se hai accesso al repository, lavora su un ramo nuovo e apri una pull request verso main invece di
darmi i file.
```

---

## Elenco dei compiti

| # | Compito | Area | Rischio | Grandezza |
|---|---|---|---|---|
| 1 | Test di invarianti con partite casuali | test | 🟢 | M |
| 2 | Test: ogni tabellone si gioca fino in fondo | test | 🟢 | S |
| 3 | Test di compatibilità dei salvataggi | test | 🟢 | S |
| 4 | Regolamento completo per i giocatori | docs | 🟢 | M |
| 5 | Guida per contribuire e modello di PR | docs/.github | 🟢 | S |
| 6 | Modelli per le segnalazioni su GitHub | .github | 🟢 | S |
| 7 | Terzo tabellone "Isola dei Venti" | data | 🟡 | M |
| 8 | Regola facoltativa: prestiti dalla banca | engine | 🟡 | L |
| 9 | Regola facoltativa: riscatto dell'ipoteca all'acquisto | engine | 🟡 | M |
| 10 | Regola facoltativa: tassa sul patrimonio a fine giro | engine | 🟡 | M |
| 11 | Regola facoltativa: aste con rilancio minimo crescente | engine | 🟡 | M |
| 12 | Computer: offerte all'asta più furbe | engine | 🟡 | M |
| 13 | Computer: valuta meglio gli scambi | engine | 🟡 | M |
| 14 | Simulazione per le nuove regole | scripts | 🟢 | S |
| 15 | Controlli in più nel validatore dei tabelloni | engine | 🟢 | S |
| 16 | Dieci traguardi nuovi | ui | 🟡 | M |
| 17 | Premi nuovi a fine partita | ui | 🟡 | S |
| 18 | Effetti sonori in più | ui | 🟢 | S |
| 19 | Finestra "Scorciatoie da tastiera" | ui | 🟡 | S |
| 20 | Rivincita con gli stessi giocatori | ui | 🟡 | M |
| 21 | Rivincita nel gioco online | net/ui | 🟡 | M |
| 22 | Terza lingua: spagnolo | i18n | 🟡 | M |
| 23 | Test nel browser: annulla, scambio, asta | e2e | 🟢 | M |
| 24 | Controllo del peso della build in CI | ci/scripts | 🟢 | S |
| 25 | Dividere `rules.ts` in moduli | engine | 🟡 da solo | L |
| 26 | Dividere `main.ts` in moduli | ui | 🔴 dopo il restyling | L |
| 27 | Storico delle partite nel profilo | ui | 🟡 | M |
| 28 | Mazzo extra "Imprevisti del Cantiere" (regola facoltativa) | data/engine | 🟡 | M |
| 29 | Esporta il registro della partita in testo | ui | 🟢 | S |
| 30 | Statistiche per tabellone nella pagina di bilanciamento | scripts/docs | 🟢 | S |

Grandezza: S = un'ora o meno di lavoro dell'IA, M = qualche ora, L = da spezzare in più passi.

Consiglio sull'ordine: comincia dai 🟢 di test e documentazione (1–6), che non possono rompere il
gioco e rendono più sicuri tutti gli altri. Poi un compito 🟡 alla volta.

---

### 1. Test di invarianti con partite casuali 🟢

**Obiettivo.** Far giocare al motore centinaia di partite tra computer con semi diversi e controllare
dopo ogni mossa che non succedano cose impossibili. Trova bug che i test scritti a mano non vedono.

**File.** Nuovo `tests/invarianti.test.ts`. Solo lettura di `src/engine/` e `tests/helpers.ts`.

**Fatto quando.**
- Almeno 50 partite (4 giocatori computer, tabellone Città sul Lago) con semi fissi, più 20 su Valle
  Stretta, più 20 con regole facoltative accese (eventi, ruota, quote, edifici speciali, squadre).
- Dopo ogni azione si controlla: nessun soldo negativo fuori dalla fase di debito; case tra 0 e 5;
  case solo su vie di un quartiere intero dello stesso proprietario; nessuna casa su una via ipotecata;
  ogni proprietà ha al massimo un proprietario e quel giocatore non è fallito; posizione tra 0 e numero
  di caselle − 1; il turno tocca a un giocatore non fallito; la partita finisce entro un numero
  massimo di azioni.
- Il test dura meno di 20 secondi in tutto (`npm test`).
- Se trova un bug vero: **non correggerlo**, segna il caso con `it.fails` o `it.skip` e un commento
  che spiega il seme e la mossa, e descrivilo nella PR.

**Test.** Il file stesso.

**Prompt.**
```text
Compito: scrivi tests/invarianti.test.ts, un test che fa giocare al motore molte partite tra
computer con semi fissi e controlla dopo ogni azione delle regole che non devono mai essere violate.
Leggi prima src/engine/index.ts, state.ts, rules.ts (applyAction, actingPlayer), bot.ts (come il
computer sceglie l'azione) e tests/bot.test.ts per vedere come si fa giocare una partita intera.
Partite: 50 a 4 computer su "citta", 20 su "valle" (src/data/boards.ts), 20 con le regole facoltative
events, wheel, shares, landmarks e teams accese (GameRules in state.ts).
Invarianti dopo ogni azione: soldi >= 0 tranne durante la fase di debito; case tra 0 e 5; case solo
su quartieri completi dello stesso proprietario e mai su vie ipotecate; proprietario sempre un
giocatore non fallito; posizione valida; il turno tocca a un giocatore non fallito; la partita finisce
entro un limite di azioni ragionevole (misuralo e mettine il doppio).
Il test deve durare meno di 20 secondi. Se trovi un bug vero non correggere il motore: segna il caso
con it.fails e un commento con seme e mossa, e descrivilo nella risposta.
Non modificare file in src/.
```

---

### 2. Test: ogni tabellone si gioca fino in fondo 🟢

**Obiettivo.** Un test che prende **ogni** tabellone registrato in `BOARDS` e fa finire una partita tra
computer. Così quando arriva un tabellone nuovo (compito 7) è controllato in automatico.

**File.** Nuovo `tests/tabelloni-completi.test.ts`.

**Fatto quando.** Per ogni voce di `BOARDS`: `validateBoard` non trova errori, una partita a 3 e una
a 6 computer finisce con un vincitore, e le carte che spostano su una casella "per ruolo" trovano la
casella giusta. Meno di 10 secondi.

**Prompt.**
```text
Compito: scrivi tests/tabelloni-completi.test.ts. Per ogni tabellone in BOARDS
(src/data/boards.ts): controlla che validateBoard (src/engine/boardCheck.ts) non dia errori, poi fai
giocare fino alla fine una partita a 3 computer e una a 6 computer con semi fissi e controlla che ci
sia un vincitore e che il numero di giri sia ragionevole. Controlla anche che ogni carta con
spostamento verso una casella (vedi "targets" nei JSON delle carte e targetSpace in rules.ts) trovi
una casella esistente su quel tabellone. Il test deve ciclare su BOARDS, non sugli id scritti a mano,
così copre da solo i tabelloni futuri. Meno di 10 secondi. Non modificare file in src/.
```

---

### 3. Test di compatibilità dei salvataggi 🟢

**Obiettivo.** Proteggere le partite salvate dai giocatori: qualunque modifica futura al motore deve
continuare ad aprire i salvataggi vecchi.

**File.** Nuovi `tests/fixtures/salvataggio-v2-*.json` (2–3 file) e `tests/compatibilita.test.ts`.
Esiste già `tests/fixtures/salvataggio-v1.json` come esempio.

**Fatto quando.** Ci sono salvataggi di esempio v2: uno a metà partita su Città sul Lago, uno su
Valle Stretta, uno con squadre e quote. Il test li apre con `readSave`, li rigioca con `replay` e
controlla che lo stato rigiocato sia uguale a quello salvato, e che da lì si possano fare altre 20
mosse senza errori.

**Prompt.**
```text
Compito: proteggi i salvataggi dei giocatori. Leggi src/engine/save.ts (SaveFile, readSave,
migrateState, replay, newSave) e tests/save.test.ts e tests/fixtures/salvataggio-v1.json.
Genera con uno script (anche dentro il test, una volta, poi salvato) tre salvataggi v2 di esempio
in tests/fixtures/: salvataggio-v2-citta.json (metà partita, 4 giocatori), salvataggio-v2-valle.json,
salvataggio-v2-regole.json (squadre + quote + edifici speciali). Poi scrivi tests/compatibilita.test.ts
che per ognuno: lo apre con readSave, controlla che replay(initial, actions) dia lo stesso stato del
campo state, e che si possano applicare altre 20 azioni del computer senza errori. I file fixture
devono restare piccoli (sotto 100 KB l'uno). Non modificare file in src/.
```

---

### 4. Regolamento completo per i giocatori 🟢

**Obiettivo.** Un regolamento leggibile da chi non ha mai giocato, con tutte le regole e le regole
facoltative, scritto partendo dal codice (non da altri giochi).

**File.** Nuovo `docs/regolamento.md`; una riga con il link in `README.md`.

**Fatto quando.** Spiega: scopo, preparazione, turno, dadi e doppi (e Dado Sprint), acquisto e asta,
affitti, quartieri completi, case e palazzi, ipoteche, Caserma, carte (con le carte a scelta),
scambi, debiti e bancarotta, fine partita e vittorie alternative, tipi di partita, ogni regola della
casa e regola facoltativa (eventi, ruota, quote, edifici speciali, squadre). Ogni numero (prezzi,
stipendio, multe, percentuali) è preso dal codice o dai JSON. Usa "foulbucks (Ƒ)".

**Prompt.**
```text
Compito: scrivi docs/regolamento.md, il regolamento completo di "Gioco Folle!" per i giocatori, in
italiano semplice, con titoli e brevi elenchi. Ricava ogni regola e ogni numero dal codice:
src/engine/state.ts (GameRules, defaultRules, costanti), src/engine/rules.ts, src/engine/presets.ts
(tipi di partita), src/data/board.json, src/data/cards.json, e i documenti in docs/ (eventi.md,
quote-ed-edifici.md, squadre.md, tipi-di-partita.md). Non copiare regole o testi da altri giochi:
descrivi solo come funziona questo. La moneta è foulbucks (Ƒ).
Sezioni: scopo; preparazione; il turno; dadi, doppi, Dado Sprint; comprare e aste; affitti e
quartieri completi; case e palazzi; ipoteche; Caserma; carte (anche quelle a scelta); scambi;
debiti e bancarotta; fine partita e vittorie alternative; tipi di partita; regole della casa;
regole facoltative (eventi di quartiere, Ruota del Mercato, quote, edifici speciali, squadre);
"Regole semplificate" (copia la sezione omonima di STATO.md).
Aggiungi in README.md una riga con il link al regolamento. Non modificare altri file.
```

---

### 5. Guida per contribuire e modello di PR 🟢

**Obiettivo.** Mettere per scritto nel repository le regole di lavoro, così ogni IA o persona le trova
da sola, e un modello che si compila a ogni PR.

**File.** Nuovi `CONTRIBUTING.md` e `.github/pull_request_template.md`.

**Fatto quando.** `CONTRIBUTING.md` riassume struttura, regole per il codice (quelle del prompt di
base), comandi, come aprire una PR e la regola "niente cartelle copiate". Il modello di PR chiede:
cosa cambia, compito di riferimento (numero di questo file o codice B..), file toccati fuori
dall'area, test aggiunti, riga in STATO.md fatta sì/no.

**Prompt.**
```text
Compito: crea CONTRIBUTING.md nella radice e .github/pull_request_template.md. Leggi README.md,
STATO.md, docs/compiti-ia.md (guida all'integrazione e prompt di base) e package.json.
CONTRIBUTING.md, in italiano, breve: cos'è il progetto; struttura delle cartelle; regole per il
codice; comandi (npm test, npm run build, npm run e2e dopo la build); come si apre una PR (un ramo
per compito, mai su main, mai caricare la cartella del progetto dentro il repository); cosa non
rinominare (chiavi sdrogopoli-…, indirizzo /sdrogopoli/).
Modello di PR con caselle da spuntare: cosa cambia; compito di riferimento; file toccati fuori
dalla propria area (e perché); test aggiunti; npm test passa; riga aggiunta in STATO.md.
Non modificare altri file.
```

---

### 6. Modelli per le segnalazioni su GitHub 🟢

**Obiettivo.** Quando qualcuno apre una "issue" (segnalazione) trova un modulo già pronto.

**File.** Nuovi `.github/ISSUE_TEMPLATE/bug.yml`, `.github/ISSUE_TEMPLATE/idea.yml`,
`.github/ISSUE_TEMPLATE/config.yml`.

**Fatto quando.** Il modulo "Qualcosa non va" chiede: cosa è successo, cosa ti aspettavi, dispositivo
e browser, versione (quella in fondo alla pagina), vista 2D o 3D, se possibile file della partita
`.folle`. Il modulo "Idea" chiede: idea, perché, esempio. Coerente con "Segnala un problema" che già
esiste nel gioco (`src/ui/report.ts`).

**Prompt.**
```text
Compito: crea i modelli per le issue di GitHub in .github/ISSUE_TEMPLATE/: bug.yml ("Qualcosa non
va"), idea.yml ("Ho un'idea") e config.yml (blank_issues_enabled: true). Usa il formato "issue
forms" di GitHub (YAML con body: textarea/input/dropdown). Leggi src/ui/report.ts: il gioco ha già
"Segnala un problema" che prepara un testo; i campi del modulo bug devono corrispondere a quel testo
(versione, dispositivo, vista 2D/3D, cosa è successo, cosa ti aspettavi, file della partita .folle).
In italiano. Non modificare altri file.
```

---

### 7. Terzo tabellone "Isola dei Venti" 🟡

**Obiettivo.** Un terzo tabellone con un'identità diversa: 32 caselle, 7 quartieri, nomi originali a
tema isola (porto, faro, vigneti, scogliera…).

**File.** Nuovi `src/data/board.isola.json`, `src/data/board.isola.en.json`; modifica
`src/data/boards.ts` (una voce in `BOARDS`); frasi nuove in `src/i18n/it.ts` ed `en.ts` se servono
(nome del tabellone); `docs/tabelloni.md`; riga in `STATO.md`.

**Fatto quando.** `validateBoard` non dà errori; tutte le carte trovano la casella "per ruolo";
prezzi e affitti crescono lungo il percorso come negli altri due; una simulazione
(`npm run simula -- 300 4 docs/bilanciamento-isola.md isola`) dà una mediana tra 30 e 45 giri; il
tabellone si sceglie nella schermata iniziale e si gioca in 2D e 3D. Nessun nome preso da giochi
esistenti.

**Test.** Se il compito 2 è già unito il tabellone è coperto da solo; altrimenti aggiungi un caso in
`tests/tabelloni.test.ts`.

**Prompt.**
```text
Compito: aggiungi un terzo tabellone, "Isola dei Venti", con 32 caselle (8 per lato) e 7 quartieri.
Prendi come modello src/data/board.valle.json (28 caselle) e board.valle.en.json, e guarda come è
registrato in src/data/boards.ts. Leggi src/engine/boardCheck.ts (validateBoard: regole che i dati
devono rispettare) e docs/tabelloni.md.
Nomi originali a tema isola mediterranea (porto, faro, saline, vigneti, scogliera, mercato del
pesce...), mai nomi di giochi esistenti. Le caselle speciali (Partenza, Caserma, carte, tasse,
stazioni o equivalenti) devono avere gli stessi "ruoli" usati dalle carte (vedi "targets" nelle carte).
Prezzi e affitti crescenti lungo il percorso, proporzionati a Valle Stretta.
Registra il tabellone in BOARDS con id "isola"; se il nome del tabellone è una frase in i18n,
aggiungila in it.ts ed en.ts. Lancia "npm run simula -- 300 4 docs/bilanciamento-isola.md isola"
(guarda scripts/simula.ts per gli argomenti) e ritocca i prezzi finché la mediana sta tra 30 e 45 giri.
Aggiorna docs/tabelloni.md e STATO.md. Aggiungi un test in tests/tabelloni.test.ts.
```

---

### 8. Regola facoltativa: prestiti dalla banca 🟡

**Obiettivo.** Nuova regola della casa: un giocatore può chiedere un prestito alla banca (100, 200 o
300 Ƒ), che restituisce con il 10% in più entro 5 giri; se non lo restituisce in tempo, viene preso
dai suoi soldi alla Partenza e, se non bastano, entra in debito.

**File.** `src/engine/state.ts` (campo `loans?: boolean` in `GameRules`, dati del prestito nel
giocatore), `src/engine/rules.ts` (azioni `takeLoan` e `repayLoan`), `src/engine/types.ts` se le azioni
stanno lì, `src/engine/save.ts` (`migrateState`), `src/engine/bot.ts` (il computer chiede un prestito
solo per evitare la bancarotta), `tests/prestiti.test.ts`, `docs/prestiti.md`, `STATO.md`.
L'interfaccia (interruttore nelle regole della casa e pulsante in partita) è un **secondo passo** da
fare dopo il restyling della schermata iniziale.

**Fatto quando.** Con la regola spenta niente cambia (tutti i test esistenti passano). Con la regola
accesa: un prestito alla volta per giocatore; non si può chiedere durante un'asta o uno scambio;
interessi e scadenza funzionano; il patrimonio (`netWorth`) sottrae il debito; il prestito non si può
scambiare; i salvataggi vecchi si aprono.

**Test.** Almeno 6: richiesta, rimborso anticipato, rimborso automatico alla scadenza, scadenza senza
soldi che porta al debito, regola spenta che rifiuta l'azione, patrimonio corretto.

**Prompt.**
```text
Compito: aggiungi al MOTORE la regola facoltativa "prestiti dalla banca" (solo motore, niente
interfaccia in questo passo). Leggi src/engine/state.ts (GameRules, GameState, giocatori),
rules.ts (applyAction, netWorth, liquidationValue, debtOptions, come funzionano fase di debito e
Partenza), save.ts (migrateState), bot.ts e tests/quote.test.ts come esempio di test di una regola
facoltativa.
Regola: con rules.loans acceso, nel proprio turno (non durante aste, scambi o scelte di carta) un
giocatore può chiedere un prestito di 100, 200 o 300 (azione takeLoan con amount). Uno alla volta.
Deve restituire importo + 10% (arrotondato a 10) entro 5 giri; può restituire prima (azione
repayLoan). Alla scadenza, quando passa dalla Partenza dopo il quinto giro, il rimborso si prende
in automatico; se non ha abbastanza, entra nella normale fase di debito verso la banca.
netWorth sottrae il debito residuo. Il computer chiede un prestito solo se altrimenti dovrebbe
dichiarare bancarotta e il prestito lo salva, e rimborsa appena ha il doppio del dovuto.
Campi nuovi facoltativi, migrateState aggiornato. Frasi del registro in src/i18n/it.ts ed en.ts.
Test in tests/prestiti.test.ts (almeno 6 casi). Scrivi docs/prestiti.md con regola e numeri e una
riga in STATO.md. Non toccare src/ui/.
```

---

### 9. Regola facoltativa: riscatto dell'ipoteca all'acquisto 🟡

**Obiettivo.** Togliere una delle "regole semplificate" elencate in `STATO.md`: chi riceve una casella
ipotecata (scambio o bancarotta) può scegliere se riscattarla subito al solo valore dell'ipoteca
oppure pagare ora il 10% e riscattarla dopo al valore + 10%.

**File.** `src/engine/rules.ts`, `src/engine/state.ts` (regola `mortgageChoice?: boolean`),
`src/engine/bot.ts`, `src/engine/save.ts`, `tests/ipoteche.test.ts`, `STATO.md` (aggiorna la sezione
"Regole semplificate"). Interfaccia in un secondo passo.

**Fatto quando.** Regola spenta: comportamento attuale identico. Regola accesa: dopo uno scambio o una
bancarotta con caselle ipotecate, il motore entra in una fase di scelta per chi le riceve, una
casella alla volta; il computer sceglie in base ai soldi che ha.

**Prompt.**
```text
Compito: nel MOTORE, rendi facoltativa una regola che oggi è semplificata. Leggi la sezione "Regole
semplificate" di STATO.md, poi in src/engine/rules.ts transferInterest, interestOn, unmortgageCost
e dove vengono usati negli scambi e nella bancarotta.
Con rules.mortgageChoice acceso, chi riceve caselle ipotecate sceglie per ognuna: "riscatta ora"
(paga il valore dell'ipoteca, la casella non è più ipotecata) oppure "tieni ipotecata" (paga ora il
10%, come oggi). Implementa una nuova fase (sul modello di cardChoice) con un'azione
chooseMortgage { spaceId, redeem: boolean }. Il computer riscatta se gli restano almeno 200 dopo.
Regola spenta = comportamento identico a oggi (i test esistenti devono passare senza modifiche).
Campi facoltativi + migrateState. Frasi in i18n it/en. Test in tests/ipoteche.test.ts (almeno 5
casi: scambio, bancarotta, più caselle, computer, regola spenta). Aggiorna "Regole semplificate"
in STATO.md e aggiungi la riga in "Fatto finora". Non toccare src/ui/.
```

---

### 10. Regola facoltativa: tassa sul patrimonio a fine giro 🟡

**Obiettivo.** Una regola che frena chi è in testa: ogni 5 giri chi ha il patrimonio più alto paga il
5% (arrotondato a 10) alla banca o alla Panchina del Parco se quella regola è accesa.

**File.** `src/engine/state.ts`, `src/engine/rules.ts` (dove si apre il giro: `openRound`),
`src/engine/save.ts`, `tests/tassa-patrimonio.test.ts`, `docs/tassa-patrimonio.md`, `STATO.md`.

**Fatto quando.** Funziona con squadre (paga la squadra in testa, divisa tra i compagni), si somma
alla Panchina quando c'è, se il giocatore non ha contanti entra in debito. Una simulazione mostra di
quanto si accorciano o allungano le partite.

**Prompt.**
```text
Compito: nel MOTORE aggiungi la regola facoltativa rules.wealthTax: all'inizio dei giri 5, 10, 15...
(vedi openRound in src/engine/rules.ts) il giocatore con il patrimonio più alto (netWorth; con le
squadre la squadra con teamWorth più alto, divisa a metà tra i compagni) paga il 5% del patrimonio
arrotondato a 10. I soldi vanno alla Panchina del Parco se rules.parkPot è acceso, altrimenti alla
banca. Se non ha contanti entra nella fase di debito come per le tasse. In caso di pari merito
non paga nessuno. Una voce nel registro (frasi in i18n it/en) e nelle statistiche (state.stats, campo
tasse). Campi facoltativi + migrateState. Test in tests/tassa-patrimonio.test.ts (almeno 5 casi).
Lancia la simulazione (scripts/simula.ts) con e senza la regola e scrivi i risultati in
docs/tassa-patrimonio.md. Riga in STATO.md. Non toccare src/ui/.
```

---

### 11. Regola facoltativa: aste con rilancio minimo crescente 🟡

**Obiettivo.** Aste più veloci: il rilancio minimo parte da 10 e raddoppia ogni 3 rilanci (10, 20,
40…), così le aste tra computer non durano troppo.

**File.** `src/engine/rules.ts` (`MIN_BID` e la logica dell'asta), `src/engine/state.ts`,
`src/engine/bot.ts`, `tests/aste.test.ts`, `STATO.md`.

**Fatto quando.** Regola spenta: identico a oggi. Regola accesa: il rilancio minimo si calcola dal
numero di rilanci; il computer rispetta il minimo; il test misura che un'asta tra 4 computer finisce
in meno rilanci di prima.

**Prompt.**
```text
Compito: nel MOTORE aggiungi la regola facoltativa rules.fastAuctions. Leggi in src/engine/rules.ts
MIN_BID e tutte le azioni dell'asta (state.auction), e in bot.ts come il computer rilancia.
Con la regola accesa il rilancio minimo è 10 per i primi 3 rilanci, 20 per i successivi 3, poi 40,
80 e così via (esporta una funzione minRaise(state) usata sia dal motore sia dal computer e, più
avanti, dall'interfaccia). Il motore rifiuta rilanci sotto il minimo. Regola spenta: identico a oggi.
Campi facoltativi + migrateState. Test in tests/aste.test.ts: minimo corretto ai vari passi, rilancio
rifiutato, computer che rispetta il minimo, e un confronto su 100 aste simulate tra 4 computer in cui
la media dei rilanci con la regola è più bassa. Riga in STATO.md. Non toccare src/ui/.
```

---

### 12. Computer: offerte all'asta più furbe 🟡

**Obiettivo.** Il computer di livello "difficile" valuta quanto vale una casella **per sé e per gli
altri**: rilancia di più se completa un suo quartiere o se impedisce a un avversario di completarlo.

**File.** `src/engine/bot.ts`, `tests/bot.test.ts` o nuovo `tests/bot-aste.test.ts`,
`docs/livelli-computer.md` (con `npm run livelli`).

**Fatto quando.** Facile e normale non cambiano. Il difficile ha una funzione di valore esplicita e
testata; con `npm run livelli` il difficile vince più spesso di prima contro due normali (riporta i
numeri prima/dopo nella PR).

**Prompt.**
```text
Compito: migliora solo il livello "difficile" del computer nelle aste. Leggi src/engine/bot.ts
(livelli, caratteri, come decide i rilanci), tests/bot-levels.test.ts, scripts/livelli.ts e
docs/livelli-computer.md.
Aggiungi una funzione esportata auctionValue(state, ctx, playerId, spaceId) che stima quanto vale la
casella per quel giocatore: prezzo base, più un premio se gli completa un quartiere o gli manca una
sola via, più un premio "di blocco" se un avversario completerebbe un quartiere con quella casella,
meno una penalità se dopo l'acquisto gli resterebbero meno di 150 contanti. Il difficile rilancia
fino a quel valore; facile e normale restano identici.
Test: casi costruiti a mano con own() di tests/helpers.ts per ogni componente del valore.
Lancia "npm run livelli" prima e dopo e scrivi i risultati aggiornati in docs/livelli-computer.md e
nella risposta. Riga in STATO.md.
```

---

### 13. Computer: valuta meglio gli scambi 🟡

**Obiettivo.** Il computer rifiuta gli scambi che regalano un quartiere completo all'avversario senza
compenso adeguato, e propone scambi "due vie per una" quando entrambi completano qualcosa.

**File.** `src/engine/bot.ts`, `src/engine/rules.ts` (solo lettura di `tradeCompletions`),
`tests/bot-scambi.test.ts`.

**Fatto quando.** Test con scambi costruiti a mano: il computer accetta quelli equi, rifiuta quelli
che fanno completare un quartiere solo all'altro, propone almeno uno scambio reciproco quando la
situazione lo permette. Livello facile invariato.

**Prompt.**
```text
Compito: migliora come il computer (livelli normale e difficile) valuta e propone scambi. Leggi
src/engine/bot.ts (parte degli scambi e dei caratteri: il "mercante" scambia di più) e in
src/engine/rules.ts tradeCompletions e le azioni proposeTrade / acceptTrade / counterTrade.
Regole nuove: rifiuta uno scambio che fa completare un quartiere all'altro e non a sé, a meno che
riceva almeno il 150% del valore delle vie date più 100; se due giocatori si completerebbero un
quartiere a vicenda, il computer propone lo scambio reciproco (al massimo una proposta per turno,
come già previsto da tradeProposedThisTurn). Il livello facile non cambia.
Test in tests/bot-scambi.test.ts con situazioni costruite con own() di tests/helpers.ts (almeno 5).
Lancia npm run simula prima e dopo e riporta la mediana dei giri nella risposta. Riga in STATO.md.
```

---

### 14. Simulazione per le nuove regole 🟢

**Obiettivo.** Uno script unico che misura durata e vincitori con ogni regola facoltativa accesa da
sola, così si vede subito se una regola nuova sbilancia il gioco.

**File.** Nuovo `scripts/regole.ts`, voce `"regole"` in `package.json`, rapporto
`docs/bilanciamento-regole.md`.

**Fatto quando.** `npm run regole` gioca 200 partite a 4 computer per: nessuna regola, ogni regola
facoltativa da sola, tutte insieme. Il rapporto ha una tabella con mediana e 90° percentile dei giri,
percentuale di vittorie per posto, partite finite per bancarotta o per limite di giri. Ricava l'elenco
delle regole da `GameRules`, così le regole future si aggiungono con una riga.

**Prompt.**
```text
Compito: crea scripts/regole.ts sul modello di scripts/simula.ts e scripts/quote.ts, e aggiungi
"regole": "vite-node scripts/regole.ts" in package.json. Per ogni configurazione (nessuna regola
facoltativa; events, wheel, shares, landmarks, sprintDie, teams ognuna da sola; tutte insieme) fa
giocare 200 partite a 4 computer con semi fissi e scrive docs/bilanciamento-regole.md con una tabella:
mediana e 90° percentile dei giri, vittorie per posto in percentuale, quota di partite finite per
bancarotta e per limite di giri. Le configurazioni stanno in un array in cima al file, facile da
allungare. Durata totale sotto 3 minuti. Non modificare file in src/.
```

---

### 15. Controlli in più nel validatore dei tabelloni 🟢

**Obiettivo.** L'editor di tabelloni e i link condivisi passano da `validateBoard`. Aggiungere
controlli che oggi mancano, con un messaggio chiaro per ognuno.

**File.** `src/engine/boardCheck.ts`, `tests/editor.test.ts` o nuovo `tests/validatore.test.ts`,
eventuali messaggi in `src/i18n/it.ts` ed `en.ts`.

**Fatto quando.** Nuovi controlli (avvisi, non errori bloccanti, se il formato lo permette): affitto
con palazzo minore di quello con 4 case; costo delle case maggiore del prezzo della via più cara del
quartiere; nomi doppi di caselle; quartiere con una sola via; testi troppo lunghi per il cartellino.
Tutti i tabelloni in `BOARDS` passano ancora.

**Prompt.**
```text
Compito: rafforza src/engine/boardCheck.ts (validateBoard). Leggilo tutto, poi leggi
tests/editor.test.ts e src/ui/boardEditor.ts per capire come vengono mostrati errori e avvisi.
Aggiungi questi controlli, ognuno con un messaggio in it/en: affitti non crescenti al crescere delle
case; costo di una casa più alto della via più cara del quartiere; due caselle con lo stesso nome;
quartiere con una sola via; nome di casella più lungo di 28 caratteri. Se validateBoard distingue già
errori e avvisi, questi sono avvisi (il tabellone si può comunque usare); se non lo fa, aggiungi la
distinzione senza cambiare il comportamento degli errori esistenti.
I tabelloni in BOARDS non devono dare nessun avviso nuovo (se ne danno, segnalalo invece di
cambiare i dati). Test per ogni controllo. Riga in STATO.md.
```

---

### 16. Dieci traguardi nuovi 🟡

**Obiettivo.** Più motivi per rigiocare: 10 traguardi nuovi, legati alle funzioni arrivate dopo i
primi 30 (squadre, Valle Stretta, quote, edifici speciali, eventi, partita del giorno, online).

**File.** `src/ui/achievements.ts`, `src/i18n/it.ts`, `src/i18n/en.ts`, `tests/traguardi.test.ts`.

**Fatto quando.** 10 traguardi con titolo, descrizione e ricompensa (titolo o colore extra, come gli
altri); ognuno ha un test che lo sblocca e uno che non lo sblocca; i profili salvati prima continuano
ad aprirsi.

**Prompt.**
```text
Compito: aggiungi 10 traguardi in src/ui/achievements.ts (oggi sono 30, in ACHIEVEMENTS). Leggi il
file intero, tests/traguardi.test.ts e i dati disponibili a fine partita (state.stats e
state.history in src/engine/state.ts, regole in GameRules).
Idee (originali, scegli o sostituisci): vincere in squadra; vincere su Valle Stretta; avere tutte e 3
le quote di un quartiere; costruire tutti e tre i tipi di edificio speciale nella stessa partita;
incassare durante un evento "festa"; vincere la partita del giorno; finire una partita online;
vincere senza mai ipotecare; vincere con meno di 3 vie; sopravvivere a un debito oltre 500.
Ognuno con titolo e testo in src/i18n/it.ts ed en.ts e una ricompensa come quelli esistenti.
Se un traguardo richiede un dato che oggi non c'è, scegline un altro invece di cambiare il motore.
Per ognuno un test che lo sblocca e uno che non lo sblocca. Riga in STATO.md.
```

---

### 17. Premi nuovi a fine partita 🟡

**Obiettivo.** Nella schermata di fine partita ci sono dei premi ("il più sfortunato", ecc.).
Aggiungerne 5 nuovi, con tono scherzoso coerente col nome "Gioco Folle!".

**File.** `src/ui/summary.ts`, `src/i18n/it.ts`, `src/i18n/en.ts`, `tests/summary.test.ts`.

**Fatto quando.** 5 premi nuovi calcolati da `state.stats` / `state.history`; un premio si mostra solo
se ha un vincitore chiaro; massimo 6 premi visibili per partita (scegli i più "interessanti").

**Prompt.**
```text
Compito: aggiungi 5 premi nuovi alla schermata di fine partita. Leggi src/ui/summary.ts,
tests/summary.test.ts e i dati in state.stats e state.history (src/engine/state.ts).
Idee (con nomi originali e scherzosi): "Re della Rimonta" (il più basso a metà partita che finisce
più in alto), "Mattone d'Oro" (più case costruite), "Turista" (più giri completati), "Collezionista
di Multe" (più tasse e multe), "Ottovolante" (patrimonio con più alti e bassi). Ogni premio solo se
c'è un vincitore chiaro (niente pari merito). Se ci sono più di 6 premi validi, mostra i 6 con lo
scarto maggiore tra primo e secondo. Testi in src/i18n/it.ts ed en.ts. Test per ogni premio.
Non cambiare lo stile grafico della schermata. Riga in STATO.md.
```

---

### 18. Effetti sonori in più 🟢

**Obiettivo.** Suoni nuovi generati con la Web Audio API (come gli altri, niente file audio):
eventi di quartiere, Ruota del Mercato, quote, edifici speciali, traguardo sbloccato.

**File.** `src/ui/audio.ts`, `src/ui/sounds.ts`.

**Fatto quando.** 5 suoni nuovi brevi (< 1 s), rispettano il pulsante Effetti e il volume; partono negli
stessi punti dove compaiono gli avvisi di quegli eventi; nessun file audio aggiunto.

**Prompt.**
```text
Compito: aggiungi 5 effetti sonori, generati in codice con la Web Audio API come quelli esistenti.
Leggi src/ui/audio.ts (come sono fatti i suoni) e src/ui/sounds.ts (quando partono, in base al
registro della partita). Suoni nuovi: evento di quartiere (campanella), Ruota del Mercato
(giro con "tic" che rallentano), quota comprata (moneta piccola), edificio speciale (accordo
ascendente), traguardo sbloccato (fanfara corta). Ognuno sotto 1 secondo, rispetta il pulsante
Effetti. Nessun file audio, nessuna dipendenza. Non modificare file fuori da questi due, a parte
la riga in STATO.md.
```

---

### 19. Finestra "Scorciatoie da tastiera" 🟡

**Obiettivo.** Premendo `?` si apre una finestra che elenca tutti i tasti (frecce sul tabellone, +/−,
Maiusc+frecce, 0, Esc, ecc.).

**File.** Nuovo `src/ui/shortcuts.ts`, piccolo aggancio in `src/ui/main.ts`, `src/i18n/it.ts`,
`src/i18n/en.ts`, `e2e/tastiera.spec.ts`.

**Fatto quando.** `?` apre un `<dialog>` accessibile (focus dentro, Esc chiude, focus torna dove era);
non si apre mentre si scrive in un campo; l'elenco è preso da un array unico; test Playwright.

**Prompt.**
```text
Compito: aggiungi una finestra "Scorciatoie da tastiera" che si apre premendo "?" durante la
partita. Leggi src/ui/main.ts e cerca dove sono gestiti i tasti (frecce, +, -, 0, Esc, Maiusc), e
src/ui/lookPicker.ts come esempio di <dialog> accessibile già usato nel gioco.
Crea src/ui/shortcuts.ts con un array di { keys, i18nKey } e una funzione che apre il <dialog>.
In main.ts aggiungi solo l'aggancio del tasto (ignoralo se il focus è in un input/textarea/select).
Testi in src/i18n/it.ts ed en.ts. Usa le classi CSS e i token di stile esistenti, senza nuovi file
CSS. Aggiungi un caso in e2e/tastiera.spec.ts. Riga in STATO.md.
```

---

### 20. Rivincita con gli stessi giocatori 🟡

**Obiettivo.** A fine partita un pulsante "🔁 Rivincita" fa ripartire subito con gli stessi
giocatori, personaggi, tabellone e regole, con un seme nuovo e l'ordine dei posti ruotato (chi era
ultimo parte primo).

**File.** `src/ui/summary.ts`, `src/ui/session.ts` o `src/ui/main.ts` (dove si crea una partita),
`src/i18n/*.ts`, `tests/session.test.ts`, un caso e2e.

**Fatto quando.** La funzione che prepara la rivincita è pura e testata (stessi nomi, aspetto, livelli
dei computer, regole e tabellone; seme diverso; ordine ruotato secondo la classifica); il pulsante
c'è in 2D e 3D; la classifica tra amici registra entrambe le partite.

**Prompt.**
```text
Compito: aggiungi "🔁 Rivincita" a fine partita. Leggi src/ui/summary.ts (schermata finale),
src/ui/session.ts e src/ui/main.ts (come si crea una partita: createGame e le impostazioni dei
giocatori), src/ui/setup.ts solo per capire quali dati servono (non modificarlo: è in restyling).
Scrivi una funzione pura rematchSetup(finalState, previousSetup) che restituisce le impostazioni
della nuova partita: stessi giocatori, aspetto, livello e carattere dei computer, tabellone e regole;
seme nuovo; ordine dei posti secondo la classifica al contrario (l'ultimo parte primo). Test in
tests/session.test.ts. Poi il pulsante nella schermata finale che la usa. Testi in i18n it/en.
Un caso in e2e/partita.spec.ts. Riga in STATO.md.
```

---

### 21. Rivincita nel gioco online 🟡

**Obiettivo.** Nel tavolo online, a fine partita chi ha creato il tavolo può proporre la rivincita;
gli ospiti accettano e si riparte senza ricondividere il link. Da fare **dopo il compito 20**.

**File.** `src/net/host.ts`, `src/net/guest.ts`, `src/net/protocol.ts`, `src/ui/online.ts`,
`tests/online.test.ts`, `tests/net.test.ts`.

**Fatto quando.** Nuovo messaggio nel protocollo, validato come gli altri (`sanitize.ts`); chi non
accetta entro 30 secondi viene sostituito dal computer; test con la rete finta già presente.

**Prompt.**
```text
Compito: aggiungi la rivincita al gioco online. Prerequisito: deve esistere rematchSetup (compito
"Rivincita con gli stessi giocatori"). Leggi src/net/protocol.ts (messaggi), host.ts, guest.ts,
sanitize.ts (validazione dei messaggi in arrivo), src/ui/online.ts e tests/net.test.ts (rete finta).
A fine partita l'oste vede "Proponi la rivincita"; gli ospiti ricevono la proposta con "Ci sto" e
"No, grazie"; dopo che tutti hanno risposto, o dopo 30 secondi, l'oste riparte con rematchSetup e i
posti di chi non ha accettato passano al computer. Ogni messaggio nuovo va validato in sanitize.ts.
Test con la rete finta: tutti accettano; uno rifiuta; uno non risponde. Testi in i18n it/en.
Riga in STATO.md.
```

---

### 22. Terza lingua: spagnolo 🟡

**Obiettivo.** Interfaccia in spagnolo.

**Attenzione.** Tocca tutte le frasi: meglio farlo quando non ci sono altre PR aperte che cambiano
`src/i18n/it.ts` o `en.ts`, e unirlo subito.

**File.** Nuovo `src/i18n/es.ts`, `src/i18n/index.ts` (registrazione), `src/data/board.es.json`,
`src/data/board.valle.es.json`, `src/data/cards.es.json`, il caricamento in `src/data/`,
`tests/lingua.test.ts`, scelta della lingua nelle impostazioni (`src/ui/settings.ts`).

**Fatto quando.** Stesse chiavi di `it.ts` (il test lo controlla), le vie restano in italiano come per
l'inglese, la lingua si sceglie nelle impostazioni e si ricorda.

**Prompt.**
```text
Compito: aggiungi lo spagnolo come terza lingua. Leggi src/i18n/index.ts, it.ts, en.ts,
tests/lingua.test.ts, src/ui/settings.ts (scelta della lingua) e come src/data/ carica board.en.json
e cards.en.json. Crea src/i18n/es.ts con TUTTE le chiavi di it.ts (stessi segnaposto {nome}),
traducendo dall'inglese e controllando l'italiano. Le vie e i quartieri restano in italiano come in
inglese; traduci le altre caselle e le carte in board.es.json, board.valle.es.json, cards.es.json.
La moneta resta "foulbucks" (Ƒ). Estendi tests/lingua.test.ts perché controlli anche es. Aggiungi
"Español" alla scelta della lingua. Riga in STATO.md.
```

---

### 23. Test nel browser: annulla, scambio, asta 🟢

**Obiettivo.** Coprire con Playwright tre flussi che oggi sono provati solo nel motore.

**File.** Nuovo `e2e/flussi.spec.ts` (usa `e2e/aiuti.ts`).

**Fatto quando.** Tre test: (1) una persona compra, preme Annulla e torna come prima; (2) una persona
propone uno scambio a un'altra persona sullo stesso dispositivo e lo vede accettato; (3) nessuno compra
una casella e parte l'asta, che si chiude con un vincitore. Girano in CI in meno di 60 secondi in tutto.

**Prompt.**
```text
Compito: scrivi e2e/flussi.spec.ts con tre test Playwright. Leggi playwright.config.ts, e2e/aiuti.ts
(funzioni di aiuto già pronte) ed e2e/partita.spec.ts per lo stile. I test girano su dist/ (prima
npm run build). Usa un seme fisso se aiuti.ts lo permette, così i dadi sono prevedibili.
1) Una persona arriva su una via libera, compra, preme "Annulla": soldi e proprietario tornano come prima.
2) Due persone sullo stesso dispositivo: la prima propone uno scambio di soldi per una via, la seconda
   accetta, la via cambia proprietario.
3) Una persona arriva su una via libera e non compra: parte l'asta, si chiude con un vincitore.
Usa selettori per ruolo/testo accessibile, non classi CSS (l'interfaccia sta cambiando stile).
Non modificare file in src/.
```

---

### 24. Controllo del peso della build in CI 🟢

**Obiettivo.** Evitare che il gioco diventi pesante senza accorgersene: la CI fallisce se il codice
iniziale supera una soglia.

**File.** Nuovo `scripts/peso.ts`, voce in `package.json`, un passo in `.github/workflows/deploy.yml`
dopo la build, `docs/peso.md`.

**Fatto quando.** Lo script legge `dist/`, somma i file JS e CSS caricati all'avvio (non quelli caricati
dopo con `import()`), li comprime con gzip (zlib di Node, nessuna dipendenza) e fallisce se superano
la soglia (misura oggi e aggiungi il 15%). Stampa una tabella file per file.

**Prompt.**
```text
Compito: crea scripts/peso.ts (eseguito con vite-node, solo moduli di Node, nessuna dipendenza) e
la voce "peso" in package.json. Dopo npm run build lo script legge dist/index.html, trova i file
JS e CSS caricati all'avvio (script e link nell'HTML e i loro modulepreload), li comprime con
zlib.gzipSync e stampa una tabella con il peso di ognuno e il totale. Esce con codice 1 se il totale
supera una soglia scritta in cima al file: misura il totale di oggi e metti la soglia al 15% in più.
Aggiungi in .github/workflows/deploy.yml il passo "- run: npm run peso" subito dopo npm run build.
Scrivi docs/peso.md con la tabella di oggi e come alzare la soglia. Riga in STATO.md.
```

---

### 25. Dividere `rules.ts` in moduli 🟡 (da fare da solo)

**Obiettivo.** `src/engine/rules.ts` ha oltre 1200 righe. Dividerlo per argomento senza cambiare
nessun comportamento.

**Perché da solo.** Quasi tutti i compiti di motore (8–13) toccano `rules.ts`: se questo compito va in
parallelo a uno di quelli, i conflitti sono garantiti. Farlo quando non ci sono altre PR di motore
aperte, e unirlo subito.

**File.** `src/engine/rules.ts` più nuovi file in `src/engine/` (es. `rent.ts`, `auction.ts`,
`trade.ts`, `debt.ts`, `teams.ts`, `shares.ts`), `src/engine/index.ts`.

**Fatto quando.** Nessun test modificato, tutti passano; `rules.ts` sotto 500 righe e riesporta quello
che esportava prima (così nessun import fuori dal motore cambia); nessuna funzione cambia firma.

**Prompt.**
```text
Compito: dividi src/engine/rules.ts (oltre 1200 righe) in moduli più piccoli SENZA cambiare nessun
comportamento. Leggi rules.ts per intero e src/engine/index.ts.
Sposta le funzioni per argomento in file nuovi dentro src/engine/ (ad esempio: rent.ts per affitti
ed eventi, auction.ts, trade.ts, debt.ts per debiti/bancarotta/ipoteche, teams.ts, shares.ts per quote
ed edifici speciali). applyAction resta in rules.ts. rules.ts deve riesportare tutto quello che
esportava prima, così nessun import in src/ui/, src/net/, tests/ o scripts/ va cambiato.
Nessuna dipendenza circolare tra i nuovi file (se serve, metti le funzioni comuni in un file a parte).
Non cambiare firme, nomi o logica; non toccare i test. npm test, npm run build ed npm run e2e
devono passare senza modifiche ai test. Riga in STATO.md.
```

---

### 26. Dividere `main.ts` in moduli 🔴 (dopo il restyling)

**Obiettivo.** Stessa cosa per `src/ui/main.ts` (oltre 1300 righe).

**Perché aspettare.** È in corso il restyling grafico e le animazioni della schermata iniziale, che
tocca `main.ts`, `setup.ts`, `intro.ts`, `loading.ts` e i CSS. Riprendere quando quel lavoro è unito.

**Prompt.** Come il 25, sostituendo `src/ui/main.ts` e chiedendo di estrarre: gestione dei tasti,
pannello del turno, cassetto dei giocatori, finestre di scambio e asta.

---

### 27. Storico delle partite nel profilo 🟡

**Obiettivo.** Nel profilo un elenco delle ultime 20 partite giocate su questo dispositivo: data,
tabellone, tipo, giocatori, vincitore, giri; con un pulsante per rivedere quelle che hanno il replay.

**File.** `src/ui/profile.ts`, `src/ui/achievements.ts` (il profilo), `src/i18n/*.ts`,
`tests/profilo.test.ts`.

**Fatto quando.** Lo storico si salva nel profilo esistente (non in una chiave nuova), si esporta e
importa col profilo, i profili vecchi senza storico si aprono; massimo 20 voci.

**Prompt.**
```text
Compito: aggiungi lo storico delle ultime 20 partite al profilo. Leggi src/ui/achievements.ts
(interfaccia Profile, emptyProfile), src/ui/profile.ts (finestra del profilo, esporta/importa),
src/ui/replay.ts e tests/profilo.test.ts.
Aggiungi a Profile un campo facoltativo history con al massimo 20 voci { date, board, preset,
players: [{name, bot}], winner, rounds }, riempito a fine partita dove oggi si aggiorna il profilo.
I profili esportati prima (senza history) devono importarsi senza errori. Nella finestra del profilo
mostra l'elenco (più recente in alto) con lo stile esistente. Testi in i18n it/en. Test: aggiunta
voce, limite di 20, import di un profilo vecchio. Riga in STATO.md.
```

---

### 28. Mazzo extra "Imprevisti del Cantiere" 🟡

**Obiettivo.** Una regola facoltativa che aggiunge un terzo mazzo di 12 carte legate alle costruzioni
(si pesca quando si costruisce la terza casa di un quartiere): ritardi, bonus, ispezioni.

**File.** Nuovi `src/data/cards.cantiere.json`, `src/data/cards.cantiere.en.json`;
`src/data/index.ts`, `src/engine/state.ts` (regola `buildCards?: boolean`), `src/engine/rules.ts`,
`src/engine/cards.ts`, `tests/cantiere.test.ts`, `docs/cantiere.md`.

**Fatto quando.** Le carte usano solo tipi di effetto che il motore già conosce (più eventuali nuovi,
testati); il mazzo si mescola col seme della partita; regola spenta = identico a oggi; carte originali.

**Prompt.**
```text
Compito: aggiungi la regola facoltativa rules.buildCards con un terzo mazzo "Imprevisti del
Cantiere" di 12 carte originali. Leggi src/data/cards.json e cards.en.json (formato delle carte),
src/data/index.ts, src/engine/cards.ts e in src/engine/rules.ts dove si pescano le carte e dove si
costruiscono le case.
Quando la regola è accesa, chi costruisce una casa portando un quartiere a 3 case totali pesca una
carta dal mazzo Cantiere. Effetti: usa i tipi di carta già supportati (pagare, incassare, spostarsi,
carte a scelta); se ti serve un effetto nuovo (es. "rimuovi una casa", "la prossima casa costa la
metà"), aggiungilo con test. Il mazzo si mescola col generatore della partita. Regola spenta =
identico a oggi. Campi facoltativi + migrateState. Test in tests/cantiere.test.ts. Regole in
docs/cantiere.md. Riga in STATO.md. Non toccare src/ui/ (l'interruttore si aggiunge dopo).
```

---

### 29. Esporta il registro della partita in testo 🟢

**Obiettivo.** Nel pannello "Registro" un pulsante "Copia il registro" che copia tutto il registro
della partita in testo semplice (utile per le segnalazioni di bug).

**File.** Nuovo `src/ui/logText.ts` (funzione pura), un pulsante dove si mostra il registro,
`src/i18n/*.ts`, `tests/registro.test.ts`.

**Fatto quando.** La funzione pura trasforma il registro in righe "Giro N · Giocatore · cosa è
successo" nella lingua scelta; il pulsante usa la clipboard e, dove non c'è, scarica un `.txt`; test
della funzione.

**Prompt.**
```text
Compito: aggiungi "📋 Copia il registro". Leggi src/ui/view.ts o il file che mostra il registro
completo della partita (cerca state.log), src/i18n/index.ts (come si traducono le voci del registro,
{k, p}) e src/ui/report.ts.
Crea src/ui/logText.ts con una funzione pura logToText(state, lang) che restituisce una riga per voce
("Giro N · Nome · testo tradotto"). Aggiungi il pulsante accanto al registro: copia con
navigator.clipboard.writeText e, se non disponibile, scarica registro.txt. Collega anche "Segnala un
problema" (report.ts) perché alleghi le ultime 30 righe. Test della funzione in
tests/registro.test.ts. Testi in i18n it/en. Riga in STATO.md.
```

---

### 30. Statistiche per tabellone nel bilanciamento 🟢

**Obiettivo.** Sapere quali caselle rendono di più: per ogni tabellone, quante volte si finisce su ogni
casella e quanto affitto rende in media ogni quartiere.

**File.** Nuovo `scripts/caselle.ts`, voce in `package.json`, `docs/caselle.md`.

**Fatto quando.** 500 partite simulate per tabellone; tabella con frequenza di arrivo per casella e
rendimento medio per quartiere (affitto incassato / prezzo pagato); evidenzia le caselle più e meno
visitate.

**Prompt.**
```text
Compito: crea scripts/caselle.ts sul modello di scripts/simula.ts e la voce "caselle" in
package.json. Per ogni tabellone in BOARDS (src/data/boards.ts) simula 500 partite a 4 computer con
semi fissi e conta: quante volte una pedina si ferma su ogni casella (in % sul totale) e, per ogni
quartiere, affitto totale incassato diviso prezzo totale pagato (vie + case). Scrivi docs/caselle.md
con una tabella per tabellone, ordinata per frequenza, e le 5 caselle più e meno visitate. Leggi i
dati dallo stato dopo ogni azione senza modificare il motore. Non modificare file in src/.
```

---

## Lavori esclusi o da rimandare

Sono già in corso in altre conversazioni: **non darli all'altra IA** finché non sono uniti.

| Lavoro | Stato | File da non toccare nel frattempo |
|---|---|---|
| Restyling grafico e animazioni della schermata iniziale (PR #59) | in corso | `src/ui/setup.ts`, `src/ui/intro.ts`, `src/ui/loading.ts`, `src/ui/lookPicker.ts`, `src/ui/styles/*.css`, `src/ui/style.css`, `index.html` |

Di conseguenza:
- Il compito **26** (dividere `main.ts`) parte solo dopo la PR #59.
- La moneta foulbucks (PR #58) è già unita: nessun compito deve più aspettarla.
- I compiti di motore **8, 9, 10, 11, 28** fanno solo la parte di motore: l'interruttore nelle "regole
  della casa" (che sta in `setup.ts`) si aggiunge con un compito successivo, a restyling finito.
- La PR #59 aggiunge anche frasi in `src/i18n/*.ts`: se un compito ne aggiunge mentre è aperta,
  probabilmente servirà risolvere un piccolo conflitto (vedi la guida).

Non sono nella lista perché richiedono una tua decisione prima: cambio del nome del repository o
dell'indirizzo del sito, account per server TURN, pubblicazione su itch.io, prova reale del gioco
online su due dispositivi.

# Imprevisti del Cantiere (`rules.buildCards`)

**Imprevisti del Cantiere** è una regola facoltativa che introduce un terzo mazzo di 12 carte originali dedicato ai lavori edili: scavi, ispezioni, ritardi, bonus comunali e piccoli contrattempi di cantiere.

## Come funziona

- **Attivazione:** la regola si accende con `rules.buildCards = true` nelle regole della partita (`GameRules` in `src/engine/state.ts`). Con la regola spenta il mazzo non viene creato e il comportamento del gioco è identico alla partita classica.
- **Mescolamento:** all'inizio della partita (`createGame`) le 12 carte del mazzo `cantiere` vengono mescolate con il generatore casuale della partita (`state.rngState`), così dallo stesso seme esce sempre lo stesso ordine di pesca.
- **Quando si pesca:** ogni volta che un giocatore costruisce una casa (`build`) e con quella costruzione il quartiere raggiunge esattamente **3 case totali** (sommando le case presenti su tutte le vie del quartiere), il giocatore pesca la prima carta di `state.decks.cantiere`.
  - Costruire la 1ª, la 2ª o la 4ª casa del quartiere non fa pescare alcuna carta.
  - Se in seguito una casa viene venduta (scendendo a 2) e poi ricostruita (tornando a 3), si pesca una nuova carta.
- **Ritorno nel mazzo:** dopo averne applicato l'effetto, la carta torna in fondo a `state.decks.cantiere`. Per le carte a scelta (`kind: 'choice'`), la partita entra nella fase `cardChoice` e prosegue dopo `chooseCard`.

## Le 12 carte (`src/data/cards.cantiere.json`)

| ID | Testo | Effetto |
|---|---|---|
| `cantiere-01` | Scavi fortunati: sotto le fondamenta spunta una vecchia cassaforte. Incassa 120. | Incassa 120 Ƒ |
| `cantiere-02` | La betoniera blocca l'incrocio nell'ora di punta. Multa per il traffico: paga 80. | Paga 80 Ƒ |
| `cantiere-03` | Bonus comunale per i pannelli solari sul tetto nuovo. Incassa 90. | Incassa 90 Ƒ |
| `cantiere-04` | Pioggia improvvisa sul cemento fresco: bisogna rifare il vialetto. Paga 70. | Paga 70 Ƒ |
| `cantiere-05` | Inaugurazione del cantiere con panini e bibite per tutti. Paga 20 a ogni giocatore. | Paga 20 Ƒ a ogni giocatore |
| `cantiere-06` | I vicini fanno una colletta per ringraziarti del marciapiede nuovo. Ogni giocatore ti dà 20. | Ricevi 20 Ƒ da ogni giocatore |
| `cantiere-07` | Controllo straordinario delle impalcature. Paga 20 per ogni casa e 70 per ogni palazzo. | Riparazioni: 20 Ƒ/casa, 70 Ƒ/palazzo |
| `cantiere-08` | Il fornitore di mattoni ti fa uno sconto quantità. Incassa 35. | Incassa 35 Ƒ |
| `cantiere-09` | Cantiere aperto senza il cartello regolamentare: i Vigili ti portano in Caserma. | Vai in Caserma |
| `cantiere-10` | Torni in magazzino a prendere i sacchi di calce: vai indietro di 2 caselle. | Spostati di −2 caselle |
| `cantiere-11` | I lavori finiscono in anticipo: come festeggi con la squadra? | Scelta: incassa 60 Ƒ oppure vai a `{space}` (`studio`) |
| `cantiere-12` | Un tubo dell'acqua perde proprio sotto il ponteggio. | Scelta: paga 75 Ƒ oppure paga 25 Ƒ/casa e 80 Ƒ/palazzo |

# Prestiti dalla banca

Regola facoltativa del motore (`rules.loans`), spenta nelle partite normali.

## Come funziona

Con la regola attiva, durante il proprio turno (nelle fasi `roll`, `buy` o `endTurn`, ma **non** durante un'asta, uno scambio in sospeso o la scelta di una carta) il giocatore di turno può chiedere un prestito alla banca con l'azione `takeLoan`:

| Prestito richiesto | Interessi (10%) | Totale da restituire (`due`) | Scadenza |
| --- | --- | --- | --- |
| 100 Ƒ | 10 Ƒ | 110 Ƒ | entro 5 giri |
| 200 Ƒ | 20 Ƒ | 220 Ƒ | entro 5 giri |
| 300 Ƒ | 30 Ƒ | 330 Ƒ | entro 5 giri |

- **Un prestito alla volta**: ogni giocatore può avere al massimo un prestito attivo (`player.loan`). Finché non lo estingue non può chiederne un altro.
- **Non scambiabile**: i prestiti sono personali verso la banca e non entrano negli scambi tra giocatori.
- **Patrimonio (`netWorth`)**: il totale da restituire (`loan.due`) viene sottratto dal patrimonio netto del giocatore. Chiedere un prestito aumenta i contanti ma riduce il patrimonio netto del 10% di interessi.

## Rimborso anticipato e scadenza

- **Rimborso anticipato (`repayLoan`)**: in qualunque momento del proprio turno (fuori da aste, scambi e scelte di carta), se il giocatore ha abbastanza contanti può pagare `loan.due` alla banca ed estinguere il prestito.
- **Rimborso automatico alla Partenza**: il prestito scade dopo **5 giri** (`dueRound = round + 5`). Quando il giocatore passa dalla Partenza in un giro uguale o successivo a `dueRound`, dopo aver incassato lo stipendio (e gli eventuali mercati coperti) la banca trattiene in automatico l'importo dovuto.
- **Fase di debito**: se al momento del rimborso automatico alla Partenza i contanti non bastano, il saldo del giocatore va in negativo e si apre la normale fase di debito verso la banca (`creditor = null`), in cui il giocatore deve vendere quote, edifici, case o ipotecare proprietà prima di poter concludere il turno.

## Il computer

- **Quando chiede un prestito**: solo come ultima risorsa in fase di debito (`raiseMoney`), dopo aver già venduto quote, edifici speciali, case e ipotecato le proprietà disponibili, se il prestito più piccolo tra 100, 200 e 300 Ƒ basta a riportare il saldo almeno a zero ed evitare la bancarotta.
- **Quando rimborsa**: all'inizio della fase `endTurn`, appena i suoi contanti raggiungono almeno il **doppio** della somma dovuta (`money >= loan.due * 2`).

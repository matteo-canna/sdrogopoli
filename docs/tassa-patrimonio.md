# Tassa sul patrimonio a fine giro

Regola facoltativa del motore (`rules.wealthTax`), spenta nelle partite normali.

## Come funziona

Con `rules.wealthTax` acceso, all'inizio dei giri **5, 10, 15, 20…** (`round % 5 === 0`, dentro `startRound` / `openRound` in `src/engine/rules.ts`) si confrontano i patrimoni (`netWorth`) dei giocatori ancora in gara:

- **Giocatore singolo**: chi ha il patrimonio più alto paga il **5% del proprio patrimonio**, arrotondato ai 10 Ƒ più vicini (`Math.round((worth * 0.05) / 10) * 10`).
- **Squadre (`rules.teams`)**: si confronta il patrimonio complessivo delle squadre (`teamWorth`). La squadra in testa paga il 5% del patrimonio di squadra arrotondato a 10 Ƒ, **diviso a metà tra i compagni** ancora in partita.
- **Pari merito**: se due o più giocatori (o squadre) condividono il primo posto a pari patrimonio, **non paga nessuno**.
- **Destinazione dei soldi**: se è attiva anche la regola della Panchina del Parco (`rules.parkPot`), l'importo pagato si aggiunge al montepremi `state.pot`; altrimenti va alla banca.
- **Fase di debito**: se il giocatore tassato non ha abbastanza contanti per coprire l'importo, il suo saldo scende sotto zero e all'inizio del suo turno si apre la normale fase di debito verso la banca (`creditor = null`), in cui deve vendere quote, edifici, case o ipotecare proprietà prima di poter concludere il turno.
- **Registro e statistiche**: ogni pagamento aggiunge una voce nel registro della partita (`log.wealthTax`) e incrementa `state.stats[playerId].taxesPaid`.

## Simulazione di bilanciamento

Confronto su **100 partite** tra 4 giocatori computer sul tabellone "Città sul Lago" (40 caselle, massimo 150 giri, stessi semi):

| Configurazione | Partite concluse | Giri (10° perc.) | Giri (mediana) | Giri (90° perc.) | Tasse totali medie per partita | Vittorie per posto (1° / 2° / 3° / 4°) |
| --- | --- | --- | --- | --- | --- | --- |
| Classica (senza `wealthTax`) | 99 / 100 (99%) | 27 | **46** | 80 | 1.200 Ƒ | 21% · 19% · 37% · 22% |
| Con `wealthTax` (verso la banca) | 90 / 100 (90%) | 31 | **53** | 102 | 4.096 Ƒ | 20% · 30% · 36% · 14% |
| Con `wealthTax` + `parkPot` (Panchina) | 98 / 100 (98%) | 32 | **49** | 81 | 3.577 Ƒ | 28% · 28% · 30% · 15% |

### Effetto sulla durata

- **Verso la banca**: la tassa frena il giocatore in testa sottraendo liquidità dal tavolo ogni 5 giri (in media ~2.900 Ƒ in più di tasse per partita), allungando la mediana di **7 giri** (da 46 a 53 giri).
- **Con la Panchina del Parco (`parkPot`)**: i soldi prelevati a chi è in testa tornano in circolo a chi si ferma sulla Panchina; la durata resta molto vicina alla partita classica (mediana **49 giri**, 98% di partite concluse entro il limite) favorendo le rimonte senza rallentare il tavolo.

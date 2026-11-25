# Tipi di partita

Durata misurata con `npm run preset -- 300`: 300 partite tra 4 computer normali per ogni tipo (massimo 150 giri).
I minuti sono una stima per 4 persone, con 25 secondi a turno.

| Tipo | Regole | Finite | Giri (mediana) | 90° percentile | Minuti in 4 persone | Nel gioco |
|---|---|---|---|---|---|---|
| Classica | `{}` | 299 | 46 | 77 | 75 | 46 |
| Rapida | `{"quickStart":true}` | 299 | 28 | 51 | 45 | 28 |
| Sprint | `{"quickStart":true,"sprintDie":true}` | 300 | 26 | 48 | 45 | 26 |
| Obiettivo | `{"goalGroups":2,"goalWorth":4000}` | 300 | 21 | 36 | 35 | 21 |
| Breve | `{"quickStart":true,"maxRounds":15}` | 300 | 15 | 15 | 25 | 15 |
| Festa | `{"events":true,"wheel":true}` | 299 | 46 | 72 | 75 | 46 |

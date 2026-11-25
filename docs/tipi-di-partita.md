# Tipi di partita

Durata misurata con `npm run preset -- 300`: 300 partite tra 4 computer normali per ogni tipo (massimo 150 giri).
I minuti sono una stima per 4 persone, con 25 secondi a turno.

| Tipo | Regole | Finite | Giri (mediana) | 90° percentile | Minuti in 4 persone | Nel gioco |
|---|---|---|---|---|---|---|
| Classica | `{}` | 299 | 46 | 71 | 75 | 47 |
| Rapida | `{"quickStart":true}` | 298 | 31 | 55 | 50 | 31 |
| Sprint | `{"quickStart":true,"sprintDie":true}` | 298 | 28 | 58 | 45 | 28 |
| Obiettivo | `{"goalGroups":2,"goalWorth":4000}` | 300 | 21 | 34 | 35 | 20 |
| Breve | `{"quickStart":true,"maxRounds":15}` | 300 | 15 | 15 | 25 | 15 |

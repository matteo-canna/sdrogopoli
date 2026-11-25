# Rapporto di bilanciamento

400 partite tra 4 giocatori computer sul tabellone "citta" (40 caselle), massimo 150 giri. Generato con `npm run simula -- 400 4 docs/bilanciamento.md citta`.

## Durata
- Partite finite con un vincitore: **399 su 400 (100%)**
- Giri per finire: mediana **48**, 10° percentile 31, 90° percentile 77
- Scambi accettati: 4.6 per partita · Aste: 3.4 per partita

## Vittorie per posto al tavolo
| Posto | Vittorie |
|---|---|
| 1° a giocare | 102 (26%) |
| 2° a giocare | 99 (25%) |
| 3° a giocare | 106 (27%) |
| 4° a giocare | 92 (23%) |

## Quartieri
Rendita = affitto medio incassato per partita, diviso il costo per comprare il quartiere e costruirci 3 case per via.

| Quartiere | Arrivi per partita | Completato | Affitto per partita | Costo con 3 case | Rendita |
|---|---|---|---|---|---|
| Periferia | 8.4 | 94% | 749 | 420 | 1.78 |
| Borgo Vecchio | 14.5 | 96% | 1145 | 770 | 1.49 |
| Mercato | 14.1 | 97% | 1185 | 1340 | 0.88 |
| Porto | 16.8 | 98% | 1405 | 1460 | 0.96 |
| Città Universitaria | 16.6 | 98% | 1261 | 2030 | 0.62 |
| Centro Storico | 15.2 | 96% | 1140 | 1970 | 0.58 |
| Colline | 14.7 | 96% | 1179 | 2360 | 0.50 |
| Lungolago | 8.7 | 97% | 2213 | 1950 | 1.14 |
| Fermate (4) | | | 548 | 800 | 0.69 |
| Servizi (2) | | | 186 | 300 | 0.62 |

## Caselle più visitate
- Caserma (solo in visita): 10% degli arrivi
- Panchina del Parco: 3% degli arrivi
- Viale della Sessione: 3% degli arrivi
- Partenza: 3% degli arrivi
- Molo dei Gabbiani: 3% degli arrivi
- Banchina dei Pescatori: 3% degli arrivi
- Funicolare Est: 3% degli arrivi
- Traghetto Sud: 3% degli arrivi

## Partita rapida
Stesse partite con la regola della casa "partita rapida" (3 proprietà a testa all'inizio).
- Partite finite: 400 su 400 · giri per finire: mediana **29**, 90° percentile 50
- Vittorie per posto: 1° 23% · 2° 26% · 3° 26% · 4° 25%

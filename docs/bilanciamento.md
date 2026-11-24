# Rapporto di bilanciamento

400 partite tra 4 giocatori computer, massimo 150 giri. Generato con `npm run simula -- 400 4`.

## Durata
- Partite finite con un vincitore: **398 su 400 (100%)**
- Giri per finire: mediana **45**, 10° percentile 31, 90° percentile 69
- Scambi accettati: 4.7 per partita · Aste: 3.5 per partita

## Vittorie per posto al tavolo
| Posto | Vittorie |
|---|---|
| 1° a giocare | 96 (24%) |
| 2° a giocare | 101 (25%) |
| 3° a giocare | 92 (23%) |
| 4° a giocare | 109 (27%) |

## Quartieri
Rendita = affitto medio incassato per partita, diviso il costo per comprare il quartiere e costruirci 3 case per via.

| Quartiere | Arrivi per partita | Completato | Affitto per partita | Costo con 3 case | Rendita |
|---|---|---|---|---|---|
| Periferia | 7.7 | 92% | 619 | 420 | 1.47 |
| Borgo Vecchio | 13.5 | 95% | 1119 | 770 | 1.45 |
| Mercato | 13.3 | 95% | 985 | 1340 | 0.73 |
| Porto | 15.7 | 97% | 1542 | 1460 | 1.06 |
| Città Universitaria | 15.6 | 97% | 1103 | 2030 | 0.54 |
| Centro Storico | 14.2 | 96% | 1431 | 1970 | 0.73 |
| Colline | 13.9 | 95% | 1239 | 2360 | 0.52 |
| Lungolago | 8.5 | 97% | 2154 | 1950 | 1.10 |
| Fermate (4) | | | 521 | 800 | 0.65 |
| Servizi (2) | | | 171 | 300 | 0.57 |

## Caselle più visitate
- Caserma (solo in visita): 10% degli arrivi
- Viale della Sessione: 3% degli arrivi
- Partenza: 3% degli arrivi
- Panchina del Parco: 3% degli arrivi
- Banchina dei Pescatori: 3% degli arrivi
- Funicolare Est: 3% degli arrivi
- Molo dei Gabbiani: 3% degli arrivi
- Traghetto Sud: 3% degli arrivi

## Partita rapida
Stesse partite con la regola della casa "partita rapida" (3 proprietà a testa all'inizio).
- Partite finite: 399 su 400 · giri per finire: mediana **29**, 90° percentile 52
- Vittorie per posto: 1° 21% · 2° 29% · 3° 24% · 4° 26%

## Da 2 a 8 giocatori (1.000 partite per numero di giocatori)
Simulazioni del 24 novembre 2026 con le carte nuove e il bonus di 30 per posto. La quota equa è 100% diviso il numero di giocatori.

| Giocatori | Mediana giri | Vittorie del 1° posto | Quota equa | Scarto |
|---|---|---|---|---|
| 2 | 68 | 50% | 50% | 0 |
| 5 | 43 | 21% | 20% | +1 |
| 6 | 40 | 19% | 16,7% | +2,3 |
| 7 | 36 | 13% | 14,3% | -1,3 |
| 8 | 34 | 14% | 12,5% | +1,5 |

Con 5-8 giocatori il primo posto resta entro 3 punti dalla quota equa: il bonus di 30 per posto basta e non cambia.

In due la partita normale è lunga (mediana 68 giri). Con la partita rapida a 3 proprietà a testa la mediana scende a 45 giri, con 4 proprietà a 36 giri (500 partite, vittorie 48% e 52%). Con 5 proprietà scende a 31 ma il secondo vince il 59%. Per questo in due la preparazione propone la partita rapida con 4 proprietà a testa.

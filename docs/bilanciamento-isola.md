# Rapporto di bilanciamento

300 partite tra 4 giocatori computer sul tabellone "isola" (32 caselle), massimo 150 giri. Generato con `npm run simula -- 300 4 docs/bilanciamento-isola.md isola`.

## Durata
- Partite finite con un vincitore: **298 su 300 (99%)**
- Giri per finire: mediana **33**, 10° percentile 20, 90° percentile 55
- Scambi accettati: 4.8 per partita · Aste: 2.0 per partita

## Vittorie per posto al tavolo
| Posto | Vittorie |
|---|---|
| 1° a giocare | 62 (21%) |
| 2° a giocare | 75 (25%) |
| 3° a giocare | 89 (30%) |
| 4° a giocare | 72 (24%) |

## Quartieri
Rendita = affitto medio incassato per partita, diviso il costo per comprare il quartiere e costruirci 3 case per via.

| Quartiere | Arrivi per partita | Completato | Affitto per partita | Costo con 3 case | Rendita |
|---|---|---|---|---|---|
| Saline | 7.2 | 92% | 595 | 420 | 1.42 |
| Mercato del Pesce | 8.4 | 96% | 2040 | 520 | 3.92 |
| Porticciolo | 13.3 | 96% | 1101 | 1340 | 0.82 |
| Vigneti | 14.2 | 97% | 1452 | 1460 | 0.99 |
| Scogliera | 13.5 | 93% | 1381 | 2030 | 0.68 |
| Calette | 12.6 | 93% | 1400 | 2150 | 0.65 |
| Capo del Faro | 7.5 | 93% | 2103 | 1900 | 1.11 |
| Fermate (3) | | | 411 | 540 | 0.76 |
| Servizi (1) | | | 86 | 150 | 0.57 |

## Caselle più visitate
- Torre della Guardia Costiera: 11% degli arrivi
- Traghetto della Baia: 4% degli arrivi
- Piazzetta dell'Ulivo: 4% degli arrivi
- Belvedere delle Falesie: 3% degli arrivi
- Terrazza dello Zibibbo: 3% degli arrivi
- Largo delle Gomene: 3% degli arrivi
- Sentiero dei Filari: 3% degli arrivi
- Calata delle Vele: 3% degli arrivi

## Partita rapida
Stesse partite con la regola della casa "partita rapida" (3 proprietà a testa all'inizio).
- Partite finite: 300 su 300 · giri per finire: mediana **24**, 90° percentile 47
- Vittorie per posto: 1° 28% · 2° 26% · 3° 26% · 4° 20%

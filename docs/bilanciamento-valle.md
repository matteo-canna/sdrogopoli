# Rapporto di bilanciamento

300 partite tra 4 giocatori computer sul tabellone "valle" (28 caselle), massimo 150 giri. Generato con `npm run simula -- 300 4 docs/bilanciamento-valle.md valle`.

## Durata
- Partite finite con un vincitore: **300 su 300 (100%)**
- Giri per finire: mediana **27**, 10° percentile 17, 90° percentile 43
- Scambi accettati: 4.1 per partita · Aste: 1.4 per partita

## Vittorie per posto al tavolo
| Posto | Vittorie |
|---|---|
| 1° a giocare | 78 (26%) |
| 2° a giocare | 85 (28%) |
| 3° a giocare | 68 (23%) |
| 4° a giocare | 69 (23%) |

## Quartieri
Rendita = affitto medio incassato per partita, diviso il costo per comprare il quartiere e costruirci 3 case per via.

| Quartiere | Arrivi per partita | Completato | Affitto per partita | Costo con 3 case | Rendita |
|---|---|---|---|---|---|
| Pineta | 6.4 | 87% | 349 | 420 | 0.83 |
| Miniera Vecchia | 12.3 | 93% | 1400 | 1000 | 1.40 |
| Borgata | 13.2 | 95% | 1379 | 1630 | 0.85 |
| Terme | 13.2 | 92% | 1578 | 2140 | 0.74 |
| Vetta | 7.8 | 95% | 2666 | 1800 | 1.48 |
| Ghiacciaio | 7.7 | 94% | 2604 | 1950 | 1.34 |
| Fermate (2) | | | 309 | 360 | 0.86 |
| Servizi (1) | | | 122 | 150 | 0.81 |

## Caselle più visitate
- Baita dei Guardaparco: 11% degli arrivi
- Trenino della Valle: 4% degli arrivi
- Largo della Sauna: 4% degli arrivi
- Belvedere: 4% degli arrivi
- Piazza del Forno: 4% degli arrivi
- Salita delle Capre: 4% degli arrivi
- Centralina della Valle: 4% degli arrivi
- Viale dei Vapori: 4% degli arrivi

## Partita rapida
Stesse partite con la regola della casa "partita rapida" (3 proprietà a testa all'inizio).
- Partite finite: 300 su 300 · giri per finire: mediana **18**, 90° percentile 32
- Vittorie per posto: 1° 21% · 2° 28% · 3° 26% · 4° 25%

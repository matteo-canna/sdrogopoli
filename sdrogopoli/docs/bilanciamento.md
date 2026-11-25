# Rapporto di bilanciamento

400 partite tra 4 giocatori computer, massimo 150 giri. Generato con `npm run simula -- 400 4`.

## Durata
- Partite finite con un vincitore: **398 su 400 (100%)**
- Giri per finire: mediana **45**, 10° percentile 30, 90° percentile 70
- Scambi accettati: 4.7 per partita · Aste: 3.6 per partita

## Vittorie per posto al tavolo
| Posto | Vittorie |
|---|---|
| 1° a giocare | 100 (25%) |
| 2° a giocare | 93 (23%) |
| 3° a giocare | 112 (28%) |
| 4° a giocare | 93 (23%) |

## Quartieri
Rendita = affitto medio incassato per partita, diviso il costo per comprare il quartiere e costruirci 3 case per via.

| Quartiere | Arrivi per partita | Completato | Affitto per partita | Costo con 3 case | Rendita |
|---|---|---|---|---|---|
| Periferia | 7.7 | 94% | 587 | 420 | 1.40 |
| Borgo Vecchio | 13.7 | 95% | 1085 | 770 | 1.41 |
| Mercato | 13.5 | 96% | 882 | 1340 | 0.66 |
| Porto | 16.2 | 97% | 1430 | 1460 | 0.98 |
| Città Universitaria | 15.7 | 96% | 1029 | 2030 | 0.51 |
| Centro Storico | 14.3 | 95% | 1449 | 1970 | 0.74 |
| Colline | 13.5 | 93% | 1319 | 2360 | 0.56 |
| Lungolago | 8.6 | 96% | 2340 | 1950 | 1.20 |
| Fermate (4) | | | 503 | 800 | 0.63 |
| Servizi (2) | | | 178 | 300 | 0.59 |

## Caselle più visitate
- Caserma (solo in visita): 10% degli arrivi
- Viale della Sessione: 3% degli arrivi
- Partenza: 3% degli arrivi
- Via delle Reti: 3% degli arrivi
- Banchina dei Pescatori: 3% degli arrivi
- Molo dei Gabbiani: 3% degli arrivi
- Traghetto Sud: 3% degli arrivi
- Panchina del Parco: 3% degli arrivi

## Partita rapida
Stesse partite con la regola della casa "partita rapida" (3 proprietà a testa all'inizio).
- Partite finite: 399 su 400 · giri per finire: mediana **28**, 90° percentile 51
- Vittorie per posto: 1° 24% · 2° 26% · 3° 25% · 4° 25%

## Cosa è cambiato dopo le simulazioni
**2026-11-24: partite più corte e meno vantaggio per chi inizia**
- Gli affitti con le case sono più alti del 30%, mentre quelli dei terreni senza case restano uguali.
- Il computer costruisce con meno prudenza: tiene da parte 150 invece di 250.
- La durata mediana tra 4 computer è passata da 59 a 45 giri.
- La nuova regola della casa **partita rapida** dà 3 proprietà a caso a ciascuno: la durata mediana scende a 28 giri.
- **Bonus per chi gioca dopo:** ogni posto parte con 30 sdroghi in più del precedente (0, 30, 60, 90).
  - Il primo a giocare vinceva il 31% delle partite; ora vince il 25%, cioè la quota giusta con 4 giocatori.
  - Con 50 sdroghi per posto la compensazione era eccessiva (22%).
  - Il bonus si può togliere dalle regole della casa.

**2026-11-23**
- **Scambi tra computer:** prima venivano sempre rifiutati. Ora il computer offre fino a 2,5 volte il prezzo per completare un quartiere, e il 99% delle partite finisce.
- **Centro Storico e Colline:** case più economiche e affitti più alti.
- **Lungolago:** affitti più bassi.

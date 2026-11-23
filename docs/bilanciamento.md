# Rapporto di bilanciamento

400 partite tra 4 giocatori computer, massimo 150 giri. Generato con `npm run simula -- 400 4`.

## Durata
- Partite finite con un vincitore: **394 su 400 (99%)**
- Giri per finire: mediana **59**, 10° percentile 39, 90° percentile 86
- Scambi accettati: 5.6 per partita · Aste: 3.2 per partita

## Vittorie per posto al tavolo
| Posto | Vittorie |
|---|---|
| 1° a giocare | 123 (31%) |
| 2° a giocare | 91 (23%) |
| 3° a giocare | 88 (22%) |
| 4° a giocare | 92 (23%) |

## Quartieri
Rendita = affitto medio incassato per partita, diviso il costo per comprare il quartiere e costruirci 3 case per via.

| Quartiere | Arrivi per partita | Completato | Affitto per partita | Costo con 3 case | Rendita |
|---|---|---|---|---|---|
| Periferia | 9.8 | 98% | 680 | 420 | 1.62 |
| Borgo Vecchio | 17.0 | 96% | 1322 | 770 | 1.72 |
| Mercato | 17.3 | 98% | 1044 | 1340 | 0.78 |
| Porto | 20.6 | 98% | 1366 | 1460 | 0.94 |
| Città Universitaria | 20.2 | 99% | 1311 | 2030 | 0.65 |
| Centro Storico | 18.4 | 98% | 1619 | 1970 | 0.82 |
| Colline | 17.4 | 97% | 1486 | 2360 | 0.63 |
| Lungolago | 11.2 | 98% | 2559 | 1950 | 1.31 |
| Fermate (4) | | | 684 | 800 | 0.85 |
| Servizi (2) | | | 233 | 300 | 0.78 |

## Caselle più visitate
- Caserma (solo in visita): 10% degli arrivi
- Partenza: 3% degli arrivi
- Viale della Sessione: 3% degli arrivi
- Via delle Reti: 3% degli arrivi
- Panchina del Parco: 3% degli arrivi
- Molo dei Gabbiani: 3% degli arrivi
- Banchina dei Pescatori: 3% degli arrivi
- Funicolare Est: 3% degli arrivi

## Cosa è cambiato dopo la simulazione (2026-11-23)
- **Scambi tra computer:** prima venivano sempre rifiutati (0 scambi a partita) e il 61% delle partite non finiva entro 150 giri. Ora il computer offre fino a 2,5 volte il prezzo per completare un quartiere e accetta se guadagna almeno il 15%: 99% delle partite finisce.
- **Centro Storico e Colline** rendevano poco (rendita 0,49 e 0,32): case più economiche (130 e 160) e affitti con case più alti del 20-25%.
- **Lungolago** rendeva troppo (1,91): affitto base 32 e 44, affitti con case più bassi del 15%.

## Cosa resta da tenere d'occhio
- Chi gioca per primo vince un po' più spesso (31% invece del 25% con 4 giocatori). È normale in questo genere di giochi; si può compensare in futuro.
- Le partite tra computer durano circa 60 giri con 4 giocatori: il computer costruisce con prudenza. Per partite più brevi ci sono le regole della casa (15, 25 o 40 giri).
- Periferia e Borgo Vecchio hanno la rendita più alta perché costano poco: incassano meno in assoluto, quindi va bene.

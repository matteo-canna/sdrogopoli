# Bilanciamento delle regole facoltative

Simulazione con 200 partite per configurazione tra 4 computer normali sul tabellone predefinito (40 caselle, semi fissi 1–200, limite massimo 150 giri).

| Configurazione | Giri (mediana) | Giri (90° perc.) | Vittorie 1° / 2° / 3° / 4° | Bancarotta | Limite giri |
| --- | ---: | ---: | --- | ---: | ---: |
| Nessuna regola facoltativa | 48 | 80 | 21% / 24% / 32% / 24% | 99.5% | 0.5% |
| Eventi di quartiere (`events`) | 47 | 69 | 27% / 21% / 23% / 30% | 100.0% | 0.0% |
| Ruota del Mercato (`wheel`) | 47 | 74 | 28% / 28% / 25% / 19% | 99.5% | 0.5% |
| Quote di quartiere (`shares`) | 58 | 84 | 29% / 23% / 24% / 23% | 98.5% | 1.5% |
| Edifici speciali (`landmarks`) | 47 | 71 | 21% / 24% / 34% / 22% | 99.5% | 0.5% |
| Dado Sprint (`sprintDie`) | 42 | 70 | 28% / 26% / 28% / 19% | 99.5% | 0.5% |
| Squadre 2 vs 2 (`teams`) | 47 | 77 | 23% / 28% / 29% / 20% | 99.5% | 0.5% |
| Tutte insieme | 38 | 59 | 24% / 25% / 22% / 30% | 100.0% | 0.0% |

Note:
- Mediana, 90° percentile e vittorie per posto sono calcolati sulle partite concluse entro 150 giri.
- In modalità squadre (`teams`), il 1° e il 3° posto formano la Squadra 1, il 2° e il 4° la Squadra 2; la colonna indica il posto del giocatore registrato come vincitore.
- Per misurare una nuova regola di `GameRules`, aggiungere una voce all'array `CONFIGS` in `scripts/regole.ts` e rilanciare `npm run regole`.

Scritto da `npm run regole` (229.3 s).

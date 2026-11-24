# Stato del progetto

_Aggiornare alla fine di ogni sessione di lavoro._

## Obiettivo attuale
Prototipo giocabile nel browser, completamente gratuito (niente server, pubblicità o acquisti).

## Piano
1. ✅ Base del progetto: Vite + TypeScript + Vitest, cartelle, pubblicazione su GitHub Pages.
2. ✅ Contenuti originali: tabellone, caselle, prezzi, affitti e carte in JSON (`src/data/`).
3. ✅ Motore di gioco con test: turni, dadi, movimento, acquisto, affitti, carte, prigione, bancarotta, vincitore.
4. ✅ Interfaccia minima
5. ✅ Vista 3D con camera che segue la pedina: tabellone HTML/CSS, 2-8 giocatori sullo stesso dispositivo.

## Decisioni
- Interfaccia in HTML/CSS + TypeScript semplice (niente React per ora; si può rivalutare).
- Vista 3D con Three.js (gratuito, licenza MIT) in `src/ui/three/`. Resta disponibile la vista 2D, usata anche se il browser non supporta WebGL.
- Il motore riceve il generatore casuale come parametro (`Rng`), così i test sono deterministici.
- Hosting: GitHub Pages (richiede repository pubblico).
- Valuta: sdroghi (Ꞩ), 1500 a testa all'inizio, 200 di stipendio alla Partenza.
- Personaggi-pedina 3D: KayKit Adventurers di Kay Lousberg (licenza CC0, gratuiti anche per uso commerciale), in `public/characters/`. I modelli originali sono ridotti con gltf-transform (solo 6 animazioni, dati compressi): circa 430 KB l'uno.
- Mazzi di carte: "Colpo di Sorte" e "Voci di Quartiere" (12 carte ciascuno).

## Fatto finora
- 2026-11-23: struttura iniziale, lancio dei dadi nel motore con test, pagina provvisoria.
- 2026-11-23: proposta di tabellone (40 caselle, 8 quartieri) e 24 carte in `src/data/`, con test di coerenza dei dati.
- 2026-11-23: motore di gioco (`state.ts`, `rules.ts`) con 39 test: turni, doppi, Caserma, acquisto, affitti, carte, case, ipoteche, debiti e bancarotta.
- 2026-11-23: interfaccia con tabellone HTML/CSS, schermata iniziale 2-4 giocatori, scheda delle caselle, gestione case/ipoteche, partita salvata nel browser.
- 2026-11-23: vista 3D: tabellone con caselle disegnate, pedine che saltano casella per casella, case e palazzi, camera che segue la pedina o vista d'insieme.
- 2026-11-23: avversari controllati dal computer (`src/engine/bot.ts`), scelta Persona/Computer nella schermata iniziale.
- 2026-11-23: pannello più chiaro ("Cosa è successo", patrimonio, posizione, registro completo), layout per telefono con pulsanti grandi, avviso di salvataggio automatico.
- 2026-11-23: aste (quando chi arriva non compra) e scambi tra giocatori, anche con il computer.
- 2026-11-23: regole della casa (soldi iniziali, durata in giri con vittoria a patrimonio, montepremi della Panchina).
- 2026-11-23: simulazione di bilanciamento (`npm run simula`), rapporto in `docs/bilanciamento.md`; ritoccati affitti di Centro Storico, Colline e Lungolago e gli scambi del computer.
- 2026-11-23: suoni e musica originali generati con la Web Audio API (`src/ui/audio.ts`), nessun file audio; pulsanti Effetti e Musica.
- 2026-11-23: ritocchi 3D: camera più vicina, pedine di forma diversa (pedone, torre, gemma, anello), freccia sulla pedina di turno, dadi 3D che cadono e si fermano sul risultato.
- 2026-11-23: pedine-personaggio 3D animate (cavaliere, barbaro, mago, furfante, incappucciato) che camminano, saltano in Caserma, esultano alla vittoria e cadono in bancarotta. Nella schermata iniziale ognuno sceglie personaggio, colore, copricapo, mantello e oggetto in mano, con anteprima 3D; l'aspetto viene ricordato. Se il modello non si carica resta la pedina semplice.
- 2026-11-24: partite più corte (affitti con case +30%, computer che costruisce prima: mediana da 59 a 45 giri), regola "partita rapida" con 3 proprietà a testa (mediana 28 giri), bonus di 30 per ogni posto dopo il primo (il primo vince il 25% invece del 31%).
- 2026-11-24: i personaggi reagiscono agli eventi: esultano quando comprano, lavorano quando costruiscono, si piegano quando pagano, fanno un gesto quando incassano, stanno seduti in Caserma. Le reazioni partono quando tutti si sono fermati. Modelli ora con 9 animazioni (circa 520 KB l'uno).
- 2026-11-24: tutorial con consigli brevi (`src/ui/tutorial.ts`): compaiono la prima volta che una persona incontra una situazione (inizio, acquisto, asta, doppio, quartiere completo, Caserma, debito, scambi). "Ho capito" li segna come letti, "Basta consigli" li spegne; si riattivano dalle regole della casa.
- 2026-11-24: statistiche di fine partita: il motore conta affitti, tasse, acquisti, case, scambi, doppi, Caserma e giro della bancarotta (`state.stats`) e fotografa i patrimoni a ogni giro (`state.history`). A fine partita: classifica, grafico del patrimonio e premi (`src/ui/summary.ts`). Classifica tra amici salvata nel browser, visibile nella schermata iniziale.
- 2026-11-24: risolta la schermata bianca dopo molti clic: a ogni ridisegno si apriva un contesto WebGL di prova e il browser, superato il limite, spegneva quello del tabellone. Ora la prova si fa una volta, i contesti si liberano subito e se la grafica si perde comunque la scena 3D si ricrea da sola.
- 2026-11-24: tabellone più vivo (`src/ui/three/city.ts`): al centro una città in miniatura con parco e fontana, lago con barchette, due quartieri di palazzine, alberi e lampioni lungo il viale; case con finestre, porta e comignolo, palazzi a gradoni. Ciclo giorno/tramonto/notte/alba che avanza di una tappa a ogni giro (di notte si accendono finestre e lampioni); pulsante per scegliere ciclo, sempre giorno o sempre notte.
- 2026-11-24: interfaccia rinnovata dopo una revisione di design e accessibilità: token di stile comuni in `src/ui/style.css` (colori, raggi, ombre, focus), schermata iniziale con intestazione e scheda "Chi gioca?", pannello del turno con il colore di chi gioca, schede giocatori con striscia colorata e proprietà in ordine di tabellone, barra dei comandi 3D compatta. Accessibilità: in tema scuro il testo dei pulsanti principali ora è scuro (prima contrasto 2.3:1), bordi dei campi a 3:1, anello di focus visibile da tastiera, animazioni spente con "riduci movimento". Prima/dopo in `docs/interfaccia/`.
- 2026-11-24: schermata di caricamento (in `index.html`, visibile prima del codice) con barra di avanzamento e consigli a rotazione; intanto si caricano i personaggi 3D che servono (`src/ui/loading.ts`). Se un modello non arriva la schermata sparisce comunque (al massimo 12 secondi). Schermata iniziale su due colonne: a fianco di "Chi gioca?" ci sono "Come si gioca" in 4 passi, le regole in breve, i numeri del tabellone e gli 8 quartieri con i prezzi (`src/ui/intro.ts`, con test); in fondo versione e crediti.
- 2026-11-24: fino a 8 giocatori (`MAX_PLAYERS = 8`, prima 4). Nella schermata iniziale si vedono 4 posti e "Aggiungi giocatore" mostra gli altri; ogni posto ha colore (8 colori) e personaggio proposti diversi. Nella stessa casella, da 5 giocatori in su, le pedine si dispongono su una griglia 3×3 senza il centro e sono più piccole del 20% (`src/ui/tokenLayout.ts`, con test che controlla che non si sovrappongano); nel 2D vanno a capo su due file. Partita rapida in 8: 2 proprietà a testa invece di 3 (le proprietà sono 22). Classifica finale con medaglie per i primi tre e poi 4°-8°. Simulazione con 8 computer (300 partite): mediana 33 giri, vittorie per posto tra 14% (1°) e 10% (8°), il bonus di 30 per posto resta uguale. Anteprime in `docs/interfaccia/otto-*.jpg`.

## Prossimi passi possibili
- Multiplayer online (rimandato da Matteo).

## Regole semplificate nel prototipo
- Con un debito il giocatore vende case o ipoteca; se non basta dichiara bancarotta.
- Negli scambi le caselle ipotecate passano senza il 10% di interessi.
- Con la carta "compleanno" chi non ha soldi paga solo quello che ha.

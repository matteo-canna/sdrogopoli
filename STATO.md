# Stato del progetto

_Aggiornare alla fine di ogni sessione di lavoro._

## Obiettivo attuale
Prototipo giocabile nel browser, completamente gratuito (niente server, pubblicità o acquisti).

## Piano
1. ✅ Base del progetto: Vite + TypeScript + Vitest, cartelle, pubblicazione su GitHub Pages.
2. ✅ Contenuti originali: tabellone, caselle, prezzi, affitti e carte in JSON (`src/data/`).
3. ✅ Motore di gioco con test: turni, dadi, movimento, acquisto, affitti, carte, prigione, bancarotta, vincitore.
4. ✅ Interfaccia minima
5. ✅ Vista 3D con camera che segue la pedina: tabellone HTML/CSS, 2-4 giocatori sullo stesso dispositivo.

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

## Prossimi passi possibili
- Multiplayer online (rimandato da Matteo).
- Compensare il leggero vantaggio di chi gioca per primo (vedi `docs/bilanciamento.md`).

## Regole semplificate nel prototipo
- Con un debito il giocatore vende case o ipoteca; se non basta dichiara bancarotta.
- Negli scambi le caselle ipotecate passano senza il 10% di interessi.
- Con la carta "compleanno" chi non ha soldi paga solo quello che ha.

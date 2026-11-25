# I personaggi-pedina

Nell'editor dell'aspetto (il pulsante colorato di ogni posto nella schermata iniziale) si sceglie
il personaggio. Ce ne sono di due tipi.

## Scaricati

Gli avventurieri di KayKit (licenza CC0) in `public/characters/`, circa 430 KB l'uno. Hanno le
animazioni registrate nel file, il cappello e il mantello che si possono spegnere e un oggetto da
tenere in mano. Il file arriva al browser la prima volta che quel personaggio compare.

## Fatti nel codice

Robottino 🤖, Gatto 🐈 e Astronauta 🧑‍🚀 non sono file da scaricare: sono forme semplici (cubi,
sfere, cilindri) montate da `src/ui/three/figures.ts`. Pesano zero byte di modelli e il codice che
li costruisce sta in un pezzo a parte (`dist/assets/figures-*.js`, circa 5 kB, 2 kB compressi),
caricato con un `import()` solo quando qualcuno ne sceglie uno: chi gioca con gli avventurieri non
lo scarica mai.

Non hanno cappello, mantello né oggetti in mano, quindi l'editor nasconde quei comandi. Hanno la
stessa base colorata degli altri, così si riconosce il giocatore da lontano, e vengono alti come
loro: la figura si misura con un `Box3` e si scala al 94% dell'altezza richiesta, appoggiata a terra.

## Le pose

Gli avventurieri usano le animazioni del file; le figure del codice no, quindi `applyPose` muove le
parti (testa, braccia, gambe, tutto il corpo) in base al tempo: `idle` respira, `walk` dondola le
braccia in opposizione e alza le gambe, `jump` stacca da terra, `cheer` alza le braccia, `hit` si
piega indietro, `collect` si abbassa a raccogliere, `build` martella, `defeat` si accascia e `sit`
si siede. Le due famiglie espongono la stessa interfaccia `Piece` (`setBase`, `react`, `update`),
quindi il resto del 3D non sa con quale dei due sta lavorando. Una reazione dura 1,2 secondi e poi
torna la posa di base, e camminare la interrompe subito.

## Aggiungerne uno

1. Scrivere una funzione `build…(color)` in `src/ui/three/figures.ts` che restituisca un
   `FigureParts` (gruppo, testa, corpo, due braccia, due gambe, le parti che dondolano), coi piedi
   sull'origine e l'altezza intorno a 1.
2. Aggiungerla a `FIGURES` con il suo id.
3. Aggiungere la voce in `CHARACTERS` (`src/ui/characters.ts`) con `figure: true`, `file: ''`,
   `hat: null`, `cape: null`, `items: {}` e un'emoji.
4. Aggiungere il nome in `src/i18n/it.ts` e `src/i18n/en.ts` (chiave `char.<id>`).

`tests/figure.test.ts` controlla da sé che catalogo, nomi, altezza, colore della base e pose
restino a posto.

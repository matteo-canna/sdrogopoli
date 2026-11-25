# Quote di quartiere ed edifici speciali

Due regole facoltative, da accendere nelle regole della casa ("📈 Quote di quartiere" e
"🏛️ Edifici speciali"). Valgono da sole o insieme, e con qualunque tipo di partita e tabellone.

## Quote di quartiere

Ogni quartiere ha **3 quote**. Chi è di turno ne compra una dalla carta di una via del quartiere
(prima o dopo aver lanciato i dadi) e la paga alla banca: costa metà del prezzo medio delle sue vie,
arrotondato a 10 (`sharePrice`). Se ne possono avere più d'una dello stesso quartiere.

Quando qualcuno paga l'affitto su una via del quartiere, **chi ha una quota riceve dal
proprietario il 10% dell'affitto** per ogni quota (`payDividends`). Non ricevono niente chi paga
l'affitto e il proprietario stesso: la quota rende sulle vie degli altri. Così anche chi non ha il
quartiere guadagna qualcosa quando un avversario lo fa fruttare.

Una quota si rivende alla banca a metà prezzo. Nel patrimonio vale il prezzo pieno, come le case;
in caso di debito si vende prima delle case e delle ipoteche, e chi fallisce la restituisce alla
banca (metà prezzo).

## Edifici speciali

Chi ha **tutto un quartiere**, senza vie ipotecate, può costruirci **un** edificio speciale. Costa
quanto due case del quartiere (`landmarkPrice`) e si sceglie tra tre:

| | effetto |
| --- | --- |
| ⛲ Fontana | gli affitti del quartiere salgono del 25% |
| 🏪 Mercato coperto | passando dalla Partenza chi l'ha costruito incassa 20 per ogni via del quartiere |
| 🎭 Teatro | chi si ferma su una via del quartiere paga almeno 60 di affitto (non sulle vie ipotecate) |

Gli effetti si sommano a eventi di quartiere e Ruota del Mercato (la fontana è un fattore in
`rentFactor`, il teatro un minimo applicato dopo). Un quartiere con un edificio speciale è come un
quartiere con le case: le sue vie non si ipotecano e non si scambiano finché l'edificio c'è.
L'edificio si vende alla banca a metà prezzo, si annulla come una casa, conta nel patrimonio e
torna alla banca se chi l'ha costruito fallisce.

Sul tabellone 2D l'icona dell'edificio compare nella fascia colorata delle vie del quartiere; nella
carta della casella si vedono quote, chi le ha, l'edificio e i pulsanti.

## Il computer

- compra una quota quando gli avanzano soldi (almeno il doppio della sua riserva), dove gli
  avversari incassano gli affitti più alti, e non più di due quote per quartiere;
- costruisce un edificio quando il quartiere ha almeno 3 case per via: la fontana dove gli
  affitti sono alti, il teatro dove sono bassi, il mercato coperto in mezzo;
- in debito vende prima le quote, poi l'edificio, poi le case.

## Equilibrio

`npm run quote` fa giocare 300 partite tra quattro computer normali, le stesse con e senza le
regole, e scrive `docs/bilanciamento-quote.md`. Risultato:

- le **quote** allungano la partita di circa 8 giri (mediana 55 contro 47), perché una parte degli
  affitti dei quartieri migliori va a chi è indietro; le rimonte salgono dal 40% al 45%. Per una
  serata corta conviene unirle a un limite di giri;
- gli **edifici speciali** non cambiano la durata (46 giri) e restano una spesa in più per chi ha
  già un quartiere completo;
- con tutte e due la partita dura 53 giri e le vittorie per posto restano tra il 23% e il 28%.

Prove: `tests/quote.test.ts` (prezzi, acquisti e vendite, dividendi, effetti dei tre edifici,
blocchi su ipoteche e scambi, bancarotta, partite intere tra computer rigiocate uguali dal registro)
ed `e2e/quote.spec.ts`.

# Eventi di quartiere e Ruota del Mercato

Due regole facoltative, spente se non si accendono. Si accendono insieme con il tipo di partita
**Festa**, oppure una per volta dalle regole della casa.

## Eventi di quartiere

A ogni giro succede qualcosa in un quartiere estratto a caso. Dura un giro solo e si vede al
centro del tabellone (nel 3D nel pannello di fianco).

| Evento | Cosa fa |
| --- | --- |
| 🎪 Festa | per quel giro gli affitti del quartiere sono doppi |
| 🚧 Lavori | per quel giro gli affitti del quartiere valgono la metà |
| 🧺 Mercatino | chi ha una via del quartiere incassa 40 per via, subito |
| 🔨 Manutenzione | chi ha case nel quartiere paga 20 per casa, subito (il palazzo conta come cinque) |

La manutenzione non manda mai in debito: chi non ha abbastanza paga solo quello che ha, come la
carta del compleanno. Il debito infatti lo salda solo chi è di turno, e qui pagano tutti insieme.

## Ruota del Mercato

Ogni 5 giri la ruota gira e l'andamento vale per i 5 giri successivi.

| Faccia | Cosa fa |
| --- | --- |
| 📈 Rialzo | tutti gli affitti aumentano di un quarto |
| 📉 Ribasso | tutti gli affitti calano di un quarto |
| 💶 Buste pesanti | lo stipendio della Partenza è una volta e mezza |
| 😴 Calma piatta | non cambia niente |

Gli effetti si moltiplicano: una festa durante un rialzo vale due volte e mezza l'affitto normale
(`rentFactor` in `src/engine/rules.ts`).

## Durata

Misurata con `npm run preset`: la Festa dura quanto la Classica (46 giri di mediana in quattro
computer), quindi cambia il ritmo della partita e non la sua lunghezza.

L'estrazione usa il generatore della partita, quindi dallo stesso seme esce sempre la stessa
sequenza di eventi: le partite si rigiocano e si rivedono uguali.

// Valore in soldi di un effetto di carta: serve al computer per scegliere tra due opzioni
// e ai test per controllare che i mazzi siano equilibrati (valore medio vicino a zero).
import type { CardEffect } from './types';

export interface CardValueContext {
  // avversari ancora in gioco
  others: number;
  // case e palazzi posseduti
  houses: number;
  hotels: number;
  salary: number;
  // indice della casella attuale e numero di caselle (per sapere se si passa dalla Partenza)
  position: number;
  size: number;
  indexOf: (spaceId: string) => number;
  // a fine partita restare in Caserma conviene (si incassano affitti senza rischiare)
  jailIsSafe: boolean;
}

export function cardValue(effect: CardEffect, c: CardValueContext): number {
  switch (effect.kind) {
    case 'gain':
      return effect.amount;
    case 'pay':
      return -effect.amount;
    case 'payEachPlayer':
      return -effect.amount * c.others;
    case 'collectFromEachPlayer':
      return effect.amount * c.others;
    case 'repairs':
      return -(effect.perHouse * c.houses + effect.perHotel * c.hotels);
    case 'goToJail':
      return c.jailIsSafe ? 20 : -60;
    case 'getOutOfJailFree':
      return 40;
    case 'moveTo': {
      const target = c.indexOf(effect.space);
      // si va sempre avanti: si passa dalla Partenza se la meta è "dietro"
      return target <= c.position || target === 0 ? c.salary : 0;
    }
    case 'moveBy':
      return effect.steps > 0 && c.position + effect.steps >= c.size ? c.salary : 0;
    case 'moveToNearest':
      return 0;
    case 'choice':
      return Math.max(...effect.options.map((o) => cardValue(o.effect, c)));
  }
}

// Valore "medio" senza una partita: 3 avversari, 2 case, a metà tabellone.
export function typicalCardValue(effect: CardEffect, salary = 200, indexOf: (id: string) => number = () => 0): number {
  return cardValue(effect, { others: 3, houses: 2, hotels: 0, salary, position: 20, size: 40, indexOf, jailIsSafe: false });
}

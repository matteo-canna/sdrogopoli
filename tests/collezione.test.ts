// Pedine da collezione: catalogo, nomi nelle due lingue e aspetto ripulito.
import { describe, expect, it } from 'vitest';
import { CHARACTERS, collectionLook } from '../src/ui/characters';
import { TOKEN_IDS } from '../src/ui/three/models';
import { cleanLook } from '../src/net/sanitize';
import { it as itMsgs } from '../src/i18n/it';
import { en } from '../src/i18n/en';
import type { MsgKey } from '../src/i18n';

const ids = CHARACTERS.filter((c) => c.collection).map((c) => c.id);

describe('pedine da collezione', () => {
  it('sono 30 e ognuna si sa costruire', () => {
    expect(ids).toHaveLength(30);
    expect([...ids].sort()).toEqual([...TOKEN_IDS].sort());
  });

  it('hanno un nome in italiano e in inglese', () => {
    for (const id of ids) {
      expect(itMsgs[`char.${id}` as MsgKey]).toBeTruthy();
      expect(en[`char.${id}` as MsgKey]).toBeTruthy();
    }
  });

  it('finitura, dettagli e basetta sconosciuti tornano a quelli proposti', () => {
    const look = collectionLook({ character: 'moka', color: '#e4572e', hat: false, cape: false, item: '', finish: 'plastica' as never, accentColor: 'rosso', baseStyle: 'oro' as never });
    expect(look).toEqual({ finish: 'real', accentColor: '#f4b400', baseStyle: 'minimal' });
  });

  it('online si tengono le scelte valide e si scartano le altre', () => {
    const ok = cleanLook({ character: 'crown', color: '#2e86de', finish: 'gold', accentColor: '#ffffff', baseStyle: 'marble' }, 0);
    expect(ok).toMatchObject({ character: 'crown', finish: 'gold', accentColor: '#ffffff', baseStyle: 'marble' });
    const bad = cleanLook({ character: 'crown', color: '#2e86de', finish: '<script>', baseStyle: 1 }, 0);
    expect(bad).toMatchObject({ finish: 'real', baseStyle: 'minimal' });
    // i personaggi classici non ricevono campi in più
    expect(cleanLook({ character: 'knight', color: '#2e86de' }, 0)).not.toHaveProperty('finish');
  });
});

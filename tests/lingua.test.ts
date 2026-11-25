import { describe, it, expect, afterEach } from 'vitest';
import { it as itMsgs } from '../src/i18n/it';
import { en } from '../src/i18n/en';
import { detectLang, format, setLang, t, text, type MsgKey } from '../src/i18n';
import cardsEn from '../src/data/cards.en.json';
import boardEn from '../src/data/board.en.json';
import { board, cards } from '../src/data';
import { BOT_LEVELS, BOT_STYLES } from '../src/engine/bot';
import { PRESETS } from '../src/engine/presets';
import { SPEEDS, SKY_LABELS } from '../src/ui/prefs';
import { TIP_IDS } from '../src/ui/tutorial';
import { CHARACTERS } from '../src/ui/characters';
import { QUICK_SAYS } from '../src/net/chat';
import { TEXT_SIZES, MOTIONS } from '../src/ui/settings';

const placeholders = (s: string) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();

afterEach(() => setLang('it'));

describe('frasi in italiano e in inglese', () => {
  it('le due lingue hanno le stesse chiavi e gli stessi segnaposto', () => {
    expect(Object.keys(en).sort()).toEqual(Object.keys(itMsgs).sort());
    for (const k of Object.keys(itMsgs) as MsgKey[]) {
      expect(placeholders(en[k]), k).toEqual(placeholders(itMsgs[k]));
      expect(en[k].trim(), k).not.toBe('');
    }
  });

  it('esistono tutte le chiavi composte al momento', () => {
    const keys: string[] = [
      ...BOT_LEVELS.flatMap((l) => [`bot.level.${l.id}`, `setup.computer.${l.id}`]),
      ...BOT_STYLES.flatMap((s) => [`bot.style.${s.id}`, `bot.styleText.${s.id}`]),
      ...PRESETS.flatMap((p) => [`preset.${p.id}`, `presetText.${p.id}`]),
      ...SPEEDS.map((s) => `speed.${s.id}`),
      ...Object.values(SKY_LABELS).map(([, k]) => k),
      ...TIP_IDS.flatMap((id) => [`tip.${id}.title`, `tip.${id}.text`]),
      ...CHARACTERS.flatMap((c) => Object.keys(c.items).map((m) => `item.${m}`)),
      ...Array.from({ length: 12 }, (_, i) => `color.${i}`),
      ...TEXT_SIZES.map((x) => `settings.text.${x.id}`),
      ...MOTIONS.map((x) => `settings.motion.${x.id}`),
      ...QUICK_SAYS.filter((q) => /\p{L}/u.test(q.text)).map((q) => `say.${q.id}`),
    ];
    const missing = keys.filter((k) => !Object.hasOwn(itMsgs, k));
    expect(missing).toEqual([]);
  });

  it('ogni carta ha il testo inglese, con lo stesso numero di scelte', () => {
    const tr = cardsEn as Record<string, { text: string; options?: string[] }>;
    for (const c of cards.cards) {
      expect(tr[c.id]?.text, c.id).toBeTruthy();
      const n = c.effect.kind === 'choice' ? c.effect.options.length : undefined;
      expect(tr[c.id].options?.length, c.id).toBe(n);
    }
  });

  it('i nomi inglesi delle caselle sono di caselle vere', () => {
    const ids = new Set(board.spaces.map((s) => s.id));
    for (const id of Object.keys(boardEn)) expect(ids.has(id), id).toBe(true);
  });
});

describe('scelta della lingua', () => {
  it('segue le lingue del browser', () => {
    expect(detectLang(['en-US'])).toBe('en');
    expect(detectLang(['it-IT', 'en'])).toBe('it');
    expect(detectLang(['de-DE', 'en-GB'])).toBe('en');
    expect(detectLang(['fr-FR'])).toBe('en');
  });

  it('il registro si legge nella lingua di chi guarda, anche le righe vecchie', () => {
    const line = { k: 'log.turn' as MsgKey, p: { name: 'Anna' } };
    expect(text(line)).toBe(format('it', 'log.turn', { name: 'Anna' }));
    setLang('en');
    expect(text(line)).toBe(en['log.turn'].replace('{name}', 'Anna'));
    expect(text('Riga di una partita vecchia')).toBe('Riga di una partita vecchia');
  });

  it('una chiave sconosciuta si mostra così com\'è', () => {
    expect(t('non.esiste' as MsgKey)).toBe('non.esiste');
    expect(t('toString' as MsgKey)).toBe('toString');
  });
});

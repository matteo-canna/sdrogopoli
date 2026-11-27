import { BOARDS, board, cards } from '../src/data';
import { describe, it, expect, afterEach } from 'vitest';
import { it as itMsgs } from '../src/i18n/it';
import { en } from '../src/i18n/en';
import { es } from '../src/i18n/es';
import { LANGS, cardOption, cardText, detectLang, format, setLang, spaceName, t, text, type MsgKey } from '../src/i18n';
import cardsEn from '../src/data/cards.en.json';
import cardsEs from '../src/data/cards.es.json';
import boardEn from '../src/data/board.en.json';
import boardEs from '../src/data/board.es.json';
import boardValleEs from '../src/data/board.valle.es.json';
import { BOT_LEVELS, BOT_STYLES } from '../src/engine/bot';
import { PRESETS } from '../src/engine/presets';
import { SPEEDS, SKY_LABELS } from '../src/ui/prefs';
import { TIP_IDS } from '../src/ui/tutorial';
import { CHARACTERS } from '../src/ui/characters';
import { QUICK_SAYS } from '../src/net/chat';
import { TEXT_SIZES, MOTIONS } from '../src/ui/settings';
import { ACHIEVEMENTS, EXTRA_COLORS } from '../src/ui/achievements';

const placeholders = (s: string) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();

afterEach(() => setLang('it'));

describe('frasi in italiano, inglese e spagnolo', () => {
  it('le lingue hanno le stesse chiavi e gli stessi segnaposto', () => {
    expect(LANGS.map((l) => l.id)).toEqual(['it', 'en', 'es']);
    expect(LANGS.find((l) => l.id === 'es')?.label).toBe('Español');
    for (const [lang, catalog] of [['en', en], ['es', es]] as const) {
      expect(Object.keys(catalog).sort(), lang).toEqual(Object.keys(itMsgs).sort());
      for (const k of Object.keys(itMsgs) as MsgKey[]) {
        expect(placeholders(catalog[k]), `${lang}.${k}`).toEqual(placeholders(itMsgs[k]));
        expect(catalog[k].trim(), `${lang}.${k}`).not.toBe('');
      }
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
      ...BOARDS.flatMap((b) => [`board.${b.id}`, `boardText.${b.id}`]),
      ...TEXT_SIZES.map((x) => `settings.text.${x.id}`),
      ...MOTIONS.map((x) => `settings.motion.${x.id}`),
      ...QUICK_SAYS.filter((q) => /\p{L}/u.test(q.text)).map((q) => `say.${q.id}`),
      ...ACHIEVEMENTS.flatMap((a) => [`goal.${a.id}`, `goalText.${a.id}`, ...(a.unlock.kind === 'title' ? [`title.${a.unlock.id}`] : [])]),
      ...Object.keys(EXTRA_COLORS).map((c) => `color.${c}`),
    ];
    const missing = keys.filter((k) => !Object.hasOwn(itMsgs, k));
    expect(missing).toEqual([]);
  });

  it('ogni carta ha il testo inglese e spagnolo, con lo stesso numero di scelte', () => {
    for (const [lang, raw] of [['en', cardsEn], ['es', cardsEs]] as const) {
      const tr = raw as Record<string, { text: string; options?: string[] }>;
      for (const c of cards.cards) {
        expect(tr[c.id]?.text, `${lang}:${c.id}`).toBeTruthy();
        const n = c.effect.kind === 'choice' ? c.effect.options.length : undefined;
        expect(tr[c.id].options?.length, `${lang}:${c.id}`).toBe(n);
      }
    }
    setLang('es');
    expect(cardText('sorte-01')).toContain('Salida');
    expect(cardOption('sorte-13', 0)).toContain('parada');
  });

  it('i nomi inglesi e spagnoli delle caselle sono di caselle vere', () => {
    const ids = new Set(board.spaces.map((s) => s.id));
    for (const id of Object.keys(boardEn)) expect(ids.has(id), id).toBe(true);
    for (const id of Object.keys(boardEs)) expect(ids.has(id), id).toBe(true);
    const valleIds = new Set(BOARDS.find((b) => b.id === 'valle')!.data.spaces.map((s) => s.id));
    for (const id of Object.keys(boardValleEs)) expect(valleIds.has(id), id).toBe(true);
    for (const choice of BOARDS) {
      for (const s of choice.data.spaces) {
        if (s.type === 'property') continue;
        expect(choice.namesEs?.[s.id], `${choice.id}:${s.id}`).toBeTruthy();
      }
    }
    expect(spaceName('partenza', 'es')).toBe('Salida');
    expect(spaceName('v-partenza', 'es')).toBe('Salida');
    // le vie restano in italiano anche in spagnolo
    expect(spaceName('periferia-1', 'es')).toBe('Vicolo dei Gatti Neri');
  });
});

describe('scelta della lingua', () => {
  it('segue le lingue del browser', () => {
    expect(detectLang(['en-US'])).toBe('en');
    expect(detectLang(['it-IT', 'en'])).toBe('it');
    expect(detectLang(['es-ES', 'en'])).toBe('es');
    expect(detectLang(['es-MX'])).toBe('es');
    expect(detectLang(['de-DE', 'es-AR'])).toBe('es');
    expect(detectLang(['de-DE', 'en-GB'])).toBe('en');
    expect(detectLang(['fr-FR'])).toBe('en');
  });

  it('il registro si legge nella lingua di chi guarda, anche le righe vecchie', () => {
    const line = { k: 'log.turn' as MsgKey, p: { name: 'Anna' } };
    expect(text(line)).toBe(format('it', 'log.turn', { name: 'Anna' }));
    setLang('en');
    expect(text(line)).toBe(en['log.turn'].replace('{name}', 'Anna'));
    setLang('es');
    expect(text(line)).toBe(es['log.turn'].replace('{name}', 'Anna'));
    expect(text('Riga di una partita vecchia')).toBe('Riga di una partita vecchia');
  });

  it('una chiave sconosciuta si mostra così com\'è', () => {
    expect(t('non.esiste' as MsgKey)).toBe('non.esiste');
    expect(t('toString' as MsgKey)).toBe('toString');
  });
});

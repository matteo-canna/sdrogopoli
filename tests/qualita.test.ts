import { describe, it, expect } from 'vitest';
import { autoQuality, FrameWatch, QUALITY_SETTINGS, resolveQuality } from '../src/ui/quality';

describe('qualità grafica', () => {
  it('automatica: prudente sui dispositivi piccoli, alta sui computer', () => {
    expect(autoQuality({ cores: 2, memory: 2, touch: true })).toBe('bassa');
    expect(autoQuality({ cores: 8, memory: 8, dpr: 3, touch: true })).toBe('media');
    expect(autoQuality({ cores: 8, memory: 8, dpr: 2 })).toBe('alta');
    // senza informazioni (browser che non le danno) si resta prudenti
    expect(autoQuality({})).toBe('bassa');
  });

  it('la scelta della persona vince sull automatica', () => {
    const info = { cores: 16, memory: 16 };
    expect(resolveQuality('auto', info)).toBe('alta');
    expect(resolveQuality('bassa', info)).toBe('bassa');
  });

  it('i gradini vanno dal più leggero al più ricco', () => {
    const [b, m, a] = [QUALITY_SETTINGS.bassa, QUALITY_SETTINGS.media, QUALITY_SETTINGS.alta];
    expect(b.pixelRatio).toBeLessThan(m.pixelRatio);
    expect(m.pixelRatio).toBeLessThan(a.pixelRatio);
    expect(b.shadows).toBe(false);
    expect(b.trees).toBeLessThan(m.trees);
    expect(a.trees).toBe(1);
  });

  it('a scatti si scende di un gradino, ma non sotto il più leggero', () => {
    const w = new FrameWatch(2, 28);
    // 2 secondi a 10 fotogrammi al secondo
    let lower: string | null = null;
    for (let i = 0; i < 20; i++) lower = w.tick(0.1, 'alta') ?? lower;
    expect(lower).toBe('media');
    for (let i = 0; i < 20; i++) lower = w.tick(0.1, 'media') ?? lower;
    expect(lower).toBe('bassa');
    for (let i = 0; i < 20; i++) expect(w.tick(0.1, 'bassa')).toBe(null);
  });

  it('se il gioco va liscio non cambia niente, e le pause non contano', () => {
    const w = new FrameWatch(2, 28);
    for (let i = 0; i < 180; i++) expect(w.tick(1 / 60, 'alta')).toBe(null);
    // scheda tornata in primo piano: un fotogramma lunghissimo si ignora
    expect(w.tick(3, 'alta')).toBe(null);
  });
});

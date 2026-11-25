// Qualità grafica del 3D: bassa, media, alta o automatica.
// La scelta sta nelle impostazioni; "automatica" la decide il dispositivo e si abbassa da sola
// se il gioco va a scatti. Qui tutto è puro, così si prova senza browser (tests/qualita.test.ts).

export const QUALITIES = [{ id: 'auto' }, { id: 'bassa' }, { id: 'media' }, { id: 'alta' }] as const;
export type Quality = (typeof QUALITIES)[number]['id'];
// la qualità vera, dopo aver sciolto "automatica"
export type QualityLevel = 'bassa' | 'media' | 'alta';

export interface QualitySettings {
  // quante volte i pixel dello schermo (1 = nitido quanto basta, 2 = schermi retina)
  pixelRatio: number;
  shadows: boolean;
  shadowMap: number;
  // quanta parte degli alberi si vede
  trees: number;
  lamps: boolean;
  boats: boolean;
}

export const QUALITY_SETTINGS: Record<QualityLevel, QualitySettings> = {
  bassa: { pixelRatio: 1, shadows: false, shadowMap: 512, trees: 0.5, lamps: false, boats: false },
  media: { pixelRatio: 1.5, shadows: true, shadowMap: 1024, trees: 0.75, lamps: true, boats: true },
  alta: { pixelRatio: 2, shadows: true, shadowMap: 2048, trees: 1, lamps: true, boats: true },
};

export interface DeviceInfo {
  // core del processore, memoria in GB, pixel per punto
  cores?: number;
  memory?: number;
  dpr?: number;
  // vero sui telefoni e sui tablet
  touch?: boolean;
}

// Qualità proposta a chi non sceglie: prudente sui telefoni e sui dispositivi piccoli.
export function autoQuality(info: DeviceInfo): QualityLevel {
  const cores = info.cores ?? 4;
  const memory = info.memory ?? 4;
  if (cores <= 4 || memory <= 2) return 'bassa';
  if (info.touch || cores <= 6 || memory <= 4 || (info.dpr ?? 1) > 2.5) return 'media';
  return 'alta';
}

// Quello che si sa del dispositivo su cui gira il gioco.
export function deviceInfo(): DeviceInfo {
  const nav = navigator as Navigator & { deviceMemory?: number };
  return {
    cores: nav.hardwareConcurrency,
    memory: nav.deviceMemory,
    dpr: window.devicePixelRatio,
    touch: window.matchMedia?.('(pointer: coarse)').matches,
  };
}

export function resolveQuality(choice: Quality, info: DeviceInfo): QualityLevel {
  return choice === 'auto' ? autoQuality(info) : choice;
}

// Guarda quanti fotogrammi al secondo escono: con "automatica", se restano pochi si scende di un gradino.
export class FrameWatch {
  private frames = 0;
  private elapsed = 0;

  constructor(
    private readonly window = 4,
    private readonly minFps = 28,
  ) {}

  // Ritorna il gradino più basso quando il gioco va a scatti, altrimenti null.
  tick(dt: number, level: QualityLevel): QualityLevel | null {
    // i fotogrammi lunghissimi (scheda in secondo piano) non contano
    if (dt > 0.5) return null;
    this.frames++;
    this.elapsed += dt;
    if (this.elapsed < this.window) return null;
    const fps = this.frames / this.elapsed;
    this.reset();
    if (fps >= this.minFps) return null;
    return level === 'alta' ? 'media' : level === 'media' ? 'bassa' : null;
  }

  reset(): void {
    this.frames = 0;
    this.elapsed = 0;
  }
}

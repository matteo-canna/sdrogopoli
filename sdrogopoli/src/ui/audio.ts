// Suoni e musica generati al momento con la Web Audio API: nessun file audio,
// tutto originale e gratuito. Il browser permette l'audio solo dopo un tocco dell'utente.

type Sfx = 'dice' | 'hop' | 'coin' | 'pay' | 'buy' | 'card' | 'jail' | 'gavel' | 'win' | 'error' | 'click';

const PREF_SFX = 'sdrogopoli-effetti';
const PREF_MUSIC = 'sdrogopoli-musica';

function readPref(key: string, fallback: boolean): boolean {
  try {
    const v = localStorage.getItem(key);
    return v === null ? fallback : v === '1';
  } catch {
    return fallback;
  }
}

function writePref(key: string, on: boolean): void {
  try {
    localStorage.setItem(key, on ? '1' : '0');
  } catch {
    /* ignora */
  }
}

class AudioEngine {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private musicGain: GainNode | null = null;
  private noise: AudioBuffer | null = null;
  private musicTimer: ReturnType<typeof setInterval> | null = null;
  private nextBeat = 0;
  private beat = 0;
  sfxOn = readPref(PREF_SFX, true);
  musicOn = readPref(PREF_MUSIC, true);

  // Da chiamare dentro un gestore di clic: crea o riattiva il contesto audio.
  unlock(): void {
    if (!this.ctx) {
      const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Ctor) return;
      this.ctx = new Ctor();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.6;
      this.master.connect(this.ctx.destination);
      this.musicGain = this.ctx.createGain();
      this.musicGain.gain.value = 0.18;
      this.musicGain.connect(this.master);
      // mezzo secondo di rumore bianco per dadi e martelletto
      this.noise = this.ctx.createBuffer(1, this.ctx.sampleRate / 2, this.ctx.sampleRate);
      const data = this.noise.getChannelData(0);
      for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    }
    if (this.ctx.state === 'suspended') void this.ctx.resume();
    if (this.musicOn) this.startMusic();
  }

  setSfx(on: boolean): void {
    this.sfxOn = on;
    writePref(PREF_SFX, on);
  }

  setMusic(on: boolean): void {
    this.musicOn = on;
    writePref(PREF_MUSIC, on);
    if (on) this.startMusic();
    else this.stopMusic();
  }

  // ---------- effetti ----------

  private tone(freq: number, start: number, dur: number, type: OscillatorType = 'sine', vol = 0.3, slideTo?: number, out?: AudioNode): void {
    const ctx = this.ctx!;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, start);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, start + dur);
    g.gain.setValueAtTime(0.0001, start);
    g.gain.exponentialRampToValueAtTime(vol, start + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, start + dur);
    osc.connect(g).connect(out ?? this.master!);
    osc.start(start);
    osc.stop(start + dur + 0.02);
  }

  private burst(start: number, dur: number, freq: number, vol = 0.25): void {
    const ctx = this.ctx!;
    const src = ctx.createBufferSource();
    src.buffer = this.noise;
    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = freq;
    filter.Q.value = 1.5;
    const g = ctx.createGain();
    g.gain.setValueAtTime(vol, start);
    g.gain.exponentialRampToValueAtTime(0.0001, start + dur);
    src.connect(filter).connect(g).connect(this.master!);
    src.start(start);
    src.stop(start + dur);
  }

  play(sfx: Sfx): void {
    if (!this.sfxOn || !this.ctx || this.ctx.state !== 'running') return;
    const t = this.ctx.currentTime + 0.01;
    switch (sfx) {
      case 'dice':
        // dadi che rotolano: una serie di colpetti sempre più radi
        for (let i = 0, at = 0; i < 7; i++, at += 0.04 + i * 0.012) this.burst(t + at, 0.04, 2500 + Math.random() * 1500, 0.35);
        break;
      case 'hop':
        this.tone(520, t, 0.08, 'triangle', 0.15, 700);
        break;
      case 'coin':
        this.tone(988, t, 0.08, 'square', 0.12);
        this.tone(1319, t + 0.07, 0.25, 'square', 0.12);
        break;
      case 'pay':
        this.tone(440, t, 0.12, 'triangle', 0.2);
        this.tone(330, t + 0.1, 0.22, 'triangle', 0.2);
        break;
      case 'buy':
        [523, 659, 784, 1047].forEach((f, i) => this.tone(f, t + i * 0.07, 0.25, 'triangle', 0.18));
        break;
      case 'card':
        this.tone(1568, t, 0.5, 'sine', 0.15);
        this.tone(2093, t + 0.06, 0.6, 'sine', 0.1);
        break;
      case 'jail':
        this.tone(196, t, 0.35, 'sawtooth', 0.12, 150);
        this.tone(185, t + 0.3, 0.45, 'sawtooth', 0.12, 120);
        break;
      case 'gavel':
        this.burst(t, 0.08, 900, 0.5);
        this.tone(180, t, 0.12, 'sine', 0.3, 90);
        break;
      case 'win':
        [523, 659, 784, 1047, 784, 1047].forEach((f, i) => this.tone(f, t + i * 0.13, i === 5 ? 0.8 : 0.18, 'triangle', 0.22));
        break;
      case 'error':
        this.tone(160, t, 0.18, 'square', 0.1);
        break;
      case 'click':
        this.tone(880, t, 0.04, 'sine', 0.08);
        break;
    }
  }

  // ---------- musica ----------
  // Un piccolo brano originale: accordi morbidi e un arpeggio leggero, in loop.

  private static readonly BPM = 92;
  // giro di accordi (note MIDI): Do, La minore, Fa, Sol, Mi minore, Fa, Re minore, Sol
  private static readonly CHORDS = [
    [60, 64, 67], [57, 60, 64], [53, 57, 60], [55, 59, 62],
    [52, 55, 59], [53, 57, 60], [50, 53, 57], [55, 59, 62],
  ];
  // schema dell'arpeggio sugli 8 ottavi di ogni battuta (indice della nota dell'accordo, -1 = pausa)
  private static readonly ARP = [0, 2, 1, 2, 0, -1, 2, 1];
  // melodia: un ottavo ogni due, sopra l'accordo (gradi della scala di Do)
  private static readonly MELODY = [76, -1, 74, 72, 69, -1, 72, -1, 72, -1, 71, 69, 67, -1, -1, -1];

  private midi(n: number): number {
    return 440 * Math.pow(2, (n - 69) / 12);
  }

  private startMusic(): void {
    if (!this.ctx || this.musicTimer) return;
    this.musicGain!.gain.cancelScheduledValues(this.ctx.currentTime);
    this.musicGain!.gain.setValueAtTime(0.18, this.ctx.currentTime);
    this.nextBeat = this.ctx.currentTime + 0.1;
    // pianifica le note con un piccolo anticipo, come un sequencer
    this.musicTimer = setInterval(() => this.schedule(), 100);
  }

  private stopMusic(): void {
    if (this.musicTimer) clearInterval(this.musicTimer);
    this.musicTimer = null;
    if (this.ctx && this.musicGain) {
      this.musicGain.gain.setTargetAtTime(0.0001, this.ctx.currentTime, 0.2);
    }
  }

  private schedule(): void {
    const ctx = this.ctx!;
    const eighth = 60 / AudioEngine.BPM / 2;
    while (this.nextBeat < ctx.currentTime + 0.3) {
      const bar = Math.floor(this.beat / 8) % AudioEngine.CHORDS.length;
      const step = this.beat % 8;
      const chord = AudioEngine.CHORDS[bar];
      const t = this.nextBeat;
      if (step === 0) {
        // accordo tenuto per tutta la battuta
        for (const n of chord) this.tone(this.midi(n - 12), t, eighth * 8, 'sine', 0.12, undefined, this.musicGain!);
        this.tone(this.midi(chord[0] - 24), t, eighth * 4, 'triangle', 0.18, undefined, this.musicGain!);
      }
      const a = AudioEngine.ARP[step];
      if (a >= 0) this.tone(this.midi(chord[a] + 12), t, eighth * 0.9, 'triangle', 0.07, undefined, this.musicGain!);
      const mel = AudioEngine.MELODY[(this.beat / 2 + (bar % 2) * 8) % 16];
      if (step % 2 === 0 && mel > 0 && Math.floor(this.beat / 64) % 2 === 1) {
        // la melodia entra un giro sì e uno no, per non stancare
        this.tone(this.midi(mel), t, eighth * 1.8, 'sine', 0.1, undefined, this.musicGain!);
      }
      this.nextBeat += eighth;
      this.beat++;
    }
  }
}

export const audio = new AudioEngine();
export type { Sfx };

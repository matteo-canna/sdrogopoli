// Turni del computer: una piccola pausa tra un'azione e l'altra, così si capisce cosa succede.
export class BotScheduler {
  private timer: ReturnType<typeof setTimeout> | null = null;

  constructor(
    // vero se adesso tocca al computer e può agire (nessuna animazione in corso)
    private ready: () => boolean,
    // pausa in millisecondi prima della prossima azione
    private delay: () => number,
    private play: () => void,
  ) {}

  schedule(): void {
    if (this.timer || !this.ready()) return;
    this.timer = setTimeout(() => {
      this.timer = null;
      if (this.ready()) this.play();
    }, this.delay());
  }

  cancel(): void {
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
  }
}

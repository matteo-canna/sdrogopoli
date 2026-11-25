// Immagine dei risultati da condividere: si disegna su una tela e si manda (o si scarica).
// Il disegno è separato dal salvataggio, così si prova con una tela finta (tests/condivisione.test.ts).
import { netWorth, type GameContext, type GameState } from '../engine';
import { board } from '../data';
import { playerColor } from './characters';
import { standings } from './summary';
import { t, tn } from '../i18n';

export const CARD_W = 1080;
export const ROW_H = 96;

// L'immagine è alta quanto serve: con pochi giocatori non resta mezza pagina vuota.
export function cardHeight(rows: number): number {
  return 240 + Math.max(rows, 2) * ROW_H + 120;
}

export interface ResultRow {
  place: string;
  name: string;
  detail: string;
  color: string;
  bot: boolean;
}

// Le righe dell'immagine: chi ha vinto, con che patrimonio, e chi è fallito e quando.
export function resultRows(state: GameState, ctx: GameContext): ResultRow[] {
  const medals = ['🥇', '🥈', '🥉'];
  return standings(state, ctx)
    .slice(0, 8)
    .map((id, rank) => {
      const p = state.players[id];
      const st = state.stats?.[id];
      return {
        place: medals[rank] ?? `${rank + 1}°`,
        name: p.name,
        detail: p.bankrupt ? t('summary.bankruptAt', { n: st?.bankruptRound ?? '?' }) : t('summary.worth', { amount: `${board.currency.symbol} ${netWorth(state, ctx, id)}` }),
        color: playerColor(p),
        bot: !!p.isBot,
      };
    });
}

// Il testo da mandare con l'immagine (o da solo, dove non si possono mandare file).
export function resultText(state: GameState, ctx: GameContext): string {
  const rows = resultRows(state, ctx);
  const head = `${t('share.title')} · ${tn('summary.rounds', state.round)}`;
  return [head, ...rows.map((r) => `${r.place} ${r.name} — ${r.detail}`)].join('\n');
}

type Ctx2D = Pick<CanvasRenderingContext2D, 'fillRect' | 'fillText' | 'measureText' | 'beginPath' | 'arc' | 'fill' | 'roundRect'> & {
  fillStyle: string | CanvasGradient | CanvasPattern;
  font: string;
  textAlign: CanvasTextAlign;
  textBaseline: CanvasTextBaseline;
};

// Disegna la cartolina dei risultati (quadrata, leggibile anche piccola).
export function drawResultCard(c: Ctx2D, state: GameState, ctx: GameContext): void {
  const rows = resultRows(state, ctx);
  const height = cardHeight(rows.length);
  c.fillStyle = '#f3efe3';
  c.fillRect(0, 0, CARD_W, height);
  c.fillStyle = '#2f6f4f';
  c.fillRect(0, 0, CARD_W, 180);
  c.textBaseline = 'middle';
  c.textAlign = 'left';
  c.fillStyle = '#ffffff';
  c.font = 'bold 72px system-ui, sans-serif';
  c.fillText('Sdrogopoli', 60, 80);
  c.font = '38px system-ui, sans-serif';
  c.fillText(`${t('share.title')} · ${tn('summary.rounds', state.round)}`, 60, 140);

  const top = 240;
  const h = ROW_H;
  rows.forEach((r, i) => {
    const y = top + i * h;
    c.fillStyle = i % 2 ? '#ffffff' : '#e8e1cc';
    c.beginPath();
    c.roundRect(50, y, CARD_W - 100, h - 10, 18);
    c.fill();
    c.fillStyle = r.color;
    c.beginPath();
    c.arc(110, y + (h - 10) / 2, 22, 0, Math.PI * 2);
    c.fill();
    c.fillStyle = '#1f2421';
    c.font = 'bold 40px system-ui, sans-serif';
    c.textAlign = 'left';
    c.fillText(r.place, 150, y + (h - 10) / 2);
    c.fillText(`${r.bot ? '🤖 ' : ''}${r.name}`, 230, y + (h - 10) / 2);
    c.textAlign = 'right';
    c.font = '34px system-ui, sans-serif';
    c.fillText(r.detail, CARD_W - 80, y + (h - 10) / 2);
  });

  c.textAlign = 'center';
  c.fillStyle = '#5a6560';
  c.font = '30px system-ui, sans-serif';
  c.fillText(t('share.footer'), CARD_W / 2, height - 60);
}

function canvasOf(state: GameState, ctx: GameContext): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = CARD_W;
  canvas.height = cardHeight(resultRows(state, ctx).length);
  drawResultCard(canvas.getContext('2d')!, state, ctx);
  return canvas;
}

async function toBlob(canvas: HTMLCanvasElement): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));
}

// Manda l'immagine col pannello di condivisione del telefono; dove non si può, la scarica.
export async function shareResult(state: GameState, ctx: GameContext): Promise<'shared' | 'downloaded' | 'cancelled'> {
  const blob = await toBlob(canvasOf(state, ctx));
  if (!blob) return 'cancelled';
  const file = new File([blob], 'sdrogopoli.png', { type: 'image/png' });
  const data = { files: [file], text: resultText(state, ctx) };
  if (navigator.canShare?.(data)) {
    try {
      await navigator.share(data);
      return 'shared';
    } catch {
      // l'utente ha annullato: non si scarica niente
      return 'cancelled';
    }
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'sdrogopoli.png';
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  return 'downloaded';
}

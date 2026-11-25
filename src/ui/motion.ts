// Movimento ridotto: la scelta fatta nelle impostazioni del gioco (attributo data-motion della pagina)
// vince su quella del dispositivo. Senza dipendenze, così lo usa anche la parte 3D.
export function motionReduced(): boolean {
  const m = document.documentElement.dataset.motion;
  if (m === 'ridotto') return true;
  if (m === 'pieno') return false;
  return window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
}

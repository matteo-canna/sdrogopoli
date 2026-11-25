// Controllo del supporto WebGL, separato dalla grafica 3D: così chi gioca in 2D non scarica three.js.
// Vero se il browser supporta WebGL; altrimenti si usa il tabellone 2D.
// Si controlla una volta sola: ogni prova apre un contesto WebGL, e il browser ne tiene pochi
// (superato il limite spegne il più vecchio, cioè proprio il tabellone, che diventava bianco).
let webglChecked: boolean | null = null;
export function webglAvailable(): boolean {
  if (webglChecked !== null) return webglChecked;
  try {
    const c = document.createElement('canvas');
    const gl = (c.getContext('webgl2') || c.getContext('webgl')) as WebGLRenderingContext | null;
    webglChecked = !!gl;
    // libera subito il contesto di prova
    gl?.getExtension('WEBGL_lose_context')?.loseContext();
  } catch {
    webglChecked = false;
  }
  return webglChecked;
}

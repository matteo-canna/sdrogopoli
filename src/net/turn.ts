// Server TURN di riserva: quando due dispositivi non riescono a collegarsi direttamente (alcune reti
// mobili o aziendali), i dati passano da lì. Si configura alla build con variabili d'ambiente,
// per esempio con un piano gratuito di un servizio TURN:
//   VITE_TURN_URLS="turn:esempio.org:80,turns:esempio.org:443"  VITE_TURN_USER=...  VITE_TURN_PASS=...
// Senza variabili non si usa nessun TURN (restano i server STUN pubblici di Trystero).
export interface TurnServer {
  urls: string[];
  username?: string;
  credential?: string;
}

export function turnServers(env: Record<string, string | undefined>): TurnServer[] {
  const urls = (env.VITE_TURN_URLS ?? '')
    .split(',')
    .map((u) => u.trim())
    .filter((u) => /^turns?:[^\s]+$/.test(u));
  if (!urls.length) return [];
  return [{ urls, username: env.VITE_TURN_USER || undefined, credential: env.VITE_TURN_PASS || undefined }];
}

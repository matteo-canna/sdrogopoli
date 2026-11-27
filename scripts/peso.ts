// Controllo del peso della build iniziale (JS e CSS caricati all'avvio).
// Legge dist/index.html, misura i file di avvio compressi con gzip ed esce con codice 1
// se il totale supera la soglia impostata qui sotto.
// Uso: npm run build && npm run peso
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { gzipSync } from 'node:zlib';

// Soglia massima in byte per il totale compresso (gzip) di JS + CSS caricati all'avvio.
// Calcolata aggiungendo il 15% al peso misurato (115 307 byte * 1,15 = 132 604 byte; vedi docs/peso.md).
const MAX_GZIP_BYTES = 132_604;

const DIST_DIR = 'dist';
const INDEX_PATH = join(DIST_DIR, 'index.html');
const BASE_PREFIX = '/sdrogopoli/';

interface MeasuredAsset {
  file: string;
  rawBytes: number;
  gzipBytes: number;
}

// Estrae il valore di un attributo HTML (es. src, href, rel) da un tag.
function readAttr(tag: string, name: string): string | null {
  const match = new RegExp(`\\b${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s>]+))`, 'i').exec(tag);
  return match ? (match[1] ?? match[2] ?? match[3] ?? null) : null;
}

// Converte l'URL di un asset nell'HTML in un percorso relativo dentro dist/.
function toDistRelative(url: string): string | null {
  if (/^(?:https?:)?\/\//i.test(url) || url.startsWith('data:')) return null;
  let clean = url.split(/[?#]/)[0];
  if (clean.startsWith(BASE_PREFIX)) {
    clean = clean.slice(BASE_PREFIX.length);
  }
  clean = clean.replace(/^\.?\//, '');
  return clean || null;
}

// Trova tutti i file JS e CSS caricati all'avvio da index.html (script, stylesheet, modulepreload).
function extractInitialAssets(html: string): string[] {
  const seen = new Set<string>();
  const assets: string[] = [];

  const add = (url: string | null) => {
    if (!url) return;
    const rel = toDistRelative(url);
    if (!rel || seen.has(rel)) return;
    if (!rel.endsWith('.js') && !rel.endsWith('.mjs') && !rel.endsWith('.css')) return;
    seen.add(rel);
    assets.push(rel);
  };

  for (const match of html.matchAll(/<script\b[^>]*>/gi)) {
    add(readAttr(match[0], 'src'));
  }

  for (const match of html.matchAll(/<link\b[^>]*>/gi)) {
    const tag = match[0];
    const rel = readAttr(tag, 'rel')?.toLowerCase().split(/\s+/) ?? [];
    if (rel.includes('stylesheet') || rel.includes('modulepreload')) {
      add(readAttr(tag, 'href'));
    }
  }

  return assets;
}

function formatKb(bytes: number): string {
  return `${(bytes / 1024).toFixed(2)} KB`;
}

if (!existsSync(INDEX_PATH)) {
  console.error(`File ${INDEX_PATH} non trovato. Esegui prima "npm run build".`);
  process.exit(1);
}

const html = readFileSync(INDEX_PATH, 'utf8');
const assetPaths = extractInitialAssets(html);

if (!assetPaths.length) {
  console.error(`Nessun file JS o CSS iniziale trovato in ${INDEX_PATH}.`);
  process.exit(1);
}

const measured: MeasuredAsset[] = assetPaths.map((file) => {
  const fullPath = join(DIST_DIR, file);
  if (!existsSync(fullPath)) {
    console.error(`Asset referenziato in index.html ma mancante: ${fullPath}`);
    process.exit(1);
  }
  const content = readFileSync(fullPath);
  const gzipped = gzipSync(content);
  return {
    file,
    rawBytes: content.length,
    gzipBytes: gzipped.length,
  };
});

const totalRaw = measured.reduce((sum, item) => sum + item.rawBytes, 0);
const totalGzip = measured.reduce((sum, item) => sum + item.gzipBytes, 0);

// Stampa tabella leggibile file per file.
const fileWidth = Math.max('File'.length, 'Totale'.length, ...measured.map((m) => m.file.length));
const pad = (s: string, w: number) => s.padEnd(w);
const rpad = (s: string, w: number) => s.padStart(w);

console.log('Peso iniziale della build (JS + CSS caricati all\'avvio):');
console.log('');
console.log(`${pad('File', fileWidth)} | ${rpad('Originale', 11)} | ${rpad('Gzip', 11)} | ${rpad('Gzip (byte)', 11)}`);
console.log(`${'-'.repeat(fileWidth)}-+-${'-'.repeat(11)}-+-${'-'.repeat(11)}-+-${'-'.repeat(11)}`);
for (const m of measured) {
  console.log(`${pad(m.file, fileWidth)} | ${rpad(formatKb(m.rawBytes), 11)} | ${rpad(formatKb(m.gzipBytes), 11)} | ${rpad(String(m.gzipBytes), 11)}`);
}
console.log(`${'-'.repeat(fileWidth)}-+-${'-'.repeat(11)}-+-${'-'.repeat(11)}-+-${'-'.repeat(11)}`);
console.log(`${pad('Totale', fileWidth)} | ${rpad(formatKb(totalRaw), 11)} | ${rpad(formatKb(totalGzip), 11)} | ${rpad(String(totalGzip), 11)}`);
console.log('');
console.log(`Soglia massima gzip: ${formatKb(MAX_GZIP_BYTES)} (${MAX_GZIP_BYTES} byte) · margine residuo: ${formatKb(MAX_GZIP_BYTES - totalGzip)}`);

if (totalGzip > MAX_GZIP_BYTES) {
  console.error(`ERRORE: il peso iniziale compresso (${totalGzip} byte) supera la soglia di ${MAX_GZIP_BYTES} byte.`);
  process.exit(1);
}

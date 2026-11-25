import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { createHash } from 'node:crypto';
import { defineConfig, type Plugin } from 'vitest/config';

// Tutti i file di public/ (icone, personaggi 3D), con il percorso relativo.
function publicFiles(dir = 'public'): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? publicFiles(path) : [relative('public', path).split('\\').join('/')];
  });
}

// Alla build scrive il service worker con l'elenco dei file da tenere per giocare offline,
// e il file con le licenze delle librerie e dei contenuti inclusi.
function offline(): Plugin {
  return {
    name: 'gioco-folle-offline',
    apply: 'build',
    generateBundle(_options, bundle) {
      // subito in memoria: la pagina e il 2D. La grafica 3D (three.js e personaggi) si salva
      // la prima volta che si usa, così chi gioca in 2D non la scarica.
      const staticChunks = new Set<string>();
      const visit = (name: string) => {
        const chunk = bundle[name];
        if (!chunk || chunk.type !== 'chunk' || staticChunks.has(name)) return;
        staticChunks.add(name);
        chunk.imports.forEach(visit);
      };
      Object.values(bundle).forEach((c) => c.type === 'chunk' && c.isEntry && visit(c.fileName));
      const precache = Object.values(bundle)
        .filter((c) => (c.type === 'chunk' ? staticChunks.has(c.fileName) : !c.fileName.endsWith('.map')))
        .map((c) => c.fileName);
      const files = ['./', ...precache, ...publicFiles().filter((f) => !f.startsWith('characters/') && f !== 'icone/anteprima.png'), 'licenze.txt'];
      const later = [
        ...Object.values(bundle).filter((c) => c.type === 'chunk' && !staticChunks.has(c.fileName)).map((c) => c.fileName),
        ...publicFiles().filter((f) => f.endsWith('.glb')),
      ];
      const template = readFileSync('src/sw.js', 'utf8');
      const hash = createHash('sha256').update(template);
      for (const [name, chunk] of Object.entries(bundle)) hash.update(name + ('code' in chunk ? chunk.code : String(chunk.source)));
      for (const f of publicFiles()) hash.update(f + statSync(join('public', f)).size);
      const version = hash.digest('hex').slice(0, 12);
      const sw = template
        .replace("'__VERSIONE__'", JSON.stringify(version))
        .replace('[/* __FILE__ */]', JSON.stringify(files))
        .replace('[/* __FILE_3D__ */]', JSON.stringify(later));
      this.emitFile({ type: 'asset', fileName: 'sw.js', source: sw });
      const licenses = [
        'Gioco Folle!: licenze dei contenuti e delle librerie incluse',
        '='.repeat(60),
        '',
        'Gioco Folle! (codice e contenuti originali), licenza MIT:',
        '',
        readFileSync('LICENSE', 'utf8').trim(),
        '',
        '-'.repeat(60),
        '',
        'three.js (motore 3D), licenza MIT:',
        '',
        readFileSync('node_modules/three/LICENSE', 'utf8').trim(),
        '',
        '-'.repeat(60),
        '',
        'Trystero (gioco online tra browser), licenza MIT:',
        '',
        readFileSync('node_modules/trystero/LICENSE', 'utf8').trim(),
        '',
        '-'.repeat(60),
        '',
        '@noble/secp256k1 (usato da Trystero), licenza MIT:',
        '',
        readFileSync('node_modules/@noble/secp256k1/LICENSE', 'utf8').trim(),
        '',
        '-'.repeat(60),
        '',
        'Personaggi 3D: KayKit Adventurers Character Pack di Kay Lousberg, licenza CC0:',
        '',
        readFileSync('public/characters/LICENSE-KayKit.txt', 'utf8').trim(),
        '',
        '-'.repeat(60),
        '',
        "Icone, tabellone, testi, suoni e musica sono originali di Gioco Folle!",
        '',
      ].join('\n');
      this.emitFile({ type: 'asset', fileName: 'licenze.txt', source: licenses });
    },
  };
}

export default defineConfig({
  // Percorso base per GitHub Pages (https://matteo-canna.github.io/sdrogopoli/)
  base: '/sdrogopoli/',
  plugins: [offline()],
  // momento della build: si mostra accanto alla versione, così si vede subito se il sito è aggiornato
  define: {
    __BUILD_TIME__: JSON.stringify(new Date().toISOString()),
  },
  test: {
    include: ['tests/**/*.test.ts'],
  },
});

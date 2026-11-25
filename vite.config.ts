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
    name: 'sdrogopoli-offline',
    apply: 'build',
    generateBundle(_options, bundle) {
      const files = ['./', ...Object.keys(bundle), ...publicFiles(), 'licenze.txt'].filter((f) => !f.endsWith('.map'));
      const template = readFileSync('src/sw.js', 'utf8');
      const hash = createHash('sha256').update(template);
      for (const [name, chunk] of Object.entries(bundle)) hash.update(name + ('code' in chunk ? chunk.code : String(chunk.source)));
      for (const f of publicFiles()) hash.update(f + statSync(join('public', f)).size);
      const version = hash.digest('hex').slice(0, 12);
      const sw = template
        .replace("'__VERSIONE__'", JSON.stringify(version))
        .replace('[/* __FILE__ */]', JSON.stringify(files));
      this.emitFile({ type: 'asset', fileName: 'sw.js', source: sw });
      const licenses = [
        'Sdrogopoli: licenze dei contenuti e delle librerie incluse',
        '='.repeat(60),
        '',
        'three.js (motore 3D), licenza MIT:',
        '',
        readFileSync('node_modules/three/LICENSE', 'utf8').trim(),
        '',
        '-'.repeat(60),
        '',
        'Personaggi 3D: KayKit Adventurers Character Pack di Kay Lousberg, licenza CC0:',
        '',
        readFileSync('public/characters/LICENSE-KayKit.txt', 'utf8').trim(),
        '',
        '-'.repeat(60),
        '',
        "Icone, tabellone, testi, suoni e musica sono originali di Sdrogopoli.",
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
  test: {
    include: ['tests/**/*.test.ts'],
  },
});

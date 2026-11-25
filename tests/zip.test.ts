import { describe, it, expect } from 'vitest';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { zipDir } from '../scripts/zip';

// "unzip" c'è su Linux, macOS e nella CI; dove manca, la prova si salta invece di fallire
const haveUnzip = (() => {
  try {
    execFileSync('unzip', ['-v'], { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
})();

describe('file zip per itch.io', () => {
  it.skipIf(!haveUnzip)('contiene tutti i file e si apre con unzip', () => {
    const dir = mkdtempSync(join(tmpdir(), 'zip-'));
    mkdirSync(join(dir, 'in', 'assets'), { recursive: true });
    writeFileSync(join(dir, 'in', 'index.html'), '<!doctype html><p>ciao</p>');
    // un file che si comprime bene e uno che non conviene comprimere
    writeFileSync(join(dir, 'in', 'assets', 'grande.js'), 'console.log("x");'.repeat(500));
    writeFileSync(join(dir, 'in', 'assets', 'piccolo.txt'), 'a');
    const out = join(dir, 'gioco.zip');
    const r = zipDir(join(dir, 'in'), out);
    expect(r.files).toBe(3);

    const list = execFileSync('unzip', ['-l', out], { encoding: 'utf8' });
    expect(list).toContain('index.html');
    expect(list).toContain('assets/grande.js');
    expect(execFileSync('unzip', ['-t', out], { encoding: 'utf8' })).toContain('No errors');
    execFileSync('unzip', ['-q', '-o', out, '-d', join(dir, 'out')]);
    expect(readFileSync(join(dir, 'out', 'index.html'), 'utf8')).toBe('<!doctype html><p>ciao</p>');
    expect(readFileSync(join(dir, 'out', 'assets', 'grande.js'), 'utf8')).toHaveLength(17 * 500);
  });

  it('lo stesso contenuto dà sempre lo stesso file', () => {
    const dir = mkdtempSync(join(tmpdir(), 'zip-'));
    mkdirSync(join(dir, 'in'));
    writeFileSync(join(dir, 'in', 'a.txt'), 'uguale');
    const a = zipDir(join(dir, 'in'), join(dir, '1.zip'));
    const b = zipDir(join(dir, 'in'), join(dir, '2.zip'));
    expect(a.sha).toBe(b.sha);
  });
});

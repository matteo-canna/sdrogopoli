// Crea un file .zip da una cartella, senza dipendenze (serve per itch.io).
// Uso: npm run zip -- <cartella> <file.zip> (con vite-node)
import { createHash } from 'node:crypto';
import { deflateRawSync } from 'node:zlib';
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, relative, sep } from 'node:path';

function files(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? files(join(dir, e.name)) : [join(dir, e.name)]));
}

// CRC-32, come lo vuole il formato zip.
const TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
function crc32(buf: Buffer): number {
  let c = 0xffffffff;
  for (const b of buf) c = TABLE[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

// Data fissa (1980-01-01): così lo stesso contenuto dà sempre lo stesso file.
const TIME = 0;
const DATE = 33;

export function zipDir(dir: string, out: string): { bytes: number; files: number; sha: string } {
  const parts: Buffer[] = [];
  const central: Buffer[] = [];
  let offset = 0;
  for (const path of files(dir).sort()) {
    const name = relative(dir, path).split(sep).join('/');
    const raw = readFileSync(path);
    const deflated = deflateRawSync(raw, { level: 9 });
    // si comprime solo se conviene davvero
    const stored = deflated.length >= raw.length;
    const data = stored ? raw : deflated;
    const nameBuf = Buffer.from(name, 'utf8');
    const crc = crc32(raw);
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(0x0800, 6);
    local.writeUInt16LE(stored ? 0 : 8, 8);
    local.writeUInt16LE(TIME, 10);
    local.writeUInt16LE(DATE, 12);
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(data.length, 18);
    local.writeUInt32LE(raw.length, 22);
    local.writeUInt16LE(nameBuf.length, 26);
    parts.push(local, nameBuf, data);
    const head = Buffer.alloc(46);
    head.writeUInt32LE(0x02014b50, 0);
    head.writeUInt16LE(20, 4);
    head.writeUInt16LE(20, 6);
    head.writeUInt16LE(0x0800, 8);
    head.writeUInt16LE(stored ? 0 : 8, 10);
    head.writeUInt16LE(TIME, 12);
    head.writeUInt16LE(DATE, 14);
    head.writeUInt32LE(crc, 16);
    head.writeUInt32LE(data.length, 20);
    head.writeUInt32LE(raw.length, 24);
    head.writeUInt16LE(nameBuf.length, 28);
    head.writeUInt32LE(offset, 42);
    central.push(head, nameBuf);
    offset += local.length + nameBuf.length + data.length;
  }
  const dirBuf = Buffer.concat(central);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(central.length / 2, 8);
  end.writeUInt16LE(central.length / 2, 10);
  end.writeUInt32LE(dirBuf.length, 12);
  end.writeUInt32LE(offset, 16);
  const zip = Buffer.concat([...parts, dirBuf, end]);
  writeFileSync(out, zip);
  return { bytes: zip.length, files: central.length / 2, sha: createHash('sha256').update(zip).digest('hex').slice(0, 12) };
}

const [dir, out] = process.argv.slice(2);
if (dir && out) {
  const r = zipDir(dir, out);
  const mb = (r.bytes / 1024 / 1024).toFixed(2);
  console.log(`${out}: ${r.files} file, ${mb} MB`);
  if (r.bytes > 1000 * 1024 * 1024) console.warn('Attenzione: itch.io accetta file fino a 1 GB.');
}

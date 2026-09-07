// SPDX-License-Identifier: GPL-3.0-or-later
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { promisify } from 'node:util';
import { gunzip } from 'node:zlib';
import { readTar } from './tar';
import { readTeXGroup } from '../core/definitionParser';

export const PGFPLOTS_ARCHIVE = 'tikz-pgfplots-1.18.3.tar.gz';
export const PGFPLOTS_SHA256 = '77f39113e52895dde53d042dd49c0600ca21884a7cdb1bf7121354b73e344ecb';

/** Release recursive argument frames before subdivision; keep PGF's math/tolerance intact. */
export function compactIntersectionFrames(original: Buffer): Buffer {
  if (createHash('sha256').update(original).digest('hex') !== 'bb41135ab6fef26d1770e74fb3ce79bb3a7224708321a5e6edd4294c2a88f451') throw new Error('Unsupported TikZ intersections ABI');
  let source = original.toString();
  for (const name of ['pgf@@intersectionofcurves', 'pgf@@@intersectionofcurves', 'pgf@intersect@subdivide@curve@a', 'pgf@intersect@subdivide@curve@b']) {
    const start = source.indexOf(`\\def\\${name}#`), at = source.indexOf('{', start);
    const body = readTeXGroup(source, at);
    if (start < 0 || !body) throw new Error('Invalid TikZ intersections ABI');
    // TeX pops the exhausted parameterized caller before entering this zero-argument
    // continuation. No geometry, recursion order or precision settings are changed.
    source = source.slice(0, at) + '{\\def\\silk@intersection@step{' + body.content + '}\\silk@intersection@step}' + source.slice(body.end);
  }
  return Buffer.from(source);
}

/** The extension supplies the complete macro sources, independently of cached WASM. */
export async function loadTikzLibraries(path = join(__dirname, '..', 'resources', PGFPLOTS_ARCHIVE)): Promise<Map<string, Buffer>> {
  const compressed = await readFile(path);
  if (createHash('sha256').update(compressed).digest('hex') !== PGFPLOTS_SHA256) throw new Error('TikZ library integrity mismatch');
  const archive = readTar(await promisify(gunzip)(compressed, { maxOutputLength: 8 * 1024 * 1024 }));
  const files = new Map<string, Buffer>();
  for (const [path, bytes] of archive) {
    if (!path.startsWith('tex/')) continue;
    const name = path.slice(path.lastIndexOf('/') + 1);
    const existing = files.get(name);
    if (existing && !existing.equals(bytes)) throw new Error(`Ambiguous TikZ library: ${name}`);
    files.set(name, bytes);
  }
  if (!files.has('pgfplots.sty') || !files.has('tikzlibrarypgfplots.groupplots.code.tex')) throw new Error('Incomplete TikZ libraries');
  return files;
}

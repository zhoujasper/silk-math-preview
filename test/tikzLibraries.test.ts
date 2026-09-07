import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { compactIntersectionFrames, loadTikzLibraries, PGFPLOTS_ARCHIVE } from '../src/tikz/libraries';

describe('complete bundled pgfplots upgrade', () => {
  it('refuses to rewrite an unknown intersections implementation', () => {
    expect(() => compactIntersectionFrames(Buffer.from('different TeX library'))).toThrow('intersections ABI');
  });

  it('loads 1.18.3 core and its libraries independently of the cached 1.16 runtime', async () => {
    const files = await loadTikzLibraries(resolve('resources', PGFPLOTS_ARCHIVE));
    expect(files.get('pgfplots.revision.tex')?.toString()).toContain('\\gdef\\pgfplotsversion{1.18.3}');
    for (const library of ['groupplots', 'fillbetween', 'statistics', 'polar', 'ternary', 'smithchart', 'dateplot', 'patchplots']) {
      expect(files.has(`tikzlibrarypgfplots.${library}.code.tex`)).toBe(true);
    }
    expect(files.has('pgfplotstable.sty')).toBe(true);
    expect(files.has('LICENSE')).toBe(false);
  });

  it('refuses a corrupt archive instead of silently falling back to the old macros', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'silk-tikz-libraries-'));
    try {
      const data = await readFile(resolve('resources', PGFPLOTS_ARCHIVE));
      data[data.length - 1]! ^= 1;
      const path = join(directory, PGFPLOTS_ARCHIVE);
      await writeFile(path, data);
      await expect(loadTikzLibraries(path)).rejects.toThrow('integrity mismatch');
    } finally { await rm(directory, { force: true, recursive: true }); }
  });
});

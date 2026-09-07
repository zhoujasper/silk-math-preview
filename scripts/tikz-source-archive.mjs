import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { gzipSync } from 'node:zlib';

// Corresponding source for the optional GPL worker travels with every VSIX.
// Package assets remain optional downloads; the ordinary extension stays small.
export async function archiveTikzSource() {
  const files = [
    'src/tikz/worker.ts', 'src/tikz/engine.ts', 'src/tikz/source.ts', 'src/tikz/tar.ts',
    'src/tikz/texRuntime.ts', 'src/tikz/context.ts', 'src/tikz/libraries.ts',
    'scripts/vendor-tikz-libraries.py',
    'src/core/definitionParser.ts', 'src/render/protocol.ts',
    'package.json', 'package-lock.json', 'LICENSE',
    'resources/TIKZ_THIRD_PARTY_NOTICES.md', 'resources/tikz-GPL-3.0.txt',
  ];
  const blocks = [];
  for (const name of files) {
    const bytes = await readFile(name);
    const header = Buffer.alloc(512);
    header.write(name);
    header.write('0000644\0', 100);
    header.write('0000000\0', 108);
    header.write('0000000\0', 116);
    header.write(`${bytes.length.toString(8).padStart(11, '0')}\0`, 124);
    header.write('00000000000\0', 136);
    header.fill(32, 148, 156);
    header.write('0', 156);
    header.write('ustar', 257);
    header.write('00', 263);
    const checksum = header.reduce((sum, byte) => sum + byte, 0);
    header.write(`${checksum.toString(8).padStart(6, '0')}\0 `, 148);
    blocks.push(header, bytes, Buffer.alloc((512 - bytes.length % 512) % 512));
  }
  blocks.push(Buffer.alloc(1024));
  await mkdir('resources', { recursive: true });
  await writeFile('resources/tikz-worker-source.tar.gz', gzipSync(Buffer.concat(blocks), { level: 9 }));
}

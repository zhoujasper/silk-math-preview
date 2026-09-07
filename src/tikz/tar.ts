/** 仅处理已校验的 npm / TeX tar；不提取链接，也不允许路径逃逸。 */
export function readTar(buffer: Buffer): Map<string, Buffer> {
  const files = new Map<string, Buffer>();
  const field = (start: number, size: number): string => buffer.subarray(start, start + size).toString('utf8').split('\0')[0] ?? '';
  for (let at = 0; at + 512 <= buffer.length;) {
    if (buffer[at] === 0) break;
    const name = field(at, 100);
    const prefix = field(at + 345, 155);
    const size = Number.parseInt(field(at + 124, 12).trim(), 8);
    const type = field(at + 156, 1);
    if (!Number.isSafeInteger(size) || size < 0 || at + 512 + size > buffer.length) throw new Error('Invalid TikZ archive');
    const path = (prefix ? `${prefix}/${name}` : name).replace(/^\.\//, '');
    if (path.startsWith('/') || path.includes('\\') || path.split('/').includes('..')) throw new Error('Invalid TikZ archive path');
    if (type === '' || type === '0') files.set(path, buffer.subarray(at + 512, at + 512 + size));
    else if (type !== '5' && type !== 'x' && type !== 'g') throw new Error('Unsupported TikZ archive entry');
    if (files.size > 4096) throw new Error('TikZ archive has too many files');
    at += 512 + Math.ceil(size / 512) * 512;
  }
  return files;
}

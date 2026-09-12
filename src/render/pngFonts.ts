import { readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import type { registerFont as RegisterFont } from 'pureimage' with { 'resolution-mode': 'import' };

/** 只有 SVG 含系统字体文字时读取少量标准字体路径；数学路径不加载字体。 */
export function registerPngFont(text: string, registerFont: typeof RegisterFont): void {
  const opentype = require('opentype.js') as typeof import('opentype.js');
  const candidates = process.platform === 'darwin'
    ? ['/System/Library/Fonts/Supplemental/Arial Unicode.ttf', '/System/Library/Fonts/STHeiti Light.ttc', '/System/Library/Fonts/Supplemental/Arial.ttf']
    : process.platform === 'win32'
      ? ['msyh.ttc', 'simsun.ttc', 'arial.ttf', 'meiryo.ttc', 'malgun.ttf'].map(name => join(process.env.WINDIR ?? 'C:\\Windows', 'Fonts', name))
      : ['/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc', '/usr/share/fonts/truetype/wqy/wqy-zenhei.ttc', '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf', '/usr/share/fonts/truetype/liberation2/LiberationSans-Regular.ttf'];
  for (const file of candidates) {
    try {
      if (statSync(file).size > 64 * 1024 * 1024) continue;
      let bytes = readFileSync(file);
      // OpenType.js 读取单个 SFNT；TTC 第一字体的表偏移是文件绝对地址，需重新定位。
      if (bytes.toString('ascii', 0, 4) === 'ttcf') {
        const start = bytes.readUInt32BE(12), count = bytes.readUInt16BE(start + 4);
        if (count > 256) continue;
        const header = Buffer.from(bytes.subarray(start, start + 12 + count * 16));
        const tables: Buffer[] = [header]; let offset = header.length;
        for (let i = 0; i < count; i++) {
          const entry = 12 + i * 16, source = header.readUInt32BE(entry + 8), size = header.readUInt32BE(entry + 12);
          if (source + size > bytes.length) throw new Error('invalid-font');
          const table = Buffer.alloc(Math.ceil(size / 4) * 4); bytes.copy(table, 0, source, source + size);
          header.writeUInt32BE(offset, entry + 8); tables.push(table); offset += table.length;
        }
        bytes = Buffer.concat(tables);
      }
      const font = opentype.parse(Uint8Array.from(bytes).buffer);
      if ([...text].some(char => !/\s/u.test(char) && font.charToGlyphIndex(char) === 0)) continue;
      const registered = registerFont(file, 'SilkCopy');
      registered.font = font as never;
      registered.loaded = true;
      return;
    } catch { /* 尝试下一份系统字体；不静默丢掉缺失字形。 */ }
  }
  throw new Error('png-font-unavailable');
}

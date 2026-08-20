import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

interface KeybindingContribution {
  readonly command?: string;
  readonly key?: string;
  readonly when?: string;
}

describe('preview manifest', () => {
  it('README 示意图使用仓库内相对路径，打包时由 vsce 改写成 https', () => {
    const readme = readFileSync(resolve(process.cwd(), 'README.md'), 'utf8');
    const sources = [
      ...readme.matchAll(/!\[[^\]]*]\(([^)]+)\)/g),
      ...readme.matchAll(/<img[^>]+src=["']([^"']+)["']/g),
    ].map((match) => match[1]);
    expect(sources.length).toBeGreaterThanOrEqual(4);
    for (const src of sources) {
      expect(src).toMatch(/^media\/preview-.+\.png$/);
    }
  });

  it('package.json 带 GitHub 仓库地址，vsce 才能改写 README 图片', () => {
    const manifest = JSON.parse(readFileSync(resolve(process.cwd(), 'package.json'), 'utf8')) as {
      readonly repository?: { readonly url?: string } | string;
    };
    const url = typeof manifest.repository === 'string' ? manifest.repository : manifest.repository?.url;
    expect(url).toBe('https://github.com/zhoujasper/silk-math-preview.git');
  });

  it('Esc 只在公式浮层可见时关闭预览', () => {
    const manifest = JSON.parse(readFileSync(resolve(process.cwd(), 'package.json'), 'utf8')) as {
      readonly activationEvents?: readonly string[];
      readonly contributes?: { readonly keybindings?: readonly KeybindingContribution[] };
    };
    expect(manifest.activationEvents).toContain('onCommand:silkMath.dismissPreview');
    expect(manifest.contributes?.keybindings).toContainEqual({
      command: 'silkMath.dismissPreview',
      key: 'escape',
      when: 'editorTextFocus && silkMath.previewVisible',
    });
  });
});

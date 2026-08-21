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
    const images = [...readme.matchAll(/<img\b[^>]*>/gi)];
    expect(images.length).toBeGreaterThanOrEqual(3);
    expect(images.length).toBeLessThanOrEqual(4);
    const sources = images.map(([tag]) => /src=["']([^"']+)["']/.exec(tag)?.[1] ?? '');
    expect(sources.filter((src) => src === 'media/icon.png')).toHaveLength(1);
    const previews = sources.filter((src) => /^media\/preview-.+\.png$/.test(src));
    expect(previews.length).toBeGreaterThanOrEqual(2);
    expect(previews.length).toBeLessThanOrEqual(3);
    for (const [tag] of images) {
      const src = /src=["']([^"']+)["']/.exec(tag)?.[1];
      const width = Number(/width=["'](\d+)["']/.exec(tag)?.[1]);
      expect(src).toMatch(/^media\/(icon|preview-.+)\.png$/);
      expect(width).toBeGreaterThan(0);
      if (src === 'media/icon.png') expect(width).toBeLessThanOrEqual(128);
      else expect(width).toBeLessThanOrEqual(520);
    }
  });

  it('详情页默认英文，可用链接切换中文', () => {
    const readme = readFileSync(resolve(process.cwd(), 'README.md'), 'utf8');
    const english = readme.indexOf('id="english"');
    const chinese = readme.indexOf('id="chinese"');
    expect(readme).toContain('href="#english"');
    expect(readme).toContain('href="#chinese"');
    expect(english).toBeGreaterThan(-1);
    expect(chinese).toBeGreaterThan(english);
    expect(readme.trimStart().startsWith('#')).toBe(false);
    const description = (JSON.parse(readFileSync(resolve(process.cwd(), 'package.json'), 'utf8')) as {
      readonly description?: string;
    }).description ?? '';
    expect(description.startsWith('Live math preview')).toBe(true);
  });

  it('不贡献任何工作区视图，避免点击状态栏打开下方面板或辅助栏', () => {
    const manifest = JSON.parse(readFileSync(resolve(process.cwd(), 'package.json'), 'utf8')) as {
      readonly contributes?: {
        readonly viewsContainers?: unknown;
        readonly views?: unknown;
        readonly commands?: readonly { readonly command?: string }[];
        readonly keybindings?: readonly { readonly command?: string }[];
      };
    };
    expect(manifest.contributes?.viewsContainers).toBeUndefined();
    expect(manifest.contributes?.views).toBeUndefined();
    expect(manifest.contributes?.commands?.some((item) => item.command === 'silkMath.togglePanel')).toBe(false);
    expect(manifest.contributes?.commands?.some((item) => item.command === 'silkMath.showMenu')).toBe(true);
    expect(manifest.contributes?.commands?.some((item) => item.command === 'silkMath.revealFlyout')).toBe(true);
    expect(manifest.contributes?.commands?.some((item) => item.command === 'silkMath.togglePanel')).toBe(false);
    expect(manifest.contributes?.keybindings).toContainEqual({
      command: 'silkMath.dismissFlyout',
      key: 'escape',
      when: 'silkMath.flyoutVisible',
    });
    expect(manifest.contributes?.keybindings?.some((item) => item.command === 'silkMath.togglePanel')).toBe(false);
  });

  it('package.json 带 GitHub 仓库地址，vsce 才能改写 README 图片', () => {
    const manifest = JSON.parse(readFileSync(resolve(process.cwd(), 'package.json'), 'utf8')) as {
      readonly repository?: { readonly url?: string } | string;
      readonly homepage?: string;
      readonly private?: boolean;
      readonly author?: { readonly name?: string; readonly url?: string } | string;
    };
    const url = typeof manifest.repository === 'string' ? manifest.repository : manifest.repository?.url;
    expect(url).toBe('https://github.com/zhoujasper/silk-math-preview.git');
    expect(manifest.homepage).toBe('https://zhoujasper.github.io');
    expect(manifest.private).toBe(false);
    const authorName = typeof manifest.author === 'string' ? manifest.author : manifest.author?.name;
    const authorUrl = typeof manifest.author === 'string' ? undefined : manifest.author?.url;
    expect(authorName).toBe('Jasper Zhou');
    expect(authorUrl).toBe('https://zhoujasper.github.io');
  });

  it('CI 打包走 vscode:prepublish，发布者仍是 silkmath', () => {
    const manifest = JSON.parse(readFileSync(resolve(process.cwd(), 'package.json'), 'utf8')) as {
      readonly publisher?: string;
      readonly scripts?: { readonly 'vscode:prepublish'?: string };
    };
    expect(manifest.publisher).toBe('silkmath');
    expect(manifest.scripts?.['vscode:prepublish']).toBe('npm run build');
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
      when: 'editorTextFocus && silkMath.previewVisible && !silkMath.flyoutVisible',
    });
  });
});

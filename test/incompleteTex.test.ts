import { describe, expect, it } from 'vitest';

import { recoverIncompleteTex } from '../src/core/incompleteTex';
import { shouldRetainLastPreviewFrame } from '../src/core/previewSelection';
import { buildPreviewExpression } from '../src/core/previewExpression';
import { scanMathRegions } from '../src/core/mathScanner';
import { MathJaxSvgRenderer } from '../src/render/mathjaxRenderer';

const options = {
  displayMode: true,
  definitionFingerprint: 'incomplete',
  definitionPrelude: '',
  foreground: '#d4d4d4',
  caretColor: '#ffb454',
  scale: 1,
  exPx: 7,
  markUnknownCommands: false,
} as const;

function render(expression: string) {
  const renderer = new MathJaxSvgRenderer();
  try {
    return renderer.render({ ...options, expression });
  } finally {
    renderer.clear();
  }
}

describe('recoverIncompleteTex', () => {
  it('完整公式不改语义', () => {
    const complete = String.raw`\frac{a}{b}+\begin{aligned}x&=y\end{aligned}`;
    expect(recoverIncompleteTex(complete)).toBe(complete);
    const source = String.raw`$\frac{a}{b}$`;
    const region = scanMathRegions(source).regions[0]!;
    const built = buildPreviewExpression(source, region, source.indexOf('a'), false).expression;
    expect(recoverIncompleteTex(built)).toBe(built);
    const result = render(built);
    expect(result.svg).toMatch(/data-c="1D44E"|[>]a</);
  });

  it('\\frac{a}{ 补上分母括号后仍能画出 a', () => {
    const recovered = recoverIncompleteTex(String.raw`\frac{a}{`);
    expect(recovered).toBe(String.raw`\frac{a}{}`);
    const result = render(String.raw`\frac{a}{`);
    expect(result.svg).toMatch(/data-c="1D44E"|[>]a</);
    expect(result.widthPx).toBeGreaterThan(0);
    expect(recoverIncompleteTex(String.raw`\frac{a`)).toBe(String.raw`\frac{a}{}`);
  });

  it('未闭合花括号仍渲染已写出的内容', () => {
    expect(recoverIncompleteTex('{a+b')).toBe('{a+b}');
    const result = render('{a+b');
    expect(result.svg).toMatch(/data-c="1D44E"|[>]a</);
  });

  it('未闭合 aligned 环境补 \\end 后画出已写的 a', () => {
    const recovered = recoverIncompleteTex(String.raw`\begin{aligned} a &= b`);
    expect(recovered).toContain('\\end{aligned}');
    const result = render(String.raw`\begin{aligned} a &= b`);
    expect(result.svg).toMatch(/data-c="1D44E"|[>]a</);
  });

  it('同一区域后续失败保留上一帧', () => {
    const first = render(String.raw`x+1`);
    expect(first.svg).toContain('<path');
    expect(shouldRetainLastPreviewFrame({
      hasVisibleFrame: first.svg.length > 0,
      sameRegion: true,
    })).toBe(true);
  });

  it('丢掉末尾半截命令，补上未配对的 left', () => {
    expect(recoverIncompleteTex(String.raw`x+\frac`)).toBe('x+');
    expect(recoverIncompleteTex('x+\\')).toBe('x+');
    expect(recoverIncompleteTex(String.raw`\left(a`)).toBe(String.raw`\left(a\right.`);
    expect(recoverIncompleteTex(String.raw`\sqrt[2]{x`)).toBe(String.raw`\sqrt[2]{x}`);
    expect(recoverIncompleteTex('')).toBe('');
    const result = render(String.raw`\left(a`);
    expect(result.svg).toMatch(/data-c="1D44E"|[>]a</);
  });
});

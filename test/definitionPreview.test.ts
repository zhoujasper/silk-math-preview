import { describe, expect, it } from 'vitest';

import {
  definitionPreviewSample,
  isDefinitionOnlySource,
  withDefinitionPreviewSample,
} from '../src/core/definitionPreview';

describe('definition-only preview', () => {
  it('只有 \\def / \\newcommand / \\renewcommand 时判定为纯定义', () => {
    expect(isDefinitionOnlySource(String.raw`\def\A{\mathbf{A}}`)).toBe(true);
    expect(isDefinitionOnlySource(String.raw`\renewcommand{\R}{\mathbb{R}}`)).toBe(true);
    expect(isDefinitionOnlySource(String.raw`\renewcommand{\nbNorm}[1]{\left\lVert #1 \right\rVert}`)).toBe(true);
    expect(isDefinitionOnlySource(String.raw`\def\A{\mathbf{A}}\newcommand{\R}{\mathbb{R}}`)).toBe(true);
  });

  it('声明后面还有排版内容就不是纯定义', () => {
    expect(isDefinitionOnlySource(String.raw`\def\A{\mathbf{A}}\A x=0`)).toBe(false);
    expect(isDefinitionOnlySource(String.raw`x^2`)).toBe(false);
  });

  it('打开选项时在声明后补上可画的样例', () => {
    expect(definitionPreviewSample(String.raw`\def\A{\mathbf{A}}`)).toBe(String.raw`\A`);
    expect(definitionPreviewSample(String.raw`\renewcommand{\nbNorm}[1]{\left\lVert #1 \right\rVert}`))
      .toBe(String.raw`\nbNorm{x}`);
    expect(withDefinitionPreviewSample(
      String.raw`\def\A{\mathbf{A}}`,
      String.raw`\def\A{\mathbf{A}}`,
    )).toBe(String.raw`\def\A{\mathbf{A}}\A`);
  });

  it('颜色定义展开成 textcolor 样例', () => {
    expect(definitionPreviewSample(String.raw`\definecolor{Accent}{rgb}{0.2,0.4,0.8}`))
      .toBe(String.raw`\textcolor{Accent}{A}`);
  });
});

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

import {
  environmentEntersMathMode,
  parseDefinitions,
  type ParsedDefinition,
} from '../src/core/definitionParser';
import {
  definitionPreviewSample,
  isDefinitionOnlySource,
  withDefinitionPreviewSample,
} from '../src/core/definitionPreview';
import {
  parseMarkdownDefinitionSource,
  parseNotebookDefinitionSources,
  type NotebookCellSource,
} from '../src/core/markdownDefinitions';
import { mathRegionContent, scanMathRegions } from '../src/core/mathScanner';
import { buildPreviewExpression, sanitizeEnvironmentBodyForMathJax } from '../src/core/previewExpression';
import { MathJaxSvgRenderer } from '../src/render/mathjaxRenderer';
import type { MathLanguage } from '../src/core/types';

const fixtures = resolve(process.cwd(), 'test/fixtures');

function readFixture(name: string): string {
  return readFileSync(resolve(fixtures, name), 'utf8');
}

function drawable(svg: string): boolean {
  return svg.includes('<path') || svg.includes('<text') || svg.includes('<rect');
}

function isTikz(source: string): boolean {
  return /\\begin\s*\{(?:tikzpicture|tikzcd|pgfpicture)\*?\}|\\tikz\b/.test(source);
}

function serializeDefinition(definition: ParsedDefinition): string | undefined {
  if (definition.expandability !== 'expandable') return undefined;
  if (definition.kind === 'color') {
    const replacement = definition.replacement ?? '';
    const colon = replacement.indexOf(':');
    if (colon < 0) return undefined;
    return `\\definecolor{${definition.name}}{${replacement.slice(0, colon)}}{${replacement.slice(colon + 1)}}`;
  }
  if (definition.kind === 'command') {
    if (definition.replacement === undefined) return undefined;
    const optional = definition.arguments.filter((item) => item.kind === 'optional');
    if (optional.length === 0) {
      const parameters = definition.arguments.map((item) => `#${item.index}`).join('');
      return `\\def${definition.name}${parameters}{${definition.replacement}}`;
    }
    if (optional.length === 1 && optional[0]?.index === 1) {
      return `\\newcommand{${definition.name}}[${definition.arguments.length}][${optional[0]?.defaultValue ?? ''}]{${definition.replacement}}`;
    }
    return undefined;
  }
  if (definition.beginReplacement === undefined || definition.endReplacement === undefined) return undefined;
  const operation = definition.operation === 'renew' ? 'renewenvironment' : 'newenvironment';
  const count = definition.arguments.length > 0 ? `[${definition.arguments.length}]` : '';
  return `\\${operation}{${definition.name}}${count}{${sanitizeEnvironmentBodyForMathJax(definition.beginReplacement)}}{${sanitizeEnvironmentBodyForMathJax(definition.endReplacement)}}`;
}

function preludeFrom(text: string, sourceId: string): string {
  return parseDefinitions(text, sourceId)
    .map(serializeDefinition)
    .filter((item): item is string => item !== undefined)
    .join('\n');
}

function customMathEnvironments(...texts: string[]): string[] {
  return texts.flatMap((text) => parseDefinitions(text, '<env>'))
    .filter((item) => item.kind === 'environment' && environmentEntersMathMode(item.beginReplacement))
    .map((item) => item.name);
}

interface SweepOptions {
  readonly source: string;
  readonly language: MathLanguage;
  readonly prelude: string;
  readonly customMathEnvironments?: readonly string[];
  readonly previewDefinitions?: boolean;
}

function sweep(options: SweepOptions): {
  readonly regions: number;
  readonly ok: number;
  readonly skippedDefs: number;
  readonly skippedTikz: number;
  readonly failures: readonly string[];
} {
  const scanned = scanMathRegions(options.source, {
    language: options.language,
    ...(options.customMathEnvironments ? { customMathEnvironments: options.customMathEnvironments } : {}),
  });
  const renderer = new MathJaxSvgRenderer();
  const failures: string[] = [];
  let ok = 0;
  let skippedDefs = 0;
  let skippedTikz = 0;
  for (const [index, region] of scanned.regions.entries()) {
    const raw = options.source.slice(region.start, region.end).replace(/\s+/g, ' ').slice(0, 80);
    if (isTikz(raw)) {
      skippedTikz += 1;
      continue;
    }
    const content = mathRegionContent(options.source, region);
    if (content.trim() === '') continue;
    const caret = region.contentStart + Math.max(0, Math.floor((region.contentEnd - region.contentStart) / 2));
    const definitionOnly = isDefinitionOnlySource(content);
    if (definitionOnly && !options.previewDefinitions) {
      skippedDefs += 1;
      continue;
    }
    let expression = buildPreviewExpression(options.source, region, caret, false).expression;
    if (definitionOnly) {
      const sample = definitionPreviewSample(content);
      if (!sample) {
        skippedDefs += 1;
        continue;
      }
      expression = withDefinitionPreviewSample(expression, content);
    }
    try {
      const result = renderer.render({
        expression,
        displayMode: region.kind !== 'dollar-inline' && region.kind !== 'paren-inline',
        definitionFingerprint: `sweep-${index}`,
        definitionPrelude: options.prelude,
        foreground: '#d4d4d4',
        caretColor: '#ffb454',
        scale: region.kind === 'markdown-table' ? 0.82 : 1,
        exPx: 7,
        markUnknownCommands: true,
      });
      if (!drawable(result.svg)) failures.push(`empty #${index} ${raw}`);
      else ok += 1;
    } catch (error) {
      const message = error instanceof Error
        ? error.message
        : typeof error === 'object' && error !== null && 'message' in error
          ? String((error as { message: unknown }).message)
          : String(error);
      failures.push(`throw #${index} ${raw} :: ${message}`);
    }
  }
  renderer.clear();
  return {
    regions: scanned.regions.length,
    ok,
    skippedDefs,
    skippedTikz,
    failures,
  };
}

describe('fixtures 全量扫掠', () => {
  const sty = readFixture('silkmath-fixture.sty');
  const cls = readFixture('silkmath-fixture.cls');
  const packagePrelude = `${preludeFrom(sty, 'sty')}\n${preludeFrom(cls, 'cls')}`;
  const envs = customMathEnvironments(sty, cls);

  it('.sty / .cls 声明能转成 prelude', () => {
    expect(packagePrelude).toContain('\\def\\eps');
    expect(packagePrelude).toContain('\\def\\A');
    expect(packagePrelude).toContain('\\definecolor{Accent}');
    expect(envs).toEqual(expect.arrayContaining(['eqmath', 'almath']));
    expect(envs).not.toContain('question');
    expect(envs).not.toContain('solution');
  });

  it('all-math.tex 除 TikZ 外每个公式区域都能渲染', () => {
    const source = readFixture('all-math.tex');
    const prelude = `${packagePrelude}\n${preludeFrom(source, 'tex')}`;
    const result = sweep({
      source,
      language: 'latex',
      prelude,
      customMathEnvironments: envs,
    });
    expect(result.regions).toBeGreaterThan(20);
    expect(source).toContain('\\begin{tikzpicture}');
    expect(result.failures).toEqual([]);
    expect(result.ok).toBe(result.regions - result.skippedTikz - result.skippedDefs);
  });

  it('all-math.md 含带竖线的 GFM 表能渲染', () => {
    const source = readFixture('all-math.md');
    const parsed = parseMarkdownDefinitionSource(source, 'md');
    const prelude = parsed.definitions.map(serializeDefinition).filter((item): item is string => item !== undefined).join('\n');
    const result = sweep({ source, language: 'markdown', prelude });
    const scanned = scanMathRegions(source, { language: 'markdown' });
    expect(scanned.regions.some((region) => region.kind === 'markdown-table')).toBe(true);
    expect(scanned.regions.some((region) => mathRegionContent(source, region) === 'E=mc^2')).toBe(true);
    expect(result.failures).toEqual([]);
    expect(result.ok).toBeGreaterThan(5);
    expect(result.skippedDefs).toBeGreaterThanOrEqual(1);
  });

  it('all-math.txt 按 LaTeX 语法扫描能渲染', () => {
    const source = readFixture('all-math.txt');
    const result = sweep({
      source,
      language: 'latex',
      prelude: preludeFrom(source, 'txt'),
    });
    expect(result.failures).toEqual([]);
    expect(result.ok).toBeGreaterThan(5);
  });

  it('all-math.ipynb 跨格宏生效；纯定义默认跳过，打开后能画', () => {
    const notebook = JSON.parse(readFixture('all-math.ipynb')) as {
      readonly cells: readonly {
        readonly cell_type: string;
        readonly source: string | readonly string[];
      }[];
    };
    const cells: NotebookCellSource[] = notebook.cells.map((cell, index) => ({
      id: `cell-${index}`,
      index,
      kind: cell.cell_type === 'markdown' ? 'markup' : 'code',
      text: Array.isArray(cell.source) ? cell.source.join('') : String(cell.source),
    }));
    const renderer = new MathJaxSvgRenderer();
    const failures: string[] = [];
    let sawLaterMacro = false;
    let sawInlineCodeMath = false;
    let skippedDefs = 0;
    let ok = 0;
    for (const cell of cells) {
      if (cell.kind !== 'markup') continue;
      const prelude = parseNotebookDefinitionSources(cells, cell.index).definitions
        .map(serializeDefinition)
        .filter((item): item is string => item !== undefined)
        .join('\n');
      const scanned = scanMathRegions(cell.text, { language: 'markdown' });
      for (const region of scanned.regions) {
        const content = mathRegionContent(cell.text, region);
        const caret = region.contentStart + Math.max(0, Math.floor((region.contentEnd - region.contentStart) / 2));
        if (isDefinitionOnlySource(content)) {
          skippedDefs += 1;
          const sampled = withDefinitionPreviewSample(
            buildPreviewExpression(cell.text, region, caret, false).expression,
            content,
          );
          const drawn = renderer.render({
            expression: sampled,
            displayMode: false,
            definitionFingerprint: `nb-def-${cell.index}`,
            definitionPrelude: prelude,
            foreground: '#d4d4d4',
            caretColor: '#ffb454',
            scale: 1,
            exPx: 7,
            markUnknownCommands: true,
          });
          if (!drawable(drawn.svg)) failures.push(`nb def empty ${content.slice(0, 40)}`);
          continue;
        }
        if (content.includes('\\A') || content.includes('\\nbNorm') || content.includes('\\R')) {
          sawLaterMacro = true;
        }
        if (content === 'not math') sawInlineCodeMath = true;
        try {
          const result = renderer.render({
            expression: buildPreviewExpression(cell.text, region, caret, false).expression,
            displayMode: region.kind !== 'dollar-inline' && region.kind !== 'paren-inline',
            definitionFingerprint: `nb-${cell.index}-${region.start}`,
            definitionPrelude: prelude,
            foreground: '#d4d4d4',
            caretColor: '#ffb454',
            scale: region.kind === 'markdown-table' ? 0.82 : 1,
            exPx: 7,
            markUnknownCommands: true,
          });
          if (!drawable(result.svg)) failures.push(`nb empty ${content.slice(0, 60)}`);
          else ok += 1;
        } catch (error) {
          failures.push(`nb throw ${content.slice(0, 60)} :: ${error instanceof Error ? error.message : String(error)}`);
        }
      }
    }
    renderer.clear();
    expect(skippedDefs).toBeGreaterThanOrEqual(3);
    expect(sawLaterMacro).toBe(true);
    expect(sawInlineCodeMath).toBe(true);
    expect(failures).toEqual([]);
    expect(ok).toBeGreaterThan(5);
  });
});

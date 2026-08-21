import type { MathRegion, TextRange } from './types';

/** 单表上限：预览翻译成 array，太大既慢又占 SVG 缓存。 */
const MAX_ROWS = 80;
const MAX_COLS = 16;

function lineEndAfter(text: string, offset: number): number {
  const newline = text.indexOf('\n', offset);
  return newline === -1 ? text.length : newline;
}

function nextLineStart(text: string, lineEnd: number): number {
  return lineEnd < text.length ? lineEnd + 1 : text.length;
}

function contentEndOf(text: string, lineStart: number, rawLineEnd: number): number {
  return rawLineEnd > lineStart && text[rawLineEnd - 1] === '\r' ? rawLineEnd - 1 : rawLineEnd;
}

function rangeContaining(ranges: readonly TextRange[], offset: number): TextRange | undefined {
  let low = 0;
  let high = ranges.length - 1;
  while (low <= high) {
    const middle = (low + high) >>> 1;
    const range = ranges[middle];
    if (range === undefined) return undefined;
    if (offset < range.start) high = middle - 1;
    else if (offset >= range.end) low = middle + 1;
    else return range;
  }
  return undefined;
}

type InlineMath = 'none' | 'dollar' | 'dollars' | 'paren' | 'bracket';

/** 按未转义 `|` 切单元格；`$...$` / `\(...\)` / `\[...\]` 里的竖线是数学，不是列分隔。 */
export function splitMarkdownTableRow(line: string): string[] | undefined {
  if (!line.includes('|')) return undefined;
  const cells: string[] = [];
  let current = '';
  let math: InlineMath = 'none';
  for (let index = 0; index < line.length; index += 1) {
    const character = line[index];
    const next = line[index + 1];
    if (math === 'none' && character === '\\' && next === '|') {
      current += '|';
      index += 1;
      continue;
    }
    if (math === 'none') {
      if (character === '$' && next === '$') {
        math = 'dollars';
        current += '$$';
        index += 1;
        continue;
      }
      if (character === '$') {
        math = 'dollar';
        current += '$';
        continue;
      }
      if (character === '\\' && next === '(') {
        math = 'paren';
        current += '\\(';
        index += 1;
        continue;
      }
      if (character === '\\' && next === '[') {
        math = 'bracket';
        current += '\\[';
        index += 1;
        continue;
      }
      if (character === '|') {
        cells.push(current.trim());
        current = '';
        continue;
      }
      current += character;
      continue;
    }
    if (math === 'dollar' && character === '$') {
      math = 'none';
      current += '$';
      continue;
    }
    if (math === 'dollars' && character === '$' && next === '$') {
      math = 'none';
      current += '$$';
      index += 1;
      continue;
    }
    if (math === 'paren' && character === '\\' && next === ')') {
      math = 'none';
      current += '\\)';
      index += 1;
      continue;
    }
    if (math === 'bracket' && character === '\\' && next === ']') {
      math = 'none';
      current += '\\]';
      index += 1;
      continue;
    }
    current += character;
  }
  cells.push(current.trim());
  if (line.trimStart().startsWith('|')) cells.shift();
  if (line.trimEnd().endsWith('|') && cells.length > 0) cells.pop();
  return cells.length > 0 ? cells : undefined;
}

function isDelimiterCell(cell: string): boolean {
  return /^:?-{1,}:?$/.test(cell.replace(/\s+/g, ''));
}

export function isMarkdownTableDelimiter(cells: readonly string[]): boolean {
  return cells.length > 0 && cells.every(isDelimiterCell);
}

function alignmentOf(cell: string): 'l' | 'c' | 'r' {
  const trimmed = cell.replace(/\s+/g, '');
  const left = trimmed.startsWith(':');
  const right = trimmed.endsWith(':');
  if (left && right) return 'c';
  if (right) return 'r';
  return 'l';
}

export interface ParsedMarkdownTable {
  readonly alignments: readonly ('l' | 'c' | 'r')[];
  readonly rows: readonly (readonly string[])[];
}

function padRow(cells: readonly string[], columns: number): string[] {
  const next = cells.slice(0, columns);
  while (next.length < columns) next.push('');
  return next;
}

export function parseMarkdownTable(source: string): ParsedMarkdownTable | undefined {
  const lines: string[] = [];
  let cursor = 0;
  while (cursor < source.length) {
    const rawEnd = lineEndAfter(source, cursor);
    lines.push(source.slice(cursor, contentEndOf(source, cursor, rawEnd)));
    cursor = nextLineStart(source, rawEnd);
  }
  while (lines.length > 0 && lines[lines.length - 1]?.trim() === '') lines.pop();
  if (lines.length < 2) return undefined;
  const header = splitMarkdownTableRow(lines[0] ?? '');
  const delimiter = splitMarkdownTableRow(lines[1] ?? '');
  if (!header || !delimiter || !isMarkdownTableDelimiter(delimiter)) return undefined;
  const columns = Math.min(MAX_COLS, Math.max(1, delimiter.length, header.length));
  const alignments = padRow(delimiter, columns).map(alignmentOf);
  const rows = [padRow(header, columns)];
  for (const line of lines.slice(2)) {
    if (line.trim() === '') break;
    const cells = splitMarkdownTableRow(line);
    if (!cells) break;
    rows.push(padRow(cells, columns));
    if (rows.length >= MAX_ROWS) break;
  }
  return { alignments, rows };
}

/**
 * 光标所在单元格的起点。整张表从头数 `$` 会把上一格 `` `$` `` 当成未闭合数学，
 * 后面文本格里的 caret 就不会包进 `$...$`，再被 `\text{}` 转义成原文。
 */
export function markdownTableCellStart(source: string, offset: number): number {
  const clamped = Math.min(Math.max(0, offset), source.length);
  let lineStart = 0;
  for (let cursor = clamped - 1; cursor >= 0; cursor -= 1) {
    if (source[cursor] === '\n') {
      lineStart = cursor + 1;
      break;
    }
  }
  let cellStart = lineStart;
  let math: InlineMath = 'none';
  for (let index = lineStart; index < clamped; index += 1) {
    const character = source[index];
    const next = source[index + 1];
    if (math === 'none' && character === '\\' && next === '|') {
      index += 1;
      continue;
    }
    if (math === 'none') {
      if (character === '$' && next === '$') {
        math = 'dollars';
        index += 1;
        continue;
      }
      if (character === '$') {
        math = 'dollar';
        continue;
      }
      if (character === '\\' && next === '(') {
        math = 'paren';
        index += 1;
        continue;
      }
      if (character === '\\' && next === '[') {
        math = 'bracket';
        index += 1;
        continue;
      }
      if (character === '|') {
        cellStart = index + 1;
        continue;
      }
      continue;
    }
    if (math === 'dollar' && character === '$') {
      math = 'none';
      continue;
    }
    if (math === 'dollars' && character === '$' && next === '$') {
      math = 'none';
      index += 1;
      continue;
    }
    if (math === 'paren' && character === '\\' && next === ')') {
      math = 'none';
      index += 1;
      continue;
    }
    if (math === 'bracket' && character === '\\' && next === ']') {
      math = 'none';
      index += 1;
      continue;
    }
  }
  return cellStart;
}

function isInsideCellInlineMath(text: string, offset: number): boolean {
  let math = false;
  for (let cursor = 0; cursor < offset; cursor += 1) {
    if (text[cursor] === '$' && text[cursor - 1] !== '\\') math = !math;
  }
  return math;
}

function caretTokenEnd(text: string, start: number): number | undefined {
  if (!text.startsWith('\\class{silk-math-caret}', start)) return undefined;
  let cursor = start + '\\class'.length;
  let depth = 0;
  let seen = false;
  for (; cursor < text.length; cursor += 1) {
    if (text[cursor] === '{') {
      depth += 1;
      seen = true;
    } else if (text[cursor] === '}') {
      depth -= 1;
      if (seen && depth === 0) {
        if (text[cursor + 1] === '{') continue;
        return cursor + 1;
      }
    }
  }
  return undefined;
}

/** 文本单元格里的 caret 必须处于 `$...$`，否则 `\text{}` 会把 `\class` 当文字打印。 */
export function ensureCaretInMath(text: string): string {
  const start = text.indexOf('\\class{silk-math-caret}');
  if (start < 0) return text;
  const end = caretTokenEnd(text, start);
  if (end === undefined) return text;
  if (isInsideCellInlineMath(text, start)) return text;
  if (text[start - 1] === '$' && text[end] === '$') return text;
  return `${text.slice(0, start)}$${text.slice(start, end)}$${text.slice(end)}`;
}

function escapeMarkdownTableCell(text: string): string {
  let escaped = '';
  let math = false;
  for (let index = 0; index < text.length; index += 1) {
    const character = text[index]!;
    if (character === '$' && text[index - 1] !== '\\') {
      math = !math;
      escaped += character;
      continue;
    }
    if (!math) {
      if (character === '\\') {
        escaped += '\\textbackslash{}';
        continue;
      }
      if (character === '%' || character === '#' || character === '&' || character === '_' || character === '{' || character === '}') {
        escaped += `\\${character}`;
        continue;
      }
      if (character === '~') {
        escaped += '\\textasciitilde{}';
        continue;
      }
      if (character === '^') {
        escaped += '\\textasciicircum{}';
        continue;
      }
    }
    escaped += character;
  }
  return escaped;
}

function wrapCell(text: string): string {
  const trimmed = text.trim();
  return trimmed ? `\\text{${escapeMarkdownTableCell(ensureCaretInMath(trimmed))}}` : '';
}

function arraySpecWithRules(alignments: readonly ('l' | 'c' | 'r')[]): string {
  if (alignments.length === 0) return '|c|';
  return `|${alignments.join('|')}|`;
}

/** 把 GFM 表格翻译成带框线的 MathJax `array`。分隔行只提供对齐，不进入预览。 */
export function buildMarkdownTableExpression(source: string): string {
  const parsed = parseMarkdownTable(source);
  if (!parsed) return '\\begin{array}{|c|}\\hline\\\\\\hline\\end{array}';
  const spec = arraySpecWithRules(parsed.alignments);
  const body = parsed.rows
    .map((row) => `\\hline ${row.map(wrapCell).join('&')}`)
    .join('\\\\');
  return `\\begin{array}{${spec}}${body}\\\\\\hline\\end{array}`;
}

/** Markdown 文档里扫描 GFM 管道表格；代码块已在 ignored 里，这里会跳过。 */
export function collectMarkdownTableRegions(
  text: string,
  ignoredRanges: readonly TextRange[],
): MathRegion[] {
  const regions: MathRegion[] = [];
  let lineStart = 0;
  while (lineStart < text.length) {
    const ignored = rangeContaining(ignoredRanges, lineStart);
    if (ignored !== undefined) {
      lineStart = Math.max(lineStart + 1, ignored.end);
      continue;
    }
    const headerRawEnd = lineEndAfter(text, lineStart);
    const headerLine = text.slice(lineStart, contentEndOf(text, lineStart, headerRawEnd));
    const header = splitMarkdownTableRow(headerLine);
    const delimiterStart = nextLineStart(text, headerRawEnd);
    if (!header || delimiterStart >= text.length || rangeContaining(ignoredRanges, delimiterStart)) {
      lineStart = delimiterStart;
      continue;
    }
    const delimiterRawEnd = lineEndAfter(text, delimiterStart);
    const delimiterLine = text.slice(delimiterStart, contentEndOf(text, delimiterStart, delimiterRawEnd));
    const delimiter = splitMarkdownTableRow(delimiterLine);
    if (!delimiter || !isMarkdownTableDelimiter(delimiter)) {
      lineStart = delimiterStart;
      continue;
    }
    let tableEnd = nextLineStart(text, delimiterRawEnd);
    let rows = 2;
    let cursor = tableEnd;
    while (rows < MAX_ROWS && cursor < text.length) {
      if (rangeContaining(ignoredRanges, cursor)) break;
      const rowRawEnd = lineEndAfter(text, cursor);
      const rowLine = text.slice(cursor, contentEndOf(text, cursor, rowRawEnd));
      if (rowLine.trim() === '') break;
      const cells = splitMarkdownTableRow(rowLine);
      if (!cells) break;
      rows += 1;
      tableEnd = nextLineStart(text, rowRawEnd);
      cursor = tableEnd;
    }
    regions.push({
      kind: 'markdown-table',
      start: lineStart,
      end: tableEnd,
      contentStart: lineStart,
      contentEnd: tableEnd,
      opener: '',
      closer: '',
      closed: true,
    });
    lineStart = tableEnd;
  }
  return regions;
}

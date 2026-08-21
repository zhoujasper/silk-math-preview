import { DEFAULT_MATH_ENVIRONMENTS } from './completionCatalog';
import { collectMarkdownTableRegions } from './markdownTable';
import { TABLE_ENVIRONMENTS } from './tablePreview';
import type {
  MathRecoveryReason,
  MarkdownFenceState,
  MathRegion,
  MathRegionKind,
  MathScanOptions,
  MathScanResult,
  TextRange,
} from './types';

interface DelimiterOpener {
  readonly start: number;
  readonly end: number;
  readonly opener: string;
  readonly closer: string;
  readonly kind: MathRegionKind;
  readonly environment?: string;
}

interface EnvironmentHead extends TextRange {
  readonly kind: 'begin' | 'end';
  readonly name: string;
}

const ENVIRONMENT_NAME = /^[A-Za-z@][A-Za-z0-9@:_-]*\*?$/;
const DEFAULT_RECOVERY_WINDOW = 4096;

function isEscaped(text: string, offset: number): boolean {
  let slashCount = 0;
  for (let cursor = offset - 1; cursor >= 0 && text[cursor] === '\\'; cursor -= 1) {
    slashCount += 1;
  }
  return slashCount % 2 === 1;
}

function lineEndAfter(text: string, offset: number): number {
  const newline = text.indexOf('\n', offset);
  return newline === -1 ? text.length : newline;
}

function nextLineStart(text: string, lineEnd: number): number {
  return lineEnd < text.length ? lineEnd + 1 : text.length;
}

function mergeRanges(ranges: readonly TextRange[]): TextRange[] {
  const ordered = [...ranges].sort((left, right) => left.start - right.start);
  const merged: TextRange[] = [];
  for (const range of ordered) {
    const last = merged.at(-1);
    if (last === undefined || range.start > last.end) {
      merged.push({ start: range.start, end: range.end });
    } else if (range.end > last.end) {
      merged[merged.length - 1] = { start: last.start, end: range.end };
    }
  }
  return merged;
}

function rangeContaining(
  ranges: readonly TextRange[],
  offset: number,
): TextRange | undefined {
  let low = 0;
  let high = ranges.length - 1;
  while (low <= high) {
    const middle = (low + high) >>> 1;
    const range = ranges[middle];
    if (range === undefined) {
      return undefined;
    }
    if (offset < range.start) {
      high = middle - 1;
    } else if (offset >= range.end) {
      low = middle + 1;
    } else {
      return range;
    }
  }
  return undefined;
}

/** 推进一行 Markdown fenced-code 状态；line 不含换行符。 */
export function advanceMarkdownFenceState(
  state: MarkdownFenceState | undefined,
  line: string,
): MarkdownFenceState | undefined {
  if (state === undefined) {
    const match = /^ {0,3}(`{3,}|~{3,})(.*)$/.exec(line);
    if (match === null) return undefined;
    const run = match[1] ?? '';
    const info = match[2] ?? '';
    const marker = run[0];
    if ((marker === '`' || marker === '~') && !(marker === '`' && info.includes('`'))) {
      return { marker, length: run.length };
    }
    return undefined;
  }
  const close = /^ {0,3}(`+|~+)[ \t]*$/.exec(line);
  const run = close?.[1];
  return run !== undefined && run[0] === state.marker && run.length >= state.length
    ? undefined
    : state;
}

function collectMarkdownFenceRanges(
  text: string,
  initialState?: MarkdownFenceState,
): TextRange[] {
  const ranges: TextRange[] = [];
  let open:
    | { readonly start: number; readonly marker: '`' | '~'; readonly length: number }
    | undefined = initialState ? { start: 0, ...initialState } : undefined;
  let lineStart = 0;

  while (lineStart < text.length) {
    const rawLineEnd = lineEndAfter(text, lineStart);
    const contentEnd =
      rawLineEnd > lineStart && text[rawLineEnd - 1] === '\r'
        ? rawLineEnd - 1
        : rawLineEnd;
    const line = text.slice(lineStart, contentEnd);

    if (open === undefined) {
      const match = /^ {0,3}(`{3,}|~{3,})(.*)$/.exec(line);
      if (match !== null) {
        const run = match[1] ?? '';
        const info = match[2] ?? '';
        const marker = run[0];
        if (
          (marker === '`' || marker === '~') &&
          !(marker === '`' && info.includes('`'))
        ) {
          open = { start: lineStart, marker, length: run.length };
        }
      }
    } else {
      const close = /^ {0,3}(`+|~+)[ \t]*$/.exec(line);
      const run = close?.[1];
      if (
        run !== undefined &&
        run[0] === open.marker &&
        run.length >= open.length
      ) {
        const end = nextLineStart(text, rawLineEnd);
        ranges.push({ start: open.start, end });
        open = undefined;
      }
    }

    lineStart = nextLineStart(text, rawLineEnd);
  }

  if (open !== undefined) {
    ranges.push({ start: open.start, end: text.length });
  }
  return ranges;
}

function collectMarkdownInlineCodeRanges(
  text: string,
  fenceRanges: readonly TextRange[],
): TextRange[] {
  const ranges: TextRange[] = [];
  let cursor = 0;
  while (cursor < text.length) {
    const fence = rangeContaining(fenceRanges, cursor);
    if (fence !== undefined) {
      cursor = fence.end;
      continue;
    }
    if (text[cursor] !== '`') {
      cursor += 1;
      continue;
    }

    let runEnd = cursor + 1;
    while (text[runEnd] === '`') {
      runEnd += 1;
    }
    const runLength = runEnd - cursor;
    let search = runEnd;
    let closeEnd: number | undefined;
    while (search < text.length) {
      const skippedFence = rangeContaining(fenceRanges, search);
      if (skippedFence !== undefined) {
        search = skippedFence.end;
        continue;
      }
      const candidate = text.indexOf('`', search);
      if (candidate === -1) {
        break;
      }
      let candidateEnd = candidate + 1;
      while (text[candidateEnd] === '`') {
        candidateEnd += 1;
      }
      if (candidateEnd - candidate === runLength) {
        closeEnd = candidateEnd;
        break;
      }
      search = candidateEnd;
    }

    if (closeEnd === undefined) {
      cursor = runEnd;
    } else {
      ranges.push({ start: cursor, end: closeEnd });
      cursor = closeEnd;
    }
  }
  return ranges;
}

function collectLatexCommentRanges(
  text: string,
  existingRanges: readonly TextRange[],
): TextRange[] {
  const comments: TextRange[] = [];
  let cursor = 0;
  while (cursor < text.length) {
    const ignored = rangeContaining(existingRanges, cursor);
    if (ignored !== undefined) {
      cursor = ignored.end;
      continue;
    }
    if (text[cursor] === '%' && !isEscaped(text, cursor)) {
      const end = lineEndAfter(text, cursor);
      comments.push({ start: cursor, end });
      cursor = end;
    } else {
      cursor += 1;
    }
  }
  return comments;
}

function innerInlineCodeRange(text: string, range: TextRange): TextRange {
  let openEnd = range.start;
  while (openEnd < range.end && text[openEnd] === '`') openEnd += 1;
  let closeStart = range.end;
  while (closeStart > openEnd && text[closeStart - 1] === '`') closeStart -= 1;
  return { start: openEnd, end: closeStart };
}

function innerFenceRange(text: string, range: TextRange): TextRange {
  const afterOpen = nextLineStart(text, lineEndAfter(text, range.start));
  let lineStart = range.start;
  let lastLineStart = range.start;
  while (lineStart < range.end) {
    lastLineStart = lineStart;
    lineStart = nextLineStart(text, lineEndAfter(text, lineStart));
  }
  const lastLine = text.slice(lastLineStart, contentEndOfFenceLine(text, lastLineStart, range.end));
  const closed = lastLineStart > range.start && /^ {0,3}(`+|~+)[ \t]*$/.test(lastLine);
  return {
    start: Math.min(afterOpen, range.end),
    end: closed ? lastLineStart : range.end,
  };
}

function contentEndOfFenceLine(text: string, lineStart: number, limit: number): number {
  const rawEnd = Math.min(lineEndAfter(text, lineStart), limit);
  return rawEnd > lineStart && text[rawEnd - 1] === '\r' ? rawEnd - 1 : rawEnd;
}

function collectMarkdownCodeLimits(
  text: string,
  fenceRanges: readonly TextRange[],
  inlineRanges: readonly TextRange[],
): TextRange[] {
  return [
    ...inlineRanges.map((range) => innerInlineCodeRange(text, range)),
    ...fenceRanges.map((range) => innerFenceRange(text, range)),
  ].filter((range) => range.end > range.start);
}

function skipHorizontalSpace(text: string, start: number, end: number): number {
  let cursor = start;
  while (cursor < end && (text[cursor] === ' ' || text[cursor] === '\t')) cursor += 1;
  return cursor;
}

function skipHorizontalSpaceEnd(text: string, start: number, end: number): number {
  let cursor = end;
  while (cursor > start && (text[cursor - 1] === ' ' || text[cursor - 1] === '\t')) cursor -= 1;
  return cursor;
}

/**
 * `` `$x$` `` 整段都是一条公式：光标落在两侧反引号上也要命中。
 * `` `see $x$` `` 这种代码里还夹着别的字，仍然只命中 `$x$` 本身。
 */
function expandRegionsOverInlineCode(
  text: string,
  regions: readonly MathRegion[],
  inlineRanges: readonly TextRange[],
): MathRegion[] {
  if (inlineRanges.length === 0) return [...regions];
  return regions.map((region) => {
    const wrap = inlineRanges.find((range) => {
      if (region.start < range.start || region.end > range.end) return false;
      const inner = innerInlineCodeRange(text, range);
      const trimmedStart = skipHorizontalSpace(text, inner.start, inner.end);
      const trimmedEnd = skipHorizontalSpaceEnd(text, inner.start, inner.end);
      return region.start === trimmedStart && region.end === trimmedEnd;
    });
    if (wrap === undefined || (wrap.start === region.start && wrap.end === region.end)) {
      return region;
    }
    return { ...region, start: wrap.start, end: wrap.end };
  });
}

function collectIgnoredRanges(
  text: string,
  language: 'latex' | 'markdown',
  initialFence?: MarkdownFenceState,
): {
  readonly ignored: TextRange[];
  readonly codeLimits: TextRange[];
  readonly inlineCode: TextRange[];
} {
  const codeRanges =
    language === 'markdown'
      ? collectMarkdownFenceRanges(text, initialFence)
      : [];
  const inlineCodeRanges =
    language === 'markdown'
      ? collectMarkdownInlineCodeRanges(text, codeRanges)
      : [];
  const baseRanges = mergeRanges([...codeRanges, ...inlineCodeRanges]);
  const comments =
    language === 'latex'
      ? collectLatexCommentRanges(text, baseRanges)
      : [];
  return {
    ignored: mergeRanges([...baseRanges, ...comments]),
    codeLimits: language === 'markdown'
      ? collectMarkdownCodeLimits(text, codeRanges, inlineCodeRanges)
      : [],
    inlineCode: inlineCodeRanges,
  };
}

function readEnvironmentHead(text: string, offset: number): EnvironmentHead | undefined {
  if (text[offset] !== '\\' || isEscaped(text, offset)) {
    return undefined;
  }
  const match = /^\\(begin|end)[ \t]*\{([^{}\r\n]+)\}/.exec(text.slice(offset));
  if (match === null) {
    return undefined;
  }
  const kind = match[1];
  const name = match[2];
  if ((kind !== 'begin' && kind !== 'end') || name === undefined) {
    return undefined;
  }
  return {
    start: offset,
    end: offset + match[0].length,
    kind,
    name,
  };
}

function isSingleDollar(text: string, offset: number): boolean {
  return (
    text[offset] === '$' &&
    text[offset - 1] !== '$' &&
    text[offset + 1] !== '$' &&
    !isEscaped(text, offset)
  );
}

function readOpener(
  text: string,
  offset: number,
  mathEnvironments: ReadonlySet<string>,
): DelimiterOpener | undefined {
  if (text.startsWith('$$', offset) && !isEscaped(text, offset)) {
    return {
      start: offset,
      end: offset + 2,
      opener: '$$',
      closer: '$$',
      kind: 'dollar-display',
    };
  }
  if (isSingleDollar(text, offset)) {
    return {
      start: offset,
      end: offset + 1,
      opener: '$',
      closer: '$',
      kind: 'dollar-inline',
    };
  }
  if (text.startsWith('\\(', offset) && !isEscaped(text, offset)) {
    return {
      start: offset,
      end: offset + 2,
      opener: '\\(',
      closer: '\\)',
      kind: 'paren-inline',
    };
  }
  if (text.startsWith('\\[', offset) && !isEscaped(text, offset)) {
    return {
      start: offset,
      end: offset + 2,
      opener: '\\[',
      closer: '\\]',
      kind: 'bracket-display',
    };
  }
  const environment = readEnvironmentHead(text, offset);
  if (
    environment?.kind === 'begin' &&
    mathEnvironments.has(environment.name)
  ) {
    return {
      start: offset,
      end: environment.end,
      opener: text.slice(offset, environment.end),
      closer: `\\end{${environment.name}}`,
      kind: 'environment',
      environment: environment.name,
    };
  }
  return undefined;
}

/** 空行或 `\par` 都会结束一个段落，行内公式不可能跨过它。 */
function isParagraphBreak(text: string, offset: number): boolean {
  if (text.startsWith('\\par', offset) && !/[A-Za-z@]/.test(text[offset + 4] ?? '')) {
    return !isEscaped(text, offset);
  }
  if (text[offset] !== '\r' && text[offset] !== '\n') return false;
  return /^\r?\n[ \t]*\r?\n/.test(text.slice(offset, offset + 8));
}

function skipMathComment(text: string, offset: number): number | undefined {
  if (text[offset] !== '%' || isEscaped(text, offset)) {
    return undefined;
  }
  return nextLineStart(text, lineEndAfter(text, offset));
}

function findFixedCloser(
  text: string,
  opener: DelimiterOpener,
  ignoredRanges: readonly TextRange[],
  codeLimits: readonly TextRange[],
): TextRange | undefined {
  const home = rangeContaining(codeLimits, opener.start);
  const searchEnd = home?.end ?? text.length;
  let cursor = opener.end;
  while (cursor < searchEnd) {
    if (home === undefined) {
      const nestedCode = rangeContaining(codeLimits, cursor);
      if (nestedCode !== undefined) {
        cursor = nestedCode.end;
        continue;
      }
    }
    const ignored = rangeContaining(ignoredRanges, cursor);
    if (ignored !== undefined) {
      cursor =
        text[ignored.start] === '%'
          ? nextLineStart(text, ignored.end)
          : ignored.end;
      continue;
    }
    const commentEnd = skipMathComment(text, cursor);
    if (commentEnd !== undefined) {
      cursor = commentEnd;
      continue;
    }
    // 行内公式按 TeX 的真实规则：可以跨普通换行，遇到空行（段落结束）或 `\par` 才终止。
    // 只要一遇换行就放弃，`\scalebox{\tiny $` 换行再 `$}` 的写法会把后面的 `$` 全部配错对，
    // 从那里开始整篇文档的行内公式都会错位。
    if (
      (opener.kind === 'dollar-inline' || opener.kind === 'paren-inline')
      && isParagraphBreak(text, cursor)
    ) {
      return undefined;
    }

    const closes =
      opener.closer === '$'
        ? isSingleDollar(text, cursor)
        : text.startsWith(opener.closer, cursor) && !isEscaped(text, cursor);
    if (closes) {
      return { start: cursor, end: cursor + opener.closer.length };
    }
    cursor += 1;
  }
  return undefined;
}

function findEnvironmentCloser(
  text: string,
  opener: DelimiterOpener,
  ignoredRanges: readonly TextRange[],
  codeLimits: readonly TextRange[],
): TextRange | undefined {
  const environmentName = opener.environment;
  if (environmentName === undefined) {
    return undefined;
  }
  const home = rangeContaining(codeLimits, opener.start);
  const searchEnd = home?.end ?? text.length;
  let depth = 1;
  let cursor = opener.end;
  while (cursor < searchEnd) {
    if (home === undefined) {
      const nestedCode = rangeContaining(codeLimits, cursor);
      if (nestedCode !== undefined) {
        cursor = nestedCode.end;
        continue;
      }
    }
    const ignored = rangeContaining(ignoredRanges, cursor);
    if (ignored !== undefined) {
      cursor = ignored.end;
      continue;
    }
    const commentEnd = skipMathComment(text, cursor);
    if (commentEnd !== undefined) {
      cursor = commentEnd;
      continue;
    }
    const head = readEnvironmentHead(text, cursor);
    if (head?.name === environmentName) {
      depth += head.kind === 'begin' ? 1 : -1;
      if (depth === 0) {
        return { start: head.start, end: head.end };
      }
      cursor = head.end;
    } else {
      cursor += 1;
    }
  }
  return undefined;
}

function recoveryReason(kind: MathRegionKind): MathRecoveryReason {
  if (kind === 'environment') {
    return 'unclosed-environment';
  }
  if (kind === 'dollar-inline' || kind === 'paren-inline') {
    return 'unclosed-inline-delimiter';
  }
  return 'unclosed-display-delimiter';
}

function recoveryBoundary(
  text: string,
  opener: DelimiterOpener,
  windowChars: number,
  codeLimits: readonly TextRange[],
): number {
  const home = rangeContaining(codeLimits, opener.start);
  const cap = Math.min(home?.end ?? text.length, opener.start + windowChars);
  const remaining = text.slice(opener.end, cap);
  const blankLine = /\r?\n[ \t]*\r?\n/.exec(remaining);
  if (blankLine !== null) {
    return opener.end + blankLine.index;
  }
  return cap;
}

function makeClosedRegion(
  opener: DelimiterOpener,
  close: TextRange,
): MathRegion {
  const base = {
    start: opener.start,
    end: close.end,
    contentStart: opener.end,
    contentEnd: close.start,
    opener: opener.opener,
    closer: opener.closer,
    kind: opener.kind,
    closed: true,
  } as const;
  return opener.environment === undefined
    ? base
    : { ...base, environment: opener.environment };
}

function makeRecoveredRegion(
  opener: DelimiterOpener,
  boundary: number,
): MathRegion {
  const base = {
    start: opener.start,
    end: boundary,
    contentStart: opener.end,
    contentEnd: boundary,
    opener: opener.opener,
    closer: opener.closer,
    kind: opener.kind,
    closed: false,
    recovery: {
      reason: recoveryReason(opener.kind),
      boundary,
    },
  } as const;
  return opener.environment === undefined
    ? base
    : { ...base, environment: opener.environment };
}

/**
 * 对单个文档做线性公式扫描。返回区间均使用 UTF-16、end-exclusive offset。
 * 增量索引可在上层仅把受编辑影响的窗口送入本函数。
 */
export function scanMathRegions(
  text: string,
  options: MathScanOptions = {},
): MathScanResult {
  const language = options.language ?? 'latex';
  const customEnvironments = (options.customMathEnvironments ?? []).filter(
    (name) => ENVIRONMENT_NAME.test(name),
  );
  // 表格环境本身不是数学模式，但预览会把它翻译成 array，因此同样按区域扫描。
  const environments = new Set<string>([
    ...DEFAULT_MATH_ENVIRONMENTS,
    ...TABLE_ENVIRONMENTS,
    ...customEnvironments,
  ]);
  const recoveryWindow = Math.max(
    64,
    Math.floor(options.recoveryWindowChars ?? DEFAULT_RECOVERY_WINDOW),
  );
  const collected = collectIgnoredRanges(text, language, options.markdownInitialFence);
  const ignoredRanges = collected.ignored;
  const tableRegions = language === 'markdown'
    ? collectMarkdownTableRegions(text, ignoredRanges)
    : [];
  // Markdown 行内代码 / fence 里的 $ 也要预览；定义解析仍用 ignoredRanges 跳过代码。
  const mathSkip = language === 'markdown'
    ? tableRegions.map((region) => ({ start: region.start, end: region.end }))
    : tableRegions.length === 0
      ? ignoredRanges
      : mergeRanges([
        ...ignoredRanges,
        ...tableRegions.map((region) => ({ start: region.start, end: region.end })),
      ]);
  const codeLimits = collected.codeLimits;
  const regions: MathRegion[] = [...tableRegions];

  let cursor = 0;
  while (cursor < text.length) {
    const ignored = rangeContaining(mathSkip, cursor);
    if (ignored !== undefined) {
      cursor = ignored.end;
      continue;
    }
    const opener = readOpener(text, cursor, environments);
    if (opener === undefined) {
      cursor += 1;
      continue;
    }

    const close =
      opener.kind === 'environment'
        ? findEnvironmentCloser(text, opener, mathSkip, codeLimits)
        : findFixedCloser(text, opener, mathSkip, codeLimits);
    if (close !== undefined) {
      const region = makeClosedRegion(opener, close);
      regions.push(region);
      cursor = region.end;
    } else {
      const boundary = recoveryBoundary(text, opener, recoveryWindow, codeLimits);
      const region = makeRecoveredRegion(opener, boundary);
      regions.push(region);
      cursor = Math.max(opener.end, boundary);
    }
  }

  if (tableRegions.length > 0) regions.sort((left, right) => left.start - right.start);
  return {
    regions: expandRegionsOverInlineCode(text, regions, collected.inlineCode),
    ignoredRanges,
  };
}

/** 闭区间规则与 {@link findMathRegionAt} 一致：闭合区域不含 end。 */
export function regionContainsOffset(region: MathRegion, offset: number): boolean {
  if (offset < region.start || offset > region.end) return false;
  return !(offset === region.end && region.closed);
}

/** 选区只要和公式有交集就还算“在公式里”，避免往上拖选时把预览清掉。 */
export function selectionOverlapsRegion(start: number, end: number, region: MathRegion): boolean {
  const from = Math.min(start, end);
  const to = Math.max(start, end);
  if (from === to) return regionContainsOffset(region, from);
  return from < region.end && to > region.start;
}

/** 在已排序且不重叠的扫描结果中二分查找光标所在公式。 */
export function findMathRegionAt(
  regions: readonly MathRegion[],
  offset: number,
): MathRegion | undefined {
  let low = 0;
  let high = regions.length - 1;
  while (low <= high) {
    const middle = (low + high) >>> 1;
    const region = regions[middle];
    if (region === undefined) {
      return undefined;
    }
    if (offset < region.start) {
      high = middle - 1;
    } else if (
      offset > region.end ||
      (offset === region.end && region.closed)
    ) {
      low = middle + 1;
    } else {
      return region;
    }
  }
  return undefined;
}

export function mathRegionContent(text: string, region: MathRegion): string {
  return text.slice(region.contentStart, region.contentEnd);
}

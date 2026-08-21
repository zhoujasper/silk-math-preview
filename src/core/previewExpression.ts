import { anchorCaret } from './caretAnchor';
import { mathRegionContent } from './mathScanner';
import { buildMarkdownTableExpression, markdownTableCellStart } from './markdownTable';
import { buildTableExpression, isTableEnvironment, isTablePreviewRegion, tablePreambleLength } from './tablePreview';
import type { CaretAnchor, MathRegion } from './types';

/**
 * 竖线要和正文一样跨在基线两侧：`\rule` 默认坐在基线上，0.88em 全长都在基线以上，
 * 顶端比大写字母（0.705em）还高 0.175em，看起来整体偏上。改为下沉 0.18em、
 * 总高 0.92em，覆盖 -0.18em~0.74em，与字母的 -0.205em~0.705em 基本齐平。
 */
export const PREVIEW_CARET_TEX = String.raw`\class{silk-math-caret}{\rule[-0.18em]{0.03em}{0.92em}}`;

export interface PreviewExpression {
  readonly expression: string;
  readonly caret: CaretAnchor;
}

const INNER_PREVIEW_ENVIRONMENTS: Readonly<Record<string, string | undefined>> = Object.freeze({
  equation: undefined,
  'equation*': undefined,
  displaymath: undefined,
  math: undefined,
  align: 'aligned',
  'align*': 'aligned',
  alignat: 'alignedat',
  'alignat*': 'alignedat',
  gather: 'gathered',
  'gather*': 'gathered',
  multline: 'gathered',
  'multline*': 'gathered',
  flalign: 'aligned',
  'flalign*': 'aligned',
});

/**
 * `.cls` 里常见 `\newenvironment{eqmath}{\begin{equation}}{\end{equation}}`。
 * 预览已经在数学模式，再展开成 equation/align 会报
 * “Erroneous nesting of equation structures”。prelude 里改成可嵌套形式。
 */
export function sanitizeEnvironmentBodyForMathJax(text: string): string {
  return text.replace(
    /\\(begin|end)[ \t]*\{([A-Za-z]+\*?)\}/g,
    (whole, kind: string, name: string) => {
      if (!Object.hasOwn(INNER_PREVIEW_ENVIRONMENTS, name)) return whole;
      const inner = INNER_PREVIEW_ENVIRONMENTS[name];
      return inner === undefined ? '' : `\\${kind}{${inner}}`;
    },
  );
}

function wrapEnvironmentForPreview(environment: string, content: string): string {
  if (Object.hasOwn(INNER_PREVIEW_ENVIRONMENTS, environment)) {
    const inner = INNER_PREVIEW_ENVIRONMENTS[environment];
    return inner === undefined ? content : `\\begin{${inner}}${content}\\end{${inner}}`;
  }
  return `\\begin{${environment}}${content}\\end{${environment}}`;
}

/**
 * `$$\begin{equation}...\end{equation}$$`（Markdown / Jupyter 里非常常见）的内容是一个
 * 顶层公式环境。渲染时表达式会被放进沙箱分组里，`equation` 一旦不在最外层，MathJax 直接报
 * “Erroneous nesting of equation structures”，整条公式什么都不显示。这里把它按环境区域
 * 同样的规则归一化：`equation` 之类直接去壳，`align` 之类换成可嵌套的 `aligned`。
 */
function unwrapNestedEnvironment(
  content: string,
  caretOffset: number,
): { readonly content: string; readonly caretOffset: number } | undefined {
  const head = /^[\s]*\\begin[ \t]*\{([A-Za-z]+\*?)\}/.exec(content);
  const environment = head?.[1];
  if (!head || environment === undefined) return undefined;
  if (!Object.hasOwn(INNER_PREVIEW_ENVIRONMENTS, environment)) return undefined;
  const tail = new RegExp(`\\\\end[ \\t]*\\{${environment.replace('*', '\\*')}\\}[\\s]*$`).exec(content);
  if (!tail) return undefined;
  const bodyStart = head[0].length;
  const bodyEnd = tail.index;
  if (bodyEnd < bodyStart) return undefined;
  const body = content.slice(bodyStart, bodyEnd);
  // 同名环境再嵌套时结构不明确，保持原样交给 MathJax 报错更安全。
  if (body.includes(`\\begin{${environment}}`)) return undefined;
  const inner = INNER_PREVIEW_ENVIRONMENTS[environment];
  const prefix = inner === undefined ? '' : `\\begin{${inner}}`;
  const suffix = inner === undefined ? '' : `\\end{${inner}}`;
  const mapped = Math.min(Math.max(caretOffset - bodyStart, 0), body.length) + prefix.length;
  return { content: `${prefix}${body}${suffix}`, caretOffset: mapped };
}

const NON_VISUAL_PATTERN = /\\label[ \t]*\{[^{}\r\n]*\}|\\(?:notag|nonumber)\b/;
/**
 * 表格正文会被重新组装成 `array`，注释里的 `%` 会吃掉后面补出来的 `}` 或 `\\`，
 * 因此表格必须先把注释去掉；数学环境保持原样交给 MathJax。
 */
const TABLE_NON_VISUAL_PATTERN = new RegExp(`${NON_VISUAL_PATTERN.source}|(?<!\\\\)%[^\\r\\n]*`);

function removeNonVisualNumberingCommands(
  content: string,
  caretOffset: number,
  source: RegExp,
): { readonly content: string; readonly caretOffset: number } {
  const pattern = new RegExp(source.source, 'g');
  let cleaned = '';
  let cursor = 0;
  let mappedCaret = caretOffset;
  for (const match of content.matchAll(pattern)) {
    const start = match.index;
    const command = match[0];
    if (start === undefined || command === undefined) continue;
    const end = start + command.length;
    cleaned += content.slice(cursor, start);
    if (caretOffset >= start && caretOffset <= end) {
      mappedCaret = cleaned.length;
    } else if (caretOffset > end) {
      mappedCaret -= command.length;
    }
    cursor = end;
  }
  cleaned += content.slice(cursor);
  return { content: cleaned, caretOffset: mappedCaret };
}

function protectEnvironmentArguments(
  environment: string | undefined,
  content: string,
  caretOffset: number,
): number {
  if (isTableEnvironment(environment)) {
    // 列格式参数仍属于区域正文；光标标记插进去会毁掉整张表的列定义。
    const preamble = tablePreambleLength(content);
    return caretOffset < preamble ? preamble : caretOffset;
  }
  if (environment !== 'alignat' && environment !== 'alignat*' && environment !== 'alignedat') {
    return caretOffset;
  }
  const columns = /^[ \t\r\n]*\{[^{}\r\n]*\}/.exec(content)?.[0];
  return columns !== undefined && caretOffset <= columns.length ? columns.length : caretOffset;
}

/** 从 `from` 开始数未转义的 `$`，判断 offset 是否落在行内数学里。 */
function isInsideInlineMath(content: string, offset: number, from = 0): boolean {
  let open = false;
  for (let cursor = from; cursor < offset; cursor += 1) {
    if (content[cursor] === '$' && !isEscaped(content, cursor)) open = !open;
  }
  return open;
}

/** 这些命令的参数按文本排版，里面放数学标记会被原样打印出来。 */
const TEXT_MODE_COMMANDS: ReadonlySet<string> = new Set([
  'text', 'textrm', 'textbf', 'textit', 'texttt', 'textsf', 'textnormal',
  'textmd', 'textup', 'textsl', 'textsc', 'mbox', 'hbox', 'emph',
]);

/** 找到包含 offset 的最内层文本模式分组。 */
function textModeGroupStart(content: string, offset: number): number | undefined {
  let innermost: number | undefined;
  for (let cursor = 0; cursor < content.length; cursor += 1) {
    if (content[cursor] !== '\\' || isEscaped(content, cursor)) continue;
    const name = /^\\([A-Za-z@]+)/.exec(content.slice(cursor))?.[1];
    if (name === undefined) continue;
    cursor += name.length;
    if (!TEXT_MODE_COMMANDS.has(name)) continue;
    let scan = cursor + 1;
    while (scan < content.length && /[ \t]/.test(content[scan] ?? '')) scan += 1;
    if (content[scan] !== '{') continue;
    let depth = 1;
    let end = scan + 1;
    for (; end < content.length && depth > 0; end += 1) {
      if (isEscaped(content, end)) continue;
      if (content[end] === '{') depth += 1;
      else if (content[end] === '}') depth -= 1;
    }
    // 取最内层：后面出现的、仍然包住 offset 的分组一定嵌套得更深。
    if (offset > scan && offset < end) innermost = scan + 1;
  }
  return innermost;
}

/**
 * 判断插入点当前处于文本模式：`\text{for |}` 里直接插入 `\class{...}` 会被
 * 原样当成文字打印出来，必须先用 `$...$` 切回数学。
 */
function latexTableCellStart(content: string, offset: number): number {
  const clamped = Math.min(Math.max(0, offset), content.length);
  let start = 0;
  let depth = 0;
  for (let cursor = 0; cursor < clamped; cursor += 1) {
    if (isEscaped(content, cursor)) continue;
    const character = content[cursor];
    if (character === '{') depth += 1;
    else if (character === '}') depth = Math.max(0, depth - 1);
    else if (depth === 0 && character === '&') start = cursor + 1;
    else if (depth === 0 && content.startsWith('\\\\', cursor)) {
      start = cursor + 2;
      cursor += 1;
    }
  }
  return start;
}

function isTextModeAt(
  content: string,
  offset: number,
  tableKind: 'none' | 'latex-table' | 'markdown-table',
): boolean {
  const groupStart = tableKind === 'markdown-table'
    ? markdownTableCellStart(content, offset)
    : tableKind === 'latex-table'
      ? latexTableCellStart(content, offset)
      : textModeGroupStart(content, offset);
  if (groupStart === undefined) return false;
  return !isInsideInlineMath(content, offset, groupStart);
}

function isEscaped(text: string, offset: number): boolean {
  let slashCount = 0;
  for (let cursor = offset - 1; cursor >= 0 && text[cursor] === '\\'; cursor -= 1) {
    slashCount += 1;
  }
  return slashCount % 2 === 1;
}

/** 构造一次渲染用表达式；环境内容会补回 begin/end，光标绝不拆开 TeX token。 */
export function buildPreviewExpression(
  source: string,
  region: MathRegion,
  caretDocumentOffset: number,
  showCaret = true,
): PreviewExpression {
  const content = mathRegionContent(source, region);
  const caret = anchorCaret(content, caretDocumentOffset - region.contentStart);
  const environmentSafeOffset = protectEnvironmentArguments(region.environment, content, caret.offset);
  const table = isTablePreviewRegion(region);
  const tableKind = region.kind === 'markdown-table'
    ? 'markdown-table'
    : table
      ? 'latex-table'
      : 'none';
  const cleaned = removeNonVisualNumberingCommands(
    content,
    environmentSafeOffset,
    table ? TABLE_NON_VISUAL_PATTERN : NON_VISUAL_PATTERN,
  );
  // `$$ \begin{equation} ... \end{equation} $$`：分隔符区域里再包一层顶层环境时，
  // 要和环境区域走同一套归一化，否则整条公式会因为嵌套报错而完全不显示。
  const visual = (region.environment === undefined
    ? unwrapNestedEnvironment(cleaned.content, cleaned.caretOffset)
    : undefined) ?? cleaned;
  const marker = isTextModeAt(visual.content, visual.caretOffset, tableKind)
    ? `$${PREVIEW_CARET_TEX}$`
    : PREVIEW_CARET_TEX;
  const marked = showCaret
    ? `${visual.content.slice(0, visual.caretOffset)}${marker}${visual.content.slice(visual.caretOffset)}`
    : visual.content;
  if (region.kind === 'markdown-table') {
    return { expression: buildMarkdownTableExpression(marked), caret };
  }
  if (table) {
    return { expression: buildTableExpression(marked), caret };
  }
  return {
    expression: region.environment
      ? wrapEnvironmentForPreview(region.environment, marked)
      : marked,
    caret,
  };
}

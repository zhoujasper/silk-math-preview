import { ensureCaretInMath } from './markdownTable';

/**
 * 表格环境不是数学环境，MathJax 也没有 `tabular`/`longtable`。
 * 这里把常见表格源码翻译成 MathJax 能渲染的 `array`：列格式归一化、
 * booktabs 规则映射为 `\hline`、单元格默认按文本模式包进 `\text{}`
 * （单元格内的 `$...$` 交给 MathJax 自己切回数学模式）。
 * 翻译只服务于预览，绝不回写源码。
 */

/** 表格整体比正文公式略小，避免多列表格铺满编辑器。 */
export const TABLE_PREVIEW_SCALE = 0.82;

export const TABLE_ENVIRONMENTS: readonly string[] = Object.freeze([
  'tabular',
  'tabular*',
  'tabularx',
  'tabulary',
  'longtable',
  'xltabular',
  'supertabular',
]);

const TABLE_ENVIRONMENT_SET: ReadonlySet<string> = new Set(TABLE_ENVIRONMENTS);

/** 单元格里可以展开成多行的命令。 */
const CELL_STACK_COMMANDS: ReadonlySet<string> = new Set(['makecell', 'thead', 'tabincell', 'shortstack']);

/**
 * 单元格里的图形交给真正的 TeX/TikZ 引擎单独渲染，表格本身仍由 MathJax 排版
 * （中文、规则线、合并单元格都保留）。这里只把图形换成占位命令并记录源码。
 */
const EMBED_ENVIRONMENTS = /\\begin\s*\{(tikzpicture|tikzcd|pgfpicture|circuitikz)\}/g;
export const TABLE_EMBED_COMMAND = 'silkTableEmbed';
const EMBED_TOKEN = /\\silkTableEmbed\{(\d+)\}/g;

export interface TableEmbed {
  /** 不含预览光标的图形源码。 */
  readonly source: string;
  readonly environment: string;
  /** 光标原本落在图形内部；占位后面补一个光标。 */
  readonly caret: boolean;
}

/** 图形渲染后的尺寸（TeX pt）；undefined 表示未开启或失败，用文字占位。 */
export interface TableEmbedSize {
  readonly widthPt: number;
  readonly heightPt: number;
}

const MAX_TABLE_EMBEDS = 32;

const MAX_CELL_DEPTH = 3;
const MAX_COLUMN_REPEAT = 64;

export function isTableEnvironment(name: string | undefined): boolean {
  return name !== undefined && TABLE_ENVIRONMENT_SET.has(name);
}

/** LaTeX tabular 与 Markdown GFM 表格都走 array 预览。 */
export function isTablePreviewRegion(region: { readonly kind?: string; readonly environment?: string }): boolean {
  return region.kind === 'markdown-table' || isTableEnvironment(region.environment);
}

function isEscaped(text: string, offset: number): boolean {
  let slashCount = 0;
  for (let cursor = offset - 1; cursor >= 0 && text[cursor] === '\\'; cursor -= 1) {
    slashCount += 1;
  }
  return slashCount % 2 === 1;
}

function skipSpace(text: string, offset: number): number {
  let cursor = offset;
  while (cursor < text.length && /[ \t\r\n]/.test(text[cursor] ?? '')) cursor += 1;
  return cursor;
}

interface Delimited {
  readonly content: string;
  readonly end: number;
}

/** 从 `\\begin{name}` 处找到同名匹配的 `\\end{name}` 之后；未闭合返回 undefined。 */
function environmentSpanEnd(text: string, start: number, name: string): number | undefined {
  const heads = /\\(begin|end)\s*\{([^{}]*)\}/g;
  heads.lastIndex = start;
  let depth = 0;
  for (let head = heads.exec(text); head; head = heads.exec(text)) {
    if (isEscaped(text, head.index) || head[2] !== name) continue;
    depth += head[1] === 'begin' ? 1 : -1;
    if (depth === 0) return heads.lastIndex;
  }
  return undefined;
}

/** `\\begin`/`\\end` 后面不是字母时才是环境边界。 */
function environmentHeadAt(text: string, cursor: number): 1 | -1 | 0 {
  if (text[cursor] !== '\\' || isEscaped(text, cursor)) return 0;
  if (text.startsWith('\\begin', cursor) && !/[A-Za-z@]/.test(text[cursor + 6] ?? '')) return 1;
  if (text.startsWith('\\end', cursor) && !/[A-Za-z@]/.test(text[cursor + 4] ?? '')) return -1;
  return 0;
}

function extractEmbeds(body: string, caretMarker: string, embeds: TableEmbed[]): string {
  const rawCaret = caretMarker.replace(/^\$|\$$/g, '');
  let result = '';
  let cursor = 0;
  EMBED_ENVIRONMENTS.lastIndex = 0;
  for (let match = EMBED_ENVIRONMENTS.exec(body); match; match = EMBED_ENVIRONMENTS.exec(body)) {
    if (isEscaped(body, match.index) || embeds.length >= MAX_TABLE_EMBEDS) continue;
    const environment = match[1]!;
    const end = environmentSpanEnd(body, match.index, environment) ?? body.length;
    let source = body.slice(match.index, end);
    let caret = false;
    if (rawCaret && source.includes(rawCaret)) {
      caret = true;
      source = source.split(caretMarker).join('').split(rawCaret).join('');
    }
    result += body.slice(cursor, match.index) + `\\${TABLE_EMBED_COMMAND}{${embeds.length}}` + (caret ? rawCaret : '');
    embeds.push({ source, environment, caret });
    cursor = end;
    EMBED_ENVIRONMENTS.lastIndex = end;
  }
  return result + body.slice(cursor);
}

/**
 * 把占位换成可测量的透明框：尺寸按 TeX pt 给出（MathJax 中 1pt=0.1em，与 10pt 正文一致），
 * 竖直方向以数学轴为中心。渲染器随后把对应 SVG 放进这个框。
 */
export function resolveTableEmbeds(
  expression: string,
  embeds: readonly TableEmbed[],
  sizes: readonly (TableEmbedSize | undefined)[] = [],
  failed: readonly boolean[] = [],
): string {
  return expression.replace(EMBED_TOKEN, (_whole, digits: string) => {
    const index = Number(digits);
    const size = sizes[index];
    if (size && size.widthPt > 0 && size.heightPt > 0) {
      const width = Math.round(size.widthPt * 1000) / 1000;
      const height = Math.round(size.heightPt * 1000) / 1000;
      const depth = Math.round(Math.max(0, height / 2 - 2.5) * 1000) / 1000;
      return `\\class{silk-embed-${index}}{\\rule[-${depth}pt]{${width}pt}{${height}pt}}`;
    }
    const label = (embeds[index]?.environment ?? 'tikz').replace(/[^A-Za-z]/g, '');
    return failed[index]
      ? `\\boxed{\\color{red}{\\scriptsize\\text{${label}}}}`
      : `\\boxed{\\scriptsize\\text{${label}}}`;
  });
}

function readDelimited(text: string, start: number, open: string, close: string): Delimited | undefined {
  if (text[start] !== open) return undefined;
  let depth = 1;
  for (let cursor = start + 1; cursor < text.length; cursor += 1) {
    if (isEscaped(text, cursor)) continue;
    const character = text[cursor];
    if (character === open) depth += 1;
    else if (character === close && (depth -= 1) === 0) {
      return { content: text.slice(start + 1, cursor), end: cursor + 1 };
    }
  }
  return undefined;
}

const readGroup = (text: string, start: number): Delimited | undefined => readDelimited(text, start, '{', '}');
const readOptional = (text: string, start: number): Delimited | undefined => readDelimited(text, start, '[', ']');
const readParen = (text: string, start: number): Delimited | undefined => readDelimited(text, start, '(', ')');

function commandNameAt(text: string, offset: number): string | undefined {
  if (text[offset] !== '\\' || isEscaped(text, offset)) return undefined;
  return /^\\([A-Za-z@]+)/.exec(text.slice(offset))?.[1];
}

/** `tabular*`/`tabularx` 的第一个参数是宽度而不是列格式。 */
function isLengthArgument(value: string): boolean {
  return /^[\s\d.]*(?:\\[A-Za-z@]+|pt|mm|cm|in|ex|em|bp|dd|pc|sp)[\s\d.]*$/.test(value);
}

interface TablePreamble {
  readonly spec: string;
  readonly bodyStart: number;
}

/** 区域内容从 `\begin{tabular}` 之后开始，因此列格式仍在正文里。 */
export function readTablePreamble(body: string): TablePreamble {
  let cursor = skipSpace(body, 0);
  for (let guard = 0; guard < 4; guard += 1) {
    const optional = readOptional(body, cursor);
    if (optional) {
      cursor = skipSpace(body, optional.end);
      continue;
    }
    const group = readGroup(body, cursor);
    if (!group) break;
    cursor = skipSpace(body, group.end);
    if (isLengthArgument(group.content)) continue;
    return { spec: group.content, bodyStart: cursor };
  }
  return { spec: '', bodyStart: cursor };
}

export function tablePreambleLength(body: string): number {
  return readTablePreamble(body).bodyStart;
}

/** 只保留 MathJax `array` 认识的 l/c/r 与竖线，其余列类型按对齐方式近似。 */
export function normalizeColumnSpec(spec: string, depth = 0, numeric?: Array<string | undefined>): string {
  let normalized = '';
  let cursor = 0;
  while (cursor < spec.length) {
    const character = spec[cursor];
    if (character === undefined) break;
    if (/\s/.test(character)) {
      cursor += 1;
    } else if (character === '|' || character === 'l' || character === 'c' || character === 'r') {
      normalized += character;
      if (character !== '|') numeric?.push(undefined);
      cursor += 1;
    } else if (character === 'p' || character === 'm' || character === 'b') {
      // p/m/b 的宽度参数在预览里没有意义，按左对齐处理。
      normalized += 'l';
      numeric?.push(undefined);
      cursor = readGroup(spec, cursor + 1)?.end ?? cursor + 1;
    } else if (character === 'X' || character === 'L' || character === 'J') {
      normalized += 'l';
      numeric?.push(undefined);
      cursor += 1;
    } else if (character === 'Y' || character === 'C') {
      normalized += 'c';
      numeric?.push(undefined);
      cursor += 1;
    } else if (character === 'R' || character === 'S' || character === 'D') {
      normalized += 'r';
      cursor += 1;
      const argument = readGroup(spec, cursor) ?? readOptional(spec, cursor);
      numeric?.push(character === 'S' ? argument?.content ?? '' : undefined);
      if (argument) cursor = argument.end;
    } else if (character === '@' || character === '!' || character === '>' || character === '<') {
      cursor = readGroup(spec, cursor + 1)?.end ?? cursor + 1;
    } else if (character === '*') {
      const count = readGroup(spec, cursor + 1);
      const repeated = count ? readGroup(spec, count.end) : undefined;
      if (!count || !repeated) {
        cursor += 1;
      } else {
        const times = Math.min(MAX_COLUMN_REPEAT, Math.max(0, Number.parseInt(count.content, 10) || 0));
        const nested: Array<string | undefined> = [];
        normalized += depth < MAX_CELL_DEPTH
          ? normalizeColumnSpec(repeated.content, depth + 1, nested).repeat(times)
          : 'c'.repeat(times);
        for (let i = 0; i < times; i++) numeric?.push(...(depth < MAX_CELL_DEPTH ? nested : [undefined]));
        cursor = repeated.end;
      }
    } else if (/[A-Za-z]/.test(character)) {
      // 未知列类型按居中处理，宁可对齐方式不准，也不能少一列让后面全部串位。
      normalized += 'c';
      numeric?.push(undefined);
      cursor += 1;
    } else {
      cursor += 1;
    }
  }
  return normalized;
}

function columnCount(spec: string): number {
  return (spec.match(/[lcr]/g) ?? []).length;
}

function padColumnSpec(spec: string, columns: number): string {
  const missing = Math.max(0, columns - columnCount(spec));
  return `${spec}${'c'.repeat(missing)}` || 'c';
}

interface CommandRule {
  readonly optional?: number;
  readonly paren?: boolean;
  readonly required: number;
  readonly replace: (args: readonly string[]) => string;
}

const DROP = (): string => '';
const RULE = (): string => '\\hline ';

/**
 * 表格专用命令的重写表。规则命令统一变成 `\hline`，装饰与排版命令直接丢弃，
 * `\multicolumn` 补上被它吃掉的 `&`，保证后续单元格不串列。
 */
const TABLE_COMMAND_RULES: Readonly<Record<string, CommandRule>> = Object.freeze({
  hline: { required: 0, replace: RULE },
  toprule: { optional: 1, required: 0, replace: RULE },
  midrule: { optional: 1, required: 0, replace: RULE },
  bottomrule: { optional: 1, required: 0, replace: RULE },
  cmidrule: { optional: 1, paren: true, required: 1, replace: RULE },
  cline: { required: 1, replace: RULE },
  hhline: { required: 1, replace: RULE },
  specialrule: { required: 3, replace: RULE },
  addlinespace: { optional: 1, required: 0, replace: DROP },
  morecmidrules: { required: 0, replace: DROP },
  caption: { optional: 1, required: 1, replace: DROP },
  label: { required: 1, replace: DROP },
  endhead: { required: 0, replace: DROP },
  endfirsthead: { required: 0, replace: DROP },
  endfoot: { required: 0, replace: DROP },
  endlastfoot: { required: 0, replace: DROP },
  kill: { required: 0, replace: DROP },
  noalign: { required: 1, replace: DROP },
  rowcolor: { optional: 1, required: 1, replace: DROP },
  cellcolor: { optional: 1, required: 1, replace: DROP },
  arrayrulecolor: { required: 1, replace: DROP },
  renewcommand: { required: 2, replace: DROP },
  setlength: { required: 2, replace: DROP },
  centering: { required: 0, replace: DROP },
  raggedright: { required: 0, replace: DROP },
  raggedleft: { required: 0, replace: DROP },
  arraybackslash: { required: 0, replace: DROP },
  // 字号命令保留：MathJax 文本模式支持 \small/\footnotesize 等，单元格大小与 LaTeX 一致。
  tabularnewline: { required: 0, replace: () => '\\\\' },
});

const SPAN_CLASS = /silk-span-c(\d+)-r(\d+)-([lcr])/;

export interface TableCellSpan {
  readonly colspan: number;
  readonly rowspan: number;
  readonly align: 'l' | 'c' | 'r';
}

export function spanClassName(colspan: number, rowspan: number, align: string): string {
  const columns = Math.min(MAX_COLUMN_REPEAT, Math.max(1, Math.round(colspan) || 1));
  const rows = Math.min(MAX_COLUMN_REPEAT, Math.max(1, Math.round(rowspan) || 1));
  const side = /r/i.test(align) && !/c/i.test(align) ? 'r' : /l/i.test(align) ? 'l' : 'c';
  return `silk-span-c${columns}-r${rows}-${side}`;
}

export function parseSpanClass(className: string): TableCellSpan | undefined {
  const match = SPAN_CLASS.exec(className.trim());
  if (!match) return undefined;
  return {
    colspan: Number(match[1]),
    rowspan: Number(match[2]),
    align: match[3] as 'l' | 'c' | 'r',
  };
}

function wrapSpan(colspan: number, rowspan: number, align: string, inner: string): string {
  const trimmed = inner.trim();
  const nested = /^\\class\{(silk-span-c\d+-r\d+-[lcr])\}\{([\s\S]*)\}$/.exec(trimmed);
  if (nested?.[1] && nested[2] !== undefined) {
    const previous = parseSpanClass(nested[1]);
    if (previous) {
      return wrapSpan(
        Math.max(colspan, previous.colspan),
        Math.max(rowspan, previous.rowspan),
        align || previous.align,
        nested[2],
      );
    }
  }
  return `\\class{${spanClassName(colspan, rowspan, align)}}{${inner}}`;
}

function rewriteSpanCommand(text: string, cursor: number, name: string): { readonly out: string; readonly end: number } | undefined {
  if (name === 'multicolumn') {
    let scan = skipSpace(text, cursor + 1 + name.length);
    const count = readGroup(text, scan);
    const spec = count ? readGroup(text, skipSpace(text, count.end)) : undefined;
    const content = spec ? readGroup(text, skipSpace(text, spec.end)) : undefined;
    if (!count || !spec || !content) return undefined;
    const span = Math.min(MAX_COLUMN_REPEAT, Math.max(1, Number.parseInt(count.content, 10) || 1));
    const inner = rewriteTableCommands(content.content);
    return { out: `${wrapSpan(span, 1, spec.content, inner)}${'&'.repeat(span - 1)}`, end: content.end };
  }
  if (name === 'multirow' || name === 'multirowcell' || name === 'multirowhead') {
    let scan = skipSpace(text, cursor + 1 + name.length);
    const vpos = readOptional(text, scan);
    if (vpos) scan = skipSpace(text, vpos.end);
    const count = readGroup(text, scan);
    if (!count) return undefined;
    scan = skipSpace(text, count.end);
    const width = readGroup(text, scan) ?? readOptional(text, scan);
    if (!width) return undefined;
    scan = skipSpace(text, width.end);
    const bump = readOptional(text, scan);
    if (bump) scan = skipSpace(text, bump.end);
    const content = readGroup(text, scan);
    if (!content) return undefined;
    const rows = Math.min(MAX_COLUMN_REPEAT, Math.max(1, Number.parseInt(count.content, 10) || 1));
    return { out: wrapSpan(1, rows, 'c', rewriteTableCommands(content.content)), end: content.end };
  }
  return undefined;
}

function rewriteTableCommands(text: string): string {
  let rewritten = '';
  let cursor = 0;
  while (cursor < text.length) {
    const name = commandNameAt(text, cursor);
    const span = name === undefined ? undefined : rewriteSpanCommand(text, cursor, name);
    if (span) {
      rewritten += span.out;
      cursor = span.end;
      continue;
    }
    const rule = name === undefined ? undefined : TABLE_COMMAND_RULES[name];
    if (name === undefined || rule === undefined) {
      // 整条控制词一次性拷贝，避免命令名被逐字符扫描时误判。
      const command = /^\\([A-Za-z@]+|[\s\S])/.exec(text.slice(cursor))?.[0];
      if (command !== undefined && !isEscaped(text, cursor)) {
        rewritten += command;
        cursor += command.length;
      } else {
        rewritten += text[cursor];
        cursor += 1;
      }
      continue;
    }
    let scan = skipSpace(text, cursor + 1 + name.length);
    for (let index = 0; index < (rule.optional ?? 0); index += 1) {
      const optional = readOptional(text, scan);
      if (!optional) break;
      scan = skipSpace(text, optional.end);
    }
    if (rule.paren) {
      const paren = readParen(text, scan);
      if (paren) scan = skipSpace(text, paren.end);
    }
    const args: string[] = [];
    let complete = true;
    for (let index = 0; index < rule.required; index += 1) {
      const group = readGroup(text, scan);
      if (!group) {
        complete = false;
        break;
      }
      args.push(group.content);
      scan = index + 1 < rule.required ? skipSpace(text, group.end) : group.end;
    }
    if (!complete) {
      rewritten += text.slice(cursor, cursor + 1 + name.length);
      cursor += 1 + name.length;
      continue;
    }
    rewritten += rule.replace(args);
    cursor = scan;
  }
  return rewritten;
}

/** 按 brace 深度切分，`\\` 与 `&` 只有在顶层才是分隔符。 */
function splitTopLevel(text: string, separator: '\\\\' | '&'): string[] {
  const parts: string[] = [];
  let depth = 0;
  let environmentDepth = 0;
  let start = 0;
  let cursor = 0;
  while (cursor < text.length) {
    if (isEscaped(text, cursor) && !text.startsWith('\\\\', cursor)) {
      cursor += 1;
      continue;
    }
    const character = text[cursor];
    if (character === '{') {
      depth += 1;
      cursor += 1;
      continue;
    }
    if (character === '}') {
      depth = Math.max(0, depth - 1);
      cursor += 1;
      continue;
    }
    // 嵌套环境（矩阵、内层表格、cases 等）里的 `&`/`\\\\` 属于内层对齐。
    const head = environmentHeadAt(text, cursor);
    if (head !== 0 && !text.startsWith('\\\\', cursor)) {
      environmentDepth = Math.max(0, environmentDepth + head);
      cursor += head > 0 ? 6 : 4;
      continue;
    }
    if (depth === 0 && environmentDepth === 0 && separator === '&' && character === '&') {
      parts.push(text.slice(start, cursor));
      cursor += 1;
      start = cursor;
      continue;
    }
    if (depth === 0 && environmentDepth === 0 && separator === '\\\\' && text.startsWith('\\\\', cursor)) {
      parts.push(text.slice(start, cursor));
      cursor += 2;
      if (text[cursor] === '*') cursor += 1;
      const spacing = readOptional(text, cursor);
      if (spacing) cursor = spacing.end;
      start = cursor;
      continue;
    }
    if (character === '\\') {
      cursor += 2;
      continue;
    }
    cursor += 1;
  }
  parts.push(text.slice(start));
  return parts;
}

function wrapText(text: string): string {
  const trimmed = text.trim();
  return trimmed ? `\\text{${ensureCaretInMath(trimmed)}}` : '';
}

/** 把 `\makecell{上\\下}` 这类命令展开成单元格内的纵向 array。 */
function stackCell(content: string, depth: number): string {
  const lines = splitTopLevel(content, '\\\\')
    .map((line) => translateCell(line, depth))
    .filter((line) => line !== '');
  if (lines.length === 0) return '';
  return `\\begin{array}{c}${lines.join('\\\\')}\\end{array}`;
}

function translateCell(text: string, depth: number): string {
  const trimmed = text.trim();
  if (!trimmed) return '';
  if (depth >= MAX_CELL_DEPTH) return wrapText(trimmed);
  let rendered = '';
  let plain = '';
  let cursor = 0;
  while (cursor < trimmed.length) {
    const name = commandNameAt(trimmed, cursor);
    if (name === 'class') {
      let scan = skipSpace(trimmed, cursor + 1 + name.length);
      const className = readGroup(trimmed, scan);
      const body = className ? readGroup(trimmed, skipSpace(trimmed, className.end)) : undefined;
      if (className && body && parseSpanClass(className.content)) {
        rendered += wrapText(plain);
        plain = '';
        rendered += `\\class{${className.content}}{${translateCell(body.content, depth)}}`;
        cursor = body.end;
        continue;
      }
    }
    if (name === TABLE_EMBED_COMMAND) {
      const index = readGroup(trimmed, cursor + 1 + name.length);
      // 写在 `$...$` 里的图形已经处于数学模式，留在原位，不能拆开这对美元符。
      const inMath = (plain.match(/(?<!\\)\$/g)?.length ?? 0) % 2 === 1;
      if (index && /^\d+$/.test(index.content) && !inMath) {
        rendered += wrapText(plain);
        plain = '';
        rendered += trimmed.slice(cursor, index.end);
        cursor = index.end;
        continue;
      }
    }
    if (name === 'begin') {
      const nested = /^\\begin\s*\{([^{}]*)\}/.exec(trimmed.slice(cursor));
      const environment = nested?.[1];
      const end = environment && isTableEnvironment(environment)
        ? environmentSpanEnd(trimmed, cursor, environment)
        : undefined;
      if (nested && environment && end !== undefined) {
        const inner = trimmed.slice(cursor + nested[0].length, end).replace(/\\end\s*\{[^{}]*\}$/, '');
        rendered += wrapText(plain);
        plain = '';
        rendered += buildTableExpression(inner, '', undefined, depth + 1);
        cursor = end;
        continue;
      }
    }
    if (name !== undefined && CELL_STACK_COMMANDS.has(name)) {
      let scan = skipSpace(trimmed, cursor + 1 + name.length);
      for (let index = 0; index < 2; index += 1) {
        const optional = readOptional(trimmed, scan);
        if (!optional) break;
        scan = skipSpace(trimmed, optional.end);
      }
      const group = readGroup(trimmed, scan);
      if (group) {
        rendered += wrapText(plain);
        plain = '';
        rendered += stackCell(group.content, depth + 1);
        cursor = group.end;
        continue;
      }
    }
    const command = trimmed[cursor] === '\\' && !isEscaped(trimmed, cursor)
      ? /^\\([A-Za-z@]+|[\s\S])/.exec(trimmed.slice(cursor))?.[0]
      : undefined;
    if (command !== undefined) {
      plain += command;
      cursor += command.length;
      continue;
    }
    plain += trimmed[cursor];
    cursor += 1;
  }
  return rendered + wrapText(plain);
}

interface TableRow {
  readonly rules: string;
  readonly cells: readonly string[];
}

/** 规则命令可能出现在行首或被写在单元格前，统一提到行首。 */
function hoistRules(text: string): { readonly rules: string; readonly rest: string } {
  let rules = '';
  let rest = '';
  let braceDepth = 0;
  let environmentDepth = 0;
  let cursor = 0;
  // 只提取本层表格的横线；内层表格/单元格分组里的 \\hline 留给它自己。
  while (cursor < text.length) {
    const character = text[cursor];
    if (character === '\\' && !isEscaped(text, cursor)) {
      const head = environmentHeadAt(text, cursor);
      if (head !== 0) environmentDepth = Math.max(0, environmentDepth + head);
      const hline = /^\\hline(?![A-Za-z@])\s*/.exec(text.slice(cursor, cursor + 64));
      if (hline && braceDepth === 0 && environmentDepth === 0) {
        rules += '\\hline ';
        cursor += hline[0].length;
        continue;
      }
      const command = /^\\(?:[A-Za-z@]+|[\s\S])/.exec(text.slice(cursor, cursor + 64))?.[0] ?? '\\';
      rest += command;
      cursor += command.length;
      continue;
    }
    if (character === '{') braceDepth += 1;
    else if (character === '}') braceDepth = Math.max(0, braceDepth - 1);
    rest += character;
    cursor += 1;
  }
  return { rules, rest };
}

function translateRow(text: string, numeric: readonly (string | undefined)[], caretMarker: string): TableRow {
  const { rules, rest } = hoistRules(text);
  // 末尾的换行和横线属于表格边界，不能让光标标记凭空创建一个单元格。
  // 保留 &、文字和公式等真实内容；行内及已声明的空单元格仍显示光标。
  const content = caretMarker && !rest.replace(caretMarker, '').trim() ? '' : rest;
  const cells = splitTopLevel(content, '&').map((cell, column) => {
    return cell.trim() && numeric[column] !== undefined && !/\\class\{silk-span-/.test(cell)
      ? `\\silkSCell{${numeric[column]}}{${cell}}` : translateCell(cell, 0);
  });
  return { rules, cells };
}

/**
 * 把表格环境正文翻译成 `array` 表达式。输入应当已经插好光标标记，
 * 标记在文本单元格里必须自带 `$...$`，由调用方保证。
 */
export function buildTableExpression(
  body: string,
  caretMarker = '',
  embeds?: TableEmbed[],
  depth = 0,
): string {
  if (depth > MAX_CELL_DEPTH) return wrapText(body);
  const preamble = readTablePreamble(body);
  const tableBody = body.slice(preamble.bodyStart);
  const rewritten = rewriteTableCommands(embeds ? extractEmbeds(tableBody, caretMarker, embeds) : tableBody);
  const numeric: Array<string | undefined> = [];
  const alignment = normalizeColumnSpec(preamble.spec, 0, numeric);
  const rows = splitTopLevel(rewritten, '\\\\')
    .map((row, index, all) => translateRow(row, numeric, index === all.length - 1 ? caretMarker : ''))
    .filter((row) => row.rules !== '' || row.cells.some((cell) => cell !== ''));
  const columns = rows.reduce((maximum, row) => Math.max(maximum, row.cells.length), 0);
  const spec = padColumnSpec(alignment, Math.max(1, columns));
  const rendered = rows
    .map((row) => `${row.rules}${row.cells.join('&')}`)
    .join('\\\\');
  return `\\begin{array}{${spec}}${rendered}\\end{array}`;
}

export type ArrayHlinePlace = 'top' | 'inner' | 'bottom';

export interface ArrayHlineBoundary {
  readonly count: number;
  readonly place: ArrayHlinePlace;
  readonly hasContent: boolean;
}

function hlinePlace(index: number, hasContent: boolean): ArrayHlinePlace {
  if (index === 0) return 'top';
  return hasContent ? 'inner' : 'bottom';
}

/**
 * 外层 `array` 每一行开头连续 `\hline` 的条数，以及这条边界在表首/行间/表尾。
 * MathJax 会把同一边界上的第二条 `\hline` 覆盖掉，渲染器靠这个把线拆开。
 */
export function parseArrayHlineBoundaries(expression: string): ArrayHlineBoundary[] {
  const begin = /\\begin\{array\}/.exec(expression);
  if (!begin || begin.index === undefined) return [];
  let cursor = skipSpace(expression, begin.index + begin[0].length);
  const spec = readGroup(expression, cursor);
  if (!spec) return [];
  cursor = spec.end;
  const boundaries: ArrayHlineBoundary[] = [];
  let run = 0;
  let hasContent = false;
  let braceDepth = 0;
  let arrayDepth = 1;
  const flush = (ended: boolean): void => {
    if (!ended && run === 0 && !hasContent && boundaries.length > 0) return;
    boundaries.push({
      count: run,
      place: hlinePlace(boundaries.length, hasContent),
      hasContent,
    });
    run = 0;
    hasContent = false;
  };
  while (cursor < expression.length) {
    if (isEscaped(expression, cursor)) {
      cursor += 1;
      continue;
    }
    if (braceDepth === 0 && expression.startsWith('\\end{array}', cursor)) {
      arrayDepth -= 1;
      if (arrayDepth === 0) {
        flush(true);
        break;
      }
      cursor += '\\end{array}'.length;
      continue;
    }
    if (braceDepth === 0 && expression.startsWith('\\begin{array}', cursor)) {
      arrayDepth += 1;
      cursor += '\\begin{array}'.length;
      continue;
    }
    if (arrayDepth !== 1) {
      cursor += 1;
      continue;
    }
    const character = expression[cursor];
    if (character === '{') {
      braceDepth += 1;
      cursor += 1;
      continue;
    }
    if (character === '}') {
      braceDepth = Math.max(0, braceDepth - 1);
      cursor += 1;
      continue;
    }
    if (
      braceDepth === 0
      && expression.startsWith('\\hline', cursor)
      && !/^[A-Za-z@]/.test(expression[cursor + 6] ?? '')
    ) {
      run += 1;
      cursor += 6;
      continue;
    }
    if (braceDepth === 0 && expression.startsWith('\\\\', cursor)) {
      flush(false);
      cursor += 2;
      if (expression[cursor] === '*') cursor += 1;
      const spacing = readOptional(expression, cursor);
      if (spacing) cursor = spacing.end;
      continue;
    }
    if (character === '\\') {
      hasContent = true;
      cursor += 2;
      continue;
    }
    if (braceDepth === 0 && !/\s/.test(character ?? '')) hasContent = true;
    cursor += 1;
  }
  return boundaries;
}

export function parseArrayHlineCounts(expression: string): number[] {
  return parseArrayHlineBoundaries(expression).map((boundary) => boundary.count);
}

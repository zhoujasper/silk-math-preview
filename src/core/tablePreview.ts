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
const CELL_STACK_COMMANDS: ReadonlySet<string> = new Set(['makecell', 'thead', 'tabincell']);

const MAX_CELL_DEPTH = 3;
const MAX_COLUMN_REPEAT = 64;

export function isTableEnvironment(name: string | undefined): boolean {
  return name !== undefined && TABLE_ENVIRONMENT_SET.has(name);
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
export function normalizeColumnSpec(spec: string, depth = 0): string {
  let normalized = '';
  let cursor = 0;
  while (cursor < spec.length) {
    const character = spec[cursor];
    if (character === undefined) break;
    if (/\s/.test(character)) {
      cursor += 1;
    } else if (character === '|' || character === 'l' || character === 'c' || character === 'r') {
      normalized += character;
      cursor += 1;
    } else if (character === 'p' || character === 'm' || character === 'b') {
      // p/m/b 的宽度参数在预览里没有意义，按左对齐处理。
      normalized += 'l';
      cursor = readGroup(spec, cursor + 1)?.end ?? cursor + 1;
    } else if (character === 'X' || character === 'L' || character === 'J') {
      normalized += 'l';
      cursor += 1;
    } else if (character === 'Y' || character === 'C') {
      normalized += 'c';
      cursor += 1;
    } else if (character === 'R' || character === 'S' || character === 'D') {
      normalized += 'r';
      cursor += 1;
      const argument = readGroup(spec, cursor) ?? readOptional(spec, cursor);
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
        normalized += depth < MAX_CELL_DEPTH
          ? normalizeColumnSpec(repeated.content, depth + 1).repeat(times)
          : 'c'.repeat(times);
        cursor = repeated.end;
      }
    } else if (/[A-Za-z]/.test(character)) {
      // 未知列类型按居中处理，宁可对齐方式不准，也不能少一列让后面全部串位。
      normalized += 'c';
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
  small: { required: 0, replace: DROP },
  footnotesize: { required: 0, replace: DROP },
  scriptsize: { required: 0, replace: DROP },
  tiny: { required: 0, replace: DROP },
  normalsize: { required: 0, replace: DROP },
  tabularnewline: { required: 0, replace: () => '\\\\' },
  multicolumn: {
    required: 3,
    replace: (args) => {
      const span = Math.min(MAX_COLUMN_REPEAT, Math.max(1, Number.parseInt(args[0] ?? '1', 10) || 1));
      return `${args[2] ?? ''}${'&'.repeat(span - 1)}`;
    },
  },
  multirow: { optional: 2, required: 3, replace: (args) => args[2] ?? '' },
});

function rewriteTableCommands(text: string): string {
  let rewritten = '';
  let cursor = 0;
  while (cursor < text.length) {
    const name = commandNameAt(text, cursor);
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
    if (depth === 0 && separator === '&' && character === '&') {
      parts.push(text.slice(start, cursor));
      cursor += 1;
      start = cursor;
      continue;
    }
    if (depth === 0 && separator === '\\\\' && text.startsWith('\\\\', cursor)) {
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
  return trimmed ? `\\text{${trimmed}}` : '';
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
  const rest = text.replace(/\\hline\b\s*/g, () => {
    rules += '\\hline ';
    return '';
  });
  return { rules, rest };
}

function translateRow(text: string): TableRow {
  let rules = '';
  const cells = splitTopLevel(text, '&').map((raw) => {
    const hoisted = hoistRules(raw);
    rules += hoisted.rules;
    return translateCell(hoisted.rest, 0);
  });
  return { rules, cells };
}

/**
 * 把表格环境正文翻译成 `array` 表达式。输入应当已经插好光标标记，
 * 标记在文本单元格里必须自带 `$...$`，由调用方保证。
 */
export function buildTableExpression(body: string): string {
  const preamble = readTablePreamble(body);
  const rewritten = rewriteTableCommands(body.slice(preamble.bodyStart));
  const rows = splitTopLevel(rewritten, '\\\\')
    .map(translateRow)
    .filter((row) => row.rules !== '' || row.cells.some((cell) => cell !== ''));
  const columns = rows.reduce((maximum, row) => Math.max(maximum, row.cells.length), 0);
  const spec = padColumnSpec(normalizeColumnSpec(preamble.spec), Math.max(1, columns));
  const rendered = rows
    .map((row) => `${row.rules}${row.cells.join('&')}`)
    .join('\\\\');
  return `\\begin{array}{${spec}}${rendered}\\end{array}`;
}

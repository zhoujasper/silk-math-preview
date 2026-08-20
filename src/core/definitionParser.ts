export type DefinitionKind = 'command' | 'environment' | 'color';

export type DefinitionDeclaration =
  | 'declare-math-alphabet'
  | 'definecolor'
  | 'colorlet'
  | 'newcommand'
  | 'renewcommand'
  | 'providecommand'
  | 'def'
  | 'declare-math-operator'
  | 'newenvironment'
  | 'renewenvironment'
  | 'new-document-command'
  | 'renew-document-command'
  | 'provide-document-command'
  | 'declare-document-command'
  | 'new-document-environment'
  | 'renew-document-environment'
  | 'provide-document-environment'
  | 'declare-document-environment';

export type DefinitionOperation = 'new' | 'renew' | 'provide' | 'replace';
export type DefinitionExpandability = 'expandable' | 'recognized-limited';

export interface DefinitionArgument {
  readonly index: number;
  readonly kind: 'mandatory' | 'optional';
  readonly defaultValue?: string;
}

export interface DefinitionSource {
  readonly id: string;
  readonly startOffset: number;
  readonly endOffset: number;
  readonly line: number;
  readonly column: number;
}

export interface ParsedDefinition {
  readonly kind: DefinitionKind;
  readonly name: string;
  readonly declaration: DefinitionDeclaration;
  readonly operation: DefinitionOperation;
  readonly arguments: readonly DefinitionArgument[];
  readonly expandability: DefinitionExpandability;
  readonly limitations: readonly string[];
  readonly source: DefinitionSource;
  readonly starred: boolean;
  readonly replacement?: string;
  readonly beginReplacement?: string;
  readonly endReplacement?: string;
}

export interface TeXGroup {
  readonly content: string;
  readonly start: number;
  readonly end: number;
}

interface ParsedAtOffset {
  readonly definition?: ParsedDefinition;
  readonly end: number;
}

interface CommandName {
  readonly name: string;
  readonly end: number;
}

interface XparseSpec {
  readonly arguments: readonly DefinitionArgument[];
  readonly limitations: readonly string[];
}

const DYNAMIC_PRIMITIVE = /\\(?:catcode|csname|endcsname|if|ifx|ifnum|ifdim|ifdefined|ifcsname|else|fi|loop|repeat|futurelet|expandafter|write|write18|read|openin|openout|directlua|luaexec|ExplSyntaxOn|ExplSyntaxOff)\b/;
const EXTERNAL_INPUT = /\\(?:input|include|usepackage|RequirePackage)\b/;

const COMMAND_DECLARATIONS: Readonly<Record<string, {
  declaration: DefinitionDeclaration;
  operation: DefinitionOperation;
}>> = {
  newcommand: { declaration: 'newcommand', operation: 'new' },
  renewcommand: { declaration: 'renewcommand', operation: 'renew' },
  providecommand: { declaration: 'providecommand', operation: 'provide' },
};

const ENVIRONMENT_DECLARATIONS: Readonly<Record<string, {
  declaration: DefinitionDeclaration;
  operation: DefinitionOperation;
}>> = {
  newenvironment: { declaration: 'newenvironment', operation: 'new' },
  renewenvironment: { declaration: 'renewenvironment', operation: 'renew' },
};

const XPARSE_COMMAND_DECLARATIONS: Readonly<Record<string, {
  declaration: DefinitionDeclaration;
  operation: DefinitionOperation;
}>> = {
  NewDocumentCommand: { declaration: 'new-document-command', operation: 'new' },
  RenewDocumentCommand: { declaration: 'renew-document-command', operation: 'renew' },
  ProvideDocumentCommand: { declaration: 'provide-document-command', operation: 'provide' },
  DeclareDocumentCommand: { declaration: 'declare-document-command', operation: 'replace' },
};

const XPARSE_ENVIRONMENT_DECLARATIONS: Readonly<Record<string, {
  declaration: DefinitionDeclaration;
  operation: DefinitionOperation;
}>> = {
  NewDocumentEnvironment: { declaration: 'new-document-environment', operation: 'new' },
  RenewDocumentEnvironment: { declaration: 'renew-document-environment', operation: 'renew' },
  ProvideDocumentEnvironment: { declaration: 'provide-document-environment', operation: 'provide' },
  DeclareDocumentEnvironment: { declaration: 'declare-document-environment', operation: 'replace' },
};

/**
 * 用空格遮蔽 TeX 注释，同时保留长度与换行，保证返回的 offset 仍指向原文。
 */
export function maskTeXComments(text: string): string {
  // split('') 保持 UTF-16 code unit 数量，VS Code offset 才不会在 emoji 后漂移。
  const chars = text.split('');
  for (let index = 0; index < chars.length; index += 1) {
    if (chars[index] !== '%' || isEscaped(text, index)) {
      continue;
    }
    while (index < chars.length && chars[index] !== '\n' && chars[index] !== '\r') {
      chars[index] = ' ';
      index += 1;
    }
  }
  return chars.join('');
}

/** 读取支持嵌套和转义字符的 TeX 分组，end 为右分隔符后一位。 */
export function readTeXGroup(
  text: string,
  offset: number,
  open = '{',
  close = '}',
): TeXGroup | undefined {
  if (text[offset] !== open) {
    return undefined;
  }

  let depth = 1;
  let braceDepth = 0;
  for (let index = offset + 1; index < text.length; index += 1) {
    const character = text[index];
    if (character === '\\') {
      index += 1;
      continue;
    }
    if (open !== '{') {
      if (character === '{') {
        braceDepth += 1;
        continue;
      }
      if (character === '}' && braceDepth > 0) {
        braceDepth -= 1;
        continue;
      }
    }
    if (braceDepth === 0 && character === open) {
      depth += 1;
    } else if (braceDepth === 0 && character === close) {
      depth -= 1;
      if (depth === 0) {
        return {
          content: text.slice(offset + 1, index),
          start: offset,
          end: index + 1,
        };
      }
    }
  }
  return undefined;
}

export function skipTeXWhitespace(text: string, offset: number): number {
  let index = offset;
  while (index < text.length && /\s/.test(text[index] ?? '')) {
    index += 1;
  }
  return index;
}

/** 解析常见声明式命令和环境；不会执行条件、catcode、expl3 或 LuaTeX。 */
export function parseDefinitions(text: string, sourceId = '<memory>'): readonly ParsedDefinition[] {
  const masked = maskTeXComments(text);
  const lineStarts = collectLineStarts(text);
  const definitions: ParsedDefinition[] = [];

  for (let offset = 0; offset < masked.length;) {
    if (masked[offset] !== '\\') {
      offset += 1;
      continue;
    }

    const control = readControlSequence(masked, offset);
    if (!control) {
      offset += 1;
      continue;
    }

    let parsed: ParsedAtOffset | undefined;
    const commandDeclaration = COMMAND_DECLARATIONS[control.name];
    const environmentDeclaration = ENVIRONMENT_DECLARATIONS[control.name];
    const xparseCommand = XPARSE_COMMAND_DECLARATIONS[control.name];
    const xparseEnvironment = XPARSE_ENVIRONMENT_DECLARATIONS[control.name];

    if (commandDeclaration) {
      parsed = parseLatexCommand(masked, sourceId, lineStarts, offset, control.end, commandDeclaration);
    } else if (control.name === 'DeclareMathAlphabet' || control.name === 'DeclareSymbolFontAlphabet') {
      parsed = parseMathAlphabet(masked, sourceId, lineStarts, offset, control.end, control.name);
    } else if (COLOR_DECLARATIONS[control.name]) {
      parsed = parseColorDefinition(masked, sourceId, lineStarts, offset, control.end, control.name);
    } else if (control.name === 'def') {
      parsed = parseDef(masked, sourceId, lineStarts, offset, control.end);
    } else if (control.name === 'DeclareMathOperator') {
      parsed = parseMathOperator(masked, sourceId, lineStarts, offset, control.end);
    } else if (environmentDeclaration) {
      parsed = parseLatexEnvironment(masked, sourceId, lineStarts, offset, control.end, environmentDeclaration);
    } else if (xparseCommand) {
      parsed = parseXparseCommand(masked, sourceId, lineStarts, offset, control.end, xparseCommand);
    } else if (xparseEnvironment) {
      parsed = parseXparseEnvironment(masked, sourceId, lineStarts, offset, control.end, xparseEnvironment);
    }

    if (parsed) {
      if (parsed.definition) {
        definitions.push(parsed.definition);
      }
      offset = Math.max(parsed.end, control.end);
    } else {
      offset = control.end;
    }
  }

  return definitions;
}

function parseLatexCommand(
  text: string,
  sourceId: string,
  lineStarts: readonly number[],
  start: number,
  afterKeyword: number,
  metadata: { declaration: DefinitionDeclaration; operation: DefinitionOperation },
): ParsedAtOffset {
  const starredResult = readOptionalStar(text, afterKeyword);
  const commandName = readCommandNameArgument(text, starredResult.end);
  if (!commandName) {
    return { end: statementEnd(text, afterKeyword) };
  }

  const limitations: string[] = [];
  let cursor = skipTeXWhitespace(text, commandName.end);
  const countGroup = readTeXGroup(text, cursor, '[', ']');
  let argumentCount = 0;
  let defaultValue: string | undefined;
  if (countGroup) {
    cursor = skipTeXWhitespace(text, countGroup.end);
    if (/^[0-9]$/.test(countGroup.content.trim())) {
      argumentCount = Number.parseInt(countGroup.content.trim(), 10);
    } else {
      limitations.push('invalid-argument-count');
    }
    const defaultGroup = readTeXGroup(text, cursor, '[', ']');
    if (defaultGroup) {
      defaultValue = defaultGroup.content;
      cursor = skipTeXWhitespace(text, defaultGroup.end);
      if (argumentCount < 1) {
        limitations.push('default-without-argument');
      }
    }
  }

  const body = readTeXGroup(text, cursor);
  if (!body) {
    limitations.push('missing-or-unbalanced-replacement');
  } else {
    limitations.push(...analyzeReplacement(body.content, argumentCount));
    cursor = body.end;
  }

  const definition = buildDefinition({
    kind: 'command',
    name: commandName.name,
    declaration: metadata.declaration,
    operation: metadata.operation,
    arguments: buildLatexArguments(argumentCount, defaultValue),
    limitations,
    sourceId,
    lineStarts,
    start,
    end: body?.end ?? statementEnd(text, cursor),
    starred: starredResult.starred,
    ...(body ? { replacement: body.content } : {}),
  });
  return { definition, end: definition.source.endOffset };
}

function parseDef(
  text: string,
  sourceId: string,
  lineStarts: readonly number[],
  start: number,
  afterKeyword: number,
): ParsedAtOffset {
  const commandName = readDirectCommandName(text, skipTeXWhitespace(text, afterKeyword));
  if (!commandName) {
    return { end: statementEnd(text, afterKeyword) };
  }

  const limitations: string[] = [];
  const bodyStart = findUnescaped(text, commandName.end, '{');
  if (bodyStart < 0) {
    limitations.push('missing-or-unbalanced-replacement');
    const definition = buildDefinition({
      kind: 'command',
      name: commandName.name,
      declaration: 'def',
      operation: 'replace',
      arguments: [],
      limitations,
      sourceId,
      lineStarts,
      start,
      end: statementEnd(text, commandName.end),
      starred: false,
    });
    return { definition, end: definition.source.endOffset };
  }

  const parameterText = text.slice(commandName.end, bodyStart);
  const parameterResult = parseDefParameters(parameterText);
  limitations.push(...parameterResult.limitations);
  const body = readTeXGroup(text, bodyStart);
  if (!body) {
    limitations.push('missing-or-unbalanced-replacement');
  } else {
    limitations.push(...analyzeReplacement(body.content, parameterResult.arguments.length));
  }

  const definition = buildDefinition({
    kind: 'command',
    name: commandName.name,
    declaration: 'def',
    operation: 'replace',
    arguments: parameterResult.arguments,
    limitations,
    sourceId,
    lineStarts,
    start,
    end: body?.end ?? statementEnd(text, bodyStart),
    starred: false,
    ...(body ? { replacement: body.content } : {}),
  });
  return { definition, end: definition.source.endOffset };
}

/**
 * 判断环境的 begin 部分是否让 TeX 停在数学模式。
 * `\newenvironment{proofmath}{\begin{aligned}}{\end{aligned}}` 是数学环境，
 * 而 `\newenvironment{solution}...{\begin{proof}[#1]}` 只是普通文本环境——
 * 后者一旦被当成公式区域，整段解答（含正文）都会被当作一条公式，里面真正的
 * `\[...\]` 反而全部预览不出来。
 */
export function environmentEntersMathMode(beginReplacement: string | undefined): boolean {
  if (!beginReplacement) return false;
  const text = maskTeXComments(beginReplacement);
  let inlineMath = false;
  let displayMath = false;
  let bracket = 0;
  let paren = 0;
  const environments: string[] = [];
  for (let cursor = 0; cursor < text.length; cursor += 1) {
    const character = text[cursor];
    if (character === '\\') {
      const next = text[cursor + 1];
      if (next === '[') { bracket += 1; cursor += 1; continue; }
      if (next === ']') { bracket = Math.max(0, bracket - 1); cursor += 1; continue; }
      if (next === '(') { paren += 1; cursor += 1; continue; }
      if (next === ')') { paren = Math.max(0, paren - 1); cursor += 1; continue; }
      const environment = /^\\(begin|end)[ \t]*\{([^{}\r\n]*)\}/.exec(text.slice(cursor));
      const name = environment?.[2]?.replace(/\*$/, '');
      if (environment && name !== undefined && MATH_ENVIRONMENT_NAMES.has(name)) {
        if (environment[1] === 'begin') environments.push(name);
        else environments.pop();
        cursor += environment[0].length - 1;
        continue;
      }
      cursor += 1;
      continue;
    }
    if (character === '$') {
      if (text[cursor + 1] === '$') {
        displayMath = !displayMath;
        cursor += 1;
      } else {
        inlineMath = !inlineMath;
      }
    }
  }
  return inlineMath || displayMath || bracket > 0 || paren > 0 || environments.length > 0;
}

const MATH_ENVIRONMENT_NAMES: ReadonlySet<string> = new Set([
  'equation', 'align', 'alignat', 'aligned', 'alignedat', 'gather', 'gathered',
  'multline', 'flalign', 'split', 'displaymath', 'math', 'eqnarray', 'array',
  'matrix', 'pmatrix', 'bmatrix', 'Bmatrix', 'vmatrix', 'Vmatrix', 'smallmatrix',
  'cases', 'dcases', 'subequations', 'IEEEeqnarray',
]);

/**
 * xcolor 的 `\definecolor{名字}{模型}{取值}`。MathJax 的 color 扩展只认
 * `rgb`/`RGB`/`gray`/`named`，`HTML`、`cmyk` 这些会在 prelude 转换时直接抛错并
 * 污染整个渲染上下文，所以在解析阶段就统一折算成 0~1 的 rgb。
 */
const COLOR_DECLARATIONS: Readonly<Record<string, DefinitionOperation | undefined>> = {
  definecolor: 'new',
  providecolor: 'provide',
  colorlet: 'new',
};

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

function formatRgb(red: number, green: number, blue: number): string {
  return [red, green, blue]
    .map((channel) => Number(clamp01(channel).toFixed(4)).toString())
    .join(',');
}

/** 返回 MathJax 可直接使用的 `{rgb}{r,g,b}` 取值；无法安全折算时返回 undefined。 */
export function normalizeColorSpecification(model: string, value: string): string | undefined {
  const spec = value.trim();
  const numbers = spec.split(',').map((part) => Number(part.trim()));
  switch (model.trim()) {
    case 'rgb': {
      if (numbers.length !== 3 || numbers.some((channel) => !Number.isFinite(channel))) return undefined;
      return formatRgb(numbers[0] ?? 0, numbers[1] ?? 0, numbers[2] ?? 0);
    }
    case 'RGB': {
      if (numbers.length !== 3 || numbers.some((channel) => !Number.isFinite(channel))) return undefined;
      return formatRgb((numbers[0] ?? 0) / 255, (numbers[1] ?? 0) / 255, (numbers[2] ?? 0) / 255);
    }
    case 'HTML': {
      const hex = /^#?([0-9a-fA-F]{6})$/.exec(spec)?.[1];
      if (!hex) return undefined;
      return formatRgb(
        Number.parseInt(hex.slice(0, 2), 16) / 255,
        Number.parseInt(hex.slice(2, 4), 16) / 255,
        Number.parseInt(hex.slice(4, 6), 16) / 255,
      );
    }
    case 'gray': {
      const level = numbers[0];
      if (numbers.length !== 1 || level === undefined || !Number.isFinite(level)) return undefined;
      return formatRgb(level, level, level);
    }
    case 'cmyk': {
      if (numbers.length !== 4 || numbers.some((channel) => !Number.isFinite(channel))) return undefined;
      const [cyan = 0, magenta = 0, yellow = 0, black = 0] = numbers;
      return formatRgb(
        (1 - clamp01(cyan)) * (1 - clamp01(black)),
        (1 - clamp01(magenta)) * (1 - clamp01(black)),
        (1 - clamp01(yellow)) * (1 - clamp01(black)),
      );
    }
    default:
      return undefined;
  }
}

function parseColorDefinition(
  text: string,
  sourceId: string,
  lineStarts: readonly number[],
  start: number,
  afterKeyword: number,
  keyword: string,
): ParsedAtOffset {
  // `\definecolor[ps]{...}` 的可选参数只影响驱动，预览用不到。
  let cursor = skipTeXWhitespace(text, afterKeyword);
  if (text[cursor] === '[') {
    const optional = readTeXGroup(text, cursor, '[', ']');
    cursor = optional ? skipTeXWhitespace(text, optional.end) : cursor;
  }
  const name = readTeXGroup(text, cursor);
  if (!name) return { end: statementEnd(text, afterKeyword) };
  const second = readTeXGroup(text, skipTeXWhitespace(text, name.end));
  if (!second) return { end: statementEnd(text, name.end) };

  if (keyword === 'colorlet') {
    // `\colorlet{A}{B}` 只在 B 是纯颜色名时可以安全转写；带 `!` 混色的不处理。
    const target = second.content.trim();
    const limitations = /^[A-Za-z@][\w@-]*$/.test(target) ? [] : ['unsupported-color-expression'];
    const definition = buildDefinition({
      kind: 'color',
      name: name.content.trim(),
      declaration: 'colorlet',
      operation: 'new',
      arguments: [],
      limitations,
      sourceId,
      lineStarts,
      start,
      end: second.end,
      starred: false,
      ...(limitations.length === 0 ? { replacement: `named:${target}` } : {}),
    });
    return { definition, end: definition.source.endOffset };
  }

  const third = readTeXGroup(text, skipTeXWhitespace(text, second.end));
  if (!third) return { end: statementEnd(text, second.end) };
  const normalized = normalizeColorSpecification(second.content, third.content);
  const limitations = normalized === undefined
    ? [`unsupported-color-model:${second.content.trim()}`]
    : [];
  const definition = buildDefinition({
    kind: 'color',
    name: name.content.trim(),
    declaration: 'definecolor',
    operation: COLOR_DECLARATIONS[keyword] ?? 'new',
    arguments: [],
    limitations,
    sourceId,
    lineStarts,
    start,
    end: third.end,
    starred: false,
    ...(normalized === undefined ? {} : { replacement: `rgb:${normalized}` }),
  });
  return { definition, end: definition.source.endOffset };
}

/**
 * `\DeclareMathAlphabet{\CMcal}{OMS}{cmsy}{m}{n}` 声明的是字体族，MathJax 没有对应实现。
 * 预览按字体族折算成最接近的 `\mathXX`，否则所有 `\newcommand{\Ocal}{\CMcal{O}}`
 * 这样的宏都会因为 `\CMcal` 未定义而整条公式渲染失败。
 */
const MATH_ALPHABET_FAMILIES: ReadonlyArray<readonly [RegExp, string]> = [
  [/^(?:cmsy|rsfs|rsfso|eusm|eus)/i, 'mathcal'],
  [/^(?:eufm|euf|eufb)/i, 'mathfrak'],
  [/^(?:msbm|bbold|dsrom|bbm)/i, 'mathbb'],
  [/^(?:cmtt|txtt|cmvtt)/i, 'mathtt'],
  [/^(?:cmss|txss)/i, 'mathsf'],
  [/^(?:cmmi|mathit)/i, 'mathit'],
];

function mathAlphabetCommand(family: string, encoding: string): string {
  if (/^OMS$/i.test(encoding.trim())) return 'mathcal';
  for (const [pattern, command] of MATH_ALPHABET_FAMILIES) {
    if (pattern.test(family.trim())) return command;
  }
  return 'mathrm';
}

function parseMathAlphabet(
  text: string,
  sourceId: string,
  lineStarts: readonly number[],
  start: number,
  afterKeyword: number,
  keyword: string,
): ParsedAtOffset {
  const commandName = readCommandNameArgument(text, skipTeXWhitespace(text, afterKeyword));
  if (!commandName) return { end: statementEnd(text, afterKeyword) };
  const encoding = readTeXGroup(text, skipTeXWhitespace(text, commandName.end));
  const family = encoding ? readTeXGroup(text, skipTeXWhitespace(text, encoding.end)) : undefined;
  if (!encoding || !family) return { end: statementEnd(text, commandName.end) };
  let cursor = family.end;
  // `\DeclareMathAlphabet` 还有 series/shape 两个参数，预览用不到但要跳过。
  for (let index = 0; index < 2 && keyword === 'DeclareMathAlphabet'; index += 1) {
    const group = readTeXGroup(text, skipTeXWhitespace(text, cursor));
    if (!group) break;
    cursor = group.end;
  }
  const definition = buildDefinition({
    kind: 'command',
    name: commandName.name,
    declaration: 'declare-math-alphabet',
    operation: 'new',
    arguments: [{ index: 1, kind: 'mandatory' }],
    limitations: [],
    sourceId,
    lineStarts,
    start,
    end: cursor,
    starred: false,
    replacement: `\\${mathAlphabetCommand(family.content, encoding.content)}{#1}`,
  });
  return { definition, end: definition.source.endOffset };
}

function parseMathOperator(
  text: string,
  sourceId: string,
  lineStarts: readonly number[],
  start: number,
  afterKeyword: number,
): ParsedAtOffset {
  const starredResult = readOptionalStar(text, afterKeyword);
  const commandName = readCommandNameArgument(text, starredResult.end);
  if (!commandName) {
    return { end: statementEnd(text, afterKeyword) };
  }
  const body = readTeXGroup(text, skipTeXWhitespace(text, commandName.end));
  const limitations = body ? analyzeReplacement(body.content, 0) : ['missing-or-unbalanced-replacement'];
  const operator = starredResult.starred ? '\\operatorname*' : '\\operatorname';
  const definition = buildDefinition({
    kind: 'command',
    name: commandName.name,
    declaration: 'declare-math-operator',
    operation: 'new',
    arguments: [],
    limitations,
    sourceId,
    lineStarts,
    start,
    end: body?.end ?? statementEnd(text, commandName.end),
    starred: starredResult.starred,
    ...(body ? { replacement: `${operator}{${body.content}}` } : {}),
  });
  return { definition, end: definition.source.endOffset };
}

function parseLatexEnvironment(
  text: string,
  sourceId: string,
  lineStarts: readonly number[],
  start: number,
  afterKeyword: number,
  metadata: { declaration: DefinitionDeclaration; operation: DefinitionOperation },
): ParsedAtOffset {
  const starredResult = readOptionalStar(text, afterKeyword);
  const nameGroup = readTeXGroup(text, skipTeXWhitespace(text, starredResult.end));
  if (!nameGroup) {
    return { end: statementEnd(text, afterKeyword) };
  }
  const name = nameGroup.content.trim();
  if (!isLiteralEnvironmentName(name)) {
    return { end: nameGroup.end };
  }

  const limitations: string[] = [];
  let cursor = skipTeXWhitespace(text, nameGroup.end);
  const countGroup = readTeXGroup(text, cursor, '[', ']');
  let argumentCount = 0;
  let defaultValue: string | undefined;
  if (countGroup) {
    cursor = skipTeXWhitespace(text, countGroup.end);
    if (/^[0-9]$/.test(countGroup.content.trim())) {
      argumentCount = Number.parseInt(countGroup.content.trim(), 10);
    } else {
      limitations.push('invalid-argument-count');
    }
    const defaultGroup = readTeXGroup(text, cursor, '[', ']');
    if (defaultGroup) {
      defaultValue = defaultGroup.content;
      cursor = skipTeXWhitespace(text, defaultGroup.end);
      if (argumentCount < 1) {
        limitations.push('default-without-argument');
      }
    }
  }

  const begin = readTeXGroup(text, cursor);
  if (begin) {
    cursor = skipTeXWhitespace(text, begin.end);
  }
  const end = begin ? readTeXGroup(text, cursor) : undefined;
  if (!begin || !end) {
    limitations.push('missing-or-unbalanced-environment-body');
  }
  if (begin) {
    limitations.push(...analyzeReplacement(begin.content, argumentCount));
  }
  if (end) {
    limitations.push(...analyzeReplacement(end.content, argumentCount));
  }

  const definition = buildDefinition({
    kind: 'environment',
    name,
    declaration: metadata.declaration,
    operation: metadata.operation,
    arguments: buildLatexArguments(argumentCount, defaultValue),
    limitations,
    sourceId,
    lineStarts,
    start,
    end: end?.end ?? begin?.end ?? statementEnd(text, cursor),
    starred: starredResult.starred,
    ...(begin ? { beginReplacement: begin.content } : {}),
    ...(end ? { endReplacement: end.content } : {}),
  });
  return { definition, end: definition.source.endOffset };
}

function parseXparseCommand(
  text: string,
  sourceId: string,
  lineStarts: readonly number[],
  start: number,
  afterKeyword: number,
  metadata: { declaration: DefinitionDeclaration; operation: DefinitionOperation },
): ParsedAtOffset {
  const commandName = readCommandNameArgument(text, afterKeyword);
  if (!commandName) {
    return { end: statementEnd(text, afterKeyword) };
  }
  const specGroup = readTeXGroup(text, skipTeXWhitespace(text, commandName.end));
  const limitations: string[] = [];
  const spec = specGroup ? parseXparseSpec(specGroup.content) : { arguments: [], limitations: ['missing-xparse-spec'] };
  limitations.push(...spec.limitations);
  const body = specGroup ? readTeXGroup(text, skipTeXWhitespace(text, specGroup.end)) : undefined;
  if (!body) {
    limitations.push('missing-or-unbalanced-replacement');
  } else {
    limitations.push(...analyzeReplacement(body.content, spec.arguments.length));
  }

  const definition = buildDefinition({
    kind: 'command',
    name: commandName.name,
    declaration: metadata.declaration,
    operation: metadata.operation,
    arguments: spec.arguments,
    limitations,
    sourceId,
    lineStarts,
    start,
    end: body?.end ?? specGroup?.end ?? statementEnd(text, commandName.end),
    starred: false,
    ...(body ? { replacement: body.content } : {}),
  });
  return { definition, end: definition.source.endOffset };
}

function parseXparseEnvironment(
  text: string,
  sourceId: string,
  lineStarts: readonly number[],
  start: number,
  afterKeyword: number,
  metadata: { declaration: DefinitionDeclaration; operation: DefinitionOperation },
): ParsedAtOffset {
  const nameGroup = readTeXGroup(text, skipTeXWhitespace(text, afterKeyword));
  if (!nameGroup) {
    return { end: statementEnd(text, afterKeyword) };
  }
  const name = nameGroup.content.trim();
  if (!isLiteralEnvironmentName(name)) {
    return { end: nameGroup.end };
  }
  const specGroup = readTeXGroup(text, skipTeXWhitespace(text, nameGroup.end));
  const limitations: string[] = [];
  const spec = specGroup ? parseXparseSpec(specGroup.content) : { arguments: [], limitations: ['missing-xparse-spec'] };
  limitations.push(...spec.limitations);
  const begin = specGroup ? readTeXGroup(text, skipTeXWhitespace(text, specGroup.end)) : undefined;
  const end = begin ? readTeXGroup(text, skipTeXWhitespace(text, begin.end)) : undefined;
  if (!begin || !end) {
    limitations.push('missing-or-unbalanced-environment-body');
  }
  if (begin) {
    limitations.push(...analyzeReplacement(begin.content, spec.arguments.length));
  }
  if (end) {
    limitations.push(...analyzeReplacement(end.content, spec.arguments.length));
  }

  const definition = buildDefinition({
    kind: 'environment',
    name,
    declaration: metadata.declaration,
    operation: metadata.operation,
    arguments: spec.arguments,
    limitations,
    sourceId,
    lineStarts,
    start,
    end: end?.end ?? begin?.end ?? specGroup?.end ?? statementEnd(text, nameGroup.end),
    starred: false,
    ...(begin ? { beginReplacement: begin.content } : {}),
    ...(end ? { endReplacement: end.content } : {}),
  });
  return { definition, end: definition.source.endOffset };
}

function parseXparseSpec(spec: string): XparseSpec {
  const argumentsList: DefinitionArgument[] = [];
  const limitations: string[] = [];
  let cursor = 0;
  while (cursor < spec.length) {
    cursor = skipTeXWhitespace(spec, cursor);
    const token = spec[cursor];
    if (!token) {
      break;
    }
    if (token === 'm') {
      argumentsList.push({ index: argumentsList.length + 1, kind: 'mandatory' });
      cursor += 1;
      continue;
    }
    if (token === 'o') {
      argumentsList.push({ index: argumentsList.length + 1, kind: 'optional' });
      cursor += 1;
      continue;
    }
    if (token === 'O') {
      const defaultGroup = readTeXGroup(spec, skipTeXWhitespace(spec, cursor + 1));
      if (defaultGroup) {
        argumentsList.push({
          index: argumentsList.length + 1,
          kind: 'optional',
          defaultValue: defaultGroup.content,
        });
        cursor = defaultGroup.end;
      } else {
        limitations.push('malformed-xparse-O-argument');
        cursor += 1;
      }
      continue;
    }

    limitations.push(`unsupported-xparse-argument:${token}`);
    cursor += 1;
    if ((token === '>' || token === '<') && spec[cursor] === '{') {
      cursor = readTeXGroup(spec, cursor)?.end ?? cursor;
    }
  }
  return { arguments: argumentsList, limitations: unique(limitations) };
}

function parseDefParameters(parameterText: string): XparseSpec {
  const matches = [...parameterText.matchAll(/#([1-9])/g)];
  const argumentsList = matches.map((match, index): DefinitionArgument => ({
    index: Number.parseInt(match[1] ?? String(index + 1), 10),
    kind: 'mandatory',
  }));
  const expected = argumentsList.map((_, index) => `#${index + 1}`).join('');
  const compact = parameterText.replace(/\s+/g, '');
  const sequential = argumentsList.every((argument, index) => argument.index === index + 1);
  const limitations: string[] = [];
  if (compact !== expected || !sequential) {
    limitations.push('delimited-or-nonsequential-def-parameters');
  }
  return { arguments: argumentsList, limitations };
}

function analyzeReplacement(replacement: string, argumentCount: number): readonly string[] {
  const limitations: string[] = [];
  if (DYNAMIC_PRIMITIVE.test(replacement)) {
    limitations.push('dynamic-tex-control-flow');
  }
  if (EXTERNAL_INPUT.test(replacement)) {
    limitations.push('external-input-in-expansion');
  }
  for (const match of replacement.matchAll(/#(.)/g)) {
    const marker = match[1] ?? '';
    if (!/[1-9]/.test(marker) || Number.parseInt(marker, 10) > argumentCount) {
      limitations.push('invalid-parameter-reference');
      break;
    }
  }
  return unique(limitations);
}

function buildLatexArguments(argumentCount: number, defaultValue?: string): readonly DefinitionArgument[] {
  const argumentsList: DefinitionArgument[] = [];
  for (let index = 1; index <= argumentCount; index += 1) {
    if (index === 1 && defaultValue !== undefined) {
      argumentsList.push({ index, kind: 'optional', defaultValue });
    } else {
      argumentsList.push({ index, kind: 'mandatory' });
    }
  }
  return argumentsList;
}

function buildDefinition(input: {
  kind: DefinitionKind;
  name: string;
  declaration: DefinitionDeclaration;
  operation: DefinitionOperation;
  arguments: readonly DefinitionArgument[];
  limitations: readonly string[];
  sourceId: string;
  lineStarts: readonly number[];
  start: number;
  end: number;
  starred: boolean;
  replacement?: string;
  beginReplacement?: string;
  endReplacement?: string;
}): ParsedDefinition {
  const limitations = unique(input.limitations);
  const location = offsetToLocation(input.lineStarts, input.start);
  return {
    kind: input.kind,
    name: input.name,
    declaration: input.declaration,
    operation: input.operation,
    arguments: input.arguments,
    expandability: limitations.length === 0 ? 'expandable' : 'recognized-limited',
    limitations,
    source: {
      id: input.sourceId,
      startOffset: input.start,
      endOffset: Math.max(input.start, input.end),
      line: location.line,
      column: location.column,
    },
    starred: input.starred,
    ...(input.replacement !== undefined ? { replacement: input.replacement } : {}),
    ...(input.beginReplacement !== undefined ? { beginReplacement: input.beginReplacement } : {}),
    ...(input.endReplacement !== undefined ? { endReplacement: input.endReplacement } : {}),
  };
}

function readOptionalStar(text: string, offset: number): { readonly starred: boolean; readonly end: number } {
  const cursor = skipTeXWhitespace(text, offset);
  return text[cursor] === '*'
    ? { starred: true, end: cursor + 1 }
    : { starred: false, end: cursor };
}

function readCommandNameArgument(text: string, offset: number): CommandName | undefined {
  const cursor = skipTeXWhitespace(text, offset);
  const direct = readDirectCommandName(text, cursor);
  if (direct) {
    return direct;
  }
  const group = readTeXGroup(text, cursor);
  if (!group) {
    return undefined;
  }
  const trimmed = group.content.trim();
  const nested = readDirectCommandName(trimmed, 0);
  if (!nested || nested.end !== trimmed.length) {
    return undefined;
  }
  return { name: nested.name, end: group.end };
}

function readDirectCommandName(text: string, offset: number): CommandName | undefined {
  const control = readControlSequence(text, offset);
  return control ? { name: `\\${control.name}`, end: control.end } : undefined;
}

function readControlSequence(text: string, offset: number): { readonly name: string; readonly end: number } | undefined {
  if (text[offset] !== '\\' || offset + 1 >= text.length) {
    return undefined;
  }
  let end = offset + 1;
  if (/[A-Za-z@]/.test(text[end] ?? '')) {
    while (end < text.length && /[A-Za-z@]/.test(text[end] ?? '')) {
      end += 1;
    }
  } else {
    end += 1;
  }
  return { name: text.slice(offset + 1, end), end };
}

function findUnescaped(text: string, offset: number, target: string): number {
  for (let index = offset; index < text.length; index += 1) {
    if (text[index] === target && !isEscaped(text, index)) {
      return index;
    }
    if (text[index] === '\n' || text[index] === '\r') {
      const prefix = text.slice(offset, index);
      if (!/#\d/.test(prefix) && prefix.trim().length > 0) {
        return -1;
      }
    }
  }
  return -1;
}

function isEscaped(text: string, offset: number): boolean {
  let slashes = 0;
  for (let index = offset - 1; index >= 0 && text[index] === '\\'; index -= 1) {
    slashes += 1;
  }
  return slashes % 2 === 1;
}

function statementEnd(text: string, offset: number): number {
  const newline = text.indexOf('\n', offset);
  return newline < 0 ? text.length : newline;
}

function isLiteralEnvironmentName(name: string): boolean {
  return name.length > 0 && !/[\\{}\s]/.test(name);
}

function collectLineStarts(text: string): readonly number[] {
  const starts = [0];
  for (let index = 0; index < text.length; index += 1) {
    if (text[index] === '\n') {
      starts.push(index + 1);
    }
  }
  return starts;
}

function offsetToLocation(lineStarts: readonly number[], offset: number): { readonly line: number; readonly column: number } {
  let low = 0;
  let high = lineStarts.length - 1;
  while (low <= high) {
    const middle = Math.floor((low + high) / 2);
    const start = lineStarts[middle] ?? 0;
    if (start <= offset) {
      low = middle + 1;
    } else {
      high = middle - 1;
    }
  }
  const line = Math.max(0, high);
  return { line, column: offset - (lineStarts[line] ?? 0) };
}

function unique(values: readonly string[]): readonly string[] {
  return [...new Set(values)];
}

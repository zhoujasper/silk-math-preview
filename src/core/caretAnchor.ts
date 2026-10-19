import { hasDefinitionDeclarations, maskTeXComments, parseDefinitions } from './definitionParser';
import type {
  CaretAnchor,
  CaretAnchorReason,
  TextRange,
} from './types';

interface ControlSequence extends TextRange {
  readonly name: string;
}

interface UnsafeSpan extends TextRange {
  readonly reason: Exclude<CaretAnchorReason, 'exact' | 'out-of-range'>;
}

/**
 * 这些命令的前若干个参数是名字或属性而不是公式内容：
 * `\textcolor{Cancel|U}{x}` 里插入 marker 会把颜色名毁掉（渲染成黑色且不报错）。
 * 光标落在这些参数里时，改放到后面真正显示的那组内容开头。
 */
const PROTECTED_ARGUMENTS: Readonly<Record<string, number>> = {
  textcolor: 1, color: 1, colorbox: 1, fcolorbox: 2, definecolor: 3, colorlet: 2,
  class: 1, style: 1, cssId: 1, href: 1, label: 1, ref: 1, eqref: 1, cite: 1, tag: 1,
  DeclareMathOperator: 1, newcommand: 1, renewcommand: 1,
  operatorname: 1,
  genfrac: 4,
};
// `\begin{...}`/`\end{...}` 由 readEnvironmentHead 当作整体保护，不必重复列入。

const KNOWN_COMMAND_ARITY: Readonly<Record<string, number>> = {
  frac: 2, dfrac: 2, tfrac: 2, binom: 2,
  sqrt: 1, text: 1, mathrm: 1, mathbf: 1, mathit: 1, mathbb: 1, mathcal: 1,
  operatorname: 1, overline: 1, underline: 1, hat: 1, bar: 1, vec: 1,
  dot: 1, ddot: 1, not: 1,
  overset: 2, underset: 2, stackrel: 2, mathchoice: 4, cfrac: 2,
};

/** 数字/单位命令消费的是数据；插入 TeX 光标会破坏指数或格式选项。 */
const DATA_COMMAND_ARITY: Readonly<Record<string, number>> = {
  num: 1, numlist: 1, numproduct: 1, numrange: 2, ang: 1,
  si: 1, unit: 1, SI: 2, qty: 2, SIlist: 2, qtylist: 2,
  SIproduct: 2, qtyproduct: 2, SIrange: 3, qtyrange: 3,
  rule: 2, hspace: 1, vspace: 1, pu: 1,
};

function dataArgumentSeam(text: string, offset: number): CaretAnchor | undefined {
  for (let cursor = 0; cursor < text.length;) {
    const command = readControlSequence(text, cursor);
    if (!command) { cursor += 1; continue; }
    cursor = command.end;
    const arity = DATA_COMMAND_ARITY[command.name];
    if (!arity) continue;
    let scan = skipWhitespace(text, command.end);
    const optional = groupEnd(text, scan, '[', ']');
    if (optional) scan = skipWhitespace(text, optional);
    let end = scan;
    let complete = true;
    for (let argument = 0; argument < arity; argument += 1) {
      const prefix = command.name.startsWith('SI') && argument > 0 ? groupEnd(text, scan, '[', ']') : undefined;
      if (prefix) scan = skipWhitespace(text, prefix);
      const group = groupEnd(text, scan);
      if (!group) { complete = false; break; }
      end = group;
      scan = skipWhitespace(text, group);
    }
    if (complete && offset > command.start && offset <= end) {
      return { requestedOffset: offset, offset: end, exact: offset === end,
        reason: 'command-argument-seam', unsafeRange: { start: command.start, end } };
    }
  }
  return undefined;
}

function isEscaped(text: string, offset: number): boolean {
  let slashCount = 0;
  for (let cursor = offset - 1; cursor >= 0 && text[cursor] === '\\'; cursor -= 1) {
    slashCount += 1;
  }
  return slashCount % 2 === 1;
}

function readControlSequence(
  text: string,
  offset: number,
): ControlSequence | undefined {
  if (text[offset] !== '\\' || isEscaped(text, offset) || offset + 1 >= text.length) {
    return undefined;
  }
  let end = offset + 1;
  const first = text[end];
  if (first !== undefined && /[A-Za-z@]/.test(first)) {
    end += 1;
    while (end < text.length && /[A-Za-z@]/.test(text[end] ?? '')) {
      end += 1;
    }
  } else {
    end += 1;
  }
  return {
    start: offset,
    end,
    name: text.slice(offset + 1, end),
  };
}

function readEnvironmentHead(
  text: string,
  command: ControlSequence,
): UnsafeSpan | undefined {
  if (command.name !== 'begin' && command.name !== 'end') {
    return undefined;
  }
  let end = command.end;
  while (/[ \t\r\n]/.test(text[end] ?? '')) {
    end += 1;
  }
  if (text[end] === '{') {
    end += 1;
    while (
      end < text.length &&
      text[end] !== '}' &&
      text[end] !== '\r' &&
      text[end] !== '\n'
    ) {
      end += 1;
    }
    if (text[end] === '}') {
      end += 1;
    }
  }
  return { start: command.start, end, reason: 'environment-head' };
}

/**
 * 这些命令后面紧跟一个定界符 token，中间插入 marker 会让 MathJax 报
 * "Missing or unrecognized delimiter"，整条公式渲染不出来。
 */
const DELIMITER_COMMANDS: ReadonlySet<string> = new Set([
  'left', 'right', 'middle',
  'big', 'bigl', 'bigr', 'bigm', 'Big', 'Bigl', 'Bigr', 'Bigm',
  'bigg', 'biggl', 'biggr', 'biggm', 'Bigg', 'Biggl', 'Biggr', 'Biggm',
]);

function readLeftRightHead(
  text: string,
  command: ControlSequence,
): UnsafeSpan | undefined {
  if (!DELIMITER_COMMANDS.has(command.name)) {
    return undefined;
  }
  let end = command.end;
  while (/[ \t\r\n]/.test(text[end] ?? '')) {
    end += 1;
  }
  const delimiterCommand = readControlSequence(text, end);
  if (delimiterCommand !== undefined) {
    end = delimiterCommand.end;
  } else if (
    end < text.length &&
    text[end] !== '\r' &&
    text[end] !== '\n'
  ) {
    end += 1;
  }
  return { start: command.start, end, reason: 'left-right-head' };
}

function unsafeSpanAt(text: string, requestedOffset: number): UnsafeSpan | undefined {
  let cursor = 0;
  while (cursor < text.length) {
    const command = readControlSequence(text, cursor);
    if (command === undefined) {
      cursor += 1;
      continue;
    }
    const span =
      readEnvironmentHead(text, command) ??
      readLeftRightHead(text, command) ?? {
        start: command.start,
        end: command.end,
        reason: 'control-sequence' as const,
      };
    if (requestedOffset > span.start && requestedOffset < span.end) {
      return span;
    }
    cursor = Math.max(command.end, span.end);
  }
  return undefined;
}

function skipWhitespace(text: string, offset: number): number {
  let cursor = offset;
  while (cursor < text.length && /[ \t\r\n]/.test(text[cursor] ?? '')) cursor += 1;
  return cursor;
}

function groupEnd(text: string, start: number, open = '{', close = '}'): number | undefined {
  if (text[start] !== open) return undefined;
  let depth = 1;
  for (let cursor = start + 1; cursor < text.length; cursor += 1) {
    if (isEscaped(text, cursor)) continue;
    if (text[cursor] === open) depth += 1;
    else if (text[cursor] === close && --depth === 0) return cursor + 1;
  }
  return undefined;
}

/**
 * `x^|2` 中直接插入一个 TeX atom 会把光标本身变成上标，原来的上下标内容被挤回基线；
 * 因此紧跟在 `^`/`_` 之后的位置必须推到参数 token 之后。
 */
function scriptArgumentSeam(
  text: string,
  offset: number,
): { readonly offset: number; readonly markerStart: number } | undefined {
  let marker = offset - 1;
  while (marker >= 0 && /[ \t]/.test(text[marker] ?? '')) marker -= 1;
  if (text[marker] !== '^' && text[marker] !== '_') return undefined;
  const argument = skipWhitespace(text, offset);
  if (text[argument] === '{') return { offset: argument + 1, markerStart: marker };
  const command = readControlSequence(text, argument);
  return {
    offset: command?.end ?? Math.min(text.length, argument + 1),
    markerStart: marker,
  };
}

/** 光标左侧紧邻的控制词（`\underbrace`、`\mathcal`、用户自定义宏都算）。 */
function controlWordBefore(text: string, offset: number): ControlSequence | undefined {
  let marker = offset - 1;
  while (marker >= 0 && /[ \t]/.test(text[marker] ?? '')) marker -= 1;
  if (marker < 0 || !/[A-Za-z@]/.test(text[marker] ?? '')) return undefined;
  let start = marker;
  while (start >= 0 && /[A-Za-z@]/.test(text[start] ?? '')) start -= 1;
  if (start < 0 || text[start] !== '\\' || isEscaped(text, start)) return undefined;
  return { start, end: marker + 1, name: text.slice(start + 1, marker + 1) };
}

/**
 * 命令与它的参数之间同样放不下 marker：`\underbrace|{...}` 会把 marker 当成参数，
 * 命令本身失去参数，整条公式直接渲染失败。任何后面跟着 `{` 的控制词都要推进组内；
 * 已知需要参数的命令即使参数没有花括号也要跳过那个 token。
 */
/** 从 offset 往回跳过若干个完整分组，返回分组序列之前的位置。 */
function skipGroupsBackward(text: string, offset: number): number {
  let cursor = offset;
  for (let guard = 0; guard < 8; guard += 1) {
    let scan = cursor - 1;
    while (scan >= 0 && /[ \t]/.test(text[scan] ?? '')) scan -= 1;
    if (scan < 0 || text[scan] !== '}' || isEscaped(text, scan)) return cursor;
    let depth = 0;
    let start = scan;
    for (; start >= 0; start -= 1) {
      if (isEscaped(text, start)) continue;
      if (text[start] === '}') depth += 1;
      else if (text[start] === '{' && (depth -= 1) === 0) break;
    }
    if (start < 0) return cursor;
    cursor = start;
  }
  return cursor;
}

function commandArgumentSeam(
  text: string,
  offset: number,
): { readonly offset: number; readonly markerStart: number } | undefined {
  const immediate = controlWordBefore(text, offset);
  const argument = skipWhitespace(text, offset);
  if (text[argument] === '{') {
    // 光标停在命令与它的花括号之间，或 `\frac{a}|{b}`、`\textcolor{c}|{x}`
    // 这种同一命令的两个参数之间；后者要跨过已经写完的参数才能找到命令。
    const beforeGroups = skipGroupsBackward(text, offset);
    const owner = immediate
      ?? (beforeGroups !== offset ? controlWordBefore(text, beforeGroups) : undefined);
    return owner ? { offset: argument + 1, markerStart: owner.start } : undefined;
  }
  // 参数没有花括号时（`\frac12`、`\mathcal O`）必须跨过该命令的全部参数，
  // 只跳一个 token 会停在 `\frac1|2` 这种同样会被吞掉的位置；这交给下面
  // 按参数个数展开的那一遍处理。
  return undefined;
}

/** 光标落在名字类参数里时，推进到后面第一组真正显示的内容开头。 */
function protectedArgumentSeam(
  text: string,
  offset: number,
): { readonly offset: number; readonly start: number; readonly end: number } | undefined {
  for (let cursor = 0; cursor < text.length;) {
    const command = readControlSequence(text, cursor);
    if (!command) {
      cursor += 1;
      continue;
    }
    const protectedCount = PROTECTED_ARGUMENTS[command.name];
    if (!protectedCount) {
      cursor = command.end;
      continue;
    }
    let scan = skipWhitespace(text, command.end);
    if (text[scan] === '*' && /^(?:tag|operatorname|DeclareMathOperator|newcommand|renewcommand)$/.test(command.name)) {
      scan = skipWhitespace(text, scan + 1);
    }
    if (/^(?:textcolor|color|colorbox|fcolorbox|definecolor)$/.test(command.name)) {
      const optional = groupEnd(text, scan, '[', ']');
      if (optional) scan = skipWhitespace(text, optional);
    }
    let protectedEnd = command.end;
    for (let index = 0; index < protectedCount; index += 1) {
      if (text[scan] !== '{') break;
      const end = groupEnd(text, scan);
      if (end === undefined) break;
      protectedEnd = end;
      scan = skipWhitespace(text, end);
    }
    // 命令名之后、名字类参数内部、以及参数之间的空隙，放 marker 都会毁掉这些参数。
    if (offset >= command.end && offset <= protectedEnd) {
      // 后面还有内容组就落到组内，否则停在名字参数之后。
      const target = text[scan] === '{' ? scan + 1 : scan;
      return { offset: target, start: command.start, end: target };
    }
    cursor = Math.max(command.end, scan);
  }
  return undefined;
}

/**
 * 用户宏常带星号或尺寸参数，例如 mathtools 的 `\braket*{a}{b}`、`\braket[\big]{a}{b}`。
 * 预览不知道宏的参数表；只要控制词后面是 `*`/短 `[...]` 再接 `{`，这些修饰符前后
 * 以及随后各参数组之间都不能放 marker，否则 marker 会被当成参数，显示内容随光标改变。
 */
function modifiedCommandSeam(
  text: string,
  offset: number,
): { readonly offset: number; readonly start: number; readonly end: number } | undefined {
  for (let cursor = 0; cursor < text.length;) {
    const command = readControlSequence(text, cursor);
    if (!command) {
      cursor += 1;
      continue;
    }
    cursor = command.end;
    if (command.start > offset) break;
    if (!/^[A-Za-z@]+$/.test(command.name) || DELIMITER_COMMANDS.has(command.name)
      || /^(?:begin|end|left|right|middle|sqrt)$/.test(command.name)) continue;
    let scan = skipWhitespace(text, command.end);
    let modified = false;
    if (text[scan] === '*') {
      scan = skipWhitespace(text, scan + 1);
      modified = true;
    }
    for (let guard = 0; guard < 2 && text[scan] === '['; guard += 1) {
      const end = groupEnd(text, scan, '[', ']');
      if (end === undefined || end - scan > 64) break;
      scan = skipWhitespace(text, end);
      modified = true;
    }
    if (!modified || text[scan] !== '{') continue;
    if (offset >= command.end && offset <= scan) return { offset: scan + 1, start: command.start, end: scan + 1 };
    let group = scan;
    for (let guard = 0; guard < 9; guard += 1) {
      const end = groupEnd(text, group);
      if (end === undefined) break;
      const next = skipWhitespace(text, end);
      if (text[next] !== '{') break;
      if (offset >= end && offset <= next) return { offset: next + 1, start: command.start, end: next + 1 };
      group = next;
    }
  }
  return undefined;
}

function safeArgumentSeam(text: string, requestedOffset: number): CaretAnchor | undefined {
  const script = scriptArgumentSeam(text, requestedOffset);
  if (script) {
    const argument = script.offset > requestedOffset
      && readControlSequence(text, skipWhitespace(text, requestedOffset))
      ? safeArgumentSeam(text, script.offset)
      : undefined;
    return {
      requestedOffset,
      offset: argument?.offset ?? script.offset,
      exact: false,
      reason: 'script-argument-seam',
      unsafeRange: { start: script.markerStart, end: argument?.offset ?? script.offset },
    };
  }

  // 名字类参数要先判断：否则通用规则会把光标推进颜色名/环境名内部。
  const protectedArgument = protectedArgumentSeam(text, requestedOffset);
  if (protectedArgument) {
    return {
      requestedOffset,
      offset: protectedArgument.offset,
      exact: false,
      reason: 'command-argument-seam',
      unsafeRange: { start: protectedArgument.start, end: protectedArgument.end },
    };
  }

  const modified = modifiedCommandSeam(text, requestedOffset);
  if (modified) {
    return {
      requestedOffset,
      offset: modified.offset,
      exact: false,
      reason: 'command-argument-seam',
      unsafeRange: { start: modified.start, end: modified.end },
    };
  }

  const argument = commandArgumentSeam(text, requestedOffset);
  if (argument) {
    return {
      requestedOffset,
      offset: argument.offset,
      exact: false,
      reason: 'command-argument-seam',
      unsafeRange: { start: argument.markerStart, end: argument.offset },
    };
  }

  // 已知参数个数的命令：参数正文内部仍然精确，只有参数之间的缝隙需要调整。
  for (let cursor = 0; cursor < text.length;) {
    const command = readControlSequence(text, cursor);
    if (!command) {
      cursor += 1;
      continue;
    }
    const arity = KNOWN_COMMAND_ARITY[command.name];
    if (!arity) {
      cursor = command.end;
      continue;
    }
    let argumentCursor = skipWhitespace(text, command.end);
    if ((command.name === 'sqrt' || command.name === 'cfrac') && text[argumentCursor] === '[') {
      argumentCursor = skipWhitespace(text, groupEnd(text, argumentCursor, '[', ']') ?? argumentCursor);
    }
    // 花括号参数可以落进组内；`\frac12` 这种单 token 参数没有“内部”，
    // 只能整体跳到命令的最后一个参数之后，否则 marker 会替掉某个参数。
    const seams: Array<{ readonly from: number; readonly to: number; readonly target?: number }> = [];
    let gap = command.end;
    for (let index = 0; index < arity; index += 1) {
      const start = skipWhitespace(text, argumentCursor);
      if (start >= text.length) break;
      if (text[start] === '{') {
        const end = groupEnd(text, start);
        if (end === undefined) break;
        seams.push({ from: gap, to: start, target: start + 1 });
        argumentCursor = end;
      } else {
        const token = readControlSequence(text, start);
        const end = token?.end ?? start + 1;
        seams.push({ from: gap, to: end - 1 });
        argumentCursor = end;
      }
      gap = argumentCursor;
    }
    for (const seam of seams) {
      if (requestedOffset < seam.from || requestedOffset > seam.to) continue;
      const target = seam.target ?? argumentCursor;
      return {
        requestedOffset,
        offset: target,
        exact: false,
        reason: 'command-argument-seam',
        unsafeRange: { start: seam.from, end: target },
      };
    }
    cursor = command.end;
  }
  return undefined;
}

/**
 * 把公式内容内的光标吸附到不会拆开 TeX token 的 seam。
 * 输入和输出均为相对该公式字符串的 UTF-16 offset。
 */
function anchorCaretInternal(text: string, requestedOffset: number): CaretAnchor {
  const integerOffset = Number.isFinite(requestedOffset)
    ? Math.trunc(requestedOffset)
    : 0;
  const clampedOffset = Math.min(text.length, Math.max(0, integerOffset));
  if (clampedOffset !== requestedOffset) {
    return {
      requestedOffset,
      offset: clampedOffset,
      exact: false,
      reason: 'out-of-range',
    };
  }

  const data = dataArgumentSeam(text, clampedOffset);
  if (data) return data;

  // A trailing, unpaired backslash would escape the inserted marker itself:
  // "\\" + "\\class{...}" becomes a row break followed by visible "class...".
  // Put the marker before that unfinished control sequence. Recovery can then
  // discard the trailing slash without changing the source or any complete token.
  const slash = clampedOffset - 1;
  if (text[slash] === '\\' && !isEscaped(text, slash)) {
    const seam = safeArgumentSeam(text, slash);
    if (seam) return { ...seam, requestedOffset };
    return {
      requestedOffset,
      offset: slash,
      exact: false,
      reason: 'control-sequence',
      unsafeRange: { start: slash, end: clampedOffset },
    };
  }

  const unsafe = unsafeSpanAt(text, clampedOffset);
  if (unsafe === undefined) {
    const seam = safeArgumentSeam(text, clampedOffset);
    if (seam) return seam;
    return {
      requestedOffset,
      offset: clampedOffset,
      exact: true,
      reason: 'exact',
    };
  }

  const beforeDistance = clampedOffset - unsafe.start;
  const afterDistance = unsafe.end - clampedOffset;
  const snapped = beforeDistance < afterDistance ? unsafe.start : unsafe.end;
  // 吸附到 token 边界后仍可能落在参数 seam 上：`T^\st|ar` 会退回 `^` 之后把上标顶掉，
  // `\under|brace{...}` 会停在命令与它的花括号之间导致整条公式渲染失败。
  const seam = safeArgumentSeam(text, snapped);
  if (seam) return { ...seam, requestedOffset };
  return {
    requestedOffset,
    offset: snapped,
    exact: false,
    reason: unsafe.reason,
    unsafeRange: { start: unsafe.start, end: unsafe.end },
  };
}

/** 声明和列格式属于语法数据；光标不能注入其中或插在表格横线之前。 */
export function anchorCaret(source: string, requestedOffset: number): CaretAnchor {
  const text = maskTeXComments(source);
  let protectedOffset = requestedOffset;
  if (hasDefinitionDeclarations(text)) {
    const definition = parseDefinitions(text).find(({ source }) =>
      requestedOffset > source.startOffset && requestedOffset < source.endOffset);
    if (definition) protectedOffset = definition.source.endOffset;
  }
  const heads = /\\begin\s*\{(?:array|subarray|alignat\*?|alignedat)\}/g;
  for (const match of text.matchAll(heads)) {
    if (isEscaped(text, match.index)) continue;
    let start = skipWhitespace(text, match.index + match[0].length);
    const optional = groupEnd(text, start, '[', ']');
    if (optional) start = skipWhitespace(text, optional);
    const end = groupEnd(text, start);
    if (end && requestedOffset > match.index && requestedOffset <= end) {
      protectedOffset = end;
      break;
    }
  }
  protectedOffset = syntaxArgumentOffset(text, protectedOffset);
  const anchor = anchorCaretInternal(text, protectedOffset);
  let offset = syntaxArgumentOffset(text, anchor.offset);
  for (;;) {
    const start = skipWhitespace(text, offset);
    const rule = /^\\(?:hline|hdashline)\b/.exec(text.slice(start));
    if (!rule || isEscaped(text, start)) break;
    offset = start + rule[0].length;
  }
  return offset === anchor.offset && protectedOffset === requestedOffset ? anchor : {
    ...anchor, requestedOffset, offset, exact: false, reason: 'command-argument-seam',
  };
}

/** 尺寸、可选参数和操作符修饰符不是独立数学原子，不能插入光标命令。 */
function syntaxArgumentOffset(text: string, offset: number): number {
  for (let cursor = 0; cursor < text.length;) {
    const command = readControlSequence(text, cursor);
    if (!command) { cursor += 1; continue; }
    cursor = command.end;
    const delimiter = readLeftRightHead(text, command);
    if (delimiter && offset > command.start && offset < delimiter.end) return delimiter.end;
    let start = skipWhitespace(text, command.end);
    if (/^(?:kern|mkern|hskip|mskip)$/.test(command.name)) {
      const dimension = /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)\s*(?:pt|em|ex|mu|px|cm|mm|in|pc|bp|dd|cc|sp)/.exec(text.slice(start));
      if (dimension && offset > command.start && offset < start + dimension[0].length) {
        return start + dimension[0].length;
      }
    }
    if (command.name === '\\' || /^(?:xrightarrow|xleftarrow|smash|sqrt|cfrac)$/.test(command.name)) {
      const optional = groupEnd(text, start, '[', ']');
      if (optional) {
        start = skipWhitespace(text, optional);
        const target = text[start] === '{' && command.name !== '\\' ? start + 1 : optional;
        if (offset > command.start && offset <= start) return target;
      }
    }
    if (/^(?:limits|nolimits|displaylimits)$/.test(command.name)) {
      let before = command.start;
      while (before > 0 && /\s/.test(text[before - 1] ?? '')) before -= 1;
      if (offset >= before && offset < command.end) return command.end;
    }
  }
  return offset;
}

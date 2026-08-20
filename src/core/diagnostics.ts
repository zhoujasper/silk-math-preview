import { getHighConfidenceCommandCorrection } from './completionCatalog';
import type {
  DiagnosticFix,
  DiagnosticOptions,
  MathDiagnostic,
  TextEdit,
  TextRange,
} from './types';

interface CommandToken extends TextRange {
  readonly name: string;
}

interface EnvironmentToken extends TextRange {
  readonly kind: 'begin' | 'end';
  readonly name: string;
  readonly nameRange: TextRange;
}

interface ParsedTokens {
  readonly commands: readonly CommandToken[];
  readonly environments: readonly EnvironmentToken[];
}

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

function readCommand(text: string, offset: number): CommandToken | undefined {
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
  return { start: offset, end, name: text.slice(offset + 1, end) };
}

function readEnvironmentToken(
  text: string,
  command: CommandToken,
): EnvironmentToken | undefined {
  if (command.name !== 'begin' && command.name !== 'end') {
    return undefined;
  }
  let cursor = command.end;
  while (text[cursor] === ' ' || text[cursor] === '\t') {
    cursor += 1;
  }
  if (text[cursor] !== '{') {
    return undefined;
  }
  const nameStart = cursor + 1;
  const close = text.indexOf('}', nameStart);
  const newline = lineEndAfter(text, nameStart);
  if (close === -1 || close > newline || close === nameStart) {
    return undefined;
  }
  return {
    start: command.start,
    end: close + 1,
    kind: command.name,
    name: text.slice(nameStart, close),
    nameRange: { start: nameStart, end: close },
  };
}

function parseTokens(text: string): ParsedTokens {
  const commands: CommandToken[] = [];
  const environments: EnvironmentToken[] = [];
  let cursor = 0;
  while (cursor < text.length) {
    if (text[cursor] === '%' && !isEscaped(text, cursor)) {
      cursor = lineEndAfter(text, cursor);
      continue;
    }
    const command = readCommand(text, cursor);
    if (command === undefined) {
      cursor += 1;
      continue;
    }
    commands.push(command);
    const environment = readEnvironmentToken(text, command);
    if (environment !== undefined) {
      environments.push(environment);
    }
    cursor = command.end;
  }
  return { commands, environments };
}

function shifted(range: TextRange, offset: number): TextRange {
  return { start: range.start + offset, end: range.end + offset };
}

function edit(range: TextRange, newText: string, offset: number): TextEdit {
  return { range: shifted(range, offset), newText };
}

function fix(
  title: string,
  edits: readonly TextEdit[],
  preferred = true,
): DiagnosticFix {
  return { title, edits, preferred };
}

function diagnoseBraces(
  text: string,
  baseOffset: number,
): MathDiagnostic[] {
  const diagnostics: MathDiagnostic[] = [];
  const stack: number[] = [];
  let cursor = 0;
  while (cursor < text.length) {
    if (text[cursor] === '%' && !isEscaped(text, cursor)) {
      cursor = lineEndAfter(text, cursor);
      continue;
    }
    const command = readCommand(text, cursor);
    if (command !== undefined) {
      cursor = command.end;
      continue;
    }
    if (text[cursor] === '{') {
      stack.push(cursor);
    } else if (text[cursor] === '}') {
      const opening = stack.pop();
      if (opening === undefined) {
        const range = { start: cursor, end: cursor + 1 };
        diagnostics.push({
          code: 'unexpected-closing-brace',
          message: '发现没有对应左花括号的 `}`。',
          severity: 'error',
          range: shifted(range, baseOffset),
          fixes: [fix('删除多余的 `}`', [edit(range, '', baseOffset)])],
        });
      }
    }
    cursor += 1;
  }

  for (const opening of stack) {
    const range = { start: opening, end: opening + 1 };
    const insertion = { start: text.length, end: text.length };
    diagnostics.push({
      code: 'unclosed-group',
      message: '左花括号缺少对应的 `}`。',
      severity: 'error',
      range: shifted(range, baseOffset),
      fixes: [fix('在公式末尾补全 `}`', [edit(insertion, '}', baseOffset)])],
    });
  }
  return diagnostics;
}

function delimiterAfter(text: string, command: CommandToken): string {
  let cursor = command.end;
  while (text[cursor] === ' ' || text[cursor] === '\t') {
    cursor += 1;
  }
  const delimiterCommand = readCommand(text, cursor);
  if (delimiterCommand !== undefined) {
    return text.slice(delimiterCommand.start, delimiterCommand.end);
  }
  const delimiter = text[cursor];
  return delimiter === undefined ||
    delimiter === '\r' ||
    delimiter === '\n' ||
    /[A-Za-z0-9]/.test(delimiter)
    ? '.'
    : delimiter;
}

function matchingRightDelimiter(left: string): string {
  const matches: Readonly<Record<string, string>> = {
    '(': ')',
    '[': ']',
    '\\{': '\\}',
    '\\langle': '\\rangle',
    '\\lvert': '\\rvert',
    '\\lVert': '\\rVert',
  };
  return matches[left] ?? left;
}

function diagnoseLeftRight(
  text: string,
  commands: readonly CommandToken[],
  baseOffset: number,
): MathDiagnostic[] {
  const diagnostics: MathDiagnostic[] = [];
  const stack: Array<{ readonly command: CommandToken; readonly delimiter: string }> = [];
  for (const command of commands) {
    if (command.name === 'left') {
      stack.push({ command, delimiter: delimiterAfter(text, command) });
    } else if (command.name === 'right') {
      const left = stack.pop();
      if (left === undefined) {
        const insertion = { start: command.start, end: command.start };
        diagnostics.push({
          code: 'unmatched-right',
          message: '`\\right` 前缺少对应的 `\\left`。',
          severity: 'error',
          range: shifted(command, baseOffset),
          fixes: [
            fix('在此处插入不可见的 `\\left.`', [
              edit(insertion, '\\left.', baseOffset),
            ]),
          ],
        });
      }
    }
  }

  for (const left of stack) {
    const insertion = { start: text.length, end: text.length };
    const right = matchingRightDelimiter(left.delimiter);
    diagnostics.push({
      code: 'unmatched-left',
      message: '`\\left` 后缺少对应的 `\\right`。',
      severity: 'error',
      range: shifted(left.command, baseOffset),
      fixes: [
        fix(`在公式末尾插入 \\right${right}`, [
          edit(insertion, `\\right${right}`, baseOffset),
        ]),
      ],
    });
  }
  return diagnostics;
}

function diagnoseEnvironments(
  text: string,
  environments: readonly EnvironmentToken[],
  baseOffset: number,
): MathDiagnostic[] {
  const diagnostics: MathDiagnostic[] = [];
  const stack: EnvironmentToken[] = [];
  for (const environment of environments) {
    if (environment.kind === 'begin') {
      stack.push(environment);
      continue;
    }
    const opening = stack.pop();
    if (opening === undefined) {
      const insertion = { start: 0, end: 0 };
      diagnostics.push({
        code: 'unexpected-end-environment',
        message: `环境 ${environment.name} 缺少对应的 \\begin。`,
        severity: 'error',
        range: shifted(environment.nameRange, baseOffset),
        fixes: [
          fix(`在公式开头插入 \\begin{${environment.name}}`, [
            edit(insertion, `\\begin{${environment.name}}\n`, baseOffset),
          ]),
        ],
      });
    } else if (opening.name !== environment.name) {
      diagnostics.push({
        code: 'mismatched-environment',
        message: `环境从 ${opening.name} 开始，却以 ${environment.name} 结束。`,
        severity: 'error',
        range: shifted(environment.nameRange, baseOffset),
        fixes: [
          fix(`把结束环境改为 ${opening.name}`, [
            edit(environment.nameRange, opening.name, baseOffset),
          ]),
        ],
      });
    }
  }

  for (const opening of stack.reverse()) {
    const insertion = { start: text.length, end: text.length };
    diagnostics.push({
      code: 'unclosed-environment',
      message: `环境 ${opening.name} 缺少对应的 \\end。`,
      severity: 'error',
      range: shifted(opening.nameRange, baseOffset),
      fixes: [
        fix(`在公式末尾插入 \\end{${opening.name}}`, [
          edit(insertion, `\n\\end{${opening.name}}`, baseOffset),
        ]),
      ],
    });
  }
  return diagnostics;
}

function nextSignificantOffset(text: string, start: number): number {
  let cursor = start;
  while (cursor < text.length) {
    if (/\s/.test(text[cursor] ?? '')) {
      cursor += 1;
    } else if (text[cursor] === '%' && !isEscaped(text, cursor)) {
      cursor = lineEndAfter(text, cursor);
    } else {
      break;
    }
  }
  return cursor;
}

function diagnoseDanglingScripts(
  text: string,
  baseOffset: number,
): MathDiagnostic[] {
  const diagnostics: MathDiagnostic[] = [];
  let cursor = 0;
  while (cursor < text.length) {
    if (text[cursor] === '%' && !isEscaped(text, cursor)) {
      cursor = lineEndAfter(text, cursor);
      continue;
    }
    const marker = text[cursor];
    if ((marker !== '^' && marker !== '_') || isEscaped(text, cursor)) {
      cursor += 1;
      continue;
    }
    const next = nextSignificantOffset(text, cursor + 1);
    const nextCommand = readCommand(text, next);
    const dangling =
      next >= text.length ||
      text[next] === '^' ||
      text[next] === '_' ||
      text[next] === '}' ||
      nextCommand?.name === 'right' ||
      nextCommand?.name === 'end';
    if (dangling) {
      const range = { start: cursor, end: cursor + 1 };
      const insertion = { start: cursor + 1, end: cursor + 1 };
      diagnostics.push({
        code: 'dangling-script',
        message: `${marker} 后缺少上标或下标内容。`,
        severity: 'error',
        range: shifted(range, baseOffset),
        fixes: [fix(`在 ${marker} 后插入空分组`, [edit(insertion, '{}', baseOffset)])],
      });
    }
    cursor += 1;
  }
  return diagnostics;
}

function diagnoseCommandTypos(
  commands: readonly CommandToken[],
  options: DiagnosticOptions,
  baseOffset: number,
): MathDiagnostic[] {
  const diagnostics: MathDiagnostic[] = [];
  for (const command of commands) {
    const correction = getHighConfidenceCommandCorrection(
      command.name,
      options.commandTypos,
    );
    if (correction === undefined || correction === command.name) {
      continue;
    }
    diagnostics.push({
      code: 'command-typo',
      message: `可能想输入 \\${correction}，而不是 \\${command.name}。`,
      severity: 'warning',
      range: shifted(command, baseOffset),
      fixes: [
        fix(`替换为 \\${correction}`, [
          edit(command, `\\${correction}`, baseOffset),
        ]),
      ],
    });
  }
  return diagnostics;
}

/** 返回诊断和显式修复建议；本函数从不修改输入源码。 */
export function diagnoseMath(
  text: string,
  options: DiagnosticOptions = {},
): readonly MathDiagnostic[] {
  const baseOffset = options.offset ?? 0;
  const tokens = parseTokens(text);
  return [
    ...diagnoseBraces(text, baseOffset),
    ...diagnoseLeftRight(text, tokens.commands, baseOffset),
    ...diagnoseEnvironments(text, tokens.environments, baseOffset),
    ...diagnoseDanglingScripts(text, baseOffset),
    ...diagnoseCommandTypos(tokens.commands, options, baseOffset),
  ].sort((left, right) =>
    left.range.start - right.range.start || left.code.localeCompare(right.code),
  );
}

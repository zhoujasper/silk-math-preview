/**
 * 只改渲染副本：补上未写完的括号/环境，或丢掉末尾半截命令，
 * 让已经写出来的数学尽量画出来。绝不回写源码。
 */

const MAX_CLOSERS = 32;

/** 末尾还没有 `{` 的命令：整段留着会让 MathJax 直接失败。 */
const COMMAND_ARITY: Readonly<Record<string, number>> = {
  frac: 2, dfrac: 2, tfrac: 2, cfrac: 2, binom: 2, dbinom: 2, tbinom: 2,
  sqrt: 1, text: 1, textbf: 1, textit: 1, textrm: 1, texttt: 1, textsf: 1, textnormal: 1,
  mathrm: 1, mathbf: 1, mathit: 1, mathsf: 1, mathtt: 1, mathbb: 1, mathcal: 1, mathfrak: 1, mathscr: 1,
  operatorname: 1, overline: 1, underline: 1, overbrace: 1, underbrace: 1,
  hat: 1, bar: 1, vec: 1, dot: 1, ddot: 1, widehat: 1, widetilde: 1,
  overset: 2, underset: 2, stackrel: 2, mbox: 1, hbox: 1, textcolor: 2, class: 2,
};

const TRAILING_ARG_COMMANDS: ReadonlySet<string> = new Set(Object.keys(COMMAND_ARITY));

function isEscaped(text: string, offset: number): boolean {
  let slashCount = 0;
  for (let cursor = offset - 1; cursor >= 0 && text[cursor] === '\\'; cursor -= 1) {
    slashCount += 1;
  }
  return slashCount % 2 === 1;
}

function isCommandBoundary(text: string, offset: number): boolean {
  return !/[A-Za-z@]/.test(text[offset] ?? '');
}

function readEnvName(text: string, commandEnd: number): { readonly name: string; readonly end: number } | undefined {
  let cursor = commandEnd;
  while (cursor < text.length && /[ \t]/.test(text[cursor] ?? '')) cursor += 1;
  if (text[cursor] !== '{') return undefined;
  const start = cursor + 1;
  const close = text.indexOf('}', start);
  if (close < 0) return undefined;
  const name = text.slice(start, close);
  if (!/^[A-Za-z]+\*?$/.test(name)) return undefined;
  return { name, end: close + 1 };
}

function stripTrailingIncomplete(text: string): string {
  let next = text;
  for (let guard = 0; guard < MAX_CLOSERS; guard += 1) {
    const trimmed = next.replace(/[ \t]+$/u, '');
    if (!trimmed) return trimmed;
    let slashes = 0;
    for (let cursor = trimmed.length - 1; cursor >= 0 && trimmed[cursor] === '\\'; cursor -= 1) {
      slashes += 1;
    }
    if (slashes % 2 === 1) {
      next = trimmed.slice(0, -1);
      continue;
    }
    const command = /\\([A-Za-z@]+)$/.exec(trimmed);
    if (command?.[1] && TRAILING_ARG_COMMANDS.has(command[1])) {
      next = trimmed.slice(0, command.index);
      continue;
    }
    return trimmed;
  }
  return next;
}

function skipSpace(text: string, offset: number): number {
  let cursor = offset;
  while (cursor < text.length && /[ \t]/.test(text[cursor] ?? '')) cursor += 1;
  return cursor;
}

function skipGroup(text: string, start: number): number | undefined {
  if (text[start] !== '{') return undefined;
  let depth = 1;
  for (let cursor = start + 1; cursor < text.length; cursor += 1) {
    if (isEscaped(text, cursor)) continue;
    if (text[cursor] === '{') depth += 1;
    else if (text[cursor] === '}' && (depth -= 1) === 0) return cursor + 1;
  }
  return undefined;
}

function skipOptional(text: string, start: number): number | undefined {
  if (text[start] !== '[') return undefined;
  let depth = 1;
  for (let cursor = start + 1; cursor < text.length; cursor += 1) {
    if (isEscaped(text, cursor)) continue;
    if (text[cursor] === '[') depth += 1;
    else if (text[cursor] === ']' && (depth -= 1) === 0) return cursor + 1;
  }
  return undefined;
}

/** `\frac{a` 补成 `\frac{a}{}`：最后一个还缺参数、后面又没有别的内容的命令。 */
function completeTrailingArity(text: string): string {
  let last: { readonly arity: number; readonly have: number; readonly end: number } | undefined;
  for (let cursor = 0; cursor < text.length; cursor += 1) {
    if (text[cursor] !== '\\' || isEscaped(text, cursor)) continue;
    const name = /^[A-Za-z@]+/.exec(text.slice(cursor + 1))?.[0];
    if (!name) continue;
    const arity = COMMAND_ARITY[name];
    if (arity === undefined) {
      cursor += name.length;
      continue;
    }
    let scan = skipSpace(text, cursor + 1 + name.length);
    const optional = skipOptional(text, scan);
    if (optional !== undefined) scan = skipSpace(text, optional);
    let have = 0;
    for (let index = 0; index < arity; index += 1) {
      const group = skipGroup(text, scan);
      if (group === undefined) break;
      have += 1;
      scan = skipSpace(text, group);
    }
    last = { arity, have, end: scan };
    cursor = Math.max(cursor + name.length, scan - 1);
  }
  if (!last || last.have >= last.arity) return text;
  if (text.slice(last.end).trim()) return text;
  return `${text}${'{}'.repeat(last.arity - last.have)}`;
}

function closeOpenConstructs(text: string): string {
  let braces = 0;
  const environments: string[] = [];
  let lefts = 0;
  for (let cursor = 0; cursor < text.length; cursor += 1) {
    if (isEscaped(text, cursor)) continue;
    const character = text[cursor];
    if (character === '{') {
      braces += 1;
      continue;
    }
    if (character === '}') {
      braces = Math.max(0, braces - 1);
      continue;
    }
    if (character !== '\\') continue;
    if (text.startsWith('\\begin', cursor) && isCommandBoundary(text, cursor + 6)) {
      const env = readEnvName(text, cursor + 6);
      if (env) {
        environments.push(env.name);
        cursor = env.end - 1;
      }
      continue;
    }
    if (text.startsWith('\\end', cursor) && isCommandBoundary(text, cursor + 4)) {
      const env = readEnvName(text, cursor + 4);
      if (env) {
        const last = environments.lastIndexOf(env.name);
        if (last >= 0) environments.splice(last, 1);
        else environments.pop();
        cursor = env.end - 1;
      }
      continue;
    }
    if (text.startsWith('\\left', cursor) && isCommandBoundary(text, cursor + 5)) {
      lefts += 1;
      cursor += 4;
      continue;
    }
    if (text.startsWith('\\right', cursor) && isCommandBoundary(text, cursor + 6)) {
      lefts = Math.max(0, lefts - 1);
      cursor += 5;
    }
  }
  const closers: string[] = [];
  const extraBraces = Math.min(MAX_CLOSERS, braces);
  if (extraBraces > 0) closers.push('}'.repeat(extraBraces));
  const extraEnvs = environments.slice(-MAX_CLOSERS).reverse();
  for (const name of extraEnvs) closers.push(`\\end{${name}}`);
  const extraLeft = Math.min(MAX_CLOSERS, lefts);
  if (extraLeft > 0) closers.push('\\right.'.repeat(extraLeft));
  return closers.length === 0 ? text : `${text}${closers.join('')}`;
}

/** 完整公式原样返回；未写完的公式只补渲染副本。 */
export function recoverIncompleteTex(expression: string): string {
  if (!expression) return expression;
  return completeTrailingArity(closeOpenConstructs(stripTrailingIncomplete(expression)));
}

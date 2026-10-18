import { maskTeXComments, readTeXGroup, skipTeXWhitespace } from '../core/definitionParser';

const PACKAGES = new Set(['pgfplots', 'pgfplotstable', 'tikz-cd', 'circuitikz', 'chemfig', 'tikz-3dplot', 'array', 'amsmath', 'amstext', 'amsfonts', 'amssymb']);
const COUNTS: Record<string, number> = { usetikzlibrary: 1, usepgfplotslibrary: 1, tikzset: 1, tikzcdset: 1, pgfplotsset: 1,
  definecolor: 3, providecolor: 3, colorlet: 2, pgfmathsetmacro: 2, pgfmathtruncatemacro: 2, pgfmathsetlengthmacro: 2,
  setlength: 2, newlength: 1, DeclareMathOperator: 2, pgfmathdeclarefunction: 3,
  pgfplotscreateplotcyclelist: 2, pgfdeclarelayer: 1, pgfsetlayers: 1 };

// Match TeX conditionals, not ordinary commands such as \iff or \ifthenelse.
const CONDITIONALS = new Set(['if', 'ifcat', 'ifnum', 'ifdim', 'ifodd', 'ifvmode', 'ifhmode',
  'ifmmode', 'ifinner', 'ifvoid', 'ifhbox', 'ifvbox', 'ifx', 'ifeof', 'iftrue', 'iffalse',
  'ifcase', 'ifdefined', 'ifcsname', 'iffontchar']);

export function tikzConditionals(text: string): Set<string> {
  const names = new Set(CONDITIONALS);
  for (const match of maskTeXComments(text).matchAll(/\\newif\s*\\(if[A-Za-z@]+)/g)) names.add(match[1]!);
  return names;
}

/** Conditional operands are tokens, not nested conditional instructions. */
export function tikzConditionBody(text: string, name: string, at: number): number {
  const count = name === 'ifdefined' ? 1 : /^(?:if|ifcat|ifx)$/.test(name) ? 2 : 0;
  for (let i = 0; i < count; i++) {
    at = skipTeXWhitespace(text, at);
    at += /^\\(?:[A-Za-z@]+|[^\r\n])|[\s\S]/.exec(text.slice(at))?.[0].length ?? 0;
  }
  return at;
}

/** Native declarations stay in source order, including TeX groups and parameter delimiters. */
export function extractTikzPreamble(source: string, dependencies = false, inheritedConditionals?: ReadonlySet<string>): string {
  const text = maskTeXComments(source);
  const conditionals = new Set([...(inheritedConditionals ?? []), ...tikzConditionals(text)]);
  const tokens = /\\([A-Za-z@]+|[^\r\n])|[{}]/g;
  const out: string[] = [];
  const argument = (at: number): number | undefined => {
    const start = skipTeXWhitespace(text, at);
    const group = readTeXGroup(text, start);
    if (group) return group.end;
    const command = /^\\(?:[A-Za-z@]+|.)/.exec(text.slice(start));
    return command ? start + command[0].length : undefined;
  };
  for (let token = tokens.exec(text); token; token = tokens.exec(text)) {
    const start = token.index, name = token[1];
    let end = tokens.lastIndex;
    if (!name) { out.push(token[0] === '{' ? '\\begingroup' : '\\endgroup'); continue; }
    if (name === 'begingroup' || name === 'bgroup') { out.push('\\begingroup'); continue; }
    if (name === 'endgroup' || name === 'egroup') { out.push('\\endgroup'); continue; }
    if (name === 'makeatletter' || name === 'makeatother') { out.push(token[0]); continue; }
    if (name === 'else') { out.push(token[0]); continue; }
    if (name === 'begin' || name === 'end') {
      const group = readTeXGroup(text, skipTeXWhitespace(text, end));
      if (!group) continue;
      end = group.end;
      if (/^(?:verbatim\*?|lstlisting|minted|comment)$/.test(group.content) && name === 'begin') {
        const close = text.indexOf(`\\end{${group.content}}`, end);
        tokens.lastIndex = close < 0 ? text.length : close + group.content.length + 6; continue;
      }
      if (group.content === 'document' && name === 'begin') out.push('\\begin{document}');
      if (group.content !== 'document') out.push(name === 'begin' ? '\\begingroup' : '\\endgroup');
      tokens.lastIndex = end; continue;
    }
    if (/^(?:global|long|outer|protected)$/.test(name)) {
      // Keep prefixes attached to the declaration; never leave a bare \global.
      const next = /^\s*(?:\\(?:global|long|outer|protected)\s*)*\\(?:[gex]?def|let)\b/.exec(text.slice(end));
      if (next) { out.push(token[0]); continue; }
    }
    if (conditionals.has(name) || name === 'unless') {
      const bodyStart = tikzConditionBody(text, name, end);
      let depth = name === 'unless' ? 0 : 1;
      const condition = /\\([A-Za-z@]+|[^\r\n])/g; condition.lastIndex = bodyStart;
      for (let part = condition.exec(text); part; part = condition.exec(text)) {
        if (part[1] === 'newif') {
          condition.lastIndex = argument(condition.lastIndex) ?? condition.lastIndex; continue;
        }
        if (part[1] !== 'fi' && !conditionals.has(part[1]!)) continue;
        depth += part[1] === 'fi' ? -1 : 1;
        condition.lastIndex = tikzConditionBody(text, part[1]!, condition.lastIndex);
        if (!depth) { end = condition.lastIndex; break; }
      }
      if (depth) throw new Error('TikZ 前置条件尚未闭合 / Unclosed TeX conditional');
      out.push(/^(?:iftrue|iffalse|ifdefined)$/.test(name)
        ? source.slice(start, bodyStart) + '%\n' + extractTikzPreamble(source.slice(bodyStart, end - 3), dependencies, conditionals) + '\\fi'
        : source.slice(start, end));
      tokens.lastIndex = end; continue;
    }
    if (name === 'newif') {
      const target = argument(end); if (target === undefined) continue; end = target;
    } else if (/^[gex]?def$/.test(name)) {
      const head = /^\s*\\(?:[A-Za-z@]+|.)/.exec(text.slice(end));
      if (!head) continue;
      let bodyStart = end + head[0].length;
      for (; bodyStart < text.length && text[bodyStart] !== '{'; bodyStart++) if (text[bodyStart] === '\\') bodyStart++;
      const body = readTeXGroup(text, bodyStart);
      if (!body) break;
      end = body.end;
    } else if (name === 'let') {
      const target = argument(end); if (target === undefined) continue;
      let from = skipTeXWhitespace(text, target); if (text[from] === '=') from = skipTeXWhitespace(text, from + 1);
      end = argument(from) ?? from + 1;
    } else if (/^(?:(?:re)?new|provide)command$/.test(name) || name === 'DeclareRobustCommand' || /^(?:re)?newenvironment$/.test(name)) {
      end = skipTeXWhitespace(text, end); if (text[end] === '*') end++;
      const target = argument(end); if (target === undefined) continue; end = target;
      for (let i = 0; i < 2; i++) { const option = readTeXGroup(text, skipTeXWhitespace(text, end), '[', ']'); if (option) end = option.end; }
      let valid = true;
      for (let i = 0; i < (name.endsWith('environment') ? 2 : 1); i++) { const body = readTeXGroup(text, skipTeXWhitespace(text, end)); if (!body) { valid = false; break; } end = body.end; }
      if (!valid) break;
    } else if (name === 'tikzstyle') {
      const target = argument(end); if (target === undefined) continue;
      end = skipTeXWhitespace(text, target); if (text[end] === '=') end++;
      const style = readTeXGroup(text, skipTeXWhitespace(text, end), '[', ']');
      if (!style) break; end = style.end;
    } else if (name === 'pgfplotstableread') {
      const option = readTeXGroup(text, skipTeXWhitespace(text, end), '[', ']'); if (option) end = option.end;
      const data = argument(end); if (data === undefined) continue;
      const target = argument(data); if (target === undefined) continue; end = target;
    } else if (COUNTS[name]) {
      end = skipTeXWhitespace(text, end); if (text[end] === '*') end++;
      let valid = true;
      for (let i = 0; i < COUNTS[name]!; i++) { const next = argument(end); if (next === undefined) { valid = false; break; } end = next; }
      if (!valid) break;
    } else if (/^(?:input|include|usepackage|RequirePackage|RequirePackageWithOptions|documentclass|LoadClass|LoadClassWithOptions)$/.test(name)) {
      const option = readTeXGroup(text, skipTeXWhitespace(text, end), '[', ']'); if (option) end = option.end;
      const group = readTeXGroup(text, skipTeXWhitespace(text, end));
      if (group) end = group.end;
      else if (name === 'input') end = skipTeXWhitespace(text, end) + (/^[^\s%]+/.exec(text.slice(skipTeXWhitespace(text, end)))?.[0].length ?? 0);
      if (!dependencies) {
        if (group && /^(?:usepackage|RequirePackage|RequirePackageWithOptions)$/.test(name)) {
          const names = group.content.split(',').map((item) => item.trim()).filter((item) => PACKAGES.has(item));
          if (names.length) out.push(`\\usepackage${option ? `[${option.content}]` : ''}{${names.join(',')}}`);
        }
        tokens.lastIndex = end; continue;
      }
    } else if (/(?:true|false)$/.test(name) && conditionals.has('if' + name.replace(/(?:true|false)$/, ''))) {
      // Keep assignments to locally declared TeX booleans in source order.
    } else {
      // Unknown commands' argument bodies are not executed while collecting declarations.
      // This also prevents a macro definition hidden in \texttt{...} leaking into scope.
      for (;;) { const group = readTeXGroup(text, skipTeXWhitespace(text, end)); if (!group) break; end = group.end; }
      tokens.lastIndex = end; continue;
    }
    out.push(source.slice(start, end)); tokens.lastIndex = end;
  }
  return out.length ? out.join('%\n') + '%\n' : '';
}

/** Close only the context's currently open groups after the preview, never before it. */
export function tikzContextEnd(context: string): string {
  const text = maskTeXComments(context);
  let depth = 0;
  const tokens = /\\(begingroup|endgroup)\b|\\.|\{/g;
  for (let token = tokens.exec(text); token; token = tokens.exec(text)) {
    if (token[0] === '{') { const group = readTeXGroup(text, token.index); if (group) tokens.lastIndex = group.end; }
    else if (token[1]) depth += token[1] === 'begingroup' ? 1 : -1;
  }
  return '\\endgroup\n'.repeat(Math.max(0, depth));
}

/** Ignored document-layout packages may own renewcommands unrelated to a picture.
 * Keep existing targets' native semantics; absent targets stay undefined, so using
 * an unsupported command in a picture still produces a real TeX error.
 */
export function guardTikzRedefinitions(source: string): string {
  const text = maskTeXComments(source), tokens = /\\([A-Za-z@]+|.)|\{/g;
  let result = '', cursor = 0;
  for (let token = tokens.exec(text); token; token = tokens.exec(text)) {
    if (token[0] === '{') {
      const group = readTeXGroup(text, token.index); if (group) tokens.lastIndex = group.end;
    } else if (token[1] === 'renewcommand') {
      let at = skipTeXWhitespace(text, tokens.lastIndex); if (text[at] === '*') at = skipTeXWhitespace(text, at + 1);
      const targetGroup = readTeXGroup(text, at);
      const target = targetGroup?.content.trim() ?? /^\\(?:[A-Za-z@]+|.)/.exec(text.slice(at))?.[0];
      if (!target || !/^\\(?:[A-Za-z@]+|.)$/.test(target)) continue;
      at = targetGroup?.end ?? at + target.length;
      for (let i = 0; i < 2; i++) {
        const option = readTeXGroup(text, skipTeXWhitespace(text, at), '[', ']'); if (option) at = option.end;
      }
      const body = readTeXGroup(text, skipTeXWhitespace(text, at)); if (!body) continue;
      result += source.slice(cursor, token.index) + `\\ifdefined${target}%\n${source.slice(token.index, body.end)}%\n\\fi`;
      cursor = tokens.lastIndex = body.end;
    }
  }
  return result + source.slice(cursor);
}

/** Preserve the original document boundary. For snippets without one, start the
 * document before any still-open scope so the frame can close it normally.
 */
export function tikzDocumentContext(context: string): string {
  const text = maskTeXComments(context), tokens = /\\([A-Za-z@]+|.)|\{/g;
  const groups: number[] = [];
  for (let token = tokens.exec(text); token; token = tokens.exec(text)) {
    if (token[0] === '{') {
      const group = readTeXGroup(text, token.index); if (group) tokens.lastIndex = group.end;
    } else if (token[1] === 'begin') {
      const group = readTeXGroup(text, skipTeXWhitespace(text, tokens.lastIndex));
      if (group?.content === 'document') return context;
      if (group) tokens.lastIndex = group.end;
    } else if (token[1] === 'begingroup') groups.push(token.index);
    else if (token[1] === 'endgroup') groups.pop();
  }
  const boundary = groups[0] ?? context.length;
  return context.slice(0, boundary) + '\n\\begin{document}\n' + context.slice(boundary);
}

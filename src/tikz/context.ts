import { maskTeXComments, readTeXGroup, skipTeXWhitespace } from '../core/definitionParser';

const PACKAGES = new Set(['pgfplots', 'pgfplotstable', 'tikz-cd', 'circuitikz', 'chemfig', 'tikz-3dplot', 'array', 'amsmath', 'amstext', 'amsfonts', 'amssymb']);
const COUNTS: Record<string, number> = { usetikzlibrary: 1, usepgfplotslibrary: 1, tikzset: 1, pgfplotsset: 1,
  definecolor: 3, providecolor: 3, colorlet: 2, pgfmathsetmacro: 2, pgfmathtruncatemacro: 2, pgfmathsetlengthmacro: 2,
  setlength: 2, newlength: 1, DeclareMathOperator: 2, pgfmathdeclarefunction: 3,
  pgfplotscreateplotcyclelist: 2, pgfdeclarelayer: 1, pgfsetlayers: 1 };

/** Native declarations stay in source order, including TeX groups and parameter delimiters. */
export function extractTikzPreamble(source: string, dependencies = false): string {
  const text = maskTeXComments(source);
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
      if (group.content !== 'document') out.push(name === 'begin' ? '\\begingroup' : '\\endgroup');
      tokens.lastIndex = end; continue;
    }
    if (/^(?:global|long|outer|protected)$/.test(name)) {
      // Keep prefixes attached to the declaration; never leave a bare \global.
      const next = /^\s*(?:\\(?:global|long|outer|protected)\s*)*\\(?:[gex]?def|let)\b/.exec(text.slice(end));
      if (next) { out.push(token[0]); continue; }
    }
    if (/^(?:if[a-zA-Z@]*|unless)$/.test(name)) {
      let bodyStart = end;
      if (name === 'ifdefined') bodyStart = argument(end) ?? end;
      let depth = name === 'unless' ? 0 : 1;
      const condition = /\\(if[a-zA-Z@]*|fi)\b/g; condition.lastIndex = end;
      for (let part = condition.exec(text); part; part = condition.exec(text)) {
        depth += part[1] === 'fi' ? -1 : 1;
        if (!depth) { end = condition.lastIndex; break; }
      }
      if (depth) throw new Error('TikZ 前置条件尚未闭合 / Unclosed TeX conditional');
      out.push(/^(?:iftrue|iffalse|ifdefined)$/.test(name)
        ? source.slice(start, bodyStart) + '%\n' + extractTikzPreamble(source.slice(bodyStart, end - 3), dependencies) + '\\fi'
        : source.slice(start, end));
      tokens.lastIndex = end; continue;
    }
    if (/^[gex]?def$/.test(name)) {
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
    } else if (/^(?:input|include|usepackage|RequirePackage|documentclass)$/.test(name)) {
      const option = readTeXGroup(text, skipTeXWhitespace(text, end), '[', ']'); if (option) end = option.end;
      const group = readTeXGroup(text, skipTeXWhitespace(text, end));
      if (group) end = group.end;
      else if (name === 'input') end = skipTeXWhitespace(text, end) + (/^[^\s%]+/.exec(text.slice(skipTeXWhitespace(text, end)))?.[0].length ?? 0);
      if (!dependencies) {
        if (group && /^(?:usepackage|RequirePackage)$/.test(name)) {
          const names = group.content.split(',').map((item) => item.trim()).filter((item) => PACKAGES.has(item));
          if (names.length) out.push(`\\usepackage${option ? `[${option.content}]` : ''}{${names.join(',')}}`);
        }
        tokens.lastIndex = end; continue;
      }
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

import { maskTeXComments, readTeXGroup, skipTeXWhitespace } from '../core/definitionParser';
import { extractTikzPreamble, tikzContextEnd } from './context';
export { extractTikzPreamble } from './context';

export const TIKZ_ENVIRONMENTS = ['tikzpicture', 'tikzcd', 'pgfpicture', 'circuitikz'] as const;
const PICTURE = /\\begin\s*\{(tikzpicture|tikzcd|pgfpicture|circuitikz)\}/;
// The pinned Ximera SVG driver inherits an unimplemented PGF definition hook.
// Emit pattern/symbol definitions into the same SVG protocol as the picture.
const SVG_DRIVER = String.raw`\makeatletter
\def\pgf@sys@svg@make@defs#1#2{\pgfsysprotocol@literal{<defs>#2</defs>}}
\def\pgf@sys@svg@ref@defs#1{}
\makeatother
`;

export function containsTikz(source: string): boolean {
  return PICTURE.test(maskTeXComments(source));
}

/** 只修复渲染副本中的网页空格和未闭合环境；不向绘图语法中插入公式光标。 */
export function prepareTikzSource(source: string): string {
  const normalized = source.replace(/&#(?:x0*20|0*32);|&#(?:x0*a0|0*160);|&nbsp;/gi, ' ');
  const masked = maskTeXComments(normalized);
  const start = PICTURE.exec(masked)?.index;
  if (start === undefined) throw new Error('未找到 TikZ 图形 / No TikZ picture found');
  const stack: string[] = [];
  const heads = /\\(begin|end)\s*\{([A-Za-z@][A-Za-z0-9@:_*-]*)\}/g;
  heads.lastIndex = start;
  let end = normalized.length;
  for (let head = heads.exec(masked); head; head = heads.exec(masked)) {
    const name = head[2]!;
    if (head[1] === 'begin') stack.push(name);
    else if (stack.at(-1) === name) stack.pop();
    else throw new Error(`环境不匹配 / Mismatched environment: ${name}`);
    if (stack.length === 0) { end = heads.lastIndex; break; }
  }
  const context = extractTikzPreamble(normalized.slice(0, start));
  return context + '\n' + normalized.slice(start, end) + '\n' + stack.reverse().map((name) => `\\end{${name}}`).join('\n') + '\n' + tikzContextEnd(context);
}

export function tikzSetup(expression: string, prelude: string): { preamble: string; context: string; expression: string } {
  const source = maskTeXComments(expression + '\n' + prelude);
  const plots = /\\begin\s*\{(?:axis|semilogxaxis|semilogyaxis|loglogaxis|groupplot|polaraxis|smithchart|ternaryaxis)\}|\\(?:pgfplotsset|usepgfplotslibrary)\b/.test(source);
  const loaded = new Set<string>();
  let header = '', libraries = '';
  const extractPackages = (text: string): string => {
    const masked = maskTeXComments(text), tokens = /\\([A-Za-z@]+|.)|\{/g;
    let result = '', cursor = 0, conditionDepth = 0;
    for (let token = tokens.exec(masked); token; token = tokens.exec(masked)) {
      if (token[0] === '{') { const group = readTeXGroup(masked, token.index); if (group) tokens.lastIndex = group.end; }
      else if (/^if[A-Za-z@]*$/.test(token[1] ?? '')) conditionDepth++;
      else if (token[1] === 'fi') conditionDepth = Math.max(0, conditionDepth - 1);
      else if (/^(?:usepackage|RequirePackage|usetikzlibrary|usepgfplotslibrary)$/.test(token[1] ?? '')) {
        const isLibrary = token[1]!.endsWith('library');
        let end = skipTeXWhitespace(masked, tokens.lastIndex);
        const option = readTeXGroup(masked, end, '[', ']'); if (option) end = skipTeXWhitespace(masked, option.end);
        const group = readTeXGroup(masked, end); if (!group) continue;
        if (conditionDepth) { tokens.lastIndex = group.end; continue; }
        // Literal libraries can require preamble-only LaTeX packages (e.g. dateplot).
        // Dynamic library names retain their definition order in the native context.
        if (isLibrary && !/^[\w., /-]+$/.test(group.content)) { tokens.lastIndex = group.end; continue; }
        if (isLibrary) libraries += text.slice(token.index, group.end) + '\n';
        else {
          header += text.slice(token.index, group.end) + '\n';
          for (const name of group.content.split(',')) loaded.add(name.trim());
        }
        result += text.slice(cursor, token.index); cursor = tokens.lastIndex = group.end;
      }
    }
    return result + text.slice(cursor);
  };
  const context = extractPackages(prelude), picture = extractPackages(expression);
  for (const [needed, name] of [[plots, 'pgfplots'], [/\\begin\s*\{tikzcd\}/.test(source), 'tikz-cd'], [/\\begin\s*\{circuitikz\}/.test(source), 'circuitikz']] as const) {
    if (needed && !loaded.has(name)) header += `\\usepackage{${name}}\n`;
  }
  if (plots) header += '\\pgfplotsset{compat=1.18}\n';
  for (const [environment, library] of [['groupplot', 'groupplots'], ['polaraxis', 'polar'], ['smithchart', 'smithchart'], ['ternaryaxis', 'ternary']]) {
    if (new RegExp(`\\\\begin\\s*\\{${environment}\\}`).test(source)) header += `\\usepgfplotslibrary{${library}}\n`;
  }
  return { preamble: `\\nonstopmode\n${header}${libraries}${SVG_DRIVER}`, context, expression: picture };
}

export function tikzDocument(expression: string, prelude: string): string {
  const { preamble, context, expression: picture } = tikzSetup(expression, prelude);
  return `${preamble}\n\\begin{document}\n${context}\n${picture}\n${tikzContextEnd(context)}\\end{document}\n`;
}

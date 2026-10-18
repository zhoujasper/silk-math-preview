import { maskTeXComments, readTeXGroup, skipTeXWhitespace } from '../core/definitionParser';
import { extractTikzPreamble, tikzContextEnd, tikzConditionals, tikzConditionBody, guardTikzRedefinitions, tikzDocumentContext } from './context';
export { extractTikzPreamble } from './context';

export const TIKZ_ENVIRONMENTS = ['tikzpicture', 'tikzcd', 'pgfpicture', 'circuitikz'] as const;
const PICTURE = /\\begin\s*\{(tikzpicture|tikzcd|pgfpicture|circuitikz)\}/;
// The pinned Ximera SVG driver inherits an unimplemented PGF definition hook.
// Emit pattern/symbol definitions into the same SVG protocol as the picture.
const SVG_DRIVER = String.raw`\makeatletter
\def\pgf@sys@svg@make@defs#1#2{\pgfsysprotocol@literal{<defs>#2</defs>}}
\def\pgf@sys@svg@ref@defs#1{}
% Ximera 的嵌套图形位于 stroke="none" 的文字层内，必须恢复 PGF 当前描边色。
\def\pgfsys@beginpicture{\pgfsys@svg@boxmodefalse\pgfsys@invoke{<svg beginpicture><g
\ifdefined\pgf@sys@svg@last@stroke\ifx\pgf@sys@svg@last@stroke\relax\else stroke="\pgf@sys@svg@last@stroke"\fi\fi
\space stroke-miterlimit="10" transform="translate({?x},{?y}) scale(1,-1)">}}
\makeatother
`;

export function containsTikz(source: string): boolean {
  return PICTURE.test(maskTeXComments(source));
}

/** Keep the native TeX layout of math surrounding (possibly several) pictures. */
function mixedMathSource(source: string): string | undefined {
  const fence = /^ {0,3}(`{3,}|~{3,})math[^\S\r\n]*\r?\n([\s\S]*?)(?:\r?\n {0,3}\1[~`]*\s*)?$/.exec(source);
  if (fence) return mixedMathSource('\\[\n' + fence[2] + '\n\\]');
  const fullMasked = maskTeXComments(source);
  const masked = fullMasked.trim();
  const start = fullMasked.search(/\S/);
  let body: string, display = false;
  const delimiter = masked.startsWith('$$') ? '$$' : masked.startsWith('$') ? '$'
    : masked.startsWith('\\[') ? '\\[' : masked.startsWith('\\(') ? '\\(' : undefined;
  if (!delimiter || start < 0) return undefined;
  const closer = delimiter === '\\[' ? '\\]' : delimiter === '\\(' ? '\\)' : delimiter;
  display = delimiter === '$$' || delimiter === '\\[';
  const end = masked.endsWith(closer) ? fullMasked.lastIndexOf(closer) : source.length;
  body = source.slice(start + delimiter.length, end);
  // GitHub's code-style math delimiters are not TeX syntax.
  if (body.startsWith('`') && body.endsWith('`')) body = body.slice(1, -1);
  const plain = maskTeXComments(body).trim();
  const first = PICTURE.exec(plain);
  if (!first) return undefined;
  // A single picture keeps its original dimensions and byte-identical output.
  if (first.index === 0) {
    const heads = /\\(begin|end)\s*\{([^}]+)\}/g;
    let depth = 0;
    for (let head = heads.exec(plain); head; head = heads.exec(plain)) {
      depth += head[1] === 'begin' ? 1 : -1;
      if (!depth) { if (heads.lastIndex === plain.length) return undefined; break; }
    }
    if (depth > 0) return undefined;
  }
  // A primitive PGF node supplies one measured SVG surface. TeX lays out operators, stretchy
  // delimiters and nested pictures together; the 1pt inset protects edge strokes.
  return '\\begin{pgfpicture}\\newtoks\\silkPreviewMathBody\\silkPreviewMathBody={$'
    + (display ? '\\displaystyle ' : '') + body.trim()
    + '\n$}\\pgfset{inner sep=1pt,outer sep=0pt}'
    + '\\pgfnode{rectangle}{center}{\\the\\silkPreviewMathBody}{}{\\pgfusepath{discard}}\\end{pgfpicture}';
}

/** 只修复渲染副本中的网页空格和未闭合环境；不向绘图语法中插入公式光标。 */
export function prepareTikzSource(source: string): string {
  const normalized = source.replace(/&#(?:x0*20|0*32);|&#(?:x0*a0|0*160);|&nbsp;/gi, ' ');
  const mixed = mixedMathSource(normalized);
  if (mixed) return mixed;
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
  return context + '\n' + normalized.slice(start, end) + '\n' + stack.reverse().map((name) => `\\end{${name}}`).join('\n');
}

export function tikzSetup(expression: string, prelude: string): { preamble: string; context: string; expression: string } {
  const pictureStart = PICTURE.exec(maskTeXComments(expression))?.index ?? 0;
  prelude += '\n' + expression.slice(0, pictureStart);
  expression = expression.slice(pictureStart);
  const source = maskTeXComments(expression + '\n' + prelude);
  const plots = /\\begin\s*\{(?:axis|semilogxaxis|semilogyaxis|loglogaxis|groupplot|polaraxis|smithchart|ternaryaxis)\}|\\(?:pgfplotsset|usepgfplotslibrary)\b/.test(source);
  const loaded = new Set<string>();
  const conditionals = tikzConditionals(source);
  let header = '', libraries = '';
  const extractPackages = (text: string): string => {
    const masked = maskTeXComments(text), tokens = /\\([A-Za-z@]+|.)|\{/g;
    let result = '', cursor = 0, conditionDepth = 0;
    for (let token = tokens.exec(masked); token; token = tokens.exec(masked)) {
      if (token[0] === '{') { const group = readTeXGroup(masked, token.index); if (group) tokens.lastIndex = group.end; }
      else if (token[1] === 'newif') tokens.lastIndex = tikzConditionBody(masked, 'ifdefined', tokens.lastIndex);
      else if (conditionals.has(token[1] ?? '')) {
        conditionDepth++;
        tokens.lastIndex = tikzConditionBody(masked, token[1]!, tokens.lastIndex);
      }
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
  for (const [needed, name] of [[/\\(?:leadsto|mathbb|mathfrak|square|blacksquare)\b/.test(source), 'amssymb'], [/\\(?:DeclareMathOperator|operatorname)\b/.test(source), 'amsmath'], [plots, 'pgfplots'], [/\\begin\s*\{tikzcd\}|\\tikzcdset\b/.test(source), 'tikz-cd'], [/\\begin\s*\{circuitikz\}/.test(source), 'circuitikz']] as const) {
    if (needed && !loaded.has(name)) header += `\\usepackage{${name}}\n`;
  }
  if (plots) header += '\\pgfplotsset{compat=1.18}\n';
  for (const [environment, library] of [['groupplot', 'groupplots'], ['polaraxis', 'polar'], ['smithchart', 'smithchart'], ['ternaryaxis', 'ternary']]) {
    if (new RegExp(`\\\\begin\\s*\\{${environment}\\}`).test(source)) header += `\\usepgfplotslibrary{${library}}\n`;
  }
  return { preamble: `\\nonstopmode\n${header}${libraries}${SVG_DRIVER}`, context: guardTikzRedefinitions(context), expression: picture };
}

export function tikzDocument(expression: string, prelude: string): string {
  const { preamble, context, expression: picture } = tikzSetup(expression, prelude);
  return `${preamble}\n${tikzDocumentContext(context)}\n${picture}\n${tikzContextEnd(context)}\\end{document}\n`;
}

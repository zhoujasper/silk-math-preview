import { cleanRecognizedLatex } from './ocrCompose';

export interface FormulaStructure {
  readonly latex: string;
  readonly valid: boolean;
  readonly suspicious: boolean;
  readonly simplified: boolean;
}

interface Group { readonly body: string; readonly end: number }

function groupAt(text: string, start: number): Group | undefined {
  while (/\s/.test(text[start] ?? '') && start < text.length) start++;
  if (text[start] !== '{') return undefined;
  const begin = ++start;
  let depth = 1;
  for (; start < text.length; start++) {
    if (text[start] === '\\') { start++; continue; }
    if (text[start] === '{') depth++;
    if (text[start] === '}' && --depth === 0) return { body: text.slice(begin, start), end: start + 1 };
  }
  return undefined;
}

/** 花括号与环境同时检查；未闭合、孤立 hline 不能被当作识别成功。 */
export function validFormulaStructure(text: string): boolean {
  let depth = 0;
  const environments: string[] = [];
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (char === '\\') {
      const command = /^\\([A-Za-z]+|[^A-Za-z])/.exec(text.slice(i))?.[1] ?? '';
      i += command.length;
      if (command === 'begin' || command === 'end') {
        const group = groupAt(text, i + 1);
        if (!group) return false;
        const name = group.body.trim();
        if (!/^[A-Za-z*]+$/.test(name)) return false;
        if (command === 'begin') environments.push(name);
        else if (environments.pop() !== name) return false;
        i = group.end - 1;
      } else if (/^(?:hline|cline|toprule|midrule|bottomrule)$/.test(command) && !environments.length) return false;
      continue;
    }
    if (char === '{') depth++;
    else if (char === '}' && --depth < 0) return false;
    else if (char === '&' && !environments.length) return false;
  }
  return depth === 0 && environments.length === 0 && text.trim().length > 0;
}

function emptyCell(text: string): boolean {
  return text.replace(/\\(?:hline|toprule|midrule|bottomrule)\b/g, '').replace(/[{}\s]/g, '') === '';
}

/** 仅拆顶层单元格；分式、转义 &、嵌套矩阵中的分隔符都属于原单元格。 */
function arrayRows(body: string): string[][] | undefined {
  const rows: string[][] = [[]];
  let depth = 0, environmentDepth = 0, start = 0;
  for (let i = 0; i < body.length; i++) {
    const char = body[i];
    if (char === '\\') {
      const command = /^\\([A-Za-z]+|[^A-Za-z])/.exec(body.slice(i))?.[1] ?? '';
      if (command === 'begin') environmentDepth++;
      if (command === 'end') environmentDepth--;
      if (command === '\\' && depth === 0 && environmentDepth === 0) {
        rows[rows.length - 1]!.push(body.slice(start, i)); rows.push([]);
        i++; start = i + 1; continue;
      }
      i += command.length; continue;
    }
    if (char === '{') depth++;
    else if (char === '}') depth--;
    else if (char === '&' && depth === 0 && environmentDepth === 0) {
      rows[rows.length - 1]!.push(body.slice(start, i)); start = i + 1;
    }
    if (depth < 0 || environmentDepth < 0) return undefined;
  }
  if (depth || environmentDepth) return undefined;
  rows[rows.length - 1]!.push(body.slice(start));
  return rows;
}

/** 压缩模型的 token 空白，保留控制词分界和 text/mbox 等文字内容。 */
export function tidyFormula(text: string): string {
  let result = '';
  let controlWord = false;
  for (let i = 0; i < text.length;) {
    const command = /^\\(?:text(?:bf|it|normal|rm|sf|tt)?|mbox|hbox|operatorname)\*?\b/.exec(text.slice(i));
    if (command) {
      const group = groupAt(text, i + command[0].length);
      if (group) { result += command[0] + '{' + group.body + '}'; i = group.end; controlWord = false; continue; }
    }
    if (/\s/.test(text[i]!)) { i++; continue; }
    if (text[i] === '\\') {
      const token = /^\\([A-Za-z]+|[^A-Za-z])/.exec(text.slice(i));
      if (token) {
        result += token[0]; i += token[0].length;
        controlWord = /^[A-Za-z]+$/.test(token[1]!); continue;
      }
    }
    if (controlWord && /[A-Za-z]/.test(text[i]!)) result += ' ';
    controlWord = false;
    result += text[i]; i++;
  }
  return result.trim();
}

export function inspectFormula(raw: string, singleLine = false, gridColumns?: number): FormulaStructure {
  const text = cleanRecognizedLatex(raw);
  const valid = validFormulaStructure(text);
  let simplified = false, suspicious = !valid, latex = text;
  const begin = /^\\begin\s*\{array\}/.exec(text);
  const end = /\\end\s*\{array\}\s*$/.exec(text);
  if (gridColumns !== undefined && !/\\begin\s*\{(?:array|tabular|matrix)\}/.test(text)) suspicious = true;
  if (valid && begin && end) {
    const spec = groupAt(text, begin[0].length);
    // 带竖线、宽度声明、跨行/跨列的真表格不在此规则内。
    if (spec && /^[clr|\s]+$/.test(spec.body) && !/\\(?:multirow|multicolumn|cline)\b/.test(text)) {
      const rows = arrayRows(text.slice(spec.end, end.index));
      const occupied = rows?.map(row => row.filter(cell => !emptyCell(cell))).filter(row => row.length);
      const emptyRows = rows?.filter(row => row.every(emptyCell)).length ?? 0;
      const widths = rows?.filter(row => row.some(cell => !emptyCell(cell))).map(row => row.length) ?? [];
      const columns = spec.body.replace(/[^clr]/g, '').length;
      if (widths.some(width => width > columns) || (widths.length > 0 && widths.every(width => width === widths[0]) && widths[0] !== columns)) suspicious = true;
      if (gridColumns !== undefined && columns !== gridColumns) suspicious = true;
      if (singleLine && !spec.body.includes('|') && occupied?.length === 1 && emptyRows >= 2) {
        suspicious = true; simplified = true;
        latex = occupied[0]!.map(cell => {
          let value = cell.replace(/\\hline\b/g, '').trim();
          const outer = groupAt(value, 0);
          if (outer?.end === value.length) value = outer.body.trim();
          return value;
        }).join(' \\qquad ');
      }
    }
  }
  return { latex: tidyFormula(latex), valid, suspicious, simplified };
}

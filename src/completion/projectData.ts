import { maskTeXComments, readTeXGroup, skipTeXWhitespace } from '../core/definitionParser';
import { parseDependencies } from '../core/dependencyParser';
import { maskMarkdownCode } from '../core/markdownDefinitions';

export interface ProjectKey {
  readonly key: string;
  readonly detail: string;
  readonly source: string;
}
export interface ProjectSource {
  readonly labels: readonly ProjectKey[];
  readonly citations: readonly ProjectKey[];
  readonly dependencies: readonly string[];
  readonly bibliographies: readonly string[];
  readonly root: string | undefined;
}

/** Literal keys only: a label produced dynamically by TeX is not a known label. */
export function validKey(key: string): boolean {
  return key.length > 0 && key.length <= 512 && !/[\s,{}\\%#]/.test(key);
}

export function parseProjectSource(text: string, source: string, markdown = false): ProjectSource {
  const masked = maskTeXComments(markdown ? maskMarkdownCode(text) : text);
  const labels: ProjectKey[] = [], citations: ProjectKey[] = [], bibliographies: string[] = [];
  for (const match of masked.matchAll(/(\\+)(label|bibitem|bibliography|addbibresource)\b/g)) {
    if (match[1]!.length % 2 === 0) continue;
    let index = skipTeXWhitespace(masked, match.index! + match[0].length);
    const optional = readTeXGroup(masked, index, '[', ']');
    if (optional) index = skipTeXWhitespace(masked, optional.end);
    const group = readTeXGroup(masked, index);
    if (!group) continue;
    if (match[2] === 'bibliography' || match[2] === 'addbibresource') {
      bibliographies.push(...group.content.split(',').map(name => name.trim()).filter(Boolean));
    } else if (validKey(group.content)) {
      const detail = masked.slice(Math.max(0, match.index! - 100), Math.min(masked.length, group.end + 140))
        .replace(/\s+/g, ' ').trim();
      (match[2] === 'label' ? labels : citations).push({ key: group.content, detail, source });
    }
  }
  return { labels, citations, bibliographies,
    dependencies: parseDependencies(text, source, masked).filter(dependency => dependency.resolution === 'literal'
      && (dependency.kind === 'input' || dependency.kind === 'include')).map(dependency => dependency.name),
    root: /^\s*%\s*!\s*TeX\s+root\s*=\s*([^\r\n]+)/im.exec(text.slice(0, 8192))?.[1]?.trim().replace(/^"|"$/g, ''),
  };
}

/** Balanced BibTeX entries: braces/quotes in titles and @comment blocks do not create fake keys. */
export function parseBibKeys(text: string, source: string): readonly ProjectKey[] {
  const entries: ProjectKey[] = [];
  const pattern = /@([A-Za-z]+)\s*([{(])/g;
  for (let match = pattern.exec(text); match; match = pattern.exec(text)) {
    if (/^\s*%/.test(text.slice(text.lastIndexOf('\n', match.index) + 1, match.index))) continue;
    const open = match[2]!, close = open === '{' ? '}' : ')';
    const start = pattern.lastIndex;
    let depth = 1, braces = 0, quote = false, end = start;
    for (; end < text.length && depth > 0; end++) {
      const char = text[end];
      if (char === '\\') { end++; continue; }
      if (char === '"' && braces === 0) quote = !quote;
      if (quote) continue;
      if (char === '{') braces++;
      if (char === '}') braces--;
      if (char === open) depth++;
      if (char === close && (open === '{' || braces === 0)) depth--;
    }
    if (depth !== 0) break;
    pattern.lastIndex = end;
    if (/^(comment|string|preamble)$/i.test(match[1]!)) continue;
    const content = text.slice(start, end - 1);
    const comma = content.indexOf(',');
    if (comma < 0) continue;
    const key = content.slice(0, comma).trim();
    if (!validKey(key)) continue;
    const fields = new Map<string, string>();
    const fieldPattern = /(?:^|,)\s*(title|author|year)\s*=\s*/gi;
    for (let field = fieldPattern.exec(content.slice(comma)); field; field = fieldPattern.exec(content.slice(comma))) {
      const fieldStart = comma + fieldPattern.lastIndex;
      const group = readTeXGroup(content, fieldStart);
      const quoted = content[fieldStart] === '"' ? /^"((?:\\.|[^"\\])*)"/.exec(content.slice(fieldStart)) : undefined;
      const value = group?.content ?? quoted?.[1] ?? /^[^,]+/.exec(content.slice(fieldStart))?.[0] ?? '';
      fields.set(field[1]!.toLowerCase(), value.replace(/[{}]/g, '').replace(/\s+/g, ' ').trim().slice(0, 240));
      fieldPattern.lastIndex = fieldStart - comma + (group ? group.end - fieldStart : quoted ? quoted[0].length : value.length);
    }
    entries.push({ key, source, detail: [fields.get('author'), fields.get('year'), fields.get('title')].filter(Boolean).join(' · ') || match[1]! });
  }
  return entries;
}

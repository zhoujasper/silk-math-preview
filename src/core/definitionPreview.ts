import { parseDefinitions, type ParsedDefinition } from './definitionParser';

const PLACEHOLDERS = ['x', 'y', 'z', 'u', 'v'] as const;

function withoutDefinitionBodies(source: string): string {
  const definitions = parseDefinitions(source, '<preview>');
  if (definitions.length === 0) return source;
  const ranges = definitions
    .map((item) => ({ start: item.source.startOffset, end: item.source.endOffset }))
    .sort((left, right) => left.start - right.start);
  let output = '';
  let cursor = 0;
  for (const range of ranges) {
    if (range.start > cursor) output += source.slice(cursor, range.start);
    cursor = Math.max(cursor, range.end);
  }
  return output + source.slice(cursor);
}

function isEffectivelyEmpty(text: string): boolean {
  return text.replace(/(^|[^\\])%[^\n]*/g, '$1').replace(/\s+/g, '').length === 0;
}

/** `$ \def\A{\mathbf{A}} $` 这类只有声明、没有排版内容的公式。 */
export function isDefinitionOnlySource(source: string): boolean {
  const definitions = parseDefinitions(source, '<preview>');
  if (definitions.length === 0) return false;
  return isEffectivelyEmpty(withoutDefinitionBodies(source));
}

function controlName(definition: ParsedDefinition): string {
  return definition.name.startsWith('\\') ? definition.name : `\\${definition.name}`;
}

function sampleFor(definition: ParsedDefinition): string | undefined {
  if (definition.kind === 'color') {
    return `\\textcolor{${definition.name}}{A}`;
  }
  if (definition.kind !== 'command') return undefined;
  if (definition.limitations.includes('missing-or-unbalanced-replacement')) return undefined;
  const mandatory = definition.arguments.filter((item) => item.kind === 'mandatory');
  const name = controlName(definition);
  if (mandatory.length === 0) return name;
  const args = mandatory
    .map((_, index) => `{${PLACEHOLDERS[index] ?? 't'}}`)
    .join('');
  return `${name}${args}`;
}

/**
 * 在声明后面补上刚定义的命令，让 MathJax 有东西可画。
 * `\def\A{\mathbf{A}}` → `\A`，`\newcommand{\norm}[1]{...}` → `\norm{x}`。
 */
export function definitionPreviewSample(source: string): string | undefined {
  const samples = parseDefinitions(source, '<preview>')
    .map(sampleFor)
    .filter((item): item is string => item !== undefined);
  if (samples.length === 0) return undefined;
  return samples.join('\\;');
}

/** 声明保留（否则命令未定义），后面接展开样例。 */
export function withDefinitionPreviewSample(expression: string, source: string): string {
  const sample = definitionPreviewSample(source);
  if (!sample) return expression;
  return `${expression}${sample}`;
}

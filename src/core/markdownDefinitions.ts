import type { ParsedDefinition } from './definitionParser.js';
import { parseDefinitions } from './definitionParser.js';
import type { ParsedDependency } from './dependencyParser.js';
import { parseDependencies } from './dependencyParser.js';
import { scanMathRegions } from './mathScanner.js';
import type { TextRange } from './types.js';

export interface MarkdownDefinitionResult {
  readonly definitions: readonly ParsedDefinition[];
  readonly dependencies: readonly ParsedDependency[];
  readonly frontMatterRange?: TextRange;
}

interface FrontMatter {
  readonly contentStart: number;
  readonly contentEnd: number;
  readonly end: number;
}

interface YamlPathEntry {
  readonly indent: number;
  readonly key: string;
}

interface ParsedMacroValue {
  readonly replacement: string;
  readonly argumentCount: number;
  readonly defaultValue?: string;
}

const COMMAND_NAME = /^\\?[A-Za-z@]+$/;

/**
 * 解析 Markdown 中可安全静态读取的数学定义。
 *
 * 支持 YAML frontmatter 的 `macros` / `math.macros` 简单映射，以及正文中的
 * TeX 声明。代码围栏和 inline code 会被遮蔽，所有 offset 仍对应原文。
 */
export function parseMarkdownDefinitionSource(
  text: string,
  sourceId = '<markdown>',
  endOffset = text.length,
): MarkdownDefinitionResult {
  const limit = Math.max(0, Math.min(text.length, Math.floor(endOffset)));
  const source = text.slice(0, limit);
  const frontMatter = findFrontMatter(source);
  const yamlDefinitions = frontMatter
    ? parseFrontMatterMacros(source, sourceId, frontMatter)
    : [];

  const masked = maskMarkdownCode(source);
  const withoutFrontMatter = frontMatter
    ? maskRange(masked, { start: 0, end: frontMatter.end })
    : masked;

  const definitions = [
    ...yamlDefinitions,
    ...parseDefinitions(withoutFrontMatter, sourceId),
  ].sort((left, right) => left.source.startOffset - right.source.startOffset);

  const result = {
    definitions,
    dependencies: parseDependencies(withoutFrontMatter, sourceId),
  };
  return frontMatter
    ? { ...result, frontMatterRange: { start: 0, end: frontMatter.end } }
    : result;
}

export function parseMarkdownDefinitions(
  text: string,
  sourceId = '<markdown>',
  endOffset = text.length,
): readonly ParsedDefinition[] {
  return parseMarkdownDefinitionSource(text, sourceId, endOffset).definitions;
}

/** 仅遮蔽 Markdown code，保留 UTF-16 长度和换行。 */
export function maskMarkdownCode(text: string): string {
  const ignored = scanMathRegions(text, { language: 'markdown' }).ignoredRanges;
  let result = text;
  // 从后往前替换，避免任何区间在处理过程中发生位移。
  for (let index = ignored.length - 1; index >= 0; index -= 1) {
    const range = ignored[index];
    if (!range) {
      continue;
    }
    const replacement = text.slice(range.start, range.end).replace(/[^\r\n]/g, ' ');
    result = result.slice(0, range.start) + replacement + result.slice(range.end);
  }
  return result;
}

function findFrontMatter(text: string): FrontMatter | undefined {
  const bomLength = text.charCodeAt(0) === 0xfeff ? 1 : 0;
  const firstEnd = lineEnd(text, bomLength);
  if (text.slice(bomLength, firstEnd).trim() !== '---') {
    return undefined;
  }

  let cursor = nextLineStart(text, firstEnd);
  const contentStart = cursor;
  while (cursor <= text.length) {
    const end = lineEnd(text, cursor);
    const line = text.slice(cursor, end).trim();
    if (line === '---' || line === '...') {
      return {
        contentStart,
        contentEnd: cursor,
        end: nextLineStart(text, end),
      };
    }
    if (end >= text.length) {
      break;
    }
    cursor = nextLineStart(text, end);
  }
  return undefined;
}

function parseFrontMatterMacros(
  text: string,
  sourceId: string,
  frontMatter: FrontMatter,
): readonly ParsedDefinition[] {
  const definitions: ParsedDefinition[] = [];
  const stack: YamlPathEntry[] = [];
  let cursor = frontMatter.contentStart;

  while (cursor < frontMatter.contentEnd) {
    const end = Math.min(lineEnd(text, cursor), frontMatter.contentEnd);
    const rawLine = text.slice(cursor, end);
    const match = /^(\s*)([^:#][^:]*?):(?:\s*)(.*)$/.exec(rawLine);
    if (!match || rawLine.trimStart().startsWith('#')) {
      cursor = nextLineStart(text, end);
      continue;
    }

    const indent = (match[1] ?? '').replace(/\t/g, '  ').length;
    const key = decodeYamlKey((match[2] ?? '').trim());
    const rawValue = (match[3] ?? '').trim();
    while ((stack.at(-1)?.indent ?? -1) >= indent) {
      stack.pop();
    }
    const parentPath = stack.map((entry) => entry.key);
    const path = [...parentPath, key];

    if (isMacroContainer(path) && rawValue.startsWith('{')) {
      definitions.push(...parseFlowMacros(
        rawValue,
        sourceId,
        cursor,
        end,
        text,
      ));
    } else if (isMacroParent(parentPath) && rawValue.length > 0) {
      const definition = makeYamlDefinition(
        key,
        rawValue,
        sourceId,
        cursor,
        end,
        text,
      );
      if (definition) {
        definitions.push(definition);
      }
    }

    if (rawValue.length === 0) {
      stack.push({ indent, key });
    }
    cursor = nextLineStart(text, end);
  }
  return definitions;
}

function isMacroContainer(path: readonly string[]): boolean {
  return path.length === 1 && path[0] === 'macros' ||
    path.length === 2 && path[0] === 'math' && path[1] === 'macros' ||
    path.length === 1 && path[0] === 'math.macros';
}

function isMacroParent(path: readonly string[]): boolean {
  return isMacroContainer(path);
}

function parseFlowMacros(
  rawValue: string,
  sourceId: string,
  start: number,
  end: number,
  text: string,
): readonly ParsedDefinition[] {
  const close = rawValue.lastIndexOf('}');
  if (close <= 0) {
    return [];
  }
  const definitions: ParsedDefinition[] = [];
  for (const entry of splitTopLevel(rawValue.slice(1, close), ',')) {
    const separator = findTopLevel(entry, ':');
    if (separator < 0) {
      continue;
    }
    const definition = makeYamlDefinition(
      decodeYamlKey(entry.slice(0, separator).trim()),
      entry.slice(separator + 1).trim(),
      sourceId,
      start,
      end,
      text,
    );
    if (definition) {
      definitions.push(definition);
    }
  }
  return definitions;
}

function makeYamlDefinition(
  rawName: string,
  rawValue: string,
  sourceId: string,
  start: number,
  end: number,
  sourceText: string,
): ParsedDefinition | undefined {
  if (!COMMAND_NAME.test(rawName)) {
    return undefined;
  }
  const name = rawName.startsWith('\\') ? rawName.slice(1) : rawName;
  const value = parseMacroValue(rawValue);
  if (!value) {
    return undefined;
  }

  const countPart = value.argumentCount > 0 ? `[${value.argumentCount}]` : '';
  const defaultPart = value.defaultValue === undefined ? '' : `[${value.defaultValue}]`;
  const declaration = `\\newcommand{\\${name}}${countPart}${defaultPart}{${value.replacement}}`;
  const parsed = parseDefinitions(declaration, sourceId)[0];
  if (!parsed) {
    return undefined;
  }
  const location = offsetToLocation(sourceText, start);
  return {
    ...parsed,
    source: {
      id: sourceId,
      startOffset: start,
      endOffset: end,
      line: location.line,
      column: location.column,
    },
  };
}

function parseMacroValue(rawValue: string): ParsedMacroValue | undefined {
  const clean = stripYamlComment(rawValue).trim();
  if (!clean || clean === '|' || clean === '>') {
    return undefined;
  }

  let replacement: string;
  let explicitCount: number | undefined;
  let defaultValue: string | undefined;
  if (clean.startsWith('[') && clean.endsWith(']')) {
    const parts = splitTopLevel(clean.slice(1, -1), ',').map((part) => part.trim());
    replacement = decodeYamlScalar(parts[0] ?? '');
    const count = Number.parseInt(decodeYamlScalar(parts[1] ?? ''), 10);
    if (Number.isInteger(count) && count >= 0 && count <= 9) {
      explicitCount = count;
    }
    if (parts.length >= 3) {
      defaultValue = decodeYamlScalar(parts[2] ?? '');
    }
  } else {
    replacement = decodeYamlScalar(clean);
  }
  if (!replacement) {
    return undefined;
  }
  const inferredCount = [...replacement.matchAll(/#([1-9])/g)]
    .reduce((maximum, match) => Math.max(maximum, Number.parseInt(match[1] ?? '0', 10)), 0);
  const argumentCount = Math.max(explicitCount ?? inferredCount, defaultValue === undefined ? 0 : 1);
  return {
    replacement,
    argumentCount,
    ...(defaultValue === undefined ? {} : { defaultValue }),
  };
}

function decodeYamlKey(value: string): string {
  return decodeYamlScalar(value);
}

function decodeYamlScalar(value: string): string {
  const trimmed = value.trim();
  if (trimmed.length >= 2 && trimmed.startsWith("'") && trimmed.endsWith("'")) {
    return trimmed.slice(1, -1).replace(/''/g, "'");
  }
  if (trimmed.length >= 2 && trimmed.startsWith('"') && trimmed.endsWith('"')) {
    try {
      return JSON.parse(trimmed) as string;
    } catch {
      return trimmed.slice(1, -1).replace(/\\"/g, '"').replace(/\\\\/g, '\\');
    }
  }
  return trimmed;
}

function stripYamlComment(value: string): string {
  let quote: '"' | "'" | undefined;
  let square = 0;
  let brace = 0;
  for (let index = 0; index < value.length; index += 1) {
    const character = value[index];
    if (quote) {
      if (character === quote && (quote === "'" || value[index - 1] !== '\\')) {
        quote = undefined;
      }
      continue;
    }
    if (character === '"' || character === "'") {
      quote = character;
    } else if (character === '[') {
      square += 1;
    } else if (character === ']') {
      square = Math.max(0, square - 1);
    } else if (character === '{') {
      brace += 1;
    } else if (character === '}') {
      brace = Math.max(0, brace - 1);
    } else if (character === '#' && square === 0 && brace === 0 && /\s/.test(value[index - 1] ?? '')) {
      return value.slice(0, index);
    }
  }
  return value;
}

function splitTopLevel(value: string, delimiter: string): readonly string[] {
  const parts: string[] = [];
  let start = 0;
  let quote: '"' | "'" | undefined;
  let square = 0;
  let brace = 0;
  for (let index = 0; index < value.length; index += 1) {
    const character = value[index];
    if (quote) {
      if (character === quote && (quote === "'" || value[index - 1] !== '\\')) {
        quote = undefined;
      }
      continue;
    }
    if (character === '"' || character === "'") {
      quote = character;
    } else if (character === '[') {
      square += 1;
    } else if (character === ']') {
      square = Math.max(0, square - 1);
    } else if (character === '{') {
      brace += 1;
    } else if (character === '}') {
      brace = Math.max(0, brace - 1);
    } else if (character === delimiter && square === 0 && brace === 0) {
      parts.push(value.slice(start, index));
      start = index + 1;
    }
  }
  parts.push(value.slice(start));
  return parts;
}

function findTopLevel(value: string, delimiter: string): number {
  const parts = splitTopLevel(value, delimiter);
  return parts.length < 2 ? -1 : parts[0]?.length ?? -1;
}

function maskRange(text: string, range: TextRange): string {
  const replacement = text.slice(range.start, range.end).replace(/[^\r\n]/g, ' ');
  return text.slice(0, range.start) + replacement + text.slice(range.end);
}

function offsetToLocation(text: string, offset: number): { readonly line: number; readonly column: number } {
  let line = 0;
  let lineStart = 0;
  for (let index = 0; index < offset; index += 1) {
    if (text[index] === '\n') {
      line += 1;
      lineStart = index + 1;
    }
  }
  return { line, column: offset - lineStart };
}

function lineEnd(text: string, start: number): number {
  const newline = text.indexOf('\n', start);
  if (newline < 0) {
    return text.length;
  }
  return newline > start && text[newline - 1] === '\r' ? newline - 1 : newline;
}

function nextLineStart(text: string, end: number): number {
  if (end >= text.length) {
    return text.length;
  }
  if (text[end] === '\r' && text[end + 1] === '\n') {
    return end + 2;
  }
  return text[end] === '\n' ? end + 1 : Math.min(text.length, end + 1);
}

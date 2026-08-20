import { maskTeXComments, readTeXGroup, skipTeXWhitespace } from './definitionParser.js';

export type DependencyKind = 'documentclass' | 'package' | 'input' | 'include';
export type DependencyResolution = 'literal' | 'dynamic';

export interface DependencySource {
  readonly id: string;
  readonly startOffset: number;
  readonly endOffset: number;
  readonly line: number;
  readonly column: number;
}

export interface ParsedDependency {
  readonly kind: DependencyKind;
  readonly name: string;
  readonly command: 'documentclass' | 'usepackage' | 'RequirePackage' | 'input' | 'include';
  readonly options: readonly string[];
  readonly resolution: DependencyResolution;
  readonly limitations: readonly string[];
  readonly source: DependencySource;
}

interface ControlSequence {
  readonly name: string;
  readonly end: number;
}

const SUPPORTED_COMMANDS = new Set([
  'documentclass',
  'usepackage',
  'RequirePackage',
  'input',
  'include',
]);

/** 解析根文档和样式文件中的声明式依赖，不展开动态宏生成的路径。 */
export function parseDependencies(text: string, sourceId = '<memory>'): readonly ParsedDependency[] {
  const masked = maskTeXComments(text);
  const lineStarts = collectLineStarts(text);
  const dependencies: ParsedDependency[] = [];

  for (let offset = 0; offset < masked.length;) {
    if (masked[offset] !== '\\') {
      offset += 1;
      continue;
    }
    const control = readControlSequence(masked, offset);
    if (!control || !SUPPORTED_COMMANDS.has(control.name)) {
      offset = control?.end ?? offset + 1;
      continue;
    }

    const parsed = parseDependencyAt(masked, sourceId, lineStarts, offset, control);
    dependencies.push(...parsed.dependencies);
    offset = Math.max(control.end, parsed.end);
  }
  return dependencies;
}

function parseDependencyAt(
  text: string,
  sourceId: string,
  lineStarts: readonly number[],
  start: number,
  control: ControlSequence,
): { readonly dependencies: readonly ParsedDependency[]; readonly end: number } {
  let cursor = skipTeXWhitespace(text, control.end);
  let options: readonly string[] = [];
  const optionGroup = readTeXGroup(text, cursor, '[', ']');
  if (optionGroup) {
    options = splitTopLevel(optionGroup.content, ',').map((option) => option.trim()).filter(Boolean);
    cursor = skipTeXWhitespace(text, optionGroup.end);
  }

  const argument = readTeXGroup(text, cursor);
  let rawNames: readonly string[];
  let end: number;
  if (argument) {
    rawNames = control.name === 'usepackage' || control.name === 'RequirePackage'
      ? splitTopLevel(argument.content, ',')
      : [argument.content];
    end = argument.end;
  } else if (control.name === 'input') {
    const bare = readBareInput(text, cursor);
    rawNames = bare.value ? [bare.value] : [];
    end = bare.end;
  } else {
    return { dependencies: [], end: statementEnd(text, cursor) };
  }

  const location = offsetToLocation(lineStarts, start);
  const kind = dependencyKind(control.name);
  const dependencies = rawNames
    .map((name) => name.trim())
    .filter(Boolean)
    .map((name): ParsedDependency => {
      const dynamic = /[\\#{}]/.test(name);
      return {
        kind,
        name,
        command: control.name as ParsedDependency['command'],
        options,
        resolution: dynamic ? 'dynamic' : 'literal',
        limitations: dynamic ? ['dynamic-dependency-name'] : [],
        source: {
          id: sourceId,
          startOffset: start,
          endOffset: end,
          line: location.line,
          column: location.column,
        },
      };
    });
  return { dependencies, end };
}

function dependencyKind(command: string): DependencyKind {
  if (command === 'documentclass') {
    return 'documentclass';
  }
  if (command === 'usepackage' || command === 'RequirePackage') {
    return 'package';
  }
  return command === 'include' ? 'include' : 'input';
}

function readControlSequence(text: string, offset: number): ControlSequence | undefined {
  if (text[offset] !== '\\' || !/[A-Za-z@]/.test(text[offset + 1] ?? '')) {
    return undefined;
  }
  let end = offset + 2;
  while (end < text.length && /[A-Za-z@]/.test(text[end] ?? '')) {
    end += 1;
  }
  return { name: text.slice(offset + 1, end), end };
}

function readBareInput(text: string, offset: number): { readonly value: string; readonly end: number } {
  let end = offset;
  while (end < text.length && !/[\s%]/.test(text[end] ?? '')) {
    end += 1;
  }
  return { value: text.slice(offset, end), end };
}

function splitTopLevel(text: string, delimiter: string): readonly string[] {
  const parts: string[] = [];
  let start = 0;
  let braceDepth = 0;
  let bracketDepth = 0;
  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];
    if (character === '\\') {
      index += 1;
      continue;
    }
    if (character === '{') {
      braceDepth += 1;
    } else if (character === '}') {
      braceDepth = Math.max(0, braceDepth - 1);
    } else if (character === '[') {
      bracketDepth += 1;
    } else if (character === ']') {
      bracketDepth = Math.max(0, bracketDepth - 1);
    } else if (character === delimiter && braceDepth === 0 && bracketDepth === 0) {
      parts.push(text.slice(start, index));
      start = index + 1;
    }
  }
  parts.push(text.slice(start));
  return parts;
}

function statementEnd(text: string, offset: number): number {
  const newline = text.indexOf('\n', offset);
  return newline < 0 ? text.length : newline;
}

function collectLineStarts(text: string): readonly number[] {
  const starts = [0];
  for (let index = 0; index < text.length; index += 1) {
    if (text[index] === '\n') {
      starts.push(index + 1);
    }
  }
  return starts;
}

function offsetToLocation(lineStarts: readonly number[], offset: number): { readonly line: number; readonly column: number } {
  let low = 0;
  let high = lineStarts.length - 1;
  while (low <= high) {
    const middle = Math.floor((low + high) / 2);
    if ((lineStarts[middle] ?? 0) <= offset) {
      low = middle + 1;
    } else {
      high = middle - 1;
    }
  }
  const line = Math.max(0, high);
  return { line, column: offset - (lineStarts[line] ?? 0) };
}

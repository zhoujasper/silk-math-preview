import type { ParsedDefinition } from './definitionParser.js';
import { maskTeXComments, parseDefinitions } from './definitionParser.js';
import type { ParsedDependency } from './dependencyParser.js';
import { parseDependencies } from './dependencyParser.js';

export interface ParsedTexSource {
  readonly definitions: readonly ParsedDefinition[];
  readonly dependencies: readonly ParsedDependency[];
}

export type DefinitionRefreshUrgency = 'idle' | 'soon' | 'now';

/**
 * 插入文本或光标附近出现这些声明时，定义快照必须马上重算。
 * `\def` 放在 `\definecolor` 之后，避免把颜色声明误切成 `\def`。
 */
const DEFINITION_EDIT_RE = /\\(?:(?:re)?new(?:command|environment)|providecommand|DeclareMathOperator|DeclareMathAlphabet|definecolor|providecolor|colorlet|usepackage|RequirePackage|documentclass|input|include|NewDocumentCommand|RenewDocumentCommand|ProvideDocumentCommand|DeclareDocumentCommand|NewDocumentEnvironment|RenewDocumentEnvironment|ProvideDocumentEnvironment|DeclareDocumentEnvironment|def)\b/;

export function parseTeXSource(text: string, sourceId = '<memory>'): ParsedTexSource {
  const masked = maskTeXComments(text);
  const definitions = parseDefinitions(text, sourceId, masked);
  const dependencies = parseDependencies(text, sourceId, masked).filter((dependency) =>
    !definitions.some((definition) =>
      dependency.source.startOffset >= definition.source.startOffset &&
      dependency.source.startOffset < definition.source.endOffset,
    ),
  );
  return { definitions, dependencies };
}

/** 用户刚写的声明/宏包会改变后续公式，必须立刻刷新；公式内部打字可以再等一拍。 */
export function texEditAffectsDefinitions(insertedText: string, nearbyText = ''): boolean {
  return DEFINITION_EDIT_RE.test(insertedText) || DEFINITION_EDIT_RE.test(nearbyText);
}

export function texChangesAffectDefinitions(
  changes: readonly { readonly inserted: string; readonly nearby: string; readonly deleted: number }[],
): boolean {
  return changes.some((change) =>
    texEditAffectsDefinitions(change.inserted, change.nearby)
    || (change.inserted.length === 0 && change.deleted >= 11),
  );
}

export function texDocumentEditsAffectDefinitions(
  text: string,
  changes: readonly { readonly start: number; readonly inserted: string; readonly deleted: number }[],
): boolean {
  return changes.some((change) => {
    if (DEFINITION_EDIT_RE.test(change.inserted)) return true;
    if (change.inserted.length === 0 && change.deleted >= 11) return true;
    return DEFINITION_EDIT_RE.test(controlWordAt(text, change.start, change.inserted));
  });
}

/** 只取编辑点上正在写的控制词，不把上方已经写完的 \\newcommand 算进来。 */
function controlWordAt(text: string, start: number, inserted: string): string {
  let index = start;
  while (index > 0 && /[A-Za-z@]/.test(text[index - 1] ?? '')) {
    index -= 1;
  }
  if (index === 0 || text[index - 1] !== '\\') {
    return /^\\[A-Za-z@]*/.exec(inserted)?.[0] ?? '';
  }
  return text.slice(index - 1, start) + (/^[A-Za-z@]*/.exec(inserted)?.[0] ?? '');
}

/** peek 热路径：`now` 立刻重算，`soon` 等停顿，`idle` 不动。 */
export function definitionRefreshUrgency(flags: {
  readonly hasPeek: boolean;
  readonly generationChanged: boolean;
  readonly offsetBoundaryChanged: boolean;
  readonly definitionAffectingEdit: boolean;
  readonly documentVersionChanged: boolean;
  readonly notebookVersionChanged: boolean;
}): DefinitionRefreshUrgency {
  if (!flags.hasPeek) return 'now';
  if (
    flags.generationChanged
    || flags.offsetBoundaryChanged
    || flags.definitionAffectingEdit
    || flags.notebookVersionChanged
  ) {
    return 'now';
  }
  if (flags.documentVersionChanged) return 'soon';
  return 'idle';
}

export function isDefinitionSourcePath(path: string): boolean {
  return /\.(?:tex|sty|cls|md|markdown|mdx|ipynb)$/i.test(path.replace(/\\/g, '/'));
}

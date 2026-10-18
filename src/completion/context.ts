import { findMathRegionAt, scanMathRegions } from '../core/mathScanner';

// Keep one bounded source scan, including its exact source/language/environment identity.
// Reopening suggestions or moving the caret need not scan every formula again.
let cachedScan: { text: string; language: string; environments: string; scan: ReturnType<typeof scanMathRegions> } | undefined;

export interface CompletionContext {
  readonly kind: 'command' | 'begin' | 'end' | 'reference' | 'citation' | 'label';
  readonly start: number;
  readonly end: number;
  readonly prefix: string;
  readonly closingBrace: boolean;
  readonly openEnvironments: readonly string[];
  readonly code: string;
}

/** Respect TeX comments and Markdown code even where preview intentionally renders code. */
export function readMathCompletionContext(
  text: string,
  offset: number,
  language: 'latex' | 'markdown',
  environments: readonly string[],
  allowEmpty = false,
): CompletionContext | undefined {
  const before = text.slice(Math.max(text.lastIndexOf('\n', offset - 1) + 1, offset - 512), offset);
  // An odd backslash run is a command; the last slash in \\ is not a new command.
  const env = /(\\+)(begin|end)\{([A-Za-z0-9@:_-]*\*?)$/.exec(before);
  const key = /(\\+)(label|(?:eq|page|auto|name|v|c|C)?ref|[A-Za-z]*[Cc]ite[A-Za-z]*)\*?(?:\[[^\]\r\n]*\]){0,2}\{([^{}]*)$/.exec(before);
  const command = /(\\+)([A-Za-z@]*\*?(?:[([|])?)$/.exec(before);
  const match = env ?? key ?? command;
  if (match && match[1]!.length % 2 === 0) return undefined;
  if (!match && !allowEmpty) return undefined;
  const environmentKey = environments.join('\0');
  const scan = cachedScan?.text === text && cachedScan.language === language && cachedScan.environments === environmentKey
    ? cachedScan.scan : scanMathRegions(text, { language, customMathEnvironments: environments, includePreviewContainers: false });
  // One cache with an explicit memory budget also serves long papers. The old
  // 256 KiB text cutoff scanned those papers twice in a single completion call.
  const weight = text.length * 2 + scan.regions.length * 160 + scan.ignoredRanges.length * 32;
  cachedScan = weight <= 8 * 1024 * 1024 ? { text, language, environments: environmentKey, scan } : undefined;
  let low = 0, high = scan.ignoredRanges.length - 1;
  while (low <= high) {
    const middle = (low + high) >>> 1;
    const range = scan.ignoredRanges[middle]!;
    if (offset <= range.start) high = middle - 1;
    else if (offset > range.end) low = middle + 1;
    else return undefined;
  }
  if (!env && !findMathRegionAt(scan.regions, offset)) return undefined;
  const prefix = env ? env[3]! : key ? key[3]!.split(',').at(-1)!.trimStart() : command?.[2] ?? '';
  const start = offset - prefix.length - (env || key || !command ? 0 : 1);
  const suffix = (env ? /^[A-Za-z0-9@:_-]*\*?/ : key ? /^[^,}\s]*/ : /^[A-Za-z@]*\*?/).exec(text.slice(offset))?.[0] ?? '';
  const end = match ? offset + suffix.length : offset;
  const code = env ? maskIgnored(text, scan.ignoredRanges) : text;
  // % is a math comment inside Markdown formulas too.
  const lineStart = code.lastIndexOf('\n', offset - 1) + 1;
  if (/(^|[^\\])(?:\\\\)*%/.test(code.slice(lineStart, offset))) return undefined;
  const openEnvironments: string[] = [];
  for (const entry of (env?.[2] === 'end' ? code.slice(0, start) : '').matchAll(/(\\+)(begin|end)\s*\{([A-Za-z@][A-Za-z0-9@:_-]*\*?)\}/g)) {
    if (entry[1]!.length % 2 === 0) continue;
    if (entry[2] === 'begin') openEnvironments.push(entry[3]!);
    else if (openEnvironments.at(-1) === entry[3]) openEnvironments.pop();
  }
  const kind = env ? env[2] as 'begin' | 'end' : key ? key[2] === 'label' ? 'label'
    : /[Cc]ite/.test(key[2]!) ? 'citation' : 'reference' : 'command';
  return { kind, start, end, prefix,
    closingBrace: text[end] === '}', openEnvironments, code };
}

function maskIgnored(text: string, ranges: readonly { start: number; end: number }[]): string {
  let cursor = 0;
  const chunks: string[] = [];
  for (const range of ranges) {
    chunks.push(text.slice(cursor, range.start), text.slice(range.start, range.end).replace(/[^\r\n]/g, ' '));
    cursor = range.end;
  }
  chunks.push(text.slice(cursor));
  return chunks.join('');
}

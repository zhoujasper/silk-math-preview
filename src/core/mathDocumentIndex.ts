import { findMathRegionAt, scanMathRegions } from './mathScanner';
import { hasDefinitionDeclarations } from './definitionParser';
import type { MathRegion, MathScanOptions, TextRange } from './types';

export interface MathDocumentChange {
  readonly rangeOffset: number;
  readonly rangeLength: number;
  readonly text: string;
}

function shifted(region: MathRegion, delta: number): MathRegion {
  if (delta === 0) return region;
  return {
    ...region,
    start: region.start + delta,
    end: region.end + delta,
    contentStart: region.contentStart + delta,
    contentEnd: region.contentEnd + delta,
    ...(region.recovery ? { recovery: { ...region.recovery, boundary: region.recovery.boundary + delta } } : {}),
  };
}

/**
 * 保留完整文档的定界符上下文；不能把任意窗口中的 closing $ 当成 opener。
 * 同一版本仅二分查找，闭合公式内的编辑只重扫该公式；结构变化从可信边界重扫。
 * 控制器只持有当前文档的一份索引，避免多个大文档长期驻留。
 */
export class MathDocumentIndex {
  private text = '';
  private version = -1;
  private key = '';
  private options: MathScanOptions = {};
  private regions: MathRegion[] = [];
  private ignoredRanges: TextRange[] = [];
  private firstUnclosed = Number.POSITIVE_INFINITY;
  private pendingRestart: { readonly version: number; readonly start: number } | undefined;
  private scanCount = 0;
  private hasDeclarations = false;
  /** 公式对象在偏移平移时会重建，缓存只按对象身份复用，不会读到过期文本。 */
  private lookaheadRegions = new WeakMap<MathRegion, boolean>();

  get scans(): number { return this.scanCount; }

  find(version: number, options: MathScanOptions, readText: () => string, offset: number): MathRegion | undefined {
    const key = JSON.stringify([options.language ?? 'latex', options.customMathEnvironments ?? [],
      options.includePreviewContainers ?? true, options.recoveryWindowChars ?? 4096, options.markdownInitialFence ?? null]);
    if (version !== this.version || key !== this.key) {
      this.text = readText();
      this.hasDeclarations = hasDefinitionDeclarations(this.text);
      const base = key === this.key && this.pendingRestart?.version === version ? this.pendingRestart.start : 0;
      const scan = scanMathRegions(this.text.slice(base), options);
      this.scanCount++;
      this.regions = base === 0 ? [...scan.regions] : [
        ...this.regions.filter((region) => region.start < base && region.end <= base),
        ...scan.regions.map((region) => shifted(region, base)),
      ];
      this.ignoredRanges = base === 0 ? [...scan.ignoredRanges] : [
        ...this.ignoredRanges.filter((range) => range.start < base && range.end <= base),
        ...scan.ignoredRanges.map((range) => ({ start: range.start + base, end: range.end + base })),
      ];
      this.firstUnclosed = this.regions.find((region) => !region.closed)?.start ?? Number.POSITIVE_INFINITY;
      this.pendingRestart = undefined;
      this.version = version;
      this.key = key;
      this.options = options;
    }
    return findMathRegionAt(this.regions, offset);
  }

  applyChanges(version: number, changes: readonly MathDocumentChange[]): void {
    if (version !== this.version + 1 || changes.length === 0 || this.options.language === 'markdown') return;
    const ordered = [...changes].sort((a, b) => a.rangeOffset - b.rangeOffset);
    const first = ordered[0]!;
    // For structural edits, retain only a prefix ending at a known parse
    // boundary. A line inside math/verbatim is not such a boundary.
    let restart = first.rangeOffset === 0 ? 0 : this.text.lastIndexOf('\n', first.rangeOffset - 1) + 1;
    restart = Math.min(restart, this.firstUnclosed);
    restart = this.lookaheadRestart(restart, first.rangeOffset);
    const crossing = findMathRegionAt(this.regions, restart);
    if (crossing) restart = Math.min(restart, crossing.start);
    const preceding = this.ignoredRanges[lowerBound(this.ignoredRanges, restart) - 1];
    // 文件末尾的未闭合原样文本会吞入追加内容，边界处也必须重新扫描。
    if (preceding && preceding.end >= restart) restart = preceding.start;
    // 声明可跨多行和两个替换参数；结构编辑必须恢复声明开头的解析上下文。
    // 下方已闭合公式内的普通编辑仍然走局部快速路径。
    if (this.hasDeclarations || changes.some((change) => hasDefinitionDeclarations(change.text))) restart = 0;
    this.pendingRestart = { version, start: restart };
    const region = findMathRegionAt(this.regions, first.rangeOffset);
    // Recovered openers may close far beyond their recovery window after an edit.
    // Never infer that those windows are independent parse boundaries.
    if (!region?.closed || this.firstUnclosed < region.start) return;
    let cursor = region.start;
    const parts: string[] = [];
    for (const change of ordered) {
      const end = change.rangeOffset + change.rangeLength;
      if (change.rangeOffset < cursor || change.rangeOffset < region.contentStart || end > region.contentEnd) return;
      parts.push(this.text.slice(cursor, change.rangeOffset), change.text);
      cursor = end;
    }
    parts.push(this.text.slice(cursor, region.end));
    const replacement = parts.join('');
    // 含嵌套定界符时，配对结果取决于其后同一段落的文本，必须带上它再判定。
    const tail = region.kind !== 'environment'
      && mayDependOnFollowingText(replacement.slice(region.contentStart - region.start,
        replacement.length + region.contentEnd - region.end))
      ? this.text.slice(region.end, region.end + LOOKAHEAD)
      : '';
    const scan = scanMathRegions(replacement + tail, this.options);
    this.scanCount++;
    const scanned = scan.regions.filter((entry) => entry.start < replacement.length);
    const scannedIgnored = scan.ignoredRanges.filter((entry) => entry.start < replacement.length);
    const next = scanned[0];
    // Only reuse surrounding state when the entire edited region is still one
    // closed formula of the same kind. Delimiter edits take the full scan path.
    if (scanned.length !== 1 || !next?.closed || next.start !== 0 || next.end !== replacement.length
      || next.kind !== region.kind || next.environment !== region.environment) return;
    const delta = replacement.length - (region.end - region.start);
    this.text = this.text.slice(0, region.start) + replacement + this.text.slice(region.end);
    this.hasDeclarations ||= hasDefinitionDeclarations(replacement);
    if (delta === 0) {
      // 等长替换不影响后续偏移；只替换当前公式和其中的忽略区间。
      this.regions[lowerBound(this.regions, region.start)] = shifted(next, region.start);
      const from = lowerBound(this.ignoredRanges, region.start);
      const to = lowerBound(this.ignoredRanges, region.end);
      if (to !== from || scannedIgnored.length > 0) {
        this.ignoredRanges.splice(from, to - from, ...scannedIgnored.map((entry) => ({
          start: entry.start + region.start, end: entry.end + region.start,
        })));
      }
    } else {
      this.regions = this.regions.map((entry) => entry === region ? shifted(next, region.start)
        : entry.start >= region.end ? shifted(entry, delta) : entry);
      this.ignoredRanges = [
        ...this.ignoredRanges.filter((entry) => entry.end <= region.start),
        ...scannedIgnored.map((entry) => ({ start: entry.start + region.start, end: entry.end + region.start })),
        ...this.ignoredRanges.filter((entry) => entry.start >= region.end)
          .map((entry) => ({ start: entry.start + delta, end: entry.end + delta })),
      ];
    }
    if (this.firstUnclosed >= region.end) this.firstUnclosed += delta;
    this.pendingRestart = undefined;
    this.version = version;
  }

  /**
   * 分组内嵌套数学（`$\text{a $x$}$`）的配对会向后查看到分组闭合或段落结束，
   * 所以同一段落里结束于编辑点之前、含花括号的公式也可能因编辑改变结束位置。
   */
  private dependsOnFollowingText(region: MathRegion): boolean {
    let cached = this.lookaheadRegions.get(region);
    if (cached === undefined) {
      cached = mayDependOnFollowingText(this.text.slice(region.contentStart, region.contentEnd));
      this.lookaheadRegions.set(region, cached);
    }
    return cached;
  }

  /**
   * 分组内嵌套数学（`$\text{a $x$}$`）的配对会向后查看至多 16384 字符，
   * 编辑点之前、窗口内可能依赖后文的公式要一并重扫；结构重扫本就延续到文末，额外代价很小。
   */
  private lookaheadRestart(restart: number, editOffset: number): number {
    let result = restart;
    for (let index = lowerBound(this.regions, restart) - 1; index >= 0; index -= 1) {
      const region = this.regions[index]!;
      if (region.end <= editOffset - LOOKAHEAD) break;
      if (region.kind !== 'environment' && this.dependsOnFollowingText(region)) result = region.start;
    }
    return result;
  }
}

const LOOKAHEAD = 16384;

/** 只有内部出现定界符、注释或分组未闭合时，扫描器才会为该公式向后查看。 */
function mayDependOnFollowingText(content: string): boolean {
  if (/[$%]|\\\(/.test(content)) return true;
  let depth = 0;
  for (let index = 0; index < content.length; index += 1) {
    if (content[index] === '\\') index += 1;
    else if (content[index] === '{') depth += 1;
    else if (content[index] === '}') depth = Math.max(0, depth - 1);
  }
  return depth > 0;
}

/** 返回首个起点不小于 offset 的区间。 */
function lowerBound(ranges: readonly TextRange[], offset: number): number {
  let low = 0, high = ranges.length;
  while (low < high) {
    const middle = (low + high) >>> 1;
    if (ranges[middle]!.start < offset) low = middle + 1;
    else high = middle;
  }
  return low;
}

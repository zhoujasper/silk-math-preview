import * as vscode from 'vscode';

import { COMMAND_NS, IS_TEST_CHANNEL } from '../core/channel';
import type { PreviewCss } from '../core/previewCss';
import { previewOverlayCss, type FloatingPreviewLayout, type PreviewGeometry, type PreviewPlacement } from '../core/previewLayout';
import type { MathRegion } from '../core/types';

interface Marker { readonly range: vscode.Range; readonly names: string[]; readonly before: string[]; readonly after: string[] }
export interface SourceGeometryPlan {
  readonly range: vscode.Range;
  readonly geometry: PreviewGeometry;
  readonly placement: PreviewPlacement;
  readonly signature: string;
  readonly markers: readonly Marker[];
}

/** 不读 DOM、不轮询像素；命名源码字形，由编辑器的 CSS 布局处理滚动和缩放。 */
export class PreviewSourceAnchors implements vscode.Disposable {
  private editor: vscode.TextEditor | undefined;
  private readonly types = new Map<string, vscode.TextEditorDecorationType>();
  private overlay: vscode.TextEditorDecorationType | undefined;

  plan(editor: vscode.TextEditor, region: MathRegion, css: PreviewCss, preferred: PreviewPlacement): SourceGeometryPlan {
    const document = editor.document;
    const firstVisible = editor.visibleRanges[0]?.start.line ?? 0;
    const lastVisible = editor.visibleRanges.at(-1)?.end.line ?? document.lineCount - 1;
    const clamp = (position: vscode.Position) => {
      const line = Math.min(lastVisible, Math.max(firstVisible, position.line));
      const length = document.lineAt(line).text.length;
      const character = position.line < line ? 0 : position.line > line ? length : position.character;
      return new vscode.Position(line, Math.min(length, character));
    };
    const sourceStart = clamp(document.positionAt(region.start));
    const sourceEnd = clamp(document.positionAt(Math.max(region.start, region.end - 1)));
    const selection = editor.selection;
    const selectionStart = document.offsetAt(selection.start);
    const selectionEnd = document.offsetAt(selection.end);
    const selected = css.anchor === 'selection' && selectionEnd > selectionStart;
    const cursor = css.anchor === 'cursor' || (css.anchor === 'selection' && !selected);
    const start = selected ? clamp(selection.start) : cursor ? clamp(selection.active) : sourceStart;
    const end = selected ? clamp(document.positionAt(selectionEnd - 1)) : cursor ? start : sourceEnd;
    let placement = css.placement ?? preferred;
    // 软换行后同一源码行可能占满多个视觉行。公开 API 没有每个折行的右边界；
    // 禁止覆盖时保守地改用下方，避免用逻辑行结尾误判整块公式的右侧。
    const wrap = vscode.workspace.getConfiguration('editor', document.uri).get<string>('wordWrap', 'off');
    if (placement === 'right' && css.allowOverlap !== true && (wrap !== 'off' || sourceEnd.line - sourceStart.line >= 256)) placement = 'below';
    const markers = new Map<string, Marker>();
    const mark = (position: vscode.Position, label: string, after = false): string => {
      const text = document.lineAt(position.line).text;
      let character = Math.min(position.character, Math.max(0, text.length - 1));
      // 不在 UTF-16 代理对中间切开字形。
      if (character > 0 && /[\uDC00-\uDFFF]/.test(text[character] ?? '')) character -= 1;
      const size = (text.codePointAt(character) ?? 0) > 0xFFFF ? 2 : text.length ? 1 : 0;
      const range = new vscode.Range(new vscode.Position(position.line, character), new vscode.Position(position.line, character + size));
      const key = `${position.line}:${character}`;
      const marker = markers.get(key) ?? { range, names: [], before: [], after: [] };
      const name = `--${COMMAND_NS}-source-${label}`;
      marker.names.push(name);
      (after || position.character === text.length ? marker.after : marker.before).push(name);
      markers.set(key, marker);
      return name;
    };
    const rights = (from: vscode.Position, to: vscode.Position, prefix: string): string[] => {
      const result: string[] = [];
      for (let line = from.line; line <= Math.min(to.line, from.line + 255); line++) {
        const last = line === to.line ? to.character : Math.max(0, document.lineAt(line).text.length - 1);
        result.push(mark(new vscode.Position(line, last), `${prefix}${line - from.line}`, true));
      }
      return result;
    };
    const geometry: PreviewGeometry = {
      start: mark(start, 'reference-start'), end: mark(end, 'reference-end', true),
      sourceStart: mark(sourceStart, 'formula-start'), sourceEnd: mark(sourceEnd, 'formula-end', true),
      right: placement === 'right' ? rights(start, end, 'reference-right-') : [],
      sourceRight: placement === 'right' ? rights(sourceStart, sourceEnd, 'formula-right-') : [],
      ...(cursor ? { caretAtEnd: start.character === document.lineAt(start.line).text.length } : {}),
    };
    const attachment = placement === 'below' ? end : start;
    const marker = [...markers.values()].find((item) => item.names.includes(placement === 'below' ? geometry.end : geometry.start))!;
    return {
      range: marker.range, geometry, placement, markers: [...markers.values()],
      signature: `${attachment.line}:${attachment.character}|${placement}|${JSON.stringify([...markers])}`,
    };
  }

  apply(editor: vscode.TextEditor, plan: SourceGeometryPlan): void {
    if (this.editor && this.editor !== editor) this.clear();
    this.editor = editor;
    const used = new Set<string>();
    for (const marker of plan.markers) {
      const key = `${marker.before.join(',')}|${marker.after.join(',')}`;
      used.add(key);
      let type = this.types.get(key);
      if (!type) {
        // before/after 是 Monaco 为各 decoration 创建的独立空 span，两个通道不会
        // 在同一源码 span 上互相覆盖 anchor-name。零宽内容不改变文字或行高。
        type = vscode.window.createTextEditorDecorationType({
          ...(marker.before.length ? { before: { contentText: '\u200b', textDecoration: `none; anchor-name: ${marker.before.join(', ')}` } } : {}),
          ...(marker.after.length ? { after: { contentText: '\u200b', textDecoration: `none; anchor-name: ${marker.after.join(', ')}` } } : {}),
        });
        this.types.set(key, type);
      }
      editor.setDecorations(type, [marker.range]);
    }
    for (const [key, type] of this.types) {
      if (!used.has(key)) { type.dispose(); this.types.delete(key); }
    }
  }

  show(editor: vscode.TextEditor, plan: SourceGeometryPlan, layout: FloatingPreviewLayout): void {
    this.apply(editor, plan);
    this.overlay?.dispose();
    this.overlay = vscode.window.createTextEditorDecorationType({ textDecoration: previewOverlayCss(layout, IS_TEST_CHANNEL) });
    // 空行的零长度 inline decoration 不保证产生 DOM；由可见的公式字形触发覆盖层，
    // 定位仍然使用空行上单独的零宽 anchor。
    const trigger = plan.markers.find((marker) => marker.range.end.character > marker.range.start.character)?.range ?? plan.range;
    editor.setDecorations(this.overlay, [trigger]);
  }

  clear(editor?: vscode.TextEditor): void {
    if (editor && this.editor !== editor) return;
    for (const type of this.types.values()) type.dispose();
    this.types.clear();
    this.overlay?.dispose();
    this.overlay = undefined;
    this.editor = undefined;
  }
  dispose(): void { this.clear(); }
}

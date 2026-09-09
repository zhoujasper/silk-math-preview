import { describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({ wrap: 'off', types: [] as Array<{ options: unknown; dispose: ReturnType<typeof vi.fn> }> }));
vi.mock('vscode', () => ({
  Position: class { constructor(public line: number, public character: number) {} },
  Range: class { constructor(public start: unknown, public end: unknown) {} },
  workspace: { getConfiguration: () => ({ get: () => state.wrap }) },
  window: { createTextEditorDecorationType: (options: unknown) => {
    const type = { options, dispose: vi.fn() }; state.types.push(type); return type;
  } },
}));

import * as vscode from 'vscode';
import { PreviewSourceAnchors } from '../src/vscode/preview-geometry';
import { parsePreviewCss } from '../src/core/previewCss';
import type { MathRegion } from '../src/core/types';

function fixture(text = '\\[\n  abc = def + ghi\n\n  xyz = abc\n\\]') {
  const lines = text.split('\n');
  const positionAt = (offset: number) => { const parts = text.slice(0, offset).split('\n'); return new vscode.Position(parts.length - 1, parts.at(-1)!.length); };
  const offsetAt = (p: vscode.Position) => lines.slice(0, p.line).reduce((sum, line) => sum + line.length + 1, 0) + p.character;
  const active = new vscode.Position(1, 4);
  const editor = {
    document: { uri: {}, positionAt, offsetAt, lineAt: (line: number) => ({ text: lines[line]! }), lineCount: lines.length },
    visibleRanges: [new vscode.Range(new vscode.Position(0, 0), positionAt(text.length))],
    selection: { active, start: active, end: active }, setDecorations: vi.fn(),
  } as unknown as vscode.TextEditor;
  const region = { start: 0, end: text.length } as MathRegion;
  state.wrap = 'off'; state.types = [];
  return { editor, region, anchors: new PreviewSourceAnchors() };
}

describe('source geometry', () => {
  it.each(['formula', 'cursor', 'selection'])('resolves %s to source characters without estimating columns', (anchor) => {
    const { editor, region, anchors } = fixture();
    const plan = anchors.plan(editor, region, parsePreviewCss(`--silk-anchor:${anchor};`), 'below');
    expect(plan.range.start.line).toBe(anchor === 'formula' ? 4 : 1);
    expect(plan.markers.some((marker) => marker.names.includes(plan.geometry.sourceStart) && marker.range.start.line === 0)).toBe(true);
    expect(plan.markers.some((marker) => marker.names.includes(plan.geometry.sourceEnd) && marker.range.start.line === 4)).toBe(true);
    anchors.dispose();
  });

  it('uses selection edges, handles an end-exclusive next-line selection, and tracks caret movement', () => {
    const { editor, region, anchors } = fixture();
    Object.defineProperty(editor, 'selection', { configurable: true, value: { active: new vscode.Position(3, 0), start: new vscode.Position(1, 2), end: new vscode.Position(3, 0) } });
    const css = parsePreviewCss('--silk-anchor:selection;');
    const selected = anchors.plan(editor, region, css, 'below');
    expect(selected.range.start.line).toBe(2);
    anchors.apply(editor, selected);
    expect(state.types.some(({ options }) => !!(options as { before?: unknown }).before)).toBe(true);
    const cursorCss = parsePreviewCss('--silk-anchor:cursor;');
    const first = anchors.plan(editor, region, cursorCss, 'below');
    Object.defineProperty(editor, 'selection', { value: { active: new vscode.Position(3, 4), start: new vscode.Position(3, 4), end: new vscode.Position(3, 4) } });
    expect(anchors.plan(editor, region, cursorCss, 'below').signature).not.toBe(first.signature);
    anchors.dispose();
  });

  it('collects the end of every source line for the right edge and falls below for soft wrap', () => {
    const { editor, region, anchors } = fixture();
    const css = parsePreviewCss('--silk-placement:right;--silk-allow-overlap:false;');
    const right = anchors.plan(editor, region, css, 'below');
    expect(right.placement).toBe('right');
    expect(right.geometry.sourceRight).toHaveLength(5);
    state.wrap = 'on';
    expect(anchors.plan(editor, region, css, 'below').placement).toBe('below');
    expect(anchors.plan(editor, region, { ...css, allowOverlap: true }, 'below').placement).toBe('right');
  });

  it('keeps markers on visible rows, reuses types and disposes them on mode changes, Esc and editor changes', () => {
    const { editor, region, anchors } = fixture();
    Object.defineProperty(editor, 'visibleRanges', { value: [new vscode.Range(new vscode.Position(1, 0), new vscode.Position(3, 5))] });
    const plan = anchors.plan(editor, region, parsePreviewCss('--silk-placement:right;'), 'below');
    expect(plan.markers.every((marker) => marker.range.start.line >= 1 && marker.range.start.line <= 3)).toBe(true);
    anchors.apply(editor, plan);
    const initial = [...state.types];
    anchors.apply(editor, plan);
    expect(state.types).toHaveLength(initial.length);
    anchors.apply(editor, anchors.plan(editor, region, parsePreviewCss('--silk-anchor:cursor;'), 'above'));
    expect(initial.some((type) => type.dispose.mock.calls.length > 0)).toBe(true);
    anchors.clear({} as vscode.TextEditor); // unrelated editor cannot clear the active markers
    anchors.clear(editor);
    expect(state.types.every((type) => type.dispose.mock.calls.length > 0)).toBe(true);
    anchors.dispose();
  });

  it('bounds right-edge work for huge selections and never splits a surrogate pair', () => {
    const { editor, region, anchors } = fixture('😀x\n'.repeat(400));
    Object.defineProperty(editor, 'selection', { value: { active: new vscode.Position(0, 1), start: new vscode.Position(0, 1), end: new vscode.Position(0, 1) } });
    const plan = anchors.plan(editor, region, parsePreviewCss('--silk-anchor:cursor;--silk-placement:right;--silk-allow-overlap:true;'), 'below');
    expect(plan.geometry.sourceRight).toHaveLength(256);
    const cursor = plan.markers.find((marker) => marker.names.includes(plan.geometry.start))!;
    expect(cursor.range.start.character).toBe(0);
    expect(cursor.range.end.character).toBe(2);
    expect(anchors.plan(editor, region, parsePreviewCss('--silk-placement:right;'), 'below').placement).toBe('below');
  });
});

import * as vscode from 'vscode';

/**
 * 记录选区最近一次是否由用户在编辑区内操作产生。
 *
 * 查找/替换框通过程序化 API 把匹配项选成非空选区（kind = Command），此时输入焦点在查找框里。
 * 自动预览不能在这种时候调用 showHover/hideHover 或把焦点送回编辑器，否则查找框会丢失焦点，
 * 后续按键直接写进正文。两个通道共享同一份状态。
 */
interface InteractionState {
  readonly interactive: WeakMap<vscode.TextEditor, boolean>;
  readonly touchedAt: WeakMap<vscode.TextEditor, number>;
}

const STATE = Symbol.for('silkmath.editor-interaction.v1');

function state(): InteractionState {
  const shared = globalThis as typeof globalThis & { [STATE]?: InteractionState };
  return shared[STATE] ??= { interactive: new WeakMap(), touchedAt: new WeakMap() };
}

export function noteEditorSelection(event: vscode.TextEditorSelectionChangeEvent): void {
  const { interactive, touchedAt } = state();
  if (event.kind === vscode.TextEditorSelectionChangeKind.Keyboard || event.kind === vscode.TextEditorSelectionChangeKind.Mouse) {
    interactive.set(event.textEditor, true);
    touchedAt.set(event.textEditor, Date.now());
  } else if (event.kind === vscode.TextEditorSelectionChangeKind.Command && event.selections.some(selection => !selection.isEmpty)) {
    // Find/Replace、Ctrl+D、扩大选区等；直到下一次编辑区内的键盘/鼠标操作前都不自动操作浮层或焦点。
    interactive.set(event.textEditor, false);
  }
  // 空选区的程序化移动（Vim、跳转、撤销、片段）保持原状态。
}

/** 未见过的编辑器按可交互处理，保持打开文件/切换编辑器时的原有行为。 */
export function editorInteractive(editor: vscode.TextEditor): boolean {
  return state().interactive.get(editor) !== false;
}

/** 距最近一次编辑区内键盘/鼠标操作的毫秒数；没有记录时为 Infinity。 */
export function sinceEditorInteraction(editor: vscode.TextEditor): number {
  const at = state().touchedAt.get(editor);
  return at === undefined ? Number.POSITIVE_INFINITY : Date.now() - at;
}

import * as vscode from 'vscode';
import { COMMAND_NS, PRODUCT_NAME } from '../core/channel';
import { fillTemplate, resolveUiLocale, uiCopy } from '../core/uiLocale';

const COPY = {
  en: ['Add {feature} exclusion…', 'Save new rules to: {scope}', 'User', 'Workspace', 'Folder', 'Enter *.tex, a filename, or a path. Leave empty to delete.', 'Use 1–2048 characters (80 for file types); at most 64 rules.', 'Choose an action, then change or add its shortcut.', 'File type'],
  'zh-hans': ['添加{feature}排除规则…', '新规则保存到：{scope}', '用户设置', '工作区设置', '文件夹设置', '填写 *.tex、文件名或路径；清空后确认可删除此规则。', '规则需为 1–2048 个字符（文件类型最多 80），每项设置最多 64 条。', '选择操作，然后修改或添加它的快捷键。', '文件类型'],
  'zh-hant': ['新增{feature}排除規則…', '新規則儲存至：{scope}', '使用者設定', '工作區設定', '資料夾設定', '輸入 *.tex、檔案名稱或路徑；清空後確認可刪除此規則。', '規則需為 1–2048 個字元（檔案類型最多 80），每項設定最多 64 條。', '選擇操作，再修改或新增其快速鍵。', '檔案類型'],
  ja: ['{feature}の除外ルールを追加…', '新しいルールの保存先：{scope}', 'ユーザー', 'ワークスペース', 'フォルダー', '*.tex、ファイル名、パスを入力。空にして確定すると削除。', '1～2048文字（ファイル種類は80文字）、各設定64件まで。', '操作を選び、ショートカットを変更または追加します。', 'ファイル種類'],
  ko: ['{feature} 제외 규칙 추가…', '새 규칙 저장 위치: {scope}', '사용자', '작업 영역', '폴더', '*.tex, 파일 이름 또는 경로를 입력하세요. 비우고 확인하면 삭제됩니다.', '1–2048자(파일 형식은 80자), 설정당 최대 64개 규칙.', '작업을 선택한 뒤 단축키를 변경하거나 추가하세요.', '파일 형식'],
  de: ['Ausschluss für {feature} hinzufügen…', 'Neue Regeln speichern in: {scope}', 'Benutzer', 'Workspace', 'Ordner', '*.tex, Dateiname oder Pfad eingeben; zum Löschen leeren und bestätigen.', '1–2048 Zeichen (Dateitypen: 80), höchstens 64 Regeln je Einstellung.', 'Aktion auswählen und Tastenkombination ändern oder hinzufügen.', 'Dateityp'],
  fr: ['Ajouter une exclusion pour {feature}…', 'Enregistrer les nouvelles règles dans : {scope}', 'Utilisateur', 'Espace de travail', 'Dossier', 'Saisir *.tex, un nom ou un chemin ; vider et confirmer pour supprimer.', '1–2048 caractères (types : 80), au plus 64 règles par paramètre.', 'Choisissez une action, puis modifiez ou ajoutez son raccourci.', 'Type de fichier'],
  es: ['Añadir exclusión de {feature}…', 'Guardar reglas nuevas en: {scope}', 'Usuario', 'Espacio de trabajo', 'Carpeta', 'Escribe *.tex, un nombre o una ruta; vacía y confirma para eliminar.', '1–2048 caracteres (tipos: 80), hasta 64 reglas por ajuste.', 'Selecciona una acción y cambia o añade su atajo.', 'Tipo de archivo'],
  pt: ['Adicionar exclusão de {feature}…', 'Salvar novas regras em: {scope}', 'Usuário', 'Espaço de trabalho', 'Pasta', 'Digite *.tex, um nome ou caminho; limpe e confirme para excluir.', '1–2048 caracteres (tipos: 80), até 64 regras por configuração.', 'Escolha uma ação e altere ou adicione seu atalho.', 'Tipo de arquivo'],
  ru: ['Добавить исключение: {feature}…', 'Сохранять новые правила: {scope}', 'Пользователь', 'Рабочая область', 'Папка', 'Введите *.tex, имя или путь; очистите и подтвердите для удаления.', '1–2048 символов (типы: 80), до 64 правил на настройку.', 'Выберите действие и измените или добавьте сочетание клавиш.', 'Тип файла'],
  it: ['Aggiungi esclusione per {feature}…', 'Salva le nuove regole in: {scope}', 'Utente', 'Area di lavoro', 'Cartella', 'Inserisci *.tex, un nome o percorso; svuota e conferma per eliminare.', '1–2048 caratteri (tipi: 80), massimo 64 regole per impostazione.', 'Scegli un’azione, poi modifica o aggiungi la scorciatoia.', 'Tipo di file'],
} as const;

type Field = 'globalValue' | 'workspaceValue' | 'workspaceFolderValue'
  | 'globalLanguageValue' | 'workspaceLanguageValue' | 'workspaceFolderLanguageValue';
interface Scope extends vscode.QuickPickItem { readonly target: vscode.ConfigurationTarget; readonly field: Field; readonly language: boolean; }
interface RuleItem extends vscode.QuickPickItem { readonly key?: string; readonly value?: string; readonly scope?: Scope; readonly chooseScope?: boolean; }
let session: vscode.CancellationTokenSource | undefined;
let registered = false;

function begin(context: vscode.ExtensionContext): vscode.CancellationTokenSource {
  session?.cancel(); session?.dispose();
  if (!registered) {
    registered = true;
    context.subscriptions.push(new vscode.Disposable(() => {
      session?.cancel(); session?.dispose(); session = undefined; registered = false;
    }));
  }
  return session = new vscode.CancellationTokenSource();
}

/** Edit rules without depending on the Settings editor's search results. */
export async function editFileExclusions(context: vscode.ExtensionContext): Promise<void> {
  const active = begin(context);
  const document = vscode.window.activeTextEditor?.document;
  const config = () => vscode.workspace.getConfiguration(COMMAND_NS, document);
  const copy = uiCopy(vscode.env.language);
  const text = COPY[resolveUiLocale(vscode.env.language)];
  const scopes: Scope[] = [{ label: text[2], target: vscode.ConfigurationTarget.Global, field: 'globalValue', language: false }];
  if (vscode.workspace.workspaceFolders?.length || vscode.workspace.workspaceFile) {
    scopes.push({ label: text[3], target: vscode.ConfigurationTarget.Workspace, field: 'workspaceValue', language: false });
  }
  if (document && vscode.workspace.getWorkspaceFolder(document.uri)) {
    scopes.push({ label: text[4], target: vscode.ConfigurationTarget.WorkspaceFolder, field: 'workspaceFolderValue', language: false });
  }
  if (document) scopes.push(...scopes.map(scope => ({ ...scope, label: `${scope.label} · ${document.languageId}`,
    field: scope.field.replace('Value', 'LanguageValue') as Field, language: true })));
  let destination = scopes[0]!;
  const pending = new Map<string, { before: readonly string[]; next: readonly string[] }>();
  const equal = (a: readonly string[], b: readonly string[]) => a.length === b.length && a.every((value, i) => value === b[i]);
  const values = (key: string, scope: Scope): readonly string[] => {
    const value = config().inspect<unknown>(key)?.[scope.field];
    const current = Array.isArray(value) ? value.filter((rule): rule is string => typeof rule === 'string') : [];
    const id = `${key}:${scope.field}`;
    const saved = pending.get(id);
    if (saved && equal(current, saved.before)) return saved.next;
    pending.delete(id);
    return current;
  };
  try {
    while (!active.token.isCancellationRequested) {
      const items: RuleItem[] = ['preview', 'completion'].map((feature, i) => ({
        label: `$(add) ${fillTemplate(text[0], { feature: copy.fileFeatures[i]! })}`,
        key: `${feature}.excludeFiles`, scope: destination,
      }));
      items.push({ label: `$(settings) ${fillTemplate(text[1], { scope: destination.label })}`, chooseScope: true });
      for (const [i, feature] of ['preview', 'completion'].entries()) {
        items.push({ label: copy.fileFeatures[i]!, kind: vscode.QuickPickItemKind.Separator });
        for (const scope of scopes) for (const suffix of ['excludeFiles', 'excludeFileTypes']) {
          const key = `${feature}.${suffix}`;
          for (const value of values(key, scope)) items.push({ label: value, key, value, scope,
            description: `${scope.label}${suffix === 'excludeFileTypes' ? ` · ${text[8]}` : ''}` });
        }
      }
      const item = await vscode.window.showQuickPick(items, { title: `${PRODUCT_NAME} · ${copy.editFileExclusions}`,
        placeHolder: '*.tex · notes.tex · path/file.tex', matchOnDescription: true, ignoreFocusOut: false }, active.token);
      if (!item || active.token.isCancellationRequested) return;
      if (item.chooseScope) {
        destination = await vscode.window.showQuickPick(scopes, { title: fillTemplate(text[1], { scope: destination.label }) }, active.token) ?? destination;
        continue;
      }
      if (!item.key || !item.scope) continue;
      const max = item.key.endsWith('excludeFileTypes') ? 80 : 2048;
      const value = await vscode.window.showInputBox({ title: item.label, value: item.value ?? '', prompt: text[5],
        ignoreFocusOut: false, validateInput: input => {
          const rule = input.trim();
          return rule.length > max || (!item.value && !rule)
            || (max === 80 && rule !== '' && !/^(?:\*?\.)?[A-Za-z0-9][A-Za-z0-9._+-]*$/.test(rule)) ? text[6] : undefined;
        } }, active.token);
      if (value === undefined || active.token.isCancellationRequested) continue;
      const previous = values(item.key, item.scope);
      // Read again after editing so another settings update is not lost.
      const next = previous.filter(rule => rule !== item.value);
      const rule = value.trim();
      if (rule && !next.includes(rule)) next.push(rule);
      if (next.length > 64 && next.length >= previous.length) { await vscode.window.showErrorMessage(text[6]); continue; }
      if (equal(previous, next)) continue;
      try {
        await config().update(item.key, next, item.scope.target, item.scope.language);
        // The extension host can receive the configuration event after update() resolves.
        const id = `${item.key}:${item.scope.field}`;
        pending.set(id, { before: pending.get(id)?.before ?? previous, next });
      }
      catch (error) {
        await vscode.window.showErrorMessage(`${PRODUCT_NAME}: ${String(error)}`);
      }
    }
  } finally {
    if (session === active) session = undefined;
    active.dispose();
  }
}

/** Exact command IDs also expose actions without a default key binding. */
export async function configureShortcuts(context: vscode.ExtensionContext): Promise<void> {
  const active = begin(context);
  const copy = uiCopy(vscode.env.language);
  const commands = context.extension.packageJSON.contributes.commands as { command: string; title: string }[];
  try {
    const selected = await vscode.window.showQuickPick(commands.filter(item => item.command.startsWith(`${COMMAND_NS}.`))
      .map(item => ({ label: item.title, description: item.command, command: item.command })), {
        title: `${PRODUCT_NAME} · ${copy.configureShortcuts}`, placeHolder: COPY[resolveUiLocale(vscode.env.language)][7], matchOnDescription: true,
        ignoreFocusOut: false,
      }, active.token);
    if (selected && !active.token.isCancellationRequested) await vscode.commands.executeCommand('workbench.action.openGlobalKeybindings', `@command:${selected.command}`);
  } finally {
    if (session === active) session = undefined;
    active.dispose();
  }
}

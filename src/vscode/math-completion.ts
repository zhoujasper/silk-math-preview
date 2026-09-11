import * as vscode from 'vscode';
import { buildMathCatalog, escapeSnippet, type MathCompletion } from '../completion/catalog';
import { readMathCompletionContext, type CompletionContext } from '../completion/context';
import type { DefinitionSnapshot } from './definitionWorkspace';
import { ProjectCompletionIndex } from './projectCompletion';
import { validKey } from '../completion/projectData';
export { ProjectCompletionIndex } from './projectCompletion';
export { readMathCompletionContext } from '../completion/context';

export interface CompletionSettings {
  readonly packages: readonly string[];
  readonly environments: readonly string[];
  readonly snippets: Readonly<Record<string, string>>;
  readonly optionalArguments: boolean;
}

interface PreparedCompletion {
  readonly entry: MathCompletion;
  readonly label: vscode.CompletionItemLabel;
  readonly sortText: string;
  readonly filterText: string;
  readonly plainBody: string;
}
let cachedCatalog: { fingerprint: string; settings: CompletionSettings; commands: readonly PreparedCompletion[];
  environments: readonly PreparedCompletion[]; environmentNames: ReadonlySet<string> } | undefined;
/** Metadata lives on its item, so dismissed lists can be collected without a growing WeakMap. */
class MathCompletionItem extends vscode.CompletionItem {
  #body: string | undefined;
  #entry: MathCompletion | undefined;
  constructor(label: string | vscode.CompletionItemLabel, kind: vscode.CompletionItemKind,
    body: string, entry?: MathCompletion) {
    super(label, kind);
    this.#body = body;
    this.#entry = entry;
  }
  resolve(): void {
    if (this.#body === undefined) return;
    const docs = new vscode.MarkdownString();
    const entry = this.#entry;
    if (!entry) docs.appendText(this.#body);
    else {
      docs.appendCodeblock(snippetExample(this.#body), 'latex');
      docs.appendText('\n' + entry.detail);
      if (entry.definition) {
        docs.appendText(`\n${entry.definition.source.id}:${entry.definition.source.line + 1}`);
        if (entry.definition.expandability === 'recognized-limited') docs.appendText('\n仅识别；复杂定义不保证预览。 Recognized only; preview may be limited.');
      }
    }
    this.documentation = docs;
    this.#body = undefined;
    this.#entry = undefined;
  }
}

/** VS Code requests documentation only for the focused item. */
export function resolveMathCompletion(item: vscode.CompletionItem): vscode.CompletionItem {
  if (item instanceof MathCompletionItem) item.resolve();
  return item;
}

export async function provideContextCompletions(
  document: vscode.TextDocument, position: vscode.Position, snapshot: DefinitionSnapshot,
  settings: CompletionSettings, allowEmpty: boolean, getProject: () => ProjectCompletionIndex,
  token: vscode.CancellationToken, text = document.getText(),
): Promise<vscode.CompletionList | undefined> {
  const offset = document.offsetAt(position);
  const context = readMathCompletionContext(text, offset, /^(markdown|mdx)$/.test(document.languageId) ? 'markdown' : 'latex',
    [...snapshot.environments, ...settings.environments], allowEmpty);
  if (!context) return undefined;
  if (context.kind === 'reference' || context.kind === 'citation' || context.kind === 'label') {
    const data = await getProject().get(document, token);
    if (!data) return undefined;
    const range = new vscode.Range(document.positionAt(context.start), document.positionAt(context.end));
    const items: vscode.CompletionItem[] = [];
    let keys = context.kind === 'citation' ? data.citations : data.labels;
    if (context.kind === 'label') {
      const used = new Set(data.labels.map(entry => entry.key));
      const base = validKey(context.prefix) ? context.prefix : 'eq:formula';
      let key = base;
      for (let count = 2; used.has(key); count++) key = base + '-' + count;
      keys = [{ key, source: '', detail: '新标签，避免重复 / New unique label' }];
    }
    const argumentEnd = text.indexOf('}', context.end);
    const otherKeys = text.slice(text.lastIndexOf('{', context.start) + 1, context.start)
      + text.slice(context.end, argumentEnd < 0 ? context.end : argumentEnd);
    const used = new Set(otherKeys.split(',').map(key => key.trim()).filter(Boolean));
    for (const key of keys) {
      if (context.kind !== 'label' && used.has(key.key)) continue;
      const item = new MathCompletionItem(key.key, context.kind === 'citation'
        ? vscode.CompletionItemKind.Reference : vscode.CompletionItemKind.Value, key.detail + '\n' + key.source
          + (data.limited ? '\n已达到项目索引上限，候选可能不完整。 Project indexing limit reached; some keys may be missing.' : ''));
      item.insertText = key.key;
      item.range = range;
      item.detail = key.detail;
      item.filterText = key.key + ' ' + key.detail;
      item.sortText = `${key.key.toLowerCase().startsWith(context.prefix.toLowerCase()) ? 0 : 1}:${key.key}`;
      items.push(item);
    }
    return new vscode.CompletionList(items, false);
  }
  return provideMathCompletions(document, position, snapshot, settings, allowEmpty, context, text);
}

export function provideMathCompletions(
  document: vscode.TextDocument,
  position: vscode.Position,
  snapshot: DefinitionSnapshot,
  settings: CompletionSettings,
  allowEmpty: boolean,
  existingContext?: CompletionContext,
  text = document.getText(),
): vscode.CompletionList | undefined {
  const offset = document.offsetAt(position);
  const environments = [...new Set([...snapshot.environments, ...settings.environments])];
  const context = existingContext ?? readMathCompletionContext(text, offset,
    /^(markdown|mdx)$/.test(document.languageId) ? 'markdown' : 'latex', environments, allowEmpty);
  if (!context) return undefined;
  if (context.kind === 'reference' || context.kind === 'citation' || context.kind === 'label') return undefined;
  if (cachedCatalog?.fingerprint !== snapshot.fingerprint || cachedCatalog.settings !== settings) {
    const entries = buildMathCatalog({
    packages: [...snapshot.packages, ...settings.packages], commands: snapshot.commandDefinitions,
    environments, environmentDefinitions: snapshot.environmentDefinitions,
    snippets: settings.snippets, optionalArguments: settings.optionalArguments,
    });
    const names = new Set(entries.filter(entry => entry.kind === 'command').map(entry => entry.name));
    for (const [name, value] of Object.entries(settings.snippets)) if (value === '') names.add(name.replace(/^\\/, ''));
    const prepared = entries.map(entry => ({ entry,
      label: { label: '\\' + entry.name, detail: entry.signature ? ' ' + entry.signature : '', description: 'Silk Math' },
      filterText: '\\' + entry.name + entry.signature,
      sortText: `${entry.priority + 1}:${entry.name.toLowerCase()}:${entry.name === entry.name.toLowerCase() ? 0 : 1}:${entry.signature}`,
      plainBody: escapeSnippet('\\' + entry.name),
    }));
    const environmentEntries = prepared.filter(({ entry }) => entry.kind === 'environment');
    const identities = new Set<string>();
    const commands = prepared.filter(({ entry }) => {
      if (entry.kind === 'environment' && names.has(entry.name)) return false;
      const identity = entry.name + '\n' + entry.body;
      if (identities.has(identity)) return false;
      identities.add(identity);
      return true;
    });
    cachedCatalog = { fingerprint: snapshot.fingerprint, settings, commands,
      environments: environmentEntries, environmentNames: new Set(environmentEntries.map(({ entry }) => entry.name)) };
  }
  const items: vscode.CompletionItem[] = [];
  const nearest = [...context.openEnvironments].reverse().find(name => cachedCatalog!.environmentNames.has(name));
  const editor = vscode.window.activeTextEditor;
  const selection = editor?.document === document && editor.selection && !editor.selection.isEmpty
    && editor.selection.start && editor.selection.end && editor.selection.start.line === editor.selection.end.line
    && editor.selection.active.line === position.line && editor.selection.active.character === position.character
    ? editor.selection : undefined;
  const range = selection ?? new vscode.Range(document.positionAt(context.start), document.positionAt(context.end));
  const selected = selection ? text.slice(document.offsetAt(selection.start), document.offsetAt(selection.end)) : undefined;
  const hasArguments = /^[ \t]*[\[{]/.test(text.slice(context.end));
  const inserted = context.kind !== 'command' || selected !== undefined || hasArguments ? new Set<string>() : undefined;
  const endings = context.kind === 'begin' && !context.closingBrace
    ? new Set([...context.code.slice(context.end).matchAll(/\\end\{([^{}]+)\}/g)].map(match => match[1])) : undefined;
  for (const prepared of context.kind === 'command' ? cachedCatalog.commands : cachedCatalog.environments) {
    const { entry } = prepared;
    const label = context.kind === 'command' ? prepared.label : { ...prepared.label, label: entry.name };
    let body = entry.body;
    if (context.kind !== 'command') {
      const canPair = context.kind === 'begin'
        && !context.closingBrace
        && !endings?.has(entry.name);
      // If an auto-closing } is already present, preserve existing source and insert only the name.
      body = canPair ? entry.body.slice(escapeSnippet('\\begin{').length) : escapeSnippet(entry.name) + (context.closingBrace ? '' : '\\}');
    } else if (entry.kind === 'command' && hasArguments) {
      // Correct \fr|ac{a}{b} without inserting a second argument list.
      body = prepared.plainBody;
    }
    if (selected !== undefined && context.kind === 'command') {
      if (entry.kind === 'environment' || entry.name === 'begin') body = body.replace('$0', () => escapeSnippet(selected) + '$0');
      else {
        // Optional variants may number the first required argument differently (sqrt: 2, cfrac: 1).
        const placeholder = /\{(\$\d+\b|\$\{\d+(?::(?:\\.|[^}\\])*)?\})/.exec(body)?.[1]
          ?? /\$\d+\b|\$\{\d+(?::(?:\\.|[^}\\])*)?\}/.exec(body)?.[0];
        if (placeholder) body = body.replace(placeholder, () => '${' + /^\$\{?(\d+)/.exec(placeholder)![1] + ':' + escapeSnippet(selected) + '}');
      }
    }
    if (inserted) {
      const identity = label.label + '\n' + body;
      if (inserted.has(identity)) continue;
      inserted.add(identity);
    }
    const item = new MathCompletionItem(label, entry.kind === 'environment' ? vscode.CompletionItemKind.Snippet : vscode.CompletionItemKind.Function, body, entry);
    if (context.kind === 'end' && entry.name === nearest) item.preselect = true;
    item.insertText = new vscode.SnippetString(body);
    item.range = range;
    item.filterText = context.kind === 'command' ? prepared.filterText : entry.name + entry.signature;
    item.sortText = context.kind === 'end' && entry.name === nearest ? '0:' + prepared.sortText : prepared.sortText;
    item.detail = entry.detail;
    items.push(item);
  }
  // Complete lists continue filtering locally after an explicit manual invocation.
  return new vscode.CompletionList(items, false);
}

function snippetExample(body: string): string {
  return body.replace(/\$\{\d+:([^}]*)\}/g, '$1').replace(/\$\{?\d+\}?/g, '')
    .replace(/\\([\\$}])/g, '$1');
}

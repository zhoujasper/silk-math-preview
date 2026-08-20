import type { ParsedDefinition } from './definitionParser.js';

export type DefinitionIndexOutcome =
  | 'added'
  | 'replaced'
  | 'ignored-provide'
  | 'ignored-duplicate-new'
  | 'added-unresolved-renew';

export interface IndexedDefinition {
  readonly definition: ParsedDefinition;
  readonly appliedOrder: number;
  readonly sourceLoadOrder: number;
}

export interface DefinitionIndexEvent {
  readonly definition: ParsedDefinition;
  readonly outcome: DefinitionIndexOutcome;
  readonly previous?: ParsedDefinition;
}

export interface DefinitionSourceInput {
  readonly sourceId: string;
  readonly definitions: readonly ParsedDefinition[];
  readonly loadOrder?: number;
}

interface SourceBatch {
  readonly sourceId: string;
  readonly loadOrder: number;
  readonly insertionOrder: number;
  readonly definitions: readonly ParsedDefinition[];
}

/**
 * 按 TeX 加载顺序维护有效定义。更新单个来源时会原子重建，避免旧定义残留。
 */
export class DefinitionIndex {
  private readonly sources = new Map<string, SourceBatch>();
  private readonly commands = new Map<string, IndexedDefinition>();
  private readonly environments = new Map<string, IndexedDefinition>();
  private readonly colors = new Map<string, IndexedDefinition>();
  private events: readonly DefinitionIndexEvent[] = [];
  private nextSourceOrder = 0;
  private nextInsertionOrder = 0;
  private currentGeneration = 0;

  public get generation(): number {
    return this.currentGeneration;
  }

  public replaceSource(
    sourceId: string,
    definitions: readonly ParsedDefinition[],
    loadOrder?: number,
  ): readonly DefinitionIndexEvent[] {
    this.upsertSource(sourceId, definitions, loadOrder);
    this.rebuild();
    return this.events;
  }

  /** 多来源在同一代内提交，只执行一次全量解析顺序重建。 */
  public replaceSources(inputs: readonly DefinitionSourceInput[]): readonly DefinitionIndexEvent[] {
    for (const input of inputs) {
      this.upsertSource(input.sourceId, input.definitions, input.loadOrder);
    }
    if (inputs.length > 0) this.rebuild();
    return this.events;
  }

  private upsertSource(
    sourceId: string,
    definitions: readonly ParsedDefinition[],
    loadOrder?: number,
  ): void {
    const existing = this.sources.get(sourceId);
    const resolvedLoadOrder = loadOrder ?? existing?.loadOrder ?? this.nextSourceOrder;
    if (!existing && loadOrder === undefined) {
      this.nextSourceOrder += 1;
    } else if (loadOrder !== undefined) {
      this.nextSourceOrder = Math.max(this.nextSourceOrder, loadOrder + 1);
    }

    this.sources.set(sourceId, {
      sourceId,
      loadOrder: resolvedLoadOrder,
      insertionOrder: existing?.insertionOrder ?? this.nextInsertionOrder++,
      definitions: [...definitions].sort(compareDefinitionOffsets),
    });
  }

  public removeSource(sourceId: string): boolean {
    const removed = this.sources.delete(sourceId);
    if (removed) {
      this.rebuild();
    }
    return removed;
  }

  public clear(): void {
    if (this.sources.size === 0) {
      return;
    }
    this.sources.clear();
    this.commands.clear();
    this.environments.clear();
    this.events = [];
    this.currentGeneration += 1;
  }

  public getCommand(name: string): ParsedDefinition | undefined {
    return this.commands.get(normalizeCommandName(name))?.definition;
  }

  public getEnvironment(name: string): ParsedDefinition | undefined {
    return this.environments.get(name)?.definition;
  }

  public hasCommand(name: string): boolean {
    return this.commands.has(normalizeCommandName(name));
  }

  public hasEnvironment(name: string): boolean {
    return this.environments.has(name);
  }

  public listCommands(): readonly IndexedDefinition[] {
    return [...this.commands.values()].sort(compareAppliedOrder);
  }

  public listEnvironments(): readonly IndexedDefinition[] {
    return [...this.environments.values()].sort(compareAppliedOrder);
  }

  /** `\definecolor`/`\colorlet` 定义的颜色；供 prelude 复原 `\textcolor{名字}`。 */
  public listColors(): readonly IndexedDefinition[] {
    return [...this.colors.values()].sort(compareAppliedOrder);
  }

  public getEvents(): readonly DefinitionIndexEvent[] {
    return this.events;
  }

  public getSourceIds(): readonly string[] {
    return [...this.sources.values()]
      .sort(compareSourceBatches)
      .map((source) => source.sourceId);
  }

  private rebuild(): void {
    this.commands.clear();
    this.environments.clear();
    this.colors.clear();
    const events: DefinitionIndexEvent[] = [];
    let appliedOrder = 0;

    const batches = [...this.sources.values()].sort(compareSourceBatches);
    for (const batch of batches) {
      for (const definition of batch.definitions) {
        const target = definition.kind === 'command'
          ? this.commands
          : definition.kind === 'color' ? this.colors : this.environments;
        const key = definition.kind === 'command' ? normalizeCommandName(definition.name) : definition.name;
        const previous = target.get(key);
        const outcome = decideOutcome(definition, previous);
        const event: DefinitionIndexEvent = {
          definition,
          outcome,
          ...(previous ? { previous: previous.definition } : {}),
        };
        events.push(event);

        if (outcome === 'ignored-provide' || outcome === 'ignored-duplicate-new') {
          continue;
        }
        target.set(key, {
          definition,
          appliedOrder,
          sourceLoadOrder: batch.loadOrder,
        });
        appliedOrder += 1;
      }
    }

    this.events = events;
    this.currentGeneration += 1;
  }
}

function decideOutcome(
  definition: ParsedDefinition,
  previous: IndexedDefinition | undefined,
): DefinitionIndexOutcome {
  if (definition.operation === 'provide') {
    return previous ? 'ignored-provide' : 'added';
  }
  if (definition.operation === 'new') {
    return previous ? 'ignored-duplicate-new' : 'added';
  }
  if (definition.operation === 'renew') {
    return previous ? 'replaced' : 'added-unresolved-renew';
  }
  return previous ? 'replaced' : 'added';
}

function normalizeCommandName(name: string): string {
  return name.startsWith('\\') ? name : `\\${name}`;
}

function compareDefinitionOffsets(left: ParsedDefinition, right: ParsedDefinition): number {
  return left.source.startOffset - right.source.startOffset;
}

function compareSourceBatches(left: SourceBatch, right: SourceBatch): number {
  return left.loadOrder - right.loadOrder || left.insertionOrder - right.insertionOrder;
}

function compareAppliedOrder(left: IndexedDefinition, right: IndexedDefinition): number {
  return left.appliedOrder - right.appliedOrder;
}

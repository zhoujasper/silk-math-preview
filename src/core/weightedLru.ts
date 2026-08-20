/** 按条目数和 UTF-8 近似字节数双重约束的轻量 LRU。 */
export class WeightedLru<Value> {
  private readonly entries = new Map<string, { readonly value: Value; readonly weight: number }>();
  private weight = 0;

  constructor(
    private readonly maxEntries: number,
    private readonly maxWeight: number,
  ) {
    if (maxEntries < 1 || maxWeight < 1) throw new Error('LRU 容量必须为正数');
  }

  get size(): number {
    return this.entries.size;
  }

  get totalWeight(): number {
    return this.weight;
  }

  get(key: string): Value | undefined {
    const entry = this.entries.get(key);
    if (!entry) return undefined;
    this.entries.delete(key);
    this.entries.set(key, entry);
    return entry.value;
  }

  set(key: string, value: Value, weight: number): void {
    const safeWeight = Math.max(0, Math.floor(weight));
    const previous = this.entries.get(key);
    if (previous) {
      this.weight -= previous.weight;
      this.entries.delete(key);
    }
    if (safeWeight > this.maxWeight) return;
    this.entries.set(key, { value, weight: safeWeight });
    this.weight += safeWeight;
    while (this.entries.size > this.maxEntries || this.weight > this.maxWeight) {
      const oldest = this.entries.keys().next().value as string | undefined;
      if (oldest === undefined) break;
      const removed = this.entries.get(oldest);
      this.entries.delete(oldest);
      this.weight -= removed?.weight ?? 0;
    }
  }

  clear(): void {
    this.entries.clear();
    this.weight = 0;
  }
}

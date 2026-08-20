import { describe, expect, it } from 'vitest';

import { WeightedLru } from '../src/core/weightedLru';

describe('WeightedLru', () => {
  it('按访问顺序淘汰且同时限制条目数', () => {
    const cache = new WeightedLru<string>(2, 20);
    cache.set('a', 'A', 5);
    cache.set('b', 'B', 5);
    expect(cache.get('a')).toBe('A');
    cache.set('c', 'C', 5);
    expect(cache.get('b')).toBeUndefined();
    expect(cache.get('a')).toBe('A');
    expect(cache.size).toBe(2);
  });

  it('按权重淘汰、替换计重并拒绝单个超大条目', () => {
    const cache = new WeightedLru<string>(5, 10);
    cache.set('a', 'A', 6);
    cache.set('b', 'B', 6);
    expect(cache.get('a')).toBeUndefined();
    expect(cache.totalWeight).toBe(6);
    cache.set('b', 'B2', 3);
    expect(cache.totalWeight).toBe(3);
    cache.set('huge', 'X', 11);
    expect(cache.get('huge')).toBeUndefined();
    cache.clear();
    expect(cache.totalWeight).toBe(0);
  });

  it('拒绝非法容量', () => {
    expect(() => new WeightedLru(0, 1)).toThrow();
    expect(() => new WeightedLru(1, 0)).toThrow();
  });
});

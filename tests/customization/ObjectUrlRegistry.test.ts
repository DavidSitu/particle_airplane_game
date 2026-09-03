import { afterEach, describe, expect, it, vi } from 'vitest';
import { ObjectUrlRegistry } from '../../src/adapters/browser/ObjectUrlRegistry';

afterEach(() => vi.restoreAllMocks());

describe('ObjectUrlRegistry', () => {
  it('reuses URLs by revision key and revokes every no-longer-retained URL', () => {
    let next = 0;
    const create = vi.spyOn(URL, 'createObjectURL').mockImplementation(() => `blob:test-${++next}`);
    const revoke = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined);
    const registry = new ObjectUrlRegistry();

    const first = registry.get('player:1', new Blob(['player']));
    expect(registry.get('player:1', new Blob(['ignored']))).toBe(first);
    const second = registry.get('enemy:1', new Blob(['enemy']));
    expect(create).toHaveBeenCalledTimes(2);

    registry.retain(new Set(['enemy:1']));
    expect(revoke).toHaveBeenCalledWith(first);
    expect(registry.size).toBe(1);

    registry.clear();
    expect(revoke).toHaveBeenCalledWith(second);
    expect(revoke).toHaveBeenCalledTimes(2);
    expect(registry.size).toBe(0);
  });
});

import { describe, expect, it } from 'vitest';
import { MemoryCharacterStore } from '../../src/adapters/persistence/MemoryCharacterStore';
import type { CharacterSelection, CustomizationRecord } from '../../src/systems/customization';

function record(revision: number): CustomizationRecord {
  const selection: CharacterSelection = {
    player: { kind: 'packaged', assetKey: 'player.default' },
    enemies: [{ kind: 'packaged', assetKey: 'enemy.01' }],
  };
  return { schemaVersion: 1, revision, selection, assets: [] };
}

describe('MemoryCharacterStore', () => {
  it('clones records and rejects stale revisions', async () => {
    const store = new MemoryCharacterStore();
    await expect(store.load()).resolves.toBeNull();
    await store.save(record(3));
    await expect(store.load()).resolves.toEqual(record(3));
    await expect(store.save(record(2))).rejects.toMatchObject({ code: 'stale-write' });
    await store.clear();
    await expect(store.load()).resolves.toBeNull();
  });
});

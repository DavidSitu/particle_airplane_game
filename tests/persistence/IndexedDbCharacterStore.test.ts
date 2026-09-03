import { indexedDB } from 'fake-indexeddb';
import { describe, expect, it } from 'vitest';
import {
  IndexedDbCharacterStore,
} from '../../src/adapters/persistence/IndexedDbCharacterStore';
import {
  CustomizationError,
  type CharacterSelection,
  type CustomizationRecord,
} from '../../src/systems/customization';

let databaseNumber = 0;

function nextDatabaseName(): string {
  databaseNumber += 1;
  return `customization-test-${databaseNumber}`;
}

function record(revision: number): CustomizationRecord {
  const selection: CharacterSelection = {
    player: { kind: 'packaged', assetKey: 'player.default' },
    enemies: [{ kind: 'packaged', assetKey: 'enemy.01' }],
  };
  return {
    schemaVersion: 1,
    revision,
    selection,
    assets: [],
  };
}

async function putRaw(databaseName: string, value: unknown): Promise<void> {
  const database = await openDatabase(databaseName);
  await new Promise<void>((resolve, reject) => {
    const transaction = database.transaction('customization', 'readwrite');
    transaction.objectStore('customization').put(value, 'current');
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
    transaction.onabort = () => reject(transaction.error);
  });
  database.close();
}

function openDatabase(databaseName: string): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(databaseName, 1);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains('customization')) {
        request.result.createObjectStore('customization');
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

describe('IndexedDbCharacterStore', () => {
  it('supports missing, save, revision protection, load, and clear', async () => {
    const databaseName = nextDatabaseName();
    const store = new IndexedDbCharacterStore({ indexedDB, databaseName });

    await expect(store.load()).resolves.toBeNull();
    await expect(store.save(record(2))).resolves.toBeUndefined();
    await expect(store.save(record(1))).rejects.toMatchObject({ code: 'stale-write' });
    await expect(store.load()).resolves.toEqual(record(2));
    await expect(store.clear()).resolves.toBeUndefined();
    await expect(store.load()).resolves.toBeNull();
    store.close();
  });

  it('rejects a stored schema version mismatch and corrupt record', async () => {
    const versionDatabase = nextDatabaseName();
    const versionStore = new IndexedDbCharacterStore({
      indexedDB,
      databaseName: versionDatabase,
    });
    await versionStore.load();
    await putRaw(versionDatabase, { schemaVersion: 2 });
    await expect(versionStore.load()).rejects.toMatchObject({ code: 'version-mismatch' });
    versionStore.close();

    const corruptDatabase = nextDatabaseName();
    const corruptStore = new IndexedDbCharacterStore({
      indexedDB,
      databaseName: corruptDatabase,
    });
    await corruptStore.load();
    await putRaw(corruptDatabase, { schemaVersion: 1, revision: 1 });
    await expect(corruptStore.load()).rejects.toMatchObject({ code: 'corrupt-record' });
    corruptStore.close();
  });

  it('reports unavailable IndexedDB without exposing a native error', async () => {
    const store = new IndexedDbCharacterStore({ indexedDB: undefined });
    await expect(store.load()).rejects.toEqual(new CustomizationError('persistence-unavailable'));
  });
});

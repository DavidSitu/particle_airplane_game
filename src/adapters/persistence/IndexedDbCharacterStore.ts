import {
  assertCustomizationRecord,
  cloneCustomizationRecord,
  CustomizationError,
  type CharacterStorePort,
  type CustomizationRecord,
} from '../../systems/customization/contracts';

export interface IndexedDbCharacterStoreOptions {
  readonly databaseName?: string;
  readonly objectStoreName?: string;
  readonly recordKey?: string;
  readonly indexedDB?: IDBFactory;
}

const DATABASE_VERSION = 1;
const DEFAULT_DATABASE_NAME = 'preston-character-customization';
const DEFAULT_OBJECT_STORE_NAME = 'customization';
const DEFAULT_RECORD_KEY = 'current';

export class IndexedDbCharacterStore implements CharacterStorePort {
  private readonly databaseName: string;
  private readonly objectStoreName: string;
  private readonly recordKey: string;
  private readonly factory: IDBFactory | undefined;
  private databasePromise: Promise<IDBDatabase> | undefined;

  constructor(options: IndexedDbCharacterStoreOptions = {}) {
    this.databaseName = options.databaseName ?? DEFAULT_DATABASE_NAME;
    this.objectStoreName = options.objectStoreName ?? DEFAULT_OBJECT_STORE_NAME;
    this.recordKey = options.recordKey ?? DEFAULT_RECORD_KEY;
    this.factory = options.indexedDB;
  }

  async load(): Promise<CustomizationRecord | null> {
    const database = await this.openDatabase();
    return new Promise((resolve, reject) => {
      let settled = false;
      const fail = (error: unknown): void => {
        if (settled) return;
        settled = true;
        reject(asStorageError(error));
      };
      try {
        const transaction = database.transaction(this.objectStoreName, 'readonly');
        const request = transaction.objectStore(this.objectStoreName).get(this.recordKey);
        request.onsuccess = (): void => {
          if (settled) return;
          const value = request.result;
          if (value === undefined) {
            settled = true;
            resolve(null);
            return;
          }
          try {
            assertCustomizationRecord(value);
            settled = true;
            resolve(cloneCustomizationRecord(value));
          } catch (error) {
            fail(asRecordError(error));
          }
        };
        request.onerror = (): void => fail(new CustomizationError('persistence-failed'));
        transaction.onerror = (): void => fail(new CustomizationError('persistence-failed'));
        transaction.onabort = (): void => fail(new CustomizationError('persistence-failed'));
      } catch (error) {
        fail(error);
      }
    });
  }

  async save(record: CustomizationRecord): Promise<void> {
    assertCustomizationRecord(record);
    const database = await this.openDatabase();
    return new Promise((resolve, reject) => {
      let settled = false;
      const fail = (error: unknown): void => {
        if (settled) return;
        settled = true;
        reject(asStorageError(error));
      };
      try {
        const transaction = database.transaction(this.objectStoreName, 'readwrite');
        const objectStore = transaction.objectStore(this.objectStoreName);
        const getRequest = objectStore.get(this.recordKey);
        getRequest.onsuccess = (): void => {
          if (settled) return;
          const existing = getRequest.result;
          if (existing !== undefined) {
            try {
              assertCustomizationRecord(existing);
              if (existing.revision > record.revision) {
                fail(new CustomizationError('stale-write'));
                transaction.abort();
                return;
              }
            } catch (error) {
              fail(asRecordError(error));
              transaction.abort();
              return;
            }
          }
          const putRequest = objectStore.put(cloneCustomizationRecord(record), this.recordKey);
          putRequest.onerror = (): void => fail(new CustomizationError('persistence-failed'));
        };
        getRequest.onerror = (): void => fail(new CustomizationError('persistence-failed'));
        transaction.oncomplete = (): void => {
          if (settled) return;
          settled = true;
          resolve();
        };
        transaction.onerror = (): void => fail(new CustomizationError('persistence-failed'));
        transaction.onabort = (): void => {
          if (!settled) fail(new CustomizationError('persistence-failed'));
        };
      } catch (error) {
        fail(error);
      }
    });
  }

  async clear(): Promise<void> {
    const database = await this.openDatabase();
    return new Promise((resolve, reject) => {
      let settled = false;
      const fail = (): void => {
        if (settled) return;
        settled = true;
        reject(new CustomizationError('persistence-failed'));
      };
      try {
        const transaction = database.transaction(this.objectStoreName, 'readwrite');
        const request = transaction.objectStore(this.objectStoreName).delete(this.recordKey);
        request.onerror = fail;
        transaction.oncomplete = (): void => {
          if (settled) return;
          settled = true;
          resolve();
        };
        transaction.onerror = fail;
        transaction.onabort = fail;
      } catch {
        fail();
      }
    });
  }

  close(): void {
    this.databasePromise?.then((database) => database.close()).catch(() => undefined);
    this.databasePromise = undefined;
  }

  private openDatabase(): Promise<IDBDatabase> {
    if (this.databasePromise !== undefined) return this.databasePromise;
    const factory = this.factory ?? globalThis.indexedDB;
    if (factory === undefined) {
      return Promise.reject(new CustomizationError('persistence-unavailable'));
    }

    const opening = new Promise<IDBDatabase>((resolve, reject) => {
      let request: IDBOpenDBRequest;
      try {
        request = factory.open(this.databaseName, DATABASE_VERSION);
      } catch {
        reject(new CustomizationError('persistence-unavailable'));
        return;
      }
      request.onupgradeneeded = (): void => {
        const database = request.result;
        if (!database.objectStoreNames.contains(this.objectStoreName)) {
          database.createObjectStore(this.objectStoreName);
        }
      };
      request.onsuccess = (): void => resolve(request.result);
      request.onerror = (): void => reject(new CustomizationError('persistence-unavailable'));
      request.onblocked = (): void => reject(new CustomizationError('persistence-unavailable'));
    });
    const databasePromise = opening.catch((error: unknown): never => {
      this.databasePromise = undefined;
      throw asStorageError(error);
    });
    this.databasePromise = databasePromise;
    return databasePromise;
  }
}

function asStorageError(error: unknown): CustomizationError {
  if (error instanceof CustomizationError) return error;
  return new CustomizationError('persistence-failed');
}

function asRecordError(error: unknown): CustomizationError {
  if (error instanceof CustomizationError && error.code === 'version-mismatch') {
    return error;
  }
  return new CustomizationError('corrupt-record');
}

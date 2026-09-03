import {
  assertCharacterSelection,
  assertCustomAssetRecord,
  assertCustomizationRecord,
  cloneCharacterSelection,
  cloneCustomAssetRecord,
  createDefaultCharacterSelection,
  CustomizationError,
  DEFAULT_CROP_SETTINGS,
  type CharacterRole,
  type CharacterSelection,
  type CharacterSkinRef,
  type CharacterStorePort,
  type CustomAssetRecord,
  type CustomizationErrorCode,
  type CustomizationClearResult,
  type CustomizationDeleteResult,
  type CustomizationFailure,
  type CustomizationLoadResult,
  type CustomizationMutationResult,
  type CustomizationRecord,
  type CustomizationSaveResult,
  type CustomizationSnapshot,
  type CustomizationWarning,
  type CropSettings,
  type ImageProcessingResult,
  type ImageProcessorPort,
  type ImageUploadInput,
  type ProcessUploadOptions,
} from './contracts';

export interface CharacterCustomizerOptions {
  readonly imageProcessor?: ImageProcessorPort;
  readonly processor?: ImageProcessorPort;
  readonly store?: CharacterStorePort;
  readonly fallbackStore?: CharacterStorePort;
  readonly idFactory?: () => string;
}

/**
 * Owns appearance references and their local lifecycle. It never derives or
 * changes gameplay values from an image.
 */
export class CharacterCustomizer {
  private readonly imageProcessor: ImageProcessorPort;
  private readonly primaryStore: CharacterStorePort;
  private readonly fallbackStore: CharacterStorePort;
  private readonly hasPersistentStore: boolean;
  private readonly idFactory: () => string;
  private readonly assets = new Map<string, CustomAssetRecord>();
  private currentSelection: CharacterSelection = createDefaultCharacterSelection();
  private persistenceMode: 'persistent' | 'memory';
  private warning: CustomizationWarning | undefined;
  private recordRevision = 0;
  private assetRevision = 0;
  private uploadOperation = 0;
  private latestUploadOperation = 0;
  private saveOperation = 0;
  private latestSaveOperation = 0;
  private writeQueue: Promise<void> = Promise.resolve();
  private primaryStoreFailed = false;

  constructor(options: CharacterCustomizerOptions);
  constructor(
    imageProcessor: ImageProcessorPort,
    store?: CharacterStorePort,
    fallbackStore?: CharacterStorePort,
  );
  constructor(
    first: CharacterCustomizerOptions | ImageProcessorPort,
    positionalStore?: CharacterStorePort,
    positionalFallbackStore?: CharacterStorePort,
  ) {
    const options = isCustomizerOptions(first)
      ? first
      : {
          imageProcessor: first,
          store: positionalStore,
          fallbackStore: positionalFallbackStore,
        };
    const processor = options.imageProcessor ?? options.processor;
    if (processor === undefined) {
      throw new CustomizationError('decode-failed', 'An image processor is required.');
    }

    this.imageProcessor = processor;
    this.hasPersistentStore = options.store !== undefined;
    this.fallbackStore = options.fallbackStore ?? new SessionMemoryStore();
    this.primaryStore = options.store ?? this.fallbackStore;
    this.persistenceMode = this.hasPersistentStore ? 'persistent' : 'memory';
    this.idFactory = options.idFactory ?? defaultIdFactory;
  }

  async loadSelection(): Promise<CustomizationLoadResult> {
    if (!this.hasPersistentStore || this.primaryStoreFailed) {
      const fallback = await this.loadFromFallback();
      return this.loadedResult(fallback.selection, fallback.source, fallback.warning);
    }

    try {
      const record = await this.primaryStore.load();
      if (record === null) {
        this.resetToDefaults(false);
        this.warning = undefined;
        return this.loadedResult(this.currentSelection, 'defaults');
      }
      assertCustomizationRecord(record);
      this.applyRecord(record);
      this.persistenceMode = 'persistent';
      this.warning = undefined;
      return this.loadedResult(this.currentSelection, 'persistent');
    } catch (error) {
      this.primaryStoreFailed = true;
      this.persistenceMode = 'memory';
      const warning = warningForError(error);
      this.warning = warning;
      const fallback = await this.loadFromFallback();
      return this.loadedResult(fallback.selection, fallback.source, warning ?? fallback.warning);
    }
  }

  async processUpload(
    input: ImageUploadInput,
    options: ProcessUploadOptions | CropSettings = {},
  ): Promise<ImageProcessingResult> {
    const operationNumber = ++this.uploadOperation;
    this.latestUploadOperation = operationNumber;
    const operationId =
      isCropSettings(options) || options === undefined
        ? `upload-${operationNumber}`
        : options.operationId ?? `upload-${operationNumber}`;
    const crop = isCropSettings(options)
      ? options
      : options.crop ?? DEFAULT_CROP_SETTINGS;
    const role = isCropSettings(options)
      ? input.role ?? input.target ?? 'player'
      : options.role ?? input.role ?? input.target ?? 'player';

    try {
      const image = await this.imageProcessor.process(input, crop);
      if (operationNumber !== this.latestUploadOperation) {
        return staleImageResult(operationId, operationNumber);
      }

      const revision = ++this.assetRevision;
      const id = this.createAssetId();
      const asset: CustomAssetRecord = {
        id,
        revision,
        role,
        ...image,
      };
      assertCustomAssetRecord(asset);
      this.assets.set(id, asset);
      return {
        ok: true,
        status: 'processed',
        operationId,
        revision,
        role,
        ref: { kind: 'local-upload', id, revision },
        asset: cloneCustomAssetRecord(asset),
        image: { ...image },
      };
    } catch (error) {
      if (operationNumber !== this.latestUploadOperation) {
        return staleImageResult(operationId, operationNumber);
      }
      return {
        ok: false,
        status: 'rejected',
        operationId,
        revision: operationNumber,
        error: asCustomizationError(error, 'decode-failed'),
      };
    }
  }

  getSelection(): CharacterSelection {
    return cloneCharacterSelection(this.currentSelection);
  }

  getSnapshot(): CustomizationSnapshot {
    const selection = cloneCharacterSelection(this.currentSelection);
    const assets = Array.from(this.assets.values()).map(cloneCustomAssetRecord);
    const snapshot = {
      selection,
      assets,
      revision: this.recordRevision,
      persistence: this.persistenceMode,
    } as CustomizationSnapshot;
    return this.warning === undefined ? snapshot : { ...snapshot, warning: this.warning };
  }

  snapshot(): CustomizationSnapshot {
    return this.getSnapshot();
  }

  getAsset(id: string): CustomAssetRecord | undefined {
    const asset = this.assets.get(id);
    return asset === undefined ? undefined : cloneCustomAssetRecord(asset);
  }

  setSelection(selection: CharacterSelection): CustomizationMutationResult {
    return this.commitSelection(selection);
  }

  selectPlayer(ref: CharacterSkinRef): CustomizationMutationResult {
    return this.commitSelection({
      player: ref,
      enemies: this.currentSelection.enemies,
    });
  }

  setPlayerSelection(ref: CharacterSkinRef): CustomizationMutationResult {
    return this.selectPlayer(ref);
  }

  setEnemyRoster(enemies: readonly CharacterSkinRef[]): CustomizationMutationResult {
    return this.commitSelection({
      player: this.currentSelection.player,
      enemies: [...enemies],
    });
  }

  selectEnemies(enemies: readonly CharacterSkinRef[]): CustomizationMutationResult {
    return this.setEnemyRoster(enemies);
  }

  addEnemy(ref: CharacterSkinRef): CustomizationMutationResult {
    return this.setEnemyRoster([...this.currentSelection.enemies, ref]);
  }

  removeEnemy(refOrId: CharacterSkinRef | string): CustomizationMutationResult {
    const enemies = this.currentSelection.enemies.filter((enemy) => {
      if (typeof refOrId === 'string') {
        return enemy.kind !== 'local-upload' || enemy.id !== refOrId;
      }
      return !sameSkinRef(enemy, refOrId);
    });
    return this.setEnemyRoster(enemies);
  }

  async saveSelection(selection: CharacterSelection = this.currentSelection): Promise<CustomizationSaveResult> {
    let candidate: CharacterSelection;
    try {
      candidate = cloneCharacterSelection(selection);
      this.validateSelectionAgainstAssets(candidate);
    } catch (error) {
      return failureResult(asCustomizationError(error, 'invalid-selection'));
    }

    const operation = ++this.saveOperation;
    this.latestSaveOperation = operation;
    const record: CustomizationRecord = {
      schemaVersion: 1,
      revision: Math.max(this.recordRevision + 1, operation),
      selection: candidate,
      assets: Array.from(this.assets.values()).map(cloneCustomAssetRecord),
    };
    const task: Promise<CustomizationSaveResult> = this.writeQueue.then(async () => {
      if (operation !== this.latestSaveOperation) return staleSaveResult();
      return this.performSave(record, operation);
    });
    this.writeQueue = task.then(
      () => undefined,
      () => undefined,
    );
    return task;
  }

  async deleteUpload(id: string): Promise<CustomizationDeleteResult> {
    if (!this.assets.has(id)) {
      return failureResult(new CustomizationError('not-found'));
    }

    this.assets.delete(id);
    const player =
      this.currentSelection.player.kind === 'local-upload' && this.currentSelection.player.id === id
        ? createDefaultCharacterSelection().player
        : this.currentSelection.player;
    const enemies = this.currentSelection.enemies.filter(
      (enemy) => enemy.kind !== 'local-upload' || enemy.id !== id,
    );
    const saved = await this.saveSelection({ player, enemies });
    if (!saved.ok) return saved;
    return {
      ok: true,
      status: 'deleted',
      selection: saved.selection,
      snapshot: saved.snapshot,
      persisted: saved.persisted,
      ...(saved.warning === undefined ? {} : { warning: saved.warning }),
    };
  }

  async clearLocalData(): Promise<CustomizationClearResult> {
    const operation = ++this.saveOperation;
    this.latestSaveOperation = operation;
    const task: Promise<CustomizationClearResult> = this.writeQueue.then(async () => {
      if (operation !== this.latestSaveOperation) return staleClearResult();

      let persisted = false;
      let warning: CustomizationWarning | undefined;
      // Clearing is also the recovery path for corrupt/version-mismatched
      // records, so retry the primary store even after a prior read failure.
      if (this.hasPersistentStore) {
        try {
          await this.primaryStore.clear();
          persisted = true;
          this.primaryStoreFailed = false;
          this.persistenceMode = 'persistent';
        } catch (error) {
          this.primaryStoreFailed = true;
          this.persistenceMode = 'memory';
          warning = warningForError(error) ?? { code: 'persistence-failed' };
        }
      }

      try {
        if (this.fallbackStore !== this.primaryStore) await this.fallbackStore.clear();
      } catch {
        warning ??= { code: 'persistence-failed' };
      }

      this.assets.clear();
      this.currentSelection = createDefaultCharacterSelection();
      this.recordRevision = 0;
      this.assetRevision = 0;
      this.warning = warning;
      const snapshot = this.getSnapshot();
      const result: CustomizationClearResult = {
        ok: true,
        status: 'cleared',
        selection: snapshot.selection,
        snapshot,
        persisted,
        ...(warning === undefined ? {} : { warning }),
      };
      return result;
    });
    this.writeQueue = task.then(
      () => undefined,
      () => undefined,
    );
    return task;
  }

  private async performSave(
    record: CustomizationRecord,
    operation: number,
  ): Promise<CustomizationSaveResult> {
    let persisted = false;
    let warning: CustomizationWarning | undefined;
    if (this.hasPersistentStore && !this.primaryStoreFailed) {
      try {
        await this.primaryStore.save(record);
        persisted = true;
        this.persistenceMode = 'persistent';
      } catch (error) {
        this.primaryStoreFailed = true;
        this.persistenceMode = 'memory';
        warning = warningForError(error) ?? { code: 'persistence-failed' };
      }
    }

    if (!persisted) {
      try {
        await this.fallbackStore.save(record);
      } catch {
        warning ??= { code: 'persistence-failed' };
      }
    }

    if (operation !== this.latestSaveOperation) return staleSaveResult();

    this.recordRevision = Math.max(this.recordRevision, record.revision);
    this.currentSelection = cloneCharacterSelection(record.selection);
    this.warning = warning;
    const snapshot = this.getSnapshot();
    return {
      ok: true,
      status: 'saved',
      persisted,
      selection: snapshot.selection,
      snapshot,
      ...(warning === undefined ? {} : { warning }),
    };
  }

  private commitSelection(selection: CharacterSelection): CustomizationMutationResult {
    try {
      const next = cloneCharacterSelection(selection);
      this.validateSelectionAgainstAssets(next);
      this.currentSelection = next;
      const snapshot = this.getSnapshot();
      return {
        ok: true,
        status: 'updated',
        selection: snapshot.selection,
        snapshot,
      };
    } catch (error) {
      return failureResult(asCustomizationError(error, 'invalid-selection'));
    }
  }

  private validateSelectionAgainstAssets(selection: CharacterSelection): void {
    assertCharacterSelection(selection);
    this.validateSkinRef(selection.player, 'player');
    for (const enemy of selection.enemies) this.validateSkinRef(enemy, 'enemy');
  }

  private validateSkinRef(ref: CharacterSkinRef, role: CharacterRole): void {
    if (ref.kind === 'packaged') {
      if (role === 'player' && ref.assetKey !== 'player.default') {
        throw new CustomizationError('invalid-selection');
      }
      if (role === 'enemy' && !ref.assetKey.startsWith('enemy.')) {
        throw new CustomizationError('invalid-selection');
      }
      return;
    }

    const asset = this.assets.get(ref.id);
    if (asset === undefined || asset.revision !== ref.revision) {
      throw new CustomizationError('missing-asset');
    }
    if (asset.role !== role) throw new CustomizationError('invalid-selection');
  }

  private createAssetId(): string {
    const generated = this.idFactory();
    if (generated.length > 0 && !this.assets.has(generated)) return generated;
    let fallback = `local-${this.assetRevision}`;
    while (this.assets.has(fallback)) fallback = `local-${++this.assetRevision}`;
    return fallback;
  }

  private applyRecord(record: CustomizationRecord): void {
    const assets = new Map<string, CustomAssetRecord>();
    for (const asset of record.assets) {
      assertCustomAssetRecord(asset);
      assets.set(asset.id, cloneCustomAssetRecord(asset));
    }
    this.assets.clear();
    for (const [id, asset] of assets) this.assets.set(id, asset);
    this.validateSelectionAgainstAssets(record.selection);
    this.currentSelection = cloneCharacterSelection(record.selection);
    this.recordRevision = record.revision;
    this.assetRevision = Math.max(0, ...record.assets.map((asset) => asset.revision));
  }

  private resetToDefaults(clearWarning: boolean): void {
    this.assets.clear();
    this.currentSelection = createDefaultCharacterSelection();
    this.recordRevision = 0;
    this.assetRevision = 0;
    if (clearWarning) this.warning = undefined;
  }

  private async loadFromFallback(): Promise<{
    selection: CharacterSelection;
    source: 'memory' | 'defaults';
    warning?: CustomizationWarning;
  }> {
    try {
      const record = await this.fallbackStore.load();
      if (record === null) {
        this.resetToDefaults(false);
        return { selection: this.currentSelection, source: 'defaults' };
      }
      assertCustomizationRecord(record);
      this.applyRecord(record);
      this.persistenceMode = 'memory';
      return { selection: this.currentSelection, source: 'memory' };
    } catch (error) {
      this.resetToDefaults(false);
      return {
        selection: this.currentSelection,
        source: 'defaults',
        warning: warningForError(error) ?? { code: 'corrupt-record' },
      };
    }
  }

  private loadedResult(
    selection: CharacterSelection,
    source: 'persistent' | 'memory' | 'defaults',
    warning?: CustomizationWarning,
  ): CustomizationLoadResult {
    if (warning !== undefined) this.warning = warning;
    const snapshot = this.getSnapshot();
    return {
      ok: true,
      status: 'loaded',
      source,
      selection: cloneCharacterSelection(selection),
      snapshot,
      ...(this.warning === undefined ? {} : { warning: this.warning }),
    };
  }
}

class SessionMemoryStore implements CharacterStorePort {
  private record: CustomizationRecord | null = null;

  async load(): Promise<CustomizationRecord | null> {
    return this.record === null ? null : cloneRecord(this.record);
  }

  async save(record: CustomizationRecord): Promise<void> {
    assertCustomizationRecord(record);
    if (this.record !== null && this.record.revision > record.revision) {
      throw new CustomizationError('stale-write');
    }
    this.record = cloneRecord(record);
  }

  async clear(): Promise<void> {
    this.record = null;
  }
}

function isCustomizerOptions(
  value: CharacterCustomizerOptions | ImageProcessorPort,
): value is CharacterCustomizerOptions {
  return 'imageProcessor' in value || 'processor' in value || 'store' in value || 'fallbackStore' in value;
}

function isCropSettings(value: unknown): value is NonNullable<ProcessUploadOptions['crop']> {
  return (
    typeof value === 'object' &&
    value !== null &&
    'panX' in value &&
    'panY' in value &&
    'zoom' in value
  );
}

function defaultIdFactory(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `local-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function sameSkinRef(left: CharacterSkinRef, right: CharacterSkinRef): boolean {
  if (left.kind !== right.kind) return false;
  if (left.kind === 'packaged' && right.kind === 'packaged') {
    return left.assetKey === right.assetKey;
  }
  if (left.kind === 'local-upload' && right.kind === 'local-upload') {
    return left.id === right.id && left.revision === right.revision;
  }
  return false;
}

function staleImageResult(operationId: string, revision: number): ImageProcessingResult {
  return {
    ok: false,
    status: 'stale',
    operationId,
    revision,
    error: new CustomizationError('stale-operation'),
  };
}

function staleSaveResult(): CustomizationSaveResult {
  return {
    ok: false,
    status: 'stale',
    error: new CustomizationError('stale-write'),
  };
}

function staleClearResult(): CustomizationClearResult {
  return {
    ok: false,
    status: 'stale',
    error: new CustomizationError('stale-write'),
  };
}

function failureResult(error: CustomizationError): CustomizationFailure {
  return { ok: false, status: 'rejected', error };
}

function asCustomizationError(error: unknown, fallback: CustomizationErrorCode): CustomizationError {
  if (error instanceof CustomizationError) return error;
  return new CustomizationError(fallback);
}

function warningForError(error: unknown): CustomizationWarning | undefined {
  if (!(error instanceof CustomizationError)) return { code: 'persistence-failed' };
  switch (error.code) {
    case 'persistence-unavailable':
      return { code: 'persistence-unavailable' };
    case 'corrupt-record':
      return { code: 'corrupt-record' };
    case 'version-mismatch':
      return { code: 'version-mismatch' };
    case 'invalid-asset':
    case 'invalid-selection':
    case 'missing-asset':
    case 'duplicate-enemy':
    case 'too-many-enemies':
      return { code: 'corrupt-record' };
    case 'persistence-failed':
    case 'stale-write':
      return { code: 'persistence-failed' };
    default:
      return { code: 'persistence-failed' };
  }
}

function cloneRecord(record: CustomizationRecord): CustomizationRecord {
  return {
    schemaVersion: 1,
    revision: record.revision,
    selection: cloneCharacterSelection(record.selection),
    assets: record.assets.map(cloneCustomAssetRecord),
  };
}

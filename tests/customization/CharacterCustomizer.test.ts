import { describe, expect, it } from 'vitest';
import {
  CharacterCustomizer,
  createDefaultCharacterSelection,
  CustomizationError,
  type CharacterStorePort,
  type CropSettings,
  type CustomizationRecord,
  type ImageProcessorPort,
  type ImageUploadInput,
  type NormalizedCharacterImage,
} from '../../src/systems/customization';
import { MemoryCharacterStore } from '../../src/adapters/persistence/MemoryCharacterStore';

const PNG_CROP: CropSettings = { panX: 0, panY: 0, zoom: 1 };

class ImmediateImageProcessor implements ImageProcessorPort {
  async process(input: ImageUploadInput, crop = PNG_CROP): Promise<NormalizedCharacterImage> {
    return {
      blob: new Blob(['normalized'], { type: 'image/webp' }),
      mimeType: 'image/webp',
      width: 512,
      height: 512,
      sourceMimeType: (input.mimeType ?? 'image/png') as 'image/png',
      sourceWidth: 256,
      sourceHeight: 256,
      crop,
    };
  }
}

class DeferredImageProcessor implements ImageProcessorPort {
  readonly pending: Array<(image: NormalizedCharacterImage) => void> = [];

  process(): Promise<NormalizedCharacterImage> {
    return new Promise((resolve) => this.pending.push(resolve));
  }
}

class FailingStore implements CharacterStorePort {
  async load(): Promise<null> {
    throw new CustomizationError('persistence-unavailable');
  }

  async save(): Promise<void> {
    throw new CustomizationError('persistence-unavailable');
  }

  async clear(): Promise<void> {
    throw new CustomizationError('persistence-unavailable');
  }
}

class DeferredStore implements CharacterStorePort {
  readonly pending: Array<() => void> = [];

  async load(): Promise<null> {
    return null;
  }

  save(record: CustomizationRecord): Promise<void> {
    return new Promise((resolve) => {
      this.pending.push(() => resolve());
      void record;
    });
  }

  async clear(): Promise<void> {
    return undefined;
  }
}

class CorruptThenClearStore implements CharacterStorePort {
  clearCalls = 0;

  async load(): Promise<CustomizationRecord | null> {
    throw new CustomizationError('corrupt-record');
  }

  async save(): Promise<void> {
    return undefined;
  }

  async clear(): Promise<void> {
    this.clearCalls += 1;
  }
}

function image(): NormalizedCharacterImage {
  return {
    blob: new Blob(['normalized'], { type: 'image/webp' }),
    mimeType: 'image/webp',
    width: 512,
    height: 512,
    sourceMimeType: 'image/png',
    sourceWidth: 256,
    sourceHeight: 256,
    crop: PNG_CROP,
  };
}

function input(role?: 'player' | 'enemy'): ImageUploadInput {
  return {
    file: new Blob(['source'], { type: 'image/png' }),
    mimeType: 'image/png',
    role,
  };
}

describe('CharacterCustomizer', () => {
  it('starts with the packaged player and four packaged enemies', () => {
    const customizer = new CharacterCustomizer({
      imageProcessor: new ImmediateImageProcessor(),
    });

    expect(customizer.getSelection()).toEqual(createDefaultCharacterSelection());
    expect(customizer.getSnapshot().assets).toHaveLength(0);
  });

  it('does not let a stale image operation replace the latest result', async () => {
    const processor = new DeferredImageProcessor();
    const customizer = new CharacterCustomizer({ imageProcessor: processor });
    const first = customizer.processUpload(input());
    const second = customizer.processUpload(input());

    processor.pending[1]?.(image());
    const secondResult = await second;
    processor.pending[0]?.(image());
    const firstResult = await first;

    expect(secondResult.ok).toBe(true);
    expect(firstResult.ok).toBe(false);
    if (!firstResult.ok) expect(firstResult.error.code).toBe('stale-operation');
    expect(customizer.getSnapshot().assets).toHaveLength(1);
  });

  it('limits the enemy roster to eight and keeps packaged refs appearance-only', async () => {
    const customizer = new CharacterCustomizer({ imageProcessor: new ImmediateImageProcessor() });
    const refs = [];
    for (let index = 0; index < 9; index += 1) {
      const result = await customizer.processUpload(input('enemy'));
      expect(result.ok).toBe(true);
      if (result.ok) refs.push(result.ref);
    }

    expect(customizer.setEnemyRoster(refs.slice(0, 8)).ok).toBe(true);
    const rejected = customizer.addEnemy(refs[8]!);
    expect(rejected.ok).toBe(false);
    if (!rejected.ok) expect(rejected.error.code).toBe('too-many-enemies');
    expect(customizer.getSelection().enemies).toHaveLength(8);
  });

  it('saves and reloads normalized assets and selection through the memory port', async () => {
    const store = new MemoryCharacterStore();
    const first = new CharacterCustomizer({
      imageProcessor: new ImmediateImageProcessor(),
      store,
    });
    const player = await first.processUpload(input('player'));
    const enemy = await first.processUpload(input('enemy'));
    expect(player.ok && enemy.ok).toBe(true);
    if (!player.ok || !enemy.ok) return;
    expect(first.selectPlayer(player.ref).ok).toBe(true);
    expect(first.addEnemy(enemy.ref).ok).toBe(true);
    const saved = await first.saveSelection();
    expect(saved.ok).toBe(true);
    if (!saved.ok) return;

    const second = new CharacterCustomizer({
      imageProcessor: new ImmediateImageProcessor(),
      store,
    });
    const loaded = await second.loadSelection();
    expect(loaded.source).toBe('persistent');
    expect(loaded.selection).toEqual(saved.selection);
    expect(loaded.snapshot.assets).toHaveLength(2);
  });

  it('falls back to session memory when durable persistence fails', async () => {
    const fallback = new MemoryCharacterStore();
    const customizer = new CharacterCustomizer({
      imageProcessor: new ImmediateImageProcessor(),
      store: new FailingStore(),
      fallbackStore: fallback,
    });
    const upload = await customizer.processUpload(input('player'));
    expect(upload.ok).toBe(true);
    if (!upload.ok) return;
    expect(customizer.selectPlayer(upload.ref).ok).toBe(true);

    const saved = await customizer.saveSelection();
    expect(saved.ok).toBe(true);
    if (saved.ok) {
      expect(saved.persisted).toBe(false);
      expect(saved.snapshot.persistence).toBe('memory');
      expect(saved.warning?.code).toBe('persistence-unavailable');
    }
  });

  it('clears a corrupt durable record so reset is a real recovery path', async () => {
    const store = new CorruptThenClearStore();
    const customizer = new CharacterCustomizer({
      imageProcessor: new ImmediateImageProcessor(),
      store,
    });

    const loaded = await customizer.loadSelection();
    expect(loaded.warning?.code).toBe('corrupt-record');

    const cleared = await customizer.clearLocalData();
    expect(cleared.ok).toBe(true);
    if (!cleared.ok) return;
    expect(cleared.persisted).toBe(true);
    expect(cleared.snapshot.persistence).toBe('persistent');
    expect(store.clearCalls).toBe(1);
  });

  it('rejects local refs that are missing or have no matching asset revision', () => {
    const customizer = new CharacterCustomizer({ imageProcessor: new ImmediateImageProcessor() });
    const result = customizer.selectPlayer({ kind: 'local-upload', id: 'missing', revision: 1 });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('missing-asset');
  });

  it('returns a stale result when a newer save supersedes an in-flight write', async () => {
    const store = new DeferredStore();
    const customizer = new CharacterCustomizer({
      imageProcessor: new ImmediateImageProcessor(),
      store,
    });
    const first = customizer.saveSelection();
    await Promise.resolve();
    const second = customizer.saveSelection({
      player: { kind: 'packaged', assetKey: 'player.default' },
      enemies: [{ kind: 'packaged', assetKey: 'enemy.01' }],
    });
    store.pending[0]?.();
    const firstResult = await first;
    expect(firstResult.ok).toBe(false);
    if (!firstResult.ok) expect(firstResult.status).toBe('stale');
    store.pending[1]?.();
    const secondResult = await second;
    expect(secondResult.ok).toBe(true);
    expect(customizer.getSelection().enemies).toEqual([{ kind: 'packaged', assetKey: 'enemy.01' }]);
  });
});

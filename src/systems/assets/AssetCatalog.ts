import {
  AUDIO_ASSET_KEYS,
  AssetCatalogError,
  IMAGE_ASSET_KEYS,
  isAudioAssetKey,
  isImageAssetKey,
  type AssetDescriptor,
  type AssetFailure,
  type AssetKey,
  type AssetManifest,
  type AssetManifestLoader,
  type AssetManifestResult,
  type AssetCatalogPort,
  type AssetCatalogSnapshot,
  type AssetCatalogState,
  type BackgroundRenderingConfig,
  type BackgroundSceneConfig,
  type AudioAssetKey,
  type ImageAssetKey,
} from './contracts';

const MANIFEST_SCHEMA_VERSION = 1 as const;
const AUDIO_FORMATS = new Set(['ogg', 'mp3']);

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const failure = (
  code: AssetFailure['code'],
  message: string,
  details: Pick<AssetFailure, 'key' | 'path' | 'cause'> = {},
): AssetManifestResult => ({
  ok: false,
  failure: { kind: 'asset-failure', code, message, ...details },
});

const extensionOf = (path: string): string => {
  const cleanPath = path.split(/[?#]/, 1)[0] ?? path;
  const dot = cleanPath.lastIndexOf('.');
  return dot >= 0 ? cleanPath.slice(dot + 1).toLowerCase() : '';
};

const isSafeRelativePath = (path: string): boolean => {
  if (path.length === 0 || path.startsWith('/') || path.includes('\\')) {
    return false;
  }
  if (/^[a-z][a-z\d+.-]*:\/\//i.test(path)) return false;
  return !path.split('/').some((part) => part === '' || part === '.' || part === '..');
};

const isValidBasePath = (basePath: string): boolean => {
  if (basePath.length === 0 || basePath.includes('\\')) return false;
  if (/^[a-z][a-z\d+.-]*:\/\//i.test(basePath)) {
    try {
      // URL construction also rejects malformed absolute bases.
      new URL(basePath);
      return true;
    } catch {
      return false;
    }
  }
  return basePath.startsWith('/') && !basePath.split('/').includes('..');
};

const resolveAssetUrl = (basePath: string, relativePath: string): string => {
  if (/^[a-z][a-z\d+.-]*:\/\//i.test(basePath)) {
    return new URL(relativePath, basePath.endsWith('/') ? basePath : `${basePath}/`).toString();
  }
  const base = basePath.endsWith('/') ? basePath : `${basePath}/`;
  return `${base}${relativePath}`;
};

const source = (basePath: string, path: string): { path: string; url: string; format: string } => ({
  path,
  url: resolveAssetUrl(basePath, path),
  format: extensionOf(path),
});

const freezeBackground = (value: BackgroundRenderingConfig): BackgroundRenderingConfig =>
  Object.freeze({
    ...value,
    opening: Object.freeze({
      ...value.opening,
      originalTileRepeat: Object.freeze([...value.opening.originalTileRepeat]) as readonly [number, number],
      mirrorSupertileRepeat: Object.freeze([...value.opening.mirrorSupertileRepeat]) as readonly [number, number],
    }),
    gameplay: Object.freeze({
      ...value.gameplay,
      originalTileRepeat: Object.freeze([...value.gameplay.originalTileRepeat]) as readonly [number, number],
      mirrorSupertileRepeat: Object.freeze([...value.gameplay.mirrorSupertileRepeat]) as readonly [number, number],
    }),
  });

const freezeManifest = (value: AssetManifest): AssetManifest => {
  const images = Object.freeze({ ...value.images });
  const audio = Object.freeze(
    Object.fromEntries(
      Object.entries(value.audio).map(([key, paths]) => [key, Object.freeze([...paths])]),
    ),
  ) as Readonly<Record<keyof AssetManifest['audio'], readonly string[]>>;
  return Object.freeze({
    ...value,
    images,
    audio,
    backgroundRendering: freezeBackground(value.backgroundRendering),
  });
};

const readRequiredString = (
  record: Record<string, unknown>,
  key: string,
  area: string,
): string | AssetManifestResult => {
  const value = record[key];
  if (typeof value !== 'string' || value.length === 0) {
    return failure('manifest-missing-key', `${area}.${key} must be a non-empty string.`, { key });
  }
  return value;
};

const readRepeat = (value: unknown): readonly [number, number] | undefined => {
  if (!Array.isArray(value) || value.length !== 2) return undefined;
  const [first, second] = value;
  if (
    typeof first !== 'number' ||
    typeof second !== 'number' ||
    !Number.isInteger(first) ||
    !Number.isInteger(second) ||
    first < 1 ||
    second < 1
  ) {
    return undefined;
  }
  return [first, second];
};

const readBackgroundScene = (
  value: unknown,
  scene: 'opening' | 'gameplay',
): BackgroundSceneConfig | AssetManifestResult => {
  if (!isRecord(value)) {
    return failure('manifest-invalid-background', `backgroundRendering.${scene} must be an object.`);
  }

  const keys = ['preferredKey', 'fallbackKey', 'sourceTileKey'] as const;
  const stringValues: Partial<Record<(typeof keys)[number], ImageAssetKey>> = {};
  for (const key of keys) {
    const candidate = value[key];
    if (typeof candidate !== 'string' || !isImageAssetKey(candidate)) {
      return failure('manifest-invalid-background', `backgroundRendering.${scene}.${key} is not an image asset key.`, { key: candidate as string | undefined });
    }
    stringValues[key] = candidate;
  }

  if (value.wrap !== 'mirror' || value.filter !== 'bilinear') {
    return failure('manifest-invalid-background', `backgroundRendering.${scene} must use mirror/bilinear rendering.`);
  }
  const originalTileRepeat = readRepeat(value.originalTileRepeat);
  const mirrorSupertileRepeat = readRepeat(value.mirrorSupertileRepeat);
  if (!originalTileRepeat || !mirrorSupertileRepeat) {
    return failure('manifest-invalid-background', `backgroundRendering.${scene} repeat values must be positive integer pairs.`);
  }

  const preferredKey = stringValues.preferredKey;
  const fallbackKey = stringValues.fallbackKey;
  const sourceTileKey = stringValues.sourceTileKey;
  if (!preferredKey || !fallbackKey || !sourceTileKey) {
    return failure('manifest-invalid-background', `backgroundRendering.${scene} is missing a required asset key.`);
  }

  return {
    preferredKey,
    fallbackKey,
    sourceTileKey,
    wrap: 'mirror',
    originalTileRepeat,
    mirrorSupertileRepeat,
    filter: 'bilinear',
  };
};

const readBackgroundRendering = (value: unknown): BackgroundRenderingConfig | AssetManifestResult => {
  if (!isRecord(value) || value.designAspectRatio !== '9:16') {
    return failure('manifest-invalid-background', 'backgroundRendering must declare the 9:16 design aspect ratio.');
  }
  const opening = readBackgroundScene(value.opening, 'opening');
  if (!('preferredKey' in opening)) return opening;
  const gameplay = readBackgroundScene(value.gameplay, 'gameplay');
  if (!('preferredKey' in gameplay)) return gameplay;
  const referenceConfig = value.referenceConfig;
  if (referenceConfig !== undefined && typeof referenceConfig !== 'string') {
    return failure('manifest-invalid-background', 'backgroundRendering.referenceConfig must be a string when present.');
  }
  return {
    designAspectRatio: '9:16',
    opening,
    gameplay,
    ...(referenceConfig === undefined ? {} : { referenceConfig }),
  };
};

/** Validate and normalize an untrusted JSON manifest without side effects. */
export const parseAssetManifest = (value: unknown): AssetManifestResult => {
  if (!isRecord(value)) return failure('manifest-invalid', 'Asset manifest must be a JSON object.');

  if (value.schemaVersion !== MANIFEST_SCHEMA_VERSION) {
    return failure('manifest-schema-mismatch', `Unsupported asset manifest schema version: ${String(value.schemaVersion)}.`);
  }
  if (typeof value.basePath !== 'string' || !isValidBasePath(value.basePath)) {
    return failure('manifest-invalid-path', 'basePath must be an absolute site path or valid URL.');
  }
  if (!isRecord(value.images) || !isRecord(value.audio)) {
    return failure('manifest-invalid', 'Manifest must contain images and audio objects.');
  }

  for (const key of Object.keys(value.images)) {
    if (!isImageAssetKey(key)) {
      return failure('manifest-unknown-key', `Unknown image asset key: ${key}.`, { key });
    }
  }
  for (const key of Object.keys(value.audio)) {
    if (!isAudioAssetKey(key)) {
      return failure('manifest-unknown-key', `Unknown audio asset key: ${key}.`, { key });
    }
  }

  const imageMap = {} as Record<ImageAssetKey, string>;
  for (const key of IMAGE_ASSET_KEYS) {
    const path = readRequiredString(value.images, key, 'images');
    if (typeof path !== 'string') return path;
    if (!isSafeRelativePath(path) || !['png', 'jpg', 'jpeg', 'webp'].includes(extensionOf(path))) {
      return failure('manifest-invalid-path', `Invalid image path for ${key}.`, { key, path });
    }
    imageMap[key] = path;
  }
  const audioMap = {} as Record<AudioAssetKey, readonly string[]>;
  for (const key of AUDIO_ASSET_KEYS) {
    const values = value.audio[key];
    if (
      !Array.isArray(values) ||
      values.length === 0 ||
      values.length > 2 ||
      values.some((candidate) => typeof candidate !== 'string')
    ) {
      return failure('manifest-missing-key', `audio.${key} must contain one or two source paths.`, { key });
    }
    const paths = values as string[];
    for (const path of paths) {
      if (!isSafeRelativePath(path) || !AUDIO_FORMATS.has(extensionOf(path))) {
        return failure('manifest-invalid-path', `Invalid audio path for ${key}.`, { key, path });
      }
    }
    audioMap[key] = [...paths];
  }

  const backgroundRendering = readBackgroundRendering(value.backgroundRendering);
  if (!('designAspectRatio' in backgroundRendering)) return backgroundRendering;

  return {
    ok: true,
    manifest: freezeManifest({
      schemaVersion: MANIFEST_SCHEMA_VERSION,
      basePath: value.basePath,
      images: imageMap,
      audio: audioMap,
      backgroundRendering,
    }),
  };
};

export class AssetCatalog implements AssetCatalogPort {
  private state: AssetCatalogState = 'idle';
  private manifest?: AssetManifest;
  private failure?: AssetFailure;
  private descriptors: Partial<Record<AssetKey, AssetDescriptor>> = {};
  private pending?: Promise<AssetManifestResult>;

  public constructor(private readonly loader: AssetManifestLoader) {}

  public loadManifest(): Promise<AssetManifestResult> {
    if (this.state === 'ready' && this.manifest) {
      return Promise.resolve({ ok: true, manifest: this.manifest });
    }
    if (this.state === 'loading' && this.pending) return this.pending;

    this.state = 'loading';
    this.failure = undefined;
    this.pending = this.loadAndBuild();
    return this.pending;
  }

  public getRequired(key: AssetKey): AssetDescriptor {
    const descriptor = this.descriptors[key];
    if (descriptor) return descriptor;
    const catalogFailure: AssetFailure = this.failure ?? {
      kind: 'asset-failure',
      code: this.state === 'idle' ? 'manifest-load-failed' : 'manifest-invalid',
      message: `Asset ${key} is unavailable; load the manifest before resolving assets.`,
      key,
    };
    throw new AssetCatalogError(catalogFailure);
  }

  public getOptional(key: string): AssetDescriptor | undefined {
    return isImageAssetKey(key) || isAudioAssetKey(key) ? this.descriptors[key] : undefined;
  }

  public snapshot(): AssetCatalogSnapshot {
    return {
      state: this.state,
      ...(this.manifest ? { manifest: this.manifest } : {}),
      descriptors: Object.freeze({ ...this.descriptors }) as Readonly<Record<AssetKey, AssetDescriptor>>,
      ...(this.failure ? { failure: this.failure } : {}),
    };
  }

  private async loadAndBuild(): Promise<AssetManifestResult> {
    try {
      const result = parseAssetManifest(await this.loader.load());
      if (!result.ok) {
        this.state = 'failed';
        this.failure = result.failure;
        this.pending = undefined;
        return result;
      }

      const descriptors: Partial<Record<AssetKey, AssetDescriptor>> = {};
      for (const key of IMAGE_ASSET_KEYS) {
        const paths = [result.manifest.images[key]];
        descriptors[key] = this.makeDescriptor(key, 'image', paths, result.manifest.basePath);
      }
      for (const key of AUDIO_ASSET_KEYS) {
        descriptors[key] = this.makeDescriptor(key, 'audio', result.manifest.audio[key], result.manifest.basePath);
      }
      this.manifest = result.manifest;
      this.descriptors = descriptors;
      this.state = 'ready';
      this.failure = undefined;
      this.pending = undefined;
      return result;
    } catch (cause) {
      const loadFailure: AssetFailure = {
        kind: 'asset-failure',
        code: 'manifest-load-failed',
        message: cause instanceof Error ? cause.message : 'Asset manifest could not be loaded.',
        cause,
      };
      this.state = 'failed';
      this.failure = loadFailure;
      this.pending = undefined;
      return { ok: false, failure: loadFailure };
    }
  }

  private makeDescriptor(
    key: AssetKey,
    kind: 'image' | 'audio',
    paths: readonly string[],
    basePath: string,
  ): AssetDescriptor {
    const sources = paths.map((path) => source(basePath, path));
    return Object.freeze({
      key,
      kind,
      url: sources[0]?.url ?? '',
      urls: Object.freeze(sources.map((entry) => entry.url)),
      sources: Object.freeze(sources),
    });
  }
}

export const createAssetCatalog = (loader: AssetManifestLoader): AssetCatalog =>
  new AssetCatalog(loader);

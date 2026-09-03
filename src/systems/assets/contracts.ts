/** The thirteen image roles shipped by the v4 runtime package. */
export type ImageAssetKey =
  | 'player.default'
  | 'enemy.01'
  | 'enemy.02'
  | 'enemy.03'
  | 'enemy.04'
  | 'projectile.default'
  | 'background.openingTile'
  | 'background.openingMirrorSupertile'
  | 'background.openingFixed'
  | 'background.gameplayTile'
  | 'background.gameplayMirrorSupertile'
  | 'background.gameplayFixed'
  | 'ui.knob';

/** The six semantic audio roles shipped by the v4 runtime package. */
export type AudioAssetKey =
  | 'music.opening'
  | 'music.gameplay'
  | 'sfx.shoot'
  | 'voice.start.leon'
  | 'voice.player.jimmy'
  | 'voice.player.zac';

export type AssetKey = ImageAssetKey | AudioAssetKey;
export type AssetKind = 'image' | 'audio';

export const IMAGE_ASSET_KEYS: readonly ImageAssetKey[] = [
  'player.default',
  'enemy.01',
  'enemy.02',
  'enemy.03',
  'enemy.04',
  'projectile.default',
  'background.openingTile',
  'background.openingMirrorSupertile',
  'background.openingFixed',
  'background.gameplayTile',
  'background.gameplayMirrorSupertile',
  'background.gameplayFixed',
  'ui.knob',
];

export const AUDIO_ASSET_KEYS: readonly AudioAssetKey[] = [
  'music.opening',
  'music.gameplay',
  'sfx.shoot',
  'voice.start.leon',
  'voice.player.jimmy',
  'voice.player.zac',
];

export const ALL_ASSET_KEYS: readonly AssetKey[] = [
  ...IMAGE_ASSET_KEYS,
  ...AUDIO_ASSET_KEYS,
];

export const isImageAssetKey = (value: string): value is ImageAssetKey =>
  (IMAGE_ASSET_KEYS as readonly string[]).includes(value);

export const isAudioAssetKey = (value: string): value is AudioAssetKey =>
  (AUDIO_ASSET_KEYS as readonly string[]).includes(value);

export const isAssetKey = (value: string): value is AssetKey =>
  isImageAssetKey(value) || isAudioAssetKey(value);

export interface BackgroundSceneConfig {
  readonly preferredKey: ImageAssetKey;
  readonly fallbackKey: ImageAssetKey;
  readonly sourceTileKey: ImageAssetKey;
  readonly wrap: 'mirror';
  readonly originalTileRepeat: readonly [number, number];
  readonly mirrorSupertileRepeat: readonly [number, number];
  readonly filter: 'bilinear';
}

export interface BackgroundRenderingConfig {
  readonly designAspectRatio: '9:16';
  readonly opening: BackgroundSceneConfig;
  readonly gameplay: BackgroundSceneConfig;
  readonly referenceConfig?: string;
}

/** JSON shape of the runtime asset manifest. */
export interface AssetManifest {
  readonly schemaVersion: 1;
  readonly basePath: string;
  readonly images: Readonly<Record<ImageAssetKey, string>>;
  readonly audio: Readonly<Record<AudioAssetKey, readonly string[]>>;
  readonly backgroundRendering: BackgroundRenderingConfig;
}

/** Compatibility name used by the application composition layer. */
export type RuntimeAssetManifest = AssetManifest;

export interface AssetSource {
  readonly path: string;
  readonly url: string;
  readonly format?: string;
}

/** Resolved descriptor consumed by browser/Phaser adapters. */
export interface AssetDescriptor {
  readonly key: AssetKey;
  readonly kind: AssetKind;
  /** Preferred URL. For audio this is the first manifest source. */
  readonly url: string;
  /** All resolved URLs, preserving manifest order. */
  readonly urls: readonly string[];
  readonly sources: readonly AssetSource[];
}

export type AssetFailureCode =
  | 'manifest-load-failed'
  | 'manifest-invalid'
  | 'manifest-schema-mismatch'
  | 'manifest-missing-key'
  | 'manifest-unknown-key'
  | 'manifest-invalid-path'
  | 'manifest-invalid-background';

export interface AssetFailure {
  readonly kind: 'asset-failure';
  readonly code: AssetFailureCode;
  readonly message: string;
  readonly key?: string;
  readonly path?: string;
  readonly cause?: unknown;
}

export type AssetManifestResult =
  | { readonly ok: true; readonly manifest: AssetManifest }
  | { readonly ok: false; readonly failure: AssetFailure };

export type AssetCatalogState = 'idle' | 'loading' | 'ready' | 'failed';

export interface AssetCatalogSnapshot {
  readonly state: AssetCatalogState;
  readonly manifest?: AssetManifest;
  readonly descriptors: Readonly<Record<AssetKey, AssetDescriptor>>;
  readonly failure?: AssetFailure;
}

export interface AssetManifestLoader {
  load(): Promise<unknown>;
}

/** Port name used at the browser/application boundary. */
export type ManifestLoaderPort = AssetManifestLoader;

export interface AssetCatalogPort {
  loadManifest(): Promise<AssetManifestResult>;
  getRequired(key: AssetKey): AssetDescriptor;
  getOptional(key: string): AssetDescriptor | undefined;
  snapshot(): AssetCatalogSnapshot;
}

export class AssetCatalogError extends Error {
  public readonly failure: AssetFailure;

  public constructor(failure: AssetFailure) {
    super(failure.message);
    this.name = 'AssetCatalogError';
    this.failure = failure;
  }
}

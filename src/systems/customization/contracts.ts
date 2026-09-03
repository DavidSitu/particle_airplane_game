export const CUSTOMIZATION_SCHEMA_VERSION = 1 as const;
export const NORMALIZED_IMAGE_SIZE = 512 as const;
export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;
export const MIN_DECODED_IMAGE_EDGE = 128 as const;
export const MAX_DECODED_IMAGE_EDGE = 8192 as const;
export const MAX_CUSTOM_ENEMY_IMAGES = 8 as const;

export const PACKAGED_PLAYER_ASSET_KEY = 'player.default' as const;
export const PACKAGED_ENEMY_ASSET_KEYS = [
  'enemy.01',
  'enemy.02',
  'enemy.03',
  'enemy.04',
] as const;

export type PackagedCharacterAssetKey =
  | typeof PACKAGED_PLAYER_ASSET_KEY
  | (typeof PACKAGED_ENEMY_ASSET_KEYS)[number];

export type CharacterRole = 'player' | 'enemy';
export type AllowedImageMimeType = 'image/png' | 'image/jpeg' | 'image/webp';
export type NormalizedImageMimeType = 'image/webp' | 'image/png';

export type CropSettings = Readonly<{
  panX: number;
  panY: number;
  zoom: number;
}>;

export const DEFAULT_CROP_SETTINGS: CropSettings = Object.freeze({
  panX: 0,
  panY: 0,
  zoom: 1,
});

export type CharacterSkinRef =
  | Readonly<{
      kind: 'packaged';
      assetKey: PackagedCharacterAssetKey;
    }>
  | Readonly<{
      kind: 'local-upload';
      id: string;
      revision: number;
    }>;

export interface CharacterSelection {
  readonly player: CharacterSkinRef;
  readonly enemies: readonly CharacterSkinRef[];
}

export interface ImageUploadInput {
  readonly file: Blob;
  readonly mimeType?: string;
  readonly role?: CharacterRole;
  readonly target?: CharacterRole;
}

export interface ProcessUploadOptions {
  readonly crop?: CropSettings;
  readonly role?: CharacterRole;
  readonly operationId?: string;
}

export interface NormalizedCharacterImage {
  readonly blob: Blob;
  readonly mimeType: NormalizedImageMimeType;
  readonly width: typeof NORMALIZED_IMAGE_SIZE;
  readonly height: typeof NORMALIZED_IMAGE_SIZE;
  readonly sourceMimeType: AllowedImageMimeType;
  readonly sourceWidth: number;
  readonly sourceHeight: number;
  readonly crop: CropSettings;
}

export interface CustomAssetRecord extends NormalizedCharacterImage {
  readonly id: string;
  readonly revision: number;
  readonly role: CharacterRole;
}

export interface CustomizationRecord {
  readonly schemaVersion: typeof CUSTOMIZATION_SCHEMA_VERSION;
  readonly revision: number;
  readonly selection: CharacterSelection;
  readonly assets: readonly CustomAssetRecord[];
}

export type CustomizationErrorCode =
  | 'unsupported-type'
  | 'spoofed-type'
  | 'file-too-large'
  | 'decode-failed'
  | 'image-too-small'
  | 'image-too-large'
  | 'invalid-crop'
  | 'invalid-selection'
  | 'invalid-asset'
  | 'too-many-enemies'
  | 'duplicate-enemy'
  | 'missing-asset'
  | 'persistence-unavailable'
  | 'persistence-failed'
  | 'corrupt-record'
  | 'version-mismatch'
  | 'not-found'
  | 'stale-operation'
  | 'stale-write'
  | 'encode-failed';

export class CustomizationError extends Error {
  readonly code: CustomizationErrorCode;

  constructor(code: CustomizationErrorCode, message = defaultErrorMessage(code)) {
    super(message);
    this.name = 'CustomizationError';
    this.code = code;
  }
}

export interface CustomizationWarning {
  readonly code:
    | 'persistence-unavailable'
    | 'persistence-failed'
    | 'corrupt-record'
    | 'version-mismatch';
}

export interface CustomizationSnapshot {
  readonly selection: CharacterSelection;
  readonly assets: readonly CustomAssetRecord[];
  readonly revision: number;
  readonly persistence: 'persistent' | 'memory';
  readonly warning?: CustomizationWarning;
}

export interface CustomizationLoadSuccess {
  readonly ok: true;
  readonly status: 'loaded';
  readonly source: 'persistent' | 'memory' | 'defaults';
  readonly selection: CharacterSelection;
  readonly snapshot: CustomizationSnapshot;
  readonly warning?: CustomizationWarning;
}

export type CustomizationLoadResult = CustomizationLoadSuccess;

export interface CustomizationSaveSuccess {
  readonly ok: true;
  readonly status: 'saved' | 'stale';
  readonly persisted: boolean;
  readonly selection: CharacterSelection;
  readonly snapshot: CustomizationSnapshot;
  readonly warning?: CustomizationWarning;
}

export interface CustomizationFailure {
  readonly ok: false;
  readonly status: 'rejected' | 'stale';
  readonly error: CustomizationError;
}

export type CustomizationMutationResult =
  | Readonly<{
      ok: true;
      status: 'updated';
      selection: CharacterSelection;
      snapshot: CustomizationSnapshot;
    }>
  | CustomizationFailure;

export type CustomizationSaveResult = CustomizationSaveSuccess | CustomizationFailure;

export type CustomizationDeleteResult =
  | Readonly<{
      ok: true;
      status: 'deleted';
      selection: CharacterSelection;
      snapshot: CustomizationSnapshot;
      persisted: boolean;
      warning?: CustomizationWarning;
    }>
  | CustomizationFailure;

export type CustomizationClearResult =
  | Readonly<{
      ok: true;
      status: 'cleared';
      selection: CharacterSelection;
      snapshot: CustomizationSnapshot;
      persisted: boolean;
      warning?: CustomizationWarning;
    }>
  | CustomizationFailure;

export interface ImageProcessingSuccess {
  readonly ok: true;
  readonly status: 'processed';
  readonly operationId: string;
  readonly revision: number;
  readonly role: CharacterRole;
  readonly ref: CharacterSkinRef;
  readonly asset: CustomAssetRecord;
  readonly image: NormalizedCharacterImage;
}

export type ImageProcessingResult =
  | ImageProcessingSuccess
  | (CustomizationFailure &
      Readonly<{
        operationId: string;
        revision: number;
      }>);

export interface CharacterStorePort {
  load(): Promise<CustomizationRecord | null>;
  save(record: CustomizationRecord): Promise<void>;
  clear(): Promise<void>;
}

export interface ImageProcessorPort {
  process(input: ImageUploadInput, crop?: CropSettings): Promise<NormalizedCharacterImage>;
}

export function createDefaultCharacterSelection(): CharacterSelection {
  return {
    player: {
      kind: 'packaged',
      assetKey: PACKAGED_PLAYER_ASSET_KEY,
    },
    enemies: PACKAGED_ENEMY_ASSET_KEYS.map((assetKey) => ({
      kind: 'packaged',
      assetKey,
    })),
  };
}

export function cloneCharacterSkinRef(ref: CharacterSkinRef): CharacterSkinRef {
  return ref.kind === 'packaged'
    ? { kind: 'packaged', assetKey: ref.assetKey }
    : { kind: 'local-upload', id: ref.id, revision: ref.revision };
}

export function cloneCharacterSelection(selection: CharacterSelection): CharacterSelection {
  return {
    player: cloneCharacterSkinRef(selection.player),
    enemies: selection.enemies.map(cloneCharacterSkinRef),
  };
}

export function cloneCustomAssetRecord(asset: CustomAssetRecord): CustomAssetRecord {
  return {
    id: asset.id,
    revision: asset.revision,
    role: asset.role,
    blob: asset.blob,
    mimeType: asset.mimeType,
    width: asset.width,
    height: asset.height,
    sourceMimeType: asset.sourceMimeType,
    sourceWidth: asset.sourceWidth,
    sourceHeight: asset.sourceHeight,
    crop: { ...asset.crop },
  };
}

export function cloneCustomizationRecord(record: CustomizationRecord): CustomizationRecord {
  return {
    schemaVersion: CUSTOMIZATION_SCHEMA_VERSION,
    revision: record.revision,
    selection: cloneCharacterSelection(record.selection),
    assets: record.assets.map(cloneCustomAssetRecord),
  };
}

export function assertCropSettings(value: CropSettings): void {
  if (
    !Number.isFinite(value.panX) ||
    !Number.isFinite(value.panY) ||
    !Number.isFinite(value.zoom) ||
    value.panX < -1 ||
    value.panX > 1 ||
    value.panY < -1 ||
    value.panY > 1 ||
    value.zoom < 1 ||
    value.zoom > 3
  ) {
    throw new CustomizationError('invalid-crop');
  }
}

export function isAllowedImageMimeType(value: string): value is AllowedImageMimeType {
  return value === 'image/png' || value === 'image/jpeg' || value === 'image/webp';
}

export function assertCharacterSelection(value: unknown): asserts value is CharacterSelection {
  if (!isRecord(value) || !isCharacterSkinRef(value.player) || !Array.isArray(value.enemies)) {
    throw new CustomizationError('invalid-selection');
  }

  if (value.enemies.length > MAX_CUSTOM_ENEMY_IMAGES) {
    throw new CustomizationError('too-many-enemies');
  }

  const seen = new Set<string>();
  for (const enemy of value.enemies) {
    if (!isCharacterSkinRef(enemy)) throw new CustomizationError('invalid-selection');
    const identity = skinIdentity(enemy);
    if (seen.has(identity)) throw new CustomizationError('duplicate-enemy');
    seen.add(identity);
  }

  if (value.player.kind === 'packaged' && value.player.assetKey !== PACKAGED_PLAYER_ASSET_KEY) {
    throw new CustomizationError('invalid-selection');
  }
  for (const enemy of value.enemies) {
    if (enemy.kind === 'packaged' && !isPackagedEnemyAssetKey(enemy.assetKey)) {
      throw new CustomizationError('invalid-selection');
    }
  }
}

export function assertCustomAssetRecord(value: unknown): asserts value is CustomAssetRecord {
  if (!isRecord(value)) throw new CustomizationError('invalid-asset');
  const revision = value.revision;
  if (
    typeof value.id !== 'string' ||
    value.id.length === 0 ||
    typeof revision !== 'number' ||
    !Number.isSafeInteger(revision) ||
    revision < 1 ||
    (value.role !== 'player' && value.role !== 'enemy')
  ) {
    throw new CustomizationError('invalid-asset');
  }
  assertNormalizedCharacterImage(value);
}

export function assertNormalizedCharacterImage(value: unknown): asserts value is NormalizedCharacterImage {
  if (!isRecord(value) || !isBlobLike(value.blob)) {
    throw new CustomizationError('invalid-asset');
  }
  const sourceMimeType = value.sourceMimeType;
  const sourceWidth = value.sourceWidth;
  const sourceHeight = value.sourceHeight;
  if (
    value.mimeType !== 'image/webp' &&
    value.mimeType !== 'image/png'
  ) {
    throw new CustomizationError('invalid-asset');
  }
  const blobType = value.blob.type.toLowerCase();
  if (blobType !== '' && blobType !== value.mimeType) {
    throw new CustomizationError('invalid-asset');
  }
  if (
    value.width !== NORMALIZED_IMAGE_SIZE ||
    value.height !== NORMALIZED_IMAGE_SIZE ||
    typeof sourceMimeType !== 'string' ||
    !isAllowedImageMimeType(sourceMimeType) ||
    typeof sourceWidth !== 'number' ||
    typeof sourceHeight !== 'number' ||
    !Number.isSafeInteger(sourceWidth) ||
    !Number.isSafeInteger(sourceHeight) ||
    sourceWidth < MIN_DECODED_IMAGE_EDGE ||
    sourceHeight < MIN_DECODED_IMAGE_EDGE ||
    sourceWidth > MAX_DECODED_IMAGE_EDGE ||
    sourceHeight > MAX_DECODED_IMAGE_EDGE ||
    !isRecord(value.crop)
  ) {
    throw new CustomizationError('invalid-asset');
  }
  assertCropSettings(value.crop as CropSettings);
}

export function assertCustomizationRecord(value: unknown): asserts value is CustomizationRecord {
  if (!isRecord(value)) throw new CustomizationError('corrupt-record');
  if (value.schemaVersion !== CUSTOMIZATION_SCHEMA_VERSION) {
    throw new CustomizationError('version-mismatch');
  }
  const revision = value.revision;
  if (
    typeof revision !== 'number' ||
    !Number.isSafeInteger(revision) ||
    revision < 0
  ) {
    throw new CustomizationError('corrupt-record');
  }
  assertCharacterSelection(value.selection);
  if (!Array.isArray(value.assets)) throw new CustomizationError('corrupt-record');

  const ids = new Set<string>();
  for (const asset of value.assets) {
    assertCustomAssetRecord(asset);
    if (ids.has(asset.id)) throw new CustomizationError('corrupt-record');
    ids.add(asset.id);
  }
}

export function isPackagedEnemyAssetKey(value: string): value is (typeof PACKAGED_ENEMY_ASSET_KEYS)[number] {
  return (PACKAGED_ENEMY_ASSET_KEYS as readonly string[]).includes(value);
}

export function isBlobLike(value: unknown): value is Blob {
  if (!isRecord(value)) return false;
  return (
    typeof value.size === 'number' &&
    Number.isFinite(value.size) &&
    typeof value.type === 'string' &&
    typeof value.slice === 'function'
  );
}

function isCharacterSkinRef(value: unknown): value is CharacterSkinRef {
  if (!isRecord(value) || (value.kind !== 'packaged' && value.kind !== 'local-upload')) return false;
  if (value.kind === 'packaged') {
    return typeof value.assetKey === 'string';
  }
  const revision = value.revision;
  return (
    typeof value.id === 'string' &&
    value.id.length > 0 &&
    typeof revision === 'number' &&
    Number.isSafeInteger(revision) &&
    revision > 0
  );
}

function skinIdentity(ref: CharacterSkinRef): string {
  return ref.kind === 'packaged' ? `packaged:${ref.assetKey}` : `local:${ref.id}:${ref.revision}`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function defaultErrorMessage(code: CustomizationErrorCode): string {
  switch (code) {
    case 'unsupported-type':
      return 'The image type is not supported.';
    case 'spoofed-type':
      return 'The image type does not match its content.';
    case 'file-too-large':
      return 'The image is too large.';
    case 'decode-failed':
      return 'The image could not be decoded.';
    case 'image-too-small':
      return 'The image dimensions are too small.';
    case 'image-too-large':
      return 'The image dimensions are too large.';
    case 'invalid-crop':
      return 'The crop settings are invalid.';
    case 'invalid-selection':
      return 'The character selection is invalid.';
    case 'invalid-asset':
      return 'The character image record is invalid.';
    case 'too-many-enemies':
      return 'The enemy roster is too large.';
    case 'duplicate-enemy':
      return 'The enemy roster contains a duplicate.';
    case 'missing-asset':
      return 'A selected character image is unavailable.';
    case 'persistence-unavailable':
      return 'Persistent character storage is unavailable.';
    case 'persistence-failed':
      return 'Persistent character storage failed.';
    case 'corrupt-record':
      return 'Saved character data is corrupt.';
    case 'version-mismatch':
      return 'Saved character data uses an unsupported version.';
    case 'not-found':
      return 'The requested character image was not found.';
    case 'stale-operation':
      return 'The image operation was superseded.';
    case 'stale-write':
      return 'The character save was superseded.';
    case 'encode-failed':
      return 'The image could not be normalized.';
  }
}

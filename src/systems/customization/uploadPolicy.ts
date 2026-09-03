import {
  assertCropSettings,
  CustomizationError,
  MAX_DECODED_IMAGE_EDGE,
  MAX_UPLOAD_BYTES,
  MIN_DECODED_IMAGE_EDGE,
  type AllowedImageMimeType,
  type CropSettings,
  type ImageUploadInput,
} from './contracts';

export function declaredImageMimeType(input: ImageUploadInput): string {
  return (input.mimeType ?? input.file.type).trim().toLowerCase();
}

export function validateUploadMetadata(input: ImageUploadInput): AllowedImageMimeType {
  if (!isBlobLike(input.file)) throw new CustomizationError('decode-failed');
  if (input.file.size > MAX_UPLOAD_BYTES) throw new CustomizationError('file-too-large');

  const mimeType = declaredImageMimeType(input);
  if (
    mimeType !== 'image/png' &&
    mimeType !== 'image/jpeg' &&
    mimeType !== 'image/webp'
  ) {
    throw new CustomizationError('unsupported-type');
  }
  return mimeType;
}

export function validateCrop(crop: CropSettings): void {
  assertCropSettings(crop);
}

export function validateDecodedDimensions(width: number, height: number): void {
  if (
    !Number.isSafeInteger(width) ||
    !Number.isSafeInteger(height) ||
    width < 1 ||
    height < 1
  ) {
    throw new CustomizationError('decode-failed');
  }
  if (width < MIN_DECODED_IMAGE_EDGE || height < MIN_DECODED_IMAGE_EDGE) {
    throw new CustomizationError('image-too-small');
  }
  if (width > MAX_DECODED_IMAGE_EDGE || height > MAX_DECODED_IMAGE_EDGE) {
    throw new CustomizationError('image-too-large');
  }
}

export function matchesDeclaredImageSignature(
  mimeType: AllowedImageMimeType,
  bytes: Uint8Array,
): boolean {
  switch (mimeType) {
    case 'image/png':
      return hasBytes(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    case 'image/jpeg':
      return hasBytes(bytes, [0xff, 0xd8, 0xff]);
    case 'image/webp':
      return (
        hasAscii(bytes, 0, 'RIFF') &&
        hasAscii(bytes, 8, 'WEBP') &&
        bytes.length >= 12
      );
  }
}

function hasBytes(value: Uint8Array, expected: readonly number[]): boolean {
  if (value.length < expected.length) return false;
  return expected.every((byte, index) => value[index] === byte);
}

function hasAscii(value: Uint8Array, offset: number, expected: string): boolean {
  if (value.length < offset + expected.length) return false;
  return [...expected].every((character, index) => value[offset + index] === character.charCodeAt(0));
}

function isBlobLike(value: unknown): value is Blob {
  if (typeof value !== 'object' || value === null) return false;
  const candidate = value as { size?: unknown; type?: unknown; arrayBuffer?: unknown };
  return (
    typeof candidate.size === 'number' &&
    Number.isFinite(candidate.size) &&
    typeof candidate.type === 'string' &&
    typeof candidate.arrayBuffer === 'function'
  );
}

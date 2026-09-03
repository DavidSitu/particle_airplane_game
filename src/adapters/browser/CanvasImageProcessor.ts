import {
  assertCropSettings,
  CustomizationError,
  DEFAULT_CROP_SETTINGS,
  NORMALIZED_IMAGE_SIZE,
  type CropSettings,
  type ImageUploadInput,
  type NormalizedCharacterImage,
} from '../../systems/customization/contracts';
import {
  matchesDeclaredImageSignature,
  validateDecodedDimensions,
  validateUploadMetadata,
} from '../../systems/customization/uploadPolicy';

export interface CanvasDrawingContext {
  imageSmoothingEnabled: boolean;
  imageSmoothingQuality?: ImageSmoothingQuality;
  drawImage(
    image: CanvasImageSource,
    dx: number,
    dy: number,
    dw: number,
    dh: number,
  ): void;
}

export interface RenderCanvas {
  width: number;
  height: number;
  getContext(contextId: '2d'): CanvasDrawingContext | null;
  toBlob?(
    callback: (blob: Blob | null) => void,
    type?: string,
    quality?: number,
  ): void;
  convertToBlob?(options?: { type?: string; quality?: number }): Promise<Blob>;
}

export interface DecodedImageSource {
  readonly source: CanvasImageSource;
  readonly width: number;
  readonly height: number;
  readonly close?: () => void;
}

export interface CanvasImageProcessorOptions {
  readonly createCanvas?: (width: number, height: number) => RenderCanvas;
  readonly decode?: (blob: Blob) => Promise<DecodedImageSource>;
}

export class CanvasImageProcessor {
  private readonly createCanvas: (width: number, height: number) => RenderCanvas;
  private readonly decode: (blob: Blob) => Promise<DecodedImageSource>;

  constructor(options: CanvasImageProcessorOptions = {}) {
    this.createCanvas = options.createCanvas ?? createBrowserCanvas;
    this.decode = options.decode ?? decodeBrowserImage;
  }

  async process(
    input: ImageUploadInput,
    crop: CropSettings = DEFAULT_CROP_SETTINGS,
  ): Promise<NormalizedCharacterImage> {
    const sourceMimeType = validateUploadMetadata(input);
    assertCropSettings(crop);

    let bytes: Uint8Array;
    try {
      bytes = new Uint8Array(await input.file.arrayBuffer());
    } catch {
      throw new CustomizationError('decode-failed');
    }
    if (!matchesDeclaredImageSignature(sourceMimeType, bytes)) {
      throw new CustomizationError('spoofed-type');
    }

    let decoded: DecodedImageSource;
    try {
      decoded = await this.decode(input.file);
    } catch {
      throw new CustomizationError('decode-failed');
    }

    try {
      validateDecodedDimensions(decoded.width, decoded.height);
      const canvas = this.createCanvas(NORMALIZED_IMAGE_SIZE, NORMALIZED_IMAGE_SIZE);
      const context = canvas.getContext('2d');
      if (context === null) throw new CustomizationError('encode-failed');

      context.imageSmoothingEnabled = true;
      context.imageSmoothingQuality = 'high';

      const draw = coverCrop(
        decoded.width,
        decoded.height,
        NORMALIZED_IMAGE_SIZE,
        crop,
      );
      context.drawImage(decoded.source, draw.x, draw.y, draw.width, draw.height);

      const encoded = await encodeCanvas(canvas, 'image/webp', 0.9);
      const blob = encoded ?? (await encodeCanvas(canvas, 'image/png'));
      if (blob === null || blob.size === 0) {
        throw new CustomizationError('encode-failed');
      }

      const mimeType = blob.type === 'image/webp' ? 'image/webp' : 'image/png';
      return {
        blob,
        mimeType,
        width: NORMALIZED_IMAGE_SIZE,
        height: NORMALIZED_IMAGE_SIZE,
        sourceMimeType,
        sourceWidth: decoded.width,
        sourceHeight: decoded.height,
        crop: { ...crop },
      };
    } finally {
      decoded.close?.();
    }
  }
}

export function coverCrop(
  sourceWidth: number,
  sourceHeight: number,
  targetSize: number,
  crop: CropSettings,
): Readonly<{ x: number; y: number; width: number; height: number }> {
  assertCropSettings(crop);
  const baseScale = Math.max(targetSize / sourceWidth, targetSize / sourceHeight);
  const scale = baseScale * crop.zoom;
  const width = sourceWidth * scale;
  const height = sourceHeight * scale;
  const excessX = width - targetSize;
  const excessY = height - targetSize;
  return {
    x: (targetSize - width) / 2 + (excessX / 2) * crop.panX,
    y: (targetSize - height) / 2 + (excessY / 2) * crop.panY,
    width,
    height,
  };
}

async function encodeCanvas(
  canvas: RenderCanvas,
  type: 'image/webp' | 'image/png',
  quality?: number,
): Promise<Blob | null> {
  if (canvas.convertToBlob !== undefined) {
    try {
      const blob = await canvas.convertToBlob({ type, quality });
      return blob.size > 0 ? blob : null;
    } catch {
      return null;
    }
  }

  const toBlob = canvas.toBlob;
  if (toBlob === undefined) return null;
  return new Promise((resolve) => {
    try {
      toBlob.call(
        canvas,
        (blob) => resolve(blob !== null && blob.size > 0 ? blob : null),
        type,
        quality,
      );
    } catch {
      resolve(null);
    }
  });
}

function createBrowserCanvas(width: number, height: number): RenderCanvas {
  if (typeof document !== 'undefined') {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    return canvas;
  }
  if (typeof OffscreenCanvas !== 'undefined') {
    return new OffscreenCanvas(width, height) as unknown as RenderCanvas;
  }
  throw new CustomizationError('encode-failed');
}

async function decodeBrowserImage(blob: Blob): Promise<DecodedImageSource> {
  if (typeof createImageBitmap === 'function') {
    const bitmap = await createImageBitmap(blob);
    return {
      source: bitmap,
      width: bitmap.width,
      height: bitmap.height,
      close: () => bitmap.close(),
    };
  }

  if (typeof Image === 'undefined' || typeof URL === 'undefined') {
    throw new CustomizationError('decode-failed');
  }
  const urlApi = URL;
  const objectUrl = urlApi.createObjectURL(blob);
  try {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const element = new Image();
      element.decoding = 'async';
      element.onload = () => resolve(element);
      element.onerror = () => reject(new CustomizationError('decode-failed'));
      element.src = objectUrl;
    });
    return {
      source: image,
      width: image.naturalWidth,
      height: image.naturalHeight,
      close: () => urlApi.revokeObjectURL(objectUrl),
    };
  } catch (error) {
    urlApi.revokeObjectURL(objectUrl);
    throw error;
  }
}

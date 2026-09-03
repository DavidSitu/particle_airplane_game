import { describe, expect, it } from 'vitest';
import {
  CanvasImageProcessor,
  coverCrop,
  type CanvasDrawingContext,
  type RenderCanvas,
} from '../../src/adapters/browser/CanvasImageProcessor';
import {
  MAX_UPLOAD_BYTES,
  type ImageUploadInput,
} from '../../src/systems/customization';

const pngSignature = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

function upload(type: string, bytes: BlobPart = pngSignature): ImageUploadInput {
  return {
    file: new Blob([bytes], { type }),
    mimeType: type,
  };
}

class FakeContext implements CanvasDrawingContext {
  imageSmoothingEnabled = false;
  imageSmoothingQuality: ImageSmoothingQuality | undefined;
  readonly draws: Array<readonly [number, number, number, number]> = [];

  drawImage(
    _image: CanvasImageSource,
    dx: number,
    dy: number,
    dw: number,
    dh: number,
  ): void {
    this.draws.push([dx, dy, dw, dh]);
  }
}

class FakeCanvas implements RenderCanvas {
  width = 512;
  height = 512;
  readonly context = new FakeContext();
  readonly encodedTypes: string[] = [];

  getContext(): CanvasDrawingContext {
    return this.context;
  }

  toBlob(callback: (blob: Blob | null) => void, type?: string): void {
    this.encodedTypes.push(type ?? '');
    callback(type === 'image/webp' ? null : new Blob(['png'], { type: 'image/png' }));
  }
}

describe('CanvasImageProcessor', () => {
  it('rejects unsupported, spoofed, and oversized inputs before browser decode', async () => {
    const processor = new CanvasImageProcessor();
    const cases: Array<[ImageUploadInput, string]> = [
      [upload('image/gif'), 'unsupported-type'],
      [upload('image/jpeg'), 'spoofed-type'],
      [
        upload('image/png', new Uint8Array(MAX_UPLOAD_BYTES + 1)),
        'file-too-large',
      ],
    ];

    for (const [input, code] of cases) {
      await expect(processor.process(input)).rejects.toMatchObject({ code });
    }
  });

  it('cover-crops with bounded pan and zoom and falls back from WebP to PNG', async () => {
    const canvas = new FakeCanvas();
    const processor = new CanvasImageProcessor({
      createCanvas: () => canvas,
      decode: async () => ({
        source: {} as CanvasImageSource,
        width: 400,
        height: 200,
      }),
    });

    const result = await processor.process(upload('image/png'), {
      panX: 0.5,
      panY: -0.5,
      zoom: 2,
    });

    expect(result.mimeType).toBe('image/png');
    expect(result.width).toBe(512);
    expect(result.height).toBe(512);
    expect(result.crop).toEqual({ panX: 0.5, panY: -0.5, zoom: 2 });
    expect(canvas.encodedTypes).toEqual(['image/webp', 'image/png']);
    expect(canvas.context.imageSmoothingEnabled).toBe(true);
    expect(canvas.context.imageSmoothingQuality).toBe('high');
    expect(canvas.context.draws).toHaveLength(1);
  });

  it('uses a square cover scale at the neutral crop', () => {
    expect(coverCrop(400, 200, 512, { panX: 0, panY: 0, zoom: 1 })).toEqual({
      x: -256,
      y: 0,
      width: 1024,
      height: 512,
    });
  });

  it('rejects decoded dimensions outside the policy bounds and invalid crop settings', async () => {
    const small = new CanvasImageProcessor({
      decode: async () => ({ source: {} as CanvasImageSource, width: 127, height: 128 }),
    });
    await expect(small.process(upload('image/png'))).rejects.toMatchObject({ code: 'image-too-small' });

    const large = new CanvasImageProcessor({
      decode: async () => ({ source: {} as CanvasImageSource, width: 8193, height: 128 }),
    });
    await expect(large.process(upload('image/png'))).rejects.toMatchObject({ code: 'image-too-large' });

    const invalidCrop = new CanvasImageProcessor({
      decode: async () => ({ source: {} as CanvasImageSource, width: 128, height: 128 }),
    });
    await expect(
      invalidCrop.process(upload('image/png'), { panX: 0, panY: 0, zoom: 4 }),
    ).rejects.toMatchObject({ code: 'invalid-crop' });
  });
});

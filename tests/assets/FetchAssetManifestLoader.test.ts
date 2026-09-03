import { describe, expect, it, vi } from 'vitest';
import { FetchAssetManifestLoader } from '../../src/adapters/browser/FetchAssetManifestLoader';

describe('FetchAssetManifestLoader', () => {
  it('fetches JSON with same-origin credentials and an explicit accept header', async () => {
    const response = { ok: true, status: 200, json: vi.fn().mockResolvedValue({ schemaVersion: 1 }) } as unknown as Response;
    const fetchImpl = vi.fn().mockResolvedValue(response);
    const loader = new FetchAssetManifestLoader({ manifestUrl: '/custom/manifest.json', fetchImpl });

    await expect(loader.load()).resolves.toEqual({ schemaVersion: 1 });
    expect(fetchImpl).toHaveBeenCalledWith('/custom/manifest.json', {
      headers: { Accept: 'application/json' },
      credentials: 'same-origin',
    });
  });

  it('turns network, HTTP, and JSON failures into useful errors', async () => {
    const networkLoader = new FetchAssetManifestLoader({ fetchImpl: vi.fn().mockRejectedValue(new Error('offline')) });
    await expect(networkLoader.load()).rejects.toThrow('Asset manifest request failed');

    const httpLoader = new FetchAssetManifestLoader({
      fetchImpl: vi.fn().mockResolvedValue({ ok: false, status: 503 } as Response),
    });
    await expect(httpLoader.load()).rejects.toThrow('HTTP 503');

    const jsonLoader = new FetchAssetManifestLoader({
      fetchImpl: vi.fn().mockResolvedValue({ ok: true, status: 200, json: vi.fn().mockRejectedValue(new Error('bad json')) } as unknown as Response),
    });
    await expect(jsonLoader.loadManifest()).rejects.toThrow('not valid JSON');
  });
});

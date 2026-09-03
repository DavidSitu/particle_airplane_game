import manifest from '../../public/assets/asset-manifest.json';
import { describe, expect, it } from 'vitest';
import {
  ALL_ASSET_KEYS,
  AssetCatalog,
  AssetCatalogError,
  AUDIO_ASSET_KEYS,
  IMAGE_ASSET_KEYS,
  parseAssetManifest,
  type AssetManifestLoader,
} from '../../src/systems/assets';

const cloneManifest = (): Record<string, unknown> =>
  JSON.parse(JSON.stringify(manifest)) as Record<string, unknown>;

const loaderFor = (value: unknown, delay = 0): AssetManifestLoader => ({
  load: async () => {
    if (delay > 0) await new Promise((resolve) => setTimeout(resolve, delay));
    return value;
  },
});

describe('AssetCatalog', () => {
  it('validates the supplied manifest with all thirteen image and six audio roles', () => {
    const result = parseAssetManifest(manifest);
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(Object.keys(result.manifest.images)).toHaveLength(13);
    expect(Object.keys(result.manifest.audio)).toHaveLength(6);
    expect(IMAGE_ASSET_KEYS).toHaveLength(13);
    expect(AUDIO_ASSET_KEYS).toHaveLength(6);
    expect(ALL_ASSET_KEYS).toHaveLength(19);
    expect(result.manifest.backgroundRendering.opening.mirrorSupertileRepeat).toEqual([5, 5]);
  });

  it('resolves semantic descriptors against the manifest basePath', async () => {
    const catalog = new AssetCatalog(loaderFor(manifest));
    const loaded = await catalog.loadManifest();
    expect(loaded.ok).toBe(true);
    expect(catalog.snapshot().state).toBe('ready');

    expect(catalog.getRequired('player.default')).toMatchObject({
      key: 'player.default',
      kind: 'image',
      url: '/assets/images/characters/player/default_player.png',
    });
    expect(catalog.getRequired('music.opening')).toMatchObject({
      key: 'music.opening',
      kind: 'audio',
      urls: [
        '/assets/audio/ogg/music/opening_music.ogg',
        '/assets/audio/mp3/music/opening_music.mp3',
      ],
    });
    expect(catalog.getOptional('not-a-role')).toBeUndefined();
  });

  it('deduplicates concurrent loads and permits an explicit retry after failure', async () => {
    let calls = 0;
    const loader: AssetManifestLoader = {
      load: async () => {
        calls += 1;
        if (calls === 1) throw new Error('temporary network failure');
        return manifest;
      },
    };
    const catalog = new AssetCatalog(loader);

    const first = await catalog.loadManifest();
    expect(first.ok).toBe(false);
    expect(catalog.snapshot().state).toBe('failed');
    const second = await catalog.loadManifest();
    expect(second.ok).toBe(true);
    expect(calls).toBe(2);
  });

  it('reports malformed schema, missing roles, unknown roles, and unsafe paths', () => {
    const wrongVersion = cloneManifest();
    wrongVersion.schemaVersion = 99;
    expect(parseAssetManifest(wrongVersion)).toMatchObject({
      ok: false,
      failure: { code: 'manifest-schema-mismatch' },
    });

    const missingImage = cloneManifest();
    delete (missingImage.images as Record<string, unknown>)['enemy.04'];
    expect(parseAssetManifest(missingImage)).toMatchObject({
      ok: false,
      failure: { code: 'manifest-missing-key', key: 'enemy.04' },
    });

    const unknownRole = cloneManifest();
    (unknownRole.images as Record<string, unknown>)['enemy.99'] = 'images/enemy.png';
    expect(parseAssetManifest(unknownRole)).toMatchObject({
      ok: false,
      failure: { code: 'manifest-unknown-key', key: 'enemy.99' },
    });

    const unsafePath = cloneManifest();
    (unsafePath.images as Record<string, unknown>)['player.default'] = '../private/player.png';
    expect(parseAssetManifest(unsafePath)).toMatchObject({
      ok: false,
      failure: { code: 'manifest-invalid-path', key: 'player.default' },
    });
  });

  it('rejects invalid audio sources and throws a typed error for unresolved required assets', async () => {
    const invalidAudio = cloneManifest();
    (invalidAudio.audio as Record<string, unknown>)['music.opening'] = ['audio/music.wav'];
    expect(parseAssetManifest(invalidAudio)).toMatchObject({
      ok: false,
      failure: { code: 'manifest-invalid-path', key: 'music.opening' },
    });

    const catalog = new AssetCatalog(loaderFor(manifest));
    expect(() => catalog.getRequired('player.default')).toThrow(AssetCatalogError);
  });
});

import type { AssetManifestLoader } from '../../systems/assets';

export interface FetchAssetManifestLoaderOptions {
  readonly manifestUrl?: string;
  readonly fetchImpl?: typeof fetch;
}

const DEFAULT_MANIFEST_URL = `${import.meta.env.BASE_URL}assets/asset-manifest.json`;

/** Fetches untrusted JSON; AssetCatalog owns schema and path validation. */
export class FetchAssetManifestLoader implements AssetManifestLoader {
  private readonly manifestUrl: string;
  private readonly fetchImpl: typeof fetch;

  public constructor(options: FetchAssetManifestLoaderOptions = {}) {
    this.manifestUrl = options.manifestUrl ?? DEFAULT_MANIFEST_URL;
    // Browser fetch is host-bound in some engines. Bind it once so invoking
    // the stored function through this adapter cannot produce Illegal invocation.
    this.fetchImpl = options.fetchImpl ?? globalThis.fetch.bind(globalThis);
  }

  public async load(): Promise<unknown> {
    let response: Response;
    try {
      response = await this.fetchImpl(this.manifestUrl, {
        headers: { Accept: 'application/json' },
        credentials: 'same-origin',
      });
    } catch (cause) {
      throw new Error(`Asset manifest request failed: ${this.manifestUrl}`, { cause });
    }

    if (!response.ok) {
      throw new Error(`Asset manifest request returned HTTP ${response.status}.`);
    }
    try {
      return await response.json();
    } catch (cause) {
      throw new Error('Asset manifest response was not valid JSON.', { cause });
    }
  }

  /** Compatibility alias for callers that name the operation explicitly. */
  public loadManifest(): Promise<unknown> {
    return this.load();
  }
}

export const createFetchAssetManifestLoader = (
  options?: FetchAssetManifestLoaderOptions,
): FetchAssetManifestLoader => new FetchAssetManifestLoader(options);
